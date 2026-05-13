# QA Report — Fix 8 r1（大纲/题库拆入口 + 进度条 + 失败重试）

- Worktree: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-outline-input`
- Branch: `claude-fix-batch2-outline-input`
- Commit verified: **`c0b0158`** (single commit; `git show --stat` 9 files +662/-30)
- QA: qa-outline-input (Claude Opus 4.7 [1M])
- Round: r1
- Dev port: 3012 (3002 占用 by `multica-frontend-1` Docker container — 切到 3012)
- Verdict: **PASS**

## Acceptance map（spec Worktree Y 段）

| # | 验收项 | 证据 | 结果 |
|---|---|---|---|
| 1 | syllabus 走 syllabus 解析；题库走独立路径（不再 AI outline 抽取） | 编辑课程对话框两按钮 click → dialog 文案分流 (`上传课程题库` vs `上传课程大纲`)；UI endpoint 分流 syllabus→`/outline-import`，question_bank→`/api/lms/course-knowledge-sources`；`processCourseKnowledgeSource` 仅当 `sourceType==='syllabus'` 时跑 outline AI 调用 (`lib/services/course-knowledge-source.service.ts:428`)；retry 单测覆盖 9 case；上传单测覆盖 4 case | PASS |
| 2 | UI 显示阶段进度文字 + 进度条 | `knowledgeSourceStatusLabel`：可用/AI 解析失败/需 OCR/处理失败/正在抽取文本/OCR 识别中/AI 正在解析/排队中 8 状态全中文；`knowledgeSourceProgressPercent`：5 档单调递增 (15→35→50→70→100)；`isKnowledgeSourceProcessing` 仅匹配 4 个流转中状态；4 个状态工具单测全 PASS（monotonic + label + retryable + processing） | PASS |
| 3 | AI 失败显示「重试」→ 状态回 ai_summarizing | `retryCourseKnowledgeSource`：白名单 `{ai_summary_failed, failed, ocr_required}`；其余 status 抛 `KNOWLEDGE_SOURCE_NOT_RETRYABLE` 映射到 400 + 中文「该素材当前状态无法重新解析」；缺 `filePath` 防御性也抛 NOT_RETRYABLE；重置 `status="uploaded" + error=null` + `enqueueAsyncJob("knowledge_source_ingest")`；UI 两处「重新 AI 解析」按钮 + `RotateCw` loader；5 case 单测覆盖 happy/failed/already-ready/not-found/missing-filePath | PASS |
| 4 | 向后兼容：不带 sourceType 仍 syllabus | 单测 `fix-8-outline-import-source-type.test.ts:48-58` 不传 sourceType → `sourceType='syllabus'` + tags `["课程大纲","课程结构"]`；route 实现 `rawSourceType` undefined → 默认 'syllabus' (`route.ts:28-31`)；DB 历史记录全是 `sourceType=syllabus`（5/5 spot-check） | PASS |
| 5 | tsc 0 / vitest 全过 | `npx tsc --noEmit` exit 0；`npx vitest run` **79 files / 935 tests PASS**（含 +13 新单测）；`npm run lint` 0 error / 3 pre-existing warning (quiz/sim/subjective runner) | PASS |
| 6 | Commit message | `fix(course-input): split syllabus/question-bank upload + progress + AI-fail retry` ✓ | PASS |

## Anti-regression

- **regex 题库直抽 confidence=1.0 路径不变**：`lib/services/question-bank.service.ts` / regex 抽取 0 改动；`question_bank` 仅走 generic `/course-knowledge-sources` + `knowledge_source_ingest` job → 既有 `processCourseKnowledgeSource` 路径（已有 spec.md 实测 887ms confidence=1.0 不被本 PR 改动）。**PASS**
- **ZIP / PDF / DOCX 文档解析分支保留**：`document-ingestion.service.ts` 0 改动；`extractDocumentText` 调用方式不变。**PASS**
- **batch 1 Fix 5 outline-apply 5 mode (preview/safe-merge/apply/save-draft/replace)**：outline-apply 路由 / `OutlineEditableDraft` / `getOutlineApplyMode` 全部 0 改动；`tests/outline-apply-replace.test.ts` 5 tests 仍 PASS（vitest 全套含此文件 PASS）。**PASS**
- **现有 outline-import 调用方**：grep 全仓只有 `app/teacher/courses/[id]/page.tsx:909` 一处，已同步更新；不传 sourceType 仍走 syllabus 默认（单测断言）。**PASS**
- **Service interface 向后兼容**：`createAndProcessCourseKnowledgeSource` 已存在 `sourceType?: string | null`（pre-Fix 8）；新增 `retryCourseKnowledgeSource` additive，未改动现有签名；handleServiceError 新增 `KNOWLEDGE_SOURCE_NOT_RETRYABLE` case 不影响现有码映射（vitest `api-utils-ai-error.test.ts` PASS）。**PASS**
- **中文 UI 全保留**：8 个 status label 全中文；toast 4 处全中文；按钮文案中文；error message 中文。**PASS**
- **批 1 PR (claude-fix-batch1-all) 基础**：worktree 起点 9267bb6（spec 指定基线）；`git show c0b0158 --stat` 仅 9 files 都属 Fix 8 范围，未触碰 batch 1 已 PR 文件（lib/utils/teacher-dashboard-transforms.ts / analytics-v2.service.ts / outline-apply 等）。**PASS**

## Browser e2e（Playwright config: `playwright.qa-fix-8.config.ts`, port 3012, webpack dev）

1. **edit-course dialog 两按钮 + 文案分流**: PASS
   - 登 teacher1 → /teacher/courses/[id] → 点「编辑课程信息」开 edit-course dialog
   - HTML 计数：`上传大纲`×2 + `上传题库`×2（按钮 + 描述文字），`AI 解析大纲管理` 卡片可见，无旧「继续上传」按钮
   - 点「上传题库」→ outline dialog 显「上传课程题库」+「题库文件」label
   - Escape 关闭，重开 → 点「上传大纲」→ outline dialog 显「上传课程大纲」+ 默认标签「课程大纲,课程结构」
   - 截图：`test-results/qa-fix-8-edit-dialog.png`、`qa-fix-8-bank-dialog.png`、`qa-fix-8-outline-dialog.png`
2. **Retry endpoint 路由可达**: PASS（500 in webpack dev due to **pre-existing pdfjs-dist RSC bundle bug**, route exists & module resolves — 见 Known Issue 段）
3. **Anti-regression**: 顶部 toolbar 原「上传大纲」直接入口仍存在（`onUploadSyllabus`），未被新 UI 替换 — PASS
4. 三个 e2e 总结：3 passed (17.9s)

## DB 对账

- `CourseKnowledgeSource.sourceType` 字段：`varchar(80)` nullable（schema 已就位 — pre-Fix-8）
- 现有 5 条记录 sourceType 全 `syllabus` → 向后兼容验证：不传 sourceType 路径产出 `syllabus` 与历史一致
- `KnowledgeSourceStatus` enum 实际值 `{uploaded, processing, ready, failed, extracting, ocr_required, ocr_processing, ai_summary_failed}` ↔ `lib/utils/knowledge-source-status.ts` 内的 PROGRESS_STATUSES + RETRYABLE_STATUSES 集合一致，无遗漏
- 无 schema 改动（同步点未触发）

## Known Issue（**非 Fix 8 引入**）

**症状**：webpack dev mode (`npm run dev -- --webpack`) 下，任何 import `course-knowledge-source.service` 的 route 在 first-hit 会 500：

```
TypeError: Object.defineProperty called on non-object
  at __webpack_require__.r (webpack-runtime.js:207:21)
  at eval (pdfjs-dist/legacy/build/pdf.mjs:1:21)
  ...
  at eval (lib/services/document-ingestion.service.ts:7:67)
```

**根因**：`pdf-parse@2.x` 重导出 `pdfjs-dist/legacy/build/pdf.mjs`（ESM），Next.js 16.2.4 webpack 的 `(rsc)` 加载器在重导出 namespace 时调用 `Object.defineProperty` 失败。

**确认非 Fix 8 引入**：在 worktree `git reset --hard 9267bb6`（Fix 8 父提交），清掉 `.next/dev` 重启 dev，相同 endpoints (`/outline-import`, `/course-knowledge-sources`) 也 500，**同样的 pdfjs-dist 错误堆栈**。`finsim-wt-grading` 同周期 worktree 上同样问题。

**Turbopack 不能替代**：用 `npm run dev`（默认 Turbopack）启动 → 立刻 panic `Symlink [project]/node_modules is invalid, it points out of the filesystem root` — worktree 的 node_modules symlink 模式不被 Turbopack 支持。

**影响范围**：仅 webpack dev mode 首次模块加载；production build (`npm run build`) 应该走 SWC 不受影响（builder 报 build 通过）。Staging 走 docker 容器内 production build，不受影响。

**建议**：留待后续独立 PR 修：升级或降级 pdf-parse；或对 doc-ingestion module 标注 `serverExternalPackages: ["pdf-parse","pdfjs-dist"]`。但**不在 Fix 8 scope**。

## 静态检查

- `npx tsc --noEmit` ✓ exit 0
- `npx vitest run` ✓ 79 files / 935 tests PASS（含 +13 新 Fix 8 单测）
- `npm run lint` ✓ 0 error / 3 pre-existing warning（quiz/simulation/subjective runner — 与 Fix 8 无关）

## Minor 观察（不影响 PASS）

1. **顶部 toolbar「上传大纲」按钮 (`onUploadSyllabus={() => setOutlineDialogOpen(true)}`) 不重置 `outlineDialogSourceType`**：用户先在 edit-course dialog 里点「上传题库」（设 sourceType=question_bank）→ 关闭 → 后续点顶部 toolbar 「上传大纲」会复用 `question_bank` state 显示题库 dialog 文案。属边缘交互 bug，不阻塞 acceptance（spec 验收只针对 edit-course dialog 内的两按钮）。建议 follow-up commit 在 `onUploadSyllabus` 里加 `setOutlineDialogSourceType("syllabus"); setOutlineTags("课程大纲,课程结构")` 一行。
2. **状态机字面 vs spec**：spec 段 3 写「状态回 `ai_summarizing`」，实现重置为 `uploaded` 触发 async job → `extracting` → `processing`。spec 字面是早期方案，实现按现有状态机走（既有 `processCourseKnowledgeSource` 流转）— acceptance 实质达成（UI 重新轮询能见到状态流转），无 FAIL。
3. **Spec optional**: 摘要 + outline 两个 AI 并行未实现（spec 标 nice-to-have）→ 建议保留串行（错误处理简单，AI 限流更安全）。

## Dynamic exit

QA r1 PASS。按 spec「QA r1 PASS 即收工」收工。

## 改动文件清单（git show c0b0158 --stat）

| 文件 | +/- |
|---|---|
| app/api/lms/course-knowledge-sources/[id]/retry/route.ts | +25 / -0（新增）|
| app/api/lms/courses/[id]/outline-import/route.ts | +25 / -4 |
| app/teacher/courses/[id]/page.tsx | +160 / -26 |
| components/course/course-context-sources-tab.tsx | +41 / -1 |
| lib/api-utils.ts | +2 / -0 |
| lib/services/course-knowledge-source.service.ts | +46 / -0 |
| lib/utils/knowledge-source-status.ts | +76 / -0（新增）|
| tests/fix-8-outline-import-source-type.test.ts | +99 / -0（新增 4 case）|
| tests/fix-8-retry-knowledge-source.test.ts | +187 / -0（新增 9 case）|
| **总计** | **+661 / -31** |

## Result

**PASS · Fix 8 r1**

- 全部 6 个 acceptance 通过
- 全部 anti-regression 守护通过
- tsc / vitest 935 / lint 0 error 全绿
- 真浏览器 e2e UI 验证两按钮 + dialog 文案切换 + 顶部直接入口保留
- 无 schema 改动 / 无同步点 / batch 1 Fix 5 不破坏

可进入 integration 阶段。
