# QA report — F3 AI 助手 4 工具完善 r1

- Unit: F3 / F-AIT-01～03
- QA: Opus（真浏览器 Claude Browser MCP + 真 MiMo AI + DB SELECT）
- Branch: `codex-ai-tools-fix`（worktree `/Users/yangsenan/dev/finsim-f3-aitools`）
- Build commit: `d4c54cd`
- Dev server: http://localhost:3013（QA 全程未 kill/重启；未碰 :3011/:3012）
- 账号: teacher1@finsim.edu.cn
- Date: 2026-07-17
- **总判: FAIL（r1）** — F-AIT-01/02/03 三目标本身全部达成，但 F-AIT-02 的 schema 裁剪引入一个**高危回归**：查看任一非试卷工具结果后点「试卷检查」，整页崩溃到 500 错误边界。

---

## 逐条验收

### 验收 1 — F-AIT-01 题目解析正名 + 去假搜索开关 · **PASS**
- 第 3 个工具卡片标题 **「题目解析」**，描述 **「识别题型、知识点、解题步骤与易错点」**（与 spec 精确一致）。真浏览器 DOM 确认。
- 「本次工具设置」抽屉仅剩 **输出风格 / 严格度** 两项；**无「请求搜索增强」开关**。
  - DOM 证据：`document.querySelectorAll('[role="switch"]').length === 0`；全页无「搜索增强」文本（`bodyHasSearchEnhance:false`）；抽屉文本 = `本次输出设置 / 输出风格 / 结构化清单 / 严格度 / 均衡 / Close`。
- 代码侧：`page.tsx` 删 `Switch` import、`enableSearch` state 与开关块；`work-assistant.ts`/`ai-work-assistant.service.ts`/`route.ts` 移除 `enableSearch`/`searchStatus`/`searchConfigured`/`SEARCH_PROVIDER`；prompt COMMON_SYSTEM 由「不要假装已经联网检索」改为「不要虚构材料中未提供的来源」。
- 题目解析真跑（job `0523ea38`）产出正常：题型/知识点/步骤/易错点齐全，正确识别答案 B=1102.5。

### 验收 2 — F-AIT-03 4 工具专属输入 + 同名字段不串 · **PASS**
真浏览器逐工具切换，DOM 读取每个工具专属字段与取值：

| 工具 | 专属字段（label / key / 控件） |
|---|---|
| 教案完善 | 课时 lessonHours / 学段 educationStage / 学生基础 studentFoundation(textarea) |
| 思政挖掘 | 专业方向 majorDirection / 学段 educationStage |
| 题目解析 | 题目数量 questionCount(number) / 知识点范围 knowledgeScope |
| 试卷检查 | 标准答案 standardAnswer(textarea) / 评分标准 gradingCriteria(textarea) / 满分 fullScore(number) |

- **同名字段不串（关键）**：在教案完善「学段」填入探针 `LESSON学段标记ZZZ` → 切到思政挖掘，其「学段」值为**空**（未被串入）；巡回题目解析/试卷检查后切回教案完善，「学段」仍保留 `LESSON学段标记ZZZ`。证明 `extraFieldsByTool[activeTool]` 分桶保存、跨工具不泄漏、本工具值持久。
- 后端接线：4 个 job 的 `input.extraFields` 均如实收到 UI 值（见验收 3 各 job 的 extraFields）。

### 验收 3 — F-AIT-02 消除污染 + 专属字段真生效（真 AI，各 1 次）· **PASS（含 1 处 lessonPolish 字段回显偏弱备注）**
4 工具各真跑 1 次（MiMo 真调用，frugal），DB 读回结果 JSON + 真浏览器读回渲染：

| 工具 | job id | fallback | gradingTable | 差异化结构 | 专属字段生效 |
|---|---|---|---|---|---|
| 教案完善 lessonPolish | `94475364` | false | **无键**（JSON `result?'gradingTable'`=f）；UI 0 表格、无批改/得分字样 | 教学目标/重难点/课堂活动/评价任务/差异化支持 | extraFields `{educationStage:高职二年级, lessonHours:7课时}` 进入 job；**产出未字面回显 7课时**（见备注） |
| 思政挖掘 ideologyMining | `80b4e932` | false | **无键**；UI 0 表格 | 标题「…责任意识与诚信教育」，融入点/案例，纯思政 | extraFields `{majorDirection:智能网联汽车}` 进入 job，产出**含「智能网联汽车/汽车信贷」** ✓ |
| 题目解析 questionAnalysis | `0523ea38` | false | **无键**；UI 0 表格 | sections = **题型与知识点识别 / 解题步骤 / 易错点分析 / 教学提示** | extraFields `{knowledgeScope:复利终值与单利辨析, questionCount:1}` 进入 job，标题「复利终值计算单选题解析」；正确算出 1102.5 ✓ |
| 试卷检查 examCheck | `ba6fde47` | false | **有，4 行** ✓；UI 渲染「逐题批改结果」表 | 逐题批改表置顶 + 逐题详细分析 | extraFields `{fullScore:10, standardAnswer, gradingCriteria}` 进入 job |

- **教案/思政/题目解析无批改表污染**（原 bug：教案冒出虚构学生批改表）→ 已消除。JSON 无 `gradingTable` 键 + 对应渲染组件不渲染（`lesson-polish-result.tsx` 删 `GradingTableBlock`；ideology/question-analysis 注释「不显示 gradingTable」）。
- **试卷检查满分约束真生效**：满分=10，批改结果 张三 第1题0(误用单利公式)/第2题4、李四 第1题6/第2题0(未作答) → 两人总分 **4/10 与 6/10，均 ≤ 满分**；模型总评明确写「两位学生总分均未超过满分10分」。**评分完全按我填的评分标准**（第1题6分拆分、第2题4分）→ 专属字段强证据。
- **数字型 score 正常完成非 fallback**：examCheck job `fallback:false`，4 行 score 归一化为字符串（schema `z.union([string,number]).transform(String)`）；无整次 fallback。
- 备注（非阻塞）：lessonPolish 本次用 `7课时` 探针，产出内容优质但**未字面出现 "7课时"**（课堂活动时长写 5/20/15 分钟≈1 课时）。字段确进 prompt（DB `input.extraFields` + 代码 `extraFieldsForTool` + 通过的回归测试三重确认），仅模型本轮未强回显；examCheck/ideology/questionAnalysis 的字段生效已强证。

### 验收 4 — 后端独立性未回归 · **PASS**
- 真 AI 产出 4 路**明显差异化且贴合各自目的**（见验收 3 差异化结构列），非同质。
- `git diff origin/main..HEAD`：`featureForTool(toolKey)` 保留（`ai-work-assistant.service.ts:180`）；`lib/services/ai.service.ts` **未在 diff 内**（4 组温度 0.55/0.55/0.25/0.2 + 4 组 env 映射 AI_LESSON_POLISH/…/AI_EXAM_CHECK 原样）；`page.tsx` 4 组件 switch（`renderResultByTool` 689-696）保留；`systemPromptForTool` 4 分支保留。未把 4 工具合并成一条路径。

### 验收 5 — 基线 + 兼容 · **PARTIAL（基线绿；发现崩溃回归，记在下方 P1）**
- `npx tsc --noEmit`：**0 错**。
- `QWEN_MODEL= npx vitest run`：**126 文件 / 1290 测试全绿**，含新增 `ai-assistant-input-fields.test.ts`(5) / `ai-work-assistant.service.test.ts`(含 examCheck schema/数字 score/白名单) / `ai-assistant-result-views.test.ts`(18) / `question-bank-work-assistant.snapshot.test.ts`(19)。
- 向后兼容（专属字段全留空）：由通过的单测覆盖 —— `run()` helper 不传 extraFields，`lessonPolish/ideology/questionAnalysis 丢弃 gradingTable`、`examCheck 保留` 等用例全绿；`extraFieldsSchema` 用 `z.preprocess` 把 null/""/非法/缺失归一为 `{}`，兼容旧 queued job。（未额外烧 AI 调用；空字段路径是「无专属段」的严格子集，低风险。）
- 粘贴流：4 次真跑均走粘贴框，正常。上传/OCR：`route.ts` 文件处理链未在 diff 内（仅 enableSearch→extraFields），不受本改动影响，OCR 链路根因报告已确认可用。
- console：正常操作仅 `DialogContent` 缺 aria-describedby 的 **warn**（预存 a11y 提示，非本单元、非阻塞）；**唯一 error 即下方 P1 崩溃**。

---

## 🔴 P1 回归（阻塞） — 切到「试卷检查」整页崩溃 500

**现象**：查看任一非试卷工具（教案完善/思政挖掘/题目解析）结果后，点顶部「试卷检查」卡片 → 整页崩到教师错误边界「服务器开小差 · 500 / 重新加载 / 回到工作台」。**已 2 次确定性复现**（首次 教案完善结果→试卷检查；净复现 题目解析结果→试卷检查，均附截图/console）。刷新后 activeTool=examCheck 且 examCheck 自身结果有效时可正常渲染，**崩溃仅发生在「带非试卷结果 → 切 examCheck」的切换竞态**。

**console**：
```
TypeError: Cannot read properties of undefined (reading 'length')
  at ExamCheckResult (components/ai-assistant/exam-check-result.tsx:57)
  The above error occurred in the <ExamCheckResult> component. It was handled by the <ErrorBoundaryHandler>.
[teacher error boundary] TypeError: Cannot read properties of undefined (reading 'length')
```

**根因（本 fix 引入的回归）**：
1. F-AIT-02 把 `gradingTable` 从公共 `workAssistantResultSchema` 挪到独有 `examCheckResultSchema`（`ai-work-assistant.service.ts`）→ 非试卷工具结果**不再带 `gradingTable`**（`result?'gradingTable'`=false，已实测）。
2. `ExamCheckResult`（`exam-check-result.tsx:42`）无守卫地读 `result.gradingTable.length`。该组件不在本次 diff 内、origin/main 原样。
3. 切工具时 `activeTool` 经 `setActiveToolRaw` **同步翻转**（`page.tsx:166-169`），但 `result` 只在 hydrate 后的 useEffect 里重置（`page.tsx:151-163`，`if(!hydrated)return`）；渲染守卫仅 `!result`（`page.tsx:553`）无「结果属于当前工具」校验，`renderResultByTool(activeTool,result,…)`（605）。
4. → 切到 examCheck 的那一次渲染里，`activeTool=examCheck` 但 `result` 仍是上一个非试卷结果（无 gradingTable）→ `ExamCheckResult` 拿到它 → `undefined.length` **渲染期抛错**，错误边界接管整页。

origin/main 上所有结果都带 `gradingTable:[]`（公共 schema 默认 `[]`），`[].length=0` 走空表分支，故此崩溃被**掩盖**；本 fix 去掉默认后暴露/引入。命中 spec 硬规则「无回归」与 acceptance 4，判 FAIL。

**触发路径普适**：教师查看教案完善/思政挖掘/题目解析任一结果 → 点「试卷检查」标签 → 崩。属核心导航常见流。

---

## 给 Codex 的修复指引（r2）
1. **止血（必须）**：`exam-check-result.tsx:42` 守卫 `gradingTable` —— `const rows = result.gradingTable ?? []; rows.length > 0 ? <GradingTableBlock rows={rows}/> : <空表提示/>`。仅此即消除崩溃。
2. **根治（建议）**：切工具竞态 —— 二选一：
   - `setActiveTool` 里**同步** `setResult(null)/setJob(null)/setOriginalResult(null)`（切换即清，随后 hydrate 补回本工具值）；或
   - 渲染守卫加「结果归属」判定（如仅在 `hydrated && slice.forToolKey===activeTool` 时渲染 result），避免任何组件拿到别工具的 result。
3. **回归测试**：新增 —— (a) 用「缺 gradingTable 的 result」渲染 `ExamCheckResult` 不抛错、走空表分支；(b) 页面级/交互级：lessonPolish(有结果) 切 examCheck 不触发错误边界。
4. 复跑 `npx tsc --noEmit && QWEN_MODEL= npx vitest run` 全绿后交 QA r2。

## 纪律确认
- 全程只读应用代码；DB 仅 SELECT（AsyncJob 读回 job 结果/状态）；未 kill/重启任何 dev server；未碰 :3011/:3012。
- 真 AI frugal：4 工具各 1 次（lessonPolish/examCheck/ideology/questionAnalysis），共 4 次真实调用。
- 崩溃复现仅切换页面，未改代码/数据；刷新后应用自恢复，末态干净。
