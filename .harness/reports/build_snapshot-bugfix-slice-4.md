# build_snapshot-bugfix-slice-4.md

## Task

Slice 4 (Task #12): B3 admin 路径 — review_arch F-4，`isAuthorizedForInstance` 只查 createdBy / courseTeacher，admin 被错误拒绝。

## RED

新文件 `tests/instance-snapshot-admin-role.test.ts`，4 测试：
- admin 既非 createdBy 也非 collab → 应通过（核心新行为）
- teacher 非 createdBy 非 collab → FORBIDDEN（保持现有）
- teacher 是 createdBy → 通过（保持现有）
- teacher 是 collab → 通过（保持现有）

**RED 阶段**:
- TS: 4 处调用错 ("Expected 3 arguments, but got 4") — 签名未扩展
- vitest: 1 FAIL（admin 抛 FORBIDDEN），3 PASS（保持行为 baseline）

## GREEN

### `lib/services/task-instance.service.ts`

1. `isAuthorizedForInstance(instance, userId, userRole?)`：第一行 `if (userRole === "admin") return true;`
2. 6 个公开 service 函数加 `userRole?: string` 参数并透传：
   - `publishTaskInstance`
   - `updateTaskInstance`
   - `deleteTaskInstance`
   - `reopenTaskInstance`
   - `closeTaskInstance`
   - `updateTaskInstanceSnapshot`

`userRole` 全部 optional，保留向后兼容；调用方不传时行为完全 = 之前（admin 仍被拒）。route 全部传 `user.role`，所以生产路径 admin 现在通过。

### Route handlers（5 个）

- `app/api/lms/task-instances/[id]/route.ts` — PATCH / DELETE 透传 `user.role`
- `app/api/lms/task-instances/[id]/publish/route.ts` — POST
- `app/api/lms/task-instances/[id]/reopen/route.ts` — POST
- `app/api/lms/task-instances/[id]/close/route.ts` — POST
- `app/api/lms/task-instances/[id]/snapshot/route.ts` — PATCH

### 已存在测试的 grep 更新

`tests/instance-snapshot-update.test.ts:148` 旧 grep `/isAuthorizedForInstance\(existing, createdBy\)/` 改为 `/isAuthorizedForInstance\(existing, createdBy, userRole\)/`。这是为保持 grep 测试对新签名的精确断言（anti-regression rule：当签名变更时，相邻 grep 断言同 commit 内同步）。

## 验证

| 检查 | 结果 |
|---|---|
| 新 admin 测试 4 PASS | ✅ |
| 全 vitest suite | ✅ 108 files / 1127 tests passed（Slice 2 baseline 107 / 1123 → +1 file / +4 tests, 0 regression）|
| `npx tsc --noEmit` | ✅ 0 errors |
| eslint on touched files | ✅ 0 errors / 0 warnings |
| 所有 6 个 service 函数 5 个 route handlers 同步 | ✅ |

## 改动文件

- `lib/services/task-instance.service.ts` — isAuthorizedForInstance 加 userRole 参数 + 6 个公开函数签名扩展
- `app/api/lms/task-instances/[id]/route.ts`
- `app/api/lms/task-instances/[id]/publish/route.ts`
- `app/api/lms/task-instances/[id]/reopen/route.ts`
- `app/api/lms/task-instances/[id]/close/route.ts`
- `app/api/lms/task-instances/[id]/snapshot/route.ts`
- `tests/instance-snapshot-update.test.ts` — grep 更新 1 行
- `tests/instance-snapshot-admin-role.test.ts` — 新建 4 测试
- `.harness/plans/snapshot-bugfix-slice-4.md`
- `.harness/reports/build_snapshot-bugfix-slice-4.md`

## 不动 / 延后

- Prisma schema
- audit / clear-semantics 行为（Slice 1 + 3 done）
- assertTaskInstanceWritable（resource-access.ts 内已正确处理 admin）
- `createTaskInstance` / `createPublishedTaskWithInstance` 等不走 isAuthorizedForInstance 的函数（无 instance auth gate）

## 不确定 / 注记

- `userRole` 用 `string` 类型而非 Prisma Role enum：route 层 `session.user.role` 类型即为 `string`（见 `lib/auth/auth.config.ts:67`），保持一致；service 只判等 `"admin"` 字符串，不解码 enum，节省一次类型转换。
- `assertTaskInstanceWritable`（`lib/auth/resource-access.ts`）独立存在并已正确处理 admin。本 slice 只补 service-internal `isAuthorizedForInstance` 的 admin 缺口，不动 resource-access 路径（avoid drive-by）。
- dev server 不需要重启（仅 lib / route handler 改动，无 schema.prisma 改）。

## 下一步

等 coordinator 验过后做 Slice 5（B4 删假占位「复制为新任务」按钮）。
