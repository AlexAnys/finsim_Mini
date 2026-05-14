# QA Report — fix-M3b-ready-source-rescan (r1)

**Verdict**: PASS
**Commit SHA**: `07d774f`
**Worktree**: `finsim-wt-molly-fe` / branch `claude-fix-molly-frontend`
**Time**: 2026-05-14T00:16Z
**Spec acceptance**: 5/5

## 单 commit 锁定

```
fix(knowledge-source): allow retry/rescan on ready status with distinct label
 app/teacher/courses/[id]/page.tsx                | 10 ++++++---
 components/course/course-context-sources-tab.tsx |  7 ++++--
 lib/services/course-knowledge-source.service.ts  |  1 +
 lib/utils/knowledge-source-status.ts             |  5 +++++
 tests/fix-8-retry-knowledge-source.test.ts       | 27 +++++++++++++++++++-----
 5 files changed, 40 insertions(+), 10 deletions(-)
```

5 文件改动：
- `RETRYABLE_STATUSES` 加 `"ready"`（前端 utils + 服务层各加一处，前后端一致）
- 新 helper `knowledgeSourceRetryLabel`：ready → `"重新解析素材"`，其他 retryable → `"重新 AI 解析"`
- 两处 UI 消费方 `page.tsx` 和 `course-context-sources-tab.tsx` 切到新 label，ready 状态点击前 `window.confirm("重新解析将重新跑 AI，是否继续？")`
- 单测同步：`fix-8-retry-knowledge-source.test.ts` 把 "rejects ready" 改为 "re-enqueues a ready source"，新加 `knowledgeSourceRetryLabel` 单测

## Acceptance 逐项

### 1. Ready source 显示「重新解析素材」可点 ✅
真浏览器实测 (port 3001 --webpack chromium headless, molly@qq.com)：
- DB 直接 UPDATE Molly source 778e76c6 status='ready', error=NULL
- 进 `/teacher/courses/8f7f653c-9177-44f6-b764-80f7f779b2ef` → 「编辑课程」dialog
- `getByRole("button", { name: /^重新解析素材$/ })` 找到 1 个按钮，visible ✓
- 同时 `getByRole("button", { name: /^重新 AI 解析$/ }).count() === 0` ✓
- 截图 `.harness/screenshots/qa-m3b/03-rescan-button-visible.png`

### 2. Failed source 仍显示「重新 AI 解析」（regression） ✅
- DB UPDATE status='ai_summary_failed', error='QA M3b 临时错误测试用'
- 重新进 dialog 后 `重新 AI 解析` visible ✓
- `重新解析素材.count() === 0` ✓
- 截图 `.harness/screenshots/qa-m3b/05-failed-label.png`
- 证明 anti-regression: ai_summary_failed → 旧 label preserved

### 3. Ready retry confirm 弹出 + 接受 → POST /retry 200 + status=uploaded ✅
**3a 点击弹 confirm**（page.on("dialog") 捕获）：
  - dialog.message() = `"重新解析将重新跑 AI，是否继续？"` ✓
  - 完整匹配 spec 文案（`重新解析将重新跑 AI`, `是否继续`）
**3b 接受 confirm → POST /retry**：
  - URL: `/api/lms/course-knowledge-sources/778e76c6-0695-44f5-a11e-eb5cd38c695a/retry` POST
  - status 200 / body `{"success":true, "data":{...}}` ✓
  - Service 内部 `prisma.update {status:"uploaded", error:null} → enqueueAsyncJob` 路径已走通
  - DB 实测：retry 后 status 从 ready → uploaded → (async job 运行) → failed（因为这次 AI 又输出 invalid JSON；M1 backend fix 解决该问题，不在 M3b 范畴）
  - M3b 关心的是「retry 通道是否打开」，不关心 AI 是否成功（那是 M1 spec）
**3c 取消 confirm（test 1）→ 不发请求**：
  - dialog.dismiss() 后无 POST，UI 状态不变 ✓

### 4. tsc 0 / vitest / lint 全绿 ✅
- `npx tsc --noEmit`: 0 error
- `npx vitest run`: 82 files / **967 tests passed**（fix-8-retry-knowledge-source 从 9 → 10 tests，含新 retry-label 单测）
- 单测：
  - `re-enqueues a ready source for rescan (M3b)` PASS
  - `marks ai_summary_failed / failed / ocr_required / ready as retryable` PASS（ready 期望从 false 改 true）
  - `knowledgeSourceRetryLabel returns rescan label for ready and AI-parse label for others` PASS (4 cases)
- `npx eslint` on 4 改动文件：0 error 0 warn

### 5. Commit message 符合 spec ✅
spec: `fix(knowledge-source): allow retry/rescan on ready status with distinct label`
实际：完全一致。

## Anti-regression

### Batch 2 Fix 8 (commit 68a5c33) 上传 / 进度 / 重试
- Fix 8 的 retry 路由 + 入口仍在；M3b 仅在 service `RETRYABLE_STATUSES` 加一个 `ready`，UI 加 confirm + 切 label
- ai_summary_failed / failed / ocr_required 三种状态行为完全不变（无 confirm，label 仍「重新 AI 解析」）— 已实测 test 2 验证 ai_summary_failed 路径
- ✓ Fix 8 完整保留

### Batch 1 Fix 5 (commit 0c7f717) outline-apply mode=replace
- 无交集（M3b 不动 outline-apply 路由）
- ✓ 保留

### M2 (589ef56) + M3a (2df9d10)
- M3b 改的位置 (page.tsx L1599-1612, knowledge-source-status.ts) 与 M2 (L1993, L2052) + M3a (L2147-2168) 都不交叉
- ✓ 保留

### `KNOWLEDGE_SOURCE_NOT_RETRYABLE` 错误码
- 仍存在；processing/extracting/ocr_processing 等"正在跑"的状态 retry 仍被拒
- ✓ 边界保留

## DB / fixture

- M3b 测试中 DB 操作（全部 post-test 已恢复）：
  - test 1+3 前 UPDATE status='ready', error=NULL
  - test 2 前 UPDATE status='ai_summary_failed'
  - test 3 后 status 变 failed (async job 跑了 + AI 再次 JSON 解析失败 — 这是 M1 backend 的领域)
  - post-QA 最终恢复 Molly source 778e76c6 → status='ai_summary_failed' + error=原 spec line 16 的错误字符串

## 证据

- 截图：`.harness/screenshots/qa-m3b/01-06 *.png`
- Test spec: `tests/e2e/qa-m3b-ready-retry.spec.ts`
- 三个独立 test 各 PASS（避免 status 转换间互相干扰）
- 单测套件 fix-8-retry-knowledge-source 10/10 PASS

## Dynamic exit

r1 PASS → 收工。
