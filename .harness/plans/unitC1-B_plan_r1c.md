# Unit C1-B · r1c · Mini Plan

> builder@instance-workbench · 2026-05-15
> Build on r1b (commit `bb0667e`). Final commit for C1-B.

## 目标（仅 r1c）

加阅读视图（read-only markdown 化展示）+ 编辑/阅读切换。默认 read-only；点「编辑」切到 r1b 已有的 editable 模式；run 完成后自动回到 read（让教师第一眼看到整洁结果）。

## 改动文件

| 文件 | 改/新 | 估行 |
|---|---|---|
| `components/ai-assistant/result-atoms.tsx` | 改：加 `ViewMode` 类型 + `SectionReader` / `TextReader` / `BulletReader` / `TitleAndSummaryReader` / `GradingTableReader` 几个 read 原子；现有原子加 `viewMode` 可选 prop（fall through 给 reader） | +180 |
| `components/ai-assistant/lesson-polish-result.tsx` | 改：接 `viewMode` prop，read mode 走 reader 原子 | +20 |
| `components/ai-assistant/ideology-mining-result.tsx` | 改：read mode 育人目标 + 融合点 markdown 化 | +25 |
| `components/ai-assistant/question-analysis-result.tsx` | 改：read mode 题型/知识点/解题步骤/易错点 markdown 化 | +20 |
| `components/ai-assistant/exam-check-result.tsx` | 改：read mode gradingTable 仍展示 + sections 默认展开（read mode 不折叠）| +25 |
| `app/teacher/ai-assistant/page.tsx` | 改：加 viewMode state + 切换 button + 透传给 renderResultByTool；runTool 成功 setViewMode("read") | +35 / -5 |
| `lib/hooks/use-persisted-job.ts` | 改：persist `viewMode` 字段（独立 entry shape，向后兼容老 cache 缺字段时 fallback "read"） | +15 / -2 |
| `tests/ai-assistant-result-views.test.ts` | 改：新增 ≥3 测试（read mode 不渲染 Textarea、切换按钮存在、viewMode 持久化字段） | +60 |

合计 ~380 行（含 hook 改动 ~15 行 + atoms +180 + 4 组件 +90 + page +30 + tests +60）。

## 关键决策

1. **`viewMode: "read" | "edit"`** — page.tsx 控；默认 `"read"`；runTool 成功后强制 `"read"`；用户点编辑 → `"edit"`；用户点完成阅读 → `"read"`。
2. **persist viewMode**：放在 `PersistedJobState`（每个 toolKey 独立 cache），不引入新 storage key，简单。schemaVersion 仍是 1 — 旧 cache 缺字段 → 走 DEFAULT_STATE `"read"`。
3. **Reader 原子**：read mode 用纯 text + markdown-style 排版（`<h*>` / `<ul>` / `<li>` / `<table>`），不引入 markdown 渲染库（项目目前无依赖）。
4. **共用 `viewMode` prop**：所有 4 result 组件 + atoms 接 `viewMode`；atoms 内部用 `viewMode === "read" ? <Reader/> : <Editor/>` 分流。
5. **examCheck `<details>` 折叠**：edit mode 默认折起；**read mode 默认展开**（教师阅读时不希望再点开）。
6. **GradingTable**：edit 和 read 渲染基本一样（已是 readonly `<table>`），仅在 read mode 隐藏"逐题批改结果"小标题前的工具栏（已无工具栏，不变）。
7. **switch button**：放在结果区顶部 toolbar 区域（r1b 已有 "复原"/"复制结果" 行），加一个变体 button 切 viewMode。文案：`"编辑"` / `"完成阅读"`。

## 测试计划

- 现有 11 + 7 vitest 全保
- 新增 ≥3：
  - viewMode default = `"read"`（grep page.tsx 初值）
  - 切换 button 存在 + 文案
  - hook `PersistedJobState` 类型含 `viewMode` 字段（grep）
  - read mode 组件源结构包含 reader 原子调用

## Anti-regression

- AI schema / prompt / API 0 改动
- editable 模式行为完全不变（r1b 的所有 input/textarea / 4 工具差异化语义保留）
- localStorage schemaVersion 不升（向后兼容老 cache）

## 范围外

- markdown 渲染库引入（不需要，纯 JSX 排版够）
- 多语言切换
