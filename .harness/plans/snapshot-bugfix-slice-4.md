# Slice 4 — B3 admin 路径

## 范围

`lib/services/task-instance.service.ts` 内 `isAuthorizedForInstance` 私有函数 + 6 个 service 公开函数签名 + 5 个 route handler caller。

## 问题（review_arch F-4）

`isAuthorizedForInstance(instance, userId)` 只查 `createdBy === userId` 或 `courseTeacher`。admin 不在两者内 → 返回 false → service 抛 FORBIDDEN。**admin 应能管理所有 instance。**

## 修复策略

- `isAuthorizedForInstance(instance, userId, userRole?: string)`，第一行：`if (userRole === "admin") return true;`
- 6 个公开 service 函数加 `userRole` 参数透传
- 5 个 route handler caller 加 `result.session.user.role`

## RED test（新文件 `tests/instance-snapshot-admin-role.test.ts`）

调 `updateTaskInstanceSnapshot(instanceId, adminId, patch, "admin")`，其中 admin 既不是 createdBy 也不在 courseTeacher → 期望不抛 FORBIDDEN，正常更新 → 当前 FAIL。

需要 mock：
- `prisma.taskInstance.findUnique` 返回 instance（createdBy ≠ adminId）
- `prisma.courseTeacher.findUnique` 返回 null
- `prisma.taskInstance.update` 返回 updated
- `prisma.submission.count` 返回 0
- `prisma.$transaction` 透传

## GREEN

1. 改 `isAuthorizedForInstance` 签名 + 第一行 admin short-circuit
2. 6 个 service 公开函数透传 `userRole`
3. 5 个 route handler 传 `user.role`
4. 用 `User["role"]` Prisma 类型保持 type-safe

## 已存在的断言

`tests/instance-snapshot-update.test.ts:148` grep `/isAuthorizedForInstance\(existing, createdBy\)/`。我会改成 `isAuthorizedForInstance(existing, createdBy, userRole)`，旧 grep 不再匹配。**这是 anti-regression rule 触发：**需要更新该断言。

但其他 5 处 caller (`publishTaskInstance` 等) 内 isAuthorizedForInstance 调用的 actorId 名字不同（`createdBy` vs `actorId`），grep 也许还 match 不同变量名。我需要逐个核对再决定是否搬测试 / 改测试。

## 不动

- Prisma schema
- service 内的 audit 行为
- assertTaskInstanceWritable 路径（这是 resource-access.ts 独立的 admin-aware 函数，已正确处理 admin）

## Acceptance

- 新 admin test PASS
- 全 suite 0 regression（含 instance-snapshot-update grep 测试，必要时调整 grep）
- tsc 0 errors
- 5 route handlers + service 内 internal callers 全同步
