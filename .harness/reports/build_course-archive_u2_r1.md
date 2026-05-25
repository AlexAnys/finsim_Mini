# Build Report — U2 archive/restore/purge service + API (r1)

worktree: `finsim-course-archive` / branch `claude-course-archive`

## 目标（spec §6 U2）
archiveCourse / restoreCourse / getArchivedCourses / purgeCourse（事务，按 §8 顺序）+ owner/admin 守卫 + audit + purge confirmTitle 强校验；API：DELETE /courses/[id] 改归档、POST /restore、DELETE /purge、GET /archived。

## 改了什么（文件）
- `lib/services/course.service.ts`（+242/-33）
  - 新增私有守卫 `assertCourseOwnerOrAdmin(courseId, userId, userRole)`：admin 直通 / 否则须 createdBy；COURSE_NOT_FOUND / FORBIDDEN
  - `archiveCourse`：置 `deletedAt: new Date()`，**无 COURSE_HAS_* 闸**（spec 明确废除归档路径上的拒删），audit `course.archive`
  - `restoreCourse`：清 `deletedAt: null`（不动实例本身），audit `course.restore`
  - `getArchivedCourses(userId, userRole, opts)`：teacher = `AND[{deletedAt:{not:null}}, teacherCourseFilter]`；admin = `{deletedAt:{not:null}}`；include 对齐 getCoursesByTeacher，按 deletedAt desc
  - `purgeCourse(courseId, userId, userRole, confirmTitle)`：confirmTitle≠courseTitle → `PURGE_TITLE_MISMATCH`（事务前）；事务内按 §8 承重次序删全部后代（显式删 SET NULL 表：submission/taskInstance/studyBuddyPost/analysisReport；解 RESTRICT：contentBlock/section）；**不删共享 Task 模板**；audit `course.purge`（含计数）
  - **移除 `deleteCourse`**（旧硬删，仅 route handler 一个调用方；anti-regression 已搜全仓确认；spec 授权 DELETE 改归档语义）。审计单测里的 `"course.delete"` 字符串只是测 audit helper 的任意 action，与本函数无关，不受影响
- `app/api/lms/courses/[id]/route.ts`（+10/-...）：DELETE 改调 `archiveCourse(id, userId, role)`，返回 `{archived:true}`；import 由 deleteCourse 换 archiveCourse
- `app/api/lms/courses/[id]/restore/route.ts`（新）：POST → restoreCourse，`{restored:true}`
- `app/api/lms/courses/[id]/purge/route.ts`（新）：DELETE，body `{confirmTitle}` zod 校验 → purgeCourse，`{purged:true, ...counts}`
- `app/api/lms/courses/archived/route.ts`（新）：GET（teacher/admin）→ getArchivedCourses；静态段优先于 `[id]`，不会被当 courseId
- `lib/api-utils.ts`：加 `PURGE_TITLE_MISMATCH` → 400 中文
- `tests/course-archive.service.test.ts`（新，11 测试）：archive 4 / restore 2 / getArchivedCourses 2 / purge 3
- `tests/course-archive.api.test.ts`（新，12 测试）：4 端点各 200/401/403(或 400)，service 调用参数透传断言
- `scripts/verify-purge-cascade.ts`（新）：purge 的真 DB 端到端集成证明

## TDD 过程
- archiveCourse：先写 4 个失败测试（owner 置位 / admin / 非 owner FORBIDDEN / NOT_FOUND）→ RED（函数不存在）→ 实现 → GREEN
- restore / getArchivedCourses / purge：同法逐行为补测，purge 用 tx mock 断言"承重次序 contentBlock→section→chapter→course + Task 绝不被删"
- API 层：mock guards + service 的纯 route handler 测试，覆盖 200/401/403/400

## 验证结果
- `npx tsc --noEmit`：通过
- `npx vitest run`：**116 文件 / 1191 测试全绿**（U1+U2 新增 +2 文件 / +23 测试，无回归；基线 114/1168）
- **purge 真 DB 集成证明**（`scripts/verify-purge-cascade.ts`，PASS）：建一棵完整后代树（chapter→section→contentBlock + taskInstance + submission + subjectiveSubmission + attachment + studyBuddyPost + taskPost + analysisReport + announcement + scheduleSlot + courseKnowledgeSource + taskBuildDraft），purge 后 **15 项断言全 null**（无 FK 错、无孤儿），**共享 Task 模板存活**（F5）。purge counts={chapters:1,sections:1,instances:1,submissions:1}。throwaway 数据自清（purge 删掉 course；probe leftover=0）
- dev server（webpack, 3003）热加载新路由：未登录探测 4 端点均 401（路由已注册、可编译、不 500）；`/courses/archived` 静态段正确解析（非 404/非 [id]）

## FK 级联事实（已从 migration SQL 核实，支撑 §8 次序）
- 必须显式删（否则孤儿/拦路）：`Submission.taskInstanceId`=SET NULL、`TaskInstance.courseId`=SET NULL、`StudyBuddyPost.taskInstanceId/courseId`=SET NULL、`AnalysisReport.taskInstanceId`=SET NULL、`Section.courseId`/`ContentBlock.courseId`=**RESTRICT**
- 自动级联（仍显式删求确定性）：Sim/Quiz/SubjectiveSubmission←Submission（Cascade）、Attachment←SubjectiveSubmission（Cascade）、Announcement/ScheduleSlot/CourseTeacher/CourseClass/CourseKnowledgeSource/TaskBuildDraft←Course（Cascade）、TaskPost←TaskInstance（Cascade）

## 发现的预存 bug（不在本 unit scope，flag 给 coordinator）
- `app/teacher/courses/[id]/page.tsx:1141` `primaryClassId={course.class.id}`：当课程的**已弃用** `classId` 为 null 时 `course.class` 为 null → 老师课程详情页崩（error boundary）。该行在 origin/main 与本 worktree **完全一致、我未触碰**，是 deprecated classId 留下的latent bug，**与 U2 无关**。dev server 日志里出现是因为有人导航到某个 classId=null 的课程详情页。建议单独跟进（U3/U4 真浏览器 QA 可能撞到此页）。

## 需要 QA 注意 / 怎么验
- dev server 仍须用 `--webpack`（worktree node_modules 是 symlink，Turbopack 拒启；见 U1 报告）。我在 3003 跑着一个。
- 本 unit 验证点（service+API，UI 在 U4）：
  1. 归档不再要求清空章节/实例（archiveCourse 无 COURSE_HAS_* 闸）
  2. 彻底删除需 confirmTitle 与课程名一致，否则 PURGE_TITLE_MISMATCH（400）
  3. purge 级联完整 + 不删 Task 模板（可跑 `npx tsx scripts/verify-purge-cascade.ts` 复现 PASS）
  4. owner/admin 守卫：非 owner 非 admin → 403
- **读取点过滤尚未做**（U3）：归档后课程目前仍可能出现在 dashboard/列表/学生侧 —— 本轮不应验"全站消失"，那是 U3 的事。

## 不确定 / 延后
- 无延后。U3（读取点过滤 + 学生守卫 + grades）已被 U1 解锁但 blocked-by 关系上也依赖 U2 完成；我接着做 U3。
- audit 的 metadata 计数仅记 chapters/sections/instances/submissions 四项摘要（够追责）；未逐表计数，避免事务内多余 count 查询。

## Prisma 三步 / dev server 重启
- 本 unit 无 schema 改动（schema 在 U1 已迁移）。dev server（U1 起的 webpack/3003）已热加载本 unit 新路由并验证不 500。
