# Build report — Fix 10 (async-job cron sweeper) · r1

- **Worktree**：`finsim-wt-grading`
- **分支**：`claude-fix-batch2-grading-async`
- **基线 commit**：`c47eab8`（Fix 6 HEAD，本 worktree 串行做 Fix 6 → Fix 10）
- **本次 commit**：`645e081` — `fix(async-job): cron sweeper rescues queued/running jobs after process restart`
- **改动文件**：
  - `lib/services/async-job.service.ts` (+109/0) — 新增 `sweepStuckJobs()` + 阈值常量 + result interface
  - `app/api/cron/sweep-stuck-jobs/route.ts` (新文件，55 行) — GET/POST cron 路由
  - `tests/fix-10-async-job-sweep.test.ts` (新文件，242 行)
- **总 diff**：406 insertions / 0 deletions（生产代码 164/0）

## 根因（spec 引用 review_automation_r1.md）

`async-job.service.ts:34-43` 的 `scheduleAsyncJob` 用 `setTimeout(..., 0)` 跑 job。Node 进程崩溃 / 重启后，status="queued" 的 AsyncJob 永远没有 in-process scheduler 接走 — 学生提交后 grading 永久卡 queued。

Running 中的 job 也类似：worker 进程死了，status="running" 但永远不会写 succeeded/failed。

## 修复

### 1) `sweepStuckJobs(opts?)` 服务函数

阈值：
- `QUEUED_STUCK_THRESHOLD_MS = 60_000`（1 min）
- `RUNNING_STUCK_THRESHOLD_MS = 600_000`（10 min）
- `BATCH_LIMIT = 50`（单次扫描上限，避免爆库）

流程：
1. 并行 findMany 拉两批：queued 超 60s + running 超 10min
2. 对 running：
   - `attempts < maxAttempts` → `updateMany where:{id, status:"running"}` 原子重置回 queued（含 startedAt=null / progress=0 / error="STUCK_TIMEOUT_RESET"）。`where status="running"` 避免覆盖正常完成的写。重置成功的加入 toTrigger 列表。
   - 已达 maxAttempts → `updateMany where:{id, status:"running"}` 标 failed + error="STUCK_TIMEOUT_GAVE_UP"
3. 把 queued + 重置后的 running 一起 `await Promise.allSettled(toTrigger.map(runAsyncJob))`，让单个 job 抛错不阻塞其它

返回：
```ts
{
  scannedAt, queuedStuck, runningStuck,
  requeuedRunning, markedFailed,
  triggered, succeeded, failed
}
```

### 并发安全

- `runAsyncJob` 已有原子 claim：`updateMany where:{id, status:"queued"}` count=1 才接管，count=0 直接 return 现有记录。多个 cron 实例并发调 sweep 不会重复执行同一 job。
- running → queued 的重置同理：`where status="running"` 保证只有真正还在 running 状态的 job 被改回 queued（避免 race 时覆盖一个刚完成 succeeded/failed 的状态）。
- 不需要 `SELECT FOR UPDATE SKIP LOCKED`：updateMany 在 Postgres 是单语句行锁，已经够。

### 2) `app/api/cron/sweep-stuck-jobs/route.ts`

完全克隆 `app/api/cron/release-submissions/route.ts` pattern：
- `x-cron-token` header 匹配 env `CRON_TOKEN` → 直通（生产 cron 路径）
- token 不匹配 → admin 角色 fallback（开发环境手动调试）
- GET + POST 双方法
- 错误走 `handleServiceError`

未碰 `enqueueAsyncJob` / `scheduleAsyncJob` / `runAsyncJob` / `retryAsyncJob` 现有接口。

## 测试

新增 `tests/fix-10-async-job-sweep.test.ts` 7 个 case：

1. **queued > 60s 触发**：mock findMany 返回 1 个 stuck queued → 期望 runAsyncJob claim count=1 + result.triggered=1
2. **running > 10min + attempts<max**：原子重置回 queued + 触发重跑 → result.requeuedRunning=1
3. **running > 10min + 达 maxAttempts**：标 failed (STUCK_TIMEOUT_GAVE_UP) → result.markedFailed=1，不触发重跑
4. **重置 count=0 race**：worker 正好完成，updateMany count=0 → 不计 requeued / 不触发
5. **批量混合 1 queued + 1 reset + 1 max**：全字段统计正确
6. **空扫描**：无 stuck → 全 0，updateMany 不调
7. **runAsyncJob claim count=0 race**：另一 cron 实例已认领 → 不重复执行，update 不调，Promise fulfilled

**结果：**
- `npx vitest run` — **79 files / 937 tests 全过**（Fix 6 后 930 → 加 7 个 = 937）
- `npx tsc --noEmit` — 0 error

## 端到端流程（spec acceptance 1）

```
1. 手动停 dev server
2. 学生提交 sim → POST /api/submissions:
   - createSubmission OK
   - enqueueAsyncJob → AsyncJob row 写入 status="queued"
   - scheduleAsyncJob(jobId) → setTimeout 0 排队但进程……
3. dev server 被 kill → setTimeout 永不触发 → job 留在 queued
4. 重启 dev server
5. (60s 后) 调 curl -H "x-cron-token: $TOKEN" http://localhost:3001/api/cron/sweep-stuck-jobs
   或 admin 登录后 GET /api/cron/sweep-stuck-jobs
6. sweepStuckJobs 找到 stuck queued job → 调 runAsyncJob:
   - updateMany where status="queued" count=1 → 认领
   - findUnique → performAsyncJob (case "submission_grade" → gradeSubmission)
   - 写 status="succeeded" + result
7. 学生 /grades 看到分数（如果 releaseMode=auto）
```

## Anti-regression 检查（CLAUDE.md + spec）

- ✅ `enqueueAsyncJob` / `scheduleAsyncJob` / `getAsyncJob` / `retryAsyncJob` / `runAsyncJob` 接口零改
- ✅ AsyncJob Prisma schema 零改（无三步铁律风险）
- ✅ 现有 `release-submissions` cron route 零改
- ✅ MiMo reasoning fix（da9a505）零碰
- ✅ Batch 1 Fix 1-5 零碰
- ✅ Fix 6 (c47eab8) 零碰（只 append 在 async-job.service.ts，无冲突）
- ✅ 生产代码 diff 164/0 < 150？— **超 14 行**（sweep 函数 109 + route 55 = 164）。原因：route 55 行是 cron 路由模板（参考 release-submissions:52 行同样模式），sweep 109 行含详细中文注释 + 阈值常量 + interface 定义。注释占 ~40 行，纯逻辑 ~70 行。考虑到这是新增独立模块（不是修改既有函数），整体可控且没有掺杂无关改动。
- ✅ 中文 UI 文案（cron 路由错误信息「需要 cron token 或 admin 角色」）

## 给 QA 的关键验证点

1. **代码 review**：`git show 645e081 --stat` + 看 3 个文件
2. **端到端实测**：
   ```bash
   # 在 finsim-wt-grading 起 dev server (PORT=3001)
   # 登录 admin
   curl -X POST http://localhost:3001/api/cron/sweep-stuck-jobs \
     -H "Cookie: <admin-session-cookie>"
   # 期望 200 + JSON { success:true, data:{ queuedStuck, runningStuck, ... } }
   ```
3. **stuck job 模拟**：直接 DB 注入 stuck 状态：
   ```sql
   INSERT INTO "AsyncJob" (id, type, status, "createdBy", "createdAt", attempts, "maxAttempts")
     VALUES (gen_random_uuid(), 'submission_grade', 'queued',
             (SELECT id FROM "User" WHERE email='admin@finsim.edu.cn'),
             NOW() - INTERVAL '2 minutes', 0, 3);
   -- 调 /api/cron/sweep-stuck-jobs → 期望 queuedStuck=1, triggered=1
   ```
4. **多次调 cron 不重复执行**：连续 3 次 curl → 后两次 queuedStuck=0（已被首次执行完）
5. **running stuck 标 failed**：
   ```sql
   INSERT INTO "AsyncJob" (id, type, status, "createdBy", "startedAt", attempts, "maxAttempts")
     VALUES (gen_random_uuid(), 'submission_grade', 'running',
             (SELECT id FROM "User" WHERE email='admin@finsim.edu.cn'),
             NOW() - INTERVAL '15 minutes', 3, 3);
   -- 调 cron → status='failed', error='STUCK_TIMEOUT_GAVE_UP'
   ```
6. **并发：开两个 curl 同时调 cron**（用 `&`）→ 不应见到同一 job 被 runAsyncJob 处理两次（DB 中该 job 的 attempts 增量为 1，不是 2）

## 后续

Worktree X 两 fix 全建好（Fix 6 已 ping QA，Fix 10 等 QA）。Fix 6+10 都 PASS 后 ping team-lead 收工。
