# Build Report — U3 读取点过滤 + 学生守卫加固 + grades 过滤（最高风险，r1）

worktree: `finsim-course-archive` / branch `claude-course-archive`

## 目标（spec §6 U3 / §7 清单 / F1·F2·F3 / R1）
归档后课程及其任务/成绩/内容/公告/课表从**所有页面**消失，恢复后原样回归；学生无法凭直链 id 访问已归档课程任务。逐项落实 §7 五个 bucket。

## 改了什么（文件）

### F3 集中过滤（lib/services/course.service.ts）
- 拆出 `teacherCourseScope(teacherId)` = 原始 OR（不含 deletedAt），**仅供回收站列表用**
- `teacherCourseFilter(teacherId)` 改为 `{ AND: [teacherCourseScope, { deletedAt: null }] }` —— dashboard/announcement/schedule/SB/weekly-insight 等所有复用方一处生效，已归档课程自动消失
- `courseClassFilter(classId)` 改为 `{ AND: [{classes:{some:{classId}}}, { deletedAt: null }] }`
- `getArchivedCourses` 改用 `teacherCourseScope`（否则 `AND[{deletedAt:{not:null}}, {AND:[scope,{deletedAt:null}]}]` 自相矛盾恒空）

### Bucket 1 老师面 OR 分支补漏（F3 不能覆盖的 createdBy/creatorId 分支）
- `dashboard.service.ts` getTeacherDashboard：
  - taskInstances 的 `{createdBy}` 分支 → `{ createdBy, OR:[{courseId:null},{course:{deletedAt:null}}] }`（归档课程的本人实例消失，保留 standalone）
  - recentSubmissions + 统计 submissionFilter 的 `{task:{creatorId}}` 分支 → 加 `OR:[{taskInstanceId:null},{taskInstance:{OR:[{courseId:null},{course:{deletedAt:null}}]}}]`
- `task-instance.service.ts` getTaskInstances：加 `!filters.courseId && { AND:[{OR:[{courseId:null},{course:{deletedAt:null}}]}] }`（老师/学生列表均过滤；**显式 courseId 查询不加闸** → 直链特定课程/owner 恢复保持可访问，Bucket 5）

### Bucket 2 学生面
- `dashboard.service.ts` getStudentDashboard：
  - taskInstances `{classId,status}` 加 `OR:[{courseId:null},{course:{deletedAt:null}}]`（原本无课程闸 → 归档课程任务会泄漏给学生）
  - courses/announcements/scheduleSlots 走 `courseClassFilter` → F3 自动覆盖
- **F2 grades**（submission.service.ts getSubmissions）：`!filters.taskInstanceId` 时加 `OR:[{taskInstanceId:null},{taskInstance:{course:{deletedAt:null}}}]`（兑现 D2：学生 /grades 不见已归档课程成绩；保留 standalone 提交；显式 taskInstanceId 不加闸——已有实例守卫 + owner 需访问）

### Bucket 3 分析/SB/公告
- announcement.service / schedule.service / study-buddy posts route / weekly-insight → 全部复用 F3 的两个 filter，自动覆盖 teacher+student 分支（无额外 OR 分支泄漏）
- 分析类（analytics-v2/scope-insights/scope-drilldown）按 spec：显式 courseId + assertCourseAccess（owner 守卫），靠守卫拦截，不在查询层加（owner 恢复需访问；学生不触达）

### Bucket 4 学生守卫加固（F1）
- `lib/auth/course-access.ts` assertCourseAccessForStudent：select 加 `deletedAt`，已归档 → FORBIDDEN（teacher/owner 分支不动）
- `lib/auth/resource-access.ts` assertTaskInstanceReadable **学生分支**：select 加 `course:{deletedAt}`，实例所属课程已归档 → FORBIDDEN（即便实例 status 仍 published）。teacher/owner（createdBy / 课程访问）分支保持开放（Bucket 5，恢复用）

### Bucket 5 不过滤
- archive/restore/purge/getArchivedCourses 本身（操作已归档行）；getCourseWithStructure owner 直链；显式 courseId 的 by-id 访问 —— 均按 spec 保持可访问

## TDD / 测试
- `tests/course-filter.test.ts`（更新）：新增 teacherCourseScope 测试 + teacherCourseFilter/courseClassFilter 改为 AND+deletedAt:null 形状
- `tests/course-archive-guards.test.ts`（新，7 测试）：F1 学生拒已归档课程（course-access + instance-readable）+ Bucket4 owner 仍可访问 + F2 getSubmissions where 形状（studentId 加闸 / 显式 instanceId 不加闸）
- 更新既有断言（**均为 U3 预期行为变化**，非迁就实现）：`schedule-announcement.service.test.ts`(4)、`teacher-dashboard.test.ts`(1)、`dashboard.service.test.ts`(1)、`course-access-readable.test.ts`(3 处 happy-path mock 补 `deletedAt:null` 代表正常课程)

## 验证结果
- `npx tsc --noEmit`：通过
- `npx vitest run`：**117 文件 / 1199 测试全绿**（无回归；6 处 where-shape 断言已按 U3 预期更新）
- **R1 真 DB 端到端集成证明**（`scripts/verify-archive-readpoints.ts`，PASS）：建 throwaway 课程（关联学生班级）含已发布实例 + 学生 graded 提交 + 公告 + 课表 →
  - 归档前：老师 dashboard(courses/instances/announcements/scheduleSlots) + getCoursesByTeacher 列表 + 学生 dashboard(courses/tasks/announcements/scheduleSlots) + 学生 getSubmissions **全部可见**
  - 归档后：以上**全部消失**（无"诈尸"）
  - 恢复后：**原样回归**
  - 结束 purge 清理（leftover probe=0）
- dev server（webpack/3003）健康，`/login` 200，无编译错误

## 需要 QA 注意 / 怎么验（真浏览器，最高风险 — 逐面验防泄漏）
dev server 用 `--webpack`（同 U1/U2）；我在 3003 跑着。建议用一个有已发布任务+成绩的课程，归档后逐面确认消失、恢复后回归：
1. 老师课程列表 /teacher/courses、老师 dashboard
2. 学生 dashboard、学生任务、学生成绩 /grades
3. 分析（按归档课程的 courseId 访问应被 owner 守卫允许=可恢复语境；学生不触达）、Study Buddy 老师面、公告、课表
4. **直链 id 学生访问**：学生用已归档课程下某 published 实例的直链 → 应 403（守卫拦截）
5. 恢复后以上全部回归
- 集成脚本可直接复现 R1：`npx tsx scripts/verify-archive-readpoints.ts`（PASS）

## 不确定 / 延后 / flag
- **显式 courseId/taskInstanceId 的 by-id 访问按 spec Bucket 5 保持可访问**（owner 恢复用）：getTaskInstances 显式 courseId、getSubmissions 显式 taskInstanceId、announcement/schedule 显式 courseId 均不加归档闸。若 QA 认为某处仍泄漏（如学生侧能凑出已归档课程的 courseId 拉公告），告诉我再收紧。
- announcement.service / schedule.service 的"显式 courseId 且无 classId/teacherId"分支不加 course 过滤（原设计），同 Bucket 5；学生侧实际走 classId 分支（已过滤）。
- 预存 bug（teacher courses/[id]/page.tsx:1141 `course.class.id`）仍未修，等 team-lead 裁决（已 flag）。

## Prisma 三步 / dev server 重启
- 本 unit 无 schema 改动。dev server（U1 起的 webpack/3003）热加载本 unit 服务改动，健康无 500。
