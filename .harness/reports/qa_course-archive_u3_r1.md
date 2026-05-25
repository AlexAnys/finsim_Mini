# QA Report — course-archive U3 r1（最高风险：读取点过滤 + 学生守卫 + grades）

## Spec: U3（spec §6 U3 / §7 五 bucket / F1·F2·F3 / R1 防诈尸）

worktree `finsim-course-archive` / branch `claude-course-archive`；build report: `build_course-archive_u3_r1.md`

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | F3 集中过滤(teacherCourseFilter=AND[scope,deletedAt:null] / courseClassFilter 同；teacherCourseScope 拆出供回收站，getArchivedCourses 改用 scope 避免自相矛盾)；Bucket1 老师面 createdBy/creatorId OR 分支补归档闸；Bucket2 学生 dashboard + F2 grades；Bucket4 F1 两守卫学生分支拒已归档；Bucket5 显式 courseId/taskInstanceId by-id 不加闸(owner 恢复用)。逐项对齐 §7。 |
| 2. tsc --noEmit | PASS | exit 0 |
| 3. vitest run | PASS | 117 文件 / 1199 测试全绿；新增 course-archive-guards.test.ts(7)；更新 6 处既有 where-shape 断言——逐条核对均为**真实 U3 行为变化**(加 deletedAt:null/OR 分支)，非迁就实现弱化。 |
| 4. Browser/HTTP (/qa-only) | PASS（API 层逐面真验；页面 render 受阻于 U4 WIP，见下） | 真浏览器**双角色**(teacher1 王教授 + student1 张三/金融2024A班) 真 HTTP，fixture=有 published 实例+graded 提交(88分)+公告，关联 A 班。**归档前**：teacher 课程列表 containsFixture=true / 实例列表 containsInst=true。**归档后**：teacher 列表 false(6→5) / 实例 false(26→25) / dashboard summary courseHit=instHit=annHit=slotHit=subHit=**全 false** / SB posts containsFixtureId=false / announcements containsFixture=false / GET /archived containsFixture=true。**学生侧归档后**：dashboard courseHit=taskHit=annHit=slotHit=**全 false** / /grades gradesContainsArchived=**false** / **F1 直链 instance→403 FORBIDDEN** / **F1 直链 course→403 FORBIDDEN**。**恢复后(证明可逆非死锁)**：学生 instance 直链→**200** / grades→submission 回归 true / dashboard courseBack=taskBack=true。 |
| 5. Cross-module regression | PASS | F3 收敛进 teacherCourseFilter/courseClassFilter，所有复用方(dashboard/announcement/schedule/SB/weekly-insight)一处生效——已逐 endpoint 真 HTTP 验无泄漏。teacherCourseScope 新增不破坏既有调用(filter 签名未变)。diff 仅 §7 清单内文件 + 2 测试 + 1 脚本，无 drive-by。 |
| 6. Security (/cso) | N/A→人工核 | U3 改访问守卫(F1)。人工核 + 真 HTTP：学生对已归档课程 instance/course 直链均 403；teacher/owner 分支保持开放(createdBy match 即过，测试 case 验证)。无垂直越权放大。Bucket5 显式 by-id 不加闸是 spec 明确设计(owner 恢复需访问)，已确认学生侧无法借此拉到已归档数据(直链 instance/course 被 F1 拦)。 |
| 7. Finsim-specific | PASS | 守卫抛 FORBIDDEN→中文「权限不足」经 handleServiceError；service 层改动无 Route Handler 业务逻辑。 |
| 8. Code patterns | PASS | F3 集中过滤=正确抽象(一处生效胜过散落补丁)；OR 分支用 `AND:[{OR:[...]}]` 包装避免与 createdBy 的 OR key 碰撞(Prisma 同级 key 覆盖陷阱)，shape 正确无 leak；保留 standalone(courseId=null/taskInstanceId=null)。 |

## R1 防诈尸 真 DB 端到端证明
- builder `scripts/verify-archive-readpoints.ts` 独立复跑 **PASS**：建课程(published 实例+graded 提交+公告+课表)→归档前 teacher dashboard(courses/instances/announcements/slots)+列表+学生 dashboard(courses/tasks/announcements/slots)+学生 grades **全可见**→归档后**全消失**(无诈尸)→恢复**原样回归**。self-clean 0 leftover。
- QA 真浏览器双角色 HTTP 矩阵(上 §4)独立复证，含 F1 直链 403 + 恢复可逆。

## ⚠️ 阻塞观察（不属 U3，归 U4）
- 真浏览器加载 `/teacher/courses` **页面崩 500**：`[teacher error boundary] ReferenceError: RecycleBinDialog is not defined at app/teacher/courses/page.tsx:577`。根因=**U4(回收站 UI)WIP**：page.tsx 当前被改动中(git status M)，`RecycleBinDialog` 在 417 行被引用但 540 行才定义/未完整 wire。**与 U3 无关**(U3 不碰此页)，API 与 service 层 U3 过滤完全正常(已用直 API 逐面验)。已 flag builder——U4 收尾时此页须能正常 render，届时我真浏览器补验页面级(课程卡消失/回收站入口/恢复回归)。
- 预存 bug(page.tsx:1141 `course.class.id` deprecated classId=null 崩)仍未修，待 team-lead 裁决。

## Issues found
无 U3 范围问题。U4 page.tsx render 崩为 U4 WIP，已转 builder。

## DB 卫生
- fixture(关联 A 班，含实例/提交/公告) 已 purge 清理；leftoverU3=0，活跃课程 9=基线，归档 0。dev finsim 未 reset/seed/drop。

## Overall: PASS（U3 service+guard 层全绿；页面级 render 验证待 U4 UI 收尾）
