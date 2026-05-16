# QA Report — Codex-P1-r4 Round 1

> QA: qa · 2026-05-15 · Branch `claude-demo-fixes` @ 7ffff91
> Build report: `.harness/reports/build_codex_p1_r4_r1.md`
> Plan: `.harness/plans/codex_p1_r4_plan_r1.md`
> Bug: Codex r4 review 在 c8b3137 上识别 1 P1 (老师 SB over-match) + 1 P2 (TaskBuildDraft 发布非原子)

## Spec: 修 P1 SB over-match + P2 TaskBuildDraft 原子化发布

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | P1 删 task-level fallback OR clause；P2 prisma.$transaction + conditional update atomic |
| 2. tsc --noEmit | PASS | clean output |
| 3. vitest run | PASS | 96 files / 1094 tests passed (含 3 个适配新行为的 unit test) |
| 4. Browser (independent QA Playwright) | PASS | 10/10 QA case + 3/3 builder case = 13/13 PASS (P2-D 1 次 self-correction: 接受 code=NOT_FOUND 因 api-utils 把 TASK_BUILD_DRAFT_NOT_FOUND 映射为 notFound→NOT_FOUND) |
| 5. Cross-module regression | PASS | scope=pending/answered 仍工作 (QA-RG-A)；单 publish flow 仍 201 + draft flip (QA-RG-B + P2-B)；createPublishedTaskWithInstance wrapper 路径未触及 (无 draft 路径) |
| 6. Security (vertical access + concurrency) | PASS | (a) P1: cross-course free-form post 不 leak (QA-P1-D)；pre-Unit6 task-bound post 仍 visible 给 course owner (QA-P1-B)；free-form positive visible (QA-P1-C)；(b) P2: 3 并发 stress test 1 win 2 lose, DB 1 task+1 instance (QA-P2-A)；已 published / ready / fake-id 三种非法状态全拦 (QA-P2-B/C/D) |
| 7. Finsim-specific | PASS | 中文 error message "草稿尚未审核通过，请先在审核页批准 AI 原稿"；API 响应 {success, error.code, message}；服务端 Error("CODE") + handleServiceError 映射 |
| 8. Code patterns | PASS | tx-aware wrapper (createPublishedTaskWithInstanceInTransaction) 单一职责；conditional update 是 Postgres-native atomic 语义；无 drive-by refactor；route 内手工 enqueue tagger 路径加注释解释 |

## 独立证据链（QA 自建 10 case spec）

### P1: 老师 SB 管理页 over-match 修复

- **QA-P1-A**: task X 同时有 teacher1 (courseA) instance + teacher2 (courseB) instance；post 在 instance_A 上（`post.courseId=teacher1's courseA`）。
  - teacher2 GET → 0 leak（修前会因 task-level OR `task.taskInstances.some.courseId IN courseIds` 命中而看到）
  - teacher1 GET → 看到 post（positive coverage）
- **QA-P1-B (兼容性)**: pre-Unit 6 post `courseId IS NULL` + `taskInstanceId set` → teacher1 通过第 1 条 filter `taskInstance.courseId IN courseIds` 仍看到，未丢可见性
- **QA-P1-C (free-form positive)**: free-form post `taskInstanceId IS NULL` + `post.courseId=teacher1's courseA` → teacher1 通过第 2 条 filter `post.courseId IN courseIds` 看到
- **QA-P1-D (cross-course block)**: 同样 free-form post，teacher2 GET → 不见（OR clause 双 filter 都不命中）

### P2: TaskBuildDraft 原子化发布

- **QA-P2-A (3 并发 stress)**: 3 个 POST 同 draftId concurrent → statuses=`[201, 400, 400]`，2 个 loser code=`TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH`，DB 只 1 task + 1 instance，draft `status=published`
- **QA-P2-B (已 published 二次)**: 直 INSERT draft status='published' → publish 请求 → `code=TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH`, DB 不创任何 task
- **QA-P2-C (未 approve)**: draft status='ready' → publish 请求 → 同样 NOT_APPROVED_FOR_PUBLISH
- **QA-P2-D (fake draftId)**: 不存在的 UUID → `code=NOT_FOUND` (`getTaskBuildDraft` 在 route 内 pre-check 先 throw TASK_BUILD_DRAFT_NOT_FOUND → api-utils.notFound("任务草稿不存在") 映射)；DB 不创 task

### Regression

- **QA-RG-A**: SB 管理页 `?scope=pending` / `?scope=answered` 全部返回 post 都符合 status filter
- **QA-RG-B**: 单 publish 仍 201 + draft flip 成 published

### 关键 console 日志

```
QA-P1-A teacher2 sees total=4, leaked=false       (4 是已有真实 post，不含我们造的)
QA-P1-A teacher1 sees post visible=true
QA-P1-B pre-Unit6 (courseId=null) visible to teacher1? true
QA-P1-C free-form visible to course owner OK
QA-P1-D cross-course free-form blocked for teacher2 OK
QA-P2-A 3 concurrent statuses: [201, 400, 400]
QA-P2-A DB counts task/instance: 1 1
QA-P2-B 已 published draft 二次 publish 被拒: TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH
QA-P2-C ready (未 approve) 被拒: TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH
QA-P2-D fake draftId rejected: NOT_FOUND
QA-RG-A scope=pending returned 0 posts all status=pending
QA-RG-A scope=answered returned 6 posts all status=answered
```

### 测试套件 numerical evidence

```
tsc --noEmit: clean
vitest: 96 files / 1094 tests passed (含 task-build-draft-approve.test.ts 3 个适配新行为的 unit)
lint: 0 errors / 30 warnings (1 unused-var in QA temp spec, spec 已删)
e2e (builder spec): 3/3 PASS (~18s via playwright.codex-r4.config.ts)
e2e (QA independent spec): 10/10 PASS (~40s, real browser + real auth + DB inject/cleanup)
```

### DB cleanup verification

```
qa-r4 SB posts:       0 leftover
qa-r4 task instances: 0 leftover
qa-r4 tasks:          0 leftover
qa-r4 drafts:         0 leftover
```

每个 case `try/finally` 清理彻底，无残留。

## Issues found

无 blocking issue。两个 observation 值得记录：

### Note 1 — `TASK_BUILD_DRAFT_NOT_FOUND` 映射为 `code: NOT_FOUND`

`getTaskBuildDraft` (route line 53) 对 fake draftId throw `TASK_BUILD_DRAFT_NOT_FOUND`，api-utils.ts:99-100 映射为 `notFound("任务草稿不存在")` 即 `code: NOT_FOUND` (per `notFound()` helper line 26-28)。这是历史 `notFound` helper 的设计选择，与本 PR 无关。QA-P2-D 已适配。

**潜在改进 (非阻塞)**: 把 `TASK_BUILD_DRAFT_NOT_FOUND` 改为 `error("TASK_BUILD_DRAFT_NOT_FOUND", "任务草稿不存在", 404)` 保留具体 code，前端可分支处理。但当前 NOT_FOUND + 中文 message 已足够清晰，不影响安全性。留 follow-up。

### Note 2 — analytics route 同款 over-match pattern

`app/api/lms/study-buddy/analytics/route.ts:33` 仍有 `{ task: { taskInstances: { some: { courseId } } } }` over-match。builder 报告 line 105 已记录。**安全性影响小**：该 route `assertCourseAccess(courseId)` 先锁单 courseId，teacher 必须先有该 courseId 权限；over-match 只会把"task 复用到该 courseId 的别 instance 上的 post"也拉进来，但 teacher 已对该 courseId 有访问权。但仍是 leak —— 学生在 courseB 提的 post 出现在 courseA 的 analytics 里，对教学决策有干扰。**建议 follow-up PR 修**，但不阻塞本次。

### Note 3 — QA self-correction (小)

QA-P2-D 初版只接受 `TASK_BUILD_DRAFT_NOT_FOUND` 和 `TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH`，没考虑 api-utils 把前者映射为 `NOT_FOUND`。已修。

## Overall: PASS

P1 over-match 完整修复（cross-course block + pre-Unit 6/free-form 兼容性）；P2 原子化 publish 经 3 并发 stress + 已 published/ready/fake 三种非法状态全 13 case 真浏览器 PASS。DB cleanup deterministic。
