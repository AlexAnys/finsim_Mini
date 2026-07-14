# Build report — Fix 6 (AI 评分失败给学生看得见的提示) · r2

- **Worktree**：`finsim-wt-grading`
- **分支**：`claude-fix-batch2-grading-async`
- **基线 commit**：`645e081`（Fix 10 HEAD）
- **本次 commit**：`a1d9ca4` — `fix(grading): wire nested evaluation in grades-transforms so failure feedback reaches UI`
- **改动文件**：
  - `lib/utils/grades-transforms.ts` (+15/-1) — `RawSubmissionLite` 新增 3 个嵌套字段 + `joinSubmissions` 从嵌套表挑 evaluation
  - `lib/services/grading.service.ts` (+0/-1) — 删除 unused eslint-disable @ 125
  - `tests/fix-6-grading-fail-feedback.test.ts` (+127/-0) — 5 个新 case 锁定 nested wiring
- **总 diff**：143 insertions / 3 deletions（生产代码 14/2）

## QA r1 反馈

「`joinSubmissions` line 236 `evaluation: s.evaluation ?? null` 读的是 Submission 顶层 evaluation，但 schema 该模型没此字段。导致 `row.evaluation` 始终 null，`evaluation-panel.tsx:168` 的 `row.evaluation?.feedback || "AI 批改暂未完成..."` 永远走 hard-coded fallback，学生看不到 `FAILED_FEEDBACK_JSON`（"模型输出格式异常"）。」

QA 在 Playwright + DB 注入 sim + subj 两个失败变体，截图 banner 文案完全一致——证据确凿。

## 根因复盘

我在 r1 设计时漏看了 Submission schema：`evaluation` 字段在 `SimulationSubmission` / `QuizSubmission` / `SubjectiveSubmission` 三个嵌套表上，Submission 本身没有此字段。

`/api/submissions` 服务端通过 `include` 透传了三个嵌套对象（`lib/services/submission.service.ts:192-194`），且 `stripSubmissionForStudent`（我 r1 已改）也正确地在嵌套对象上写 `{ feedback }`——但客户端 `joinSubmissions` 没接住这条数据流。

## 修复

### 1) `RawSubmissionLite` 接口扩展

```ts
// Fix 6 修订：Submission 本身没有 evaluation 字段（prisma schema 表 16）。
evaluation?: Record<string, unknown> | null;  // 旧 fixture 兼容
simulationSubmission?: { evaluation?: Record<string, unknown> | null } | null;
quizSubmission?: { evaluation?: Record<string, unknown> | null } | null;
subjectiveSubmission?: { evaluation?: Record<string, unknown> | null } | null;
```

把 `evaluation` 改为可选 + 增三个嵌套可选字段。旧测试 fixture（如 `pr-stu-1-grades.test.ts:210` 顶层 `evaluation: { feedback: "好" }`）仍能工作。

### 2) `joinSubmissions` 优先嵌套表，旧顶层做兜底

```ts
evaluation:
  s.simulationSubmission?.evaluation ??
  s.subjectiveSubmission?.evaluation ??
  s.quizSubmission?.evaluation ??
  s.evaluation ??
  null,
```

顺序：嵌套优先（生产路径）→ 旧顶层（测试兼容）→ null。任意 submission 在三个嵌套表中只有一个非空（taskType 决定），所以三个 `??` 之间无歧义。

### 3) Unused eslint-disable 删除

`grading.service.ts:125` 上方有个 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`，但这一行 `const maxScore = (...).reduce(...)` 自身没用 `any`（callback 才用，且 callback 上方已有自己的 disable）。删之。

## 测试

新增 5 case 锁定 nested wiring：
1. simulation: `row.evaluation` 来自 `simulationSubmission.evaluation`（含 `FAILED_FEEDBACK_JSON` 文案）
2. subjective: `row.evaluation` 来自 `subjectiveSubmission.evaluation`（通用 `FAILED_FEEDBACK_MESSAGE` 文案）
3. quiz: `row.evaluation` 来自 `quizSubmission.evaluation`
4. 向后兼容：旧 fixture 顶层 `evaluation` 仍能落到 row（fallback 链生效）
5. 全空：`evaluation = null`

**结果：**
- `npx tsc --noEmit` — 0 error
- `npx vitest run` — **79 files / 942 tests 全过**（r1 后 937 → +5 r2 = 942）
- `npm run lint` — **0 errors / 3 warnings**（全是 pre-existing runner 文件，r1 引入的 1 个 unused-disable warn 已修复）

## 数据流（修复后）

```
grading.service.ts catch:
  writeGradingFailureFeedback → updateSubmissionGrade
    → tx.simulationSubmission.update / tx.subjectiveSubmission.update
    → evaluation = { totalScore: 0, maxScore, feedback: "AI 批改暂未完成（模型输出格式异常）...", rubricBreakdown, failureReason }

GET /api/submissions:
  → getSubmissions(include: simulationSubmission/quizSubmission/subjectiveSubmission) 
  → stripSubmissionForStudent (Fix 6 r1):
    isFailed=true → preservedEvaluation = { feedback }  // 仅 feedback
    其它字段照常剥离 (score/maxScore/conceptTags/rubricBreakdown 等)

Frontend page.tsx:
  joinSubmissions(rawItems, dashboardTasks)
    → s.simulationSubmission?.evaluation ?? ... ?? null   // r2 修复
    → row.evaluation = { feedback: "..." }

EvaluationPanel:
  row.status === "failed" → 渲染 danger banner
    → {(row.evaluation as { feedback?: string } | null)?.feedback || "..."}
    → 显示 r1 设计的差异化文案
```

## Anti-regression

- ✅ 顶层 `evaluation` 字段保留为 fallback（`pr-stu-1-grades.test.ts:210, 246` 等已有 fixture 不破坏）— 全套 942 tests 全过验证
- ✅ Strip 逻辑不变（仍由 Fix 6 r1 的 stripSubmissionForStudent 决定保留哪些字段）
- ✅ 服务端 grading.service.ts 唯一改动是删 unused eslint-disable，业务逻辑 0 改
- ✅ MiMo 修复 / Fix 10 / batch 1 全零碰
- ✅ Prisma schema 0 改

## 给 QA 的关键验证点（r2）

1. **r1 的截图复现**：用同样的 DB 注入脚本（status='failed' + simulationSubmission.evaluation.feedback='AI 批改暂未完成（模型输出格式异常），…' 对 sim，subjectiveSubmission.evaluation.feedback='AI 批改暂未完成，…' 对 subj），登录 student1 → /grades 选中两行 → 右侧 banner 文案应**不同**：
   - sim: 含"模型输出格式异常"
   - subj: 不含"模型输出格式异常"
2. **API 层证据**：用 student1 token GET `/api/submissions?taskInstanceId=<id>` → response.items[].simulationSubmission.evaluation = `{ feedback: "..." }`（已 r1 验证过仅 feedback）
3. **回归**：原有 `pr-stu-1-grades.test.ts` 的 `evaluation: { feedback: "好" }` (sub-1 已 released) 仍正确落到 row.evaluation
4. **lint**：`npm run lint` 不应再有 grading.service.ts:125 的 unused-disable warning

## 后续

Fix 10 QA 同时进行（独立分支同一 worktree，commit 645e081）。两 fix r2/r1 全 PASS 后我 ping team-lead 收工。
