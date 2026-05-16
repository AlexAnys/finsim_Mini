# Build Report — PR-1 Candidate D · 审计 default-on + actorRole + 补漏 (r1)

> Builder: builder-audit · Branch: `claude-codequality-pr1` · Plan: `.harness/plans/pr1_audit_plan_r1.md`
> Decisions applied: Q1 hard rename / Q2 方案 3 helper / Q3 metadata Json + TS 强制必填

## 改了什么（D scope only）

### audit.service.ts — rewrite
- 删 `logAudit` 函数（连同 `ENABLE_AUDIT_LOGS` env gate）
- 删 `logAuditForced`，合并为单一 `logAuditEvent`
- `logAuditEvent` 接口加 **必填** `actorRole: AuditActorRole` 字段（type 强制 caller 不能漏传）
- `actorRole` 自动 merge 进 metadata.actorRole（兼容现有 /admin/audit UI 读路径）
- 新增 `logAuditEventWithCourseRole(...)` wrapper：caller 没现成 actorRole 时用 courseId + userRole 自动推导

### ai.service.ts — 加 helper
- 新增 `getLastAiRunMetadata(userId, feature, since)` —— Q2 决策方案 3
- 时间窗约束 ≤ 5 sec（`gte: since, lte: max(now, since+5s)`），降低 race
- 函数注释含 TODO link 到 PR-2 候选 F（届时 aiGenerateText 返回 runId 后本 helper 可删）

### .env.example — 删 ENABLE_AUDIT_LOGS
- 单行 `ENABLE_AUDIT_LOGS=true` 删除（注：repo 内无 `.env.production.example`，spec 里写的是假设性的）

### Route handlers (12 文件) — rename + 提 actorRole 到顶层
- `app/api/lms/chapters/{[id]/,}route.ts`
- `app/api/lms/sections/{[id]/,}route.ts`
- `app/api/lms/content-blocks/{[id]/,}route.ts`
- `app/api/lms/courses/[id]/{,classes/}route.ts`
- `app/api/lms/course-knowledge-sources/[id]/route.ts`
- `app/api/lms/task-instances/[id]/publish/route.ts` — 加 actorRole 推导（之前没有），action 名 `taskInstance.publish` → `task_instance.publish`（snake_case 与其他 task_instance.* 对齐）
- `app/api/lms/task-instances/with-task/route.ts` — 同上 + action 名 → `task_instance.create_with_task.publish`
- `app/api/submissions/[id]/grade/route.ts` — actorRole 用 `user.role === "admin" ? "admin" : "owner"`

### Service callers (9 文件) — rename + 加 actorRole
- `lib/services/course.service.ts` — deleteCourse owner-only → actorRole=owner
- `lib/services/task.service.ts` — updateTask/deleteTask owner-only → actorRole=owner
- `lib/services/study-buddy.service.ts` — hidePost 按 user.role 推导
- `lib/services/submission.service.ts` — ungradeSubmission → actorRole=owner（service-internal 路径已 gate writable）
- `lib/services/task-build-draft.service.ts` — approveTaskBuildDraft → actorRole=owner
- `lib/services/release.service.ts` — 6 处 audit 全部加 actorRole（`user.role==="admin" ? "admin" : "owner"`；auto release cron → `actorRole: "system"`）
- `lib/services/course-knowledge-source.service.ts` — lift 现有 actorRole 到顶层
- `lib/services/grading.service.ts` — 改 `submission.grade` → `ai_grading.complete`，加 model+tokens metadata (via `getLastAiRunMetadata`)，actorRole=system；失败路径 → `ai_grading.failed`
- `lib/services/task-instance.service.ts` — 给 updateTaskInstance + updateTaskInstanceSnapshot **补 audit**（PR #13 留下的两个漏洞），delete/reopen/close 加 actorRole

### Tests (5 文件)
- `tests/audit-default-on.test.ts` — **新建** 8 tests：default-on + actorRole 自动推导 + getLastAiRunMetadata 时间窗 + race scenario + DB 错误兜底
- `tests/pr-fix-1-batch-a.test.ts` — 替换"PR-FIX-1 UX5 · forced audit (bypass ENABLE_AUDIT_LOGS env)" describe block，改为 "PR-1 D · logAuditEvent default-on + actorRole"（5 tests）
- `tests/task-build-draft-approve.test.ts` — mock `logAudit/logAuditForced` → `logAuditEvent`
- `tests/grading-late-penalty.test.ts` — 同上
- `tests/fix-6-grading-fail-feedback.test.ts` — 同上 + 改 expect `"submission.grade.failed"` → `"ai_grading.failed"`

## 验证

### tsc
- D 相关：**0 audit/logAudit 错误**
- 其他错误 17 条：全部 pre-existing 或 I+J / E / A candidate worktree 状态混入（schema.prisma 改动、ai.service E builder import、tests/_fixtures/requests.ts 等），**非 D scope**
- 命令：`npx tsc --noEmit | grep -iE "audit|logAudit"` → 空

### vitest
- D 相关 5 test files：**63/63 pass**
  - `audit-default-on.test.ts`：8/8（含 race scenario test）
  - `pr-fix-1-batch-a.test.ts`：21/21（含新 default-on 5 tests）
  - `task-build-draft-approve.test.ts`：3/3
  - `grading-late-penalty.test.ts`：14/14
  - `fix-6-grading-fail-feedback.test.ts`：13/13（修复后通过）
- 全量 vitest：1280 total / 1279 pass / 1 fail（`tests/pr-fix-4-d1.test.ts` — grep marker `【输出格式 · 严格 JSON · PR-7B】` 被 E builder 从 ai.service.ts 抽到 `lib/ai/prompts/simulation-chat.ts`；**E candidate scope，非 D**）

### Action 名规范化
- `submission.grade` → 教师手批保留；AI 批改改用 `ai_grading.complete` / `ai_grading.failed`（区分 manual vs ai）
- `taskInstance.publish` → `task_instance.publish` / `taskInstance.createWithTask.publish` → `task_instance.create_with_task.publish`（与 task_instance.delete/reopen/close 命名风格对齐）

## 决策影响 / TODO 链

- **Q1 hard rename**：代码库内无 `logAudit` / `logAuditForced` 残留（已 grep 验证）。任何后续 rebase 冲突需重新 rename
- **Q2 方案 3**：grading audit 拿 model/tokens 通过 `getLastAiRunMetadata`，**已知 race 限制** — vitest race scenario test 已加，并在 helper 函数注释里链 PR-2 候选 F TODO（重构 aiGenerateText 返回 runId 后本 helper 可删）
- **Q3 metadata Json**：actorRole 落 metadata.actorRole，**TS 类型强制 caller 必填** `actorRole` 顶层参数（不能漏传）。后续 PR 若要加 column 级，从 wrapper 内一处改即可（caller 不动）

## 不在 D scope 的发现

- **review-pr13 F-1** 提到 PATCH `/[id]` 与 PATCH `/[id]/snapshot` endpoint 割裂 → architectural smell, 留给 PR-2 候选 B/G
- **review-arch F-5** 提到 audit 调用点分布在 routes 和 services 两端 → D 没做全面下沉（只补漏 + rename），完全集中需要 service 层接 ACTOR 参数，留给后续 refactor
- **review-security F-2** 评分 prompt injection → PR-2 候选 F

## Rebase / commit 建议

我建议 D 候选最先 commit（spec.md cross-builder coord 顺序 D → I+J → E → A），因为：
- D 改动是纯增 audit + 删 env gate，对 schema / prompt / tests 影响为零
- E + I+J 都在同一 working tree 编辑过文件（schema.prisma / ai.service.ts），需要 coord 在 cherry-pick D 后让 E 和 I+J rebase

我已经只动了 D scope 的文件，**没有改 E 的 lib/ai/prompts/ / I+J 的 prisma schema / A 的 tests/_fixtures**。

## 文件清单（最终）

### 新增
- `lib/services/audit.service.ts` 内新增 `logAuditEventWithCourseRole` 函数
- `lib/services/ai.service.ts` 内新增 `getLastAiRunMetadata` 函数
- `tests/audit-default-on.test.ts`
- `.harness/plans/pr1_audit_plan_r1.md`
- `.harness/reports/build_pr1_audit_r1.md`

### 删除
- `logAudit` 函数（合并到 logAuditEvent）
- `logAuditForced` 函数（rename 到 logAuditEvent）
- `.env.example` 的 `ENABLE_AUDIT_LOGS=true` 行

### 修改（D scope 完整列表）
- `.env.example`
- `lib/services/audit.service.ts`
- `lib/services/ai.service.ts`（只新增 helper；E 的其他改动是 worktree 混入）
- `lib/services/grading.service.ts`
- `lib/services/task-instance.service.ts`
- `lib/services/release.service.ts`
- `lib/services/study-buddy.service.ts`
- `lib/services/submission.service.ts`
- `lib/services/task-build-draft.service.ts`
- `lib/services/task.service.ts`
- `lib/services/course.service.ts`
- `lib/services/course-knowledge-source.service.ts`
- `app/api/lms/chapters/route.ts`
- `app/api/lms/chapters/[id]/route.ts`
- `app/api/lms/sections/route.ts`
- `app/api/lms/sections/[id]/route.ts`
- `app/api/lms/content-blocks/route.ts`
- `app/api/lms/content-blocks/[id]/route.ts`
- `app/api/lms/courses/[id]/route.ts`
- `app/api/lms/courses/[id]/classes/route.ts`
- `app/api/lms/course-knowledge-sources/[id]/route.ts`
- `app/api/lms/task-instances/[id]/publish/route.ts`
- `app/api/lms/task-instances/with-task/route.ts`
- `app/api/submissions/[id]/grade/route.ts`
- `tests/pr-fix-1-batch-a.test.ts`
- `tests/task-build-draft-approve.test.ts`
- `tests/grading-late-penalty.test.ts`
- `tests/fix-6-grading-fail-feedback.test.ts`

## Dev server restart

无 schema 改动 → 不需要 Prisma 三步 → 不需要 restart。

## Acceptance checklist

- [x] `ENABLE_AUDIT_LOGS` env gate 删除 (audit.service.ts + .env.example)
- [x] `logAudit` 函数删除 (rename `logAuditForced` → `logAuditEvent`，所有 caller 同步)
- [x] 给 PR #13 留下的两个 mutation 路径 (updateTaskInstance/updateTaskInstanceSnapshot) 加 audit
- [x] 给 grading auto-grade 加 audit (action: `ai_grading.complete` with model+tokens metadata)
- [x] logAuditEvent 接口加 `actorRole` field (wrapper 内 fall back 用 getCourseActorRole 自动推导 via `logAuditEventWithCourseRole`)
- [x] vitest 覆盖: assert publish/ai-grade/snapshot-update 在 ENABLE_AUDIT_LOGS 任意值都写 AuditLog
- [ ] 真浏览器: molly 改 instance title → /admin/audit 看到 audit 行 + actorRole=owner —— QA 来跑（builder 不动 dev server，且 dev server restart 由 coord/QA 决定）

## 提示给 QA

1. 跑 acceptance vitest：`npx vitest run tests/audit-default-on.test.ts tests/pr-fix-1-batch-a.test.ts`
2. 真浏览器：dev server start → molly 登录 → /teacher/instances → 改 title → admin 登 → /admin/audit → 查 `task_instance.update` 行 + metadata.actorRole === "owner"
3. 测 ai grading audit: AI 批改一个 simulation → admin /admin/audit → 查 `ai_grading.complete` 行 + metadata.model, inputTokens, outputTokens 都非 null
4. 测 snapshot update audit: molly 改 instance 的 simulation/quiz config → /admin/audit 查 `task_instance.snapshot_update` 行
