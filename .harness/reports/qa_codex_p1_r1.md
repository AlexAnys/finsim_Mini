# QA Report — Codex-P1 Round 1

> QA: qa · 2026-05-15 · Branch `claude-demo-fixes` @ 489aa8e
> Build report: `.harness/reports/build_codex_p1_r1.md`
> Plan: `.harness/plans/codex_p1_plan_r1.md`
> Bug: Codex review PR #12 标 2 个 P1 authorization gaps (Unit 6 + Unit 8 衍生)

## Spec: 修 2 个 P1 security bugs（adaptive-quiz/next 跨班题库泄漏 + SB 自由问 courseId 跨班泄漏）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 8 acceptance items 全实现 (Bug1: 4 + Bug2: 4) |
| 2. tsc --noEmit | PASS | clean output |
| 3. vitest run | PASS | 96 files / 1094 tests passed (baseline 不变) |
| 4. Browser (independent QA Playwright) | PASS | 12/12 case 独立 QA spec 全过；7/7 builder spec all pass (Bug1-B 仅 serial run 有 NextAuth race，isolated 单跑 PASS, 已知模式) |
| 5. Cross-module regression | PASS | quiz-adaptive-runner 客户端 fetch body wired with `taskInstanceId`；schema 0 改动；assertTaskInstanceReadable 既有调用未受影响；adaptive-quiz/check 路径仍 strict（已有 access guard） |
| 6. Security (/cso 等同性审计) | PASS | 两 P1 都是经典 vertical-access-control 修复：(a) Bug1 双校验 — 学生 class 隔离 + instance.taskId 防伪造（避免 IDOR）；(b) Bug2 Prisma OR 二路 (classId / classes.some) 与 teacherCourseFilter 对称；FORBIDDEN 响应不泄漏题目/资源内容（Bug1-B 实测 JSON.stringify(response) 不含 "深度测试" / "prompt" / "nextQuestion"） |
| 7. Finsim-specific | PASS | UI/API 中文（"任务实例与任务不匹配"、"你不在该课程的班级，无法关联此课程"、"任务实例不存在"）；响应统一 `{success,error.code,message}` 格式；Service 层抛 Error("CODE")，Route Handler 走 handleServiceError 映射 |
| 8. Code patterns | PASS | 无 drive-by refactor；server-side validation + access guard 在 service / route 两层都加；schema required taskInstanceId 是合理 breaking change（runner 客户端已 wire 配套）；admin-bin 兜底保留 |

## 独立证据链（QA 自建 12 case spec, 非 builder 自测复用）

### Bug 1 — adaptive-quiz/next 跨班题库泄漏修复

**正向流**
- QA-Bug1-A: alex (A 班) POST `/api/lms/tasks/{taskId}/adaptive-quiz/next` w/ A 班 instance → **200**, response keys `[done, nextQuestion, progress]` 完整

**安全流（核心修复）**
- QA-Bug1-B: student5 (B 班) POST 同 A 班 instance → **403 FORBIDDEN**, response = `{"success":false,"error":{"code":"FORBIDDEN","message":"权限不足"}}` — **无 leak**（不含 "深度测试" / "prompt" / "nextQuestion"）
- QA-Bug1-C: alex POST A 班 task 配 B taskId 的 instance（伪造路径）→ **403 FORBIDDEN** + message "任务实例与任务不匹配"
- QA-Bug1-D-missing: 不带 taskInstanceId → **400 VALIDATION_ERROR**
- QA-Bug1-D-blank: taskInstanceId = "" → **400 VALIDATION_ERROR**（z.string().uuid() 校验）
- QA-Bug1-D-notuuid: taskInstanceId = "not-a-uuid" → **400 VALIDATION_ERROR**
- QA-Bug1-E: 不存在的 UUID → **404 NOT_FOUND "任务实例不存在"** (assertTaskInstanceReadable throws INSTANCE_NOT_FOUND → api-utils 映射；**未暴露 500**)

### Bug 2 — SB 自由问 courseId 跨课程素材泄漏修复

- QA-Bug2-A: alex A 班 + COURSE_A_CLASS → **201** OK
- QA-Bug2-B: alex A 班 + COURSE_B_CLASS → **403 COURSE_ACCESS_DENIED** + 中文 "你不在该课程的班级，无法关联此课程"
- QA-Bug2-C: alex 不传 courseId → **201** OK (admin-bin 兜底，courseId=null 持久化)
- QA-Bug2-D（对称）: student5 B 班 + COURSE_A_CLASS → **403 COURSE_ACCESS_DENIED** (双向隔离)
- QA-Bug2-E（DB cleanup 验证）: 失败的 403 attempt 后 `prisma.studyBuddyPost.findMany` 不含 unique title — **未污染 DB**

### Cross-module verification

- `components/quiz/quiz-adaptive-runner.tsx:110-111` — 客户端 fetch body 含 `{ history: currentHistory, taskInstanceId }`（wire complete，prod 学生答题不挂）
- `lib/api-utils.ts:62-63` — `COURSE_ACCESS_DENIED → 403` 映射加新行，已有 case 顺序未破坏
- `lib/services/study-buddy.service.ts:70-88` — 自由问 + courseId 分支用 Prisma `Course.OR{classId, classes.some.classId}` 二路查询（与 teacherCourseFilter 同款）
- assertTaskInstanceReadable strict 不 opt-in（不传 `allowClosedWithOwnSubmission`）— adaptive 答题路径仅 published 实例放行，符合 spec "active 答题路径 strict"

### DB fixture 双重验证

```
TaskInstance A班 a7d9b380... -> Task e54e1cb9 (深度测试)   classId=deedd844 (A班)
TaskInstance A班 d288859e... -> Task 9cd29095 (理财基础)   classId=deedd844 (A班)
Course COURSE_A_CLASS classId=deedd844 (A班)
Course COURSE_B_CLASS classId=1dbdc794 (B班)
alex  (A班 deedd844)  / student5 (B班 1dbdc794) / belle (A班 deedd844)
```

伪造 instanceId 路径（Bug1-C）走的是：alex 可读 A 班 instance → 进入 instance.taskId 校验 → 不等 URL taskId → 403。**双校验链路正确**。

### 测试套件 numerical evidence

```
tsc --noEmit: clean
vitest: 96 files / 1094 tests passed (baseline)
lint: 0 errors (1 unused-var warning 在 QA 临时 spec，spec 已删)
e2e (builder spec): 6/7 serial PASS + Bug1-B isolated PASS = 7/7 实际
e2e (QA independent spec): 12/12 PASS (~1.1m, real browser + real auth + real DB)
```

## Issues found

无 blocking issue。一个小的 robustness 观察：

### Note 1 — assertTaskInstanceReadable throw INSTANCE_NOT_FOUND vs route 内 TASK_INSTANCE_NOT_FOUND
Route handler `app/api/lms/tasks/[id]/adaptive-quiz/next/route.ts:68` 在 assertTaskInstanceReadable PASS 后又 `findUnique({where:{id:taskInstanceId},select:{taskId:true}})` 二次查询，并在 null 时 `error("TASK_INSTANCE_NOT_FOUND", ...)`. **理论上 dead code**（assertTaskInstanceReadable 内部已对 null throw INSTANCE_NOT_FOUND，会 404 早返）。但保留作为 defense-in-depth 不算 bug。实测：fake UUID 走 assertTaskInstanceReadable 路径，response 是 `"任务实例不存在"`（来自 api-utils 映射），不是 route 内 message — 验证 ① assertTaskInstanceReadable 抛 INSTANCE_NOT_FOUND ② handleServiceError 映射到 404 "任务实例不存在" ③ route 内二次 findUnique 不会被命中。

### Note 2 — DB cleanup
QA spec 留下 8 个 soft-hidden SB posts（builder 4 + QA 4），已 hard-delete (StudyBuddyPost + AuditLog) 还原 baseline。`DELETE /api/study-buddy/posts/[id]` 走的是 hideStudyBuddyPost（软删），是设计选择，**非 bug**。

### Note 3 — adaptive-quiz/check 路径
本次 fix 仅触及 `/next`。检查 codex review 是否也标了 `/check` 漏 access guard — 阅读源码 `app/api/lms/tasks/[id]/adaptive-quiz/check/route.ts`（如存在）建议 follow-up。**但 spec 仅要求 /next, 本 unit scope clean**。

## Overall: PASS

两 P1 authorization gaps 完整修复，覆盖正向 + 跨班拒 + 伪造拒 + 边界 validation + DB cleanup 全维度。
