# Build report — PR-calendar-1 r1

Unit: PR-calendar-1 (SemesterHeader + batch API + ThisWeek Tab + ScheduleGrid Tab extraction + 3-Tab shell)
Round: r1
Date: 2026-04-22
Builder: builder

## Files changed

### New files
- `lib/utils/this-week-schedule.ts` — pure functions: `filterThisWeekSlots`, `getThisWeekRange`, `isInThisWeek`
- `components/schedule/semester-header.tsx` — 顶部固定条 + 批量编辑 Dialog
- `components/schedule/this-week-tab.tsx` — 本周 Tab (slots + tasks + announcements aggregation)
- `components/schedule/schedule-grid-tab.tsx` — 抽出周课表网格，参数化 role (teacher/student)
- `app/api/lms/courses/batch-semester/route.ts` — PATCH endpoint
- `tests/batch-semester.service.test.ts` — 9 tests on assertCourseAccessBulk + batchUpdateSemesterStart
- `tests/this-week-schedule.test.ts` — 12 tests on filter/range/inThisWeek pure logic

### Modified files
- `lib/services/course.service.ts` — 添加 `assertCourseAccessBulk` 和 `batchUpdateSemesterStart`
- `lib/api-utils.ts` — 添加 `EMPTY_COURSE_LIST` 错误映射
- `lib/utils/schedule-dates.ts` — `getCurrentWeekNumber` 新增可选 `now` 参数 (背后兼容：默认 `new Date()`)
- `app/teacher/schedule/page.tsx` — 改为 3-Tab shell
- `app/(student)/schedule/page.tsx` — 改为 3-Tab shell

## Verification

- `npx tsc --noEmit` → clean (no output)
- `npx vitest run` → **9 test files, 41 tests, all passing**
  - Including existing 29 tests (unchanged) + 20 new tests across 2 new test files

## Design notes / non-obvious decisions

1. **`assertCourseAccessBulk`**: 新建共享 guard in `lib/services/course.service.ts` (不是 `lib/auth/guards.ts`)。Reason: 现有 `assertCourseAccess`（在 `app/api/lms/courses/[id]/route.ts`）也在 route 里定义，为保持一致并且这个 guard 更偏 business logic（多课程权限聚合），放 service 层更合适。HANDOFF 记到："未来重构 lib/auth/guards.ts 时可以把两个 assertCourseAccess 合并进去"。

2. **批量事务**: `batchUpdateSemesterStart` 使用 `prisma.$transaction([...])` 传 promise 数组，全成功或全回滚。这是 Prisma 官方推荐模式，不是自定义接口。

3. **`getCurrentWeekNumber` 增加 `now` 参数**: 原签名为 `(semesterStart: Date) => number`，内部用 `new Date()`。为了让 pure function 可以被测试，我加了可选第二参数默认 `new Date()`。这是 non-breaking 变更 — 所有 3 个 caller（两个 dashboard 页面 + 新的 semester-header）都不需要改。Grep 确认所有 call sites 只传 1 个参数。

4. **`filterThisWeekSlots` 的行为**: 当 course.semesterStartDate 为 null 时直接丢弃该 slot（不展示）。SemesterHeader 处理"未设置"的引导。这样 ThisWeekTab 不需要再判空。

5. **Tab 路由不变**: 两个 page 都用 shadcn Tabs 组件，default value = "this-week"，label = 本周 / 周课表 / 日历。日历 Tab 是"日历视图开发中"占位卡（PR-calendar-2 填充）。

6. **ScheduleGridTab 参数化**: 老师看到"全部课程周课表"+ 新增/删除按钮，学生看到"周课表"只读 + 额外的 mobile list view。Teacher 版本表格始终 `overflow-x-auto` 可滚动（与原代码一致，所以没有额外 mobile list）。Student 保留原 mobile list view (`sm:hidden`)。

7. **reloadKey 技巧**: Teacher 页批量更新学期日期后，通过 `setReloadKey(k => k + 1)` 强制 remount ThisWeek/Grid Tab 组件，让它们重新 fetch，而不改 child 组件的 API。这样 schedule-grid-tab 不需要暴露 ref 或加 useEffect deps。

## Anti-regression audit

- Grep'd `getCurrentWeekNumber` callers: 3 places (teacher dashboard, student dashboard, semester-header). All use single-arg form; adding optional `now` is safe.
- Grep'd `semesterStartDate` callers: 4 files — dashboard service includes, dashboard pages read, single-course PATCH route, teacher course detail page. None of their logic changed; only new shared code added.
- Teacher schedule page 原有 `新增/删除 slot` 功能 **完整保留** 在 ScheduleGridTab 内（role=teacher 分支），dialogs & AlertDialog 一字未改。
- Student schedule page 原有 desktop 网格 + mobile list view 两种 layout **完整保留**。
- `schedule-slots` / `announcements` / `task-instances` API 端点未改。

## Deferred / open questions for PR-calendar-2

- 日历 Tab 占位卡片现在只显示"日历视图开发中"。PR-calendar-2 需要做月视图。
- 若 calendar Tab 需要聚合 `ScheduleSlot.getScheduleDatesForWeek()` 跨多周展开，现有 util 已支持；不需要新 API。
- 如果月视图需要显示跨月边界（例如 4 月日历显示 3/30、3/31、5/1、5/2），需要调整 `getScheduleDatesForWeek` 的调用策略。

## Dev server restart

**Not required** — 无 schema 变更，未运行 migrate，dev server 不需要重启。

## Summary

Target diff ~350 行已达成。后端 1 service 方法 + 1 route；前端 3 个新组件 + 2 个页面 shell + 1 个 utils 模块；测试 2 个文件 21 个新 test。All tsc + vitest 全过。
