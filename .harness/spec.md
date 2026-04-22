# Spec — Ultrareview Findings (2026-04-22)

## Background

`/ultrareview` 扫描 main 分支，26 files changed 范围内返回 **8 个 findings**，集中在 2 个最近 PR 的回归面：
- `bcda6c8 feat: 课程多班级支持 + 协作教师按钮优化 + CourseTeacher/CourseClass 模型`
- `23435b9 refactor: 课程详情页 Tabs 工作台 + 实例页精简 + 注册 404 修复`

这些 bug 已在 main（即生产路径），不是 PR-gate，但多数影响真实用户数据。

## Findings 分级

### 🔴 P0 — 安全 / 数据一致性 blocker（必修，单独 PR）

**B1. PATCH `/api/lms/courses/[id]` 缺 ownership check + `classId` drift**（merged_bug_001）
- 文件：`app/api/lms/courses/[id]/route.ts:44-50`
- 问题 1（IDOR）：`requireRole(["teacher","admin"])` 后直接 `prisma.course.update`，无 `assertCourseAccess`——**任何老师可改任何课的 title/classId**。同 PR 的兄弟路由 `classes/route.ts`、`teachers/route.ts` 已正确防护，就是这个路由漏了。
- 问题 2：`patchSchema` 新加的 `classId` 字段改 `Course.classId` 但不同步 `CourseClass` 表 → 两边永久 drift。
- 修：调 `assertCourseAccess` + 从 schema 删 `classId`（改主班走 CourseClass API）。

**B2. 学生 dashboard 跨班数据泄露**（bug_022）
- 文件：`lib/services/dashboard.service.ts:110-122`
- 问题：`OR: [{ classId }, { course: { classes: { some: { classId } } }, status: 'published' }]` 第二分支**没约束 `TaskInstance.classId`**。课 X 挂了班 A 和 B，给 A 发的 task 会被 B 的学生看到 + 可提交 + 污染 analytics。
- 修：回到 `where: { classId, status: 'published' }`，去掉第二 OR（`TaskInstance.classId` 本身已是 required，不需要课级扩展）。

**B3. `removeCourseClass` 允许删主 class 导致 dangling**（bug_005）
- 文件：`lib/services/course.service.ts:96-100`
- 问题：无 guard，老师在 UI 可一键删除 `Course.classId` 指向的那条 `CourseClass` → `Course.classId` 悬空。结果：原班学生仍通过 `Course.classId` 老分支看到课程，老师侧看不到徽章 → 两边永久不一致。
- 修：事务内 reject `classId === course.classId`（UI 同步隐藏该徽章的 × 按钮），或删的同时把 `course.classId` 切到另一条。

### 🟡 P1 — 功能回归（应修，合成 1 PR）

**B4. 老师 dashboard 丢 standalone task instances**（bug_027）
- 文件：`lib/services/dashboard.service.ts:8-20`
- 问题：`where: { course: teacherCourseFilter(teacherId) }` 对 `courseId=null` 的 standalone instance 一律筛掉（Prisma relation filter + null FK = 不匹配）。Draft/published count 少算，列表漏显。
- 修：`OR: [{ createdBy: teacherId }, { course: teacherCourseFilter(teacherId) }]`（与同文件 recentSubmissions 和 `task-instance.service.ts:86-91` 一致）。

**B5. schedule + announcement service 半迁移**（merged_bug_004）
- 文件：`lib/services/schedule.service.ts:24-30`、`lib/services/announcement.service.ts:~39`
- 问题：只看 `course.classId`，忽略新的 `CourseClass` 关联 → 次班学生在 dashboard 看到但在 `/schedule` / `/announcements` 页面看不到。
- 修：复制 dashboard 里的 OR pattern，建议提取 helper `courseClassFilter(classId)` 放在 `course.service.ts` 边上，和 `teacherCourseFilter` 成对。

**B6. 旧课程 `CourseClass` 未 backfill + 详情页无 UI fallback**（merged_bug_003）
- 文件：`prisma/migrations/20260225034532_add_course_class/migration.sql` + `app/teacher/courses/[id]/page.tsx:1206-1218`
- 问题：迁移只 DDL 不 backfill；老师详情页只从 `courseClasses` 渲染徽章，`course.class.name` fallback 缺失（兄弟页面都有 fallback，就它漏了）。**后果**：每一门历史课打开后只看到"添加班级"占位，老师会以为班级数据丢了。
- 修：两个一起做——(a) 在 migration 末尾追加 `INSERT INTO "CourseClass" SELECT ... FROM "Course" WHERE classId IS NOT NULL ON CONFLICT DO NOTHING`；(b) UI 加 `courseClasses.length === 0 && course.class` 的 fallback 分支。

### 🟢 P2 — UX / 性能优化（延后，可合 1 PR）

**B7. `CourseAnalyticsTab` 串行 N+1 fetch**（bug_009）
- 文件：`components/course/course-analytics-tab.tsx:193-220`
- 问题：`for...of await` 串行 N 个 `/api/submissions` → 20 个 task 在 150ms/req 下 ~3s 加载。Tab 已是主入口（sidebar 的"数据分析"被移除），每次打开都付全价。
- 修：`Promise.all` 并行；更彻底的方案是加 `/api/lms/courses/:id/analytics-summary` 单端点。

**B8. ranking 把未批改和 0 分混淆**（bug_020）
- 文件：`components/course/course-analytics-tab.tsx:235-250` + 渲染表
- 问题：学生首条 submission 未批改时 seed `{avgScore:0, gradedCount:0}`；若该生全程未批改，会以 `avgScore=0` 和真 0 分学生并列底部，且表不显 `gradedCount` 无从分辨。
- 修：过滤 `gradedCount === 0` 出 ranking；或加"待批改"列/徽章。

## Scope (按 PR 拆分)

### PR-fix-1 (P0, ~5 files)
- `app/api/lms/courses/[id]/route.ts` — 加 `assertCourseAccess` + 删 `classId` 字段
- `lib/services/course.service.ts` — `removeCourseClass` 加 guard
- `lib/services/dashboard.service.ts` — student dashboard 去掉第二 OR 分支
- tests：新增 (a) 非 owner teacher PATCH 应 403；(b) 跨班 taskInstance 不出现在对方 dashboard；(c) 删主 class 应 reject
- 验证：`tsc --noEmit` + `vitest run` + 用 `/qa-only` 手跑三个场景

### PR-fix-2 (P1, ~4 files + 1 migration)
- `lib/services/schedule.service.ts` — OR pattern
- `lib/services/announcement.service.ts` — OR pattern
- `lib/services/course.service.ts` — 新增 `courseClassFilter(classId)` helper
- `lib/services/dashboard.service.ts` — teacher dashboard `getTeacherDashboard` 改 OR
- `app/teacher/courses/[id]/page.tsx` — UI fallback
- **新 migration** `prisma/migrations/<ts>_backfill_course_class/migration.sql`（不动旧迁移文件）backfill 历史课程
- 验证：tsc + vitest + qa-only 验证次班学生看到 schedule/announcements、老师 dashboard 含 standalone instance、历史课详情页显示徽章

### PR-fix-3 (P2, 1 file)
- `components/course/course-analytics-tab.tsx` — Promise.all + ranking 过滤 gradedCount===0
- 验证：qa-only 手跑 > 10 个 instance 的课，测加载时间从 ~3s 降到 < 500ms

## Acceptance criteria (全 3 PR 完成后)

- [ ] 非 owner teacher 调 PATCH `/api/lms/courses/[id]` 返回 403
- [ ] 跨班学生查 `/dashboard` 不见对方班 task；查 `/tasks/{id}` 返回 403
- [ ] 删 `Course.classId` 对应的 `CourseClass` 行返回 400（或事务切主班）
- [ ] 老师 dashboard 的 draftCount/publishedCount 含 `courseId=null` 的 instance
- [ ] 次班学生 `/schedule` 和 `/announcements` 返回含父课数据
- [ ] 历史课程（PR merge 前创建）的详情页显示 ≥1 个班级徽章
- [ ] `CourseAnalyticsTab` 打开后主要数据 < 500ms 到位（真浏览器 network 面板）
- [ ] ranking 表不把未批改学生误排到低位
- [ ] `tsc --noEmit` + `vitest run` 全过

## Risks

- **B1 修 classId 字段**：若前端有地方在 PATCH 里带 classId（概率低），会改受影响路径——先 grep `fetch.*courses.*PATCH` 和 `body.*classId`
- **B2 修跨班泄露**：需确认**确实不存在**课级广播的业务场景（一个课的 task 给所有挂的班）——对照最近产品讨论，若确实支持，改为在 TaskInstance 创建时生成 N 条 per-class 实例而不是开放 filter
- **B3 reject 主 class 删除**：UI 需隐藏该徽章的 × 按钮，否则用户体验成"点了没反应"
- **B6 backfill migration**：生产数据量下 `INSERT ... SELECT` 对 `Course` 全表扫；预估行数 < 1k 可直接跑；> 10k 需 chunk
- **所有 service 改**：CLAUDE.md anti-regression #8 — grep 所有 caller，确认签名/返回值不变；本次全是 where 子句内变化，不触及 service 对外接口
