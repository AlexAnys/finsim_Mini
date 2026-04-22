# Build report — PR-calendar-1 r2

Unit: PR-calendar-1
Round: r2 (fixing QA r1 P0 finding)
Date: 2026-04-22
Builder: builder

## QA r1 findings addressed

### P0 (fixed)

**`lib/services/schedule.service.ts` `getScheduleSlots.include` missing `semesterStartDate`**
→ ThisWeek Tab filter dropped every slot because `course.semesterStartDate` was always `undefined`.

Fix: added `semesterStartDate: true` to the `course.select` block.

### Secondary copy polish (fixed)

`components/schedule/semester-header.tsx:112`
"尚未设置学期开始日期" → "请先设置学期开始日期" per spec phrasing.

## Files changed

- `lib/services/schedule.service.ts` — added `semesterStartDate: true` to `course.select`
- `components/schedule/semester-header.tsx` — copy polish
- `tests/schedule-announcement.service.test.ts` — added regression test asserting `course.select.semesterStartDate === true`

## Verification

- `npx tsc --noEmit` → clean (no output)
- `npx vitest run` → **9 test files, 42 tests, all passing** (+1 new regression guard)

## Anti-regression audit

- Grep'd `getScheduleSlots` callers: 1 route handler + 1 test. Both consume the data via `json.data` without field-shape assumptions, so adding `semesterStartDate` is a safe additive change.
- `getScheduleSlots` `where` clause untouched, preserving QA r1 PASS state on course-class filtering.
- Dashboard service `scheduleSlot.findMany` already had `semesterStartDate: true` (confirmed in `lib/services/dashboard.service.ts:60,166`) — no dashboard change needed.
- No schema change, no migration, no dev server restart required.

## Why this bug slipped r1

Classic "Prisma include/select drift" (CLAUDE.md calls this out). My r1 relied on the API route wrapping `getScheduleSlots` output, without sampling actual response shape against consumer expectations. The new test (`schedule-announcement.service.test.ts` "selects course.semesterStartDate") asserts the shape at the service boundary so a similar regression is caught at vitest time.

## Ready for r2 QA

Expected behavior after fix:
- Teacher `/teacher/schedule` `本周` tab → sees week-filtered slots for all courses
- Student `/schedule` `本周` tab → sees week-filtered slots (for courses linked to their class)
- Top header week number remains accurate (unaffected by this change — pulled from `courses` endpoint, already working in r1)
- Batch dialog / grid Tab / calendar placeholder / 403 envelope — unchanged since r1.
