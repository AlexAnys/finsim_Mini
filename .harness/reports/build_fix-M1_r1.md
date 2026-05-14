# Build Report — Fix M1 AI Outline JSON 解析容错 (r1)

**Builder**: claude opus 4.7 (1M context, worktree finsim-wt-molly-be)
**Branch**: `claude-fix-molly-backend`
**Commit**: `06a297d fix(course-knowledge-source): resilient JSON parse + structured retry for outline AI failures`
**Spec**: PR #11 M1

## Problem (recap)

Molly@qq.com 课程 `个人规划` 上传 `个人理财-课程标准-编码表.xls`（XLSX 5163 chars 抽取成功）后：
- `processCourseKnowledgeSource` 串行调 2 个 AI：summary（成功） + outline（失败）
- outline AI 在 MiMo `maxOutputTokens=8192` 下被截断，落地 `Expected ',' or ']' after array element in JSON at position 9845 (line 355 column 6)`
- DB `CourseKnowledgeSource` 写入 `status=ai_summary_failed` + `structuredData={}` + 中文 error
- 老师面板永久 stuck，「重新 AI 解析」按钮触发一模一样路径仍失败

根因：`aiGenerateJSON` 默认 8192 token 容不下深嵌 outline schema
（`chapters[].sections[].taskSuggestions[]` 5 层嵌套 + 多语言字段），MiMo 在
内容生成中段被切。`JSON.parse(extractedJSON)` 落 SyntaxError 后无修复路径，
直接 throw → catch 写 ai_summary_failed。

## Changes

3 files, +596 / -53。

### 1. `lib/services/ai.service.ts` — JSON resilience 基础设施

- `AiCallOptions` 加 `maxOutputTokens?: number`。调用方覆盖默认 8192；不传仍是 8192。
- 新增 `export function tryRepairTruncatedJSON(raw)`：单遍栈扫描修复"末端截断"
  - 跟踪 `{` / `[` / `"` 栈状态。
  - 在 `,` / `:` / `]` / `}` / 闭合 `"` / 容器开口处记录 lastSafeEnd。
  - 截断到 lastSafeEnd → trim trailing `,`/空白 → 末端 `:` 时补 `null` → 按
    剩余栈补齐 `]`/`}`/`"`。
  - JSON.parse 失败返回 null（caller 走 retry hint）。
  - 处理三类 case：array 中段截断、object 尾部 `,` 截断、未闭合 partial string
    （字段降级为 null）。
- `aiGenerateJSON` 内层 parse 失败时：若 SyntaxError → 调 repair → 重 parse；
  非 SyntaxError 或 repair 也失败 → 走原 retry hint 路径。
- `generateText` 的 `maxOutputTokens` 改用 `options.maxOutputTokens ?? 8192`。

### 2. `lib/services/course-knowledge-source.service.ts` — outline 长 schema 容错

- syllabus outline 调用：`maxOutputTokens: 16384`，保留 aiGenerateJSON 内部
  maxRetries=1。
- 首次失败时走结构化 compact retry：
  - `buildOutlinePrompt({ compact: true })` 截 extractedText 至 6000 字
    （比默认 16000 短 60%）+ 精简 schema 描述（去掉 taskSuggestions /
    learningGoals 等细分维度，只保留章节/小节核心结构）
  - metadata `parser: "syllabus-outline-compact-retry"` 标记本次走 retry
  - 仍失败才写 aiError → ai_summary_failed
- summary 调用、`RETRYABLE_STATUSES`、retry endpoint、quiz/subjective draft
  路径完全不动。

### 3. `tests/fix-m1-outline-json-resilience.test.ts` — 11 用例（全过）

**tryRepairTruncatedJSON 单测 7 个**：
- array 中段截断（Molly 实际 case 形态）
- object 中部 trailing `,` 截断
- 未闭合 partial string（字段降级为 null）
- 已合法 JSON 不被破坏
- 括号不匹配返回 null
- 空串返回 null
- 深嵌 outline 5 层嵌套截断（最关键 case）

**processCourseKnowledgeSource 集成测 4 个**：
- 正常 syllabus 单次 AI 成功，不走 compact retry
- 第一次 outline AI 失败 → 走 compact retry → 成功 → ready（断言 retry 参数
  含 `parser: syllabus-outline-compact-retry` + `maxOutputTokens: 16384`）
- compact retry 也失败 → `ai_summary_failed` + 中文 "课程大纲解析暂不可用"
- 第一次 outline 调用真的传了 `maxOutputTokens: 16384`

## Verification

### 单测
```
$ npx vitest run tests/fix-m1-outline-json-resilience.test.ts
Test Files  1 passed (1)
Tests       11 passed (11)
```

### 邻近测试 anti-regression
```
$ npx vitest run tests/{course-knowledge-source.service,ai-provider,fix-8-retry-knowledge-source,pr-mimo-reasoning-param,fix-3-chat-streaming}.test.ts
Test Files  6 passed (6) · Tests 67 passed (67)
```

### 全测
```
$ npx vitest run
Test Files  83 passed (83) · Tests 977 passed (977)
```

### 类型检查
```
$ npx tsc --noEmit
(no output, exit 0)
```

### 实测 Molly source 778e76c6
直跑 `processCourseKnowledgeSource("778e76c6-...", molly-teacher-id)`：
- BEFORE: `status=ai_summary_failed`, `structuredData={}`, error 含 "JSON at position 9845"
- AFTER (~88s): `status=ready`, **7 章节**全部解析成功，chapter titles 包括：
  - 投资者甄别与理财基础
  - 理财目标与价值计算
  - 个人财务分析
  - 单身期理财规划
  - 成长期理财规划
  - 成熟期理财规划
  - (再 1 章)
- `courseGoals: 1` 项

Acceptance #1（spec 要求 ≥ 3 章）满足，实际 7 章。

## Anti-regression

- `course-knowledge-source.service.test.ts` (9) PASS（既有 syllabus/draft/study-buddy 路径不动）
- `fix-8-retry-knowledge-source.test.ts` (9) PASS（batch 2 retry 端点行为完整保留）
- `pr-mimo-reasoning-param.test.ts` (5) PASS（MiMo reasoning_effort 行为不动）
- `fix-3-chat-streaming.test.ts` (22) PASS（chat streaming 不受 aiGenerateJSON 改动影响）
- `ai-provider.test.ts` (11) PASS（provider 选择 / fallback 链不变）

无新依赖（spec 明确禁止 `npm install`）。
无 prisma schema 改动。
无 route handler 改动（业务逻辑全在 service 层）。
中文 error 文案保留。

## Files touched

- `lib/services/ai.service.ts` (+154 / -7)
- `lib/services/course-knowledge-source.service.ts` (+162 / -46)
- `tests/fix-m1-outline-json-resilience.test.ts` (+297, new)

## Dynamic exit

r1 PASS — 单 commit 完成 M1，单测全过，molly 实测重解成功。

## Handoff to QA

QA 重点：
1. `git show 06a297d --stat` 确认 3 files 改动符合 spec
2. 跑 `npx vitest run tests/fix-m1-outline-json-resilience.test.ts`（11 PASS）
3. 跑 `npx vitest run`（977 全 PASS）
4. 跑 `npx tsc --noEmit`（0 错误）
5. （可选）实测 Molly source 778e76c6 重解：用 `await processCourseKnowledgeSource("778e76c6-0695-44f5-a11e-eb5cd38c695a", "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39")` 或调用 retry endpoint，验证最终 `status=ready` 且 chapters ≥ 3。**注意**：要 symlink `public/uploads/2026-05-05` 到主 worktree。
6. Anti-regression：确认 batch 2 Fix 8 retry endpoint、quiz/subjective task-draft、syllabus 正常路径不退化。
