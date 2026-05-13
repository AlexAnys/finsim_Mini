# Spec — Review Fixes Batch 2（6 个 🟡，3 worktree 并行，1 个 PR）

> Batch 1 已合并准备中（PR #8 https://github.com/AlexAnys/finsim_Mini/pull/8）。Batch 2 worktree 起点 = `claude-fix-batch1-all` HEAD `9267bb6`（不等 PR 8 merge）。PR #8 合并 main 后，batch 2 PR 自动可 rebase 到 main。

## 用户原话

> "没问题 继续剩下的"

PR #8 review PASS，启动 batch 2 修复 review 报告里其余 6 个 🟡 议题（潜在风险 + 体验粗糙的）。

## 6 个 Fix（来源 review_summary_r1.md）

| # | Unit | 议题 | 主要文件 |
|---|---|---|---|
| 6 | `fix-6-grading-fail-toast` | AI 评分失败默默 0 分（学生看不到，sim/subjective 没 fallback） | `lib/services/grading.service.ts` + 学生 grades 页 |
| 7 | `fix-7-error-page-cta` | 错误页陷死路（`/tasks/<bad>`、`/sim/<bad>` 无返回 CTA，sim 全屏更糟） | `app/(student)/not-found.tsx` + `(simulation)/layout.tsx` + 共享 ForbiddenState/NotFoundState |
| 8 | `fix-8-upload-split-progress-retry` | UI 唯一入口"上传大纲"把题库也走 syllabus 解析；上传 75-95s 无进度；失败不能重试 | `app/api/lms/courses/[id]/outline-import/route.ts` + `course-knowledge-source.service.ts` + 课程编辑 UI |
| 9 | `fix-9-error-code-i18n` | 8 个错误码服务层抛出但 `handleServiceError` 没映射，前端看到"服务器内部错误" | `lib/api-utils.ts`（单文件） |
| 10 | `fix-10-async-job-cron` | 异步批改进程内 `setTimeout`，Node 重启时 status="queued" 的 job 永远没人捡 | `lib/services/async-job.service.ts` + `app/api/cron/*` 新增 |
| 11 | `fix-11-completion-rate-tooltip` | dashboard 完成率 11% vs 数据洞察 50% 两套口径分裂 | `lib/utils/teacher-dashboard-transforms.ts` + 可能 `analytics-v2.service.ts` + tooltip UI |

> 议题编号承接 batch 1（fix-1~5）。

## 文件冲突矩阵 → 分组

| Fix | 跟谁冲突 |
|---|---|
| 6 (grading-fail-toast) | Fix 10 同 grading/async-job 域 → 串行 |
| 7 (error-page-cta) | 独立（前端错误页） |
| 8 (upload-split) | 独立（outline-import 模块） |
| 9 (error-code-i18n) | 独立单文件（api-utils.ts） |
| 10 (async-job-cron) | Fix 6 同域 → 串行 |
| 11 (completion-rate-tooltip) | 跟 batch 1 Fix 1 同文件 (teacher-dashboard-transforms.ts) — batch 1 已修，无 conflict 风险 |

**分组**（3 worktree 并行）：

| Worktree | Fix | 路径 | 端口 | 估算 |
|---|---|---|---|---|
| **X grading-async** | 6 + 10（串行） | `finsim-wt-grading` | 3001 | ~3h |
| **Y outline-input** | 8 | `finsim-wt-outline-input` | 3002 | ~3h |
| **Z error-data-polish** | 7 + 9 + 11（小杂烩，串行） | `finsim-wt-errdata` | 3003 | ~3h |

关键路径 ≈ 3-4h（vs 串行 12-15h）。

## 共享资源

- Postgres：3 worktree 共用主 docker `acc4fef29d82_finsim-postgres`
- node_modules：symlink 主 worktree（已设）
- .env：已 copy 到 3 worktree
- Playwright + chromium：已装好（缓存在 `~/Library/Caches/ms-playwright`）
- **禁止 npm install 加新依赖**（symlink 会污染所有 worktree；若必须加新依赖，停下来 SendMessage coordinator 协调）

## 同步点

⚠️ **Prisma schema 改动是唯一同步点**。如某 fix 发现要改 schema（Fix 10 cron 可能加 stuck-job marker 字段；不太可能但要警惕），立即 SendMessage coordinator，其他 worktree 暂停。Fix 6/7/8/9/11 应用层改动，预期无 schema 改动。

## 6 个 Fix 详细 spec

---

### Worktree X · Fix 6 — AI 评分失败给学生看得见的提示

**Unit**：`fix-6-grading-fail-toast`

**问题证据**：`grading.service.ts:164` `updateSubmissionGrade(status:"failed")` 把失败状态写入 DB，但学生 grades 页没有为 sim/subjective 显示"AI 批改失败"提示（只有 quiz 简答 `grading.service.ts:311` 有这个 fallback）。来源：Stream A `review_ai_r1.md` 🟡。

**修复方向**：
- `gradeSimulation` / `gradeSubjective` 套 try/catch；JSON 解析失败时 `score=null`, `status="grading_failed"`，写错误原因到 `feedback`
- 前端 `app/(student)/grades/page.tsx`（或学生 task 详情）：当 submission.status === "grading_failed" 显示中文「AI 批改暂未完成，请联系老师手动批改」+ 重新提交按钮
- 不破坏 quiz 简答现有 fallback

**Acceptance**：
1. Playwright 实测：mock AI 返回非法 JSON → 提交 sim/subjective → 学生 grades 页显示中文失败提示（非 0 分）
2. quiz 简答失败兜底行为不变
3. DB Submission.status="grading_failed" + feedback 含失败原因
4. `npx tsc --noEmit` 0 / `npx vitest run` 全过
5. Commit：`fix(grading): show student a failure message on AI grading error (sim/subjective)`

**Anti-regression**：
- 不能让 quiz 单选/多选自动评分被影响（这条路径不过 AI）
- AI 评分本身 retry 逻辑（如果有）保留

---

### Worktree X · Fix 10 — 异步批改 cron 扫 stuck job

**Unit**：`fix-10-async-job-cron`

**问题证据**：`async-job.service.ts:37` 用 `setTimeout(..., 0)` 启动 job，Node 进程重启后 `status="queued"` 的 job 永远没人捡。参考 `/api/cron/release-submissions` 已有的 pattern。来源：Stream A 🟡。

**修复方向**：
- 新增 `app/api/cron/sweep-stuck-jobs/route.ts`（参考现有 cron route 结构）
- 每分钟扫 `AsyncJob where status="queued" AND createdAt < now() - 60s` → 重新触发 `runAsyncJob`
- 同时扫 `status="running" AND startedAt < now() - timeout` （比如 10 分钟）→ 标 failed 触发 retry 或人工介入
- 关键：用 row-level lock（`SELECT FOR UPDATE SKIP LOCKED` 或类似）避免多个 cron 实例并发执行同一 job

**Acceptance**：
1. 手动停 dev server → 触发 sim 提交（job 进入 queued）→ 重启 dev server → 调 `/api/cron/sweep-stuck-jobs` → job 被捡起运行
2. running 状态超时的 job 被 mark failed
3. 多次调 cron 不会重复执行同一 job（lock 生效）
4. `npx tsc --noEmit` 0 / vitest 全过 / 加 1 个单测覆盖 sweep 逻辑
5. Commit：`fix(async-job): cron sweeper rescues queued/running jobs after process restart`

**Anti-regression**：
- 现有 `runAsyncJob` 调用方式不破坏
- AsyncJob schema 不动（如必须加字段，触发同步点）

---

### Worktree Y · Fix 8 — 大纲/题库拆入口 + 进度条 + 失败重试

**Unit**：`fix-8-upload-split-progress-retry`

**问题证据**：`outline-import/route.ts:46` 强制写 `sourceType:"syllabus"`，UI 唯一"上传大纲"入口，题库 docx 被走 syllabus 解析浪费 30s + 失败。Syllabus 处理 75-95s 无进度条。`ai_summary_failed` 状态无重试按钮，老师只能删掉重传。来源：Stream B `review_automation_r1.md` 🟡。

**修复方向**：
- `outline-import/route.ts` 加 `sourceType` 参数（默认 syllabus 向后兼容）
- UI 课程编辑器增加「上传题库」按钮 → 调 `/api/lms/course-knowledge-sources` 通用 POST（已有）
- syllabus 上传进度条：用 `CourseKnowledgeSource.status` 已有的状态流转（uploading → parsing → ai_summarizing → ai_outlining → ready / ai_summary_failed）轮询显示百分比 / 阶段文字
- 失败重试：`ai_summary_failed` 状态显示「重新 AI 解析」按钮 → 调新 `POST /api/lms/course-knowledge-sources/[id]/retry`（重新跑 `processCourseKnowledgeSource`）
- 可选：摘要 + outline 两个 AI 调用并行（spec 提到但是 nice-to-have，不强制）

**Acceptance**：
1. Playwright：传 syllabus 走 syllabus 解析（默认）/ 传题库走新独立路径（不再 AI outline 抽取）
2. UI 显示阶段进度文字（最少：解析中/AI 摘要中/AI 抽章节中/完成）
3. AI 失败后 UI 显示「重试」按钮，点击 → 状态回 ai_summarizing → 再走一遍
4. 向后兼容：现有 outline-import 不带 sourceType 参数时仍按 syllabus 走
5. `tsc 0 / vitest 全过`
6. Commit：`fix(course-input): split syllabus/question-bank upload + progress + AI-fail retry`

**Anti-regression**：
- regex 题库直抽路径不变（Stream B 实测 confidence=1.0 887ms 不能破坏）
- ZIP / PDF / DOCX 文档解析分支保留

**估计工作量**：3-4h（前后端 + 状态机改动较多）

---

### Worktree Z · Fix 7 — 错误页加返回 CTA

**Unit**：`fix-7-error-page-cta`

**问题证据**：访问不存在的 `/tasks/<bad-uuid>` 显示红色感叹号 + "任务实例不存在"，**没有"返回"按钮**。`/sim/<bad-uuid>?preview=true` 更糟（sim 全屏无 sidebar 陷死路）。`(simulation)/layout.tsx` 缺 server-side auth guard，未登录先白屏。来源：Stream D `review_pages_r1.md` 🟡。

**修复方向**：
- 复用已有 `components/.../NotFoundState` 组件（在 `app/(student)/not-found.tsx` 已用），扩展到 `tasks/[id]` 和 `sim/[id]` 的 invalid-id 错误态
- 学生页加「返回作业列表」按钮 / 主页按钮
- Sim 全屏页加「退出模拟，返回作业列表」中文按钮（即使 layout 无 sidebar）
- `(simulation)/layout.tsx` 加 `await requireAuth()` server-side guard（参考 `(student)/layout.tsx:12`）

**Acceptance**：
1. Playwright 实测：访问 `/tasks/00000000-0000-0000-0000-000000000000` → 显示错误 + 「返回作业列表」中文按钮，点击 → 跳学生 dashboard
2. `/sim/00000000-0000-0000-0000-000000000000?preview=true` → 同上，有中文返回按钮
3. 未登录访问 `/sim/<id>` → 直接 redirect `/login`（不白屏）
4. `tsc 0 / vitest 全过`
5. Commit：`fix(error-page): add return CTA to invalid tasks + sim auth guard`

**Anti-regression**：
- 学生 sim 完成后的正常退出流程不破坏
- 老师 `?preview=true` 入口仍能用

---

### Worktree Z · Fix 9 — 8 个错误码补中文映射

**Unit**：`fix-9-error-code-i18n`

**问题证据**：Stream E `review_quality_r1.md` 🔴 R2 — `lib/services/` 抛出但 `lib/api-utils.ts` 没 case 处理的错误码：
- `MISSING_SIMULATION_DATA` (grading.service.ts:183)
- `MISSING_QUIZ_DATA` (:242)
- `MISSING_SUBJECTIVE_DATA` (:439)
- `TASK_BUILD_DRAFT_NOT_FOUND` (task-build-draft.service.ts ×3)
- `TASK_BUILD_DRAFT_SCOPE_MISMATCH`
- `NO_POSTS_TO_SUMMARIZE` (study-buddy:248)
- `WORK_ASSISTANT_EMPTY_INPUT` (ai-work-assistant:113)
- `AI_PROVIDER_NOT_FOUND` (ai-tool-settings:213)

前端拿到的是英文"服务器内部错误"，应该是中文具体提示。

**修复方向**：
- 在 `lib/api-utils.ts` `handleServiceError` 加 8 个 case，映射成 4xx 错误 + 中文 message
- 比如 `MISSING_SIMULATION_DATA` → 400 + "无法批改：缺少模拟对话数据，请联系老师"
- `NO_POSTS_TO_SUMMARIZE` → 400 + "暂无可总结的讨论帖，先发布一些再试"
- `AI_PROVIDER_NOT_FOUND` → 404 + "AI 服务商未配置"

**Acceptance**：
1. 每个错误码至少 1 个测试 case 触发并断言中文 message + 正确状态码
2. 前端拿到的 error.message 是中文（不是 "Internal Server Error"）
3. 不破坏现有错误码映射
4. `tsc 0 / vitest 全过`
5. Commit：`fix(api-utils): map 8 unmapped service error codes to Chinese 4xx responses`

**Anti-regression**：
- 现有 `handleServiceError` 已 case 的错误码行为不变
- 默认 500 fallback 保留（兜底未列出的错误）

**估计工作量**：30-60min（单文件 + 测试）

---

### Worktree Z · Fix 11 — dashboard vs 数据洞察完成率口径统一/加 tooltip

**Unit**：`fix-11-completion-rate-tooltip`

**问题证据**：dashboard `computeCompletionRate` (`teacher-dashboard-transforms.ts:102`) `Σ min(subs, classSize) / Σ (classSize × instance)` 实测 11%；analytics-v2 (`analytics-v2.service.ts:676`) `submittedStudents distinct / assignedStudents` 实测 50%。两个数字都"对"但口径不同，老师跨页困惑。来源：Stream C 🟡。

**修复方向（coordinator 决策）**：**加 tooltip 显示口径**（不改算法，避免破坏老师已习惯的数字）
- dashboard 完成率 KPI 加 tooltip：「完成率 = 各任务提交总数 / 各任务应交总数（按班级人数 × 任务数累计）」
- analytics-v2 完成率 KPI 加 tooltip：「完成率 = 至少提交一次作业的学生数 / 应交学生数」
- 两个 tooltip 文案明确说"两边口径不同，本页是 XXX 口径"

如 builder 觉得统一口径更好（如统一为 distinct-student），可主张但需 SendMessage coordinator 重审（影响范围大）。

**Acceptance**：
1. Playwright 实测：hover dashboard 完成率 KPI 显示中文 tooltip 说明口径
2. hover analytics-v2 完成率 KPI 同上
3. 两个数字本身不变（口径不改算法）
4. `tsc 0 / vitest 全过`
5. Commit：`fix(dashboard): add completion-rate tooltip to clarify dashboard vs analytics-v2 metric scope`

**Anti-regression**：
- 数字不变（不破坏 batch 1 已验证过的 KPI 准确性）
- 不破坏 batch 1 Fix 1（学生数 sum）和 Fix 2（实时聚合）

**估计工作量**：1-1.5h

---

## QA 独立验证规则

每个 fix 完成时，对应 worktree 的 QA agent：
1. 读 builder `reports/build_fix-N_r{R}.md`
2. 独立读 git diff（不只信 builder 自报；用 `git show <SHA> --stat` 单 commit 锁定，避免滑动窗口误判）
3. 真浏览器 Playwright 实测 acceptance
4. 直连 Postgres 对账（Fix 6/10 涉及 status；Fix 11 涉及 KPI 数字）
5. 跑 `npx tsc --noEmit + npx vitest run + npm run lint` 全绿
6. 检查 CLAUDE.md anti-regression
7. 写 `reports/qa_fix-N_r{R}.md`，PASS/FAIL + 详细证据
8. 追加 progress.tsv
9. SendMessage builder 结果

QA 不许：
- 改业务代码
- 用 builder e2e 作为唯一验证
- 凭代码 review 通过

## Dynamic exit per fix

- QA r1 PASS 即收工（不跑 r2 保险，遵循 batch 1 教训）
- 同一 FAIL 3 连 → 回 spec 重规划（不硬磨）

## Integration（6 fix 全 PASS 后）

主 worktree coordinator：
1. 创建 `claude-fix-batch2-all` 分支从 `claude-fix-batch1-all` HEAD
2. Cherry-pick 3 worktree 的 commits（按时序，无 squash 简单可靠）
3. 集成 QA `tsc + vitest + lint + playwright`
4. Push + `gh pr create base=main`（**等 PR #8 merge 到 main 后**，否则 base 用 `claude-fix-batch1-all`）
5. PR 描述中文写 6 fix 用户感受的改变

## Risks 汇总

- ⚠️ Fix 10 cron sweeper：lock 不到位会重复执行 job → builder 必须实测多 worker 场景
- ⚠️ Fix 6 grading try/catch 范围：太宽会吞合理错误（如 network failure），太窄漏掉 JSON 解析失败 → 仅 catch JSON.parse + schema validation 错误
- ⚠️ Fix 8 状态机：syllabus 5 个状态 (uploading/parsing/summarizing/outlining/ready/failed) 流转易出 bug → 测全部转移
- ⚠️ Fix 11 tooltip 内容：必须中文且准确描述口径，不能写错算法

## 不在 batch 2 范围

- review 留下的 untracked 文件（screenshots / e2e 脚手架 / playwright configs）保留在主 worktree，不进 batch 2 PR
- agent_docs/* 跟 batch 2 无关
- batch 1 worktree 已 remove，分支仍在 git
