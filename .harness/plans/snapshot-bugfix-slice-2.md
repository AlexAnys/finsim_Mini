# Slice 2 — B1 UI buildPatchBody 发 null

## 范围

仅改 `components/instance-detail/snapshot-edit-sheet.tsx` 的 `buildPatchBody` 函数。

## 问题

Slice 1 之后 service 支持 `null` = clear；但 UI 还是发 undefined → JSON 丢字段 → service 不清。

## 修复策略

- export `buildPatchBody` 让测试直接调用（纯函数，零副作用）
- 对清空字段：state 中 `undefined` / `""` → patch body `null`
- 受影响字段：
  - simulation: `dialogueRequirements`
  - quiz: `timeLimitMinutes`, `maxQuestions`, `startDifficulty`, `difficultyStep`
  - subjective: 无清空场景（prompt 必填；allowTextAnswer 是 bool）

## RED test（新文件 `tests/snapshot-edit-form-clear.test.ts`）

调用 `buildPatchBody("quiz", { mode: "fixed", timeLimitMinutes: undefined, ... })`，断言：
- `body.quizConfig.timeLimitMinutes === null`（不是 undefined）

预期 FAIL（当前实现：`timeLimitMinutes: q.timeLimitMinutes`，undefined 在 JSON.stringify 时被 drop）。

## GREEN

```ts
// 旧:
timeLimitMinutes: q.timeLimitMinutes,
// 新:
timeLimitMinutes: q.timeLimitMinutes ?? null,
```

simulation 的 `dialogueRequirements`：旧 `s.dialogueRequirements || undefined`，新 `s.dialogueRequirements?.trim() ? s.dialogueRequirements : null`。

## 不动

- service / schema（Slice 1 已 done）
- subjective form（无清空场景）
- 其它 UI

## Acceptance

- 新测试 PASS
- 全 suite 0 regression
- tsc / lint 0 errors
- service 收到 null 时 clear（Slice 1 已验过，单独 e2e 不必）
