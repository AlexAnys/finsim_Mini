# Build report — F3 AI 助手 4 工具完善 r1

- Unit: F3 / F-AIT-01～03
- Builder: Codex
- Branch: `codex-ai-tools-fix`
- Commit: `d4c54cd` (`fix(ai-assistant): 正名题目解析并隔离四工具契约`)
- Date: 2026-07-17
- Result: **READY FOR OPUS QA**

## 完成内容

### F-AIT-01：题目解析正名、去除假搜索

- 教师 AI 助手卡片由“搜题与解析”改为“题目解析”。
- 描述改为“识别题型、知识点、解题步骤与易错点”。
- 页面移除“请求搜索增强”开关、state、持久化消费和 FormData 参数。
- route/service/prompt 移除 `enableSearch`、`searchConfigured`、`searchStatus` 与 `SEARCH_PROVIDER` 判断；prompt 不再出现搜索请求或联网承诺。
- fallback 与 prompt preview 同步正名。

### F-AIT-02：只让试卷检查拥有 gradingTable

- prompt 版本升为 `v2`，按 `toolKey` 生成输出契约：
  - `lessonPolish` / `ideologyMining` / `questionAnalysis` 不含 `gradingTable`；
  - `examCheck` 保留独立批改表契约。
- service 拆为基础结果 schema 与 `examCheckResultSchema`；非试卷工具使用 Zod 默认 strip，即使模型擅自多吐 `gradingTable` 也会安全裁掉，不触发整次 fallback。
- `LessonPolishResult` 删除批改表渲染；思政与题目解析原本就不渲染，试卷检查继续置顶渲染。
- 真 AI 返回了数字型 `score`，试卷 schema 现会将数字安全归一化为字符串，避免有效批改结果因类型细节失败。

### F-AIT-03：四工具专属输入

| 工具 | 专属字段 |
|---|---|
| 教案完善 | 课时、学段、学生基础 |
| 思政挖掘 | 专业方向、学段 |
| 题目解析 | 题目数量、知识点范围 |
| 试卷检查 | 标准答案、评分标准、满分 |

- `TOOLS` 增加 `extraFields` 配置并按当前工具动态渲染 Input/Textarea；全部可留空、无 `required`。
- 专属字段按 `toolKey` 分桶保存在页面内存中；切换工具不会把同名“学段”或其他值带入另一个工具。
- 页面将当前工具字段序列化到 FormData；薄 route 原样透传 JSON 字符串；service 同时兼容 JSON 字符串、对象、缺失字段与旧 queued job。
- prompt builder 按当前工具白名单取值，忽略其他工具字段。
- 试卷填写满分后，prompt 明确约束每份试卷各题合计及单题得分不得超过满分。

## 四路独立性防回归

未合并四工具后端路径：

| 工具 | feature / 模型 | 温度 | system prompt 重点 | renderer |
|---|---|---:|---|---|
| 教案完善 | `lessonPolish` / `mimo-v2.5-pro` | 0.55 | 目标、活动、评价、差异化、话术 | `LessonPolishResult` |
| 思政挖掘 | `ideologyMining` / `mimo-v2.5-pro` | 0.55 | 融入点、课堂提问、案例表达 | `IdeologyMiningResult` |
| 题目解析 | `questionAnalysis` / `mimo-v2.5` | 0.25 | 题型、知识点、步骤、易错点 | `QuestionAnalysisResult` |
| 试卷检查 | `examCheck` / `mimo-v2.5-pro` | 0.20 | 答案、评分规则、逐题批改、疑点 | `ExamCheckResult` |

`featureForTool(toolKey)`、`ai.service.ts` 的四组 env/model/temperature 映射和页面四组件 switch 均保留；本单元未修改 `ai.service.ts`。

## 回归测试

TDD 红灯：新增/修正测试后，旧实现为 **29 pass / 18 fail**；失败项对应正名、去搜索、契约裁剪、专属输入与 lesson 批改表污染。

最终结果：

| 命令 | 结果 |
|---|---|
| prompt/service/UI/result 定向回归 | **49/49 PASS** |
| `npx tsc --noEmit` | **PASS，0 错** |
| `QWEN_MODEL= npx vitest run` | **126 files / 1290 tests PASS** |
| 修改文件定向 ESLint | **PASS** |
| `git diff --check` | **PASS** |

新增测试锁定：

- 四个 system prompt 两两不同，feature 调用仍依次为四个 toolKey；
- 非试卷 prompt/schema 均无 `gradingTable`，试卷检查保留；
- route 风格 JSON `extraFields` 真正进入对应 prompt，跨工具字段被白名单过滤；
- 满分约束进入 prompt；数字得分会归一化；
- 页面四组专属字段、按工具分桶、FormData 透传及搜索开关删除；
- 教案结果组件不再渲染 `GradingTableBlock`。

## 修复后真 AI 测试摘录

方式：使用本 worktree 的 `buildWorkAssistantPrompt(v2)`，直接调用现有 MiMo OpenAI-compatible provider；不启动 dev server、不经过 DB。四工具各发 **1 次**网络请求、无重试。第一次脚本因 `tsx -e` 顶层 await 在转译阶段退出，网络请求数为 0，不计 AI 调用。

> 这是 prompt + 真实模型 smoke；route/AsyncJob/页面整链由 Opus QA 真浏览器验收。

### 1. 教案完善

- 模型/温度：`mimo-v2.5-pro` / `0.55`
- 标题：`《个人理财》复利课程教案优化建议`
- 摘录：`当前教案依赖讲授，缺乏互动和形成性评价……特别是针对指数运算和现金流时间点掌握不稳的问题。`
- sections：教学目标、重难点、课堂活动、评价任务、学生差异化支持。
- 专属输入体现：产出中出现“2课时”；原始 JSON **无 gradingTable**。
- token：prompt 328 / completion 2551 / total 2879。

### 2. 思政挖掘

- 模型/温度：`mimo-v2.5-pro` / `0.55`
- 标题：`金融科技信贷风险评估课程思政挖掘`
- 摘录：`信贷风险评估教学可自然融入诚信意识、社会责任、法治精神等思政元素……避免生硬说教。`
- sections：客户信息采集、偿债能力分析、担保审查、贷后监测；各环节分别给专业化融入建议。
- 专属输入体现：标题明确采用“金融科技”；原始 JSON **无 gradingTable**。
- token：prompt 295 / completion 1730 / total 2025。

### 3. 题目解析

- 模型/温度：`mimo-v2.5` / `0.25`
- 标题：`复利终值与单利辨析题目解析`
- 摘录：`题目正确选项为B.13382，考查复利终值计算，干扰项包括单利结果和近似错误。`
- sections：题型与知识点、解题步骤、选项干扰项分析、教学提示；同时指出 A/D 重复。
- 专属知识范围“复利终值与单利辨析”在结果中体现；原始 JSON **无 gradingTable**。
- token：prompt 326 / completion 2818 / total 3144。

### 4. 试卷检查

- 模型/温度：`mimo-v2.5-pro` / `0.20`
- 标题：`复利计算题批改报告`
- 摘录：`学生甲使用错误单利公式得3分，学生乙仅答案正确无过程得2分。`
- gradingTable：
  - 学生甲：3 分，指出误用单利公式，并标记分值分配需教师复核；
  - 学生乙：2 分，引用“只有答案且无过程最多 2 分”的评分规则。
- 两份结果均未超过满分 10；原始 JSON **有且仅此工具有 gradingTable**。
- 模型本次把 score 返回为 number；已据此补数字→字符串 schema 回归，不追加 AI 请求。
- token：prompt 428 / completion 3022 / total 3450。

历史真浏览器/AsyncJob 基线仍可对照只读报告中的 job：`ecec099e`、`f6682ab4`、`cabdbdb4`、`239a78ec`；本报告未把该报告的摘要冒充原始 JSON 引文。

## 文件与范围说明

核心改动：

- `lib/ai/prompts/work-assistant.ts`
- `lib/services/ai-work-assistant.service.ts`
- `components/ai-assistant/lesson-polish-result.tsx`
- `app/teacher/ai-assistant/page.tsx`

必要薄链路/调用者：

- `app/api/ai/work-assistant/route.ts`：仅移除 search 参数并透传 `extraFields`；否则专属字段无法进入后台 job。
- `lib/ai/prompts/preview.ts`：同步 prompt builder 签名。
- `tests/ai-assistant-input-fields.test.ts`
- `tests/ai-assistant-result-views.test.ts`
- `tests/ai-work-assistant.service.test.ts`
- `tests/ai-prompts/question-bank-work-assistant.snapshot.test.ts` 及 snapshot。

纪律：未 push；未改 `.env`、Prisma/auth/评分核心/OCR/文件解析；未启动长驻 dev server；未执行人工 DB 读写或数据变更。

## 遗留 / 后续

- **F-AIT-04**（联动平台课程/章节知识库）仍为 P3，依赖课程选择器，本单元不做。
- spec 范围外的全局 AI 设置管理仍保留历史 `enableSearch` 元数据及旧文案；本单元目标页、实际提交链和 prompt 已不读取/展示/使用它。若要清理全局设置 UI/Prisma 字段，应单开迁移单元，避免越过本 spec。

## 给 Opus QA 的重点

1. `/teacher/ai-assistant` 应显示“题目解析”精确描述，设置抽屉无搜索开关。
2. 依次切换四工具，确认专属字段不同；教案“学段”不得串到思政“学段”。
3. 各工具填一个明显专属值后真跑：前三者无批改表，试卷检查有批改表。
4. 试卷检查填写标准答案、评分标准、满分 10；确认得分不超 10，数字型模型输出也能正常完成而非 fallback。
5. 上传/粘贴/OCR 原流程保持可用；全部专属字段留空时仍能按旧通用输入运行。
