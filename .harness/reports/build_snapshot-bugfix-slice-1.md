# build_snapshot-bugfix-slice-1.md

## Task

Slice 1 (Task #9): B1 service null=clear 语义。Schema + service 支持 patch 内某 key=null → service 显式 delete from snapshot。`undefined` 仍是 keep。

## RED

新文件 `tests/instance-snapshot-clear-semantics.test.ts`，8 测试：
- 5 个 schema 测试：simulation/quiz/subjective + discriminated union 接受 `null`
- 3 个 service 测试：null=clear (quiz/simulation) + undefined=keep（baseline）

**RED 阶段结果**: 7 FAIL / 1 PASS（"undefined keep" 已工作，预期）。
- schema 拒绝 null（4 测试）
- service 把 null 落库为 null 而非 delete（2 测试 — quiz / simulation）

## GREEN

### `lib/validators/task.schema.ts`

新增 3 个 patch-config schemas（不动 base 的 simulation/quiz/subjectiveConfigSchema，避免影响 create 路径）：
- `simulationConfigPatchSchema`: dialogueRequirements / studyBuddyContext / evaluatorPersona / systemPrompt 加 `.nullable()`
- `quizConfigPatchSchema`: timeLimitMinutes / maxQuestions / startDifficulty / difficultyStep 加 `.nullable()`
- `subjectiveConfigPatchSchema`: referenceAnswer / evaluatorPersona 加 `.nullable()`

3 个 `updateInstanceSnapshot*Schema` 改用 patch schemas 替换原 `.partial()`。

### `lib/services/task-instance.service.ts`

加 helper `applyClearSemantics(merged, patch)`：扫 patch 把 `value === null` 的 key 从 merged delete。

三态合并分支保留原 `{...currentSim, ...patch.simulationConfig}` spread（兼容 `instance-snapshot-update.test.ts` 的 grep 测试），在 spread 之后调 `applyClearSemantics` 清掉 null 键。

## 验证

| 检查 | 结果 |
|---|---|
| 新 test 8 个全 PASS | ✅ |
| 全 vitest suite | ✅ 106 files / 1118 tests passed（baseline 105 / 1110 → +1 file / +8 tests, 0 regression）|
| 旧 `instance-snapshot-update.test.ts` grep 测试 | ✅ pass（保留 `...currentSim` 等 spread）|
| `npx tsc --noEmit` | ✅ 0 errors |
| eslint on touched files | ✅ 0 errors, 0 warnings |

## 改动文件

- `lib/validators/task.schema.ts` (新增 ~25 行 patch schemas)
- `lib/services/task-instance.service.ts` (新增 ~12 行 helper + 3 处分支调用)
- `tests/instance-snapshot-clear-semantics.test.ts` (新建, 168 行, 8 测试)
- `.harness/plans/snapshot-bugfix-slice-1.md`
- `.harness/reports/build_snapshot-bugfix-slice-1.md`

## 不动 / 延后

- UI `snapshot-edit-sheet.tsx` — Slice 2 (Task #10) 改 buildPatchBody 发 null
- audit log（已存在，Slice 3 关注 reload-after-save）
- Prisma schema、async-job、其它服务

## 不确定 / 注记

- patch schemas 用了 `.partial().extend()`：Zod 在 extend 时 override 同名字段。已用 5 个 schema-level 测试断言 null 接受。
- service 把 spread 与 null 删除分两步走（不改 `...currentX` 信号，避免 break `instance-snapshot-update.test.ts` 现有 grep 断言）。
- dev server 不需要重启（仅 lib 改动，无 schema.prisma 改）。

## 下一步

等 coordinator 验过后做 Slice 2（UI buildPatchBody 发 null）。
