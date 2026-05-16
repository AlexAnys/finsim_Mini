# Unit A1 · r1a · Mini Plan

> builder@instance-workbench · 2026-05-15
> Build r1a = service + API + validator + tests
> Next: r1b = UI Sheet（教师 overview 编辑入口）

## 目标（仅 r1a）

新增 PATCH `/api/lms/task-instances/{id}/snapshot` 端点，允许教师修改 instance 的 `taskSnapshot`（学生看到的配置）。**不动学生 runner**（Unit 17 改进将在 PR #12 之后接管）。

## 改动文件

| 文件 | 改/新 | 估行 |
|---|---|---|
| `lib/validators/task.schema.ts` | append `updateTaskInstanceSnapshotSchema` discriminated by taskType + `UpdateTaskInstanceSnapshotInput` 类型 | +50 |
| `lib/services/task-instance.service.ts` | append `updateTaskInstanceSnapshot(instanceId, userId, patch)` + auth check + count graded + deep-merge | +60 |
| `app/api/lms/task-instances/[id]/snapshot/route.ts` | 新 PATCH route | +35 |
| `tests/instance-snapshot-update.test.ts` | vitest ≥3：Zod schema 校验 / shape 守护 / graded count 路径覆盖（grep service 源） | +90 |

合计 ~235 行（按用户 200 行约束已超；service 部分若超可再拆 r1a-1 schema+service / r1a-2 route+tests，但 235 与 200 接近，先单 commit 试，超就拆）。

## 关键决策

1. **discriminated union by taskType**：input shape 三态各自 partial。`taskType` 必填用于 dispatch；不允许通过 patch 改 task.id / taskType / 创建时间等不变字段。
2. **service deep-merge**：从 DB 读 `taskSnapshot` JSON → 解 → 按 taskType 选择子字段合并（不破坏其他键，例如 simulationConfig 改部分字段不影响 scoringCriteria）→ 写回 JSON。
3. **守 task.id + taskType 不变**：service 内 explicit 拒绝 patch 这两字段（即使 schema 阻止了，service 也防御）。
4. **count graded**：service 返回 `{ instance, gradedCount }`；route handler 透传。前端 r1b 用它显示 warning。
5. **graded != 0 不阻止保存**：UI 层 r1b 做警告 dialog；service 只统计、不阻拦（教师明确知道在做什么）。
6. **TestStrategy**：node 环境 vitest 用 Zod schema 测试 + 源结构 grep（无 Prisma mock 复杂度），保持简洁。
7. **route auth**：`requireRole(["teacher", "admin"])`，与 `[id]/route.ts` PATCH 同模式。

## 输入 shape

```typescript
// updateTaskInstanceSnapshotSchema (discriminated)
{
  taskType: "simulation",
  simulationConfig?: Partial<SimulationConfig>,
  scoringCriteria?: ScoringCriterion[],     // 全量替换
  allocationSections?: AllocationSection[], // 全量替换
}
// or
{
  taskType: "quiz",
  quizConfig?: Partial<QuizConfig>,
  quizQuestions?: QuizQuestion[],           // 全量替换
  scoringCriteria?: ScoringCriterion[],
}
// or
{
  taskType: "subjective",
  subjectiveConfig?: Partial<SubjectiveConfig>,
  scoringCriteria?: ScoringCriterion[],
}
```

## 范围外（推 r1b）

- UI Sheet：overview-tab 编辑配置入口
- 已批改 warning dialog
- task-wizard 子组件复用 spike

## 测试计划

- vitest 新增 ≥3，全 suite 0 regression
- tsc / eslint clean
- 已知 6 个 pre-existing study-buddy 错误为 baseline

## Anti-regression

- 不动 `updateTaskInstance` / `updateTaskInstanceSchema`（与 A2 共享）
- 不动学生 runner / `(student)/tasks/[id]/page.tsx`
- 不动 Prisma schema（taskSnapshot Json 字段已存在）
- A2 的 PATCH `/api/lms/task-instances/[id]` 完全独立
