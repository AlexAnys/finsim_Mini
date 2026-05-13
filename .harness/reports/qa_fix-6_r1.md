# QA report — Fix 6 (AI 评分失败给学生看得见的提示) · r1

- **Worktree**: `finsim-wt-grading`
- **Branch**: `claude-fix-batch2-grading-async`
- **Commit reviewed**: `c47eab8` — `fix(grading): show student a failure message on AI grading error (sim/subjective)`
- **QA agent**: qa-grading
- **Verdict**: **FAIL (low-severity)** — acceptance criteria minimally pass, but the build report's stated UI behavior (showing the differentiated `evaluation.feedback`) is **not** actually realized; UI always renders the hard-coded fallback.

## 验证步骤

### 1) Single-commit lock — `git show c47eab8 --stat`

```
components/grades/evaluation-panel.tsx    |  13 +-
lib/services/grading.service.ts           |  66 ++++++-
lib/services/submission.service.ts        |  17 +-
tests/fix-6-grading-fail-feedback.test.ts | 315 ++++++++++++++++++++++++++++++
4 files changed, 408 insertions(+), 3 deletions(-)
```

Production code: 96 + / 6 - (<150 line cap, CLAUDE.md compliant). Test: 318 lines new file. 1 commit clean, no drift.

### 2) Static checks — all green

| Check | Result |
|---|---|
| `npx tsc --noEmit` | EXIT=0, 0 errors |
| `npx vitest run` | 78 files / 930 tests **all passed** (matches builder claim) |
| `npm run lint` | 0 errors, 4 warnings (3 pre-existing react-hooks/exhaustive-deps, 1 new: unused `// eslint-disable-next-line` directive at `grading.service.ts:125` — minor cleanup, not blocking) |

### 3) DB 直接注入 + browser 实测（PORT=3001, webpack mode）

**Setup**: NEXTAUTH_URL was `localhost:3030` in `.env`; restarted dev server with `NEXTAUTH_URL=http://localhost:3001` so the credentials sign-in cookie flow worked. Logged in as `student1@finsim.edu.cn` via Playwright (direct `/api/auth/callback/credentials` POST with CSRF — the form-button click path also works after the env fix).

**Two failed submissions injected via SQL** (mimicking what `writeGradingFailureFeedback` would write):

| Sub ID | taskType | injected feedback |
|---|---|---|
| `1e4bcf48-...` | simulation | `"AI 批改暂未完成（模型输出格式异常），请联系老师手动批改。"` + `failureReason: "Unexpected token } in JSON at position 42"` |
| `fe5271f2-...` | subjective | `"AI 批改暂未完成，请联系老师手动批改。"` + `failureReason: "Network error: ECONNRESET"` |

Both `Submission.status=failed`, `score=0`, `releasedAt=NULL`.

**API response (`GET /api/submissions`) — strip-layer verification PASS:**

```
ID= 1e4bcf48 type= simulation status= failed score= null maxScore= null
simulationSubmission.evaluation = { feedback: "AI 批改暂未完成（模型输出格式异常）..." }
analysisStatus = "pending"

ID= fe5271f2 type= subjective status= failed score= null maxScore= null
subjectiveSubmission.evaluation = { feedback: "AI 批改暂未完成，请联系老师手动批改。" }
analysisStatus = "pending"
```

- `score` / `maxScore` correctly stripped to `null`  ✓
- `evaluation` has **only `feedback`** key — `rubricBreakdown`, `totalScore`, `maxScore`, `failureReason` all stripped  ✓
- No leakage of `Unexpected token` or `ECONNRESET` in API response  ✓
- `conceptTags: []` enforced  ✓

**Browser UI (`/grades` page) — partial PASS:**

Screenshots (full-page):
- `/tmp/qa-fix6-grades-list.png` — list view
- `/tmp/qa-fix6-grades-clicked0.png` — sim row right panel
- `/tmp/qa-fix6-grades-clicked1.png` — subj row right panel

| UI behavior | Status |
|---|---|
| List row chip "批改失败 · 等待教师处理" displayed for both rows | ✓ |
| Right panel renders danger-toned banner "AI 批改未完成" + AlertCircle icon | ✓ |
| Body shows Chinese fallback "AI 批改暂未完成，请联系老师手动批改。" | ✓ |
| **Body shows the JSON-shape variant "（模型输出格式异常）" for the sim row** | **✗ FAIL** — both rows render identical fallback, never the variant |
| `failureReason` / `ECONNRESET` / `Unexpected token` / `rubricBreakdown` exposed in UI | ✓ none exposed |

### 4) 根因分析

`lib/utils/grades-transforms.ts:236`:

```ts
evaluation: s.evaluation ?? null,
```

`s.evaluation` is the top-level `Submission.evaluation` — **but `Submission` has no such field in `prisma/schema.prisma`** (only `simulationSubmission.evaluation` / `quizSubmission.evaluation` / `subjectiveSubmission.evaluation`).

API confirmation:
```
top-level evaluation: undefined
simulationSubmission.evaluation: { feedback: "AI 批改暂未完成（模型输出格式异常），..." }
subjectiveSubmission.evaluation: { feedback: "AI 批改暂未完成，..." }
```

So `row.evaluation` is **always null** for sim/subj submissions. `evaluation-panel.tsx:168` then falls back to:

```tsx
{(row.evaluation as { feedback?: string } | null)?.feedback || "AI 批改暂未完成，请联系老师手动批改。"}
```

Hard-coded fallback always wins. The JSON-shape vs generic differentiation (FAILED_FEEDBACK_JSON / FAILED_FEEDBACK_MESSAGE, picked correctly in service layer) **is invisible to students**.

### 5) Suggested fix (one-liner in `grades-transforms.ts:236`)

```ts
// Replace
evaluation: s.evaluation ?? null,
// with — extract evaluation from the type-specific nested submission
evaluation:
  (s as RawSubmissionLite & { simulationSubmission?: { evaluation?: Record<string, unknown> | null } })
    .simulationSubmission?.evaluation ??
  (s as RawSubmissionLite & { subjectiveSubmission?: { evaluation?: Record<string, unknown> | null } })
    .subjectiveSubmission?.evaluation ??
  (s as RawSubmissionLite & { quizSubmission?: { evaluation?: Record<string, unknown> | null } })
    .quizSubmission?.evaluation ??
  null,
```

(Also requires `RawSubmissionLite` to declare optional `simulationSubmission` / `quizSubmission` / `subjectiveSubmission` fields, or use loose typing.)

Add a UI smoke test confirming the variant text reaches the panel (this would have caught the gap).

### 6) Anti-regression

| Rule | Status |
|---|---|
| Quiz 简答 per-question fallback unchanged | ✓ (writeGradingFailureFeedback early-returns for non-sim/subj) |
| Quiz 单选/多选 自动评分 unchanged | ✓ (path doesn't touch AI / outer catch) |
| `aiGenerateJSON` retry preserved | ✓ |
| Batch 1 Fix 1 / Fix 2 untouched | ✓ |
| `updateSubmissionGrade` signature unchanged | ✓ |
| Prisma schema unchanged | ✓ |
| Service-layer error throwing pattern preserved | ✓ |
| Released submissions (`releasedAt != null`) unaffected | ✓ (stripSubmissionForStudent short-circuits for released) |
| Diff < 150 lines production code | ✓ (102 +/- in lib/components) |
| Chinese UI text only | ✓ |

### 7) DB 状态恢复

两个 submission 已在 QA 完成后恢复 to original graded state（`status=graded`, `score=88/86`, original `releasedAt`, original sim/subj evaluation JSON with rubricBreakdown + feedback）— 主数据库无残留。

## 结论

**FAIL (low-severity).** The minimal acceptance is met (banner shows Chinese failure copy, status non-0, no rubric leak, tsc/vitest/lint green). But:

1. Build report explicitly claims "内容用 `row.evaluation.feedback`，缺省用前端 hard-coded ... 兜底" — in reality `row.evaluation` is **always** null due to `grades-transforms.ts:236` reading from the wrong path; the fallback is **always** what renders. The actual feedback string written to DB (including the JSON-shape variant builder went to effort to design) **never reaches students**.

2. This is a real wiring bug, not a cosmetic one — it defeats one of the two stated value-adds of the fix (differentiated copy for JSON-shape failures so students know to retry vs. ask the teacher).

3. Easy fix: extract `evaluation` from the nested type-specific submission in `joinSubmissions`. Add a UI-level test or e2e assertion to cover this path.

If builder accepts this is out of scope (spec only requires generic banner), QA can re-vote PASS. But the gap between build report claims and observed UI behavior must be reconciled before integration.
