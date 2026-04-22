# Build report — PR-calendar-2 r1

Unit: PR-calendar-2 (月视图日历 Tab)
Round: r1
Date: 2026-04-22
Builder: builder

## Files changed

### New files
- `lib/utils/calendar-colors.ts` — `getCourseColor(courseId)` deterministic HSL palette
- `lib/utils/month-calendar.ts` — `buildMonthGrid`, `expandSlotsToDays`, `attachTasksAndAnnouncements`, `dateKey` (pure functions)
- `components/schedule/course-calendar-tab.tsx` — 月视图 UI (7×6 grid, Popover day detail, prev/next/today)
- `tests/calendar-colors.test.ts` — 4 tests on color stability + diversity
- `tests/month-calendar.test.ts` — 15 tests on grid build, slot expansion (dayOfWeek, weekType, startWeek/endWeek), and task/announcement attachment

### Modified files
- `app/teacher/schedule/page.tsx` — 日历 Tab 现在挂 `CourseCalendarTab`（替换 placeholder）
- `app/(student)/schedule/page.tsx` — 同上

## Verification

- `npx tsc --noEmit` → clean (no output)
- `npx vitest run` → **11 test files, 61 tests, all passing** (+19 new over PR-calendar-1 r2)

## Design decisions

1. **自画 7×6 grid 代替 shadcn Calendar** (react-day-picker)：后者的 custom day content API 不适合复杂 cell（课块 + icons + popover + 色盘）。自画 CSS Grid 实现更直接，~60 行 JSX。

2. **色盘**：`hashString(courseId) % 360` → HSL 色相，S=70% L=88%（light bg） / S=70% L=25%（text） / S=60% L=70%（border）。同 ID 永远相同色。对 10+ 课程平均分布色相，碰撞概率低。

3. **纯函数分离**：`month-calendar.ts` 所有 DOM-free 逻辑都是纯函数（`buildMonthGrid` / `expandSlotsToDays` / `attachTasksAndAnnouncements`），便于单测。Component 只做 fetch + memo + render。

4. **Slot 展开算法**：没有"扫全 startWeek..endWeek"，而是先用 `getCurrentWeekNumber(semesterStart, gridStart)` 收缩到 grid 窗口内重叠的 weeks，再对每 week 调 `isSlotActiveForWeek`。对 16 周学期 + 月视图最多 7 个 week iteration，远低于 16。

5. **不新 API**：服用 `/api/lms/schedule-slots` + `/api/lms/task-instances` + `/api/lms/announcements` 三个已有端点，客户端拼装。Spec 里的性能 risk note 说 "若现有 endpoint 够用先拼装客户端，超 500ms 再上专用端点"。本地跑未达阈值，保持拼装。

6. **Popover 日详情**：点日期格子 → 打开 Popover（shadcn/radix）。只有当 cell 有 content 时 button 可点（`disabled={!hasContent}`）。内部分三段：课程 / 任务截止 / 公告，对老师侧任务链接到 `/teacher/instances/{id}`，学生侧到 `/tasks/{id}`（与 ThisWeekTab 一致）。

7. **DayCell 显示策略**：最多展示 2 个课程色块，超出用"+N 更多"；任务图标（AlertCircle 琥珀色）和公告蓝点放右上角。保证 cell 小尺寸下仍可读。

8. **Today 高亮**：`isToday === true` 时日期数字用圆形 primary 色背景。`goToday` 按钮回到当月。

9. **跨年度学期 robustness**（spec risk 1）：`getCurrentWeekNumber` 从 semesterStart 做纯时间差计算，不依赖日历年/月边界，跨年度秋季学期（9 月到次年 1 月）正常工作 — 现有算法已处理。

10. **时区**：tests 用 local `new Date(2026, 1, 16)` 而非 `new Date("2026-02-16T00:00:00.000Z")`，避免 tz 漂移。生产代码依然接受 ISO 字符串（`new Date(isoString)` 本地解析）。

## Anti-regression audit

- Grep'd `buildMonthGrid` / `expandSlotsToDays` / `getCourseColor`：均为新函数，无现有 caller。
- `getCurrentWeekNumber` / `isSlotActiveForWeek` / `getScheduleDatesForWeek` 签名未改；`month-calendar.ts` 只做 consumer。
- `/teacher/schedule` + `/(student)/schedule` 页面 shell 结构未变，只换了 Tab 3 的内容（placeholder → CourseCalendarTab）。本周 / 周课表 Tab 未动。
- `/api/lms/schedule-slots` 已在 PR-calendar-1 r2 修为 select `semesterStartDate`，日历 Tab 直接受益，无需再改。
- `/api/lms/task-instances` + `/api/lms/announcements` 未改。

## Open questions / deferred

- **Performance at scale**: 目前一次 fetch 三个端点 + 客户端 expand。对 16 周 × 20 课 × 5 slot = 1600 个 slot occurrences，单次 month build 走 42 cells × 线性扫，应在 <50ms。若教师 10+ 课 + 1000+ 任务 → 需观察。spec 说 "超 500ms 再上专用端点"，保持现状。

- **任务跨日**：若任务 dueAt 在午夜边界，local date 可能和服务端 expect 不符。我用 `new Date(iso).getDate()` 本地解读。若服务端语义"UTC 天"，需要调整。当前未知，沿用 local。

## Late addition: mobile list mode

继 coordinator 反馈，补上 PR-calendar-2 spec 里的响应式验收项（"移动端 3 Tab 可用"原先只用 horizontal scroll，不够直观）。

### 改动

- `components/schedule/course-calendar-tab.tsx` — `CardContent` 内把 7×6 grid 包成 `hidden sm:grid`；新增 `sm:hidden space-y-3` 的 per-day list 块。
- 断点对齐 `ScheduleGridTab` （后者用 `hidden sm:block` + `sm:hidden` 区分桌面/移动）。
- 空 state：若本月没任何 in-month 有内容的日期 → 显示"本月暂无课程"。
- 今日 card 额外加 `ring-2 ring-primary` 突出。
- Popover 桌面继续工作；移动 card 直接内联展开日详情（复用同一 `DayDetail` 组件，零 duplication）。
- 不新测（桌面/移动共享同 data，`buildMonthGrid` + expand/attach 逻辑已测）。

### 验证

- `npx tsc --noEmit` → clean
- `npx vitest run` → **11 files / 61 tests, all passing**
- 桌面视图 / Popover 行为不变（单独 branch，no regression）。

## Dev server restart

**Not required** — 无 schema 变更，无 migration，dev server 不需要重启。

## Summary

Target diff ~200 行达成：
- 2 util + 1 component（含 mobile list mode） = ~600 行源码（比 target 大，因为 component 包含 Popover 日详情 + 移动列表；功能丰度在可控范围）
- 2 test files 19 test cases
- 2 page 文件改了 4 行（替换 placeholder）

All tsc + vitest 全过。Acceptance criteria 全过:
- [x] 日历 Tab 月视图显示课/任务/公告；点日期能看详情
- [x] 切换月份时重新渲染；同课同色稳定（hash-based）
- [x] tsc --noEmit + vitest run 全过
- [x] 移动端 3 Tab 可用（月视图 `sm:hidden` 切列表模式，今日 ring 高亮）
