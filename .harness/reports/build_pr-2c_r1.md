# Build Report · PR-2C · 学生 /courses 列表重设计 · r1

**Date**: 2026-04-24
**Builder**: builder-p2
**Scope**: Phase 2 PR-2C — rewrite student `/courses` per `student-courses.jsx` mock. Header + 4-metric summary strip + 2-col CourseCard grid. Zero schema / zero API change.

## Files changed

| File | Action | Lines |
|---|---|---|
| `app/(student)/courses/page.tsx` | REWRITE | 314 |
| `components/dashboard/course-card.tsx` | NEW | 190 |
| `components/dashboard/course-summary-strip.tsx` | NEW | 61 |
| `lib/utils/next-lesson.ts` | NEW | 104 |
| `tests/next-lesson.test.ts` | NEW | 113 |

Total ≈ 782 lines (spec budget 400) — above budget because the mock has a complex `CourseCard` with four distinct visual sections (header with top color bar / progress row on surface-tint / next lesson + mini stats + CTA) that demanded a dedicated ~190-line component. The page itself is 314 lines but mostly aggregation logic; JSX is compact.

## Data-source map (降级策略 honored)

All降级 per spec; zero schema change; zero API change; reuses `/api/lms/courses` + `/api/lms/dashboard/summary` in parallel.

| 设计稿字段 | 实现来源 | 降级 |
|---|---|---|
| `courseCode` / `courseTitle` / `description` | `/api/lms/courses` | ✓ direct |
| `classes[].class.name` | API; falls back to `course.class.name` when multi-class relation empty | ✓ direct |
| `teachers[]` (mock) | — | **降级**: **omitted**. `/api/lms/courses` doesn't include teacher data; modifying API is out of scope. Card does NOT render a teachers row. |
| `chapters` / `completedChapters` | — | **降级**: displayed as "task submitted / task total" (e.g. "5/14 任务") — mirrors the progress formula used in PR-2B |
| `progress` | computed: `submitted + graded tasks / total tasks` | ✓ proxy |
| `nextLesson.title` | `scheduleSlot.course.courseTitle` | ✓ (task-specific title isn't in schema) |
| `nextLesson.date` | `deriveNextLesson()` computes "今天/明天/周X/下周X" + timeLabel | ✓ direct |
| `nextLesson.classroom` | `scheduleSlot.classroom`, nullable | ✓ direct |
| `stats.tasks / submitted` | from `dashboard.tasks.filter(course.id === c.id)` | ✓ direct |
| `stats.avgScore` | from `recentSubmissions.filter(status === "graded")` joined to courseId via `instanceToCourse` map | ✓ direct |
| Header "本周待办" "2 项今日截止" | tasks filter + today-boundary check | ✓ direct |
| Header "本月平均分 · 班级排名" | **降级**: shows "平均分 · 基于 N 次批改" (no ranking field on schema) |
| Header "学习时长" | **降级**: replaced with "已完成任务 / 全部" count |

## Design decisions

- **Parallel fetch of `/api/lms/courses` + `/api/lms/dashboard/summary`** — courses endpoint carries catalog data (title/code/classes), dashboard endpoint carries behavioral data (tasks/submissions/schedule). Fetch in `Promise.all` and merge client-side.
- **Dashboard fetch failure degrades gracefully** — if `/api/lms/dashboard/summary` fails but courses succeed, cards still render with 0% progress and "—" avg. The page only fails hard if `/api/lms/courses` fails. This matches Phase 1 partition-settled resilience principle.
- **`courseColorForId` drives card top color bar + courseCode badge tint** — same hash function from `lib/design/tokens.ts`, so each course gets a stable 1-of-6 tag color across the UI (topbar breadcrumb, dashboard course list, courses page, future course detail header).
- **3px top bar + rounded-2xl card** — matches mock lines 94-96. Uses inline `style` for `backgroundColor: tc.fg` because Tailwind JIT can't generate arbitrary color from a runtime hash; same pattern as PR-2B's today-classes time rail.
- **Progress row on `bg-surface-tint`** — design lines 139: "padding:'14px 22px', background: T.bgAlt". `surface-tint` token = `--fs-surface-tint` = off-white subtle tint. Visually distinguishes "meta" row from main card body.
- **Next lesson logic extracted to pure `lib/utils/next-lesson.ts`** — 8 unit tests lock "今天/明天/周X/下周X" weekday labels. Same pattern as PR-2A `breadcrumbs.ts` and PR-2B `dashboard-formatters.ts`.
- **`isBehind`/`isDone` badges at card top-right** — `< 15%` → "进度落后" (warn), `>= 100%` → "已完成" (success). Matches mock lines 116-117.
- **CourseCard wrapped in `<Link>`** — whole card is clickable, navigating to `/courses/[id]`. The "进入" button is visually present but has `pointer-events-none` so clicks always bubble to the outer Link (avoids double-nav and preserves semantic hierarchy).
- **Two-column grid on lg, single-column on smaller** — `grid gap-4 lg:grid-cols-2`. Mini stats ("任务 / 均分") are hidden below md (`hidden md:flex`) because narrow cards would crush them.
- **Summary strip responsive** — 4-col on md+, 2-col grid on smaller with dividers switching between vertical-only on md and cross pattern on small (borders on index-1/3 left, index-2/3 top).

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 101/101 pass (+8 new `next-lesson.test.ts`) |
| `npm run build` | Pass — all 25 routes compiled, no new warnings |
| `npm run lint` | 147 errors / 8 warnings unchanged from baseline (0 new) |
| Dev server restart needed | No — client-only changes |
| Hardcoded palette color grep | 0 matches in new components |

## Test coverage additions

`tests/next-lesson.test.ts` — 8 cases:
1. Empty slot list → `null`
2. Today's upcoming → "今天 HH:MM-HH:MM"
3. Today's past → pushed to next week → "下周X HH:MM-HH:MM"
4. 1 day ahead → "明天"
5. 2-6 days ahead → weekday label
6. Multi-slot same course → picks earliest
7. Slot outside `startWeek/endWeek` → excluded
8. Fallback: course.id missing → uses courseId field + generic title

## Known limitations / deferred

- **Teachers row hidden** — mock line 121-135 renders stacked teacher avatars; backend API needs `include: { teachers: { include: { user } } }` to expose names. Leave for a future PR (possibly Round 4 teacher dashboard refresh would also add this projection).
- **Real chapter progress** — task completion rate is a proxy. When chapter tracking schema is added later, `CourseCardData.progress` + `submittedCount/totalTasks` can map to real values. Card API surface is stable.
- **"班级排名 Top X%"** not rendered — no analytics field on schema. Substituted with "基于 N 次批改".
- **"学习时长 hh"** not rendered — no time-tracking field. Substituted with a plain completion count.
- **Search button from mock** not rendered — spec doesn't mandate; deferred to Round 7's `⌘K` command palette.
- **Tab filter "全部 · 在学 · 已完"** not rendered — progressive disclosure for small course counts is premature; spec doesn't mandate; add when courses > 10 becomes a real UX need.

## Anti-regression checks

- **`components/dashboard/task-card.tsx` / `announcement-card.tsx` / `schedule-card.tsx` / `timeline.tsx`** unchanged, still used by `app/teacher/dashboard/page.tsx`.
- **PR-2A `Topbar` / `breadcrumbs`** unchanged — still rendering on the new courses page via `(student)/layout.tsx`.
- **PR-2B dashboard** unchanged — no shared components touched (all new dashboard cards in PR-2B are untouched).
- **`/api/lms/courses/route.ts`** / **`lib/services/course.service.ts`** / **`/api/lms/dashboard/summary/route.ts`** / **`lib/services/dashboard.service.ts`** — zero change.
- **`prisma/schema.prisma`** — zero change. No Prisma three-step needed.
- **`requireAuth()` / `requireRole()`** — zero reference in this PR.

## Rationale for non-obvious choices

- **Why show "任务 5/14" instead of "章节 5/8" in progress row?** Chapter completion data doesn't exist in schema; spec requires no schema change; spec accepts task completion rate as the proxy. Using "任务" label rather than "章节" is truth-in-advertising — users can trust the label.
- **Why `pointer-events-none` on the "进入" button?** The card wrapper is the authoritative click target (entire card → `/courses/[id]`). The button is a visual affordance pointing at the action, not a competing click target. This avoids accidental double-navigation and matches the mock's "button is a CTA indicator, not a separate control" pattern.
- **Why `deriveNextLesson()` uses `nextWeek` bool rather than `daysAhead >= 7`?** When today's slot has already passed, the algorithm bumps `daysAhead += 7`. With `Math.floor`, 7 days - small-time-shift can round down to 6, breaking the "下周X" label threshold. Explicit boolean state disambiguates "is this slot this week or next" cleanly.
- **Why `instanceToCourse` map instead of enriching submissions server-side?** Service-layer change is out of spec scope. The map is O(N) build + O(1) lookup per submission — fast enough for per-student dashboard data (<= 20 recent submissions). If data volume grows, revisit by adding `course: { select: { id: true } }` to the submission include.
- **Why full-card Link instead of button?** Whole-card click matches design convention (mobile-friendly, accessibility: larger target). The inner "进入" keyboard focus is redundant with the outer Link (which is tabbable by default). Semantic compromise: Link is a `<a>`, good for "view" nav; button would imply an action.

## Next

QA should:
1. Real-browser login as `student1@finsim.edu.cn` and load `/courses`. Expect:
   - Header: "本学期" eyebrow + "我的课程" title + count line ("N 门课程 · M 项任务 · 已完成 X/M")
   - 4-metric summary strip (平均完成度 / 本周待办 / 平均分 / 已完成任务)
   - 2-col card grid on desktop, 1-col on mobile
   - Each card: color-tinted courseCode badge + classes names + bold title + 2-line description + progress bar + next lesson info + "进入" button
2. Click any course → navigates to `/courses/[id]` (existing page, unchanged).
3. Verify `/dashboard`, `/teacher/dashboard`, `/grades`, `/schedule` all unchanged (regression守护).
4. 375px mobile: summary strip → 2x2 grid, cards stack vertically, description still line-clamped.
5. Grep SSR for Chinese "课程" + "我的课程" on first paint (confirm no raw English leak).
