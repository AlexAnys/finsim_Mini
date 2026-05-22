# QA Report — snapshot-bugfix slice-2 (commit 4e1fc13)

## Spec
review-pr13 F-3 UI 端补完。Slice 1 让 service 接受 `null = clear`；Slice 2 让 UI buildPatchBody 在用户清空可选字段时显式发 `null`（而非 undefined → 被 `JSON.stringify` drop → service 浅 merge 保留旧值）。

不在 Slice 2 范围（应保持未改动）：audit log（Slice 3）、admin 路径（Slice 4）、假占位按钮（Slice 5）、service / schema（Slice 1 已 done）。

## Acceptance check

| # | Check | Verdict | Evidence |
|---|---|---|---|
| A1 | RED 真 FAIL（builder 报告 5/5 FAIL） | **PASS** | `git checkout 4e1fc13~1 -- components/instance-detail/snapshot-edit-sheet.tsx` 后保留新测试 → `npx vitest run tests/snapshot-edit-form-clear.test.ts` → **5/5 FAIL**，错误 `buildPatchBody is not a function`（prev impl 未 export） |
| A1.5 | 逻辑改动是必要的（不仅 export） | **PASS** | 额外做了 `sed export` 让 prev impl 有 export 但保留旧逻辑跑测试 → **3/5 FAIL**：quiz 4 个字段 undefined → 期望 null（实际 undefined）；simulation `dialogueRequirements: ""` → 期望 null（实际 undefined）；simulation `dialogueRequirements: "   "` → 期望 null（旧 `|| undefined` 因 "   " truthy 不处理，实际 "   "）。证明 `?? null` + `.trim() ? value : null` 的映射逻辑是必要的，不仅 export。 |
| A2 | GREEN 真 PASS | **PASS** | `npx vitest run tests/snapshot-edit-form-clear.test.ts` → **5/5 PASS** in 2ms |
| A3 | 全 suite 无 regression | **PASS** | `npx vitest run` → **107 files / 1123 tests PASS** (Slice 1 baseline 106/1118 → +1 file / +5 tests, 0 regression) — 与 builder 报告完全一致 |
| A4 | tsc --noEmit | **PASS** | 0 errors |
| A5 | lint touched files | **PASS** | `npx eslint components/instance-detail/snapshot-edit-sheet.tsx tests/snapshot-edit-form-clear.test.ts` → 0 errors / 0 warnings |
| A6 | UI 真发 null（不是 undefined / omitted） | **PASS** | `components/instance-detail/snapshot-edit-sheet.tsx`：<br>L306: `dialogueRequirements: s.dialogueRequirements.trim() ? s.dialogueRequirements : null`<br>L318-321: `timeLimitMinutes / maxQuestions / startDifficulty / difficultyStep: q.X ?? null`<br>关键：null 经 `JSON.stringify` 序列化为 `"null"`（undefined 会被 drop），服务端能真收到该 key |
| A7 | Slice 1 不再是死代码 — UI→service 闭环 | **PASS** | doSave L110-133 链路：buildPatchBody (Slice 2 → 发 null) → JSON.stringify (保留 null) → `PATCH /api/lms/task-instances/[id]/snapshot` (req body 含 `quizConfig.timeLimitMinutes: null`) → schema 接受 (Slice 1 `.nullable()`) → service `applyClearSemantics(merged, patch)` 把 null 字段从 merged delete (Slice 1)。两 slice 真合起来修复"清空限时无效"演示 bug。 |
| A8 | Scope 严格 — 只改 buildPatchBody | **PASS** | `git show 4e1fc13 --name-only` 仅 4 文件：sheet 组件 + 测试 + 2 harness 文档。sheet 组件内 diff 也只动 L296-322 段（buildPatchBody 函数 + export 关键字），未动 buildInitialState (L255+) / SimulationForm / QuizForm / SubjectiveForm / doSave 等。 |
| A9 | subjective 分支正确不动（无清空场景） | **PASS** | L325-335 subjective 分支：prompt 是必填、allowTextAnswer 是 bool、allowedAttachmentTypes 是数组、strictnessLevel 默认 "MODERATE"，无可清空字段，builder 决定不动 — 正确。 |
| A10 | Interface 变更影响范围 | **PASS** | `buildPatchBody` 之前是 module 内私有，唯一 caller 是组件内 doSave (L113)，加 export 不影响该 caller。grep 整库 `buildPatchBody` 仅这 1 处调用 + 1 处定义 + 1 处测试 import。 |
| A11 | 未触 Slice 3/4/5 范围 | **PASS** | 未碰 audit log（Slice 3 — service/audit.service 都未改）、未碰 app/api/admin/（Slice 4）、未碰任何 "假占位按钮" 相关 UI（Slice 5） |
| A12 | finsim-specific（中文 UI / Service 层 / API 格式） | **PASS** | 仅改 client component 内部纯函数 + 测试，未改 Route Handler、UI 文案、API 响应格式 |
| A13 | Commit message 清晰 | **PASS** | `fix(snapshot): UI buildPatchBody 清空字段发 null (slice 2)` + body 说明承接 Slice 1、列举改动字段、注明 subjective 不动原因、baseline 数字 |

## RED 验证手法（双层证明）

**层 1 — export 缺失证明**：
1. `git checkout 4e1fc13~1 -- components/instance-detail/snapshot-edit-sheet.tsx`（回 prev）
2. 测试文件保留（slice 2 加的）
3. `npx vitest run tests/snapshot-edit-form-clear.test.ts` → **5/5 FAIL** with `TypeError: buildPatchBody is not a function`

**层 2 — 逻辑改动必要性证明**（额外严谨）：
1. 在 prev impl 上 `sed -i 's/^function buildPatchBody/export function buildPatchBody/'` — 只加 export 不改逻辑
2. 再跑同一测试 → **3/5 FAIL，2/5 PASS**：
   - PASS 的 2 个："有值仍按值发"（quiz 30/20/2/1、simulation 实际内容），旧逻辑也对
   - FAIL 的 3 个：
     - quiz state 4 字段全 undefined → 旧直接返回 undefined → 期望 null
     - simulation `dialogueRequirements: ""` → 旧 `|| undefined` → 期望 null
     - simulation `dialogueRequirements: "   "` → 旧 `|| undefined` 因 truthy 不处理 → 期望 null（特别证明 `.trim()` 处理是必要的）

证明 export + 逻辑映射改动都是必要的。

## 关键 grep 结果

```
$ git show 4e1fc13 --name-only
.harness/plans/snapshot-bugfix-slice-2.md
.harness/reports/build_snapshot-bugfix-slice-2.md
components/instance-detail/snapshot-edit-sheet.tsx
tests/snapshot-edit-form-clear.test.ts

$ grep "buildPatchBody" 整库（除测试外）
components/instance-detail/snapshot-edit-sheet.tsx:113:  const body = buildPatchBody(taskType, state);
components/instance-detail/snapshot-edit-sheet.tsx:298:export function buildPatchBody(...)

$ grep -n "null\b" 在 buildPatchBody 函数体
L306: dialogueRequirements: s.dialogueRequirements.trim() ? s.dialogueRequirements : null
L318: timeLimitMinutes: q.timeLimitMinutes ?? null
L319: maxQuestions: q.maxQuestions ?? null
L320: startDifficulty: q.startDifficulty ?? null
L321: difficultyStep: q.difficultyStep ?? null
```

## Slice 1 + 2 闭环图（演示 bug 真修复）

```
[UI 教师清空"限时分钟" input]
     ↓ state.timeLimitMinutes = undefined
[buildPatchBody (Slice 2)] 
     ↓ q.timeLimitMinutes ?? null  → null
[JSON.stringify(body)]
     ↓ null 不会被 drop → '{"quizConfig":{"timeLimitMinutes":null,...}}'
[fetch PATCH /api/lms/task-instances/[id]/snapshot]
     ↓ req body 含 timeLimitMinutes: null
[validators/task.schema.ts: quizConfigPatchSchema.timeLimitMinutes (Slice 1)]
     ↓ z.number().int().min(1).nullable().optional() → 接受 null
[services/task-instance.service.ts updateTaskInstanceSnapshot (Slice 1)]
     ↓ 浅 merge: nextQuiz = { ...currentQuiz, timeLimitMinutes: null }
     ↓ applyClearSemantics(nextQuiz, patch.quizConfig) → delete nextQuiz.timeLimitMinutes
[DB taskSnapshot.quizConfig 不再有 timeLimitMinutes key]
     ↓
[学生加载任务时 SubmissionRunner 看不到 timeLimit 字段 → 不限时]
```

两 slice 缺一不可：
- 缺 Slice 1 → UI 发 null 但 schema reject / service 仍设为 null（不删）→ key 还在
- 缺 Slice 2 → UI 仍发 undefined → JSON drop → service 收不到 patch.timeLimitMinutes → 浅 merge 完全保留旧值

## Diff stat

```
components/instance-detail/snapshot-edit-sheet.tsx |  14 ++--
tests/snapshot-edit-form-clear.test.ts             |  83 +++++++++
4 files / 198 + / 6 -
```

源码增量 8 行（sheet 净增 8 行）+ 1 个新关键字（export）。远低于 150 行上限。✓

## 风险点 / 观察

- **零风险**：interface change 范围严格（buildPatchBody 唯一组件内 caller 已验证），无破坏。
- **架构正确**：在 client 文件 export pure function 给 vitest node 环境用 — builder 在报告 L52-53 已 acknowledge 是合法做法，5 测试 PASS 验证。
- **trim 处理是亮点**：`s.dialogueRequirements.trim() ? s.dialogueRequirements : null` 处理了用户输入只空格的边界情况。
- Slice 1 死代码风险：通过 A7 闭环验证已消除。

## Overall: **PASS**

Slice 2 通过全部 13 项 acceptance（含双层 RED 证明）。RED 真 FAIL、GREEN 5/5 PASS、全 suite 1123/1123 PASS、0 tsc 错误、0 lint 错误、严格遵守 scope（仅改 buildPatchBody 函数）、Slice 1 死代码风险解除、commit message 完整。

可以放行 Slice 3。
