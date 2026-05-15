# Phase3-A Plan — quiz-question-tagger 计数虚高 root cause

> Builder: builder · Round 1 · 2026-05-15
> Coordinator hypothesis: 首次创建 task → 自动 enqueue → result `tagged: 10` 但 DB 全 `{}`

## 重现实验（已做）

按 spec 流程：清空 `e54e1cb9` 的 10 个 question knowledgeTagIds → molly login → POST `/api/lms/tasks/.../tag-questions` → 等 job succeeded。

**结果**：
- Job result: `{tagged: 10, failed: 0, skipped: 0, totalQuestions: 10}`
- DB 实测：全部 10 题真的写入了 tags（包括 `深度测试,边界条件测试,内部逻辑验证` 等真实标签）

也即 — **当前代码路径下 bug 不重现**。原 coordinator 见到的"tagged: 10 / DB {}"应该来自更早的代码或一个不同触发路径。

## 调研发现：3 个潜在 root cause

### Root cause 1（最可能）：`createPublishedTaskWithInstance` 不触发 tagger 自动 job

`app/api/lms/task-instances/with-task/route.ts` 调用 `task-instance.service.createPublishedTaskWithInstance(...)`。该 service 在 transaction 中创建 task + instance + snapshot，但**完全没 enqueue quiz_question_tag job**。

只有 `lib/services/task.service.createTask` 才 enqueue。学生侧 demo 流程"教师创建任务并立即发布"走的是 `with-task` 端点 → tagger 不触发 → 学生进 adaptive task → next API 检查 `< 50% tagged` 触发 fallback "知识点诊断暂未启用"。

**影响**：演示场景关键路径上 adaptive 模式从未跑起来。

### Root cause 2：`updateTask` 销毁重建 quizQuestions 但不再 tag

`task.service.ts:319` `tx.quizQuestion.deleteMany({where:{taskId}})` 全删后 createMany 全新 question 记录（含全新 ID，knowledgeTagIds 默认 `[]`）。`updateTask` **没有**触发 tagger 重建。

**影响**：教师任何编辑操作（如改 quizQuestions 题面/选项）→ 全部 tag 丢失 → 后续答题再走 fallback。

### Root cause 3 (假设)：coordinator 见到的"tagged: 10 / DB {}"可能场景

a) **Stuck job sweeper 误判**：若同一 jobid 被 sweep-stuck-ai-runs 标 failed，但 service 内 tagged++ 已统计完。这与当前 quiz_question_tag handler 流程不冲突（无重试覆写）。

b) **历史 buggy 代码**：Phase 2 commit-2 `3e5056c` 落地前，可能有 builder-b 在 worktree 写过半成品，coordinator 在错的代码版本上观察到现象。

c) **AI 返回 questionId 不匹配 + tagged 累加位置错乱**：当前代码下 `tagged++` 仅在 prisma update 成功 path，未命中时走 `failed++`。所以 tagged != actually-written 不可能。

→ **结论**：root cause 1 + 2 是真问题，root cause 3 已无源。

## 修复方案

### Fix 1：`createPublishedTaskWithInstance` 加 tagger trigger

在 transaction commit 后（function 末尾），若 `input.task.taskType === "quiz"` 且 `quizConfig?.mode === "adaptive"` 且 questions 存在，enqueueAsyncJob 同样的 `quiz_question_tag` job。

### Fix 2：`updateTask` 检测 quizQuestions 重建后重新 tag

在 updateTask 末尾（transaction commit 后），若 `patchData.quizQuestions` 改了 + task 是 adaptive quiz，enqueue 同 job。

### Fix 3：byId 兜底匹配（防御性）

当前 `byId.get(q.id)` 严格匹配 questionId。如果 AI 实际返回 `questionId: "1"` 或 `"[1]"`（prompt 里的 index），写不进。加 fallback：
- 主匹配：`byId.get(q.id)`（用 UUID）
- 次匹配：`byIdx.get(`[${i+1}]`)` 或 `byIdx.get(`${i+1}`)`（用 prompt index）
- 都没命中：`failed++`

这是 root cause 3 的防御性保护，即使 AI prompt 改了行为也不破坏 tagging。

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `lib/services/task-instance.service.ts` | 改 | createPublishedTaskWithInstance 末尾 enqueue tagger (adaptive only) |
| `lib/services/task.service.ts` | 改 | updateTask 末尾 enqueue tagger（如 patchData.quizQuestions 改）|
| `lib/services/quiz-question-tagger.service.ts` | 改 | byId 加 index fallback；tagged 计数仅在 prisma update 成功后递增（已是这样，加注释） |
| `tests/quiz-question-tagger.test.ts` (新) | 新 | 5 case (byId UUID match / byId index fallback / AI 漏 question / prisma update fail / tagged count 准确) |
| `tests/e2e/phase3a-verify.spec.ts` (新) | 新 | 3 case (createPublishedTaskWithInstance 触发 / updateTask 触发 / 计数 accurate)|

预计 200-300 行（含 tests）。

## 关键决策

1. **触发位置：transaction 外**（与 createTask 一致）— 避免 enqueue 失败 rollback 整个创建
2. **入库后 enqueue（已是这样）**：tagged++ 严格仅在 prisma.update success — 不改逻辑，加注释解释为什么这样写
3. **byId fallback 用 index `[1]` `1` 两种格式**：AI 可能输出任意一种，宽松接受

## 风险

1. **🟢 transaction 外 enqueue**：失败 try/catch 不阻塞主流程（与 createTask 同模式）
2. **🟡 updateTask trigger 频次**：教师每次编辑都触发 tagger = AI cost。**只在 quizQuestions 真改时触发**（patchData.quizQuestions undefined → skip）
3. **🟢 byId fallback 安全**：原 UUID 匹配是 primary，index 是 fallback，不会引入新 bug
4. **🟢 老 quiz_question_tag job 不重跑**：tagger service 自身幂等（已 tag 的 question 不重新打），重新 enqueue 不浪费

## 自测计划

### Unit tests
- byId UUID match 正常
- byId fallback：AI 返回 questionId=`[1]` 也能命中
- tagged++ 仅当 prisma.update 成功（mock update reject → failed++）
- AI 漏返回某 question → failed++
- 全 tagged 调用 → tagged: N, skipped: 0

### E2E
- createPublishedTaskWithInstance 触发 quiz_question_tag job（DB 实证）
- updateTask quizQuestions 改后触发新 job
- 计数 tagged === 实际 DB 写入数

## 不在本范围

- ❌ 重写 AI prompt（root cause 3 防御足够）
- ❌ Adaptive runner 改读 snapshot（Unit 18 候选）
- ❌ 教师 UI 显示 tagging 进度（Phase 4+ polish）

## 待 coordinator 确认

1. **修 3 处（root cause 1 + 2 + 3 defense）vs 仅修 root cause 1**：plan 推荐 3 处都修
2. **updateTask 触发频次控制**：仅 `patchData.quizQuestions` 真改时 trigger
3. **byId fallback 接受 `[1]`、`1` 两种 index 格式**

预计 r1 即收（service 改动小 + 旁路防御）。
