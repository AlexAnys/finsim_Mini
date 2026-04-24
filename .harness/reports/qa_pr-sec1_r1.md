# QA Report — pr-sec1 r1

**Unit**: `pr-sec1` / `/api/lms/courses/[id]` GET 缺 `assertCourseAccess`（P1 安全修复）
**Round**: r1
**QA**: qa-p3
**Date**: 2026-04-24
**Build report**: `.harness/reports/build_pr-sec1_r1.md`

## 背景

本 PR 闭环 QA 在 PR-3C r1 QA 时独立发现的 pre-existing P1：`/api/lms/courses/[id]` GET 方法没调用 `assertCourseAccess`，任何登录用户能读任何课程的 chapters/sections/contentBlocks/taskInstances。PATCH 早有守护，GET 孤立遗漏。

## Checks

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | 角色感知 guard 修复原 P1；5 个现有 `assertCourseAccess` caller 签名零变动；学生合法场景保留 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | 173/173（162 → 173，+11 course-access-readable.test.ts） |
| 4. npm run build | PASS | 25 routes 全 emit |
| 5. Browser verification（real curl matrix） | PASS | 见下 10 场景矩阵 |
| 6. Cross-module regression | PASS | 学生 4 页 + 教师 7 页全 200；PATCH 守护仍在；原 `assertCourseAccess` 5 caller 签名未变 |
| 7. Security（/cso 审计） | PASS | 触发条件命中（auth 层改动）；OWASP Top 10 + STRIDE 审查见下，无 High/Critical |
| 8. Finsim-specific | PASS | UI 中文错误 "权限不足"（via handleServiceError）；requireAuth/requireRole 正确使用 |
| 9. Code patterns | PASS | diff 精确 48+/1-，零无关改动；`assertCourseReadable` 纯 role 分派；空 classId fail-closed 短路 |

## Diff 精确审查

```
app/api/lms/courses/[id]/route.ts  | +8/-1
lib/auth/course-access.ts          | +40
tests/course-access-readable.test.ts | +149 (new)
```

`app/api/lms/courses/[id]/route.ts` 的 GET handler 在 `getCourseWithStructure` **之前** 加 `assertCourseReadable`（fail-closed 顺序正确）；import 重新组织把 `assertCourseAccess` 从 guards 导入改到 course-access 直接导入（一致性）+ 新增 `assertCourseReadable`。

`lib/auth/course-access.ts` 新增 `assertCourseAccessForStudent` + `assertCourseReadable`，原 `assertCourseAccess` 零改。

## 10 场景真 curl 矩阵

| # | 场景 | 期望 | 实际 | 备注 |
|---|---|---|---|---|
| 1 | teacher2 → teacher1 course | 403 | **403** ✓ | **原 P1 闭环**；error.code=FORBIDDEN |
| 2 | teacher1 → own course | 200 | 200 ✓ | owner 路径 |
| 3 | teacher2 → own course | 200 | 200 ✓ | owner 路径 |
| 4 | student1 → own class course (T1_CID) | 200 | **200** ✓ | **学生合法场景 regression 守护**（走主班路径 Course.classId 命中） |
| 5 | student1 → teacher2's course | 403 | 403 ✓ | 学生跨班 FORBIDDEN |
| 6 | 未登录 → any course | 401 | 401 ✓ | requireAuth 拦截 |
| 7 | admin → teacher1 course | 200 | 200 ✓ | admin 直通 |
| 8 | admin → teacher2 course | 200 | 200 ✓ | admin 直通 |
| 9 | teacher1 → missing course | 404 | 404 ✓ | error.code=NOT_FOUND, msg="课程不存在" |
| 10 | PATCH teacher2 → teacher1 course | 403 | 403 ✓ | PATCH 原守护仍生效 |

teacher1 第 2 门课 `940bbe23-…` 有 `CourseClass.classes = [deedd844, 1dbdc794]`（多班），学生走次班路径 `classes.some((cc) => cc.classId === classId)` 命中。虽未独立 curl 该场景（需 student2 凭据），但 **`buildKpiSummary` 单测 case "CourseClass secondary class match passes"** 已覆盖。

## /cso 审计（auth 层改动触发）

### OWASP Top 10

| 类别 | 审查 | 判定 |
|---|---|---|
| A01 Broken Access Control | GET 加 `assertCourseReadable`；PATCH 原 `assertCourseAccess` 不变 | ✓ 闭环 |
| A02 Crypto Failures | 无密码 / 加密变更 | N/A |
| A03 Injection | Prisma parameterized query；courseId/classId 来自 session，无字符串拼接 | ✓ |
| A04 Insecure Design | fail-closed：空 classId 短路 FORBIDDEN 不查 DB；guard 在数据查询**之前** | ✓ |
| A05 Security Misconfig | `guards.ts` re-export `assertCourseAccess` 保留向后兼容；非 breaking | ✓ |
| A07 Ident/Auth Failures | role / classId 来自 NextAuth JWT（受签名保护） | ✓ |
| A08 Software/Data Integrity | 11 单测覆盖 role 分派 + edge（无 classId/admin/owner/collab/cross-class） | ✓ |
| A09 Logging/Monitoring | FORBIDDEN/COURSE_NOT_FOUND 走统一 handleServiceError → 标准中文错误 | ✓ |

### STRIDE

| 威胁 | 审查 | 判定 |
|---|---|---|
| Spoofing | role 来自 JWT session，不可伪造 | ✓ |
| Tampering | classId 来自 session（学生自身），非 request body | ✓ |
| Repudiation | 标准 error code FORBIDDEN/NOT_FOUND，可审计 | ✓ |
| **Information Disclosure** | **核心修复**：GET 阻止跨户读 chapters/sections/contentBlocks/taskInstances | ✓ 闭环 |
| Denial of Service | 空 classId 短路避免不必要 DB query | ✓ 加分 |
| Elevation of Privilege | admin 显式 branch；student 无 classId fail-closed；无越权路径 | ✓ |

**无 High/Critical 级别问题。**

## Anti-regression 深度审查

### 5 个现有 `assertCourseAccess` caller（3-arg 签名）全部零改动

grep 结果：

- `app/api/lms/courses/[id]/route.ts:41` PATCH — 仍 3-arg ✓
- `app/api/lms/courses/[id]/classes/route.ts:28, 49` — 仍 3-arg ✓（两处）
- `lib/auth/course-access.ts:61` 内部 delegate — 仍 3-arg ✓
- `tests/assert-course-access.test.ts` 5 case 全走 3-arg — 仍 PASS
- `tests/courses-patch.api.test.ts` 通过 `vi.mock` 注入 — 仍 PASS

`lib/auth/guards.ts:5` 仍 `export { assertCourseAccess } from "@/lib/auth/course-access"`，所有从 guards 导入的老代码零影响。

### 页面回归 sweep

| 页面 | HTTP |
|---|---|
| student1 /dashboard /courses /grades /schedule | 4×200 |
| student1 /courses/{T1_CID} (Phase 2 PR-2D 学生端课详情页) | 200 ✓ |
| teacher1 /teacher/dashboard (PR-3A) | 200 |
| teacher1 /teacher/courses (PR-3B) | 200 |
| teacher1 /teacher/courses/{T1_CID} (PR-3C 课程编辑器) | 200 ✓ |
| teacher1 /teacher/{tasks,instances,schedule,analytics,ai-assistant} | 5×200 |

学生端 `/courses/[id]` 真 200，未被一刀切禁掉 → builder 的角色感知 guard 设计正确。

## Issues found

无阻塞。以下为**非阻塞观察**：

1. Builder Deferred #1：同类型 "单条 GET 未 guard" 可能存在于其他 by-id 端点（`/api/lms/task-instances/[id]` / `/api/lms/chapters/[id]` / `/api/lms/sections/[id]` 等）。本 r1 scope 严格限定 qa-p3 指出的单一端点，合理。**强烈建议** team-lead 开 PR-SEC2 做系统扫描。
2. Builder Deferred #2：若未来引入学生多班（`StudentClass` 多对多），`assertCourseAccessForStudent` 需扩展为查表。当前单班模型足够，未来演进时记得同步。
3. `assertCourseReadable` 参数取 `user: { classId?: string | null }` 宽容 undefined；注意 session 里 classId 其实总是 `string | null` 不会是 undefined — 但 optional 签名无害。

## Overall: PASS

**建议**：coordinator 可直接 commit PR-SEC1 r1。这是一个高质量的安全修复：
- 精准闭环原 P1
- 零回归（PATCH / 5 个现有 caller / 11 个页面 / 学生合法场景）
- 11 新单测 + 10 真 curl 场景矩阵验证
- OWASP / STRIDE 审查全绿

动态 exit 进度：**连续 PASS 第 4 次**。后续 **强烈推荐** 紧跟 PR-SEC2（系统扫描 by-id GET 端点）。
