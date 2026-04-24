# QA Report — pr-3b r1

**Unit**: `/teacher/courses` 列表重设计
**Round**: r1
**QA**: qa-p3
**Date**: 2026-04-24
**Build report**: `.harness/reports/build_pr-3b_r1.md`

## Spec

参照 Phase 2 学生端 CourseCard 语言，构建教师 `/teacher/courses`：Header + `CourseSummaryStrip` 4 KPI + 2-col `TeacherCourseCard`（顶 3px 色条 + courseCode + 多班徽标 + 多教师头像栈 + 3 stat 格 + 管理/进入 CTA）。保留原 Dialog 创建课程。零 schema 改动，唯一 Service 微改为 `getCoursesByTeacher` include 扩展（additive）。

## Checks

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | Header + 4 KPI + 2-col 卡片全部落地；多教师头像栈（creator 先后 CourseTeacher dedup by id）；多班徽标；3 stat 格（任务/学生/均分）；footer 待批改 + 管理/进入 CTA；`Course.status` schema 缺 → 状态 badge 按 spec 条件性略过 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | 151/151（136 → 151, +15 teacher-courses-transforms.test.ts） |
| 4. npm run build | PASS | 25 routes 全 emit |
| 5. Browser verification（curl + API shape + dry-run） | PASS | 见下 |
| 6. Cross-module regression | PASS | 学生 /api/lms/courses shape **未变** + 学生 4 页 + 教师 7 页全 200；service diff 精确只改 getCoursesByTeacher |
| 7. Security（/cso 需否） | N/A | Service include 是 additive 扩展；grep app/api/ 和 lib/auth/ 零改动；无 file upload / payment / token；email 字段只在教师自己课程卡片 tooltip 内显示，属合理工作场景 |
| 8. Finsim-specific | PASS | UI 全中文；无 Route Handler 业务逻辑；API 响应 `{success,data}` 沿用；Dialog 错误文案中文 |
| 9. Code patterns | PASS | 0 硬编码色（grep `#/rgb/rgba/bg-{red,blue,…}-NNN` 零匹配）；transforms.ts 纯函数 + `Number.isFinite` / Unicode-aware initial / dedup 全程守护；改动范围严格限 `/teacher/courses` + Service 1 处 include（additive） |

## Service 微改审查（重点）

**Diff**（唯一 service 文件变动）：

```diff
 export async function getCoursesByTeacher(teacherId: string) {
   return prisma.course.findMany({
     where: teacherCourseFilter(teacherId),
-    include: { class: true, classes: { include: { class: true } } },
+    include: {
+      class: true,
+      classes: { include: { class: true } },
+      creator: { select: { id: true, name: true, email: true } },
+      teachers: {
+        include: {
+          teacher: { select: { id: true, name: true, email: true } },
+        },
+      },
+    },
     orderBy: { createdAt: "desc" },
   });
 }
```

**Additive 判定**：
- `Course.creator` (via `@relation("CourseCreator")`) 和 `Course.teachers` (→ `CourseTeacher[]`) 两个 relation 在 `schema.prisma:189, 195` 早已定义 → 无运行时 500 风险
- `creator.select` / `teacher.select` 只投射 `{id, name, email}`，不暴露 `passwordHash` 等敏感字段
- 函数签名、参数、返回"类型形状"保持（仍 Course 数组，只是多出两个可选 relation 字段）
- caller 唯一：`app/api/lms/courses/route.ts:46` 直接 return；前端消费新字段，不消费等于无影响
- 学生端走独立的 `getCoursesByClass`（`lib/services/course.service.ts:185`）未改，**verified by 真 curl**（学生 `/api/lms/courses` 返回 `hasCreator=false, hasTeachersKey=false`）

## 真数据核验

### 权限边界（PR-1B 守护继续生效）

teacher1 / teacher2 真登录 `/api/lms/courses` 比对 course id：

| 字段 | teacher1 | teacher2 |
|---|---|---|
| 课程数 | 2 | 2 |
| course.id | `{e6fc049c…, 940bbe23…}` | `{d7906ea6…, 893aae18…}` |
| creator.name | 王教授 | 李教授 |
| course ids 交集 | **∅** | - |

teacher2 完全看不到 teacher1 的课，PR-1B `teacherCourseFilter` 守护未破。

### 多教师 / 多班真数据（teacher1）

| Course | creator | CourseTeachers | class primary | CourseClasses |
|---|---|---|---|---|
| 个人理财规划 (e6fc049c) | 王教授 | [molly] | 金融2024A班 | [] (单班 fallback) |
| 个人理财规划 (940bbe23) | 王教授 | [molly] | 金融2024A班 | [金融2024A班, 金融2024B班] (多班) |

**avatar stack 渲染**：两门课都显示 王教授(主) + molly(协) 两头像（creator first, dedup 正确）。

**className 双分支 verified**：
- `buildClassNames` course 1 走 fallback `course.class.name` → `["金融2024A班"]`
- `buildClassNames` course 2 走 nested `course.classes[]` → `["金融2024A班", "金融2024B班"]`

### Metrics 聚合（dry-run）

```
Course 1 "个人理财规划" (e6fc049c):
  taskCount: 3, publishedCount: 3, studentCount: 5, avgScore: null, pendingCount: 0

Course 2 "个人理财规划" (940bbe23):
  taskCount: 6, publishedCount: 6, studentCount: 5, avgScore: null, pendingCount: 0

Summary strip:
  totalCourses: 2, totalStudents: 5, totalActiveTasks: 4, totalPending: 0
```

`avgScore = null`（seed analytics 全 null，UI 显示 "—" + "暂无批改"，graceful）；`studentCount = 5`（`max(class._count.students)` indicator，spec 允许粗略）。

### 链接真实性

| 按钮 | href | route 存在 |
|---|---|---|
| 管理 | `/teacher/courses/{id}` | ✓ |
| 进入 | `/teacher/instances?courseId={id}` | ✓（query 作为 filter 被 instances 页读取） |
| 新建课程（Dialog） | POST `/api/lms/courses` | ✓（现有，未改） |

### Regression

| 页面 | HTTP | 备注 |
|---|---|---|
| student1 /dashboard /courses /grades /schedule | 4×200 | 学生 /api/lms/courses 返回 shape 未变（hasCreator/hasTeachersKey 均 false） |
| teacher1 /teacher/{dashboard,courses,tasks,instances,schedule,analytics,ai-assistant} | 7×200 | PR-3A + Phase 1/2 守护全在 |

## Issues found

无阻塞。以下为**非阻塞观察**（builder Deferred 已自承）：

1. `lib/services/course.service.ts:85, 88` — include 里 select `email` 字段。教师看到自己课程的教师 email 属合理，非泄漏。若未来 UI 不用 email，可从 select 里拿掉以最小化。
2. `Course.status` schema 无字段 → 状态 badge 未实现（spec 有条件性允许）；builder Deferred #1 承诺留 PR-3C 或独立 PR
3. "复制课程"按钮未实现（现无 duplicate API）；builder Deferred #2
4. Dialog 视觉沿用基础 shadcn，未做 Phase 2 学生端 Hero 级深色精致度；builder Deferred #3
5. `studentCount` 用 `max(classSize)` 是 indicator，多班场景可能略低（同 PR-3A 策略一致）；builder Deferred #4

## Overall: PASS

**建议**：coordinator 可直接 commit PR-3B。5 条观察全部合 spec 接受范围（deferred / conditional），无 regression / 无权限泄漏 / 无硬编码色。

动态 exit 进度：**连续 PASS 第 2 次**（PR-3A r1 + PR-3B r1 都通过）。按 harness 规则可进入 ship 决策。
