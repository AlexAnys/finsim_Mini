# Codex Lab Session Audit Report

Date: 2026-04-28  
Workspace: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-codex-lab`  
Branch: `codex/lab`  
Status: uncommitted working tree changes; Linear has not been updated to `Done` yet.

## Purpose

This report summarizes the work done in this Codex session so another reviewer can audit the branch. The session covered:

- Linear ANL-28 through ANL-42 security/reliability issues.
- A visual redesign of the `灵析 AI` login page.
- A later re-audit after another session claimed many issues were still open.
- Additional gaps found during re-audit and fixed in this session.

## High-Level Outcome

The current `codex/lab` worktree contains fixes for the ANL-28..42 set and the login page redesign. During re-audit, most of the "still reproducible" claims did not match this working tree: the relevant guards were present and covered by tests.

Three real gaps were confirmed and fixed:

1. Student `/study-buddy` new-question UI was implicitly binding new questions to the first dashboard task.
2. Production deployment config still had fallback secrets/passwords even though runtime guards had been added.
3. Course editor task wizard created task template, task instance, and publish state through separate requests, which could leave partial records.

ANL-34 was also tightened further: production audit is now clean after overriding Next's nested `postcss` dependency to `8.5.10`.

## Main Code Areas Changed

### Login / Auth UI Redesign

Implemented a `Light Aurora Education` login experience while preserving login logic, routing, API calls, and permission flow.

Key files:

- `app/(auth)/login/page.tsx`
- `app/globals.css`
- `components/auth/auth-layout.tsx`
- `components/auth/aurora-background.tsx`
- `components/auth/brand-header.tsx`
- `components/auth/infinity-mark.tsx`
- `components/auth/login-form.tsx`
- `components/auth/login-hero.tsx`
- `components/auth/value-orbit-strip.tsx`

Visual additions:

- Light aurora background.
- Infinity orbit logo mark.
- Subtle orbit/star decoration.
- `连接 / 探索 / 成长` value strip below the login form.
- Refined form focus states and button hover treatment.

Login behavior was intentionally not changed.

### Security / Access Control Fixes

Key files:

- `lib/auth/resource-access.ts`
- `app/api/files/[...path]/route.ts`
- `app/api/lms/task-instances/route.ts`
- `app/api/lms/task-posts/route.ts`
- `lib/services/task-post.service.ts`
- `app/api/study-buddy/posts/route.ts`
- `app/api/ai/study-buddy/summary/route.ts`
- `lib/services/study-buddy.service.ts`
- `app/api/groups/route.ts`
- `app/api/groups/[id]/route.ts`
- `lib/services/group.service.ts`
- `app/api/submissions/batch/route.ts`
- `lib/services/submission.service.ts`
- `app/api/lms/schedule-slots/[id]/route.ts`

Summary:

- File downloads now require auth and resource ownership checks.
- Student task-instance listing is forced to the student's class and `published` status.
- Task discussion read/write routes now validate task-instance readability.
- Study Buddy posts and summaries now validate task/task-instance access.
- Groups now validate teacher class access and same-class student membership.
- Batch submission deletion authorizes every requested submission and reports actual deletion count.
- Schedule slot deletion now uses course access instead of creator-only checks.

### Submission Trust Boundary and Payload Limits

Key files:

- `lib/validators/submission.schema.ts`
- `lib/services/submission.service.ts`
- `tests/anl-28-42-access.test.ts`

Summary:

- Client-supplied simulation `evaluation` is no longer part of create-submission input.
- Transcript, asset sections/items, quiz answers, subjective text, attachments, and attachment paths now have server-side limits/validation.

### Production Secrets and Registration Controls

Key files:

- `lib/auth/secret.ts`
- `lib/auth/auth.config.ts`
- `app/api/auth/register/route.ts`
- `app/api/classes/route.ts`
- `app/(auth)/register/page.tsx`
- `docker-compose.yml`
- `.env.example`
- `tests/auth-secret.test.ts`

Summary:

- Production runtime rejects missing or weak `AUTH_SECRET` / `NEXTAUTH_SECRET`.
- Production runtime rejects missing or weak `ADMIN_KEY`.
- Student self-registration defaults to disabled in production unless explicitly enabled.
- Public class list is blocked when student self-registration is disabled.
- `docker-compose.yml` now requires `POSTGRES_PASSWORD`, `AUTH_SECRET`, and `ADMIN_KEY` instead of falling back to dev defaults.
- Next production build phase is allowed to run without injecting runtime secrets, so Docker image builds do not need production secrets baked in.

### Dependency Security

Key files:

- `package.json`
- `package-lock.json`
- `Dockerfile`

Summary:

- Upgraded production dependency set including Next, Prisma, and uuid.
- Added npm override:

```json
"overrides": {
  "next": {
    "postcss": "8.5.10"
  }
}
```

- `npm audit --omit=dev --json` now reports `0` vulnerabilities.
- Dockerfile Prisma CLI install is aligned to `6.19.3`.

### Study Buddy Explicit Task Binding Fix

Key files:

- `app/(student)/study-buddy/page.tsx`
- `components/study-buddy/study-buddy-new-post-dialog.tsx`
- `tests/pr-stu-2-study-buddy.test.ts`

Problem found during re-audit:

- The new Study Buddy UI used the first dashboard task as the hidden default when creating a post.
- This could attach a student's question to the wrong task/context.

Fix:

- The dialog now includes a required `关联任务` select.
- The submit button remains disabled until a task, title, and question are all provided.
- POST payload now uses the explicitly selected `taskId` and `taskInstanceId`.

### Course Wizard Atomic Create/Publish Fix

Key files:

- `app/api/lms/task-instances/with-task/route.ts`
- `components/teacher-course-edit/task-wizard-modal.tsx`
- `lib/services/task-instance.service.ts`
- `lib/services/task.service.ts`
- `lib/validators/task.schema.ts`
- `tests/pr-course-1-2.test.ts`

Problem found during final Codex review:

- The course editor wizard created a task template, then a task instance, then published it through three separate HTTP requests.
- If instance creation or publish failed, the system could retain orphan task templates or draft instances.

Fix:

- Added a single server endpoint, `POST /api/lms/task-instances/with-task`.
- The endpoint validates course access and class/course membership, then creates the task, creates the instance, snapshots the task, and publishes the instance inside one Prisma transaction.
- The wizard now calls only that atomic endpoint.
- Static guard tests now reject the old three-request flow.

## Linear Issue Mapping

Linear issues were read and summarized, but this session did not yet mark them `Done` or write comments.

| Issue | Current implementation summary |
| --- | --- |
| ANL-28 | Private file downloads require auth, path validation, ownership/resource checks, and private cache headers. |
| ANL-29 | Student task-instance list is forced to own class and `published`; broad/tampered query params cannot widen scope. |
| ANL-30 | Task posts require task-instance readability for GET/POST; replies must belong to the same instance; list size is capped. |
| ANL-31 | Study Buddy posts and summaries validate task/task-instance access; broad teacher/admin reads are rejected. |
| ANL-32 | Group create/update validates teacher class access and same-class student membership. |
| ANL-33 | Client simulation evaluations are ignored/stripped; submission payload sizes and attachment paths are capped/validated. |
| ANL-34 | Production audit now reports zero vulnerabilities after dependency upgrades and Next nested PostCSS override. |
| ANL-35 | Production runtime and compose now fail on missing/weak auth/admin/database secrets; self-registration defaults closed in production. |
| ANL-36 | Batch submission delete authorizes each unique ID and rejects missing submissions before deleting. |
| ANL-37 | Schedule slot delete uses course access semantics, including admin/collaborator behavior. |
| ANL-38 | Teacher groups page hydration mismatch fixed; browser console smoke check showed no errors/warnings for the tested path. |
| ANL-39 | Shared pagination helpers and bounded `take` limits added across broad list APIs. |
| ANL-40 | Public class list is gated by student self-registration flag and bounded by list limits. |
| ANL-41 | Class and task-post route logic moved into service-layer helpers. |
| ANL-42 | ESLint/hook warnings cleaned up; lint is clean. |

## Verification Performed

Commands run successfully:

```bash
npm run lint
npm run typecheck
npx vitest run
npm run build
npm audit --omit=dev --json
```

Final results:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npx vitest run`: 56 test files passed, 735 tests passed.
- `npm run build`: passed.
- `npm audit --omit=dev --json`: 0 vulnerabilities.

Expected/known output during tests:

- Some tests intentionally log audit/AI fallback errors while asserting graceful handling. These did not fail the suite.

Known build warning:

- Previously observed Turbopack NFT trace warning was removed by making the default file-storage base a static relative path before `resolve()`.
- Current build completes without that warning.

Compose verification:

```bash
env -u AUTH_SECRET -u ADMIN_KEY -u POSTGRES_PASSWORD docker compose config
```

Result:

- Failed as expected because required variables were missing.

```bash
AUTH_SECRET=abcdefghijklmnopqrstuvwxyz123456 \
ADMIN_KEY=secure-admin-key-123 \
POSTGRES_PASSWORD=secure-postgres-pass \
NEXTAUTH_URL=http://localhost:3000 \
docker compose config
```

Result:

- Passed.

Browser verification:

- Used Playwright against `http://localhost:3020`.
- Logged in as `student1@finsim.edu.cn / password123`.
- Opened `/study-buddy`.
- Opened `新问题` dialog.
- Verified:
  - `关联任务` select is visible.
  - `发起对话` is disabled before task selection.
  - Task options are listed.
  - Selecting a task and filling title/question enables submit.
  - Console after the final smoke run showed 0 errors and 0 warnings.

## Current Caveats for Reviewers

- The working tree is not committed.
- Linear has not yet been updated to `Done` and no Linear comments have been written after the re-audit.
- The login visual redesign is broader UI work and not directly part of ANL-28..42 security remediation.

## Suggested Review Order

1. Review `lib/auth/resource-access.ts` and the route/service callers for ANL-28..37 access control.
2. Review `tests/anl-28-42-access.test.ts`, `tests/resource-access.test.ts`, and `tests/auth-secret.test.ts`.
3. Review `app/(student)/study-buddy/page.tsx` and `components/study-buddy/study-buddy-new-post-dialog.tsx` for explicit task binding.
4. Review `app/api/lms/task-instances/with-task/route.ts` and `components/teacher-course-edit/task-wizard-modal.tsx` for atomic course-wizard create/publish behavior.
5. Review dependency and deployment changes in `package.json`, `package-lock.json`, `Dockerfile`, and `docker-compose.yml`.
6. Review the login redesign separately from security remediation.
