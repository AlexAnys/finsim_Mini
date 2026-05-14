# Spec — Molly 老师反馈的 3 个课程管理问题（PR #11，2 worktree 并行）

> 用户在 molly@qq.com 账号下发现 3 个问题。Coordinator 已 Playwright 实测复现 + DB 对账定位根因。本 spec 修 4 个 fix（NFT 已修在 PR #10 里）。

## 用户原话

> "molly@qq.com 这个老师账号进去后，课程管理中，上传完大纲，这个编辑课程有些问题：
> 1. 识别问题，分析下背后具体是怎么识别的，机制是否合理；
> 2. 目录草稿无法正常编辑，如新建的「个人理财」为例，「编辑课程目录草稿」中章节名的文本框无法正常打字输入总是卡，有些文本框可以；
> 3. 另外，安全合并和应用到课程替换不确定区别，编辑课程中删除章节后无法重新识别上传的素材"

## 已 Playwright 实测 + DB 对账定位的根因

**Molly 课程 `个人规划` (id=8f7f653c)，上传的文件 `个人理财-课程标准-编码表.xls`：**
- DB CourseKnowledgeSource.status = `ai_summary_failed`
- DB error = "课程大纲解析暂不可用：Expected ',' or ']' after array element in JSON at position 9845 (line 355 column 6)"
- DB extractedText 长度 5163 字符（XLSX 提取成功）
- DB structuredData = NULL（AI outline 解析失败）

## 4 个 Fix

### M1 (Backend) — AI Outline JSON 解析失败容错

**Unit**：`fix-M1-ai-outline-json-resilience`

**问题证据**：`course-knowledge-source.service.ts:347` `processCourseKnowledgeSource` 串行调 2 个 AI，第二个 outline AI 调用因 LLM 输出 JSON 不闭合截断。

**修复方向**：
- 内联 JSON resilient parse（**不允许新依赖**）：捕获 SyntaxError → 试 partial parse（截到最后一个完整 array element）
- 提升 maxOutputTokens（outline prompt 用 16k 而非 8k）
- 结构化重试：parseError 时重发更紧凑 prompt（"只返回前 N 章核心结构"）

**Acceptance**：
1. Molly source(id=778e76c6) 重试 → 这次成功（structuredData 非空，至少 3 章）
2. 加单测：mock LLM invalid JSON 时 service partial parse 或 retry
3. 现有 syllabus 解析行为不变
4. tsc 0 / vitest 全过
5. Commit: `fix(course-knowledge-source): resilient JSON parse + structured retry for outline AI failures`

**Anti-regression**：不破坏 batch 2 Fix 8 进度条 / 重试按钮；不破坏 quiz/subjective task-draft 路径

**Worktree**：`finsim-wt-molly-be`，分支 `claude-fix-molly-backend`，port 3002

### M2 (Frontend) — 章节名 input 卡顿（React key bug）

**Unit**：`fix-M2-outline-editor-input-key`

**问题证据**：`app/teacher/courses/[id]/page.tsx:1995` `key={\`${chapter.title}-${chapterIndex}\`}` 用 title (input value) 当 key。打字 → key 变 → 整 row remount → input 失焦。section 同问题。

**修复方向**：
- chapter key 改 `chapter.chapterId ?? \`new-${chapterIndex}\``
- section key 改 `section.sectionId ?? \`new-${chapterIndex}-${sectionIndex}\``

**Acceptance**：
1. Playwright：molly outline editor 章节名连续打字 10 字，每键 ≤50ms 无失焦
2. 小节名同上
3. 新建章节输入名字不卡
4. 删除章节后剩余 input 行为正常
5. tsc 0 / vitest / lint 全绿
6. Commit: `fix(outline-editor): use stable chapterId/sectionId as React key to fix input focus loss`

**Worktree**：`finsim-wt-molly-fe`，分支 `claude-fix-molly-frontend`，port 3001

### M3a (Frontend) — 安全合并 vs 应用到课程结构（替换）说明不清

**Unit**：`fix-M3a-outline-merge-tooltip`

**问题证据**：两按钮当前无 tooltip / inline 描述。

**修复方向**：
- 「安全合并」加 Tooltip「只新增草稿里有但课程结构没有的章节，不会删除或修改已有章节」
- 「应用到课程结构（替换）」加 Tooltip「按草稿完整对齐：新增/修改/删除/重排已有章节。删除带任务的章节会被拒绝」

**Acceptance**：
1. Playwright：hover 两按钮各显示中文 tooltip
2. 按钮 label 不变
3. 数据流不变
4. tsc 0 / vitest / lint 全绿
5. Commit: `fix(outline-editor): add tooltips clarifying safe-merge vs replace semantics`

**Worktree**：同 M2（串行）

### M3b (Frontend + Util) — 删除章节后无法重新识别素材

**Unit**：`fix-M3b-ready-source-rescan`

**问题证据**：
- `lib/utils/knowledge-source-status.ts:RETRYABLE_STATUSES = {ai_summary_failed, failed, ocr_required}` 缺 `ready`
- 后端 `course-knowledge-source.service.ts:534,580` retry 允许 `{ready, ai_summary_failed}` — 前后端不一致
- 老师删章节后想"重新解析素材"在 ready 状态下不显示按钮

**修复方向**：
- `RETRYABLE_STATUSES` 加 `"ready"`
- 按钮文案区分：ready → 「重新解析素材」；failed → 「重新 AI 解析」
- ready 状态点击加确认对话框「重新解析将重新跑 AI，是否继续？」

**Acceptance**：
1. Ready source 显示「重新解析素材」可点
2. Failed source 仍显示「重新 AI 解析」
3. Ready retry → status 变 processing → 完成 → ready
4. tsc 0 / vitest / lint 全绿
5. Commit: `fix(knowledge-source): allow retry/rescan on ready status with distinct label`

**Worktree**：同 M2（串行）

## 工作流

2 worktree 并行：
- **frontend** (M2 → M3a → M3b 串行，~1.5-2h)
- **backend** (M1 单 fix，~2-3h)

每 fix builder → qa 独立验证。Dynamic exit r1 PASS 即收工，3 连 FAIL 回 spec。
QA 用 `git show <SHA> --stat` 单 commit 锁定。Dev server 用 `--webpack`。
**禁止 npm install**（M1 内联 JSON repair）。

## 共享资源

- Postgres：docker `acc4fef29d82_finsim-postgres`
- node_modules symlink + .env copy 已设
- Playwright + chromium 装好
- **Molly 密码临时改成 `password123`**（原 hash 备份 `.harness/molly-original-hash.txt`），PR merge 前 coordinator 恢复

## 集成

2 worktree 全 PASS → 主 worktree cherry-pick 到 `claude-fix-molly-all` 从 main HEAD 起（**等 PR #10 staging-deploy SUCCESS + merge**）
集成 QA → push → `gh pr create base=main` → PR #11

## Acceptance（整 PR #11）

- 4 fix QA PASS
- tsc / vitest / lint 全绿
- 不破坏 batch 1+2 已修 11 fix
- 不引入新依赖
- 中文 UI 文案
- Molly XLSX 真能重新解析出 outline（M1）
- Molly 章节 input 连续打字不丢焦（M2）
- 两按钮中文 tooltip（M3a）
- Ready 状态显示「重新解析素材」（M3b）

## 风险

- M1 resilient parse 误判风险 → 单测覆盖正常 + 异常
- M2 chapterId 缺失 fallback key 要稳（用 `new-${index}-${randomOnce}` 或类似）
- M3b ready retry 会消耗 token → 确认对话框
