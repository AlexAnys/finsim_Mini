# Build Report — Fix 8 大纲/题库拆入口 + 进度条 + 失败重试

- Worktree: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-outline-input`
- Branch: `claude-fix-batch2-outline-input`
- Commit: `c0b0158`
- Builder: builder-outline-input (Claude Opus 4.7 [1M])
- Round: r1

## Schema check（第一优先项）

**无 schema 改动，未触发同步点**。`CourseKnowledgeSource.status` / `sourceType` / `error` 字段已存在；status 流转（uploaded → extracting/ocr_processing/processing → ready / ai_summary_failed / failed / ocr_required）也已就位，本次仅消费现有状态机。

## 改动文件

| 文件 | 改动 |
|---|---|
| `app/api/lms/courses/[id]/outline-import/route.ts` | 加 `sourceType` 表单参数（默认 `syllabus` 向后兼容），白名单校验 `syllabus`/`question_bank`，按 sourceType 选默认标签（课程大纲/课程题库），无效值 → 中文 400 |
| `app/api/lms/course-knowledge-sources/[id]/retry/route.ts` (新增) | `POST` 端点，调用 `retryCourseKnowledgeSource` 重新排队 |
| `lib/services/course-knowledge-source.service.ts` | 新增 `retryCourseKnowledgeSource` — 鉴权 → 校验状态可重试（`ai_summary_failed`/`failed`/`ocr_required`）→ 重置 status=`uploaded`+清 error → `enqueueAsyncJob("knowledge_source_ingest")` |
| `lib/api-utils.ts` | 加 `KNOWLEDGE_SOURCE_NOT_RETRYABLE` → 400「该素材当前状态无法重新解析」中文映射 |
| `lib/utils/knowledge-source-status.ts` (新增) | 共享工具：`isKnowledgeSourceProcessing` / `isKnowledgeSourceRetryable` / `knowledgeSourceStatusLabel` / `knowledgeSourceProgressPercent` |
| `app/teacher/courses/[id]/page.tsx` | 编辑课程对话框 AI 大纲管理卡片：拆「上传大纲」+「上传题库」两个按钮；上传 dialog 由 `outlineDialogSourceType` 状态驱动文案/标签/上传 endpoint（syllabus → 现有 `/outline-import`；question_bank → 通用 `/api/lms/course-knowledge-sources` + sourceType 字段）；状态徽章用中文标签 + 处理中 2.5s 轮询 + 进度条；可重试状态显示「重新 AI 解析」按钮 |
| `components/course/course-context-sources-tab.tsx` | 教学上下文 Tab 每行加「重新 AI 解析」按钮（仅可重试状态显示） |
| `tests/fix-8-retry-knowledge-source.test.ts` (新增) | 9 单测：retry 边界（happy / 已 ready 拒绝 / 不存在 / 缺 filePath / failed 状态成功）+ 4 个 status 工具单测 |
| `tests/fix-8-outline-import-source-type.test.ts` (新增) | 4 单测：默认 syllabus 向后兼容 / question_bank 标签切换 / 无效 sourceType 400 / 缺文件 + question_bank 中文消息 |

## 实现要点

### 后端

1. `outline-import` 路由仍是 syllabus 默认入口。`sourceType` 允许传 `question_bank` 但 UI 改走 `/api/lms/course-knowledge-sources` 通用 POST（spec 指定），保留参数主要为 API 向后兼容 + 给将来其他客户端用。
2. 默认标签按 sourceType 分流：syllabus → `["课程大纲","课程结构"]`，question_bank → `["课程题库"]`，前端额外标签追加在后。
3. `retryCourseKnowledgeSource`：
   - `assertCourseAccess` 复用既有鉴权
   - 严格白名单：`ai_summary_failed`/`failed`/`ocr_required` 之外 → `KNOWLEDGE_SOURCE_NOT_RETRYABLE`
   - 缺 `filePath` 也 → `KNOWLEDGE_SOURCE_NOT_RETRYABLE`（防御性 — 历史脏数据）
   - 重置 `status="uploaded"` + `error=null`，重新走 `enqueueAsyncJob` 触发 `processCourseKnowledgeSource`（既有路径），不改业务流程
4. 状态机透明度：`processCourseKnowledgeSource` 已有的 `extracting`→`processing`→`ready/ai_summary_failed/failed/ocr_required` 流转完整保留，未触碰。

### 前端

1. AI 大纲管理卡片头部两按钮（替换原「继续上传」单按钮）：
   - 「上传大纲」→ 设 sourceType=`syllabus` + 默认标签「课程大纲,课程结构」
   - 「上传题库」→ 设 sourceType=`question_bank` + 默认标签「课程题库」
2. 上传对话框由 `outlineDialogSourceType` 状态切换标题/描述/标签提示，最终 endpoint 也按 sourceType 分流：
   - syllabus → 现有 `/api/lms/courses/${courseId}/outline-import`（不带 sourceType，走默认）
   - question_bank → `/api/lms/course-knowledge-sources` 通用 POST + `sourceType=question_bank`
3. 进度条：
   - 共享 util 给出 5 档百分比（uploaded 15% → extracting 35% → ocr_processing 50% → processing 70% → ready 100%）
   - 处理中显示水平进度条 + 中文阶段文字（如「AI 正在解析」「正在抽取文本」「OCR 识别中」）
   - 终态（ready/ai_summary_failed/failed/ocr_required）不显示进度条
4. 自动轮询：编辑课程 dialog 打开 + 存在处理中素材时，2.5s `setInterval` 调 `fetchCourseOutlineSources`（dialog 关闭或全部就位自动停）。`fetchCourseOutlineSources` 抽成 `useCallback` 满足 react-hooks/exhaustive-deps。
5. 重试按钮：可重试状态（ai_summary_failed/failed/ocr_required）才显示，loading 用 `Loader2`，成功 toast「已重新排队 AI 解析」后立即刷新。
6. `CourseOutlineSource` interface 扩 `sourceType` / `error` 字段（API 已返回），UI 在重试状态下显示 `error` 文本。

## 验证

- `npx tsc --noEmit` **0 error**
- `npx vitest run` **79 files / 935 tests 全 PASS**（含本次新增 13 个 case）
- `npm run lint` **0 error / 3 pre-existing warning**（quiz/sim/subjective runner，非本次改动）
- 手动浏览 dialog 内容：上传大纲 / 上传题库两个入口分别走对应分支（review_automation_r1.md 列出的问题路径修复）

## Acceptance（spec 列出）

| # | 验收项 | 实现 |
|---|---|---|
| 1 | syllabus 走 syllabus 解析 / 题库走独立路径 | UI 两按钮分别 set sourceType；后端 outline-import 默认 syllabus；UI 题库走 generic POST ✓ |
| 2 | UI 显示阶段进度文字 | 中文 status 标签（排队中/正在抽取文本/OCR 识别中/AI 正在解析/可用/AI 解析失败/处理失败/需 OCR）+ 5 档进度条 ✓ |
| 3 | AI 失败显示「重试」按钮 → 状态回 ai_summarizing | 「重新 AI 解析」按钮 POST retry → status 重置 uploaded → async job 触发 processCourseKnowledgeSource → 状态进入 extracting/processing ✓ |
| 4 | 向后兼容：outline-import 不带 sourceType → 仍按 syllabus 走 | 单测 `outline-import-source-type.test.ts:50` 验证默认 syllabus ✓ |
| 5 | tsc 0 / vitest 全过 | ✓（935 tests）|
| 6 | Commit | `fix(course-input): split syllabus/question-bank upload + progress + AI-fail retry` ✓ |

## Anti-regression（CLAUDE.md + spec）

- **regex 题库直抽 confidence=1.0 路径不变**：未触碰 `lib/services/question-bank.service.ts` / regex 抽取逻辑；question_bank 上传只走 `createAndProcessCourseKnowledgeSource` → `knowledge_source_ingest` 既有路径
- **ZIP/PDF/DOCX 文档解析分支保留**：未触碰 `document-ingestion.service.ts` / `extractDocumentText`
- **batch 1 Fix 5 outline-apply (preview/safe-merge/apply/replace/save-draft)**：未触碰 outline-apply 路由或 OutlineEditableDraft 组件
- **现有 outline-import 调用方**：仅 1 处（editor page）已同步更新，向后兼容（不传 sourceType 默认 syllabus）
- **Service interface**：`createAndProcessCourseKnowledgeSource` 已支持 `sourceType?: string | null`，无新增必填参数；新增 `retryCourseKnowledgeSource` 是 additive
- **中文 UI**：所有新增 toast / 按钮 / 状态标签 / 错误消息均简体中文
- **diff 行数**：662 加 / 30 减（含 2 测试文件 ~250 行），单逻辑模块未跨越 worktree

## 不涉及范围（spec optional）

- 摘要 + outline 两个 AI 调用并行（spec 标 nice-to-have）：本轮未做。两个 try/catch 当前是串行；并行需要重构 promise 结构，且未列入硬性 acceptance，留待后续优化。

## 同步点

无：不改 schema、不改其他 worktree 文件、未碰 batch 1 已 PR 文件。

## 待 QA 验证

按 spec Worktree Y 段 acceptance，由 qa-outline-input 在端口 3002 真浏览器跑：
- 传 syllabus 走 syllabus 解析（默认）/ 传题库走新独立路径（不再 AI outline 抽取）
- UI 显示阶段进度文字 + 进度条变化
- AI 失败后 UI 显示「重新 AI 解析」按钮 → 点击 → 状态回 ai_summarizing → 再走一遍（mock AI 返回非法 JSON / 故意触发 error 验证）
- 向后兼容：直接 curl 不带 sourceType 仍创建 syllabus
- tsc / vitest / lint 全绿（builder 端已通过）
