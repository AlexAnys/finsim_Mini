# Unit 2 Plan — 任务实例状态机（关闭确认 + 重开 + 删除）

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 2
> Bugs: B-INSTANCE-01 (P0) + B-INSTANCE-02 (P1) + B-INSTANCE-03 (P1)

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `lib/services/task-instance.service.ts` | 改 | 新增 `reopenTaskInstance(id, userId)` 服务方法；改造 `deleteTaskInstance` 增加 0-submission 校验；现有 `updateTaskInstance` 涉及 status: closed 时写 audit；reopen 写 audit；delete 写 audit |
| `app/api/lms/task-instances/[id]/route.ts` | 改 | PATCH 已支持 status 改动，无需新路由；只在 service 层加 audit |
| `app/api/lms/task-instances/[id]/reopen/route.ts` (新) | 新 | POST 触发 reopen（独立路由便于 audit 区分）|
| `components/instance-detail/instance-header.tsx` | 改 | published → 点关闭弹 AlertDialog 二级确认；closed → 显示「重新开放」按钮 + 「删除实例」按钮（disabled 当 submissionCount > 0）；新增 `onReopen` `onDelete` props 和 `submissionCount` prop |
| `app/teacher/instances/[id]/page.tsx` | 改 | 加 reopen / delete handler；接 AlertDialog state；删除成功后 router.push("/teacher/instances") |
| `components/course/course-instances-tab.tsx` | 改 | 列表行：published 状态加确认弹窗；closed 状态行尾加「重新开放」+「删除」按钮（删按 0 sub 校验）|

注：
- **不动 schema**（Phase 1 全部不动 Prisma 是 spec 硬约束）。spec 提到的 `closedAt` 字段实际 schema 中**不存在**。本 unit 仅做 status 状态机切换 + audit log 时间戳，不引入 closedAt 字段。
- audit 用现有 `logAudit`（`lib/services/audit.service.ts`），actions：`task_instance.close` / `task_instance.reopen` / `task_instance.delete`。

## 关键改动思路

### B-INSTANCE-02 关闭确认

`InstanceHeader` 的 "关闭实例" 按钮当前直接调 `onClose`。改成：
- 点击 → 弹 AlertDialog："关闭后学生无法继续提交，确认关闭？"
- 取消 / 确认 OK 按钮（确认按钮使用 destructive 配色）
- 确认后才调 PATCH `/api/lms/task-instances/[id]` body=`{status:"closed"}`

列表页 `course-instances-tab.tsx` 同样改造（用同款 AlertDialog 组件，state 记 closeId）。

### B-INSTANCE-01 重新开放

新增 service `reopenTaskInstance(id, userId)`：
- 拉 instance 校验 createdBy / collab（复用 `isAuthorizedForInstance`）
- status 必须为 `closed` 才能 reopen，否则 `INVALID_STATUS` 错误
- update status = "published" + 写 audit `task_instance.reopen` metadata={previousStatus: closed}

新路由 `app/api/lms/task-instances/[id]/reopen/route.ts`：POST 调 service。独立路由理由：audit action 名 + 权限审查更清晰，便于后续协作者权限上扬（Unit 5c）。

UI：
- `InstanceHeader` closed 状态时展示 "重新开放" + "删除实例" 按钮组（替代原 published 时的 "关闭实例 / 开始批改" 按钮组）
- 列表页 closed tab 行尾加同样两个按钮

### B-INSTANCE-03 删除

`deleteTaskInstance` 加预校验：
- status 不在 `[draft, closed]` → throw `INVALID_STATUS`（不允许删除 published / archived，演示安全）
- `submissionCount > 0` → throw `INSTANCE_HAS_SUBMISSIONS`
- 通过则 cascade delete（schema 已配 cascade，Submission/Analytics/Report 自动级联）
- audit 写 `task_instance.delete`

UI：
- closed/draft 状态下显示「删除实例」按钮
- 点击 → AlertDialog 二级确认："删除后无法恢复，确认删除？"
- submissionCount > 0 时按钮 disabled + tooltip "已有学生提交，无法删除"
- 删除成功 → 列表页内 toast + 刷新；详情页 router.push("/teacher/instances")

错误码 → 中文映射（`lib/api-utils.ts handleServiceError`）：
- `INVALID_STATUS` → "当前状态不允许此操作"
- `INSTANCE_HAS_SUBMISSIONS` → "该实例已有学生提交，无法删除"

## 风险点

1. **学生侧 reopen 可见性**（中风险）：reopen 后 status → published，`assertTaskInstanceReadable` L43 已检查 status==="published"。理论上学生应能立刻看到。**自测必验**：alex/belle 账号在 reopen 前打开任务页（应 403），reopen 后刷新（应可见）。
2. **删除前 submission 计数走 DB**（低风险）：service 内直接 `prisma.submission.count({where: {taskInstanceId: id}})`，无 cache 层。
3. **`handleServiceError` 错误码扩**（低）：新增 `INVALID_STATUS` `INSTANCE_HAS_SUBMISSIONS` 映射 + Chinese msg。
4. **AlertDialog 嵌套**（极低）：列表页可能同时打开 close + delete dialog（不可能，单 state 互斥），无并发问题。
5. **不动 schema**：closedAt 字段未实际存在，spec 文字与代码错位，已澄清。审计追责走 AuditLog.createdAt。
6. **anti-regression**：现有 `updateTaskInstance` 路径仍能改 status，但本 unit 不在该路径加 audit（保守，避免误改造调用方）。统一关闭/重开走新路径触发 audit。

## 自测计划

### 自动化
1. `npx tsc --noEmit` 全项目 type check
2. `npx vitest run` 全套（无回归）
3. 新 e2e spec `tests/e2e/unit2-verify.spec.ts`：
   - molly 登录 → 创建一个 published 实例（or 用现有 fixture） → 点关闭 → 验弹窗 + 取消 + 再点 + 确认
   - 关闭后页面显示「重新开放」+ 「删除实例」按钮
   - 点重新开放 → 状态回 published + 显示 "关闭实例"
   - 关闭并 0 submission → 点删除 → 弹窗 → 确认 → 列表页跳转

### 手动验证（关键）
1. alex 学生 → `/sim/<instanceId>` 或 `/tasks/<instanceId>`：reopen 前 403 / reopen 后正常打开（验证 schema 已对齐学生可见性）
2. 已有 submission 的实例：删除按钮 disabled，tooltip 中文
3. audit log 查询：`SELECT * FROM "AuditLog" WHERE action LIKE 'task_instance.%' ORDER BY "createdAt" DESC LIMIT 5` 看到 close/reopen/delete 三条

## diff 预算

预计 ≤ 250 行（service +60 / route +30 / instance-header +50 / detail page +40 / list tab +60 / 错误码映射 +5 / e2e spec ~100）。
单一 commit。

## 不做的范围（防 scope creep）

- 协作者权限上扬：Unit 5c 单独做
- 课程归档 / 任务模板删除：Unit 5a 做
- archived 状态归档行为：未要求，保持现状
- closedAt 字段：schema 不动，跳过
