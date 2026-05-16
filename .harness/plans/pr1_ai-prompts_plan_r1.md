# Plan — PR-1 Candidate E (AI prompt registry · r1)

> Builder: builder-ai-prompts · Branch (worktree): pr1-ai-prompts · Base: main `f2365b7`
> Acceptance source: `.harness/spec.md` § E 专属 acceptance
> Review source: `.harness/reports/review_ai_r1.md` F-3 / F-10 / Anti F-2

## 一、目标

把 12 处 service / route 内联 system+user prompt 全集中到 `lib/ai/prompts/{feature}.ts` 单源；
让 `AiRun.promptVersion` 不再硬编码 `"v1"`，而是从 builder 取真版本；
让 `AI_TOOL_DEFINITIONS.basePromptPreview` 不再人工副本而是从 builder 派生；
prompt **字字不变**（重构，不改 AI 行为），用 snapshot test 防漂移。

## 二、文件清单（新建 `lib/ai/prompts/`）

### 核心 (12 个 feature builder 文件 + 1 index + 1 类型)

| builder 文件 | 来源 inline prompt（filepath:line） | opts 字段 | promptKey 映射 |
|---|---|---|---|
| `simulation-chat.ts` | `ai.service.ts:1013-1077` (chatReply 60 行 persona+JSON 格式)<br/>+ `1037-1049` (config_submission 注入块) | `{ systemPrompt?, scenario, objectives, messageType, transcript, allocations? }` | `simulationChat` |
| `simulation-evaluate.ts` | `ai.service.ts:1596-1621` (rubric prompt) + `1645-1667` (userPrompt) + `1690` (evidence retry hint) | `{ taskName, requirements?, scenario, evaluatorPersona?, strictnessLevel, rubric, transcriptText, finalAllocations?, snapshots?, isRetry?, mismatchedCount? }` | `simulationGrading` |
| `socratic-hint.ts` | `ai.service.ts:1495-1502` (system) + `1505-1512` (user) | `{ scenario, objectives, deviatedDimensions, recentTranscript }` | `studyBuddy`（复用） |
| `quiz-short-answer-grade.ts` | `grading.service.ts:478-484` (system) + `485-490` (user) | `{ prompt, referenceAnswer, studentAnswer, maxPoints }` | `quizGrade` |
| `quiz-concept-tags.ts` | `grading.service.ts:449-450` (system) + `451-454` (user) | `{ questionPrompts: string[], totalCount }` | `quizGrade` |
| `quiz-question-tagger.ts` | `quiz-question-tagger.service.ts:64-67` (system) + `86-100` (user) | `{ questionsBlock, total }` | `questionAnalysis` |
| `subjective-grade.ts` | `grading.service.ts:559-571` (system) + `577-580` (user) | `{ evaluatorPersona?, strictnessLevel, prompt, referenceAnswer?, rubric, studentAnswerText }` | `subjectiveGrade` |
| `study-buddy-reply.ts` | `study-buddy.service.ts:195-207` (system multi-block) + `208` (user) | `{ mode, fallbackInstructions, materialInstructions, taskContext?, materialContext?, taskName?, conversationHistory }` | `studyBuddy` |
| `study-buddy-summary.ts` | `study-buddy.service.ts:385` (system) + `386-390` (user) | `{ count, questionsText }` | `studyBuddy` |
| `weekly-insight.ts` | `weekly-insight.service.ts:200-204` (system) + `223-260` (user) | `{ windowStart, windowEnd, submissions, upcomingSlots }` | `weeklyInsight` |
| `insights-aggregate.ts` | `insights.service.ts:334-338` (system) + `348-362` (user) | `{ instanceTitle, taskType, evaluations }` | `insights` |
| `scope-insights.ts` | `scope-insights.service.ts:603-606` (诊断 system) + `608-611` (user)<br/>+ `957-961` (advice system) + `963-966` (user) | 2 个 builder：`buildDiagnosisPrompt(...)` / `buildAdvicePrompt(...)` | `insights` |

### 增补（review-ai F-3 列表中其余 prompt）

| builder 文件 | 来源 inline prompt | opts 字段 | promptKey 映射 |
|---|---|---|---|
| `task-draft-from-context.ts` | `app/api/ai/task-draft/from-context/route.ts:219-225` (system, type-specific) + `254-307` (user) | `{ taskType, courseName, courseDescription?, chapterName, sectionName, taskName?, description?, teacherBrief?, sources }` | `taskDraft` |
| `task-draft-quiz.ts` | `app/api/ai/task-draft/quiz/route.ts:40` (system) + `41-65` (user) | `{ courseName, chapterName, prompt? }` | `quizDraft` |
| `task-draft-subjective.ts` | `app/api/ai/task-draft/subjective/route.ts:39` (system) + `40-55` (user) | `{ courseName, chapterName, prompt? }` | `subjectiveDraft` |
| `import-parse.ts` | `lib/services/import-job.service.ts:76-84` (system) + `85-102` (user) | `{ truncatedText }` | `importParse` |
| `course-knowledge-summary.ts` | `course-knowledge-source.service.ts:429` (system) + `430-443` (user) | `{ fileName, extractedText }` | `taskDraft` |
| `course-outline.ts` | `course-knowledge-source.service.ts:471` (system) + `buildOutlinePrompt`(`676-766` 整段 user) | `{ fileName, extractedText, compact: boolean }` | `taskDraft` |
| `question-bank.ts` | `question-bank.service.ts:527-563` (`buildSystemPrompt` 2 个 action) + `566-645` (`buildUserPrompt`) | `{ action, courseName, courseDescription, chapterName, sectionName, teacherBrief, sources, questions }` | `questionAnalysis`/`importParse` |
| `work-assistant.ts` | `ai-work-assistant.service.ts:163-176` (`systemPromptForTool` × 4 toolKey) + `178-222` (`userPromptForTool`) | `{ toolKey, materialText, teacherRequest, outputStyle, strictness, enableSearch, searchConfigured, fileReports }` | `lessonPolish`/`ideologyMining`/`questionAnalysis`/`examCheck`（多映射） |

### 共享文件

- `lib/ai/prompts/types.ts` — `PromptBuilder<TOpts>` 接口 + `BuiltPrompt` 类型 + `ToolKey` 联合：
  ```ts
  export interface BuiltPrompt {
    systemPrompt: string;
    userPrompt: string;
    /** 语义版本，prompt 内容变更应手动 bump（e.g. "v1" → "v2"） */
    version: string;
  }
  export interface PromptBuilder<TOpts> {
    (opts: TOpts): BuiltPrompt;
  }
  ```
- `lib/ai/prompts/index.ts` — barrel re-export + `PROMPT_TOOL_KEY_MAP` 把 builder name → AiToolDefinition.key 用于 ai-tool-settings preview 派生。

合计：**20 个 builder 文件 + 2 共享文件**（spec 写的"12 个 feature"是核心 service 的；review-ai F-3 完整列表含 route handler / question-bank / work-assistant / outline / import-parse 等，按 spec "其余按 review-ai F-3 列表补"扩到 20，与 review-ai 给出的 18 AI lines 一致）。

## 三、Builder 接口设计（plan 阶段问 coordinator 确认）

### Q1: builder opts 接口风格

**两条路线 + 我的建议：**

A. **业务 specific**（推荐 ✅）：每 builder 自己定义命名清晰的 opts interface，例如：
```ts
export interface SimulationChatOpts {
  systemPrompt?: string;
  scenario: string;
  objectives: string[];
  messageType: "user_message" | "config_submission";
  transcript: Array<{ role: string; text: string }>;
  allocations?: Array<{ label: string; items: Array<{ label: string; value: number }> }>;
}
export const buildSimulationChatPrompt: PromptBuilder<SimulationChatOpts> = (opts) => ({...});
```

B. 通用 `Record<string, unknown>` vars：每 builder 接收 free-form `{ vars: Record<string, unknown> }`。

**理由选 A**：
- finsim 项目惯例 service 层全用强类型 interface（CLAUDE.md 三层架构 + zod boundary），通用 vars 退化为"运行期检查 + cast"，违反"single source of truth"原则。
- TS 自动 narrow caller，重构期间 catch 字段漂移（譬如 caller 忘传 evaluatorPersona）。
- 与 review-ai F-3 的"prompt 应该是真 cross-cutting deep seam"匹配 — 强类型才是 deep。
- 唯一额外成本：每 builder 多 ~10 行 interface，但全部从现有 caller 参数自动 hoist，零设计成本。

### Q2: `version` 字面常量 vs hash

**两条路线 + 我的建议：**

A. **字面常量 `"v1"`**（推荐 ✅）：每 builder 文件顶部 `export const version = "v1"`，prompt 内容**人工**改动时手动 bump（"v1" → "v2"），由 snapshot test 强制 reviewer 看到 diff。

B. **content hash（sha256 of system+user prompt 前缀）**：自动检测漂移 → AiRun.promptVersion = "v1-a3f2c9"。

**理由选 A**：
- AiRun 数据库已经有 `promptHash`（review-ai F-3 / ai.service.ts:418 自动算 sha256）作为"内容指纹"。再加 `promptHash` 字段重复，违反 single source。
- `promptVersion` 的语义是"业务层显式标注的 prompt 契约版本"，hash 是"实际运行内容的指纹"。两者职责不重叠。
- 字面常量手动 bump → 配 snapshot test → 任何修改强制 reviewer 看到 + 主动决定是否 bump → "改 prompt 不 bump version" 这种 mistake 必在 PR review 暴露。
- 这与 spec 写的"version: 'v1'"字面一致。

如果后期想升级到内容 hash 自动派生，作为下一 PR 优化（先解决散落问题更紧迫）。

### Q3: basePromptPreview 长度

**两条路线 + 我的建议：**

A. **真 prompt 全文**：preview = `buildXxxPrompt({...stub}).systemPrompt`。

B. **截取前 N 字 + 省略号**（推荐 ✅，N = 300）：preview = `truncate(builder({...stub}).systemPrompt, 300)`。

**理由选 B**：
- 教师 UI（`/teacher/ai-settings`）每个 tool 一个卡片显示 preview，全文几百字会撑爆 UI（simulation-chat 系统 prompt ≈ 1400 字）。
- 300 字够老师看清"AI 身份 / 任务 / 核心规则"，决定是否加 `systemPromptSuffix` 调整。
- 截断点设计：尾部加 `\n…（共 N 字，完整 prompt 由系统在运行时拼接）`，明示是节选。
- 在 `ai-tool-settings.service.ts` 增一个 `truncatePromptPreview(s: string, n: number = 300)` helper，集中。

如果用户希望"truncate 长度更激进"或"完整 prompt 在 UI 用 expander"，回头改 helper 一处即可。

### Q4: D builder 未 merge 时的 commit 协调

D 候选改 `audit.service.ts`（rename `logAuditForced` → `logAuditEvent`，加 `actorRole`），可能也在 `ai.service.ts` 加 audit；我会改 `ai.service.ts` 内 inline prompt 替换。两者在同一文件不同段（D 在新增 audit 调用 / 我在替换 prompt 字符串）。

**协调策略：**
- 我在 worktree（pr1-ai-prompts）独立工作，不动 ai.service.ts 内 audit 段（如果 D 加了）。
- 提交独立 commit，rebase 时若与 D 撞 hunk：保留 D 的 audit 调用 + 我的 prompt builder 调用（语义独立可合并）。
- coord 整合时按 spec 风险登记 P5 建议序：**A → D → I+J → E**，E 最后 rebase，碰撞概率最低。
- 如果 D 在我之前 commit，我 rebase 时手动 merge `ai.service.ts` 段；如果我先 commit，D 后做 rebase。

不需要 plan 阶段额外动作；按 coord 调度执行。

## 四、实现步骤（小步逐 builder，pattern 确定后批量）

### Step 1 — 骨架（先 1 builder 验证）

1. 建 `lib/ai/prompts/types.ts` + `index.ts` 空骨架。
2. 实现 `simulation-chat.ts`（最长 + 最复杂，验证 opts 设计能 hold 住）：
   - 把 ai.service.ts:1001-1103 的 `buildChatPrompts` 内 `personaPrompt` / `systemPrompt` / `userPrompt` 三段移到 `lib/ai/prompts/simulation-chat.ts`，字字不变（不重新缩进、不重新换行）。
   - `version = "v1"`。
3. `ai.service.ts` 的 `buildChatPrompts` 改成调 `buildSimulationChatPrompt`。
4. 写 `tests/ai-prompts/simulation-chat.snapshot.test.ts`：
   ```ts
   const r = buildSimulationChatPrompt({ scenario: "...", objectives: [...], messageType: "user_message", transcript: [] });
   expect(r.systemPrompt).toMatchSnapshot();
   expect(r.userPrompt).toMatchSnapshot();
   expect(r.version).toBe("v1");
   ```
5. 跑 `npx tsc --noEmit` + 跑这 1 个 test。
6. 验证 ai-tool-settings preview 派生：`getToolPromptPreview("simulationChat")` 返回 truncate 后的 systemPrompt 前 300 字。

### Step 2 — 批量（pattern 确定后）

按表格顺序剩余 19 个 builder + caller 替换；每 builder 一个 snapshot test。

### Step 3 — AiRun.promptVersion 真版本

修改 `ai.service.ts` 的 `aiGenerateText` / `aiGenerateJSON` 签名：
- 新增可选 `options.promptVersion?: string`，caller 传 `version` 字段。
- `createAiRun` 把 `promptVersion: input.promptVersion ?? "v1"`（fallback 兼容未迁移调用）。
- 所有迁移到 builder 的 caller 传 `promptVersion: VERSION`。

不破坏向后兼容（未迁移调用走默认 "v1"），D builder 加新 caller 也无需感知。

### Step 4 — `AI_TOOL_DEFINITIONS.basePromptPreview` 派生

`ai-tool-settings.service.ts`：
- 删除 16 处手写 `basePromptPreview` 字符串。
- 改 `AiToolDefinition` interface：`basePromptPreview` 由 getter / 计算属性 / 或一个 `getPromptPreview(toolKey)` 函数派生。最干净：
  ```ts
  // 新方法：
  export function getToolPromptPreview(toolKey: string): string {
    const builder = TOOL_KEY_TO_PROMPT_BUILDER[toolKey];
    if (!builder) return "（预览暂不可用）";
    return truncatePromptPreview(builder(STUB_OPTS[toolKey]).systemPrompt, 300);
  }
  ```
- `listAiToolSettings` 调用 `getToolPromptPreview(definition.key)` 填入返回的 row。

每 toolKey 一组 stub opts（最少必填字段，prompt 能完整渲染）。

### Step 5 — 全量验证

- `npx tsc --noEmit` 全过。
- `npx vitest run` 全过，新加 20 组 snapshot test 全过。
- 跑现有 `tests/ai-evaluation-prompt-contains-concept-tags.test.ts` — 此 test grep `ai.service.ts` 找 conceptTags 字段，prompt 搬走后会 fail；改 test 的 ROOT 路径到 `lib/ai/prompts/simulation-evaluate.ts` + `grading.service.ts`（subjective）+ 新 `lib/ai/prompts/subjective-grade.ts`。
- 跑现有 `tests/pr-sim-3-config-submission.test.ts`（review-ai F-4 提到的 grep 测试）— 同样改路径。

### Step 6 — 真浏览器验证（spec acceptance #6）

(builder 写完报告交 QA；QA 跑 `/qa-only` 真浏览器：molly 登录 → `/teacher/ai-settings` → 看到 simulationChat 卡片 basePromptPreview 段，与运行时 simulation chat 的 system prompt 第一段对照一致。)

## 五、Snapshot test 策略

- 每 builder 一组 snapshot test（`tests/ai-prompts/{feature}.snapshot.test.ts`）。
- 每组 ≥ 2 测试：
  1. **默认 opts**：最少必填，验证基础结构。
  2. **关键变体**：例如 simulation-chat 有 `messageType: "config_submission"` + allocations，要看注入块正确出现。
- snapshot 文件提交 git（vitest 默认行为）— 任何 prompt 字符变更让 reviewer 在 PR diff 看到。
- prompt 内容由 builder 输入决定（zero 随机性 / zero 当前时间），snapshot 不需要 freeze date。

## 六、风险与缓解

| 风险 | 缓解 |
|---|---|
| Prompt 字符意外漂移（缩进 / 换行误改） | snapshot test 立即暴露；review 看 diff |
| 与 D builder 撞 ai.service.ts 改动 | spec 风险登记里 E 排序最后；rebase 时手动合并语义不冲突 |
| `mergeSystemPrompt(systemPrompt, setting)` 中 setting.systemPromptSuffix 仍 append 到 builder 输出后部 → preview 不显示 suffix 部分 | preview 是"base prompt"（运行时 + suffix），与 `mergeSystemPrompt` 行为一致。教师 UI 卡片下方已有"附加指令"输入框给 suffix。无回归。 |
| 现有 prompt 内嵌 `${data.evaluatorPersona || "..."}` 这种 fallback 逻辑 | builder opts 保留 fallback；prompt 字符不变 |
| `evaluateSimulation` 内有 retry hint append 到 userPrompt（"上一轮你引用的..."），不是初始 prompt 一部分 | builder 提供独立 helper `buildEvidenceRetryHint(mismatchedCount)`，caller 自行拼接 — 不进 snapshot test 主体（边缘情形单独测） |
| AI subsystem map 中 18 个 AI line vs 20 个 builder file（多 2 个） | scope-insights 有 2 个 prompt（diagnosis + advice）拆 2 个 builder；不算 inflation。 |

## 七、不动的边界

- D 候选 scope：`audit.service.ts` / `audit-` rename / actorRole 字段。
- A 候选 scope：`tests/_fixtures/`、`playwright.config.ts`、CI workflow。
- I+J 候选 scope：`schema.prisma` / TaskInstanceAnalytics / Visibility enum / dead columns。
- 不动 ai.service.ts 其他逻辑（rate-limit / cost / provider / mood mapping）。
- 不动 AI provider 决策。
- 不动 zod schema / 业务参数 / metadata 字段。

## 八、Done 标准

1. `npx tsc --noEmit` 0 new error。
2. `npx vitest run` 全过（含 20 组新 snapshot test）。
3. `npm run lint` 0 error。
4. Diff < 1500 行（spec acceptance #4）。
5. 16 处 `basePromptPreview` 字面字符串删除（grep 验证）。
6. 35 处 inline prompt 全部 migrate 到 builder（grep `"你是"` 在 `lib/services/` 应只剩 builder 引用，不再有 inline）。
7. `AiRun.promptVersion = "v1"` 硬编码删除，改为 caller 传入。
8. 写 build 报告 `.harness/reports/build_pr1_ai-prompts_r1.md`，SendMessage coord。
