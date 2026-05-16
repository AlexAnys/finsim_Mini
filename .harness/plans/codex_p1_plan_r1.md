# Codex-P1 Plan — 修 2 个 P1 authorization gaps

## 改动

### Bug 1 (Unit 8) — adaptive-quiz/next route 权限校验

`app/api/lms/tasks/[id]/adaptive-quiz/next/route.ts`:
- requestSchema 加 `taskInstanceId: z.string().uuid()` (required)
- POST handler 解析 body 后 + `assertTaskInstanceReadable(body.taskInstanceId, user)` (strict 不 opt-in closed-with-own-sub)
- 服务端验 `instance.taskId === taskId`（防伪造）

### Bug 2 (Unit 6) — createPost 自由问 courseId 归属校验

`lib/services/study-buddy.service.ts:createPost`:
- 自由问分支（!taskId && !taskInstanceId && data.courseId）→ 加 `assertStudentInCourseClasses(user, courseId)`
- 新 helper：`prisma.course.findFirst({where: {id, OR: [{classId: user.classId}, {classes: {some: {classId: user.classId}}}]}})`
- 找不到 → throw `FORBIDDEN`（中文 "你不在该课程的班级，无法关联此课程"）
- 不传 courseId 时不校验（admin-bin 兜底，仍允许，courseId=null 持久化）

### e2e

`tests/e2e/codex-p1-verify.spec.ts` (新)：
- **Bug 1**: alex 调自己班 instance task → 200；alex 跨班调 b601 instance task → 403；伪造 instanceId 不匹配 taskId → 403
- **Bug 2**: alex 自由问 courseId=金融2024A班课 → 201；alex 自由问 courseId=别班 course → 403 中文；不传 courseId → 201

### 风险

- 🟢 schema 0 改动
- 🟢 既有 taskInstanceId-supplied path（adaptive 测验内调 next API 一定有 instanceId）— 学生 runner 已有 taskInstanceId props，需 wire 进 fetch body
- 🟢 自由问 admin-bin 仍工作（courseId=null）

预计 ~80-120 prod + ~100 e2e / 单 commit 修两个。
