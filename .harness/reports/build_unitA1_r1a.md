# Build Report · Unit A1 · Round 1a (service + API + validator)

> builder@instance-workbench · 2026-05-15
> Plan: `.harness/plans/unitA1_plan_r1a.md`
> Next: r1b — overview-tab Sheet UI（已批改 dialog 警告 + 三 taskType 表单分支）

## 范围（r1a only）

新增 `PATCH /api/lms/task-instances/{id}/snapshot` 端点 + 配套 service / validator / 错误映射 / 单测。**未做 UI**（推 r1b）。

## 改动文件

| 文件 | 改/新 | 净行 |
|---|---|---|
| `lib/validators/task.schema.ts` | 改 | +30 |
| `lib/services/task-instance.service.ts` | 改 | +83 |
| `lib/api-utils.ts` | 改 | +2 |
| `app/api/lms/task-instances/[id]/snapshot/route.ts` | 新 | +32 |
| `tests/instance-snapshot-update.test.ts` | 新 | +180 |
| `.harness/plans/unitA1_plan_r1a.md` | 新 | +65 |

总产线代码 +147 / 测试 +180 / 文档 +65。

## 实现要点

### `updateTaskInstanceSnapshotSchema`（validator）

三态 discriminated union by `taskType`：

```typescript
{ taskType: "simulation", simulationConfig?, scoringCriteria?, allocationSections? }
{ taskType: "quiz",       quizConfig?, quizQuestions?, scoringCriteria? }
{ taskType: "subjective", subjectiveConfig?, scoringCriteria? }
```

- `*Config` 用现有 schema 的 `.partial()` —— 允许 PATCH 部分字段
- `scoringCriteria` / `allocationSections` / `quizQuestions` 全量替换（这些字段语义上是数组替换而非单字段 patch）
- `taskType` 必填用于 dispatch

### `updateTaskInstanceSnapshot(instanceId, userId, patch)` service

1. 读 instance（select id/createdBy/courseId/taskType/taskSnapshot）
2. 不存在 → `INSTANCE_NOT_FOUND`
3. `isAuthorizedForInstance` 检查（createdBy 或 CourseTeacher）→ 失败 `FORBIDDEN`
4. `existing.taskType !== patch.taskType` → `TASK_TYPE_MISMATCH`（防跨类型篡改）
5. 按 taskType 分支 deep-merge：每个子配置先取 `currentSnapshot.xxxConfig` 再 spread patch（部分字段合并）；数组字段全量替换
6. **强制保留 `task.id / taskType / taskName`**：即便 patch 试图通过 schema 缝隙写入，service 层 explicit 覆盖回原值
7. `prisma.$transaction` 同时 update instance + count `Submission where status='graded'`
8. 返回 `{ instance, gradedCount }`

### `app/api/lms/task-instances/[id]/snapshot/route.ts`

- `requireRole(["teacher", "admin"])`
- `safeParse` Zod schema → `validationError` 中文消息
- 调 service，捕获错误统一 `handleServiceError`
- 与现有 `release-config/route.ts` 同模式

### `lib/api-utils.ts`

加 `TASK_TYPE_MISMATCH` → 400 中文消息 "任务类型不匹配，无法修改"

## 自测结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（A1 文件） | 0 error |
| `npx tsc --noEmit`（全项目） | 6 pre-existing study-buddy 错误（与本 unit 无关；A2 + C1-B 三轮报告已确认 baseline） |
| `npx vitest run tests/instance-snapshot-update.test.ts` | 17 / 17 PASS |
| `npx vitest run`（全 suite） | **87 files / 1030 tests PASS** / 0 regression（C1-B baseline 1013 + r1a +17）|
| `npx eslint <touched files>` | 0 error / 0 warning |

## 关键决策

- **discriminated union 而非 partial object**：强制客户端指定 taskType，避免「我以为是 simulation patch 但其实落到 quiz」的歧义；同时 service 用此字段守 instance.taskType
- **service 拒绝跨 taskType patch**：即便 schema 校验通过，service 层显式 check `existing.taskType !== patch.taskType`（双层防御）
- **守 task.id / taskType / taskName 不变**：写回 mergedSnapshot 前强制覆盖三个字段为 currentSnapshot 原值；防止 patch 通过子字段缝隙篡改
- **graded != 0 不阻止保存**：service 只统计、返回；阻拦决策放 UI 层 r1b（教师明确知道在做什么，已批改作业不应回滚但应警告）
- **scoringCriteria 全量替换**：业务上数组字段（题目顺序 / 评分维度）需保持顺序与索引一致性，partial 合并语义不清
- **测试策略**：node 环境 vitest 用 Zod schema 校验 + 源结构 grep（参考项目内同模式测试 `pr-sim-bug-fix-leak.test.ts`），避免 Prisma mock 开销

## Anti-regression

- 不动 `updateTaskInstance` / `updateTaskInstanceSchema`（A2 共享）
- 不动学生 runner / `(student)/tasks/[id]/page.tsx`（plan 明示 Unit 17 待 PR #12 合并 main 后接管）
- 不动 Prisma schema（taskSnapshot Json 字段已存在）
- A2 的 PATCH `/api/lms/task-instances/[id]` route 完全独立路径
- 0 schema 改动 → dev server 不需要重启

## 范围外（推 r1b）

- `components/instance-detail/overview-tab.tsx`：加「编辑配置」按钮 + Sheet 容器 + dialog 警告
- 按 taskType 渲染 3 分支表单（先 spike simulation 一型）
- 复用 task-wizard 子组件可行性 spike

## 下一步

QA 验收 r1a。然后开 r1b（UI）。
