# Build report — Fix 6 (AI 评分失败给学生看得见的提示) · r1

- **Worktree**：`finsim-wt-grading`
- **分支**：`claude-fix-batch2-grading-async`
- **基线 commit**：`9267bb6`（claude-fix-batch1-all HEAD）
- **本次 commit**：`c47eab8` — `fix(grading): show student a failure message on AI grading error (sim/subjective)`
- **改动文件**：
  - `lib/services/grading.service.ts` (+57/-1)
  - `lib/services/submission.service.ts` (+14/-3)
  - `components/grades/evaluation-panel.tsx` (+12/-1)
  - `tests/fix-6-grading-fail-feedback.test.ts` (新文件，318 行)
- **总 diff**：408 insertions / 3 deletions（test 占大头；生产代码 83/5）

## 根因（spec 引用 review_ai_r1.md）

`grading.service.ts:164` 失败兜底只写 `status="failed"`，**不写 evaluation**。学生 grades 页对 sim/subjective 没有失败态分支，掉进 fallback「AI 分析中 · 一般 2-5 分钟内完成」——但其实永远不会完成。

Quiz 简答有 per-question fallback（`grading.service.ts:316-319` `comment: "AI 批改失败，请等待教师手动批改"`），sim/subjective 没有。

## 修复

### 1) `grading.service.ts` outer catch 写 user-facing feedback

新增 `writeGradingFailureFeedback(submission, err)`：
- 仅 sim / subjective 走（quiz 跳过，保留 per-question 兜底）
- 区分 JSON-shape 错误（SyntaxError / ZodError / 含 "json|zod|ai_generate_failed" 关键字）与其他错误，前者文案带"模型输出格式异常"
- 写入 `evaluation: { totalScore: 0, maxScore, feedback, rubricBreakdown: [...zero-scored], failureReason }`
- 包在自己的 try/catch，写失败不阻塞 outer catch 的 rethrow

### 2) `stripSubmissionForStudent` 保留 failed 的 feedback

`status === "failed"` 时：score/maxScore 仍剥离为 null，conceptTags 仍清空，但 evaluation 保留 `{ feedback }` 一个字段（不暴露 rubricBreakdown / totalScore / failureReason 等内部字段）。

无 feedback 时 evaluation 仍为 null，前端 hard-coded 文案兜底。

### 3) `evaluation-panel.tsx` 新增 failed 分支

在 `analyzed_unreleased` 之前判断 `row.status === "failed"`，渲染 danger-toned 横条：
- 标题「AI 批改未完成」+ AlertCircle 图标
- 内容用 `row.evaluation.feedback`，缺省用前端 hard-coded "AI 批改暂未完成，请联系老师手动批改。"

### 4) submission-row.tsx 已存在的 failed chip 保留

之前已有 `row.status === "failed"` 显示「批改失败 · 等待教师处理」chip，无需改动。

## 测试

新增 `tests/fix-6-grading-fail-feedback.test.ts` 8 个 case：

**Service 层（4）：**
1. simulation + JSON parse 错（"Unexpected token"）→ status=failed + feedback 含「AI 批改暂未完成」「模型输出格式异常」+ audit log "submission.grade.failed"
2. subjective + ZodError → status=failed + feedback 含「AI 批改暂未完成」
3. simulation + 网络错误（ECONNRESET）→ feedback 含「AI 批改暂未完成」但不含「格式异常」
4. quiz outer 失败（mock 第二次 update 抛错）→ 不写 status=failed evaluation（writeGradingFailureFeedback early return）

**Strip 层（4）：**
5. simulation status=failed → 保留 evaluation.feedback，剥离 score/maxScore/rubricBreakdown/conceptTags
6. subjective status=failed 无 feedback → evaluation=null（前端兜底）
7. status=graded（未公布）→ evaluation 仍剥离为 null（不被 Fix 6 影响）
8. status=submitted → evaluation 仍 null

**结果：**
- `npx vitest run` — **78 files / 930 tests 全过**（之前 922，本 fix 加 8）
- `npx tsc --noEmit` — 0 error

## DB 状态对照

```
status="failed" 后的 Submission：
  - score = 0
  - maxScore = (rubric.maxPoints 求和)
  - simulationSubmission.evaluation 或 subjectiveSubmission.evaluation =
      { totalScore: 0, maxScore, feedback: "AI 批改暂未完成…", rubricBreakdown: [...], failureReason: "<原始 err.message>" }

学生 API 拉到的（经 stripSubmissionForStudent）：
  - score: null（剥）
  - maxScore: null（剥）
  - evaluation: { feedback: "AI 批改暂未完成…" }（仅保留 feedback）
  - conceptTags: []（剥）
  - analysisStatus: "pending"（deriveAnalysisStatus 不变，failed → pending）
```

## Anti-regression 检查（CLAUDE.md + spec）

- ✅ Quiz 简答 per-question fallback（`gradeQuiz` 内 `try { gradeShortAnswer } catch { comment: "AI 批改失败..." }`）零改动
- ✅ Quiz 单选/多选自动评分路径零改动（不过 AI）
- ✅ `aiGenerateJSON` 内部 retry 逻辑保留（outer catch 只在所有 retry 失败后才接管）
- ✅ Batch 1 Fix 1（学生数 sum）/ Fix 2（dashboard analytics）零改动
- ✅ MiMo reasoning param 修复（da9a505）零改动
- ✅ Service interface `updateSubmissionGrade` 签名未改
- ✅ Prisma schema 未动（SubmissionStatus enum 已含 "failed"，无三步铁律）
- ✅ 生产代码 diff 83/5 行 < 150 上限
- ✅ 中文 UI 文案全中文

## 给 QA 的关键验证点

1. **代码 review**：单 commit `c47eab8`，看 4 个文件的具体改动
2. **浏览器实测（手工失败注入比较麻烦，建议直连 DB）**：
   - 登录 `student1@finsim.edu.cn` / `password123`
   - 找一条 sim/subjective submission（或自己提一份），手动改 DB：
     ```sql
     UPDATE "Submission" SET status='failed', score=0
       WHERE id='<some-sim-sub>';
     UPDATE "SimulationSubmission" SET evaluation='{"feedback":"AI 批改暂未完成（模型输出格式异常），请联系老师手动批改。","totalScore":0}'::jsonb
       WHERE "submissionId"='<some-sim-sub>';
     ```
   - 访问 `/grades` → 列表行显示「批改失败 · 等待教师处理」chip → 选中该行 → 右侧面板显示 danger-toned 横条 + 中文 feedback
3. **回归**：
   - status=graded 已公布 submission → 仍正常显示分数 + 评语（不受影响）
   - status=graded 未公布 → 仍显示「AI 已分析完毕 · 等待教师公布」（不受影响）
   - quiz submission failed → 仍走 quiz 自己的 per-question comment 兜底（grading 内部）
4. **DB 对账**：失败 submission 的 `evaluation.feedback` 字段写入正确 + `failureReason` 字段保留原始错误信息（供老师 debug）
5. **API 响应剥离**：用 student token GET `/api/submissions?...` → 含 `evaluation: { feedback }` 而非 `evaluation: null` 也非完整对象

## 后续

进入 Fix 10 — 异步批改 cron sweeper（`app/api/cron/sweep-stuck-jobs/route.ts` 参考 release-submissions pattern）。
