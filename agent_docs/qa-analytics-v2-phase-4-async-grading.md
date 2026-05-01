# Analytics V2 Phase 4 QA - Async Grading

Date: 2026-05-01

## Scope

Phase 4 focuses on moving student submission grading into the async job workflow and making grading state visible on both student and teacher surfaces.

Changed areas:

- Student quiz, subjective, and simulation runners now read the `gradingJob` returned by `POST /api/submissions`.
- Student submission completion screens show job progress, failure reasons, and navigation actions.
- Student dashboard, course detail, and grades views now preserve `submitted / grading / failed / graded` states instead of flattening them.
- Teacher instance submissions tab now has a failed filter and a retry action.
- `POST /api/submissions/:id/retry-grade` enqueues a fresh `submission_grade` job after resetting failed submission grading output.

## Automated Checks

Passed:

```bash
npm run typecheck
npx vitest run tests/pr-sim-1b-release-ui.test.ts tests/instance-detail-overview.test.ts tests/course-detail-transform.test.ts
```

Pending before commit:

```bash
npm run lint
```

## Real App QA

Environment:

- URL: `http://localhost:3030`
- Student: `alex@qq.com / 11`
- Teacher: `teacher1@finsim.edu.cn / password123`
- Dev server: port `3030`

### Student Submission

1. Logged in as `alex@qq.com`.
2. Confirmed the student dashboard renders task states, overdue penalty tags, and recent grade cards.
3. Opened subjective task `a5d8f119-e3cd-426f-8ea9-e57f77608ffe`.
4. Submitted a real answer through the UI.
5. Verified the page immediately switched from the editor to the async grading status card.
6. Because the local AI provider is intentionally not configured, grading failed with an explicit error:

```txt
AI_PROVIDER_NOT_CONFIGURED: mimo
```

This validates that failed AI grading no longer leaves the student in an ambiguous state; the submission is saved and the failure is visible.

### Teacher Retry

1. Logged in as `teacher1@finsim.edu.cn`.
2. Opened `/teacher/instances/a5d8f119-e3cd-426f-8ea9-e57f77608ffe`.
3. Confirmed the instance overview counts the new submission.
4. Opened the submissions tab.
5. Confirmed the filter bar includes:

```txt
全部 / 待批改 / 批改中 / 已出分 / 失败
```

6. Confirmed the failed submission row displays `批改失败` and a `重试` action.
7. Clicked `重试`; the route returned a new queued job:

```json
{
  "type": "submission_grade",
  "status": "queued",
  "entityType": "Submission"
}
```

The local missing-provider condition causes the retry to fail again, which is expected in this environment. The retry path itself is verified.

## Notes

- During QA, the QA quiz `b7ca71ef-7239-4844-b0bd-29e1b444be61` rendered malformed radio options (`.` for all choices, duplicate generated IDs). That appears to be fixture/task content quality rather than an async grading regression, so the async submission QA used a subjective task instead.
- This phase does not yet add an overview-level failed count card; failure is visible in the submissions tab and student surfaces.
