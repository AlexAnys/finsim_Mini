# QA report — Fix 6 (AI 评分失败给学生看得见的提示) · r2

- **Worktree**: `finsim-wt-grading`
- **Branch**: `claude-fix-batch2-grading-async`
- **Commit reviewed**: `a1d9ca4` — `fix(grading): wire nested evaluation in grades-transforms so failure feedback reaches UI`
- **QA agent**: qa-grading
- **Verdict**: **PASS** (r1 FAIL root cause fixed; differentiation now visible end-to-end)

## 验证步骤

### 1) Single-commit lock — `git show a1d9ca4 --stat`

```
lib/services/grading.service.ts           |   1 -
lib/utils/grades-transforms.ts            |  18 ++++-
tests/fix-6-grading-fail-feedback.test.ts | 127 ++++++++++++++++++++++
3 files changed, 143 insertions(+), 3 deletions(-)
```

Production code: **14 + / 2 -** (well under 150 cap). Tests +127 (5 new cases). Targeted patch — exactly the fix QA r1 recommended.

### 2) Code review of the diff

**`lib/utils/grades-transforms.ts`** (the actual bug fix):
- `RawSubmissionLite`: `evaluation` made optional; added `simulationSubmission` / `quizSubmission` / `subjectiveSubmission` as optional nested fields with their `evaluation` shape
- `joinSubmissions`: `evaluation` now picks from nested tables in this fallback order:
  ```ts
  s.simulationSubmission?.evaluation ??
  s.subjectiveSubmission?.evaluation ??
  s.quizSubmission?.evaluation ??
  s.evaluation ??
  null
  ```
  Order is unambiguous because a submission has exactly one of the three nested tables populated (per `taskType`). Top-level `s.evaluation` retained as a fallback for legacy fixtures (e.g. `pr-stu-1-grades.test.ts:210`).

**`lib/services/grading.service.ts`**: just removed the redundant `// eslint-disable-next-line @typescript-eslint/no-explicit-any` at line 125 (the disable belonged to the inner reduce callback only). No business-logic touch.

### 3) Static checks — all green

| Check | Result |
|---|---|
| `npx tsc --noEmit` | EXIT=0, 0 errors |
| `npx vitest run` | 79 files / **942 tests** all passed (r1 baseline 937 + 5 r2 = 942) |
| `npm run lint` | **0 errors / 3 warnings** — only pre-existing react-hooks/exhaustive-deps warns on runner components; the r1-introduced unused-disable warn at grading.service.ts:125 is **gone** |

### 4) End-to-end Playwright (the actual r1 FAIL retest)

Started dev `NEXTAUTH_URL=http://localhost:3001 PORT=3001 --webpack`. Logged in student1 via direct NextAuth API.

**DB injection — same as r1**:

| Sub ID | taskType | injected `<nested>.evaluation.feedback` |
|---|---|---|
| `1e4bcf48-...` | simulation | `"AI 批改暂未完成（模型输出格式异常），请联系老师手动批改。"` (JSON-shape variant) |
| `fe5271f2-...` | subjective | `"AI 批改暂未完成，请联系老师手动批改。"` (generic variant) |

Both `status=failed`, `releasedAt=NULL`.

**API echo (`GET /api/submissions`)**:
```
ID=1e4bcf48 type=simulation simEval={"feedback":"AI 批改暂未完成（模型输出格式异常），请联系老师手动批改。"} subjEval=null topEval=null
ID=fe5271f2 type=subjective simEval=null subjEval={"feedback":"AI 批改暂未完成，请联系老师手动批改。"} topEval=null
```

Top-level `evaluation` still undefined as expected (schema unchanged). Nested evaluation transports correctly.

**Browser UI — clicked each `批改失败` chip and inspected right panel**:

| Row clicked | Banner header | feedbackBody | **formatAbnormalVariant** | contactTeacher | rubricLeak |
|---|---|---|---|---|---|
| sim (row 0) | ✓ | ✓ | **✓ "模型输出格式异常" visible** | ✓ | ✗ no leak |
| subj (row 1) | ✓ | ✓ | **✗ correctly absent** (generic variant) | ✓ | ✗ no leak |

Slice extracted around `AI 批改暂未完成`:
- sim panel: `"AI 批改暂未完成（模型输出格式异常），请联系老师手动批改。"` ✓
- subj panel: `"AI 批改暂未完成，请联系老师手动批改。"` ✓

**The r1 FAIL is fixed**: differentiated feedback now reaches the student UI per row.

Screenshots:
- `/tmp/qa-fix6r2-failed-row0.png` (sim row, right panel shows JSON variant)
- `/tmp/qa-fix6r2-failed-row1.png` (subj row, right panel shows generic variant)

Visual cross-check confirms the panel header is "[QA-V2-202604300250] 客户风险沟通模拟" for row 0 (sim) and "[QA-V2-202604300250] 家庭预算分析报告" for row 1 (subj) — clicks landed on the correct rows.

### 5) Regression: existing fixtures still pass

- `pr-stu-1-grades.test.ts` `evaluation: { feedback: "好" }` legacy fixture (top-level evaluation) — still flows through the new fallback chain to `row.evaluation` (vitest 942 all passing proves this).
- 5 new r2 test cases (sim/subj/quiz/legacy/empty) appended to `tests/fix-6-grading-fail-feedback.test.ts` — all pass.

### 6) Anti-regression

| Rule | Status |
|---|---|
| API endpoints / route handlers unchanged | ✓ (only `grades-transforms.ts` + tests touched) |
| `stripSubmissionForStudent` (Fix 6 r1) untouched | ✓ |
| Quiz per-question fallback path untouched | ✓ |
| `pr-stu-1-grades.test.ts` legacy top-level evaluation fixture works via fallback chain | ✓ (942 tests pass) |
| MiMo reasoning fix / Fix 10 / batch 1 untouched | ✓ |
| Prisma schema unchanged | ✓ |
| Diff < 150 production lines | ✓ (14 +/2 -) |
| Chinese UI text only | ✓ |
| r1's lint warn (unused eslint-disable @ grading.service.ts:125) | **fixed in this commit** (lint warnings 4 → 3) |

### 7) DB 状态恢复

Both submissions restored: `1e4bcf48` graded score=88 releasedAt=`2026-04-30 02:10:06.158`, `fe5271f2` graded score=86 releasedAt=`2026-04-30 01:35:06.158`. SimulationSubmission / SubjectiveSubmission evaluation restored to original Chinese feedback + rubricBreakdown. Zero residue. Dev server stopped.

## 结论

**PASS.** QA r1's identified bug is precisely fixed. End-to-end verification (DB → API → stripSubmissionForStudent → joinSubmissions → EvaluationPanel) now flows the differentiated `feedback` from `SimulationSubmission.evaluation` / `SubjectiveSubmission.evaluation` to the student's right-panel banner. Both UI variants visible:
- sim: "AI 批改暂未完成（模型输出格式异常），请联系老师手动批改。"
- subj: "AI 批改暂未完成，请联系老师手动批改。"

Builder additionally fixed the r1-introduced lint warning. All static checks green (942 tests, 0 type errors, 0 lint errors, 3 pre-existing warns only). Anti-regression rules respected. Schema unchanged, sibling code paths untouched.

Worktree X Fix 6 r2 + Fix 10 r1 both PASS — ready to ping team-lead for batch 2 integration.
