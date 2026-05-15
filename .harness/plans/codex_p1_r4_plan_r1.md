# Codex-P1-r4 Plan — 1 P1 (老师 SB over-match) + 1 P2 (TaskBuildDraft 发布非原子)

## Bug 1 (P1)

`app/api/teacher/study-buddy/posts/route.ts:55` filter 第 3 条 `{ task: { taskInstances: { some: { courseId: { in: courseIds } } } } }` 是 task-level 反推 — task 复用多课程时 over-match：教师 A 只有课程 A 权限，但 task A 同时在课程 B 有 instance → A 老师能看到 B 课程的学生 post。

## Bug 2 (P2)

`app/api/lms/task-instances/with-task/route.ts` + `markTaskBuildDraftPublished` 三步分立非原子：
1. line 47-55 validate `draft.status === "approved"`
2. line 57 `createPublishedTaskWithInstance` 创 task+instance（已 transaction 内部）
3. line 70 `markTaskBuildDraftPublished` 再次 read + 检查 + update status

并发两个 POST 同 draftId → 都过 step 1 → 都创 instance → 只有一个 step 3 成功，另一个抛 `NOT_APPROVED_FOR_PUBLISH` 但 task+instance 已持久化（孤立残留）。

## 改动

### P1 修

`app/api/teacher/study-buddy/posts/route.ts` filter 删第 3 条 task-level fallback：

```ts
OR: [
  { taskInstance: { courseId: { in: courseIds } } }, // task-bound
  { courseId: { in: courseIds } },                    // free-form / Unit 6 后所有 post
],
// 删:
// { task: { taskInstances: { some: { courseId: { in: courseIds } } } } },
```

风险评估：Unit 6 后所有新 post 都强制反推 `resolvedCourseId` 持久化（createPost service r2+r3 已修），老 task-bound post 都有 taskInstanceId（task-bound 必经 instance 上下文），第 1 条 `taskInstance.courseId` filter 覆盖。

### P2 修

`lib/services/task-build-draft.service.ts` `markTaskBuildDraftPublished` 改为 conditional update（atomic）：

```ts
export async function markTaskBuildDraftPublished(draftId: string) {
  try {
    return await prisma.taskBuildDraft.update({
      where: { id: draftId, status: "approved" }, // ← conditional: 只在 status=approved 才更新
      data: { status: "published" },
    });
  } catch (err) {
    // P2002/P2025 — 行不存在 或 status 已不是 approved (并发竞态)
    throw new Error("TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH");
  }
}
```

`with-task/route.ts` 调用顺序调整：**先 reserve draft (flip 状态) → 再创 task+instance**。若 reserve 失败短路，不创 instance；若 reserve 成功后 create 失败，再回滚 draft 状态（用 `$transaction` 或 catch 后 update 回 approved）。

具体实施：
```ts
// (1) 先 reserve draft（conditional update）
if (data.taskBuildDraftId) {
  await markTaskBuildDraftPublished(data.taskBuildDraftId); // throw NOT_APPROVED on race loss
}
// (2) 创 task+instance（已 transaction）
const output = await createPublishedTaskWithInstance(user.id, data);
// (3) audit log
await logAudit(...);
```

若 step 2 失败：手动回滚 draft 状态（catch + reset to approved）。

risk：若 step 2 crash 极端情况下 reset 也失败 → draft 卡 published，但 instance 没建。可接受（manual 修复 admin 接口 reset draft）。

## E2E

`tests/e2e/codex-p1-r4-verify.spec.ts` 新建：

### P1
- A1: belle (B 班课老师) GET `/api/teacher/study-buddy/posts` → 不应返回 alex (A 班课) 在跨课程 task 上的 post（前提：fixture 准备好 task 复用 A+B 课程的 SB post）

### P2
- B1: 并发 2 fetch 同 draftId publish → 一个 201，一个 4xx (`TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH`)
- B2: DB 端 verify 只有 1 个 task+instance 持久化

## 验证

- tsc --noEmit
- vitest run（baseline 1094）
- playwright e2e 我写的 spec

预计 ~30 行 prod + ~150 行 e2e / 单 commit / r1 可能即收。
