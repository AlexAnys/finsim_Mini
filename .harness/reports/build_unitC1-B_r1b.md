# Build Report · Unit C1-B · Round 1b (4 工具差异化渲染)

> builder@instance-workbench · 2026-05-15
> Plan: `.harness/plans/unitC1-B_plan_r1b.md`
> 接续 r1a (commit `918a5d7`)，下一步：r1c (阅读视图 + 编辑切换)

## 范围（仅 r1b）

按 activeTool 切换 4 个独立 result 组件渲染。AI output schema 不变（free-form `sections` + 可选 `gradingTable` + `actionItems` + `cautions` + `fileReports`）。

## 改动文件

| 文件 | 改/新 | 行 |
|---|---|---|
| `components/ai-assistant/result-atoms.tsx` | 新 | +257 |
| `components/ai-assistant/lesson-polish-result.tsx` | 新 | +35 |
| `components/ai-assistant/ideology-mining-result.tsx` | 新 | +79 |
| `components/ai-assistant/question-analysis-result.tsx` | 新 | +51 |
| `components/ai-assistant/exam-check-result.tsx` | 新 | +87 |
| `app/teacher/ai-assistant/page.tsx` | 改 | +21 / -129 |
| `tests/ai-assistant-result-views.test.ts` | 新 | +144 |
| `.harness/plans/unitC1-B_plan_r1b.md` | 新 | +60 |

合计 +734 / -129 = +605 净。

## 4 工具差异化语义

| 工具 | 顶部 | sections | gradingTable | actionItems |
|---|---|---|---|---|
| `lessonPolish` | 标题 + 总评 + 文件识别 | 默认 4 字段 label | 数据非空时显示 | 「下一步动作」 |
| `ideologyMining` | 标题 + 总评 + **育人目标 callout（actionItems 置顶）** + 文件识别 | label: 融合点/切入说明/引导话术/案例表达（**examples 高亮**） | **隐藏** | 顶部 callout（不重复显示） |
| `questionAnalysis` | 标题 + 总评 + 文件识别 | label: 题型 / 知识点定位 / 解题步骤 / 易错点 | **隐藏** | 「给学生的复盘建议」 |
| `examCheck` | 标题 + **gradingTable 置顶** + 总评简要 (rows=3) | `<details>` 折叠，按需展开 | 顶部置顶（无数据时友好提示） | 「下一步操作」 |

## 关键决策

1. **结果组件抽到 `components/ai-assistant/`**：page.tsx 减 129 行，组件平均 60 行。
2. **公共原子 `result-atoms.tsx`**：`FileReportsBlock` / `SectionEditor`（labels + examplesHighlight 可定制）/ `GradingTableBlock` / `TitleAndSummary` / `ActionItemsAndCautions` / `linesFromText` —— 复用率高且各组件按需引入。
3. **patchResult / patchSection 在 page.tsx 保留**：原 React state 真理源不变，组件 stateless；切 activeTool 仅切换 component type，state 全在 page.tsx 内。
4. **`renderResultByTool` helper**：默认 fall-through 到 `LessonPolishResult`，未来加新工具只需加 case。
5. **`<details>` 折叠**：原生 HTML element，零依赖。`examCheck` 用，避免拉 Accordion 组件。
6. **`data-tool` 属性**：每个组件根 div 标记，方便 future E2E selector 锁定 / debugging。

## 自测结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（C1-B 文件） | 0 error |
| `npx tsc --noEmit`（全项目） | 6 pre-existing study-buddy 错误（与 C1-B 无关，r1a build/qa 已注明） |
| `npx vitest run tests/ai-assistant-result-views.test.ts` | 11 / 11 PASS |
| `npx vitest run`（全 suite） | 86 files / 1006 tests PASS / 0 regression（r1a baseline 995 + r1b +11 = 1006）|
| `npx eslint <touched files>` | 0 error / 0 warning |

## Anti-regression

- AI output schema (`workAssistantResultSchema`) 0 改动
- AI prompt 0 改动（system prompt 仍按工具区分，r1b 不动）
- `/api/ai/work-assistant` route 0 改动
- `/api/async-jobs/[id]` route 0 改动
- `lib/services/async-job.service.ts` 0 改动（Phase3-A 并行 OK）
- page.tsx 内 `useState` + 4 个 useEffect（r1a）+ runTool / retryJob / copyResult / resetResult / patchResult / patchSection / formatResultForCopy / JobProgressPanel / jobStatusLabel 全 0 改动
- A2 / r1a touched files 完全不交集

## 范围外（推 r1c）

- **阅读视图**：read-only markdown 格式化展示
- **编辑/阅读切换 button**：点「编辑」切到当前 input/textarea 模式

## 下一步

QA 验收 r1b。然后开 r1c。
