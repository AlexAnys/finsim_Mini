# Codex-P1-r3 Plan — taskId 分支加 classId scope

## Bug

`lib/services/study-buddy.service.ts:67` r2 fix 的 `findFirst({where:{taskId}})` 没加 classId scope。task 复用 A+B 班场景，alex(A班) supply 该 taskId → 服务端可能返回 B 班 instance.courseId → AI load 别班 KS。

## 改动

```ts
// taskId 分支
const anyInst = await prisma.taskInstance.findFirst({
  where: { taskId: data.taskId, classId: data.user.classId },
  select: { courseId: true },
});
if (!anyInst) throw new Error("FORBIDDEN");
resolvedCourseId = anyInst.courseId ?? undefined;
```

## e2e

`tests/e2e/codex-p1-r3-verify.spec.ts` 新：
- alex 用 A 班 task id → 201 + post.courseId = A 班 course
- student5 (B班) 用 A 班 task id → 403 (taskReadable 已拦)；备用：alex 用纯 B 班 task → 403

预计 ~20 prod + ~60 e2e / 单 commit.
