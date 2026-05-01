# Phase 7 QA: Analytics V2 Data Quality

Date: 2026-05-01

Branch: `codex/analytics-diagnosis-v2`

## Scope

- Added deterministic `dataQualityFlags` to Analytics V2 diagnosis payload.
- Added async `analytics_recompute` job handler and `POST /api/lms/analytics-v2/recompute`.
- Updated `/teacher/analytics-v2` to show last calculation time, async recompute status, data quality panel, and "需核对" markers for abnormal KPI/chart values.

## Automated Checks

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npx vitest run tests/analytics-v2.service.test.ts tests/analytics-v2.api.test.ts` passed.

## Targeted Coverage

- `tests/analytics-v2.service.test.ts` now verifies that abnormal `score/maxScore`, normalized scores above 100%, multiple attempts, missing assignment baselines, and unbound chapters are surfaced as flags without hiding raw computed metrics.

## Real App QA

Account: `teacher1@finsim.edu.cn / password123`

URL tested:

`http://localhost:3030/teacher/analytics-v2?courseId=e6fc049c-756f-4442-86da-35a6cdbadd6e`

Steps:

1. Logged in as teacher.
2. Opened Analytics V2 for the existing personal finance course.
3. Confirmed the page shows scope tags and "最后计算".
4. Clicked "后台重算".
5. Waited until the async job displayed "重算完成".
6. Confirmed the diagnosis refreshed from the async job result.
7. Confirmed data quality panel appeared with actionable flags.

Observed flags in current data:

- Non-assigned student submissions excluded from two `[QA-V2-202604300250]` task instances.
- Small sample warning for one assignment.

Browser result:

- `hasDataQualityPanel: true`
- `hasRecomputeDone: true`
- `hasRecomputeFailed: false`
- `hasLastCalculated: true`
- `hasScope: true`

Console:

- No app runtime errors observed.
- Only development Fast Refresh / React DevTools messages.

## Notes

- The dashboard now keeps raw values visible and marks suspicious values instead of silently changing the underlying diagnosis.
- Progress bars and heatmap visual intensity are capped to normal display bounds, while labels retain the original calculated values and add "需核对" when needed.
