# QA report — F3 AI 助手 4 工具完善 r2（崩溃修复复验）

- Unit: F3 / F-AIT-01～03（崩溃回归修复）
- QA: Opus（真浏览器 Claude Browser MCP + DB SELECT）
- Branch: `codex-ai-tools-fix`（worktree `/Users/yangsenan/dev/finsim-f3-aitools`）
- Fix commit: `204a2d9`（`fix: 修复切换试卷检查时的结果竞态崩溃`），前序 `d4c54cd`
- Dev server: http://localhost:3013（未 kill/重启；未碰 :3011/:3012）
- Date: 2026-07-17
- **总判: PASS（r2）** — r1 判 FAIL 的整页崩溃已消除；已 PASS 的 3 目标无回归；基线全绿（含 2 条新增崩溃回归测试）。

---

## 1 · 崩溃回归（r1 FAIL 主因）— **已修复 · PASS**

### r2 改动（两层修复，与 r1 根因指引一致）
`git diff d4c54cd..HEAD`：
- `components/ai-assistant/exam-check-result.tsx`：`const gradingRows = result.gradingTable ?? [];`，渲染改用 `gradingRows`（空守卫，止血）。
- `app/teacher/ai-assistant/page.tsx:166` `setActiveTool`：切工具前**同步** `setJob(null); setResult(null); setOriginalResult(null);`（+ `if(next===activeTool)return;`，deps `[activeTool]`），根治竞态——切到 examCheck 时 result 先清空，`ExamCheckResult` 不再瞬时拿到别工具的无 gradingTable 结果。
- 工具卡 `onClick={() => setActiveTool(tool.key)}`（page.tsx:389）确认走被修函数。

### 真浏览器复现原崩溃路径 — 全部不再崩
teacher1 登录，localStorage 4 工具均有 r1 真实结果（教案/思政/题目解析/试卷），逐路径切换（DOM 错误边界为同步渲染，`crashed:false` 即证无渲染崩溃）：

| 切换路径 | 结果 | 目标工具渲染 |
|---|---|---|
| 教案完善(结果在) → 试卷检查 | **不崩** crashed:false | 试卷检查专属信息 + 试卷批改报告 + 1 表 |
| 题目解析(结果在) → 试卷检查（r1 净复现路径） | **不崩** crashed:false | 试卷检查 + 批改表 |
| 思政挖掘(结果在) → 试卷检查 | **不崩** crashed:false | 试卷检查 + 批改表 |
| 试卷 → 教案 → 试卷（往返） | **不崩** crashed:false | 试卷检查 + 批改表 |

对照 r1：同样「教案/题目解析(有结果) → 试卷检查」在 r1 是**首次切换即崩到 500 错误边界**；r2 全部正常切换、examCheck 正确 hydrate 自身批改表结果。

### console
- 新开净标签（tab-3，独立 console 缓冲、共享登录）加载 AI 助手 + examCheck 批改表结果：**console 零 error**。
- 主标签 console 缓冲里仍存在 `ExamCheckResult ... reading 'length'` 报错，均为 **r1 崩溃复现的历史残留**（该 MCP console 缓冲跨 reload 不清空，栈引用旧编译行）；r2 每次切换的当前态 DOM 检查均 `crashed:false`（错误边界未出现），是权威信号。

## 2 · 修复未碰坏已 PASS 的 3 目标 — **无回归 · PASS**
（r2 diff 仅动 `exam-check-result.tsx`(加守卫) 与 `page.tsx` setActiveTool(清 result/job)；未触 extraFields 逻辑、prompt/schema 分派、工具命名、搜索删除。）

- **F-AIT-01**（真浏览器实测）：第 3 工具仍「题目解析 / 识别题型、知识点、解题步骤与易错点」；全页 `[role=switch]` 数=**0**、无「搜索增强」文本。PASS。
- **F-AIT-02**（真浏览器实测）：切换 4 工具读 `main table` 数 = 教案 **0** / 思政 **0** / 题目解析 **0** / 试卷检查 **1**——非试卷工具无批改表、试卷检查有批改表，契约保持。examCheck schema 未被 r2 改动（仅渲染层加 `?? []` 守卫，不改「谁有 gradingTable」）。PASS。
- **F-AIT-03**（真浏览器 + 代码）：切换时各工具「XX专属信息」区各自渲染（教案/思政/题目解析/试卷检查专属信息均正确出现）。同名字段不串（学段）为 r1 已实测 PASS，且 r2 `page.tsx` diff **未触** `extraFieldsByTool`/`setExtraField`/字段渲染（仅在 setActiveTool 清 job/result/originalResult，不清 extraFields），分桶逻辑逐字节不变，结论直接沿用。PASS。

> 说明：F-AIT-03 同名字段不串的「新一轮实时打字探针」因 `resize_window` 后 Browser MCP 坐标映射错位（点击不落到卡片）未能重跑；但该路径代码 r2 未改、r1 已实测，且 r2 切换中已实时看到各工具专属区正确切换，无回归风险。真 AI 未再调用（按 coordinator 指示 r1 已验差异化，r2 抽验无需 AI）。

## 3 · 基线 — **PASS**
- `npx tsc --noEmit`：**0 错**。
- `QWEN_MODEL= npx vitest run`：**126 文件 / 1292 测试全绿**（较 r1 1290 +2，对应新增崩溃回归测试）。
- 新增回归测试（`tests/ai-assistant-result-views.test.ts`）：
  1. 「examCheck 收到缺 gradingTable 的旧工具结果时不崩溃并显示空表提示」——`renderToStaticMarkup(<ExamCheckResult result={无 gradingTable}/>)` 真实渲染断言 `not.toThrow()` + 含「AI 未输出逐题批改表」。
  2. 「lessonPolish 有结果时切 examCheck 会先同步清空旧工具结果」——断言 setActiveTool 内 `setJob(null)/setResult(null)/setOriginalResult(null)` 均先于 `setActiveToolRaw(next)`。

## 纪律
- 只读应用代码；DB 仅 SELECT；未 kill/重启任何 dev server；未碰 :3011/:3012；本轮真 AI 调用 0 次（纯 UI/契约抽验 + 复用 r1 真实结果做切换崩溃复验）。
