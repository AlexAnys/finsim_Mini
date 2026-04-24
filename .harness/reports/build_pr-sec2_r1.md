# Build Report — PR-SEC2 r1

**Unit**: `pr-sec2` / 系统性扫描并修复 by-id GET 端点缺失访问守护
**Round**: r1
**Builder**: builder-p3
**Date**: 2026-04-24

## 背景

PR-SEC1 修了 `/api/lms/courses/[id]` GET 的 auth 漏洞。qa-p3 在 SEC1 的 QA 报告里强烈建议系统扫描同类漏洞。team-lead 授权执行 PR-SEC2。

## Scan 结果

扫描 `app/api/**/[id*]/route.ts` 下所有 GET handlers，**确认 8 个端点存在 cross-account 可越权**。真 curl（teacher2 登录，访问 teacher1 资源）验证 **全部返回 200**：

| # | 端点 | 原行为 |
|---|---|---|
| 1 | `GET /api/lms/task-instances/[id]` | 200（任何登录用户可读任意实例） |
| 2 | `GET /api/lms/task-instances/[id]/insights` | 200（教师可读任意班级分析） |
| 3 | `GET /api/lms/courses/[id]/teachers` | 200（教师可读任意课程协作教师列表） |
| 4 | `GET /api/lms/courses/[id]/classes` | 200（教师可读任意课程班级列表） |
| 5 | `GET /api/lms/classes/[id]/members` | 200（教师可读任意班级学生花名册） |
| 6 | `GET /api/tasks/[id]` | 200（任何登录用户可读任意任务模板） |
| 7 | `GET /api/submissions/[id]` | 200（任何登录用户可读任意提交） |
| 8 | `GET /api/import-jobs/[id]` | 200（教师可读其他教师的导入任务） |

不动的端点（既有守护 / 非 GET / schema 不支持的）：
- `app/api/groups/[id]` — 只有 PATCH/DELETE，无 GET
- `app/api/lms/content-blocks/[id]/markdown` — 只有 PUT（写入端不在 SEC2 scope）
- `app/api/lms/schedule-slots/[id]` — 只有 DELETE
- `app/api/lms/task-instances/[id]/publish` — 只有 POST
- `app/api/submissions/[id]/grade` — 只有 POST

## Files changed

### 新建

- `lib/auth/resource-access.ts` — 6 个纯函数（复用 SEC1 的 `assertCourseAccess`）：
  - `assertTaskInstanceReadable` — teacher 走 createdBy 或 course 访问；student 要求 classId 匹配 + status=published
  - `assertTaskInstanceReadableTeacherOnly` — 同上但 student 短路 FORBIDDEN（用于 insights）
  - `assertTaskReadable` — teacher 走 creator 或 course 访问；student 要求"有已发布实例在自己班"
  - `assertClassAccessForTeacher` — 教师必须教过该班的任一课程（主班或次班）
  - `assertSubmissionReadable` — 学生只看自己提交；教师走 task.creator 或 instance 的课程访问
  - `assertImportJobReadable` — 仅 `job.teacherId === userId` 或 admin

- `tests/resource-access.test.ts` — **35 单测**覆盖 6 guard 的所有分支

### 改

- `lib/api-utils.ts` — 在 `handleServiceError` 添加错误码映射：`INSTANCE_NOT_FOUND` / `TASK_NOT_FOUND` / `SUBMISSION_NOT_FOUND` / `JOB_NOT_FOUND` → 404
- 8 个 Route Handler：各在 GET 里加一行/三行 guard 调用：
  - `app/api/lms/task-instances/[id]/route.ts` + import `assertTaskInstanceReadable`
  - `app/api/lms/task-instances/[id]/insights/route.ts` + import `assertTaskInstanceReadableTeacherOnly`
  - `app/api/lms/courses/[id]/teachers/route.ts` + import `assertCourseAccess` 显式 + 调用
  - `app/api/lms/courses/[id]/classes/route.ts` + 调用 `assertCourseAccess`（import 已存在）
  - `app/api/lms/classes/[id]/members/route.ts` + import `assertClassAccessForTeacher`
  - `app/api/tasks/[id]/route.ts` + import `assertTaskReadable` + try/catch
  - `app/api/submissions/[id]/route.ts` + import `assertSubmissionReadable` + try/catch
  - `app/api/import-jobs/[id]/route.ts` + import `assertImportJobReadable`

严格限 GET 一个方法：**PATCH/POST/DELETE 完全不动**（team-lead 明令）。

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS（0 errors） |
| `npx vitest run` | PASS 208/208（173 → 208，+35 新测试） |
| `npm run build` | PASS（25 routes emit） |

### 真 curl 16 场景矩阵

6 个关键漏洞端点，每个跑 2-3 个场景（跨户 403 / 自己 200 / 学生合法 200 / 学生越权 403 / 未登录 401），全部对齐预期：

```
=== teacher2 → teacher1 resources (should all 403) ===
  task-instances/{T1}                 403 ✓
  task-instances/{T1}/insights        403 ✓
  courses/{T1}/teachers               403 ✓
  courses/{T1}/classes                403 ✓
  classes/{T1_class}/members          403 ✓
  tasks/{T1_task}                     403 ✓

=== teacher1 → own (should all 200) ===
  task-instances/{T1}                 200 ✓
  task-instances/{T1}/insights        200 ✓
  courses/{T1}/teachers               200 ✓
  courses/{T1}/classes                200 ✓
  classes/{T1_class}/members          200 ✓
  tasks/{T1_task}                     200 ✓

=== student1 regression ===
  task-instances/{T1} (same class)    200 ✓
  tasks/{T1_task} (assigned)          200 ✓
  task-instances/{T1}/insights        403 ✓  (teacher-only, student rejected)

=== unauthenticated ===
  tasks/{T1_task}                     401 ✓
```

## Design decisions

### 为什么需要 resource-access.ts 而不是全部复用 assertCourseAccess

5 个端点能直接套 `assertCourseAccess`（课程相关）；但：
- TaskInstance 有 `classId / courseId / createdBy` 三维权限，学生看本班已发布即可
- Task 模板可能没 courseId（standalone），得通过 TaskInstance 间接派生
- Submission 是 `studentId + taskInstanceId`，学生只看自己
- Class.members 关系是"教师有教该班的课"
- ImportJob 直接 `teacherId`，简单所有权

把这些语义分散塞到各 Route Handler 里会重复代码 + 测试困难；集中在 `resource-access.ts` 更干净。

### Student vs Teacher 分支

- Teacher 路径尽量复用 `assertCourseAccess`，保证跟 SEC1 一致的"owner/collab/admin"语义
- Student 路径根据资源性质：
  - `task-instance` → classId + status=published
  - `task` → 必须有已发布实例在自己班
  - `submission` → studentId owned
  - `insights` → 直接禁
  - `class members` / `course teachers` / `course classes` / `import-job` → 不对学生开放（这 4 个连默认 `requireRole` 也把 student 挡外了，无需重覆）

### Fail-closed

所有 guard 在 "用户信息缺失"（如 student.classId=null）时**短路 FORBIDDEN**，不做 DB 查询。

## Anti-regression

- 8 个 Route Handler 的 PATCH/POST/DELETE 分支零动
- `lib/auth/course-access.ts` 零改（SEC1 提供的函数只被引用，不修改）
- `lib/auth/guards.ts` 零改（re-export 继续工作）
- 既有 test 173 个全部通过（0 degradation）
- 学生合法场景真 curl 验证未破（`/api/lms/task-instances/{id}` 学生自己班 200；`/api/tasks/{id}` 学生有已发布实例的 200）
- 教师自己资源真 curl 验证未破（6 个端点全 200）
- 服务层零改，schema 零改，auth 流程零改（仅在 Route Handler 加 guard 调用）

## Dev server

**无需重启**。零 schema / 零 Prisma client 改动。新增 auth helper 文件 + Route Handler 加 guard 调用，已 live 验证。

## Deferred / uncertain

1. **Task.visibility 字段未启用**：Task schema 有 `visibility: Visibility` 枚举（private/shared/department/public），但 `assertTaskReadable` 目前不查。如果未来要支持"公共/部门级共享模板"，需扩展此 guard。本 r1 用 conservative 语义（creator / 有课程访问的教师 / 有对应实例的学生），对应默认 `private`。
2. **Submission 学生分享**：当前学生只能看自己的提交。如果未来要支持"同班学生看彼此提交"（如 peer review），需扩展 guard。
3. **ImportJob 扫描里没有跨 teacher 共享**：目前策略最严格（仅 job owner）。符合 PR-SEC1 的"fail-closed" 路线。
4. **`content-blocks` 没有 GET**：schema 允许 block 有 6 类型，目前只有 markdown 的 PUT 端点。即便未来补 GET，PUT 本身是写入端不在 SEC2 scope。SEC2 r1 不触碰。

## Notes for QA

- **关键路径**：上述 16 场景 curl 矩阵；另可 `/cso` 对 auth 层改动做一轮（虽然是 additive guard，STRIDE Info Disclosure 视角建议走一下）。
- **回归守护**：
  - 教师自己资源 6 个端点全 200
  - 学生合法 GET task-instance / task 仍 200
  - 学生越权 insights 403
  - PATCH / POST / DELETE 全部分支未改（可运行既有测试套件确认）
- 改动文件数：1 新 lib + 1 改 api-utils + 8 改 Route Handler + 1 新 test。diff 约 +370 行 src/test，非常紧凑。

## Summary

PR-SEC2 r1 闭环 qa-p3 强烈建议的系统扫描。**6 个守护 + 8 个端点 + 35 新测试 + 16 live 场景对齐预期**。SEC1 单点修复 → SEC2 系统加固的收敛路径完成。tsc / vitest / build / live 四绿；无任何回归。

动态 exit 这一轮应该是 5 连 PASS（如 QA 通过）。
