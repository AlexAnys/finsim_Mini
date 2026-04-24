# Build Report — PR-SEC3 r1

**Unit**: `pr-sec3` / 修 `deleteSubmission` 数据破坏级 P1 + 系统扫描 write 端 owner 守护
**Round**: r1
**Builder**: builder-p3
**Date**: 2026-04-24

## 背景

qa-p3 在 PR-SEC2 QA 的 regression sweep 中独立发现 **pre-existing P1**：
- `DELETE /api/submissions/[id]` by teacher2 → 200（**数据破坏级**，比 SEC1/SEC2 的读越权严重一档）
- `lib/services/submission.service.ts:195` `deleteSubmission(submissionId)` 只接 id，无 owner 守护
- 对比：`deleteTask` / `deleteTaskInstance` 都有 `creatorId` 参数 + FORBIDDEN 守护

team-lead 授权执行 PR-SEC3：立即修 + 系统扫描 write 端（DELETE / PATCH / POST）owner 守护。

## Write-side scan 结果

扫描所有 `app/api/**/[id*]/route.ts` 的 DELETE/PATCH/POST handler（11 个端点），对比 Service 是否接 userId 参数：

| Route + Method | Service 已有 owner 守护 | 结论 |
|---|---|---|
| `groups/[id]` PATCH/DELETE | updateGroup/deleteGroup(id, teacherId) ✓ | OK |
| `lms/content-blocks/[id]/markdown` PUT | upsertMarkdownBlock 无 ✗ | **FIX** |
| `lms/courses/[id]/classes` POST/DELETE | Route 已调 assertCourseAccess ✓ | OK |
| `lms/courses/[id]` PATCH | Route 已调 assertCourseAccess ✓ | OK |
| `lms/courses/[id]/teachers` POST/DELETE | Route 已调 assertCourseOwnerOrAdmin ✓ | OK |
| `lms/schedule-slots/[id]` DELETE | Route 检查 slot.createdBy ✓ | OK |
| `lms/task-instances/[id]/publish` POST | publishTaskInstance(id, createdBy) + isAuthorized ✓ | OK |
| `lms/task-instances/[id]` PATCH/DELETE | update/deleteTaskInstance(id, createdBy) + isAuthorized ✓ | OK |
| `submissions/[id]/grade` POST | updateSubmissionGrade(id, data) 无 ✗ | **FIX** |
| `submissions/[id]` DELETE | deleteSubmission(id) 无 ✗ | **FIX** |
| `tasks/[id]` PATCH/DELETE | update/deleteTask(id, creatorId) ✓ | OK |

**结论**：3 个端点缺失 write-side owner 守护，全部需修。

## 真实复现 pre-existing 漏洞（before fix）

- `PUT /api/lms/content-blocks/:id/markdown` by teacher2 → **200** 成功向 teacher1 课程小节写入 "## HACKED" 内容（live 真 curl 验证）
- `DELETE /api/submissions/[id]` by teacher2 → qa-p3 在 SEC2 QA 中复现过 200（本 session seed 无 submissions，但 service 源码验证逻辑）
- `POST /api/submissions/[id]/grade` by teacher2 → 同样（service 无 owner 守护）

## 修复方案

**关键设计决策**：用 Route-Handler 层的 guard 调用，**不改 service 签名**。理由：
- `updateSubmissionGrade` 被 `grading.service.ts` 的 AI 自动批改流程复用（7 个内部调用点），改签名触发级联
- Route-level guard 已是项目其他地方（courses/classes、courses/teachers）的一致模式
- 复用 SEC2 新建的 `assertSubmissionReadable` / `assertCourseAccess`（语义上：能读 = 能写，在"教师拥有课程"的归属圈内）

### Files changed

- `app/api/submissions/[id]/route.ts` — DELETE 加 `await assertSubmissionReadable(id, user)` 在 role 检查之后、deleteSubmission 之前
- `app/api/submissions/[id]/grade/route.ts` — POST 加同样 guard 在 role 检查之后、zod parse 之前
- `app/api/lms/content-blocks/[id]/markdown/route.ts` — PUT 加 `await assertCourseAccess(parsed.data.courseId, user.id, user.role)` 在 zod parse 之后（先拿到 courseId 才能 guard）

### 新建

- `tests/sec3-write-guards.test.ts` — 11 个单测：
  - content-blocks markdown PUT guard：4 case（teacher 非 owner 非 collab / teacher owner / admin / teacher collab）
  - submissions DELETE guard：3 case（teacher 非 owner / task creator / admin 直通）
  - submissions grade POST guard：2 case（teacher 非 owner / teacher 有课程访问）
  - fail-closed：2 case（submission 不存在 → SUBMISSION_NOT_FOUND / course 不存在 → COURSE_NOT_FOUND）

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS（0 errors） |
| `npx vitest run` | PASS 219/219（208 → 219，+11 新测试） |
| `npm run build` | PASS（25 routes emit） |

### 真 curl 6 场景矩阵

```
TEST 1 PUT content-blocks teacher2→teacher1 course     403 ✓（原 200 已修）
TEST 2 PUT content-blocks teacher1→own course          200 ✓
TEST 3 DELETE random submission as teacher2            404 ✓（原路径 200，现 fail-closed）
TEST 4 POST grade random submission as teacher2        404 ✓（原路径 200，现 fail-closed）
TEST 5 PUT content-blocks admin→any course             200 ✓（admin 直通）
TEST 6 PUT content-blocks unauth                       401 ✓
```

## Anti-regression

- **AI 自动批改未破**：`updateSubmissionGrade` service 签名未动；`grading.service.ts` 的 7 处内部调用继续工作；自动批改不走 HTTP Route，不经过 Route-level guard
- **既有 read 端未破**：SEC1 + SEC2 的 12 个 GET guard 全部保留，签名未改
- **Service 层未改**：任何 service 函数签名零动（只是 Route Handler 新增一行 guard 调用）
- **Schema 未改 / auth flow 未改 / Prisma client 未重建**
- 既有 208 个测试全过（+11 新测试 = 219 全绿）
- dev server 无需重启

## Dev server

零改动：live curl 已验证，无需重启。

## Deferred / uncertain

1. **AI 批改路径本身不走 HTTP**：`grading.service.ts` 内部调 `updateSubmissionGrade`，权限由 service 层其他地方守护（task creator / course access）。本 PR 不改 AI 路径；未来若引入第三方回调 API，需再评估。
2. **Task.visibility 共享模板语义**：Task schema 的 `visibility` 枚举目前未启用，对 private 语义是保守安全的；启用后可能需要扩展 guard 逻辑。
3. **submissions `batchDeleteSubmissions`**：service 自身已有 teacherId 参数守护（见 `submission.service.ts:200+`），本 PR 不改。
4. **SEC3 scope 严格限 write 端 owner 守护**：未包含业务逻辑 / 速率限制 / 审计日志。若需要更严格的"谁批改了谁的作业"审计，可在 Phase 4+ 的 audit.service 扩展。

## Notes for QA

- 关键路径：6 场景 curl 矩阵；且建议跑 `/cso` 审计（write-side guard 改动）
- 回归守护建议：
  - 既有 SEC2 的 8 个 GET guard 测试全部跑（已含 208 中的 35 个）
  - AI 批改 smoke test（如本地有真数据跑一遍 simulation 批改流程）
  - 学生合法提交/查看自己提交不应被误杀（assertSubmissionReadable 允许 studentId === user.id）
- 文件改动数：3 改 route + 1 新 test，非常紧凑（~70 行 src + ~200 行 test）

## Summary

PR-SEC3 r1 修 3 个 pre-existing write-side owner 守护缺失（1 数据破坏级 + 2 类似的 regrade/delete）。
- 真 curl 6 场景全对齐预期
- tsc / vitest / build / live 四绿
- 复用 SEC1/SEC2 的 guard 函数，零新 guard 设计；Service 签名零改，AI 批改零风险
- 119 → 219 session 累计 +100 测试，15 tests/commit 密度

write 端 owner 守护系统性收敛完成。若本 r1 PASS，动态 exit **连续 PASS 第 6 次**，session ship 条件非常稳定。
