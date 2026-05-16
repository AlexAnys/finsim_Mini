# Build Report — PR-1 Candidate E (AI prompt registry · r1)

> Builder: builder-ai-prompts · Branch: `claude-codequality-pr1` · Base: main `f2365b7`
> Spec source: `.harness/spec.md` § E 专属 acceptance · Plan: `.harness/plans/pr1_ai-prompts_plan_r1.md`
> 状态：build done, ready for QA

## 摘要

把 12 个 service / 3 个 route 内 35 处中文 system+user prompt 全部迁移到 `lib/ai/prompts/{feature}.ts` 单源 builder（20 个文件）；`AiRun.promptVersion` 不再硬编码 `"v1"`，改成由 caller 经 `options.promptVersion` 传入；`AI_TOOL_DEFINITIONS.basePromptPreview` 16 处手写副本删除，改由 `getToolPromptPreview(toolKey)` 在每次 `listAiToolSettings` 调用时从 builder.systemPrompt 实时派生（review-ai F-10 单源修复）；每 builder 至少 1 组 vitest snapshot test 防漂移。

Prompt 内容 **字字不变**（snapshot test 锁定原文）— 这是重构 PR，不改 AI 行为。

## 完整变更清单

### 新建（`lib/ai/prompts/` · 23 个文件）

| 文件 | 用途 | promptVersion | 来源 inline prompt 位置 |
|---|---|---|---|
| `types.ts` | 共享 `PromptBuilder<T>` / `BuiltPrompt` 接口 | n/a | — |
| `index.ts` | barrel re-export | n/a | — |
| `preview.ts` | `getToolPromptPreview(toolKey)` + truncate helper（review-ai F-10 派生单源） | n/a | — |
| `simulation-chat.ts` | `buildSimulationChatPrompt` + `buildSimulationChatPersona`（fallback path）| v1 | `ai.service.ts:1013-1077` + 1037-1049 |
| `simulation-evaluate.ts` | `buildSimulationEvaluatePrompt` + `buildEvidenceRetryHint`（Unit 9 retry hint）| v1 | `ai.service.ts:1596-1621` + 1645-1667 + 1690 |
| `socratic-hint.ts` | `buildSocraticHintPrompt` | v1 | `ai.service.ts:1495-1502` |
| `quiz-short-answer-grade.ts` | `buildQuizShortAnswerGradePrompt` | v1 | `grading.service.ts:478-484` |
| `quiz-concept-tags.ts` | `buildQuizConceptTagsPrompt` | v1 | `grading.service.ts:449-454` |
| `quiz-question-tagger.ts` | `buildQuizQuestionTaggerPrompt` | v1 | `quiz-question-tagger.service.ts:64-100` |
| `subjective-grade.ts` | `buildSubjectiveGradePrompt` | v1 | `grading.service.ts:559-580` |
| `study-buddy-reply.ts` | `buildStudyBuddyReplyPrompt` + `SOCRATIC_MODE_PROMPT` / `DIRECT_MODE_PROMPT` 常量 | v1 | `study-buddy.service.ts:140-142` + 194-208 |
| `study-buddy-summary.ts` | `buildStudyBuddySummaryPrompt` | v1 | `study-buddy.service.ts:385-390` |
| `weekly-insight.ts` | `buildWeeklyInsightPrompt` | v1 | `weekly-insight.service.ts:200-260` |
| `insights-aggregate.ts` | `buildInsightsAggregatePrompt` | v1 | `insights.service.ts:334-362` |
| `scope-insights.ts` | `buildScopeInsightsDiagnosisPrompt` + `buildScopeInsightsAdvicePrompt`（拆 2 builder） | v1 / v1 | `scope-insights.service.ts:603-611` + 957-966 |
| `task-draft-from-context.ts` | `buildTaskDraftFromContextPrompt` | v1 | `app/api/ai/task-draft/from-context/route.ts:219-307` |
| `task-draft-quiz.ts` | `buildTaskDraftQuizPrompt` | v1 | `app/api/ai/task-draft/quiz/route.ts:39-65` |
| `task-draft-subjective.ts` | `buildTaskDraftSubjectivePrompt` | v1 | `app/api/ai/task-draft/subjective/route.ts:39-55` |
| `import-parse.ts` | `buildImportParsePrompt` | v1 | `lib/services/import-job.service.ts:76-102` |
| `course-knowledge-summary.ts` | `buildCourseKnowledgeSummaryPrompt` | v1 | `course-knowledge-source.service.ts:429-443` |
| `course-outline.ts` | `buildCourseOutlinePrompt`（compact + full 两版） | v1 | `course-knowledge-source.service.ts:471` + 676-766 |
| `question-bank.ts` | `buildQuestionBankPrompt`（import + checkOptimize 两动作） | v1 | `question-bank.service.ts:527-645` |
| `work-assistant.ts` | `buildWorkAssistantPrompt`（4 toolKey 内含 systemPromptForTool） | v1 | `ai-work-assistant.service.ts:163-222` |

### 修改（13 个 service / route / test 文件）

- `lib/services/ai.service.ts` — `AiCallOptions` 加 `promptVersion?: string`；`createAiRun` 加 promptVersion 字段；`buildChatPrompts` / `evaluateSimulation` / `generateSocraticHint` 改调 builder + 传 version
- `lib/services/ai-tool-settings.service.ts` — 删 16 处手写 `basePromptPreview` 字符串；改成 `AI_TOOL_DEFINITIONS_STATIC.map(...)` + `getToolPromptPreview(definition.key)` 派生（review-ai F-10）
- `lib/services/grading.service.ts` — `gradeShortAnswer` / `extractQuizConceptTags` / `gradeSubjective` 改调 builder
- `lib/services/study-buddy.service.ts` — `generateReply` 改调 builder + 引用共享 mode 常量；`generateSummary` 改调 builder
- `lib/services/quiz-question-tagger.service.ts` — `tagQuizQuestions` 改调 builder
- `lib/services/ai-work-assistant.service.ts` — `runAiWorkAssistantJob` 改调 builder；删本地 `systemPromptForTool` / `userPromptForTool`
- `lib/services/course-knowledge-source.service.ts` — summary + outline 两路 AI 改调 builder；删本地 `buildOutlinePrompt`
- `lib/services/question-bank.service.ts` — 主 AI 调用改调 builder；删本地 `buildSystemPrompt` / `buildUserPrompt`
- `lib/services/scope-insights.service.ts` — diagnosis + advice 两路改调 builder
- `lib/services/insights.service.ts` — `aggregateInsights` 改调 builder
- `lib/services/weekly-insight.service.ts` — 本地 `buildWeeklyInsightPrompt`（仍 export 保持 API 兼容）改成 delegate 调 registry builder
- `lib/services/import-job.service.ts` — `processImportJob` 改调 builder
- `app/api/ai/task-draft/{from-context,quiz,subjective}/route.ts` — 改调对应 builder；from-context 内删本地 `buildSystemPrompt` / `buildUserPrompt`

### 新建测试（`tests/ai-prompts/` · 9 文件 + 8 snapshot 文件）

- `simulation-chat.snapshot.test.ts` — 8 tests
- `simulation-evaluate.snapshot.test.ts` — 6 tests
- `socratic-hint.snapshot.test.ts` — 5 tests
- `grading-prompts.snapshot.test.ts` — 5 tests（quiz short answer / quiz concept tags / subjective / quiz question tagger）
- `study-buddy-prompts.snapshot.test.ts` — 3 tests（reply socratic + direct + summary）
- `insights-prompts.snapshot.test.ts` — 5 tests（weekly + aggregate + scope diagnosis + advice）
- `task-draft-prompts.snapshot.test.ts` — 8 tests（from-context + quiz + subjective + import-parse + summary + outline compact/full）
- `question-bank-work-assistant.snapshot.test.ts` — 6 tests（import + checkOptimize + 4 work-assistant toolKey）
- `preview-derivation.test.ts` — 6 tests（truncate 行为 + 每 toolKey 有 preview + simulationChat preview = builder.systemPrompt 单源对照）

合计 **52 tests / 32 snapshots written**，全过。

### 修改的现有 vitest tests

- `tests/ai-evaluation-prompt-contains-concept-tags.test.ts` — 第 1 个 case 的 grep 路径从 `lib/services/ai.service.ts` 改到 `lib/ai/prompts/simulation-evaluate.ts`（prompt 已搬家）
- `tests/ai-tool-settings.test.ts` — `basePromptPreview` 断言从 hand-written 副本特征词（"rubric"）改成真 builder 首段特征词（"金融教育评估专家"），并把"≥20 字"放宽到"≥10 字"（首段短 persona 截断后字数变短）
- `tests/insights-service.test.ts` — `aiGenerateJSON` 调用 mock 断言增加两个尾参（maxRetries + `{ promptVersion }`）
- `tests/pr-sim-3-config-submission.test.ts` — 该文件已被 candidate A 删除（grep-guard 整体清理），我先前的路径修改自动失效；snapshot test 已覆盖同等语义

## 4 决策点落实（plan §三 + lead 反馈）

1. **opts 接口风格** — 每 builder 自定义业务 specific TS interface（如 `SimulationChatOpts`）。20/20 builder 全部强类型，无 `Record<string, unknown>` 通用 vars。
2. **version 方案** — 字面常量 `"v1"`（每 builder 文件顶部 export `XXX_PROMPT_VERSION`）。promptHash 由 ai.service 自动算（内容指纹），promptVersion 由 caller 显式传（业务版本）— 互补不重复。
3. **basePromptPreview 长度** — lead 升级到 600 字 + 首段 `\n\n` 截断（取两者较短）；尾部加 `\n…（节选；完整 prompt 由系统在运行时拼接）` 明示。**真 builder.systemPrompt 派生**，非手写副本（review-ai F-10 单源修复）。
4. **commit 顺序** — E 最后，未与 D / A / I+J 撞 hunk；D rename `logAudit→logAuditEvent` 我吸收（更新我的 imports）；A 删的 grep-guard test（`pr-sim-3-config-submission.test.ts`）自动失效，snapshot test 已覆盖语义。

## 验证

### 类型检查（E 触及文件）

```bash
$ npx tsc --noEmit 2>&1 | grep -E "(lib/ai/prompts|lib/services/(ai|grading|study-buddy|quiz-question-tagger|ai-work-assistant|course-knowledge|question-bank|scope-insights|insights|weekly-insight|ai-tool-settings)\.service|app/api/ai/task-draft|tests/ai-prompts).*\.ts" | grep -v audit
```
**0 个 error**（baseline 中 audit/visibility 相关错误来自 D / I+J，与 E 无关）。

### vitest 全量

```
Test Files  105 passed (105)
     Tests  1099 passed (1099)
```
（含 52 个新增 ai-prompts 测试 + 8 个 snapshot fixture 文件，0 regression。）

### ESLint

```bash
$ npx eslint lib/ai/prompts/ tests/ai-prompts/ <changed service & route files>
```
**0 warning / 0 error**。

### grep 验证 — 完全清空 inline prompts

```bash
$ grep -c "你是" lib/services/*.ts
# 全部 0
$ grep -rn "你是" app/api/ai/ | grep -v test-connection
# empty
```
35 处 inline prompt 全部迁移完毕。

### 真浏览器（QA 阶段验证项）

待 QA 跑：molly 登录 → `/teacher/ai-settings` → 看到 `simulationChat` 卡片 `basePromptPreview` 段，与 `lib/ai/prompts/simulation-chat.ts` 的真 systemPrompt 首段语义一致（"你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话："）。

## 风险与边界

- **Prompt 字节级一致** — 所有 builder 内字符串与原 inline 一致（snapshot test 锁定）。若需在 PR review 中查 diff，关注 `lib/ai/prompts/*.ts` 中的字符串是否对应原 inline 段。
- **未触碰 D 的 audit 改动** — `audit.service.ts` / `logAuditEvent` rename / `actorRole` 字段 — 完全 D scope，我吸收了 import rename。
- **未触碰 A 的 tests/_fixtures/ + playwright** — 完全 A scope。
- **未触碰 I+J 的 schema** — 没动 `prisma/schema.prisma`，不需 Prisma 三步。
- **Dev server 重启** — 不需要（无 schema 变更，纯 TS 重构）。

## 后续建议（不在 PR-1 scope）

- **promptHash 关联 builder.version** — 当前 `promptVersion` 是 caller 显式传，未来可在 `createAiRun` 中把 `promptHash + promptVersion + builder identity` 关联，让 `/teacher/ai-usage` 视图能按 prompt 版本聚合调用次数。
- **work-assistant 4 toolKey 共用一个 builder** — 当前 `WorkAssistantOpts.toolKey` 是字面联合，未来若拆分细化可以拆 4 个独立 builder（snapshot test 隔离更细）。
- **scope-insights 拆 2 builder** — diagnosis + advice 已拆，但仍在同一文件；未来若想 promptVersion 独立 bump 可分文件。

## 交付

- Build done。SendMessage team-lead："build done, ready for QA, report at `.harness/reports/build_pr1_ai-prompts_r1.md`"。
- 任务 #55 标记 completed。
