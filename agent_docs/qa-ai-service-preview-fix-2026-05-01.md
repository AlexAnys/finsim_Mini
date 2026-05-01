# QA: AI service and teacher preview fix

Date: 2026-05-01 23:31 CST
Branch: `codex/analytics-diagnosis-v2`
Worktree: `finsim-codex-analytics-v2`

## Scope

- Restore AI service availability in the isolated lab worktree on `localhost:3030`.
- Make teacher dashboard `测试` buttons open a real student-perspective preview instead of a placeholder toast.
- Ensure preview mode does not create student submissions or grading records for Quiz and Subjective tasks.

## Root Cause

The lab worktree did not have a local `.env`, so the AI provider was unconfigured when running the app on port `3030`. The code path for weekly insight correctly degraded, but the UI appeared as "AI service unavailable".

The teacher dashboard `测试` button was also still a stub and only displayed a toast.

## Fix Summary

- Restored a local ignored `.env` for the lab worktree and set `NEXTAUTH_URL=http://localhost:3030`.
- Kept secrets out of git; `.env` remains ignored.
- Changed teacher dashboard `测试` to route to:
  - Simulation: `/sim/{taskInstanceId}?preview=true`
  - Quiz/Subjective: `/tasks/{taskInstanceId}?preview=true`
- Added preview handling to Quiz and Subjective runners so validation and UI can be tested without creating real student submissions.
- Fixed duplicate option key/id rendering in Quiz options.

## Verification

Automated checks:

- `npx vitest run tests/ai-provider.test.ts tests/api-utils-ai-error.test.ts tests/pr-dash-1e-weekly-insight.test.ts tests/teacher-dashboard.test.ts tests/teacher-dashboard-transforms.test.ts`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`

Real app QA:

- Logged in as `teacher1@finsim.edu.cn`.
- Opened `/teacher/dashboard`.
- Clicked a Simulation task `测试` button.
- Verified navigation to `/sim/2e700d5e-fa7e-4f13-b000-03f660414b89?preview=true`.
- Verified page shows `模拟对话 · 预览模式`.
- Sent a preview message and received an AI customer response.
- Returned to `/teacher/dashboard`.
- Clicked `生成一周洞察`.
- Verified the dialog generated a real weekly insight with:
  - time window `2026-04-24 ~ 2026-05-01`
  - `本周纳入 9 份提交`
  - AI-generated summary, weak concepts, student clusters, and classroom recommendations
- Verified Playwright console reported `0 errors`.

Known remaining data issue:

- Some old seeded/generated Quiz instances can still show `任务配置异常，请联系教师`; that is task data quality, not the preview routing or AI service fix.
