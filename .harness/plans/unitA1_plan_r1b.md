# Unit A1 · r1b · Mini Plan

> builder@instance-workbench · 2026-05-15
> Build on r1a (commit `917ec88`). **Final A1 commit。**

## 目标（r1b）

教师在 `/teacher/instances/[id]` overview tab 看到「编辑配置」按钮，点击打开右侧 Sheet，按 instance.taskType 渲染 3 分支表单，保存调 r1a 的 PATCH `/api/lms/task-instances/[id]/snapshot`。已批改 sub 时 AlertDialog 三按钮警告。

## 改动文件

| 文件 | 改/新 | 估行 |
|---|---|---|
| `components/instance-detail/snapshot-edit-sheet.tsx` | 新（自包含 Sheet + 3 form 分支 + AlertDialog） | +330 |
| `components/instance-detail/overview-tab.tsx` | 改：加「编辑配置」按钮 + Sheet integration + onSnapshotSave prop | +30 |
| `app/teacher/instances/[id]/page.tsx` | 改：handleSnapshotSave callback + 透传 + refresh after save | +35 |
| `tests/instance-snapshot-edit-sheet.test.ts` | 新：源结构 grep（Sheet/AlertDialog 存在；3 taskType 分支；3 button labels；toast） | +90 |

合计 ~485 行（超 200，**拆 2 commit**：r1b-1 sheet 组件 + tests，r1b-2 overview 接 + page wire）。
- **但 plan 用户说"超出再拆 r1b-1 / r1b-2"，先单 commit 尝试，超就拆**。
- **决定**：保守拆为 2 sub-commit。

### r1b-1（本提交）~360 行
- `components/instance-detail/snapshot-edit-sheet.tsx`（新 ~330）
- `tests/instance-snapshot-edit-sheet.test.ts`（新 ~90）

### r1b-2（下一提交）~65 行
- `components/instance-detail/overview-tab.tsx` 改（+30）
- `app/teacher/instances/[id]/page.tsx` 改（+35）

## 关键决策

1. **自包含组件 `SnapshotEditSheet`**：不复用 task-wizard 子组件（耦合 wizard context；spike 后判断成本高）。组件签名：
   ```typescript
   interface Props {
     open: boolean;
     onOpenChange: (open: boolean) => void;
     instanceId: string;
     taskType: "simulation" | "quiz" | "subjective";
     snapshot: Record<string, unknown>;  // 来自 instance.taskSnapshot
     gradedCount: number;
     onSaved: () => void;  // 调 router.refresh 或 setInstance
   }
   ```
2. **3 分支表单字段（仅修改可改字段，task 模板不变）**：
   - **simulation**：simulationConfig.scenario / openingLine / dialogueRequirements / strictnessLevel；scoringCriteria 行编辑（+/- 加删行）；allocationSections 简化为只读列表（编辑过于复杂，r1b 仅显示，未来扩展）
   - **quiz**：quizConfig.mode (fixed/adaptive) / timeLimitMinutes / maxQuestions / startDifficulty / difficultyStep；quizQuestions 行列表只读 + count
   - **subjective**：subjectiveConfig.prompt / allowTextAnswer / allowedAttachmentTypes (多选) / strictnessLevel；scoringCriteria 行编辑
3. **保存流程**：
   - `gradedCount > 0` → 先弹 AlertDialog 三按钮（取消 / 我知道，仍然保存 / 复制为新任务）
   - 「复制为新任务」按钮：**r1b 灰显 + tooltip「即将上线，敬请期待」**（避免引入大 scope；plan 也说复用 Unit 4 模式，但项目内无 forcePatch 模式，需要做独立设计 → 单独 unit 处理）
   - 「我知道，仍然保存」→ 直接 PATCH
   - `gradedCount === 0` → 直接 PATCH（无 dialog）
4. **PATCH 错误处理**：toast 400 / 403 / 404 中文消息（route 已返回 i18n message via handleServiceError）
5. **保存成功**：toast「实例配置已更新」+ 关闭 Sheet + parent `onSaved` 触发 `setInstance` 状态更新（同 A2 乐观更新模式）
6. **任务说明 input**（description）：**不在 r1b 范围**（A2 已能改 title via PATCH `[id]/route.ts`，description 编辑由 A2 的 updateTaskInstanceSchema 也覆盖但未做 UI；现 r1b 专注 snapshot，不混入 description 编辑）

## 测试计划

- Sheet 组件存在 + 3 taskType 分支 + AlertDialog 三按钮（grep）
- 「复制为新任务」按钮存在但 disabled + tooltip
- PATCH endpoint URL 正确（grep `/snapshot`）
- toast 中文消息（grep）

## Anti-regression

- r1a 的 service / API / validator / 错误映射 0 改动
- A2 的 EditableTitle 不受影响（同文件 instance-header.tsx 不动）
- 0 schema 改动
- 不动学生 runner / `(student)/tasks/[id]/page.tsx`

## 风险

- AllocationSections / QuizQuestions / ScoringCriteria 编辑 UI 较复杂 → r1b 内 scoringCriteria 行编辑（最常用），allocation/quiz 列表只读 + count + 「需重建任务」提示
- 自包含组件 ~330 行 → 用 helper 函数拆分（renderSimulationForm / renderQuizForm / renderSubjectiveForm）保持每函数 ~80 行
