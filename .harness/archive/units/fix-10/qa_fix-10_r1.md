# QA report — Fix 10 (async-job cron sweeper) · r1

- **Worktree**: `finsim-wt-grading`
- **Branch**: `claude-fix-batch2-grading-async`
- **Commit reviewed**: `645e081` — `fix(async-job): cron sweeper rescues queued/running jobs after process restart`
- **QA agent**: qa-grading
- **Verdict**: **PASS**

## 验证步骤

### 1) Single-commit lock — `git show 645e081 --stat`

```
app/api/cron/sweep-stuck-jobs/route.ts |  54 +
lib/services/async-job.service.ts      | 109 +
tests/fix-10-async-job-sweep.test.ts   | 243 +
3 files changed, 406 insertions(+)
```

Production: 109 (sweep service) + 54 (route) = **163 +/0**. ~40 lines are Chinese comments; pure logic ~70 lines. Net-new module, no edits to existing code paths. Slightly over CLAUDE.md's 150-line guideline but justified (builder flagged it in build report line 103); net-new isolated module is the right pattern here. Accepted.

### 2) Static checks — all green

| Check | Result |
|---|---|
| `npx tsc --noEmit` | EXIT=0, 0 errors |
| `npx vitest run` | 79 files / 937 tests **all passed** (matches builder claim) |
| `npm run lint` | 0 errors, 4 warnings — identical to post-Fix-6 baseline; **no new warnings from this commit** |

### 3) End-to-end DB injection + HTTP cron test (PORT=3001, webpack mode, admin session)

Restarted dev with `NEXTAUTH_URL=http://localhost:3001` so credentials login worked. Logged in as `admin@finsim.edu.cn` via curl + cookie jar.

**Baseline probes:**

| Test | Expected | Got |
|---|---|---|
| `POST /api/cron/sweep-stuck-jobs` as admin (no stuck jobs) | 200 + zeros | 200 + `{queuedStuck:0, runningStuck:0, requeuedRunning:0, markedFailed:0, triggered:0, succeeded:0, failed:0}` ✓ |
| `POST` with no auth | 401 + Chinese msg | 401 + `"需要 cron token 或 admin 角色"` ✓ |
| `POST` as student (logged in) | 401 (not admin) | 401 ✓ |
| `POST` with wrong `x-cron-token` (CRON_TOKEN unset) | falls to admin fallback path → 401 if no admin | 401 ✓ |
| `GET /api/cron/sweep-stuck-jobs` as admin | 200 (GET supported) | 200 ✓ |

**Stuck-job injection — 4 test rows:**

| Job | Pre-state | Why injected |
|---|---|---|
| A `aa…a01` | status=queued, createdAt=2 min ago, attempts=0/max=3 | Should be picked & runAsyncJob called |
| B `bb…b01` | status=running, startedAt=15 min ago, attempts=1/max=3 | Should be reset to queued + retried |
| C `cc…c01` | status=running, startedAt=15 min ago, attempts=3/max=3 | Should be marked failed (STUCK_TIMEOUT_GAVE_UP), no retry |
| D `dd…d01` | status=queued, createdAt=now, attempts=0 | Fresh — must NOT be touched (60s threshold) |

(input.submissionId = bogus UUID → `performAsyncJob` throws SUBMISSION_NOT_FOUND so we test the sweep path without grading real submissions.)

**Sweep call result (single POST as admin):**

```json
{
  "queuedStuck": 1,    // A
  "runningStuck": 2,   // B + C
  "requeuedRunning": 1, // B reset
  "markedFailed": 1,   // C gave up
  "triggered": 2,      // A + B passed to runAsyncJob
  "succeeded": 2,
  "failed": 0
}
```

**Post-sweep DB state — all assertions match:**

| Job | Post-state | Verdict |
|---|---|---|
| A | status=failed, attempts=1, error=SUBMISSION_NOT_FOUND, completedAt set | ✓ claimed + ran + failed gracefully |
| B | status=failed, attempts=2 (was 1, incremented by runAsyncJob after reset), error=SUBMISSION_NOT_FOUND, completedAt set | ✓ reset to queued + re-ran + failed |
| C | status=failed, attempts=3 (unchanged), error=STUCK_TIMEOUT_GAVE_UP, completedAt=scan time | ✓ marked failed without retry |
| D | status=queued, attempts=0, error=NULL, startedAt=NULL | ✓ untouched — 60s threshold honored |

### 4) Idempotency (3 consecutive sweeps)

```json
sweep #1 → queuedStuck=1 ... (processed)
sweep #2 → all zeros
sweep #3 → all zeros
```

Post-state: A/B/C still at attempts 1/2/3 respectively — **not** incremented by sweeps 2/3. Proves the `runAsyncJob` atomic claim (`updateMany where status='queued'` count=1) correctly skips already-completed jobs.

### 5) Concurrency (3 simultaneous sweeps with 1 fresh stuck job)

Injected Job E (queued, 3 min old) → ran 3 parallel curl POSTs. All 3 responded `queuedStuck=1, triggered=1, succeeded=1`. **DB state for Job E**: `attempts=1, status=failed, error=SUBMISSION_NOT_FOUND` — **NOT** 3 — proving only one of the three `runAsyncJob` calls actually claimed via atomic `updateMany`. The other two saw claim count=0 and returned the existing row (fulfilled promise, no side-effect).

Note: all 3 responses report `succeeded=1` because `runAsyncJob` does not reject when claim fails — it returns the row. Build report's claim "多 cron 实例并发安全（claim count=0 直接 return 现有记录）" is accurate. Observability nuance: the `triggered`/`succeeded` counts will over-report on concurrent runs, but DB state is correct. This matches builder's stated design and unit-test case #7.

### 6) DB 状态恢复

All 5 injected AsyncJob rows (aa…a01, bb…b01, cc…c01, dd…d01, ee…e01) deleted via SQL DELETE post-test. Final AsyncJob count: 35 succeeded + 5 failed — identical to pre-test baseline. Zero residue.

### 7) Anti-regression

| Rule | Status |
|---|---|
| `enqueueAsyncJob` / `scheduleAsyncJob` / `getAsyncJob` / `retryAsyncJob` / `runAsyncJob` interfaces unchanged | ✓ (only one new export `sweepStuckJobs`) |
| AsyncJob Prisma schema unchanged | ✓ (no schema diff between 9267bb6 and 645e081) |
| Existing `release-submissions` cron route unchanged | ✓ (zero diff) |
| MiMo reasoning fix (da9a505) untouched | ✓ |
| Batch 1 Fix 1-5 untouched | ✓ |
| Fix 6 (c47eab8) untouched in this commit | ✓ |
| Cron auth pattern matches `release-submissions` (CRON_TOKEN header + admin fallback) | ✓ (line-by-line clone) |
| Chinese error message | ✓ ("需要 cron token 或 admin 角色") |
| Production diff < 150 lines | ⚠ 164 lines (14 over guideline; flagged + justified by builder as new isolated module with ~40 comment lines) — accepted |

## 结论

**PASS.** Cron sweeper correctly recovers stuck queued (>60s) and running (>10min) AsyncJobs. Both pathways verified end-to-end via DB injection + HTTP call:

- queued → runAsyncJob with atomic claim works as designed
- running → atomic reset (via `updateMany where status='running'`) then retry
- running at max → marked failed (STUCK_TIMEOUT_GAVE_UP), no retry
- fresh jobs untouched (60s threshold respected)
- 3 sequential calls idempotent (no re-processing)
- 3 concurrent calls safe (only 1 claim succeeds; attempts increments by 1 not 3)
- Auth: CRON_TOKEN header → direct; admin role fallback → allowed; student/anon → 401 + Chinese msg
- GET + POST both supported (Vercel cron defaults to GET)

Schema unchanged, sibling functions unchanged, related routes unchanged. Lint baseline preserved.

Minor non-blocking observation: on concurrent sweep, `triggered`/`succeeded` counts over-report because `runAsyncJob` returns fulfilled promise even when claim count=0. DB state is always correct. Build report acknowledges this; matches unit test case #7.
