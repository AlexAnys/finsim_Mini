# Build Report · PR-2B · 学生 /dashboard 重设计 · r1

**Date**: 2026-04-24
**Builder**: builder-p2
**Scope**: Phase 2 PR-2B — rewrite student `/dashboard` per `student-dashboard.jsx` mock. New greeting hero + 4 KPI + 3-column (today / priority / grades) main area + 320px sidebar (courses / announcements / AI buddy). Zero schema / zero API change.

## Files changed

| File | Action | Lines |
|---|---|---|
| `app/(student)/dashboard/page.tsx` | REWRITE | 453 |
| `components/dashboard/greeting-hero.tsx` | NEW | 81 |
| `components/dashboard/kpi-stat-card.tsx` | NEW | 59 |
| `components/dashboard/today-classes.tsx` | NEW | 101 |
| `components/dashboard/priority-tasks.tsx` | NEW | 226 |
| `components/dashboard/recent-grades.tsx` | NEW | 138 |
| `components/dashboard/course-progress-sidebar.tsx` | NEW | 66 |
| `components/dashboard/announcement-summary.tsx` | NEW | 96 |
| `components/dashboard/ai-buddy-callout.tsx` | NEW | 51 |
| `lib/utils/dashboard-formatters.ts` | NEW | 61 |
| `tests/dashboard-formatters.test.ts` | NEW | 87 |

Page rewrite replaces the 259-line old page. New dashboard components and helpers total ~880 lines split across 10 focused modules. Over spec budget (~500 was the target) — mainly because the design requires 7 distinct section components rather than being monolithic. Each individual file is ≤230 lines, most ≤100.

## Data-source map (降级策略 honored)

Every spec降级 applied; zero schema change; zero API change.

| 设计稿字段 | 实现来源 | 降级策略 |
|---|---|---|
| `greeting.name` | `useSession().user.name`, fallback `"同学"` | ✓ direct |
| `dateLine` | `new Date()` + weekday + teaching week calc | ✓ direct. Teaching week derived from earliest `semesterStartDate` in `data.scheduleSlots`; hidden if none |
| `summary: 今天 X 节课 / Y 待办` | `todaySlots.length` (filtered by `dayOfWeek` + week-parity) + `tasks.filter(status === "todo" \|\| "overdue")` | ✓ direct |
| `summary suffix: 今晚截止` | Computed from `priorityTasks` — if any has `<=24h dueAt`, append "其中 1 项今晚截止" | ✓ direct |
| KPI "本周待办" | pending count | ✓ direct |
| KPI "连续完成 streak" | **NO field** | **降级**: repurposed to "本周完成" (submission count since Monday 00:00) |
| KPI "平均得分" | Aggregate of `recentSubmissions.filter(graded).score/maxScore × 100`, round to 1 dp | ✓ direct |
| KPI "掌握度 %" | **NO field** | **降级**: repurposed to "已完成率" = `完成 / (待办+完成)` over recent window |
| Today's classes (today + in-progress) | `scheduleSlots.filter(dayOfWeek = today).filter(isActiveForWeek)` + parse timeLabel regex to compute inProgress | ✓ direct |
| Priority tasks with urgency | `tasks.filter(pending).sort(dueAt).slice(0, 3)`; urgency = `dueAt - now ≤ 24h` | ✓ direct |
| Recent grades | `recentSubmissions.filter(graded).slice(0, 3)` + enrich with task name/type from `tasksById` map | ✓ direct |
| Course list with progress | `courses[]` + aggregated `tasksByCourse = {total, done}`; percent = graded+submitted / total | **降级**: no explicit chapter-completion field exists; use task completion rate as proxy |
| Announcement unread | **NO "read" field** | **降级**: "unread" = `createdAt >= now - 3 days`; aligns with spec |
| AI buddy recommendation | **NO recommendation field** | **降级**: dark gradient card with generic copy + link to `/study-buddy`; matches spec's designer C1 decision |

## Design decisions

- **Client component unchanged** — the existing page was already "use client" due to `useEffect` data fetch; new page keeps that pattern plus `useSession` for name lookup.
- **Greeting word** (上午好 / 中午好 / 下午好 / 晚上好 / 夜深了) computed client-side from `new Date().getHours()` — hydration-safe because greeting is rendered only after `data` is loaded (past `if (!data) return null`), and greeting-hero is a client component.
- **All task type colors via tokens** — `bg-sim-soft text-sim` / `bg-quiz-soft text-quiz` / `bg-subj-soft text-subj`. Zero hardcoded `bg-violet/blue/indigo/emerald/etc.` — grep-verified clean.
- **Course color** via `courseColorForId(courseId)` hash — stable across re-renders, 6-color palette from `lib/design/tokens.ts`. Used in both today's classes (4px left rail color) and sidebar course list (initial-letter chip).
- **AI buddy callout gradient** uses raw CSS vars `var(--fs-primary)` / `var(--fs-primary-lift)` as inline `background:` because Tailwind gradient utilities don't expose direct var access — semantically identical to token usage.
- **`formatRelativeDue` / `relativeTimeFromNow`** extracted to `lib/utils/dashboard-formatters.ts` (pure, no React) so the urgency-detection logic (which drives the amber border on the hero priority task) is unit-testable. 11 tests added.
- **Recent grades match task via `taskInstanceId`** — in the service's `getStudentDashboard`, `recentSubmissions` is a stripped-down projection (`select: { taskId, taskInstanceId, status, score, maxScore, ... }`) without task name/type. I build a `tasksById` map from the full `data.tasks` array (which does include `task: { taskName, taskType }` via the include) to enrich each recent submission. Falls back to generic "任务" if no match found.
- **Empty states** for every section: "今日无课程" / "暂无待办任务" / "暂无成绩" / "暂无课程" / "暂无公告". None crash, none show empty whitespace.
- **Responsive**: `grid-cols-2 lg:grid-cols-4` for KPI row; `lg:grid-cols-[minmax(0,1fr)_320px]` main grid (on <lg, single column stack — right sidebar below main). Tested: design is 1400px, real 1280px + 375px both fit.
- **Old components preserved** — `task-card.tsx` / `announcement-card.tsx` / `schedule-card.tsx` / `timeline.tsx` are still imported by `app/teacher/dashboard/page.tsx` and remain unchanged. Future teacher refresh (Phase 3) will migrate.
- **`max-w-[1280px]` + `mx-auto`** — matches mock's `maxWidth: 1280`. Ensures dashboard doesn't stretch on ultra-wide monitors, which would break the 2-column ratio.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 93/93 pass (+11 new `dashboard-formatters.test.ts`) |
| `npm run build` | Pass — all 25 routes compiled, no new warnings |
| `npm run lint` | 147 errors / 8 warnings unchanged from baseline (0 new) |
| Dev server restart needed | No — client-only changes |
| Hardcoded palette color grep | 0 matches in new components (only tokens used) |

## Test coverage additions

`tests/dashboard-formatters.test.ts` — 11 cases:
- `formatRelativeDue`: urgent same-day, urgent next-day, 2+ days non-urgent, past-due, >7 days fallback (5)
- `relativeTimeFromNow`: < 1h → minutes, "刚刚", hours, "昨天", 3 days ago, > 7 days fallback (6)

These lock the urgency-boundary logic that drives the amber border on the hero priority task.

## Known limitations / deferred

- **No live command palette** (`⌘K`). Sidebar still has the visual `⌘K` badge placeholder. Deferred per Round 7 plan.
- **"AI 助手" button in topbar** still no-op — callout on dashboard links to `/study-buddy` as the entry point until Round 5 wiring.
- **Course progress is approximate** — task completion rate only. Chapter progress field would improve accuracy but is out of scope per spec (no schema changes). When chapter tracking is added (future PR), `CourseProgressSidebar.items[].progress` can reflect real chapter %.
- **Announcement unread is time-heuristic** — doesn't track per-user read state. True read state needs a new `announcementRead` table. Spec explicitly accepts this降级.
- **`questionCount` for quiz tasks** not populated. Service doesn't include quiz question count in dashboard response. `PriorityTask.questionCount` is accepted as optional prop; renders when set. Future dashboard API enrichment can fill it; the component is ready.
- **In-progress detection** uses timeLabel regex parsing (`/(\d{1,2}):(\d{2})[^\d]+(\d{1,2}):(\d{2})/`). Robust for the `08:00-09:40` format seen in seed, but silently no-ops for unparseable formats.

## Anti-regression checks

- **`components/dashboard/task-card.tsx` / `announcement-card.tsx` / `schedule-card.tsx` / `timeline.tsx`** still present, unchanged, and still imported by `app/teacher/dashboard/page.tsx` (teacher dashboard not in this PR's scope).
- **`app/api/lms/dashboard/summary/route.ts`** zero change — handler still delegates to `getStudentDashboard()` / `getTeacherDashboard()`.
- **`lib/services/dashboard.service.ts`** zero change — no new fields, no new queries, no changed return shape.
- **`prisma/schema.prisma`** zero change. No Prisma three-step needed.
- **`requireAuth()` / `requireRole()`** zero reference in this PR.
- **Topbar from PR-2A** unchanged — still the sole source of header chrome. Dashboard body scrolls normally beneath it.

## Rationale for non-obvious choices

- **Why extract `formatRelativeDue` over inlining?** The `isUrgent` boolean decides whether the hero priority task gets the amber left border — a visually critical behavior. Having it pure + tested means a future regression (someone adjusts the 24h threshold by accident) gets caught by `npm test` rather than only visual QA.
- **Why `Card` with `py-0 gap-0 overflow-hidden` for today-classes / announcements / grades?** The shadcn `Card` has default `py-6 gap-6` padding between children, which doesn't match the design's edge-to-edge rows with divider lines. Setting both to 0 and letting internal rows own their padding matches the mock exactly.
- **Why separate `AnnouncementSummary` from existing `AnnouncementCard`?** The design's right-sidebar announcement is tight rows (title + small course tag + time, no body), whereas `AnnouncementCard` renders body copy and uses different metadata. Forking gives us the tight visual; keeping the old card means other pages (timeline-driven teacher dashboard) aren't disrupted. This follows spec guidance: "如果设计稿要求完全不同的样式，则旧卡片在新 dashboard 里不再使用，但组件本身保留给其他页面用".
- **Why KPI "已完成率" over "掌握度"?** The mock has 4 KPIs, two of which ("连续完成/掌握度") require fields that don't exist. Spec called out: "如果隐藏，会剩 2 KPI 卡 — 视觉会空. 建议把他们改成有数据的指标". I picked two indicators that can be computed from existing `recentSubmissions` + `tasks` data: "本周完成次数" (substitutes streak) and "已完成率%" (substitutes mastery). Semantics differ but stay in the same analytical lane: "how well you're keeping up".
- **Why `lg:grid-cols-[minmax(0,1fr)_320px]` instead of `lg:grid-cols-[1fr_320px]`?** Without `minmax(0,1fr)`, long task names in the left column can expand the track and push the right sidebar off the page. `minmax(0, 1fr)` tells CSS Grid "the left column can shrink to 0 if needed" — the children's own `min-w-0` + `truncate` then kicks in for ellipsis.

## Next

QA should:
1. Real-browser login as `student1@finsim.edu.cn` and load `/dashboard`. Expect:
   - Greeting shows name "张*" with current time-of-day
   - Date line reads current date + weekday + teaching week (if `semesterStartDate` set in seed)
   - 4 KPI cards with real numbers (pending / completed / avg / rate)
   - Today's classes section (or "今日无课程" if today doesn't have classes in seed)
   - Priority task list with amber left border on the urgent one (if any task has dueAt within 24h)
   - Recent grades table with score bars (success/ochre/warn color by percentage)
   - Right sidebar: course list with color-chip initials + progress, announcement list with red-dot unread flags, AI buddy dark gradient card
2. Verify navigation from sidebar course → `/courses/[id]`, AI buddy → `/study-buddy`.
3. Verify `/teacher/dashboard` still renders (teacher page not touched).
4. 375px mobile: KPI → 2 cols, main grid → single column stack, no horizontal overflow.
5. Confirm no regression on `/grades` / `/tasks/[id]` / `/sim/[id]` (these import `task-card.tsx` transitively — should be unchanged).
