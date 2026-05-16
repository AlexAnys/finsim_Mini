# Review — Data layer (Prisma schema + migrations + queries) (r1)

## Reviewer charter

独立审查 `prisma/schema.prisma`、`prisma/migrations/*.sql` (24 条)、`lib/db/`、以及 `lib/services/*.service.ts` 中所有 Prisma 查询。范围聚焦：schema 健康、migration 链干净度、查询 leverage（N+1 / over-fetch / 缺索引）、Json blob seam 设计、type narrowing 完整性。不审 UI、不审 auth、不审 AI prompt 内容。

## Method

读完整份 `prisma/schema.prisma`（1086 行 / 35 表 / 23 enum）+ 24 个 migration SQL（init 839 行 + 后续 23 个增量共 389 行）+ `lib/db/prisma.ts` + 重点服务 `dashboard / task / task-instance / submission / grading / study-buddy / insights / analytics-v2 / scope-insights / weekly-insight / quiz-question-tagger / release / async-job / course-knowledge-source / course / audit / ai-usage / quiz-adaptive`。Bash grep：`Promise.all` (13 处)、`for (const ...) await prisma` (loop-await N+1 hotspots)、`as unknown as Prisma.InputJsonValue` (16 处)、`as <Shape>` Json cast (12+ 处)、`@@index` 总数 (72)。检查 `lib/utils/task-snapshot.ts` 的 snapshot 校验深度。

## Top findings（按 severity 排序）

### F-1: `taskSnapshot` / `evaluation` / `transcript` / `assets` 等 Json 字段全程 type-assert，无 runtime parse — Severity: P0

- **Files**: `lib/utils/task-snapshot.ts` (lines 24-43), `lib/services/grading.service.ts` (lines 250 transcript-as, 290 evaluation cast, 393 quizSubmission.evaluation as `{ adaptiveMasteryReport?: unknown }`), `lib/services/insights.service.ts` (lines 197-302 evaluation/transcript/assets all `as` cast), `lib/services/weekly-insight.service.ts` (lines 404, 408, 412), `lib/services/analytics-v2.service.ts` (line 2201 `(evaluation as Record<string, unknown>).feedback`), `lib/services/study-buddy.service.ts` (line 139 `messages as StudyBuddyMessageRecord[]`)
- **Problem**: bad Seam — Json blob columns are the project's largest abstraction boundary, but they leak shape uncertainty to every reader. `isValidSnapshot` only checks `taskName: string` non-empty; everything else (`scoringCriteria`, `quizQuestions`, `simulationConfig.systemPrompt`, etc.) is trusted. `transcript` cast as `Array<{ role: string; text: string }>` while writer schema allows `mood`/`moodScore`/`hint` 8 enum. `evaluation` cast across services with overlapping but incompatible shapes (`{ feedback?, totalScore?, rubricBreakdown?, quizBreakdown?, adaptiveMasteryReport?, latePenalty?, ... }`). HANDOFF documents this risk ("runtime parse + validate shape") — current code has neither.
- **Why-it-bites**: schema migration that adds a required nested field (e.g. simulation evaluation gets a new `criterionRationale[]`) silently lands; readers see undefined and fall back to "暂无评语" with zero error. Worse: `transcript[].role` enum drift (writer adds `system` role, reader expects only `student|ai`) produces silent miscategorization in `aggregateInsights` mood timeline. The 26-day-old TaskSnapshot regression risk (Unit 17) is structurally still present — `isValidSnapshot` returns `true` for `{ taskName: "x" }`, which is enough to mask a stripped/corrupt snapshot that lacks `simulationConfig`, causing student runner to render with no scenario.
- **Deletion test**: Delete the Json columns entirely → can't, they are load-bearing. But narrow each one with a Zod schema next to the writer (`lib/validators/`) and parse at read sites → 0 callers move, ~6 services thin out their `as` casts.
- **Suggested direction**: define explicit Zod schemas for each Json column (`taskSnapshotSchema`, `simulationEvaluationSchema`, `transcriptSchema`, `studyBuddyMessagesSchema`, `analysisReport.commonIssuesSchema`, `structuredOutlineSchema`) and parse at read entry points; fail closed when shape is wrong so writers are forced to migrate.
- **Tests would improve**: A single failing parse test catches a schema drift before it ships; today the unit suite has no coverage of Json shape contracts so a missing field passes both tsc and runtime smoke.

### F-2: `TaskInstanceAnalytics` is a dead table — full schema + FK + unique-index overhead, zero producer — Severity: P1

- **Files**: `prisma/schema.prisma` (lines 810-823 model definition), `lib/services/dashboard.service.ts` (lines 17-19, 100-103, 128-175 — comment "TaskInstanceAnalytics 表是死表（全仓 0 producer）, …该表此修复后将被弃用"), prisma/migrations/20260221084930_init/migration.sql (lines 448-460 CREATE TABLE), 20260225 + 20260426 (preserved)
- **Problem**: Shallow + bad Locality. Table has `taskInstanceId` unique FK + `taskId` FK + 4 stat columns + `updatedAt`, but no service writes to it. `computeLiveAnalytics` in dashboard.service.ts re-aggregates from `Submission` every dashboard load. The model still wires `TaskInstance.analytics` relation and `Task.analytics` back-relation, which makes every reader's `include` look intentional but is silent dead-weight.
- **Why-it-bites**: future contributors will write `instance.analytics` and get `null`, then "fix" by writing producer code — duplicating dashboard's live aggregation. The relation also clutters Prisma type generation. Migration to drop is 1 line, but until then `prisma generate` keeps the optional relation in 10+ inferred types.
- **Deletion test**: Drop table + drop both relations → ~4 line patch in schema, 0 caller migration, removes a permanent "did I check this?" question. Complexity disappears, not redistributed.
- **Suggested direction**: drop the table + relations in one migration; remove the comment hedges in dashboard.service.ts.
- **Tests would improve**: nothing test-wise; this is pure schema cleanup.

### F-3: `AnalysisReport` is overloaded — three unrelated cache shapes share one row — Severity: P1

- **Files**: `prisma/schema.prisma` (lines 829-849), `lib/services/insights.service.ts` (lines 118-128 reads `commonIssues`+`aggregatedAt`+`moodTimeline` keyed by `taskInstanceId`), `lib/services/scope-insights.service.ts` (lines 181-214 reads/writes `scopeSummary` keyed by `scopeHash`, line 196 also writes `studentCount`), 1097-1127 (teaching advice writes into `scopeSummary.teachingAdvice` nested), `lib/services/insights.service.ts:401-422` upsert by `taskInstanceId` unique
- **Problem**: bad Locality + bad Seam. Same table holds:
  - (a) per-instance batch insight cache → keyed by `@@unique(taskInstanceId)`, uses `commonIssues / aggregatedAt / moodTimeline / report / studentCount`
  - (b) per-scope simulation insight cache → keyed by `scopeHash`, uses `scopeSummary` + cold-start writes `report: { kind: "scope_simulation_insight" }` as placeholder
  - (c) per-scope teaching advice → also keyed by `scopeHash`, merged INTO `scopeSummary.teachingAdvice` of an existing (b) row
  Row identity oscillates between two business keys (`taskInstanceId` XOR `scopeHash`) — unique constraint on `taskInstanceId` enforces (a) but (b)/(c) have no enforcement and depend on `findFirst orderBy createdAt desc`.
- **Why-it-bites**: (b) writes use `findFirst + create/update` (no UPSERT possible because no unique on scopeHash), so two concurrent fresh-build calls for the same scope create duplicate rows. (c) writes assume (b) row exists and that the latest by createdAt is "the right one"; merging happens on a snapshot that may be from a different teacher's earlier call. The `report Json NOT NULL` column forces (b)/(c) callers to write a synthetic `{ kind: "..." }` blob just to satisfy NOT NULL — visible at scope-insights.service.ts:210. `studentCount` is meaningful only for (a) but is always written.
- **Deletion test**: Split into three tables (`InstanceInsightCache`, `ScopeSimulationCache`, `ScopeTeachingAdvice`) → ~80 lines of service refactor, removes the synthetic `report:{kind:...}` placeholder, removes `findFirst` race, makes each cache a proper UPSERT. Complexity drops because each shape has its own schema; readers stop juggling which fields are populated.
- **Suggested direction**: split into three dedicated tables (or three Json columns on a single `ScopeCache` keyed by `scopeHash` with `kind` enum + proper unique). Keep `AnalysisReport` for (a) only and add `@@unique(scopeHash, kind)` for the rest.
- **Tests would improve**: concurrent-write tests for scope cache become possible (deterministic single row per scope/kind), insight aggregation tests stop mocking irrelevant `scopeSummary` field.

### F-4: Cross-cutting N+1 / loop-await in three hot paths — Severity: P1

- **Files**:
  - `lib/services/release.service.ts:152-164` — `for (const instanceId of uniqueInstanceIds) await assertTaskInstanceWritable(instanceId, user)` + `for (const s of standaloneSubs) await assertSubmissionReadable(s.id, user)`. Each `assert*` runs its own `findUnique`. Batch release of N submissions across M instances → 1 select + M+N round trips before the batch update.
  - `lib/services/quiz-question-tagger.service.ts:130-149` — `for (let i ...) await prisma.quizQuestion.update(...)`. N writes for N untagged questions, no batch. Adaptive task with 60 questions = 60 individual update statements.
  - `lib/services/task.service.ts:300-315` — recreates allocationSections in update loop: `for (section of patchData.allocationSections) await tx.allocationSection.create(...)` (each followed by `createMany` for items). 5 sections × 8 items each = 5 sequential create round-trips inside the transaction.
- **Problem**: Shallow batch APIs at the seam. Each call site has access to the full set up front; the service still issues per-row queries.
- **Why-it-bites**: PR-FIX-2's "B5 单 snapshot allocations 上限 20 项" comments hint at past load incidents. Release sweeper (`autoReleaseSubmissions`) is correct (uses `findMany + updateMany`), but the user-triggered batch release is not — teacher batch-releasing 30 submissions across 6 instances issues ~36 sequential queries on a hot path. `tagQuizQuestions` is called from async job after every adaptive quiz publish; if Phase3-A re-triggers (clear → re-tag) on every quiz edit, the cost is repeated.
- **Deletion test**: Replace each loop with a batch primitive (`findMany` for auth-resolution preload, `updateMany` for writes that only touch the same column, `$transaction([...])` for the allocation creates). 3 ~10-line patches; no API change; existing tests pass.
- **Suggested direction**: preload all `taskInstance` rows once with `findMany({ where: { id: { in: uniqueInstanceIds } }, select: { id, createdBy, course: {...} } })` then run `assertWritable` in-memory; replace tagger loop with a single CASE-WHEN raw update or batched `$transaction`.
- **Tests would improve**: integration tests for release batching can assert query count; today perf regressions land silently.

### F-5: Missing unique constraint allows duplicate submission rows under race; `Submission.attemptsAllowed` enforced only by count read — Severity: P1

- **Files**: `lib/services/submission.service.ts:99-107` (`prisma.submission.count(...)` then `prisma.submission.create(...)` outside any transaction wrapping the check) and `prisma/schema.prisma:577-582` (`Submission` has `@@index([taskInstanceId, studentId])` for query speed but no `@@unique`)
- **Problem**: TOCTOU race + missing DB-level invariant. Two parallel student submits both pass `count < attemptsAllowed` and both insert. The transaction at line 110 wraps only the writes — the count read happens before the tx and uses repeatable read semantics not at all.
- **Why-it-bites**: with `attemptsAllowed=1`, a student double-tapping submit (or two browser tabs from the Unit-5 "draft cross-account" fix's exact scenario) silently creates a 2nd graded submission, which then doubles AI grading cost AND affects analytics `submissionCount` for the instance. Cross-references with student dashboard `attemptsUsed = subs.length` (dashboard.service.ts:272) — the user-facing counter desyncs from server side.
- **Deletion test**: Add `@@unique([taskInstanceId, studentId, <attemptSeq>])` or a partial unique on `(taskInstanceId, studentId)` when `attemptsAllowed=1`. Caller code in submission.service simplifies — race goes from "best effort count" to "DB-enforced 23505 → translate to MAX_ATTEMPTS_REACHED".
- **Suggested direction**: introduce an `attemptIndex` column on `Submission`, then unique `(taskInstanceId, studentId, attemptIndex)`, and translate Prisma P2002 to `MAX_ATTEMPTS_REACHED`. For attemptsAllowed=null (unlimited), this is a no-op constraint.
- **Tests would improve**: add a parallel-submit test that today would intermittently fail; the schema change makes it deterministic.

### F-6: `StudyBuddyPost.taskId` nullable but no DB check that (taskId IS NOT NULL OR courseId IS NOT NULL OR taskInstanceId IS NOT NULL) — Severity: P2

- **Files**: `prisma/schema.prisma:655-689`, migrations `20260514112456_make_sb_post_task_id_nullable_and_add_course_id`
- **Problem**: Shallow nullability. Schema allows a SB post with all three FK fields null (admin-bin orphan), but business logic in `createPost` (study-buddy.service.ts:25-92) enforces "self-classification": free-form must have at least courseId for AI context, but the DB will accept rows that bypass the service (e.g. admin SQL fix-up or future async-jobs).
- **Why-it-bites**: Generates a "ghost" post that `generateReply` later loads without any course → `getKnowledgeSourcesForStudyBuddy` returns `[]` because `effectiveCourseId` is null → AI runs without grounding. Today this happens silently. Combined with `hiddenAt: null` default filter, ghost posts are visible in admin views indefinitely.
- **Deletion test**: Add CHECK `(taskId IS NOT NULL OR courseId IS NOT NULL OR taskInstanceId IS NOT NULL)` → 1-line migration, no caller change, prevents the orphan state.
- **Suggested direction**: introduce a Postgres CHECK constraint (Prisma 6 supports via `@@check` or raw SQL migration). Alternative: tighten the service contract and add unit tests for the null-on-all-three case.
- **Tests would improve**: removes a class of "AI returned generic answer because no course found" reports from QA — they become 400 at write time.

### F-7: `Task.courseName` / `Task.chapterName` + `Class.code` / `academicYear` / `departmentName` are denormalized strings parallel to their FK rels — Severity: P2

- **Files**: `prisma/schema.prisma:351-352`, `225-228`, used in `lib/services/task.service.ts:81-82, 260-261`, `lib/services/question-bank.service.ts:197-199, 568-611`, validators `lib/validators/task.schema.ts:88-89`
- **Problem**: bad Locality + leaky abstraction. Task is template-level (no course FK at all on Task table — only through `TaskInstance`), yet `courseName`/`chapterName` strings are written at task creation and never updated when the actual `Course.courseTitle` or `Chapter.title` changes. Used only as AI prompt hints (`question-bank.service.ts:609-611`) and as denormalized labels in some legacy reports.
- **Why-it-bites**: rename a course → existing Tasks still show old name in AI prompts and any UI relying on these fields. Combined with no FK, no integrity. Validators expose the field on every task create/update payload but most callers don't pass it, leaving NULL — and the half-populated state confuses code reading the fields.
- **Deletion test**: Drop both columns + adjust the 4-5 read sites to use `taskInstance.course.courseTitle`/`taskInstance.chapter.title` via existing relation. Same query cost (already included for instance pages). Complexity moves from 35-column Task table to per-call joins, but readers are at the seams that need it (AI prompts) and the data is fresher.
- **Suggested direction**: drop `Task.courseName` + `Task.chapterName`; resolve names from the most-recent `TaskInstance` (or pass course/chapter context explicitly into the AI builder). Similarly audit `Class.code`/`academicYear`/`departmentName` for actual reads — `class.service.ts` exposes `academicYear` once, no writers; likely dead.
- **Tests would improve**: removes a stale-data test category; existing AI prompt tests don't currently cover the rename-drift case.

### F-8: `Visibility` enum (private/shared/department/public) declared + on Task, never read anywhere — Severity: P2

- **Files**: `prisma/schema.prisma:90-96`, `Task.visibility` line 348, written by `task.service.ts:78` and `258`, no `where: { visibility: ... }` anywhere in `lib/` or `app/`
- **Problem**: Shallow — enum + column + form value travels all the way from validator (`task.schema.ts`) to Prisma write, but read-side authorization uses `creatorId` / `CourseTeacher` / `Class` association. The visibility flag is set and forgotten.
- **Why-it-bites**: future contributor sees the field, assumes there's department-level visibility logic, builds against it, ships a security bug because no filter actually applies. Codex-P1 review (per HANDOFF) already fixed "cross-course over-match" — this is the same family.
- **Deletion test**: drop column + drop enum + drop validator field → removes ~6 lines, no behavior change, eliminates the trap.
- **Suggested direction**: either remove entirely or wire it into `task.service.getTasksByCreator` / library list queries. Don't leave half-built.
- **Tests would improve**: cleaning this lets us add real visibility tests if/when needed without inherited dead state.

### F-9: `Course.classId` (required FK to single class) + `CourseClass` (M:N join) duplicate the same fact — Severity: P2

- **Files**: `prisma/schema.prisma:248`, `1075-1086`, `lib/services/course.service.ts:75-79` (creating Course auto-creates a CourseClass row mirroring `classId`), 179 (cannot remove primary class), 198-202 (queries union both)
- **Problem**: Bad Locality. The "primary class" lives in two places that can desync. `addCourseClass` creates a join row but does not touch `Course.classId`; if `removeCourseClass(courseId, course.classId)` happens despite the `CANNOT_REMOVE_PRIMARY_CLASS` guard, the relations drift. Migration `20260422041600_backfill_course_class` backfilled but did not migrate `Course.classId` away.
- **Why-it-bites**: every list query has to UNION (`OR: [{ classId }, { classes: { some: { classId } } }]`) — see `dashboard.service.ts:184-185, 224-225, 237`, `course.service.ts:199-202`. Five+ services duplicate this OR. A missed copy of the OR pattern (`teacherCourseFilter` only filters by `createdBy` / `CourseTeacher`, not by primary-class fallback) leads to invisible-but-assigned data.
- **Deletion test**: Migrate all reads to `CourseClass` only, write `Course.classId` as deprecated (or drop it after backfill). Eliminates one OR pattern from 5+ callers. ~20-line patch, single migration, removes a recurring foot-gun.
- **Suggested direction**: deprecate `Course.classId`. Either drop it (migration → backfill any straggler CourseClass rows) or keep as `defaultClassId` with a CHECK that it ∈ CourseClass.classId.
- **Tests would improve**: each list endpoint has duplicate OR — collapsing them gives one place to test the class-scope rule.

### F-10: Heavy include trees + over-fetch in `analytics-v2.getDiagnosis` and `dashboard.getTeacherDashboard` — Severity: P2

- **Files**: `lib/services/analytics-v2.service.ts:579-654` (course findUnique includes chapters + sections + classes + courseClasses; instances findMany then deeply nests `task.quizQuestions + scoringCriteria + submissions.{student, simulationSubmission.evaluation, quizSubmission.evaluation, subjectiveSubmission.evaluation}`), `lib/services/dashboard.service.ts:19-75` (parallel 5 queries, but `taskInstances` pulls full `_count.submissions`+class with `_count.students` for 50 instances)
- **Problem**: Deep include trees that fetch entire Json `evaluation`/`transcript` blobs when downstream only reads `score`/`maxScore`/`feedback.slice(0,400)`. `instances.submissions.simulationSubmission` pulls every transcript message in DB (could be 10-50KB each) when only `conceptTags` + `evaluation.feedback` are used.
- **Why-it-bites**: dashboard load time for a teacher with 50 instances and 1000 submissions: ~10MB Prisma payload, most discarded. Plus extra GC pressure; plus token-level transcripts in memory while the user is just clicking "课程".
- **Deletion test**: tighten the `select` to just the consumed fields per service → no behavior change, ~30% payload reduction in practice (heavy `simulationSubmission.transcript` removed from analytics-v2 hot path; only `evaluation.feedback` + `conceptTags` needed downstream).
- **Suggested direction**: replace `simulationSubmission: true` etc. with explicit `select: { evaluation: true, conceptTags: true }`; same for `quizSubmission` / `subjectiveSubmission`. Already done elsewhere (scope-insights.service.ts:391 selects narrowly) — apply the same discipline in `analytics-v2` + `dashboard`.
- **Tests would improve**: snapshot tests of the include shape, would also serve as documentation of which Json fields are read.

## Anti-findings（看起来像但不是问题）

- **Migration drift suspicion**: I looked for hand-edits to applied migrations. `20260426010000_add_pgcrypto_extension` is documented as a *replacement* for an earlier-hand-edited `ef820b5`-style attempt; CLAUDE.md memo "Migration drift 处理" + HANDOFF "SQL UPDATE checksum / cherry-pick" confirms the team learned and now uses idempotent additive migrations. Chain is clean — every migration uses `ALTER TABLE … ADD COLUMN`, `ALTER TYPE … ADD VALUE IF NOT EXISTS`, or new CREATE TABLE; no "add then drop" loops; no destructive ALTERs. The chain itself is healthy.
- **Json columns as `Prisma.InputJsonValue` casts**: ubiquitous (`as unknown as Prisma.InputJsonValue`), but this is unavoidable plumbing — Prisma's `JsonValue` type is recursive and only narrows after a Zod parse. The cast itself is not the bug; the missing parse step before it is (covered by F-1).
- **`StudentGroup.meta Json`**: small write-only blob for group metadata (`auto_score_bucket` filters). It's read in one spot. Not a Seam problem because it's truly opaque metadata — no service tries to type-narrow it. Fine.
- **`SimulationConfig.systemPrompt`**: nullable + can carry legacy 5-档 mood block; `stripLegacyMoodBlock` (task.service.ts:22-48) normalizes on write. Migration story is acknowledged in code — not a finding, just legacy.
- **`@@index([scopeHash])` non-unique on AnalysisReport**: looks like a missing unique, but the scopeHash overload pattern (F-3) means you can't add unique without splitting the table. Listed as part of F-3 rather than separately.

## Cross-cutting hunches

- **For review-security**: `StudyBuddyPost` nullable taskId + courseId — the service path (`createPost`) gates correctly with classId checks, but I noticed `listStudyBuddyPosts` at study-buddy.service.ts:285-298 has a complex OR-spread on `where` where a teacher passing neither taskId nor taskInstanceId throws FORBIDDEN at line 286. Verify all callers route through this; a Route Handler bypass could expose cross-class SB posts via `where: { isPreview }` only.
- **For review-arch**: the `AnalysisReport` overload (F-3) is the most distilled example of "one table doing three jobs because we didn't want to add three tables". Probably worth a deletion test discussion on whether scope-insights deserves its own caching layer with proper unique keys.
- **For review-recent**: `taskSnapshot` validation depth (F-1, lib/utils/task-snapshot.ts) was the deliverable of Unit 17 per HANDOFF — present but minimal. Validation is `taskName: string` only; the actual question/criteria/config payload is trusted blindly. Worth grilling whether Unit 17 "task 模板改动不影响 in-flight instance" is fully cashed in vs. just papered over.
- **For review-ai**: `QuizQuestion.knowledgeTagIds` (added in `20260514142850`) defaults to `String[]` not `String[][]`; the AI tagger writes max 3 tags but there's no DB-level cap. If a future prompt-injection scenario inflates tag count, the array grows unbounded. Also: `quiz-question-tagger.service.ts` loops `prisma.quizQuestion.update` N times — see F-4 — relevant to AI cost as much as DB cost.
- **For review-test**: missing Zod schemas for Json fields (F-1) is the largest gap from a testability standpoint. Once schemas exist, you can unit-test them; today the only contract is the `as` cast itself.

## Schema health scorecard

| Table | Status | 主要风险 / 备注 |
|---|---|---|
| User | OK | `classId` nullable for teachers/admins makes sense; `@@index([classId])` covers Class membership lookups. |
| Class | YELLOW (F-7) | `code`/`academicYear`/`departmentName` likely unused-write columns. |
| Course | YELLOW (F-9) | `classId` required + `CourseClass` M:N → drift surface, OR-pattern duplication in 5+ services. |
| Chapter / Section / ContentBlock | OK | Composite `@@unique([courseId, order])` etc. enforce ordering; OK locality. |
| Task | YELLOW (F-7, F-8) | `courseName`/`chapterName` denormalized strings + `Visibility` enum dead column. |
| SimulationConfig / QuizConfig / SubjectiveConfig | OK | Unique on `taskId` is correct; relation cascade on Task delete is appropriate. |
| ScoringCriterion / AllocationSection / AllocationItem / QuizQuestion | OK | Order+taskId indexes correct; `knowledgeTagIds` 默认 `[]` (Unit 8). |
| TaskInstance | YELLOW (F-1) | `taskSnapshot Json` validation thin (F-1); `groupIds String[]` no FK integrity (orphan tolerated). |
| Submission | YELLOW (F-5) | No unique on `(taskInstanceId, studentId, attemptIdx)` → race tolerated; `releasedAt`/`gradedAt` semantics good. |
| SimulationSubmission / QuizSubmission / SubjectiveSubmission | YELLOW (F-1) | `transcript`/`evaluation`/`assets` Json fields untyped at runtime. |
| StudyBuddyPost | YELLOW (F-6) | nullable taskId+courseId+taskInstanceId, no CHECK; soft-delete `hiddenAt` correctly indexed. |
| StudyBuddySummary | OK | Json `topQuestions`/`knowledgeGaps` consumed in one place, OK. |
| Announcement / TaskPost | OK | Cascade on Course/TaskInstance delete is appropriate. |
| ScheduleSlot | OK | Composite index `(courseId, dayOfWeek, slotIndex)`. |
| StudentGroup / StudentGroupMember | OK | `meta` Json truly opaque; `@@unique(groupId, studentId)` correct. |
| TaskInstanceAnalytics | RED (F-2) | Dead table, schema overhead, zero producer. |
| AnalysisReport | RED (F-3) | Overloaded with 3 distinct cache shapes; `report Json NOT NULL` forces placeholder writes. |
| AsyncJob | OK | `attempts/maxAttempts` retry semantics + sweeper match well; indexes cover both `(type,status)` claim and `(entityType,entityId)` lookups. |
| TaskBuildDraft | OK | `aiPayload`/`editedPayload` 双载体 (Unit), `approvedAt`/`approvedBy` state-machine complete. Json shape covered by F-1. |
| AiRun | OK | Cost/token columns added cleanly in `20260514133211`; index `(createdAt)` enables time-range scans. |
| AiToolSetting | OK | `@@unique(teacherId, toolKey)` clean. |
| AuditLog | OK | `targetId/targetType` String (no FK) is intentional — soft pointer. `(action)` + `(createdAt)` indexes match listAuditLogs query. |
| CourseTeacher / CourseClass | OK | Clean M:N tables with proper unique. |
| CourseKnowledgeSource | YELLOW (F-1) | `structuredData` Json untyped; 6 indexes feels heavy but each justified by listed-by-scope queries. |
| ImportJob | OK | Single tenant per-task; small. |

## N+1 hotspots

| File:Line | 问题 | 影响 |
|---|---|---|
| `lib/services/release.service.ts:152-164` | `for (const instanceId of uniqueInstanceIds) await assertTaskInstanceWritable(...)` + `for (const s of standaloneSubs) await assertSubmissionReadable(...)` | 教师批量公布 30 submissions / 6 instances → 36+ 顺序 round-trips 在写权校验阶段 |
| `lib/services/quiz-question-tagger.service.ts:130-149` | `for (let i ...) await prisma.quizQuestion.update(...)` N 次 | 60 题 adaptive task → 60 个 UPDATE 语句串行；每次 publish/edit 重跑 |
| `lib/services/task.service.ts:300-315` | `for (section of patchData.allocationSections) await tx.allocationSection.create(...)` (followed by inner `createMany` for items) | task update 每个 section 一次 round-trip；tx 内串行 |
| `lib/services/submission.service.ts:155-167` (attachments loop) | `for (const att of input.attachments) await tx.attachment.create(...)` | 10 attachments → 10 INSERTs 在 tx 内串行（`createMany` 可一次） |
| `lib/services/submission.service.ts:399-401` | `for (const id of uniqueIds) await assertSubmissionReadable(id, actor)` (batch delete) | N submissions delete → N readable check round-trips |
| `lib/services/analytics-v2.service.ts:624-654` | Heavy `include` 拉所有 instance 下的所有 submission 的所有 simulationSubmission.transcript（Json full payload）+ evaluation | 50 instance × 100 sub × 10KB transcript ≈ 50MB Prisma payload；下游只用 conceptTags + feedback.slice(0,400) |
| `lib/services/dashboard.service.ts:19-36` | `taskInstances` include `class._count.students` for 50 instances + `_count.submissions` 每条 | Subqueries OK for Prisma but include shape is over-fetch (see F-10) |
| `lib/services/scope-insights.service.ts:267-274` | `samplePosts` take 600，再在 inner loop `.filter(p => p.taskId === taskId)` per question | 6 secs × 5 questions × 600 posts = 18000 string comparisons in JS heap；index OK但 post-fetch filter could move into per-task query |

## 总结要点

**最严重的一个**：Json 字段全程裸 cast 无 runtime parse（F-1）。它是其他几个发现的放大器 —— taskSnapshot 漂移、evaluation shape drift、scope cache 形状串台、commonIssues 解码假设 —— 都通过同一个"我们相信这个 Json 是对的"机制扩散。Schema 干净，migration 链干净；薄弱在 Json blob 没被当成正式 Seam 来管。
