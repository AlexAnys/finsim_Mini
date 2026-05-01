# Analytics V2 Phase 3 QA - Async Jobs, AI Runs, Task Build Drafts

Date: 2026-05-01
Branch: `codex/analytics-diagnosis-v2`

## Scope

- Added schema foundations for `AsyncJob`, `TaskBuildDraft`, and `AiRun`.
- Made course knowledge source ingestion asynchronous through `AsyncJob`.
- Made submission grading enqueue `submission_grade` jobs after the submission row is created.
- Logged AI text/JSON calls through `AiRun`.
- Added course-scoped task build draft API and displayed draft cards in course structure slots.
- Added "保存草稿" to the course task wizard so incomplete AI/PDF-assisted tasks can occupy the correct course/chapter/section/slot before final publication.

## Automated Checks

```txt
DATABASE_URL=postgresql://finsim:finsim_dev_password@localhost:5432/finsim npx prisma migrate dev --name add_async_jobs_task_drafts_ai_runs
npm run typecheck
npx vitest run tests/task-build-draft.service.test.ts tests/document-ingestion.test.ts tests/course-knowledge-source.service.test.ts
npx vitest run tests/document-ingestion.test.ts tests/course-knowledge-source.service.test.ts tests/ai-tool-settings.test.ts
npm run lint
```

Result: all passed.

## Real App QA

Runtime:

```txt
AUTH_SECRET=dev-secret-change-in-production-must-be-256-bits
NEXTAUTH_SECRET=dev-secret-change-in-production-must-be-256-bits
DATABASE_URL=postgresql://finsim:finsim_dev_password@localhost:5432/finsim
PORT=3030 npm run dev
```

Flow verified with Playwright:

1. Opened `http://localhost:3030/login`.
2. Logged in as `teacher1@finsim.edu.cn / password123`.
3. Navigated to `http://localhost:3030/teacher/courses/e6fc049c-756f-4442-86da-35a6cdbadd6e`.
4. Clicked `1.2 财务目标设定 -> 课前 -> 任务`.
5. Confirmed task wizard shows the new `保存草稿` action.
6. Saved an incomplete simulation draft without filling required fields.
7. Confirmed the modal closed, the course reloaded, and the target slot now shows:
   - `未命名任务草稿`
   - `模拟对话`
   - `草稿`
   - `待补：任务名称、任务描述、模拟场景`

Notes:

- The first login attempt after restarting the server showed stale JWT cookie noise because the dev server had previously been started without `AUTH_SECRET`. After restarting with explicit auth secrets and logging in again, auth and course QA passed.
- The QA draft was intentionally left in the course data as visible test evidence.

## Residual Work

- `task_draft_generate`, `task_import_parse`, `ai_work_assistant`, and `analytics_recompute` still need worker handlers beyond the shared queue foundation.
- Draft cards are visible but not yet clickable into a full edit/resume screen.
- Submission grading is now job-driven at enqueue level; the student/teacher UI still needs richer progress/retry presentation.
