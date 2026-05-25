# Spec — 课程归档（软删除）+ 恢复 + 彻底删除 + 章节删除 bug 修复

> Coordinator 计划。Builder/QA 在 worktree `finsim-course-archive`（分支 `claude-course-archive`，基于 origin/main #20）内 TDD 实施。

## 1. 用户诉求（原话）
> "课程管理的删除有问题，需要依赖所有章节都删除，结果章节删除到最后一个时好像删除不了……可以直接删，删除课堂后只是从所有页面消失，包含已经发布的任务，这个相当于一个存档，课程页面中增加一个进入的窗口可以恢复已经删除的课程……这个窗口里也可以增加彻底删除。"

即：把"删课程必须先清空章节 + 含内容章节删不掉"的死胡同，改成**一键软删除（归档）→ 全站消失（含已发布任务）→ 可在回收站恢复 / 彻底删除**。

## 2. 背景 / 根因（已定位）
- **章节删不掉的真 bug**：`ContentBlock.chapterId` 外键是 `ON DELETE RESTRICT`（Prisma 必填关系默认值，迁移 `20260221084930_init` line 704），含内容块的章节直接 `prisma.chapter.delete()` 触发 P2003；`handleServiceError` 无 P2003 映射 → 用户看到无意义的 500。空章节能删，所以表现为"最后一个（有内容的）删不掉"。
- **课程删除限制**：`deleteCourse`（course.service.ts:435）有 `COURSE_HAS_CHAPTERS` + `COURSE_HAS_INSTANCES` 两道拒删闸，是因为 schema 级联未配全、怕产生孤儿行的保守设计。软删除方案让这两道闸对"归档"不再需要（不销毁数据 → 可恢复）。
- **purge 的三条 RESTRICT 拦路 FK**（彻底删除必须按序处理，naive `course.delete()` 会被挡）：`Section.courseId`、`ContentBlock.courseId`、`ContentBlock.chapterId`。
- **软删除会泄漏的关键点**：软删课程**不会**改变 `TaskInstance.status`，学生仍可凭直链 id 命中已归档课程的 published 实例 → 必须加固学生侧访问守卫。
- **`TaskInstanceAnalytics` 已废弃删表**（`20260516064500_drop_dead_schema_pr1`），分析改为实时聚合，purge 无需处理它。

## 3. 设计决策（用户已确认）
- **D1**：`Course.deletedAt DateTime?`（null=正常，有时间戳=已归档）为唯一真源；读取处 join 过滤；恢复=清空时间戳，不动任务实例本身。
- **D2（已确认可接受）**：归档后学生侧的任务/成绩一并消失（可恢复）。
- **D3**：老师仅能归档/恢复/彻底删除**自己**的课程；admin 全部。
- **D4（已确认）**：彻底删除真销毁（含学生提交/成绩/分析），不可恢复；需**输入课程名强确认**；即使有已批改提交也允许。
- **D5**：回收站入口加在 `/teacher/courses` 头部（"新建课程"旁）。
- **D6（已确认一起修）**：修复含内容章节删不掉的 bug。

### Flag 裁决（实施细节，均在已批准设计范围内）
- **F1 学生侧守卫加固（必做）**：`assertCourseAccessForStudent`、`assertTaskInstanceReadable` 的**学生分支**拒绝已归档课程（teacher/owner 分支保持开放，恢复/彻底删除需要访问）。
- **F2 `/grades` 过滤（必做，兑现 D2）**：`GET /api/submissions`（`getSubmissions`）当前只按 `studentId` 过滤，须补 `taskInstance.course.deletedAt = null`（保留 `taskInstanceId=null` 的独立提交可见）。
- **F3 集中过滤（推荐，降泄漏风险）**：把 `deletedAt: null` 收敛进共享的 `teacherCourseFilter`（course.service.ts:11），一处生效于 dashboard/announcement/SB；归档列表查询走独立 `deletedAt: { not: null }` 绕过它。
- **F4 写路径守卫（P2 加固）**：向已归档课程**新建实例 / 发布任务 / AI 起草**应被拒；列为 P2，不阻塞核心。
- **F5 purge 不删共享 `Task` 模板**（一个 Task 跨多课程，无 Course FK）；SET NULL 关系（Submission/StudyBuddyPost/AnalysisReport/TaskInstance.courseId）须在事务内**显式删除**，不能依赖 DB 级联。

## 4. 范围（受影响模块）
- `prisma/schema.prisma` + 新 migration（**core-change，Prisma 三步**）：`Course.deletedAt` + 索引；`ContentBlock.chapterId` RESTRICT→Cascade。
- `lib/services/course.service.ts`：新增 archive/restore/purge/listArchived；改 `teacherCourseFilter`；废除 archive 路径上的 HAS_CHAPTERS/HAS_INSTANCES 闸。
- `lib/api-utils.ts`：P2003 → 中文错误兜底。
- `app/api/lms/courses/[id]/route.ts`（DELETE 改语义=归档）+ 新增 restore / purge / 归档列表端点。
- 读取点过滤（见 §7 清单）：`dashboard.service`、`announcement.service`、`task-instance.service`、`study-buddy` posts route、`submission.service`/`/api/submissions`、`lib/auth/course-access.ts`、`lib/auth/resource-access.ts`。
- UI：`app/teacher/courses/page.tsx` + `components/teacher-courses/teacher-course-card.tsx` + 回收站视图/弹窗。

## 5. 验收标准（done 的定义）
1. 老师可一键归档任意自有课程（**无须先清空章节/实例**）；归档后课程、其章节内容、其已发布任务从**所有页面**消失：老师课程列表、老师 dashboard、学生 dashboard、学生任务、学生成绩、分析、Study Buddy、公告、课表。
2. 已归档课程**仅**能从 `/teacher/courses` 的回收站入口访问。
3. 回收站"恢复"→ 课程及其任务/成绩/内容原样回归。
4. 回收站"彻底删除"（输入课程名强确认）→ 永久移除课程及全部后代（章节/小节/内容块/任务实例/提交+sim/quiz/subjective/附件/TaskPost/该任务的 SB 帖/分析报告/公告/课表/知识源/草稿/课程-教师·班级关联），**不删共享 Task 模板**；不可恢复。
5. 学生**无法**凭直链 id 访问已归档课程的任务（守卫已加固）。
6. **D6**：在课程编辑里删除一个含内容（小节+内容块）的章节成功，无 FK 错；P2003 已映射中文兜底。
7. `npx tsc --noEmit` 通过；`npx vitest run` 全绿；新增 TDD 测试覆盖 archive/restore/purge + chapter delete + 学生守卫 + grades 过滤。
8. Prisma 三步完成（migrate→generate→**重启 dev server**）并验证页面正常加载。
9. 全部 UI 文案简体中文；Route Handler 无业务逻辑（调 Service）；错误经 `handleServiceError`。

## 6. TDD 单元拆解（vertical slices，逐片 RED→GREEN）
- **U1 schema 地基 + 章节 FK 修复**（core-change）：`Course.deletedAt`+索引；`ContentBlock.chapterId`→Cascade；一个 migration → generate → **重启 dev server** 验证页面加载；`api-utils` 加 P2003 兜底。Tracer 测试："删一个带小节+内容块的章节成功"（改 FK 前 RED → 后 GREEN）。
- **U2 archive/restore/purge service + API**：archiveCourse / restoreCourse / getArchivedCoursesByTeacher / purgeCourse（事务，按 §8 顺序）；owner/admin 守卫 + audit；purge 校验传入 `confirmTitle` 与 courseTitle 匹配。API：DELETE /courses/[id] 改为归档；POST /courses/[id]/restore；DELETE（或 POST）/courses/[id]/purge；归档列表端点。测试：archive 置位 / restore 清位 / purge 删后代且留 Task 模板 / 非 owner 403 / purge 名称不符拒绝。
- **U3 读取点过滤 + 学生守卫 + grades**（最高风险）：F3 集中过滤 + §7 各 bucket；F1 学生守卫加固；F2 grades 过滤。测试：归档课程不在 getCoursesByTeacher / 学生 dashboard 无其 published 实例 / 学生凭 id 读其实例抛错 / grades 不含其提交。QA **真浏览器**逐面验。可拆 U3a 老师面 / U3b 学生面+守卫 / U3c 分析·SB·公告。
- **U4 UI 回收站 + 归档按钮**：课程卡删除按钮去掉 hasContent 禁用、改"删除（移入回收站，可恢复）"一键归档；头部加"已删除课程/回收站"入口；回收站列归档课程，每条带"恢复"+"彻底删除"（彻底删除弹窗需输入课程名）。中文。QA 真浏览器。
- **U5 写路径守卫（P2，可选）**：F4。不阻塞核心，最后做或单独跟进。

## 7. 读取点过滤清单（防泄漏 audit — QA 须逐项确认无泄漏）
> 注：行号来自对 ≈#17 代码的勘查，worktree 基于 #20（#18–20 为 0-schema 逻辑改动），builder 须按 worktree 实际代码复核行号。TaskInstance 过滤用 `course: { deletedAt: null }`，保留 `courseId=null` 独立实例处用 `OR:[{courseId:null},{course:{deletedAt:null}}]`。

**必过滤（Bucket 1 老师面）**：`course.service` getCoursesByTeacher / getCoursesByClass；`dashboard.service` 老师 courses/instances/recentSubmissions/counts；`task-instance.service` getTaskInstances（老师分支）。
**必过滤（Bucket 2 学生面）**：`dashboard.service` 学生 courses/instances/announcements/scheduleSlots；`/api/submissions` GET（F2）。
**必过滤（Bucket 3 分析/SB/公告）**：`announcement.service` getAnnouncements（teacher+student 分支）；`/api/teacher/study-buddy/posts` 课程列表。分析类（analytics-v2 / scope-insights / scope-drilldown）多按显式 courseId + `assertCourseAccess`，**靠访问守卫拦截**，不在查询层加（除非 QA 发现泄漏）。
**加固守卫（Bucket 4 学生分支）**：`assertCourseAccessForStudent`、`assertTaskInstanceReadable` 学生分支拒已归档（F1）。teacher/owner 分支、actor-role、写路径 by-id 守卫**不加**（owner 需访问以恢复/彻底删除）。
**不过滤（Bucket 5）**：archive/restore/purge/归档列表本身（操作的就是已归档行）。
**保持可访问**：`getCourseWithStructure`（owner 直链可开，正常导航已从列表移除；学生由 F1 拦）。

## 8. 彻底删除级联顺序（FK 约束事实，事务内按此序）
先解析 id 集（本课程的 chapterIds / sectionIds / instanceIds；这些实例的 submissionIds；这些提交的 subjectiveSubmissionIds），再：
1. attachment（by subjectiveSubmissionIds）
2. simulationSubmission / quizSubmission / subjectiveSubmission（by submissionIds）
3. studyBuddyPost（taskInstanceId in instanceIds **或** courseId=X）/ taskPost / analysisReport / **submission**（by instanceIds）
4. courseKnowledgeSource（courseId=X）/ taskBuildDraft（courseId=X）
5. taskInstance（courseId=X — 注意 TaskInstance.courseId 是 SET NULL，必须显式删）
6. **contentBlock（courseId=X）** ← 解 ContentBlock 两条 RESTRICT
7. **section（courseId=X）** ← 解 Section.courseId RESTRICT
8. chapter（courseId=X）
9. announcement / scheduleSlot / courseTeacher / courseClass（courseId=X；多为 CASCADE，显式列出求确定性）
10. course（id=X）
**不删**：共享 `Task` 模板。6→7→8→10、1→2→3 为承重次序。

## 9. 风险登记
- **R1（最高）读取点漏过滤**：漏一处 → 归档课程/任务"诈尸"。缓解：F3 集中过滤 + §7 清单逐项 + QA 真浏览器逐面验（老师列表/dashboard/学生 dashboard/任务/成绩/分析/SB/公告/课表 + 直链 id 学生访问）。
- **R2 purge 级联不全**：漏表 → FK 错或孤儿行。缓解：§8 顺序 + 事务 + purge 后断言后代计数=0 且 Task 模板存活。
- **R3 学生数据安全**：归档可逆零损失；**彻底删除真销毁**，必须强确认（输课程名）+ owner/admin 校验 + audit 留痕。
- **R4 Prisma 三步**：改 schema 后必 migrate→generate→**重启 dev server**验证页面（仅 generate 会运行时 500）。
- **R5 anti-regression**：改 `course.service` 接口须同步所有调用方（teacherCourseFilter 被 dashboard/announcement/SB 复用）；DELETE 语义从硬删改归档，须确认无其他调用方依赖旧硬删语义；diff 控制、勿顺手重构。
- **R6 共享 dev DB**：worktree 复用 dev `finsim`(5432)，迁移仅 **additive**（nullable 列）安全；**严禁** reset/seed/drop dev 库。dev server 验证用非 3000 端口避免撞已运行实例。

## 10. 工作流
1. Builder 串行 U1→U2→U3→U4(→U5)；每片 TDD（先写失败测试）。每片写 `reports/build_course-archive_{unit}_rN.md`；QA 写 `reports/qa_course-archive_{unit}_rN.md`；整体一行进 `progress.tsv`。
2. **Dynamic exit**：两次连续 PASS 即收该 unit；同一 FAIL 三连回本 spec 重规划，不硬磨。
3. Builder↔QA 经 SendMessage 直接迭代；Coordinator 监控 TaskList + progress.tsv，遇反复失败/需求缺口再介入。
4. 全绿后 Coordinator 汇总，**等用户确认**再 commit/push/开 PR（PR 会自动打 `core-change` 标签）。worktree 内工作，不碰主 checkout。

## 11. 附录 · D6 范围澄清（QA U1 勘查后确认 2026-05-25）
- 章节删除的**真实用户路径**是课程编辑器"删除章"→ 批量保存（**replace 模式**）→ `app/api/lms/courses/[id]/outline-apply/route.ts:246` 的 `tx.chapter.delete()`（依赖级联），此前撞的正是 `ContentBlock.chapterId` RESTRICT → 用户看到"好像删除不了"。
- **U1 的 FK 修复已覆盖此路径**（chapter.delete 现级联内容块）。**无须**新增调用 `DELETE /api/lms/chapters/{id}` 的前端按钮（该端点存在但 UI 未引用；outline 编辑路径才是真路径，已修好）。
- `findReplaceBlockers`（outline-apply:398）对"含任务实例章节"的拒删（"请先删除任务"）是**有意守卫**，保留不动。
- **QA 须补验真路径**：replace 模式删一个"有小节+内容块但无任务实例"的章节并保存 → 成功无 FK 错。U1 已测 raw 端点，此项补 outline-apply 真路径，并入 U4 或单独一轮。

## 12. 决策记录 · 预存 :1141 crash 纳入本 PR（coordinator 拍板 2026-05-25）
- `app/teacher/courses/[id]/page.tsx:1141` `course.class.id` 在 deprecated classId=null 时崩 → 课程详情页打不开（origin/main 同款，非本 PR 引入）。
- **决策=A，纳入本 PR 顺带修**（一行 null 安全 `course.class?.id ?? null` + 确保下游 primaryClassId 接受 null）。理由：真崩溃 + 一行 + builder 本就在改同页文案 + QA 需该页加载。
- 依据 CLAUDE.md 新增「与用户沟通方式」：技术/scope 决策由 coordinator 自行拍板，不再向用户索 A/B/C。
- QA 须验：classId=null 的课程详情页正常加载。
