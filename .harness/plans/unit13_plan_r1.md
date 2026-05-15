# Unit 13 Plan — 协作教师 dialog + 学生 tab 隐藏

## 改动

| 文件 | 改动 |
|---|---|
| `app/teacher/courses/[id]/page.tsx:1473-1513` | 协作教师 Dialog 加现有协作者列表（用既有 state `courseTeachers` + handler `handleRemoveTeacher`）。dialog 顶部加 "已添加 N 位协作教师" + 列表 `{name | email | [移除按钮]`；空时显示"尚无协作教师"。 |
| `components/course-detail/course-hero.tsx:28-35` | `TABS` 去掉 `discussion` + `resources`（数组只留 content/tasks/grades/announcements 4 项）；保留 CourseDetailTabKey type 含全部（避免 student page useState 类型 break）。 |
| `tests/e2e/unit13-verify.spec.ts` 新 | (A) molly teacher 课程协作 dialog 显示现有 + 移除按钮；(B) alex student `/courses/[id]` 不看到"讨论"/"资源" tab |

## 决策

- 协作 dialog **不分页**（最多 5-10 协作者，列表展示足够）
- "移除"按钮直接调用既有 `handleRemoveTeacher`，无二次 confirm（教师视角，删除即时反馈）
- 学生 tab 通过删 TABS 数组项实现（不动 type，最小侵入）

## 风险

- 🟢 schema 0 改动
- 🟢 type CourseDetailTabKey 不变，旧引用不破坏
- 🟢 教师视图独立 — 不动 hero 之外的协作展示路径
- 🟢 handleRemoveTeacher 已存在，dialog 直接复用

预计 ~50 行 prod + ~80 行 e2e / r1 即收概率高。
