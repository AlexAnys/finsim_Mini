# Build report — PR-fix-1 r1

Unit: PR-fix-1 (P0 — IDOR + 跨班泄露 + 删主 class dangling)
Round: 1
Author: builder
Date: 2026-04-22

## Files changed

### Source
1. `app/api/lms/courses/[id]/route.ts` — B1: added `assertCourseAccess` helper (mirrors sibling `classes/route.ts`) and called it before `prisma.course.update`. Removed `classId` field from `patchSchema` so clients can no longer rewrite `Course.classId` via PATCH. Admin bypasses the ownership check; teachers must be creator or a `CourseTeacher` row.
2. `lib/services/dashboard.service.ts` — B2: student dashboard `taskInstance.findMany` where clause reverted from the broad OR to `{ classId, status: "published" }`. `TaskInstance.classId` is a required scalar, so this is the single source of truth for per-class targeting. Courses / announcements / scheduleSlots still use the dual OR against `Course.classId` and `CourseClass.classId`, because those entities hang off the course, not per-class.
3. `lib/services/course.service.ts` — B3: `removeCourseClass` now loads the course, throws `COURSE_NOT_FOUND` if missing and `CANNOT_REMOVE_PRIMARY_CLASS` when the target `classId` equals `course.classId`. Otherwise the Prisma delete is unchanged. Not wrapped in a transaction because the single-row delete is atomic and the only guard we need is the pre-check.
4. `lib/api-utils.ts` — added error mappings for `COURSE_NOT_FOUND` (404 "课程不存在"), `CLASS_NOT_FOUND` (404), `USER_NOT_FOUND` (404), `NOT_A_TEACHER`, `ALREADY_OWNER`, and the new `CANNOT_REMOVE_PRIMARY_CLASS` (400 "不能移除课程的主班级"). These codes were already thrown by service layer but silently fell through to 500; now they surface as intended. No changes to the public API envelope.
5. `app/teacher/courses/[id]/page.tsx` — B3 UI: primary-class badge now renders without the × button when `cc.classId === course.class.id`. Prevents the "click then fail" UX that the spec's Risks section flagged.

### Tests (new — no prior test infra existed)
6. `vitest.config.ts` — minimal node-env vitest config with `@/*` path alias matching tsconfig.
7. `tests/course.service.test.ts` — 3 tests: `removeCourseClass` rejects primary; accepts secondary; rejects when course missing.
8. `tests/dashboard.service.test.ts` — 2 tests: verifies student dashboard `where` is strict `{ classId, status: "published" }` (no `OR`); simulates two tasks (class A vs B) and asserts student in B sees only B's instance.
9. `tests/courses-patch.api.test.ts` — 4 tests: non-owner teacher → 403; lone `classId` body → 400 (field now unknown, zod refine fails); owner with valid field → 200 update; admin bypasses ownership check.

## Verification

- `npx tsc --noEmit` — pass (exit 0, no output).
- `npx vitest run` — pass, 9/9 tests green across 3 files in ~314ms.
- No Prisma schema changes, no migrations, no generate/restart needed.

## Grep findings — classId in PATCH

- Searched `app/**` and `components/**` for any fetch with `method: "PATCH"` targeting `/api/lms/courses/[id]` carrying `classId` in the body. **Zero call sites.** The existing `classId` POSTs/DELETEs in `app/teacher/courses/[id]/page.tsx:354,377` go to the sibling `/classes` endpoint (add/remove CourseClass), which is the correct path. Dropping `classId` from the main PATCH schema is safe — no frontend regression.
- PATCH call sites to `/api/lms/courses/[id]` found only at `app/teacher/courses/[id]/page.tsx:446` (`handleSaveSemesterDate`), which sends `{ semesterStartDate }` only. Unchanged.

## Anti-regression notes

- `removeCourseClass` signature unchanged (`(courseId, classId) => Promise<CourseClass>`); added an early throw path, existing call sites in `app/api/lms/courses/[id]/classes/route.ts:68` still work.
- `getStudentDashboard` signature unchanged; return shape identical.
- `handleServiceError` additions are strictly additive (new case arms), no removed codes.
- UI badge change preserves ordering and keys; only conditionally renders the `<button>`.

## Non-obvious decisions

- Kept the `OR: [{ classId }, { classes: { some: { classId } } }]` pattern for `courses`, `announcements`, and `scheduleSlots` on the student dashboard. Those are course-level records without a per-class field, so a class being attached to a course via `CourseClass` legitimately means its students should see those. Only `TaskInstance` was tightened because it has its own required `classId` scalar and the spec explicitly ruled against course-level broadcast.
- Also registered auxiliary error codes (`CLASS_NOT_FOUND`, `USER_NOT_FOUND`, `NOT_A_TEACHER`, `ALREADY_OWNER`) in `handleServiceError`. They were already thrown by `course.service.ts` but returned 500 to clients; tidying them here fits the P0 PR scope because the `assertCourseAccess` helper in the route throws `COURSE_NOT_FOUND`, which without this mapping would leak as 500 instead of a clean 404. Kept the change minimal.
- B3 UI fallback uses `course.class.id` from `CourseDetail` state, which is already populated by the existing GET endpoint's `include: { class: true }`. No extra fetch needed.

## Deferred / unsure

- No DB-level test was feasible without live Postgres; service tests mock `prisma` via `vi.mock`. This is sufficient to lock in the where-clause shape and the guard throw, but end-to-end verification (actually creating a course with two classes and hitting the dashboard as both students) should happen in QA's manual smoke.
- Did not add a `404` mapping for the rare case `assertCourseAccess` in `app/api/lms/courses/[id]/route.ts` is called on a deleted course during PATCH — it now returns 404 via the new `COURSE_NOT_FOUND` mapping, which is slightly different behavior from before (was 500). Acceptable and more correct.

## Dev server restart

Not needed — no Prisma schema changes.
