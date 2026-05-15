# Unit C1-B · r1b · Mini Plan

> builder@instance-workbench · 2026-05-15
> Build on r1a (commit `918a5d7`). Next: r1c (阅读视图 + 编辑切换)

## 目标（仅 r1b）

按 activeTool 分支渲染结果区域。schema 不变（free-form `sections` + 可选 `gradingTable` + `actionItems` + `cautions` + `fileReports`）。

| 工具 | 布局重点 | gradingTable |
|---|---|---|
| `lessonPolish` | 当前默认布局（sections + 总评 + 文件识别 + actionItems + cautions） | 数据非空时显示 |
| `ideologyMining` | 顶部育人目标 callout（取 actionItems 当育人目标）+ sections（案例表达 highlight）+ cautions | **始终隐藏** |
| `questionAnalysis` | sections 视作"题型/知识点/解题步骤/易错点"结构化（label 替换）+ cautions | **始终隐藏** |
| `examCheck` | **gradingTable 置顶** + 总评简要 + sections 收起折叠（默认折起，按需展开）+ actionItems + cautions | 顶部置顶显示 |

## 改动文件

| 文件 | 改/新 | 估行 |
|---|---|---|
| `components/ai-assistant/lesson-polish-result.tsx` | 新 | +110 |
| `components/ai-assistant/ideology-mining-result.tsx` | 新 | +100 |
| `components/ai-assistant/question-analysis-result.tsx` | 新 | +100 |
| `components/ai-assistant/exam-check-result.tsx` | 新 | +120 |
| `app/teacher/ai-assistant/page.tsx` | 改：移走 result 区域 ~130 行 → 替换为 toolKey switch render | +30 / -130 |
| `tests/ai-assistant-result-views.test.ts` | 新：源结构 grep + linesFromText 行为 | +90 |

合计 ~420 行新 / -130 = +290 净。

## 关键决策

1. **不抽通用 ResultView 基类**：4 工具差异化太大，公共抽象会反而绕。共享渲染原子（FileReportsList / SectionEditor / GradingTable / ListTextarea）由各 result 组件**内联**或在 page.tsx 内 export 给 4 个组件复用。
2. **共享原子工厂**：page.tsx 内向各组件传入 `{ result, patchResult, patchSection }`，全部组件签名一致：
   ```tsx
   interface ToolResultProps {
     result: AiResult;
     patchResult: (patch: Partial<AiResult>) => void;
     patchSection: (i: number, patch: Partial<AiResult["sections"][number]>) => void;
   }
   ```
3. **`ideologyMining` 育人目标 callout**：用 `actionItems[]` 当 "育人目标"（label 改名为「育人目标」），不动 schema。
4. **`questionAnalysis` 结构化**：sections 4 字段（heading/diagnosis/suggestions/examples）label 改为"题型/知识点/解题步骤/易错点"，**hint 文案变；input 字段不变**（仍写回原 4 个 schema 字段）。
5. **`examCheck` sections 折叠**：用 native `<details>` element（不引新组件），首屏折起；总评 summary 限 4 行；gradingTable 放最前。
6. **不动 schema / 不动 prompt**：仅 UI 层差异化（r1c 之后视情况再考虑 prompt 引导）。
7. **`patchSection` / `patchResult` / `linesFromText`** 这 3 个 helper 留在 page.tsx 当 props 传入（保持 r1a 的 in-memory React state 真理源）。

## 测试计划

- `tests/ai-assistant-result-views.test.ts`：源结构 grep（4 个组件存在、各自含 toolKey-specific marker、`ideologyMining` / `questionAnalysis` 不渲染 gradingTable、`examCheck` 渲染 `<details>` 折叠）
- 现有 `tests/use-persisted-job.test.ts` 7 个保留
- 全 suite 不破

## 风险

- 抽组件后 inline `onChange` 闭包重新创建 → React 性能影响轻微（4 工具页面 result 区域少状态），可接受
- 各组件 props 一致 → 切 activeTool 时切换组件类型，React 会重 mount，但所有状态都在 page.tsx 内，组件本身 stateless

## 范围外（推 r1c）

- 阅读视图（read-only markdown 格式化）
- 编辑/阅读切换 button
