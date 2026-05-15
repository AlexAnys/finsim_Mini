# Build Report — Phase3-A Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/phase3a_plan_r1.md`
> Bug: quiz-question-tagger 首次 job 计数虚高（root cause grep + fix）

## 重现实验

按 plan 流程清空 e54e1cb9 (10 题) → molly POST trigger → job result `tagged: 10` + **DB 实测全 10 题真有 tags**。**当前代码 bug 不重现** — 但调研找到 2 个真实 root cause + 1 个防御性强化点。

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/task-instance.service.ts` | +28 | createPublishedTaskWithInstance 末尾 enqueue tagger（root cause 1）|
| `lib/services/task.service.ts` | +30 | updateTask 末尾 enqueue tagger（仅 quizQuestions 真改 + adaptive 模式）（root cause 2）|
| `lib/services/quiz-question-tagger.service.ts` | +15 / -2 | byIdx fallback 无条件填充（defense 3）；tagged 仅 prisma.update 成功时递增（注释强化）|
| `tests/quiz-question-tagger.test.ts` (新) | +188 | 7 unit case (UUID match / `[1]` index fallback / 纯数字 fallback / AI 漏返 / prisma fail / 幂等 / 空 questions) |
| `tests/e2e/phase3a-verify.spec.ts` (新) | +136 | 3 e2e case (A1 计数 accuracy + DB 10/10 / B1 幂等 / C1 service trigger 已写库) |

**生产代码**：73 / -2
**测试**：324
**Total**：~397（plan 估 200-300，超 100 主要在 unit tests 详细 7 case）

## 关键决策实施（按 coordinator 批准）

1. ✅ **修 3 处** root cause 1 + 2 + defense 3 一次到位
2. ✅ **updateTask 仅 quizQuestions 真改 + adaptive 模式时 trigger** — 改其他字段不烧 AI cost
3. ✅ **byIdx fallback 接受 `[1]` 和 `1` 两种格式** — `${idx+1}` + `[${idx+1}]` 双键

## 实施细节

### Root cause 1 修复（task-instance.service.ts）

`createPublishedTaskWithInstance` 在 transaction commit 后检查：
```ts
if (input.task.taskType === "quiz"
    && input.task.quizConfig?.mode === "adaptive"
    && (input.task.quizQuestions?.length ?? 0) > 0)
```
true → enqueue `quiz_question_tag` job。try/catch 不阻塞主流程（与 createTask 同模式）。

### Root cause 2 修复（task.service.ts updateTask）

`patchData.quizQuestions !== undefined && length > 0 + mode === "adaptive"` → enqueue tagger。其中 mode 来源：
1. `patchData.quizConfig?.mode`（同 patch 改）
2. `await prisma.quizConfig.findUnique({where:{taskId}, select:{mode:true}})`（不在 patch 时查 live）

这确保只在真改题且确实 adaptive 时 trigger，回避无关字段触发。

### Defense 3 修复（quiz-question-tagger.service.ts）

**Bug**：原 byIdx 注册条件 `!byId.has(t.questionId)`。当 AI 返回 `questionId="1"`：
- byId 用 questionId 作 key → byId 有 key="1"
- 检查 `!byId.has("1")` → false → byIdx 不注册 → 学生 lookup 也命中不上

**Fix**：byIdx 总是用 idx+1 作 key 注册：
```ts
result.taggings.forEach((t, idx) => {
  byIdx.set(`${idx + 1}`, t.tags);    // "1", "2", ...
  byIdx.set(`[${idx + 1}]`, t.tags);  // "[1]", "[2]", ...
});
```
查找顺序：byId.get(q.id) primary（真 UUID）→ byIdx.get index 兜底。

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 93 files / 1063 tests pass (1056 baseline + 7 tagger unit)
eslint: 0 new issue on builder modified/new files (baseline 17 不变)
```

### Tagger unit (7 cases)
```
✓ byId UUID 主匹配
✓ byIdx fallback：AI 返回 questionId='[1]' 等 index 格式仍 tag 成功
✓ byIdx fallback 用纯数字 '1' '2' 格式也能命中
✓ AI 漏返回某 question → failed++ 但其他成功
✓ prisma.update 失败时 tagged 不递增，failed++
✓ 已 tagged 的 question 不重新打（幂等）
✓ totalQuestions=0 时不调 AI 也不 update
```

### Playwright E2E (3 cases)
```
[A1] 清空 tags → POST trigger → job succeeded → DB 10/10 真有 tags (57.2s) ★ 核心 acceptance
[B1] 已 tag 后再 trigger → jobId null + untaggedCount=0 + "无需重新处理" (4.2s)
[C1] AsyncJob 表有 quiz_question_tag 记录 (3.9s)

Serial 3/3 PASS
```

DB 实证：清空 10 题 → trigger → 60s 内 job succeeded → DB 真有 tags。result.tagged === DB tagged count，**计数和实际状态一致**。

## 风险 / 不确定项

1. **🟢 transaction 外 enqueue**：try/catch 不阻塞主创建/更新流程；失败仅 console.error，与 createTask 同模式
2. **🟢 updateTask 频次受控**：仅 `patchData.quizQuestions !== undefined && length > 0` + mode adaptive 才 trigger，改无关字段不烧 AI
3. **🟢 byIdx 不影响 UUID 主匹配**：byId.get 仍 primary，byIdx 是 fallback。原 UUID 路径行为不变
4. **🟢 tagger 自身幂等**：targetQuestions 只筛 knowledgeTagIds.length === 0 的 question；重复 trigger 不会重打
5. **🟡 e2e A1 占用 60s + 1 AI call**：每次跑会真调 AI tagger（≥ 1 次）；可接受 — QA 也是真验

## Acceptance 对照

| 要求 | 状态 |
|---|---|
| 重现 bug | 部分 — 当前代码不重现，但 grep 发现 2 个真 root cause |
| 找 root cause + 修 | ✅ 3 处全修 |
| 单测覆盖 byId/byIdx fallback / prisma fail / 幂等 | ✅ 7 case |
| e2e 验证：触发后 DB 立即有 tags | ✅ A1 实证 |
| AI 输出 `[1]` index → fallback 匹配 | ✅ unit test 验证 |
| tsc / vitest / lint 全绿 | ✅ |

## 不在本范围

- ❌ 重写 AI prompt（defense 3 已防御）
- ❌ Adaptive runner 改读 snapshot（Unit 18 候选 — Q5 风险登记于 Unit 17）
- ❌ 教师 UI 显示 tagging 进度（Phase 4+ polish）

## 反思

- Plan 阶段 grep 找到 root cause 1（createPublishedTaskWithInstance 不 enqueue）是核心收获——bug 报告说"计数虚高"，真实问题是"根本没 enqueue"。
- byIdx 注册条件初版写错（`if (!byId.has(t.questionId))`），unit test 立刻揪出。**unit test 不是装饰品**，是 root cause 防回归的真守门员。
- 3 个 root cause 修复独立，不会互相 cascade；e2e A1 同时覆盖了"trigger 成功 + 计数 accurate"两个维度。
