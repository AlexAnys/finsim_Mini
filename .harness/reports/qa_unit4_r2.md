# QA Report — Unit 4 r2

> QA: qa · 2026-05-14 · 验 r2 commit `f078815`（建立在 r1 commits `dc5b1db` + `7b0a13d`）on `claude-demo-fixes`
> r2 任务：补 r1 acceptance gap — allocation 编辑 UI + sim/sub 完整 PATCH e2e
> Test spec: `tests/e2e/qa-unit4-r2-allocation.spec.ts` (6 case，独立于 builder unit4-verify.spec.ts I/J/K)
> 截图: `.harness/screenshots/qa-unit4-r2/`

## 测试数据
- **SIM_TASK** `a308c7ba-2713-4c2d-9441-c92927e3f9f4` — teacher1 sim, 0 graded sub, 1 alloc section + 5 items 基线
- **SUB_TASK** `aff902a3-a669-4181-91ea-613519b9f4d2` — teacher1 sub, 0 graded sub, prompt 124 chars 基线
- **QUIZ_TASK_HAS_GRADED** `3e26c6d2` — molly quiz, 1 graded, r1 spot-check 用

## r2 Acceptance 逐条对照

| r2 要补的 acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| Allocation 编辑 UI 可见 + 可点 | teacher1 进 sim 编辑模式 → 抓「添加分区」+「添加条目」按钮 | "添加分区" × 1 + "添加条目" × 1 都可见 | PASS |
| Allocation 增 section / 增 item / 改 label / restore | API PATCH 跑完整循环 | baseline 1 sec/5 items → ADD 2 sec/6+1 items → EDIT (sec1.label="QA-r2-EDITED-section") → RESTORE 1 sec/5 items；每步 200；items 内 label 精确写入 | PASS |
| sim task 改 persona/systemPrompt → 保存 → 回看 | teacher1 PATCH simulationConfig.systemPrompt + marker + restore | PATCH 200；marker 写入 (len 39 → 67)；RESTORE 后回到精确 baseline | PASS |
| sub task 改 prompt → 保存 → 回看 | teacher1 PATCH subjectiveConfig.prompt + marker + restore | PATCH 200；marker 写入；RESTORE 后回到 baseline (len 124 一致) | PASS |
| 主路径回归 spot-check (force PATCH) | molly quiz: 无 force → 400 TASK_HAS_GRADED_SUBMISSIONS；force=true → 200 | 与 r1 一致 | PASS |
| audit log 写入含 fieldsChanged 含 allocationSections/simulationConfig/subjectiveConfig | DB SELECT WHERE createdAt > QA 起跑时 | 9 fresh audit (3× allocationSections + 2× simulationConfig + 2× subjectiveConfig + 2× quiz force=true) — 全字段精确 | PASS |

## 额外发现 (重要)

### ⚠️ Finding A: builder r2 自测留下 DB 污染 (低严重度)

**事实**：当前 teacher1 sim task `a308c7ba` 的 `simulationConfig.systemPrompt` = `"【核心人设】\nQA-r2-test-persona-1778751095550"` (39 chars)

**追溯**：
- seed.ts L209-228 创建该 sim task 时**未设置 systemPrompt** → original baseline 应为 `null`
- builder r2 测试 J 在多次自测时，每次"baseline"读到的都是前一次跑残留的 marker，restore 步骤就把 marker 当 baseline 写回
- audit log 09:30-09:32 显示 6 个 simulationConfig PATCH（builder 跑了两遍 r2 测试），每次"恢复"都是恢复到 marker 而非真 null

**影响评估**：
- **代码路径无 bug** — builder 的 buildPatchBody simulationConfig 分支 + service updateTask 工作正常（QA 独立验证 PATCH 实测全过）
- **演示影响 minimal** — 这是 teacher1 的资产，molly 演示用她自己的课程 / 任务（个人规划），与该 sim task 无交集
- **未来测试影响** — 任何后续测试若依赖该 sim task 的 systemPrompt baseline 会拿到 garbage

**Resolution**：建议 coordinator 让 builder 写一次性 SQL/migration 清理，或等下次 dev DB rebuild。**不阻塞本 unit acceptance**。

### ⚠️ Finding B: service 无法 PATCH systemPrompt 回 null (低严重度，已知限制)

**事实**：试图通过 PATCH `{ simulationConfig: { ...withoutSystemPrompt } }` 把 systemPrompt 清回 null —— PATCH 返回 200 但 DB 内 systemPrompt 维持原值。

**根因**：`buildPatchBody` 内 `systemPrompt = promptParts.length > 0 ? ... : undefined` (page.tsx L286-288)；service updateTask 用 upsert，undefined 字段被 Prisma 忽略而非写 null。

**影响评估**：
- 一旦 sim task systemPrompt 被设值，**只能改不能清回 null**
- spec L86 "全部可改" — "改" 满足；"清空" 用户场景几乎不会出现
- Production UI 用户也不会期待"清空 systemPrompt"操作

**Resolution**：接受为已知限制（与 r1 接受 taskSnapshot 同等级）。如未来用户反馈需要清空，再加 "explicit clear" 按钮。

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 83 files / **986 tests pass** (与 r1 baseline 一致，无新单测) |
| `npx eslint <page.tsx + builder e2e + QA spec>` | 0 problem |
| `git show --stat f078815` | 2 files +365/-16 (page.tsx +190 + e2e +191/-16) — 与 build 报告一致 |
| cross-module grep | r2 commit 仅触及 page.tsx UI 层 + e2e spec，无 service/schema 改动 |
| DB 状态测前测后 | **r2 QA 范围内**：a308c7ba allocation 测前 1 sec / 5 items → 测后 1 sec / 5 items ✓；aff902a3 sub prompt 测前 124 → 测后 124 ✓；3e26c6d2 quiz taskName 测前后一致 ✓ |
| DB 整体污染 | **builder r2 自测留下 a308c7ba systemPrompt marker (Finding A)** — 非本 QA 引入 |

## Audit log 实测样本 (QA r2 时段 09:37)

```
action      | targetId  | force | fieldsChanged
task.update | 3e26c6d2- | true  | ["taskName", "visibility", "practiceEnabled"]                    × 2 (force quiz)
task.update | aff902a3- | false | ["visibility", "practiceEnabled", "subjectiveConfig"]            × 2 (sub modify+restore)
task.update | a308c7ba- | false | ["visibility", "practiceEnabled", "simulationConfig"]            × 2 (sim modify+restore)
task.update | a308c7ba- | false | ["visibility", "practiceEnabled", "allocationSections"]          × 3 (alloc ADD+EDIT+RESTORE)
```
✅ allocationSections / simulationConfig / subjectiveConfig 三种新 fieldsChanged 全部写入 audit

## Cross-module regression

- 本 r2 仅触及 `app/teacher/tasks/[id]/page.tsx` (UI 层) + 测试文件 — service / route / schema 0 改动 ✓
- r1 高危拦截 + force 路径 spot-check 通过（Test E）✓
- 既有 vitest 986 全过，无新单测但也无回归 ✓

## Finsim-specific 检查

- ✅ UI 文案中文（"添加分区" / "添加条目"）
- ✅ Service interface 不变（buildPatchBody 内拼 body 即可）
- ✅ Route Handler 不变
- ✅ API response 格式 `{ success, data }` 保持
- ✅ Prisma schema 0 改动

## 是否引入新 bug

- 无代码 bug
- 一个 DB 污染（Finding A）由 builder 自测产生，非本 r2 代码引入；建议 builder 用一次性 SQL 清理 OR 等 dev DB rebuild
- 一个已知限制（Finding B）不在 acceptance 内，可接受

## Issues found

- Finding A: builder r2 自测残留 sim task systemPrompt marker — 需 builder 跑一次 SQL cleanup (`UPDATE "SimulationConfig" SET "systemPrompt" = NULL WHERE "taskId" = 'a308c7ba-2713-4c2d-9441-c92927e3f9f4'`)
- Finding B: API 无法清空 systemPrompt 回 null（service limitation，acceptable）

## Overall: **PASS** (with Finding A flagged for follow-up)

**判断标准对照 (r1 即收三条件)**：
1. ✅ QA 6 case (allocation API CRUD + sim/sub 改+回读+restore + r1 spot-check + audit log placeholder) vs builder 3 case (I/J/K) — 独立证据链
2. ✅ HTTP / fieldsChanged / API content / DB row count 全 deterministic
3. ⚠️ DB cleanup 部分干净：本 QA r2 范围内 cleanup 全过；但 builder r2 残留污染（已 documented）

**建议**：
- **r2 标 PASS 收工** — 核心 acceptance (allocation 编辑 + sim/sub 完整 PATCH) 已实证
- **请 builder 跑一次 SQL cleanup** 把 teacher1 sim task systemPrompt 清回 null（一行 SQL，无需新 commit）
- Phase 4 仍计划修 taskSnapshot 消费

按 team-lead 的 calibration：r2 兜底已完成；下一步 Unit 5 (5a/b/c)。
