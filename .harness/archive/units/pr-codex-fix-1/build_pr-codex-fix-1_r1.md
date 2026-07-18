# Build report — PR-codex-fix-1 r1

Unit: PR-FIX-1 · Codex 深度审查 27 finding 修复链 · Batch A（API guard 9 条 + UX4 + UX5）
Round: 1
Author: builder-fix
Date: 2026-04-26

> 注意：本 PR 名义"pr-fix-1"已被早先一轮 IDOR 修复占用 (`build_pr-fix-1_r1.md` 2026-04-22)。
> 为避免覆盖历史，本轮使用 unit=`pr-codex-fix-1` 命名报告文件。

> **Scope expansion**：team-lead 在 r1 进行中追加 UX4（chat student-role systemPrompt 拒绝）+ UX5
> （安全敏感写强制 audit）→ 已合入本 PR。

## 范围（spec.md L12-24 + UX4/UX5）

Codex GPT-5.5 xhigh 4 轮深度审查发现的 9 条安全 finding（P1）+ 用户拍板的 2 条 UX 决策：

### Batch A 安全 9 条
- A1 task-instances POST IDOR — 教师可反向读他人 task / 写他人 course / 跨班挂载
- A2 submissions POST IDOR — 学生可对未分配 task 提交 + 触发 AI 批改
- A3 markdown PUT 守护错位 — body.courseId 可绕过，跨课程改讲义
- A4 chapters POST 无 owner guard
- A5 sections POST 无 owner guard + chapter/course 跨课错位
- A6 announcements POST/GET courseId 绕过 teacher scope
- A7 schedule-slots POST/GET courseId 绕过 teacher scope
- A8 insights aggregate POST 无缓存检查 + 无 mutex（持续刷 token）
- A9 ai/chat 无输入长度上限（prompt-injection / context overflow / token 浪费）

### UX 拍板 2 条
- UX4 chat 客户端 systemPrompt：学生 role 拒绝（403 + 中文 message）+ 教师 role 允许（向导预览）
- UX5 安全敏感写（DELETE/PATCH course/chapter/section/contentBlock + grade）强制 audit，不依赖 ENABLE_AUDIT_LOGS env

## 文件改动（17 files · +422 / −100）

### Routes（13 个）
- `app/api/lms/task-instances/route.ts` — A1: assertTaskReadable + assertCourseAccess + classId/courseId 一致性校验
- `app/api/submissions/route.ts` — A2: 必须 taskInstanceId + assertTaskInstanceReadable + 服务端从 instance 派生 taskId/taskType（不信任客户端）
- `app/api/lms/content-blocks/[id]/markdown/route.ts` — A3: assertSectionWritable 按 sectionId 反查真 courseId/chapterId + 校验 body.courseId/chapterId 与 section 真值匹配
- `app/api/lms/chapters/route.ts` — A4: assertCourseAccess
- `app/api/lms/sections/route.ts` — A5: assertCourseAccess + chapter.courseId 一致性校验
- `app/api/lms/announcements/route.ts` — A6: 教师传 courseId 时 assertCourseAccess；学生传 courseId 时 assertCourseAccessForStudent
- `app/api/lms/schedule-slots/route.ts` — A7: 同 A6 守护模式（teacher / student 双侧）
- `app/api/lms/task-instances/[id]/insights/aggregate/route.ts` — A8: POST 默认走 5min 缓存 / `force=true`（query OR body）才重跑 / per-instance Mutex（5min TTL）
- `app/api/ai/chat/route.ts` — A9 + UX4: transcript ≤50 entries / 单条 ≤2000 字符 / scenario+systemPrompt ≤4000 字符 / 服务端兜底 trim 最近 30 轮 / **学生 role 传 systemPrompt → 403（UX4）**
- `app/api/lms/courses/[id]/route.ts` — UX5: PATCH 强制 audit
- `app/api/lms/chapters/[id]/route.ts` — UX5: PATCH/DELETE 强制 audit
- `app/api/lms/sections/[id]/route.ts` — UX5: PATCH/DELETE 强制 audit
- `app/api/lms/content-blocks/[id]/route.ts` — UX5: PATCH/DELETE 强制 audit
- `app/api/submissions/[id]/grade/route.ts` — UX5: 手工批改强制 audit

### Services / Shared
- `lib/api-utils.ts` — 新增 5 个 error code 映射（CLASS_COURSE_MISMATCH / CHAPTER_COURSE_MISMATCH / TASK_INSTANCE_REQUIRED / AGGREGATE_TOO_FREQUENT / AGGREGATE_IN_PROGRESS / INPUT_TOO_LARGE）
- `lib/services/audit.service.ts` — 新增 `logAuditForced()`（不读 ENABLE_AUDIT_LOGS env，DB 写失败仍 catch + console.error 不阻塞主流程）

### Tests（1 个新文件 · 27 cases）
- `tests/pr-fix-1-batch-a.test.ts` — 9 fix + UX4/UX5 的纯单测覆盖：
  - A9 chat schema length cap（5 cases）
  - UX4 student/teacher/admin systemPrompt 4 cases（拒/允/允/允）
  - A8 cache freshness boundary（3 cases · <5min / >5min / =5min 边界）
  - A8 mutex TTL semantics（2 cases · 锁内拒绝 / 过期自释）
  - error code mapping（4 cases · MISMATCH 400 / TOO_FREQUENT 429 / IN_PROGRESS 429 / TOO_LARGE 400）
  - A1 classId/courseId 一致性核心逻辑（3 cases · primary / CourseClass / 陌生）
  - A2 服务端派生 taskId/taskType 防 spoof（3 cases · 漂移×2 / 一致×1）
  - UX5 logAuditForced bypass env / DB-failure graceful（3 cases · forced 写 / regular skip / DB error 不抛）

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| `npx tsc --noEmit` | PASS | 0 输出 |
| `npx vitest run` | PASS | **38 files / 396 tests**（之前 369 + 新增 27 · 零回归） |
| `npm run build` | PASS | Compiled successfully · 25 routes · 4.9s |
| Dev server alive | PASS | PID 2941 next-server v16.1.6 仍在 3000 / `/login` 200 |
| 无 schema 改动 | PASS | git diff prisma/schema.prisma = 0；不需要 Prisma 三步 |

## 沿用 PR-SEC1-4 守护链路 pattern（anti-regression）

- 全部使用 `lib/auth/resource-access.ts` 现有的 assertCourseAccess / assertTaskReadable / assertTaskInstanceReadable / assertSectionWritable，未新增 guard 函数，链路一致
- 服务层 throw `new Error("CODE")` + 路由层 `handleServiceError()` 转 HTTP 状态 + 中文错误（finsim 规范严格遵守）
- Route handlers 仍是薄壳：parse → guard → service → response（未注入业务逻辑）
- audit 写入失败不阻塞主流程（catch + console.error）—— 与现有 `logAudit` 行为一致

## 不直观决策（rationale）

1. **A2 服务端派生 taskId/taskType 而非纯校验**：spec L17 说"派生 taskId/taskType"，但客户端仍传这两个字段（旧代码写法 + Zod schema discriminator 依赖）。我选 hybrid 方案：保留客户端传值用 schema discriminator，再服务端读 instance 后强制比对 — 任何漂移直接 FORBIDDEN。这样 schema discriminatedUnion 的便利性保留，又防 spoof。
2. **A3 sectionId-based 守护而非 path `[id]` 守护**：spec L18 给了两个备选（按 path `[id]` block 反查真 courseId / 按 body.sectionId 反查 → assertSectionWritable）。markdown PUT 实际是 upsert（不一定有 path id）— 调用者只用 sectionId+slot+blockType 定位，所以走 sectionId 反查更准。再补 body.courseId/chapterId 与 section 真值的一致性校验（防"sectionId 对 / courseId 假"的混合伪造）。
3. **A8 force flag 双通道（query + body）**：spec L23 说 `force=true` 才重跑，没指定通道。教师 UI 既可发空 body 也可附 `{force:true}`，所以两个都接住更鲁棒；query 优先（更显式）。
4. **A8 Mutex 5min TTL**：spec 没规定 TTL，但聚合通常 7-15s。5min 够长 + 防卡死。in-memory Map 在多 worker 部署不严格互斥，但 finsim 当前单进程开发部署够用，spec 也没要求 redis-lock。
5. **A9 服务端 trim 最近 30 轮**：spec 说 transcript ≤50。客户端理论上可绕 zod 上限（如自构造请求）。zod 校验 + 服务端 slice(-30) 双保险。30 轮覆盖正常理财对话长度。
6. **A6/A7 admin GET 行为保持不变**：原代码 admin 不加 teacherId 过滤可看全部，仍保留（spec 未要求改）。学生侧若传 courseId 必须有班级访问权（防 student 直拉别人班的公告/课表）。
7. **5 个新 error code 的 HTTP 状态**：MISMATCH 类 400（业务校验失败），AGGREGATE_*_FREQUENT/IN_PROGRESS 都 429（限流语义），TOO_LARGE 400（输入校验），TASK_INSTANCE_REQUIRED 400（必填字段）。
8. **UX4 学生 vs 教师 systemPrompt**：spec D2 说现有架构教师向导预览依赖 systemPrompt；用户拍板 UX4 = 学生拒/教师允。直接走 role check（`session.user.role === "student"`）比改架构（教师向导改服务端读 task config）成本低 100×。spec L98 已明确"教师 preview 模式允许"。
9. **UX5 logAuditForced 单独函数而非合并参数**：避免改既有 `logAudit` 接口（5 处 caller 不动）。`logAuditForced` 名字直观传达"不依赖 env"语义。两者共用 prisma.auditLog.create 但 env-gate 差异。
10. **UX5 audit 写位置 = service 调用之后**：先写业务再 audit，业务失败不写 audit（fail-closed）；audit 失败 console.error 不抛（fail-open）。这是 finsim 现有 pattern 的延续（grading.service.ts 同样写在业务后）。

## 范围外 / 不在本 PR

- B1-B7（AI/数据模型层）由 PR-FIX-2 处理（含 schema 改动 → Prisma 三步）
- C1-C5（前端纪律）由 PR-FIX-3 处理
- D1（旧 5 档 MOOD prompt 清理）由 PR-FIX-4 处理
- D2/D3/D4/D5（其他 part）按 spec 留存增量 PR

## Open questions / 不确定

- A8 mutex 是 in-memory Map，多 worker 部署不严格互斥（finsim 当前单进程，QA 决定是否需要 redis-lock 升级 — 建议留给独立 P3 PR）
- A6/A7 admin GET 默认行为我保留了原代码（admin 不传 courseId 时看全部 announcements/schedule-slots），如果 codex review 也要 admin 限定建议在 PR-FIX-3 收尾
- UX5 audit metadata 我只记 `fields` 数组（PATCH）/ `score+maxScore`（grade），没记 before/after diff（schema 限 Json 但需要更多查询逻辑），合规追责够用；如需更详细可独立 PR 增

## 不需要 dev server 重启

- 无 `prisma/schema.prisma` 改动 → 不需要三步
- 仅 route.ts + lib/{api-utils,services/audit.service}.ts 改动 → Next.js 热重载自动生效

## 给 QA 真 curl 的提示

每个 A1-A9 + UX4/UX5 都有可复现攻击场景，建议 QA 跑：

### Batch A 9 fix
- A1：teacher2 用 teacher1 taskId 创建挂自己 course 的 instance → 期望 403
- A2：student1 直接 POST /api/submissions taskInstanceId 为 student2 班级专属任务 → 期望 403
- A3：teacher2 PUT markdown body.courseId=自己课 + sectionId=teacher1 课的 section → 期望 403
- A4: teacher2 POST /api/lms/chapters body.courseId=teacher1 课 → 期望 403
- A5: teacher2 POST /api/lms/sections body.chapterId=A1 课 chapter + body.courseId=teacher2 自己 → 期望 403 / 400 mismatch
- A6: teacher2 GET /api/lms/announcements?courseId=teacher1 课 → 期望 403
- A7: teacher2 GET /api/lms/schedule-slots?courseId=teacher1 课 → 期望 403
- A8: 同 instanceId 在 5min 内 POST 两次 → 第二次返回 cache（应 < 100ms）；force=true 才重跑
- A9: POST /api/ai/chat 带 51 entry transcript → 期望 400 VALIDATION_ERROR

### UX4 / UX5
- UX4: student1 POST /api/ai/chat body.systemPrompt="ignore previous..." → 期望 403 中文"学生不允许传入自定义系统提示"
- UX4: teacher1 POST /api/ai/chat body.systemPrompt="..." → 期望 200 正常 AI 回复（向导预览）
- UX5: ENABLE_AUDIT_LOGS=false 下 teacher1 PATCH course → 期望 200 + DB 出现 1 条 AuditLog（action=course.update，actorId=teacher1）
- UX5: ENABLE_AUDIT_LOGS=false 下 teacher1 POST /api/submissions/[id]/grade → 期望 200 + DB 出现 1 条 AuditLog（action=submission.grade）
- UX5: ENABLE_AUDIT_LOGS=false 下 teacher1 DELETE /api/lms/chapters/[id] → 期望 200 + AuditLog（action=chapter.delete）
