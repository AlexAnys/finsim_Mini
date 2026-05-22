# QA Report — snapshot-bugfix slice-1 (commit 8b4b9e5)

## Spec
review-pr13 F-3 — 教师在 Sheet Clear "限时 30 分钟" 等可选字段未生效。
Slice 1 范围：service 把 patch 中 `value === null` 当作"清空"指令，从 merged snapshot 删字段；schema 接受 null。

不在 Slice 1 范围（应保持未改动）：UI buildPatchBody、audit log、admin 路径、假占位按钮。

## Acceptance check

| # | Check | Verdict | Evidence |
|---|---|---|---|
| A1 | RED 真 FAIL（bug 真存在） | **PASS** | 临时把 `lib/services/task-instance.service.ts` + `lib/validators/task.schema.ts` revert 到 `8b4b9e5~1`，保留新测试文件跑 vitest：**7/8 FAIL, 1/8 PASS**（与 builder 报告完全吻合）。1 PASS 是 "undefined keep baseline" — baseline 行为就已经正确。 |
| A2 | GREEN 后真 PASS | **PASS** | `npx vitest run tests/instance-snapshot-clear-semantics.test.ts` → **8 tests PASS / 8 total** in 9ms |
| A3 | 全 suite 无 regression | **PASS** | `npx vitest run` → **106 files / 1118 tests PASS, 0 fail** (baseline 105/1110，新增 1 test file / 8 tests，与报告一致) |
| A4 | tsc --noEmit | **PASS** | 0 errors |
| A5 | lint | **PASS** | 0 errors, 34 warnings — 全部 pre-existing（unused eslint-disable / unused expect on e2e specs，与本 slice 改的两个文件无关） |
| A6 | service null=clear 语义实现正确 | **PASS** | `lib/services/task-instance.service.ts:63-71` 新增 `applyClearSemantics(merged, patch)`，遍历 patch 把 `v === null` 的 key 从 merged delete；在 3 个 dispatch 分支调用（simulation L426 / quiz L439 / subjective L452），均在浅 merge 之后跑。语义正确：null=delete，undefined=keep baseline。 |
| A7 | schema null 接受 | **PASS** | `lib/validators/task.schema.ts:147-165` 新增 3 个 patch schemas，对 10 个 optional 标量字段加 `.nullable().optional()`：sim {dialogueRequirements/studyBuddyContext/evaluatorPersona/systemPrompt}、quiz {timeLimitMinutes/maxQuestions/startDifficulty/difficultyStep}、subjective {referenceAnswer/evaluatorPersona}。原 `simulationConfigSchema/quizConfigSchema/subjectiveConfigSchema` 未动，create 路径不受影响（架构上正确隔离）。 |
| A8 | 不超 scope — 不动 audit/admin/UI/假按钮 | **PASS** | `git show 8b4b9e5 --name-only` 仅 5 文件：service / schema / 新测试 / 2 harness 文档。`grep "logAuditEvent\|isAuthorizedForInstance" lib/services/task-instance.service.ts` 与 prev commit 完全一致（行号 3/52/185/270/288/305/318/338/348/368/378/411/477，未改），audit log 调用 L477-488 是 PR-13 PR-1 D 已有代码。**未触** app/(teacher)/、app/api/admin/、UI 按钮文件。 |
| A9 | finsim-specific（中文 UI / Service 层分离 / API 格式） | **PASS** | 本 slice 仅改 Service + Validator，未碰 Route Handler 与 UI；service 错误经现有 `handleServiceError()` 仍正常映射。无中文文案变动。 |
| A10 | Commit message 清晰 | **PASS** | `fix(snapshot): null=clear 语义（service + schema）` + 详细 body 列了根因（state.timeLimitMinutes=undefined→JSON 丢字段→service 浅 merge 保留旧值）、改动清单、设计权衡（不动 base schema 避免影响 create 路径）、baseline 数字 |

## RED 验证手法（如何确认 bug 真存在）

1. 备份新测试文件到 `/tmp/slice1-test-backup.ts`
2. `git checkout 8b4b9e5~1 -- lib/services/task-instance.service.ts lib/validators/task.schema.ts`（把 service+schema 倒回 prev）
3. 还原测试文件到 working tree（impl 旧 + 测试新 = RED 状态）
4. `npx vitest run tests/instance-snapshot-clear-semantics.test.ts` → 7 FAIL / 1 PASS（失败信息显示 "expected ... not to have property 'timeLimitMinutes'" / "expected ... not to have property 'dialogueRequirements'" 以及 4 个 schema "expected false to be true"）
5. `git checkout 8b4b9e5 -- ...` 恢复 GREEN，再跑 → 8/8 PASS

证明 bug 真存在、测试正确刻画 bug、impl 真修了。

## 关键 grep 结果

```
$ grep -n "applyClearSemantics" lib/services/task-instance.service.ts
63:function applyClearSemantics(    # 定义
426: applyClearSemantics(nextSim, ...)      # simulation
439: applyClearSemantics(nextQuiz, ...)     # quiz
452: applyClearSemantics(nextSub, ...)      # subjective

$ grep -n "\.nullable()" lib/validators/task.schema.ts
149-152: dialogueRequirements / studyBuddyContext / evaluatorPersona / systemPrompt
156-159: timeLimitMinutes / maxQuestions / startDifficulty / difficultyStep
163-164: referenceAnswer / evaluatorPersona
（共 10 字段，全部在 Slice 1 范围内）

$ grep -n "logAudit\|isAuthorizedForInstance" lib/services/task-instance.service.ts
（13 处出现，行号与 prev 完全一致，未改动 — Slice 3 的范围）
```

## Diff stat

```
lib/services/task-instance.service.ts             |  25 ++-
lib/validators/task.schema.ts                     |  28 +++-
tests/instance-snapshot-clear-semantics.test.ts   | 189 ++++++++++++++++++++++
5 files / 348 + / 6 -
```

源码增量 53 行（service 25 + schema 28），远低于 150 行上限。✓

## 风险点 / 观察

- **零风险**：base schema 未动 → create 路径不受影响 → 测试 0 regression 验证了这一点。
- **正确权衡**：builder 选择 "patch schema 独立 + service applyClearSemantics 后扫" 而不是改 base schema 让 null=allow 全局生效，避免污染 create / update 之外的路径。架构正确。
- Slice 2 (UI buildPatchBody) 需要在前端真的把 state 中 cleared 字段序列化为 `null` 而非 `undefined`（否则 service 永远收不到 null，本 slice 的修复就是死代码）。这是 Slice 2 验证重点，与本 slice 解耦合理。
- Slice 3 audit log 的"reason / force 字段标注"如果涉及现有 L477-488 的 metadata，需要看 spec 是改这处还是新加 — 但与 Slice 1 完全无冲突。

## Overall: **PASS**

Slice 1 通过全部 10 项 acceptance。RED 真 FAIL、GREEN 8/8 PASS、全 suite 1118/1118 PASS、0 tsc 错误、0 lint 错误、严格遵守 scope（不超界改 audit/admin/UI/假按钮）、commit message 完整。

可以放行 Slice 2。
