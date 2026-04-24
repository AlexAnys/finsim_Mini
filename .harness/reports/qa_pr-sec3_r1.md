# QA Report — pr-sec3 r1

**Unit**: `pr-sec3` / 修 `deleteSubmission` P1 + 系统扫描 write 端 owner 守护
**Round**: r1
**QA**: qa-p3
**Date**: 2026-04-24
**Build report**: `.harness/reports/build_pr-sec3_r1.md`

## 背景

qa-p3 在 PR-SEC2 QA 的 regression sweep 独立发现 pre-existing P1：`DELETE /api/submissions/[id]` by teacher2 → 200（数据破坏级）。Builder 扫描 11 个 write 端点，确认 **3 个缺守护**（`content-blocks/[id]/markdown` PUT、`submissions/[id]` DELETE、`submissions/[id]/grade` POST），其余 8 个已有 service 层或 route 层守护。

## Checks

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance（3 write 端点守护） | PASS | 3 路由全部加 guard；service 签名零改；复用 SEC1/SEC2 的 assertCourseAccess + assertSubmissionReadable |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | 219/219（208 → 219, +11 sec3-write-guards.test.ts） |
| 4. npm run build | PASS | 25 routes |
| 5. Browser verification（real curl matrix） | PASS | 见下完整矩阵 |
| 6. Cross-module regression | PASS | SEC1+SEC2 的 7 个 GET guard 仍 403；AI 批改路径未破（service 零改 + 7 处内部调用签名未动） |
| 7. Security（/cso 审计） | PASS | OWASP + STRIDE 全绿；重点 Tampering 闭环；read-guard 复用为 write-guard 的语义映射合理 |
| 8. Finsim-specific | PASS | 中文错误 "权限不足"（handleServiceError 映射）；requireRole 用法一致 |
| 9. Code patterns | PASS | diff 精准 +18 行（3 handler 每个 +4~7 行 guard import+调用）；无 drive-by 改动 |

## Diff 精确审查

```
app/api/lms/content-blocks/[id]/markdown/route.ts  | +4
app/api/submissions/[id]/grade/route.ts            | +8
app/api/submissions/[id]/route.ts                  | +6
tests/sec3-write-guards.test.ts                    | +200 (new)
```

### 3 处 guard 调用位置审查

1. **`content-blocks/[id]/markdown/route.ts` PUT**：guard 在 `parsed.safeParse` 之后（因为需要从 body 取 `courseId`）、`upsertMarkdownBlock` service 之前 — 合理 fail-closed 顺序。request body 先 parse 只是结构解析无 side effect，validation 失败返回 400 不泄漏"课程存在与否"
2. **`submissions/[id]/grade/route.ts` POST**：guard 在 role 检查之后、zod parse 之前，`deleteSubmission` 之前
3. **`submissions/[id]/route.ts` DELETE**：同样位置

所有 guard 都在实际 mutation 之前 → **fail-closed** 顺序正确。

## 真 curl 完整矩阵

### Markdown PUT（content-blocks/[id]/markdown）

| 场景 | 期望 | 实际 |
|---|---|---|
| teacher2 → PUT to teacher1 course | 403 | **403 FORBIDDEN "权限不足"** ✓（原 200 闭环） |
| teacher1 → own course PUT | 200 | 200 ✓（regression 守护，未误杀） |
| admin → PUT any course | 200 | 200 ✓（直通） |
| 未登录 → PUT | 401 | 401 ✓ |

### Submission DELETE

创建真 submission id `b4a7a92b-c355-4384-9a47-bbb8865d3d57`（student1 张三，teacher1 课程 instance）进行矩阵测试：

| 场景 | 期望 | 实际 |
|---|---|---|
| **teacher2 → DELETE student1's submission** | **403** | **403 FORBIDDEN** ✓（**原 200 数据破坏级漏洞闭环**） |
| student1 → GET own submission（SEC2 regression） | 200 | 200 ✓ |
| admin → DELETE | 200 | 200 `{deleted:true}` ✓（直通 + 实际删除成功） |

### Submission POST grade

| 场景 | 期望 | 实际 |
|---|---|---|
| **teacher2 → POST grade on student1's submission** | **403** | **403 FORBIDDEN** ✓（原 200 闭环） |
| teacher1 → POST grade on own course submission | 200 或 400（仅 validation） | **400 VALIDATION_ERROR** ✓（**guard 通过**，仅 payload 不符 zod；证明 teacher1 不被误杀） |

### SEC1 + SEC2 read-side regression（应仍全 403）

| 端点 | HTTP |
|---|---|
| GET `/api/lms/courses/[id]` | 403 ✓ |
| GET `/api/lms/task-instances/[id]` | 403 ✓ |
| GET `/api/lms/task-instances/[id]/insights` | 403 ✓ |
| GET `/api/lms/courses/[id]/teachers` | 403 ✓ |
| GET `/api/lms/courses/[id]/classes` | 403 ✓ |
| GET `/api/lms/classes/[id]/members` | 403 ✓ |
| GET `/api/tasks/[id]` | 403 ✓ |

### 页面 sweep（回归守护）

| 页面 | HTTP |
|---|---|
| student1 /dashboard /courses /grades /schedule | 4×200 |
| teacher1 /teacher/{dashboard,courses,tasks,instances,schedule,analytics,ai-assistant} | 7×200 |

## Anti-regression 深度审查

### Service 签名零改（核心承诺）

`git diff lib/services/` **输出为空** → service 层完全未改。关键验证：

- `updateSubmissionGrade(submissionId, data)` 签名保持
- `grading.service.ts` 内部 7 处调用点（lines 4/33/57/99/199/263/335）零影响
- `deleteSubmission(submissionId)` 签名保持
- `upsertMarkdownBlock(data)` 签名保持

**AI 自动批改隔离**：`grading.service.ts` 内部通过 `import { updateSubmissionGrade }` 直接调 service，**不走 HTTP Route**，Route-level guard 对其透明，零影响。

### Guard 语义映射（设计审查）

PR-SEC3 用 `assertSubmissionReadable`（原 SEC2 为 GET 设计的 read guard）作为 DELETE/grade 的 write guard。"能读 = 能写" 的语义映射成立因为：

- student 分支：`requireRole(["teacher","admin"])` 已挡住 student，student 根本不会进这条 path
- teacher 分支：read/write 能力同源（owner or course access），**权限语义一致**
- admin 直通：read/write 都通

这是**优雅的复用**，避免 guard 复制。

### 3 个 handler 的 try/catch 未新加

3 个 handler 原本都有 try/catch 块 → guard 抛的 error 自动走 handleServiceError → 返回标准化 403/404 响应。

## /cso 审计（auth 写层触发）

### OWASP Top 10

| 类别 | 审查 | 判定 |
|---|---|---|
| A01 Broken Access Control | 3 个 write 端点 guard 闭环；admin/teacher-owner/teacher-collab/student 分支齐全 | ✓ |
| A03 Injection | Prisma parameterized；body 字段 zod 校验 | ✓ |
| A04 Insecure Design | guard 在 mutation 之前；fail-closed（SUBMISSION_NOT_FOUND → 404）| ✓ |
| A05 Security Misconfig | 复用 SEC1/SEC2 guard；schema 零动 | ✓ |
| A07 Ident/Auth Failures | user.id/role/classId 自 JWT | ✓ |
| A08 Integrity | 11 新单测覆盖所有分支；Service 签名零改保证 AI 批改 integrity | ✓ |
| A09 Logging/Monitoring | 统一 handleServiceError | ✓ |

### STRIDE

| 威胁 | 审查 | 判定 |
|---|---|---|
| Spoofing | role/id 自 JWT | ✓ |
| **Tampering** | **核心修复**：teacher2 不能改 teacher1 course markdown / 不能 delete/grade teacher1 的 submission | ✓ 闭环 |
| Repudiation | 标准错误码 | ✓ |
| Information Disclosure | 与 SEC1/SEC2 一致的小 404/403 状态码差异；跨模块一致 | ✓ |
| Denial of Service | 每次 guard 加一次 DB query（小开销，可接受）| ✓ |
| Elevation of Privilege | admin 显式 branch；teacher 必须 owner/collab；requireRole 挡 student | ✓ |

**无 High/Critical 级别问题。**

## Issues found

无阻塞。以下为**非阻塞观察**（全合 Builder Deferred / scope）：

1. Builder Deferred #1：AI 批改路径不走 HTTP，由 service 层其他地方守护 — 合理
2. Builder Deferred #2：`Task.visibility` 未启用 — conservative 语义
3. Builder Deferred #3：`batchDeleteSubmissions` service 自身已有 teacherId 守护 — 已审
4. Builder Deferred #4：scope 限 owner 守护，未包含速率限制/审计日志 — 合理

### 测试环境意外

本轮 QA 期间发现 **dev server 可能被重启过或 db 被重置**（`submission.count() = 0` 起始），所以构造真 submission id 通过直接 prisma 调用。已用创建的 real submission 完成 DELETE/grade 跨户测试，**关键场景全对齐预期**。非阻塞于 PR 本身。

## Overall: PASS

**建议**：coordinator 可直接 commit PR-SEC3 r1。这是一个紧凑的安全修复：
- 精确闭环 SEC2 QA 发现的 P1 + 另外 2 个同类漏洞
- Diff 极小（+18 行 src）
- Service 签名零改 → AI 批改路径零风险
- 11 新单测 + 真 curl 多场景矩阵全对齐
- OWASP / STRIDE 全绿
- SEC1/SEC2/Phase 3 全无回归

动态 exit 进度：**连续 PASS 第 6 次**（PR-3A/3B/3C + SEC1 + SEC2 + SEC3）→ **harness 动态 exit 超满足**。

## Session 总结

- Phase 3（教师端重设计）+ 安全 3 PR 全部 PASS
- 119 tests → 219 tests（+100 tests，密度 ~17/PR）
- 3 个 P1 级漏洞闭环（1 read/7 read + 3 write）
- 所有 guard 语义一致（admin 直通 / teacher owner-collab / student 自己班 / fail-closed on 空）
- 共 6 连 PASS，ship 条件稳定
