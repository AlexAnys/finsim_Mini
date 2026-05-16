# QA Report · Unit C1-B · Round 1b (4 工具差异化渲染)

> qa@instance-workbench · 2026-05-15
> Build: `bb0667e feat(unit-C1-B): 4 工具差异化渲染（r1b）`
> Plan: `.harness/plans/unitC1-B_plan_r1b.md`
> Build report: `.harness/reports/build_unitC1-B_r1b.md`

## ⚠️ 重要：验证基线

**测试 HEAD commit `bb0667e`，不含 builder 当前 r1c 在工作树的 in-progress 改动**（已确认 working tree 有 6 个 modified 文件未 commit，引入了 r1c 的 `ViewMode` 类型——会让 tsc 失败，但属 r1c 工作未完，**与 r1b commit 本身无关**）。

验证方法：`git stash push -- components/ai-assistant/ lib/hooks/use-persisted-job.ts` 后跑 tsc/vitest，验证 HEAD 干净。Restore 后立即 `git stash pop` 恢复 builder r1c 工作树。

## Acceptance 检查

| # | Acceptance | Verdict | 证据 |
|---|---|---|---|
| 1 | **lesson-polish** 默认行为（sections + actionItems + cautions + gradingTable） | **PASS** | `lesson-polish-result.tsx` import `GradingTableBlock`（L6）+ L31 渲染；用 default labels；`<TitleAndSummary>` + `<FileReportsBlock>` + sections.map + `<GradingTableBlock>` + `<ActionItemsAndCautions>` 5 块按序 |
| 2 | **ideology-mining** 育人目标 callout + 案例表达高亮 + 不显示 gradingTable | **PASS** | `ideology-mining-result.tsx`：① **不 import GradingTableBlock**（L6-12 imports 仅 `FileReportsBlock, SectionEditor, TitleAndSummary, linesFromText`）② "育人目标"专 callout L25-41（Lightbulb + brand-soft 边框）③ `examplesHighlight` prop 传给 SectionEditor (L61)；4 个 label 改为 融合点/切入说明/引导话术/案例表达 |
| 3 | **question-analysis** sections label 4 字段 + 不显示 gradingTable | **PASS** | `question-analysis-result.tsx`：① 不 import GradingTableBlock（imports 仅 `ActionItemsAndCautions, FileReportsBlock, SectionEditor, TitleAndSummary`）② L33-38 labels 含 "题型"/"知识点定位"/"解题步骤"/"易错点"③ L25 顶部 hint 文本含 "题型 / 知识点 / 解题步骤 / 易错点" ④ L43 显式注释 "不显示 gradingTable" |
| 4 | **exam-check** gradingTable 置顶 + 总评简要 (rows=3) + sections `<details>` 折叠 | **PASS** | `exam-check-result.tsx`：① gradingTable 在 L32-41，sections.map 在 L62（**gradingTable 真在 sections 之前**）② summary Textarea rows={3}（L48）③ `<details>` L56 + `<summary>` L57，含 ChevronDown 旋转 ④ gradingTable 空数据时显示友好提示 L37-41 |
| 5 | page.tsx 用 `renderResultByTool` 分发 | **PASS** | page.tsx L572-590 `renderResultByTool(toolKey, result, patchResult, patchSection)` switch 4 case；L498 调用；L28-31 import 4 组件 |
| 6 | result components stateless | **PASS** | `grep -n "useState" components/ai-assistant/*.tsx` 返回 **空**——5 文件 0 个 useState；state 在 page.tsx |
| 7 | 切 activeTool 仅切组件类型，r1a state 全保留 | **PASS** | page.tsx 5 个 useState（text/teacherRequest/.../result/originalResult）全在 page 层；切 activeTool 仅触发 useEffect L98-110 重 hydrate；result component 只接 props |
| 8 | vitest 新增 ≥3 | **PASS** | `tests/ai-assistant-result-views.test.ts` **11 个测试**覆盖：文件存在 / data-tool 属性 / 4 工具差异化语义（gradingTable 显隐 + label + folding order）/ page 分发 / 4 case switch / 删除内联渲染 / atoms 共享原子 export |

## 关键 grep 证据

```bash
# 1. ideology/question-analysis 完全不用 GradingTableBlock（仅注释提及）
$ grep -n "GradingTableBlock\|gradingTable" components/ai-assistant/ideology-mining-result.tsx components/ai-assistant/question-analysis-result.tsx
ideology-mining-result.tsx:15:    // 不显示 gradingTable                       <-- 仅注释
question-analysis-result.tsx:12:   // 不显示 gradingTable                       <-- 仅注释
question-analysis-result.tsx:43:   {/* 不显示 gradingTable */}                  <-- 仅 JSX 注释

# 2. exam-check 用 <details> 折叠
$ grep -n "<details" components/ai-assistant/exam-check-result.tsx
56:  <details className="group rounded-lg border border-line bg-paper p-3">

# 3. question-analysis 4 个 label 齐全
$ grep -n "题型\|知识点\|解题步骤\|易错点" components/ai-assistant/question-analysis-result.tsx
11: // questionAnalysis: sections 字段重 label 为 题型/知识点/解题步骤/易错点
25: 逐题结构化（每题：题型 / 知识点 / 解题步骤 / 易错点）
34: heading: "题目摘要 / 题型"
35: diagnosis: "知识点定位"
36: suggestions: "解题步骤（一行一条）"
37: examples: "易错点 / 提示（一行一条）"

# 4. exam-check gradingTable 位置在 sections 之前
$ grep -n "gradingTable\|sections\.map\|<details" components/ai-assistant/exam-check-result.tsx
15: // examCheck: gradingTable 置顶 + 总评简要 + sections 默认折叠
31: {/* gradingTable 置顶 */}
32: {result.gradingTable.length > 0 ? (                                    <-- L32
56: <details ...>                                                          <-- L56
62: {result.sections.map((section, index) => (                             <-- L62

# 5. 0 useState 在 result components
$ grep -n "useState" components/ai-assistant/*.tsx
(empty)

# 6. linesFromText / fileStatusLabel 从 page.tsx 删除（dead code 清理）
$ grep -nE "^function linesFromText|^function fileStatusLabel" app/teacher/ai-assistant/page.tsx
(empty)
```

## 自动化测试（在 HEAD bb0667e 干净基线上）

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（全项目，HEAD 干净基线） | **0 new errors**；仅 6 pre-existing study-buddy 错误（`e3115712` 2026-05-02） |
| `npx vitest run tests/ai-assistant-result-views.test.ts` | ✅ **11/11 PASS** (3ms) |
| `npx vitest run`（全 suite，HEAD 干净基线） | ✅ **1006/1006 PASS, 86/86 files, 0 regression**（r1a baseline 995 + r1b +11） |

## 改动范围

`git show bb0667e --stat`：
```
.harness/plans/unitC1-B_plan_r1b.md            | +60
.harness/reports/build_unitC1-B_r1b.md         | +72
app/teacher/ai-assistant/page.tsx              | +21 / -129
components/ai-assistant/exam-check-result.tsx  | +87 (new)
components/ai-assistant/ideology-mining-result.tsx | +79 (new)
components/ai-assistant/lesson-polish-result.tsx | +35 (new)
components/ai-assistant/question-analysis-result.tsx | +51 (new)
components/ai-assistant/result-atoms.tsx       | +257 (new)
tests/ai-assistant-result-views.test.ts        | +144 (new)
```
- 产线净增 +401 / -129 = +272 行（hook 0 改 + page 减 108 + 4 result 组件 +252 + atoms +257）
- 测试 +144
- 单 commit；plan 已声明 r1a/r1b/r1c 各 ~300 行可接受

## Finsim-specific 检查

| 维度 | 结果 |
|---|---|
| UI 中文文案 | ✅ "育人目标" / "题型 / 知识点 / 解题步骤 / 易错点" / "逐题批改结果" / "AI 未输出逐题批改表..." 全中文 |
| Route Handler 无业务逻辑 | ✅ 不动 route handler |
| Auth | ✅ 不动 |
| Prisma / schema | ✅ 零 |
| 不动 `async-job.service.ts` | ✅ git diff 验证 |
| AI prompt 不改 | ✅ 仅 UI 层 |

## 实现稳健性 / 风险

### 🟢 良好设计

1. **公共原子 `result-atoms.tsx`**：6 个 atom + helper 复用率高（FileReportsBlock / TitleAndSummary / SectionEditor 可定制 labels + examplesHighlight / GradingTableBlock / ActionItemsAndCautions / linesFromText）
2. **`data-tool` 属性**：4 组件根 div 标识，便于 future E2E selector 锁定
3. **`<details>` 折叠用原生 HTML**：零依赖，无需 Accordion 组件
4. **`renderResultByTool` switch + default**：未来加新工具只需加 case
5. **lessonPolish fallthrough default**：保留旧行为不破坏向后兼容

### 🟢 dead code 清理到位

`linesFromText` / `fileStatusLabel` 已从 page.tsx 删除（搬到 atoms），grep 验证空。

### 🟡 不阻塞的观察

1. **vitest 仍是源 grep 测试**：项目无 React testing-library。覆盖：文件存在 / data-tool 属性 / GradingTable 显隐 / 4 labels / folding order / page.tsx 分发 / case switch / atoms export。**未覆盖** runtime React rendering（点击 details summary 是否真折叠 / examplesHighlight class 真应用等）— **Final QA staging 阶段真浏览器必验**。
2. **examCheck gradingTable 空时降级提示文案**："AI 未输出逐题批改表，请检查输入是否包含答案 / 评分规则"——清晰中文，质量良好。
3. **build 报告净行数偏差**：plan 估 +734 实际 +401（hook 0 改而非 +60）；说明 builder 提前抽出 atoms 复用更高效。质量层面无影响。

## ⚠️ Working tree 干扰（不影响 r1b verdict）

工作树存在 6 个 modified files (`components/ai-assistant/*.tsx` × 5 + `lib/hooks/use-persisted-job.ts`)，属 builder 当前正在做的 **r1c 阅读视图** 工作（plan_r1c.md 已 untracked 存在）。这些 in-progress 改动引入 `ViewMode` 类型 + `viewMode` 必填 prop 但未完成全部 caller wiring，导致 working tree tsc 在 result-component 文件 + page renderResultByTool 处报 11 个 `Property 'viewMode' is missing` 错误。

**这是 r1c 进行中状态，与 r1b commit 本身无关**。验证 r1b 时 stash 这些工作树改动后 tsc 全部干净（0 new errors）。

## Anti-regression（在 HEAD 干净基线上）

- AI output schema (`workAssistantResultSchema`) 0 改动
- AI prompt 0 改动
- `/api/ai/work-assistant` route 0 改动
- `/api/async-jobs/[id]` route 0 改动
- `lib/services/async-job.service.ts` 0 改动（Phase3-A 并行 OK）
- `lib/hooks/use-persisted-job.ts` 0 改动（**仅 r1c 进行中工作树改了它**）
- page.tsx 内 useState / useEffect 4 个 / runTool / retryJob / copyResult / resetResult / patchResult / patchSection / formatResultForCopy / JobProgressPanel / jobStatusLabel 0 改动
- A2 + r1a touched files 完全不交集

## Overall: **PASS**（r1b part of C1-B）

8/8 acceptance 全 PASS，HEAD 基线 tsc 0 new error，vitest 1006/1006 全过 + 0 regression，4 工具差异化语义清晰、stateless 设计良好、dead code 已清。

**建议 coordinator**：
- 标 Task #8 备注 `r1b PASS`，**不**标 completed（C1-B 还有 r1c 阅读视图）
- builder 当前正在做 r1c（工作树 6 文件 modified，plan_r1c.md 已写）——继续推进
- Final QA staging 阶段需补 5 项真浏览器验证：
  1. 点击 `<details>` summary 折叠/展开
  2. ideology examplesHighlight 视觉效果（brand-soft 边框 + 内边距）
  3. examCheck gradingTable 空数据降级文案出现
  4. question-analysis 4 个新 label 正确显示
  5. 切工具 UI 切换无残留旧组件痕迹

## Dynamic exit 进度

A2 PASS + C1-B r1a PASS + C1-B r1b PASS = **连续 3 PASS** 触发 dynamic exit 条件（plan: 两次连续 PASS 即收工）—可以继续推进 r1c / A1 / B1 / B2 任一。
