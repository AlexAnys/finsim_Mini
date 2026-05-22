# Slice 1 — B1 service null=clear 语义

## 范围

仅 service + schema 层。UI 改动在 Slice 2。

## 问题（review-pr13 F-3）

教师在 Sheet 把 "限时 30 分钟" 清空 → `state.timeLimitMinutes = undefined` → JSON.stringify 丢字段 → service 浅 merge → `currentQuiz.timeLimitMinutes` 仍是 30。**清空操作无效。**

## 修复策略

- `null` = clear（service 显式 delete from merged snapshot）
- `undefined` = keep（service 不动；当前行为保留）

## RED test（新文件 `tests/instance-snapshot-clear-semantics.test.ts`）

1. **schema**: `quizConfig.timeLimitMinutes: null` `safeParse` 应 success
2. **service**: 调用 `updateTaskInstanceSnapshot` 传 `quizConfig.timeLimitMinutes: null`，期望 merged snapshot 不含 timeLimitMinutes 键

## GREEN 改动

- `lib/validators/task.schema.ts`: 把 `simulationConfig` / `quizConfig` / `subjectiveConfig` 内 optional 标量字段 schema 改为 `z.union([..., z.null()]).optional()`
  - `simulationConfig`: `dialogueRequirements`, `studyBuddyContext`, `evaluatorPersona`, `systemPrompt`
  - `quizConfig`: `timeLimitMinutes`, `maxQuestions`, `startDifficulty`, `difficultyStep`
  - `subjectiveConfig`: `referenceAnswer`, `evaluatorPersona`
- `lib/services/task-instance.service.ts`: 三态合并分支内对每个 patch 子字段处理 `=== null` → `delete merged[key]`

## 不动

- Prisma schema
- UI（Slice 2 处理）
- async-job.service
- 其它服务

## 测试

- baseline: 105 files / 1110 tests (已确认)
- RED: 加新文件 → 新文件内某测试 FAIL
- GREEN: 同测试 PASS + 全 suite 0 regression

## Acceptance

- new test file passes (~3-5 测试)
- full vitest still green, baseline + new = 1110 + N
- tsc clean
