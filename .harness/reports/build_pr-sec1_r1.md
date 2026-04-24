# Build Report — PR-SEC1 r1

**Unit**: `pr-sec1` / `/api/lms/courses/[id]` GET 缺 `assertCourseAccess`（P1 安全修复）
**Round**: r1
**Builder**: builder-p3
**Date**: 2026-04-24

## 背景

qa-p3 在 PR-3C r1 QA 时独立发现 pre-existing P1 安全漏洞（见 `.harness/reports/qa_pr-3c_r1.md` §Issues found）：

- `app/api/lms/courses/[id]/route.ts:10` GET 方法 **没调用 `assertCourseAccess`**
- 任何登录用户都能读取任意课程的 `chapters / sections / contentBlocks / taskInstances` 等完整结构
- PATCH 方法早已守护，但 GET 孤立遗漏
- 不是 PR-3C 引入（PR-3C 零 API 改动）；PR-1B 当初只缩紧了 `/api/lms/dashboard/summary` 和 `/api/lms/courses` list，没扩到 by-id GET

## 难点：学生合法场景

naive 地直接套用 `assertCourseAccess`（owner/CourseTeacher 路径）会一刀切禁掉所有学生，但学生合法需要读自己班的课程详情（`app/(student)/courses/[id]/page.tsx:69` 就在调用）。因此需要 **角色感知** 的 guard：

- **teacher / admin**：走 owner + CourseTeacher 路径（与 PATCH 一致）
- **student**：走主班（`Course.classId`）+ CourseClass 次班路径

## Files changed

### 改

- `lib/auth/course-access.ts` — 新增两个导出函数：
  - `assertCourseAccessForStudent(courseId, classId)`：主班 + CourseClass 次班；空 classId 短路 FORBIDDEN
  - `assertCourseReadable(courseId, user)`：按 `user.role` 分派到 teacher 或 student 路径
  - 原 `assertCourseAccess` 签名 / 行为不改（保持对现有 5 个 caller 的兼容）
- `app/api/lms/courses/[id]/route.ts`：
  - 替换 import：`assertCourseAccess` 从 guards 改为直接从 course-access（一致性）+ 新增 `assertCourseReadable`
  - GET handler 加入：`await assertCourseReadable(id, { id, role, classId })` 在 `getCourseWithStructure` 调用前

### 新

- `tests/course-access-readable.test.ts` — 11 个单测覆盖：
  - `assertCourseAccessForStudent` 5 case：空 classId / 主班 / CourseClass 次班 / 不匹配 / 课程不存在
  - `assertCourseReadable` 6 case：admin 直通 / teacher owner 直通 / teacher 跨户 FORBIDDEN / student 主班 / student 跨班 FORBIDDEN / student 无 classId 短路

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS（0 errors） |
| `npx vitest run` | PASS 173/173（162 → 173，+11 新测试） |
| `npm run build` | PASS（25 routes emit） |

### 真实复现原 bug + 验证修复

6 场景 live curl（全部对齐预期）：

| 场景 | 期望 | 实际 |
|---|---|---|
| teacher2 → teacher1 course（**原 P1 bug 复现**） | 403 | **403** ✓ |
| teacher1 → own course | 200 | **200** ✓ |
| teacher2 → own course | 200 | **200** ✓ |
| student1 → own class course（**回归守护**） | 200 | **200** ✓ |
| student1 → 跨班 course | 403 | **403** ✓ |
| 未登录 | 401 | **401** ✓ |

## Anti-regression

- `assertCourseAccess` 签名 / 调用方式不变，原 5 个 callers（PATCH handler / courses sub-routes / batch-semester / course-access unit test / guards re-export）零影响
- guards.ts 的 re-export `assertCourseAccess` 保留（任何从 guards 导入的老代码仍然工作）
- 学生 `/courses/[id]` 页面无需任何改动（真 curl 验证 student1 → own course 仍 200）
- 教师 `/teacher/courses/[id]` 页面无需任何改动（真 curl 验证 teacher1 → own course 仍 200）
- 无 schema 改动，无 service 改动（仅 auth 层扩展 + Route Handler 加一行）

## Dev server

**无需重启**。零 schema / 零 Prisma client 改动。仅新增 auth helper + Route Handler 调用。

## Security posture

- **原 P1 已闭环**：teacher2 真登录试探 teacher1 课程 ID 确认返回 403（不再是 200）
- student 保持最小权限（只能读自己主班 + CourseClass 次班的课）
- admin 仍直通（不需要 classId，`user.classId = null` 的 admin 一样通过 teacher 分支）
- 未登录 401 仍正常

## Deferred / uncertain

1. 本 PR 只修 `/api/lms/courses/[id]` GET。qa-p3 发现这一个，**但同类型 "单条 GET 未 guard" 漏洞可能存在于其他 by-id 端点**（例如 `/api/lms/task-instances/[id]` / `/api/lms/chapters/[id]` 等）。建议 coordinator 在独立 PR-SEC2 做系统扫描，一次性收敛。本 r1 scope 严格限定在 qa-p3 指出的单一端点。
2. `assertCourseReadable` 目前对 `user.classId` 取自 session 的 `classId`（string | null）。如果未来引入学生多班（`StudentClass` 多对多表），此 guard 需扩展成查表。当前单班模型下足够。

## Notes for QA

- 关键路径：上面 6 场景 live curl 的预期 vs 实际表。qa-p3 请用 gstack `/cso` 做一轮安全审计（因为是 auth 层改动，触发 /cso 条件）。
- 路径：改动集中在 2 个文件，共 **+19 行 src + 135 行 test**，diff 极小；对全仓其他代码零风险。
- 单测覆盖率：`assertCourseAccessForStudent` 5 case、`assertCourseReadable` 6 case，含 "无 classId 短路" 边界。

## Summary

PR-SEC1 r1 闭环 qa-p3 发现的 P1 漏洞。**角色感知 guard 方案**避免一刀切禁掉学生合法场景；6 真 curl 场景对齐预期（teacher 跨户 200 → 403；学生主班仍 200；学生跨班 403）；tsc / vitest / build / live 四绿；无任何回归。
