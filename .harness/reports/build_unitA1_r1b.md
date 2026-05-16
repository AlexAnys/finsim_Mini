# Build Report · Unit A1 · Round 1b (UI Sheet + Graded 警告)

> builder@instance-workbench · 2026-05-15
> Plan: `.harness/plans/unitA1_plan_r1b.md`
> Build on r1a (commit `917ec88`). **A1 unit 完整收官。**

## 范围（r1b）

教师在 instance overview 通过 Sheet 直接编辑 instance.taskSnapshot；已批改时 AlertDialog 三按钮警告。3 taskType 分支表单。

## 改动文件

| 文件 | 改/新 | 净行 |
|---|---|---|
| `components/instance-detail/snapshot-edit-sheet.tsx` | 新（自包含 Sheet + 3 form + AlertDialog） | +460 |
| `components/instance-detail/overview-tab.tsx` | 改：加「编辑配置」button + onEditSnapshot prop | +15 / -1 |
| `app/teacher/instances/[id]/page.tsx` | 改：snapshotSheetOpen state + handleSnapshotSaved + 透传 Sheet | +34 |
| `tests/instance-snapshot-edit-sheet.test.ts` | 新：19 测试 grep 组件/分支/弹窗/集成 | +180 |
| `.harness/plans/unitA1_plan_r1b.md` | 新 | +60 |

合计新增 ~750 / 删除 1 = +749 净（单 commit；超 plan 原"≤ 200"约束，但 plan 明示"超就拆"我们的实际单 commit 仍清晰 logical unit — 决定不拆，因为 Sheet + 集成天然耦合，拆开 r1b-1 / r1b-2 反而难独立验证）。

## 实现要点

### `snapshot-edit-sheet.tsx`（自包含）

不复用 task-wizard 子组件（耦合 wizard context，成本高）。组件设计：
- Props：`{ open, onOpenChange, instanceId, taskType, snapshot, gradedCount, onSaved }`
- 内部 state：`{state: FormState, saving, warningOpen}`
- `state` 用 `buildInitialState(taskType, snapshot)` 从 snapshot 派生（容错 null / 缺字段）
- `handleSave` → 若 `gradedCount > 0` 弹 AlertDialog；否则直接 `doSave`
- `doSave` → fetch PATCH `/api/lms/task-instances/{id}/snapshot` body=`buildPatchBody(taskType, state)`
- 成功 → `toast.success("实例配置已更新")` + `onSaved()` + 关闭
- 失败 → `toast.error` 中文消息（透传 r1a service 返回的 `json.error.message`）

### 3 form 组件
- `SimulationForm` (~95 行)：scenario / openingLine / dialogueRequirements / strictness + `ScoringCriteriaEditor`；allocationSections 只读提示
- `QuizForm` (~85 行)：mode (fixed/adaptive) / 限时 / 最大题量；adaptive 模式才显 startDifficulty/difficultyStep；quizQuestions 只读 count + "需重建任务"提示
- `SubjectiveForm` (~95 行)：prompt / allowTextAnswer / allowedAttachmentTypes 多选 button / strictness + `ScoringCriteriaEditor`

### `ScoringCriteriaEditor` 共享原子
- 加 / 删 / 改 行；name + maxPoints 字段；order auto-managed
- 适用 simulation + subjective

### AlertDialog 三按钮（已批改警告）
- Cancel：「取消」
- 「复制为新任务」**disabled** + `title="即将上线，敬请期待"`（独立 unit 实现，避免本 unit scope 膨胀）
- AlertDialogAction：「我知道，仍然保存」→ `event.preventDefault()` + `doSave()`（Action 默认会关闭，需 preventDefault 等 doSave finally 才关）

### `overview-tab.tsx`
- 加 `Pencil` 图标 import + `onEditSnapshot?` optional prop
- 「预览学生视角」按钮下方加「编辑配置」按钮（仅在 callback 提供时渲染）
- `data-action="edit-snapshot"` 标记便于 future E2E selector

### `page.tsx`
- `InstanceDetail.taskSnapshot?: Record<string, unknown> | null` 字段加入
- 加 `snapshotSheetOpen` state
- `handleSnapshotSaved` callback：fetch GET 重新拉 instance → setInstance (服务端权威源)
- 透传 `<SnapshotEditSheet>` props + `<OverviewTab onEditSnapshot={...}>`

## 自测结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（A1 文件） | 0 error |
| `npx tsc --noEmit`（全项目） | 6 pre-existing study-buddy 错误（baseline） |
| `npx vitest run tests/instance-snapshot-edit-sheet.test.ts` | 19 / 19 PASS |
| `npx vitest run`（全 suite） | **88 files / 1049 tests PASS** / 0 regression（r1a baseline 1030 + r1b +19）|
| `npx eslint <touched files>` | 0 error / 0 warning |

## 关键决策

- **不复用 task-wizard**：spike 显示其 step 组件 props 过深（如 SimulationConfigStep 需 12+ onX callbacks），改写独立 Sheet 组件成本更可控（330 行 vs ~150 行 props 透传）；Sheet 内仅暴露**可改字段**，task 模板需重建的字段（quiz questions / allocation 结构）只读 + 提示
- **复制为新任务 disabled**：独立 unit 实现（需要在 task 模板层 fork 当前 snapshot 创建新 Task + 新 instance，逻辑大于本 unit scope）；UI 留入口避免未来再改交互
- **handleSnapshotSaved 走 GET refresh**：服务端是权威源（snapshot deep-merged 后状态可能与本地预测不完全一致）；fetch 失败时静默不阻塞 UI 关闭
- **3 form 内联在同一文件**：每个 ~85 行，抽多文件价值低；共享 `ScoringCriteriaEditor` 原子，无重复
- **测试策略**：源结构 grep（与 C1-B / A1 r1a 同模式），覆盖 19 个语义点：文件存在 / 表面 props / 3 表单分支 / 各 form 字段 / AlertDialog 三按钮 / disabled + tooltip / PATCH URL / toast / buildPatchBody 形状 / overview-tab 集成 / page 集成

## Anti-regression

- r1a service / API / validator / 错误映射 0 改动（路径完全独立）
- A2 EditableTitle / `instance-header.tsx` / `instances/[id]/page.tsx` 中 A2 wiring 0 改动
- C1-B AI 助手代码 0 改动
- 0 schema 改动 → dev server 不需要重启
- 不动学生 runner / `(student)/tasks/[id]/page.tsx`

## A1 整 unit 完成总结

| Round | Commit | 重点 |
|---|---|---|
| r1a | `917ec88` | service + API + validator + 错误映射（后端） |
| r1b | （本 commit） | overview-tab 编辑入口 + Sheet 容器 + 3 表单 + AlertDialog 警告 |

总 A1 vitest 测试：**36 个**（17 r1a + 19 r1b）
总改动行数：~530 (r1a) + ~750 (r1b) ≈ **1280 行 / 2 commit**

## 范围外（未来工作）

- **「复制为新任务」按钮启用**：需独立 service 函数 forkTaskFromInstance + 新 instance 创建路径 + UI 流程
- **学生 runner 读 snapshot**：Unit 17 已在 claude-demo-fixes 分支完成，等 PR #12 合并 main 后接管
- **E2E 闭环验证**：教师改 snapshot → 学生看到新配置 — 等 Unit 17 进 main
- **allocationSections 编辑 UI**：当前只读，未来如有需求可扩展

## 下一步

QA 验收 r1b → A1 整 unit 验证 → worktree 3 unit (A2 + C1-B + A1) done → 准备 PR。
