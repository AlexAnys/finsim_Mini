# build_snapshot-bugfix-slice-2.md

## Task

Slice 2 (Task #10): B1 UI 端 — buildPatchBody 在用户清空字段时显式发 `null`（不再让 JSON.stringify drop undefined → 服务端 keep 旧值）。

## RED

新文件 `tests/snapshot-edit-form-clear.test.ts`，5 测试：
- quiz: state.timeLimitMinutes/maxQuestions/startDifficulty/difficultyStep = undefined → body.quizConfig.* === null
- quiz: 有值的字段仍按值发
- simulation: dialogueRequirements = "" / "   " → body.simulationConfig.dialogueRequirements === null
- simulation: 有内容仍按值发

**RED 阶段结果**: 5/5 FAIL — `buildPatchBody is not a function`（函数未 export）。

## GREEN

`components/instance-detail/snapshot-edit-sheet.tsx`:

1. `function buildPatchBody` → `export function buildPatchBody`
2. simulation 分支: `dialogueRequirements: s.dialogueRequirements || undefined` → `s.dialogueRequirements.trim() ? s.dialogueRequirements : null`（trim 处理只空格的情况）
3. quiz 分支: `timeLimitMinutes: q.timeLimitMinutes` 等 4 个字段 → `q.timeLimitMinutes ?? null`

subjective 分支无可清空字段（prompt 必填、allowTextAnswer 是 bool、allowedAttachmentTypes 是数组），不动。

## 验证

| 检查 | 结果 |
|---|---|
| 新 5 测试 PASS | ✅ |
| 全 vitest suite | ✅ 107 / 1123（Slice 1 后 baseline 106 / 1118 → +1 file / +5 tests, 0 regression）|
| `npx tsc --noEmit` | ✅ 0 errors |
| eslint touched files | ✅ 0 errors / 0 warnings |
| 旧 `instance-snapshot-edit-sheet.test.ts` | ✅ 仍通（buildPatchBody 形状测试不依赖 export，只 grep `taskType: "simulation" as const` 等）|

## 改动文件

- `components/instance-detail/snapshot-edit-sheet.tsx` — 3 处 buildPatchBody 改动 + export 关键字
- `tests/snapshot-edit-form-clear.test.ts` — 新建, 78 行, 5 测试
- `.harness/plans/snapshot-bugfix-slice-2.md`
- `.harness/reports/build_snapshot-bugfix-slice-2.md`

## 不动 / 延后

- service / schema（Slice 1 已 done，已支持 null=clear）
- subjective form（无清空场景）
- 其他 UI / E2E

## 不确定 / 注记

- `buildPatchBody` 被 `export` 出来后只是为测试可访问；UI 内部 `doSave` 通过闭包仍用同一函数，无 caller 变更。
- "use client" 文件 export pure function 在 vitest node 环境是合法的（之前其它项目里也有同款）；vitest 测试已 PASS 证明。
- dev server 不需要重启（仅 client 组件改动）。

## 下一步

等 coordinator 验过后做 Slice 3（B2 audit log for snapshot update）。
