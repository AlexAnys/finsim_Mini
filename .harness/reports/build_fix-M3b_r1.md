# Build Report — fix-M3b-ready-source-rescan (r1)

**Worktree**: `finsim-wt-molly-fe`
**Branch**: `claude-fix-molly-frontend`
**Commit**: `07d774f`

## Root cause confirmed
1. `lib/utils/knowledge-source-status.ts:19` `RETRYABLE_STATUSES` 缺 `"ready"` → 前端 UI 在 ready 状态下不显示 retry 按钮。
2. `lib/services/course-knowledge-source.service.ts:322` 服务端本地 `RETRYABLE_STATUSES` 同样缺 `"ready"` → 即便前端绕过，POST /retry 会被拒。
3. molly 老师删了章节后想"重新解析素材"无入口。
4. spec 文案区分：ready → "重新解析素材"，failed/ocr_required/ai_summary_failed → "重新 AI 解析"。

## Fix

### `lib/utils/knowledge-source-status.ts`
- `RETRYABLE_STATUSES` 加 `"ready"`
- 新增 `knowledgeSourceRetryLabel(status)` helper：`ready → "重新解析素材"`，其他 → `"重新 AI 解析"`

### `lib/services/course-knowledge-source.service.ts`
- `retryCourseKnowledgeSource` 内的本地 `RETRYABLE_STATUSES` 加 `"ready"`

### `app/teacher/courses/[id]/page.tsx`
- import 加 `knowledgeSourceRetryLabel`
- `handleRetryKnowledgeSource(sourceId, currentStatus)`：ready 状态先 `window.confirm("重新解析将重新跑 AI，是否继续？")`，取消则不发请求
- 按钮文案改 `{knowledgeSourceRetryLabel(source.status)}`，onClick 传 status

### `components/course/course-context-sources-tab.tsx`
- import 加 `knowledgeSourceRetryLabel`
- `handleRetry(source)`：ready 状态先 confirm
- 按钮文案改 `{knowledgeSourceRetryLabel(source.status)}`

### `tests/fix-8-retry-knowledge-source.test.ts`
- 既有 `"rejects retry when status is already ready"` 改为 `"re-enqueues a ready source for rescan (M3b)"` 反映新行为
- `isKnowledgeSourceRetryable("ready")` 期望从 `false` 改 `true`
- 新加 `knowledgeSourceRetryLabel` 单测覆盖 4 种状态

## Self-tests
- `npx tsc --noEmit`: 0 error
- `npx vitest run`: 82 files / 967 tests passed（+1 新测，既有 9 → 10 tests in `fix-8-retry-knowledge-source`）
- `npm run lint -- --quiet`: 0 warning

## Anti-regression
- 不破坏既有 retry 路径：`ai_summary_failed / failed / ocr_required` 行为不变（label 仍 "重新 AI 解析"，无 confirm）
- 不破坏 batch 2 Fix 8 上传 / 进度 / 重试（同一 handleRetry 入口，仅条件加 confirm 分支）
- `processCourseKnowledgeSource` async-job 路径不动
- error code `KNOWLEDGE_SOURCE_NOT_RETRYABLE` 仍存在（处理 `processing / extracting` 等不可 retry 状态）
- 中文 UI 文案全部用 spec 原话

## Diff
```
 app/teacher/courses/[id]/page.tsx                |  10 +-
 components/course/course-context-sources-tab.tsx |   7 +-
 lib/services/course-knowledge-source.service.ts  |   1 +
 lib/utils/knowledge-source-status.ts             |   5 +
 tests/fix-8-retry-knowledge-source.test.ts       |  27 +++++++++++++++++--
 5 files changed, 40 insertions(+), 10 deletions(-)
```

## Acceptance mapping
1. ✅ Ready source 显示「重新解析素材」可点
2. ✅ Failed source 仍显示「重新 AI 解析」
3. ✅ Ready retry → confirm → POST /retry → service 把 status 改为 "uploaded" 并 enqueue async job
4. ✅ tsc 0 / vitest 全过 / lint clean
5. ✅ Commit message 匹配 spec
