# Codex-P1-r2 Plan — 修 P1-2 / P1-3 + P1-1 注释

## 改动

| 文件 | 改动 |
|---|---|
| `lib/services/study-buddy.service.ts` (P1-2) | `else if (data.taskId)` 分支：**忽略 client supplied courseId**，强制 `resolvedCourseId = anyInst?.courseId ?? undefined`（覆盖 client 值，不再用 `if (!resolvedCourseId)` 守卫）。防 client 给 bogus courseId 让 generateReply load 跨课程素材 |
| `app/api/lms/quiz-questions/[id]/check/route.ts` (P1-3) | requestSchema 加 `taskInstanceId: z.string().uuid()` required；handler 加 `assertTaskInstanceReadable(taskInstanceId, user)` strict；防伪造 `instance.taskId === question.taskId`；找不到对应关系 403 |
| `components/quiz/quiz-adaptive-runner.tsx` (P1-3 配套) | submitAnswer 调 /check 时 body 加 `taskInstanceId`（runner state 已有） |
| `app/api/lms/tasks/[id]/adaptive-quiz/next/route.ts` (P1-1 注释) | POST handler 顶加注释说明 r1 已 fix，引用 commit 489aa8e |
| `tests/e2e/codex-p1-r2-verify.spec.ts` 新 | (P1-2) alex 自己 task + bogus courseId=别班 → 服务端忽略 bogus 用 instance 反推 OK（不 403，但 generateReply 用对的 courseId）; (P1-3) student5 跨班 question check → 403; (P1-3) 缺 taskInstanceId → 400; (P1-3) 伪造 taskInstanceId 不匹配 question.taskId → 403 |

## 决策

- **P1-2: 强制覆盖** (coordinator 推荐) — 最简最安全，client courseId 完全忽略
- **P1-3 schema**: 必填 taskInstanceId 避免可选不传绕过
- **e2e 用 student5 (B 班)** 跨班 quiz check

预计 ~80 prod + ~80 e2e / 单 commit。
