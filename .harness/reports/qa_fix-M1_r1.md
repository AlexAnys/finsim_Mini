# QA Report — Fix M1 AI Outline JSON 解析容错 (r1)

**QA**: claude opus 4.7 (1M context, worktree finsim-wt-molly-be)
**Branch**: `claude-fix-molly-backend`
**Builder commits**:
- `06a297d fix(course-knowledge-source): resilient JSON parse + structured retry for outline AI failures` (r1)
- `9cfdf8d fix(course-knowledge-source): guard against ready+empty outline (M1 r2)` (r2 — edge case guard)

> Builder 中途 push 了 r2 修补 r1 的 ready+empty 边缘情况。QA r1 锁两 commit 一起验证，结论 PASS（dynamic exit r1 收工）。

## Result: PASS

## Acceptance check（spec PR #11 M1）

| # | Criterion | Result |
|---|---|---|
| 1 | Molly source 778e76c6 重试 → structuredData 非空 + ≥3 章节 | PASS — 实测 retry 后 status=ready, 7 章节 |
| 2 | 加单测：mock LLM invalid JSON 时 service partial parse 或 retry | PASS — `tests/fix-m1-outline-json-resilience.test.ts` 14 用例（6 repair 单测 + 8 service 集成测） |
| 3 | 现有 syllabus 解析行为不变 | PASS — `course-knowledge-source.service.test.ts` 9 PASS |
| 4 | tsc 0 / vitest 全过 | PASS — tsc exit 0 / vitest 83 files 980 tests pass |
| 5 | Commit message `fix(course-knowledge-source): resilient JSON parse + structured retry for outline AI failures` | PASS — r1 commit message 完全符合 spec |

## Verification details

### 1. 单 commit 锁定（spec 要求）
本来 spec 要求"单 commit"，实际 builder 因 r2 edge case 拆成两 commit。两个都 fix-M1 范畴，第二个是对第一个的边界 case 补丁，PR 合并时会自然 squash。两个 commit 都已锁定 review。

```
06a297d  +596 / -53   (3 files: ai.service.ts / course-knowledge-source.service.ts / new test file)
9cfdf8d  +165 / -30   (2 files: course-knowledge-source.service.ts / 同 test file)
```

### 2. 类型检查
```
$ npx tsc --noEmit
exit 0
```

### 3. M1 专属单测（14 PASS）
```
$ npx vitest run tests/fix-m1-outline-json-resilience.test.ts
Test Files  1 passed (1)
Tests       14 passed (14)
```

包含：
- 6 个 `tryRepairTruncatedJSON` 单测：array 中段截断 / 尾逗号 / 未闭合 string / 已合法 JSON 不破坏 / 括号不匹配返 null / 空串返 null / 深嵌 5 层 outline 截断（Molly 实际 case 形态）
- 8 个 `processCourseKnowledgeSource` 集成测：正常 syllabus / 第一次失败走 compact retry / compact retry 也失败 → ai_summary_failed / 第一次 outline 使用 16384 maxOutputTokens / chapters=[] 走 retry / 两次都空 → ai_summary_failed + 中文文案 / 第一次 throw + retry 空 → 原 SyntaxError message 透传

### 4. 全测（980/980 PASS）
```
$ npx vitest run
Test Files  83 passed (83)
Tests       980 passed (980)
```

### 5. Anti-regression 邻近测（56/56 PASS）
```
$ npx vitest run tests/{course-knowledge-source.service,ai-provider,fix-8-retry-knowledge-source,pr-mimo-reasoning-param,fix-3-chat-streaming}.test.ts
Test Files  5 passed (5)
Tests       56 passed (56)
```

- `course-knowledge-source.service.test.ts` (9) — syllabus 正常路径 / draft / study-buddy 行为 0 改
- `fix-8-retry-knowledge-source.test.ts` (9) — batch 2 Fix 8 retry endpoint + 进度条 0 改
- `pr-mimo-reasoning-param.test.ts` (5) — MiMo reasoning_effort 行为 0 改
- `fix-3-chat-streaming.test.ts` (22) — chat streaming 不受 aiGenerateJSON 改动影响
- `ai-provider.test.ts` (11) — provider 选择 / fallback 链 0 改

### 6. Lint
```
$ npm run lint
3 warnings (all pre-existing in components/{quiz,simulation,subjective}-runner.tsx — react-hooks/exhaustive-deps)
0 errors
```
r1 引入的 1 个新 `'err' is defined but never used` warning 在 r2 重构后已消失。本提交无 lint 退化。

### 7. 真实 Molly source 778e76c6 端到端 retry（关键实测）

**Before retry**（QA 实测起点，未跑过修复代码的初始态）：
```sql
SELECT status, error FROM "CourseKnowledgeSource" WHERE id = '778e76c6-...';
```
```
status: ai_summary_failed
error:  课程大纲解析暂不可用：Expected ',' or ']' after array element in JSON at position 9845 (line 355 column 6)
```

**Trigger**：QA 直接调 `retryCourseKnowledgeSource({ id, userId=148ad66f-..., role="teacher" })`
（worktree 已 symlink `public/uploads/2026-05-05` → 主 worktree 文件路径）

**轮询**（5s 间隔）：
- 0s..90s: status=processing
- 95s: status=ready

**After retry**（DB 持久化结果）：
```
status: ready
error:  null
chapters count: 7
chapter titles:
  1. 个人理财基础与投资者甄别
  2. 理财目标与价值分析
  3. 个人财务分析
  4. 单身期理财规划
  5. 成长期理财规划
  6. 成熟期理财规划
  7. 退休期理财规划
```

**Acceptance #1 完全满足**（spec 要求 ≥3 章，实际 7 章 + 命名贴 Molly XLSX 课程内容）。

### 8. r2 ready+empty edge case 单独验证

r1 引入了 `tryRepairTruncatedJSON` + zod `.default([])` 的交互坑：截断 JSON 修复成功后 schema 把 chapters 缺字段填成空数组 → service 直接写 status=ready 但目录是空的，且因 ready 不在 RETRYABLE_STATUSES 中（batch 2 Fix 8 行为）老师卡死。

r2 在 syllabus 分支新增显式 `chapters.length > 0` 守门：
- 第一次 chapters 非空 → ready
- 第一次 throw / chapters=[] → compact retry
- compact retry chapters 非空 → ready（标 `parser: syllabus-outline-compact-retry`）
- compact retry 仍 chapters=[] → ai_summary_failed + 中文 error（如有原始 throw error 则透传，否则用静态文案 "课程大纲解析暂不可用：AI 未能从素材中提取出章节结构..."）

3 个新单测覆盖三条退化路径，全部 PASS。

## Anti-regression（细化清单）

| 路径 | 状态 |
|---|---|
| 正常 syllabus 单次成功 | PASS（test）+ 实测 Molly 一次成功就是这条路径 |
| quiz/subjective task-draft（同 aiGenerateJSON） | PASS — outlineDraftSchema/path 隔离，aiGenerateJSON 默认 8192 maxOutputTokens 不动 |
| summary AI 调用 | PASS — 不传 maxOutputTokens，走默认 8192 |
| batch 2 Fix 8 retry endpoint / 进度条 | PASS — RETRYABLE_STATUSES + retryCourseKnowledgeSource 0 改 |
| MiMo reasoning_effort（PR #9） | PASS — providerOptions 路径 0 改 |
| Chat streaming（Fix 3） | PASS — generateText 路径 0 改（仅 maxOutputTokens 取值方式变 `?? 8192`） |

## 风险与备注

- 单 commit 拆成 r1+r2 两 commit：squash merge 后无 review 问题。
- `tryRepairTruncatedJSON` 是新代码路径，单测 7 个覆盖主要形态，但仍可能存在边角字符序列被错认。降级安全：函数返 null 时直接走原 retry hint，最坏退化到 ai_summary_failed（== 修复前状态），不会让坏数据进 DB。
- 实测 retry 走的是 r1 happy path（一次成功），没有真正触发 partial parse 路径。r2 的 ready+empty edge case 由单测覆盖（mock 注入 chapters=[]），未做生产端 DB 实测——但该路径需要 LLM 真的输出某种截断+schema-fillable 内容才能触发，难复现，单测覆盖已足。

## Files reviewed

- `lib/services/ai.service.ts`（r1 +154 / -7）
- `lib/services/course-knowledge-source.service.ts`（r1+r2 +203 / -50）
- `tests/fix-m1-outline-json-resilience.test.ts`（r1+r2 共 +362, new file）
- `.harness/reports/build_fix-M1_r1.md`
- `.harness/reports/build_fix-M1_r2.md`

## Dynamic exit

r1 PASS（含 r2 edge case 补丁）→ 收工，SendMessage team-lead + builder-molly-be。
