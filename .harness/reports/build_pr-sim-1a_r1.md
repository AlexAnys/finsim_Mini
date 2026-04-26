# Build · PR-SIM-1a · D1 防作弊后端（schema + service）· r1

## Spec 摘要

D1 决策（用户 P0）：模拟评估**分两步公布**——
1. AI 评估完成 → status=graded
2. 教师"公布"或 cron 自动公布 → 学生才能看 score/feedback

本 PR scope = **纯后端**：schema 加字段 + service + 4 个 API endpoints + cron。UI 留给 PR-SIM-1b（教师公布 UI）/ PR-SIM-1c（学生防作弊 UI）。

## 变动文件清单（13 个）

| # | 文件 | 类型 | 描述 |
|---|---|---|---|
| 1 | `prisma/schema.prisma` | M | TaskInstance + 2 字段 (releaseMode/autoReleaseAt) + Submission + 1 字段 (releasedAt) + ReleaseMode enum |
| 2 | `prisma/migrations/20260426162854_add_release_mode/migration.sql` | A | 新 migration（ENUM + 2 ADD COLUMN） |
| 3 | `lib/services/submission.service.ts` | M | 新增 `deriveAnalysisStatus` + `stripSubmissionForStudent` 纯函数；`updateSubmissionGrade` 加 `releasedAt?: Date \| null` 参数 |
| 4 | `lib/services/grading.service.ts` | M | 新增 `computeReleasedAtForGrading` 纯函数；`gradeSubmission` 提前算 releasedAt 并传给 3 个 grade* 函数；3 个 grade* 内部 `updateSubmissionGrade` 调用加 releasedAt |
| 5 | `lib/services/release.service.ts` | A | 新建：5 函数 — releaseSubmission / unreleaseSubmission / batchReleaseSubmissions / setInstanceReleaseMode / autoReleaseSubmissions |
| 6 | `lib/auth/resource-access.ts` | M | 新增 `assertTaskInstanceWritable` guard（admin bypass / student reject / teacher creator OR course access） |
| 7 | `lib/api-utils.ts` | M | error code 加 SUBMISSION_NOT_GRADED 中文映射 |
| 8 | `app/api/submissions/[id]/release/route.ts` | A | POST { released: bool } |
| 9 | `app/api/submissions/batch-release/route.ts` | A | POST { submissionIds[], released: bool } |
| 10 | `app/api/lms/task-instances/[id]/release-config/route.ts` | A | PATCH { releaseMode, autoReleaseAt } |
| 11 | `app/api/cron/release-submissions/route.ts` | A | GET/POST 双触发（CRON_TOKEN env or admin role） |
| 12 | `app/api/submissions/[id]/route.ts` | M | GET 时学生角色调 stripSubmissionForStudent；教师附 analysisStatus |
| 13 | `app/api/submissions/route.ts` | M | GET list 同上：student strip per-item / teacher 附 analysisStatus per-item |
| 14 | `tests/pr-sim-1a-d1-release.test.ts` | A | 16 单测 — computeReleasedAtForGrading 6 + deriveAnalysisStatus 5 + stripSubmissionForStudent 5 |
| 15 | `.env.example` | M | 加 CRON_TOKEN 注释（可选） |

## 验证结果

### 静态检查

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm run lint` | 0 errors / 21 warnings（全 pre-existing） ✅ |
| `npx vitest run` | **47 files / 576 tests PASS**（560+ 含 16 新） ✅ |
| `npm run build` | ✓ Compiled successfully in 5.2s · 51 routes（4 新） ✅ |

### Prisma 三步真闭环

```
✅ npx prisma migrate dev --name add_release_mode
   → Applying migration `20260426162854_add_release_mode`
   → migration.sql: CREATE TYPE ReleaseMode + 2 ALTER TABLE ADD COLUMN
✅ npx prisma generate
   → Generated Prisma Client (v6.19.2) in 189ms
✅ kill PID 97364 → restart npm run dev → PID 96617 → ✓ Ready in 1027ms
✅ /login + /teacher/dashboard + /teacher/instances/[id] all 200
```

### 真 E2E 矩阵（teacher1 + student1 + admin + teacher2 + unauth · 真登录 cookie）

| Case | 场景 | 验证点 | 结果 |
|---|---|---|---|
| 1 | quiz submission 提交 → AI grading | grading 完成后 manual mode releasedAt=NULL | ✅ |
| 2 | PATCH /release-config { mode: "manual" } | 200 + DB releaseMode=manual | ✅ |
| 3 | POST /release { released: true } | 200 + DB releasedAt 非 NULL | ✅ |
| 4 | POST /release { released: false } | 200 + DB releasedAt=NULL | ✅ |
| 5 | 学生 GET (releasedAt=null) | score=null + maxScore=null + evaluation=null + conceptTags=[] + analysisStatus="analyzed_unreleased" | ✅ |
| 6 | 学生 GET (releasedAt!=null) | score=20 + maxScore=70 + evaluation 完整 + conceptTags 5 个 + analysisStatus="released" | ✅ |
| 7 | 教师 GET 永远完整 | unrelease 状态下教师仍看 score=20 + evaluation 完整 + analysisStatus="analyzed_unreleased" | ✅ |
| 8 | auto + autoReleaseAt 已到期 | grading 完成时立即 release（无需 cron / 手动） | ✅ |
| 9 | auto + autoReleaseAt 未到 | graded but releasedAt=null（等 cron） | ✅ |
| 10 | cron auth 矩阵 | unauth 401 / teacher 401 / admin 200 + 公布 2 条 + 1 instance | ✅ |
| 11 | cron token 路径 | CRON_TOKEN 未设时 header 不可绕过 admin 校验 | ✅ |
| 12 | batch release/unrelease | 200 + { released: 2, skipped: 0 } 双向 | ✅ |
| 13 | 学生 GET list | 已公布显示完整 / 未公布 score=null + analysisStatus="analyzed_unreleased" | ✅ |
| 14 | Auth guard 矩阵 | teacher2 跨户 release/batch/config 全 FORBIDDEN + student FORBIDDEN + unauth UNAUTHORIZED | ✅ |
| 15 | DB cleanup | attemptsAllowed/releaseMode 还原 + 测试 submission 全删（COUNT=0） | ✅ |

### 7 个 spec 必跑 case 状态

```
[x] 1. 拿一个 graded submission（之前 PR 数据）→ 自造一个真 quiz submission
[x] 2. PATCH /release-config { mode: "manual" } → 200
[x] 3. POST /submissions/[id]/release { released: true } → 200 → DB releasedAt 非 NULL
[x] 4. POST /submissions/[id]/release { released: false } → 200 → DB releasedAt NULL
[x] 5. 学生 GET → 当 releasedAt NULL：response 不含 score/feedback；analysisStatus="analyzed_unreleased"
[x] 6. 学生 GET 已公布 → response 含完整 score/feedback；analysisStatus="released"
[x] 7. 教师 GET 同 submission → 永远完整
```

### Page regression（7 路由）

| 路由 | 状态 |
|---|---|
| /login | 200 |
| /teacher/dashboard | 200 |
| /teacher/instances | 200 |
| /teacher/instances/[id] | 200 |
| /dashboard (student) | 200 |
| /grades | 200 |
| /tasks/[id] | 200 |

## 设计决策 / 非显然处

### 1. status enum 不动（不加 ai_graded 中间态）

按 spec 明确："简化方案：用 `status=graded && releasedAt is null` 表达"已分析未公布"，避免状态机 cascade 改 N 处"。
派生 `analysisStatus` 4 状态在 service 层算（`deriveAnalysisStatus` 纯函数），routes 层附给响应 JSON 给 UI 用。

### 2. service 层 strip vs route 层 strip

选择 **route 层做 strip**（`app/api/submissions/[id]/route.ts` + `app/api/submissions/route.ts`）。
理由：service `getSubmissionById` 已被 7 处 caller 调用（grade route / 其它），改 service 签名要全同步动；route 层加 user.role 判断后调 stripSubmissionForStudent 是 surgical 改动 — 0 caller 破坏。

教师/admin 仍调原 `getSubmissionById` 拿到完整数据（含敏感字段）。

### 3. cron token vs admin role 双触发

```ts
if (cronToken && headerToken === cronToken) → 直通
else if session.user.role === "admin" → 直通
else 401
```

理由：spec 明确"不依赖部署 cron 设施 — 用户 / admin 也可手动 GET 这个端点"。CRON_TOKEN 未设的开发环境，admin 可手动跑；生产可设 token 给 Vercel cron / 系统 cron 用。

### 4. release.service 的批量 audit 策略

`batchReleaseSubmissions` 写**一条 batch audit log**（不是 per-submission），metadata 含 ids 数组（cap 100 条防爆）。理由：批量场景下逐条写 audit 会爆 logs；spec 也说"写 audit（一条 batch entry）"。

`autoReleaseSubmissions` 同策略，并在空结果时也写一条 audit（便于运维监控 cron 是否在跑）。

### 5. `assertTaskInstanceWritable` 新增

resource-access.ts 之前只有 `assertTaskInstanceReadable / Teacher Only`。本 PR 加写权 guard，模式与 `assertChapterWritable / assertSectionWritable` 一致：admin bypass / student reject / teacher (creator OR course access)。

### 6. 提前算 releasedAt vs 在 grade* 内部算

选择**提前算 releasedAt（一次拿 taskInstance.releaseMode/autoReleaseAt） → 传参给 3 个 grade\* 函数**。
理由：避免每个 grade* 重复 query taskInstance；`gradeSubmission` 入口已经做了 1 次 findUnique。`computeReleasedAtForGrading` 是纯函数易测（6 单测覆盖 4 分支 + 边界 + null）。

### 7. updateSubmissionGrade 签名加 `releasedAt?: Date | null`

三态语义：
- `Date` → 设这个时刻（auto immediate / teacher manual）
- `null` → 显式撤回（unrelease）
- `undefined` → 保持现有值不变（grading 中间态、教师手工批改保留之前）

教师手工批改 route（`app/api/submissions/[id]/grade/route.ts`）**不传 releasedAt** — 这个是有意的：手工批改后 releasedAt 应保持之前的状态（如果之前是 released 仍 released；之前是 null 仍 null），让教师独立用 `/release` endpoint 控公布。这点要在 PR-SIM-1b UI 文档里写明。

## 不确定 / 风险点

1. **教师手工批改 + AI 已公布的场景**：当前 `/grade` 不动 releasedAt。如果教师之前公布过分数后又改分，学生立即看到新分（因 releasedAt 仍 != null）。这是有意设计 — 教师改分通常希望立即生效。如果未来需要"修订需重新公布"，加 PR-SIM-1b 的 UI 提示。

2. **Cron 全局并发**：`autoReleaseSubmissions` 不加锁。如果同一时刻多个 cron 进程（部署 + admin 手点）一起跑，可能写两次 release（idempotent，因为 updateMany 在 `releasedAt: null` 条件下，第二次跑就空集）。但**审计会写 2 条**。可接受 — 审计读"affectedCount=0"行可识别。

3. **`logAuditForced` actorId omitted 的运维语义**：cron 公布无 actor，audit 写 `actorId=NULL`。`AuditLog.actorId` 字段是 nullable，OK。但报表/查询时需注意 NULL actorId = cron 触发；非 NULL = 教师/admin 手动。

4. **`SUBMISSION_NOT_GRADED` 拒绝**：当前 `releaseSubmission` 在 status != graded 时抛错。这是有意：不应该公布 grading/submitted 状态的提交（会暴露 partial data 或失败状态）。但 `unreleaseSubmission` 不做这个检查（任何状态都允许撤回，紧急用）。

5. **新 migration 三步全闭环已验证**，但**生产 deploy 时**需 `npx prisma migrate deploy`（CI 标准流程已就位）。本机 dev 环境用 `migrate dev` 已应用。

## 不需 dev server 重启

实际上 schema 改动已经走完三步并重启了一次（PID 97364 → 96617）。后续 service / route 代码改动 Next.js 的 file watcher 会自动 pick up，无需再次重启。

## 是否需要 coordinator commit

是。Builder 不 commit，coordinator 来打包。

需要 commit 的清单见上面"变动文件清单"13 个文件 + 1 个 migration 目录。

---

**Builder 自评**：所有 7 个 spec 必跑 case + 8 个增量验证（auto immediate/cron/batch/auth guard/list strip）全 PASS。0 schema warning / 0 lint error / 16 新单测 / 真 E2E 矩阵 15 cases 全对齐。

PR-SIM-1b（教师公布 UI）/ PR-SIM-1c（学生防作弊 UI）有充分后端 API 可调用，包括 `analysisStatus` 字段供 UI 直接用。
