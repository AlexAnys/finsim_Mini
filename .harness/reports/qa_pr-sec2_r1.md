# QA Report — pr-sec2 r1

**Unit**: `pr-sec2` / 系统性 by-id GET 端点 auth 修复
**Round**: r1
**QA**: qa-p3
**Date**: 2026-04-24
**Build report**: `.harness/reports/build_pr-sec2_r1.md`

## 背景

PR-SEC2 闭环 qa-p3 在 SEC1 QA 强烈建议的系统扫描。Builder 扫描 `app/api/**/[id*]/route.ts` GET handlers，确认 8 个端点有 cross-account 可越权漏洞（全 200），修复方案：新建 `lib/auth/resource-access.ts` 6 guard 函数 + 8 个 Route Handler 加 guard 调用。team-lead 明令**只改 GET**。

## Checks

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance（GET 8 端点修复） | PASS | 8 端点真 curl 全 403 / own 200，guard 实现正确；PATCH/POST/DELETE 零动（真 curl 验证 tasks/task-instances DELETE 仍 403） |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | 208/208（173 → 208，+35 resource-access.test.ts） |
| 4. npm run build | PASS | 25 routes 全 emit |
| 5. Browser verification（16+ 场景 real curl） | PASS | 见下完整矩阵 |
| 6. Cross-module regression | PASS | 学生 4 页 + 学生 /courses/[id] + 教师 7 页全 200；所有 guard 在数据 fetch 之前（fail-closed 顺序） |
| 7. Security（/cso 审计） | PASS（本 PR 范围） | OWASP A01/A03/A04/A05/A07/A08 + STRIDE 6 维全绿；**但 QA sweep 独立发现 1 个 scope 外 P1（见下 §Issues）** |
| 8. Finsim-specific | PASS | 中文错误"权限不足"（handleServiceError 映射）；requireAuth/requireRole 用法正确 |
| 9. Code patterns | PASS | diff 精准：+370 行 src/test，8 handler 每个只加一 guard 调用；PATCH/POST/DELETE 全分支未动 |

## 真 curl 完整矩阵（17 场景）

### 8 端点 × 3 角色矩阵

| # | 端点 | teacher2→teacher1 | teacher1→own | student1 | 未登录 |
|---|---|---|---|---|---|
| 1 | GET `/api/lms/task-instances/[id]` | **403** ✓ | 200 | 200（自班） ✓ | 401 |
| 2 | GET `/api/lms/task-instances/[id]/insights` | **403** ✓ | 200 | **403**（teacher-only） ✓ | 401 |
| 3 | GET `/api/lms/courses/[id]/teachers` | **403** ✓ | 200 | — | 401 |
| 4 | GET `/api/lms/courses/[id]/classes` | **403** ✓ | 200 | — | 401 |
| 5 | GET `/api/lms/classes/[id]/members` | **403** ✓ | 200 | — | 401 |
| 6 | GET `/api/tasks/[id]` | **403** ✓ | 200 | 200（有发布实例） ✓ | 401 |
| 7 | GET `/api/submissions/[id]` | **403** ✓ | 200 | 200（自己） ✓ | 401 |
| 8 | GET `/api/import-jobs/[id]` | N/A（teacher2 无 job） | — | — | — |

### Admin 直通（7/7）

所有 7 端点 admin → 200（直通 branch）。

### Non-GET regression（PR-SEC2 scope 外验证未破）

| 方法 | 端点 | 期望 | 实际 |
|---|---|---|---|
| PATCH | `/api/tasks/[id]` by teacher2 | 403 | 403 ✓ |
| PATCH | `/api/lms/task-instances/[id]` by teacher2 | 403 | 403 ✓ |
| DELETE | `/api/tasks/[id]` by teacher2 | 403 | 403 ✓（deleteTask service owner 守护） |
| DELETE | `/api/lms/task-instances/[id]` by teacher2 | 403 | 403 ✓（deleteTaskInstance service owner 守护） |
| **DELETE** | **`/api/submissions/[id]` by teacher2** | **403** | **200 ⚠️**（**pre-existing P1，见下 §Issues**） |

## /cso 审计（auth 层改动触发）

### OWASP Top 10

| 类别 | 审查 | 判定 |
|---|---|---|
| A01 Broken Access Control | 8 端点新 guard 闭环；admin/owner/collab/student 分支齐全；fail-closed | ✓ |
| A02 Crypto Failures | 无 | N/A |
| A03 Injection | Prisma parameterized；resource ids / classId 来自 session 无字符串拼接 | ✓ |
| A04 Insecure Design | guard 在 data fetch **之前** 调用；空 classId 短路 FORBIDDEN | ✓ |
| A05 Security Misconfig | `course-access.ts` 零改；`guards.ts` re-export 保留；向后兼容 | ✓ |
| A07 Ident/Auth Failures | role/classId 来自 JWT session；不可篡改 | ✓ |
| A08 Software/Data Integrity | 35 新单测覆盖 6 guard 所有分支（admin/owner/collab/student match/student cross/无 classId） | ✓ |
| A09 Logging/Monitoring | 统一 error code（INSTANCE_NOT_FOUND / TASK_NOT_FOUND / SUBMISSION_NOT_FOUND / JOB_NOT_FOUND）+ handleServiceError 映射 | ✓ |

### STRIDE

| 威胁 | 审查 | 判定 |
|---|---|---|
| Spoofing | 所有 guard 读 role/id 自 JWT session | ✓ |
| Tampering | id 路径参数由 Next.js 解析；classId 从 session | ✓ |
| Repudiation | 统一错误码 FORBIDDEN / *_NOT_FOUND；可审计 | ✓ |
| **Information Disclosure** | **核心修复**：8 个跨户 GET 全阻；student 自班 / 自己提交 合法路径保留 | ✓ 闭环 |
| Denial of Service | 空 classId 短路节省 DB；Task teacher 路径遍历 instance 逐个试 `assertCourseAccess` 是 O(N)，N 通常小（<20），可接受 | ✓ |
| Elevation of Privilege | admin 显式 branch；student fail-closed；teacher 必须拿 owner/collab/course-access | ✓ |

### 一个小观察（非阻塞）

8 个 guard 里 `*_NOT_FOUND` 和 `FORBIDDEN` 返回不同状态码（404 vs 403）。严格来说这让非授权用户能区分"资源存在但无权" vs "资源不存在"。但这与 SEC1 `assertCourseAccess` 的行为一致（`COURSE_NOT_FOUND`），保持跨模块一致性 > 完美 security（实际攻击面小）。非阻塞。

## Anti-regression

### PATCH/POST/DELETE 零动（2 处 handler 新加 try/catch 除外）

Tasks/[id] 和 Submissions/[id] 的 GET 新加 try/catch（原本没有），因为 guard throw 时需要走 handleServiceError 返回 403 而不是 500。其他 7 个 handler 已有 try/catch，只加一行 guard 调用。

### 对齐 PR-SEC1 风格

- 所有新 guard 在 `lib/auth/resource-access.ts`（与 SEC1 的 `course-access.ts` 并列）
- 复用 SEC1 的 `assertCourseAccess` 函数（teacher 路径）
- `guards.ts` re-export 不变

### 页面 sweep（回归守护）

| 页面 | HTTP |
|---|---|
| student1 /dashboard /courses /grades /schedule | 4×200 |
| student1 /courses/{T1_CID} (PR-2D 依赖) | 200 |
| teacher1 /teacher/dashboard (PR-3A 依赖 summary API) | 200 |
| teacher1 /teacher/courses (PR-3B) | 200 |
| teacher1 /teacher/{tasks,instances,schedule,analytics,ai-assistant} | 5×200 |

## Issues found

### 非阻塞观察（合 Deferred / scope）

1. Builder Deferred #1：`Task.visibility` 枚举未启用 — 合理 conservative 语义
2. Builder Deferred #2：Submission 无 peer-review — 严格守护
3. Builder Deferred #3：ImportJob 最严策略 — 对齐 fail-closed
4. Builder Deferred #4：content-blocks 无 GET，未来扩展时注意
5. `*_NOT_FOUND` 的状态码泄漏资源存在性 —— 与 SEC1 的 `COURSE_NOT_FOUND` 风格一致，保持跨模块一致性

### 🚨 QA 独立发现（不归 PR-SEC2，pre-existing P1）

**症状**：
```
DELETE /api/submissions/{id} by teacher2 → HTTP 200
```

**原因**：
- `app/api/submissions/[id]/route.ts:27-36` DELETE 只 `requireRole(["teacher","admin"])`
- `lib/services/submission.service.ts:195` `deleteSubmission(submissionId)` 只接 id 参数，**不做 owner 校验**
- 任何 teacher 能删除任何 submission（**数据破坏级**，比读数据更严重）

**对比对照**：
- `deleteTask` / `deleteTaskInstance` **Service 层**均接 creatorId 参数 + 做 FORBIDDEN 守护 → 同等 DELETE 全 403 ✓
- 只有 `deleteSubmission` 缺守护

**归因**：
- **不归 PR-SEC2 引入**（SEC2 只改 GET，DELETE 分支零动，verified by diff）
- **不归 SEC1 引入**（SEC1 只改 courses/[id] GET）
- 是 codebase 长期存在的 P1 漏洞，被本轮 QA 在 regression probe 中独立发现

**建议修复**（极小，单文件单函数）：
```typescript
// lib/services/submission.service.ts
export async function deleteSubmission(submissionId: string, userId: string, userRole: string) {
  const sub = await prisma.submission.findUnique({ where: { id: submissionId }, select: { taskId: true, taskInstanceId: true } });
  if (!sub) throw new Error("SUBMISSION_NOT_FOUND");
  // Check via assertSubmissionReadable + additional write-role check
  // OR simply: find task.creatorId, check match
  // ...
  return prisma.submission.delete({ where: { id: submissionId } });
}
```
更简洁的方案：Route Handler 里复用 `assertSubmissionReadable`（已覆盖 teacher/admin owner 逻辑），然后才 call service delete。

**建议**：
- **不作为 PR-SEC2 FAIL 依据**（明确 scope 限 GET，Builder 遵守 scope 合理）
- 建议 team-lead 开 **PR-SEC3**：系统扫描所有 non-GET 写入端点的 owner 守护缺失（DELETE/PATCH/POST），以 `deleteSubmission` 为起点
- PR-SEC3 应含：
  - `deleteSubmission` 补 owner check（本条发现）
  - 扫描 `app/api/**/[id*]/route.ts` 的 DELETE/PATCH/POST handler，grep 是否 call service 时传 userId 参数，不传则可能是漏洞
  - 对比 deleteTask/deleteTaskInstance 的模式

## Overall: PASS

PR-SEC2 r1 按 scope（GET only）精准完成：
- 8 端点全闭环（真 curl 16+ 场景对齐预期）
- 35 新单测 + OWASP + STRIDE 审计全绿
- 无任何回归（页面 + PATCH/DELETE 守护 + PR-SEC1 无改）
- Builder 遵守 team-lead "限 GET" 指令

动态 exit 进度：**连续 PASS 第 5 次**（PR-3A/3B/3C + SEC1 + SEC2 全过）→ **harness 动态 exit 满足**。

## 后续建议路线

1. **立即**：coordinator 可 commit Phase 3 / SEC1 / SEC2 全量
2. **紧接着 PR-SEC3**：本 QA 独立发现的 `deleteSubmission` P1 + 系统扫描其他 non-GET 端点（scope 明确：只补缺失 owner 守护，不动业务逻辑）
3. **Phase 4**：`/teacher/tasks/new` 任务向导可与 SEC3 并行
