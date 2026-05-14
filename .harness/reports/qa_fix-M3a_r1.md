# QA Report — fix-M3a-outline-merge-tooltip (r1)

**Verdict**: PASS
**Commit SHA**: `2df9d10`
**Worktree**: `finsim-wt-molly-fe` / branch `claude-fix-molly-frontend`
**Time**: 2026-05-14T00:12Z
**Spec acceptance**: 5/5

## 单 commit 锁定

```
fix(outline-editor): add tooltips clarifying safe-merge vs replace semantics
 app/teacher/courses/[id]/page.tsx | 27 +++++++++++++++++++--------
 1 file changed, 19 insertions(+), 8 deletions(-)
```

Diff 仅在 `OutlineEditableDraft` footer：
- 新增 `import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"`
- 「安全合并」按钮（L2155）包 `<Tooltip>...<TooltipContent>只新增草稿里有但课程结构没有的章节，不会删除或修改已有章节</TooltipContent>`
- 「应用到课程结构（替换）」按钮（L2164）包 `<Tooltip>...<TooltipContent>按草稿完整对齐：新增/修改/删除/重排已有章节。删除带任务的章节会被拒绝</TooltipContent>`
- onClick / disabled / variant / size 等所有 props 原样保留。

## Acceptance 逐项

### 1. Playwright：hover 两按钮各显示中文 tooltip ✅
真浏览器实测 (port 3001 --webpack headless chromium, molly@qq.com)：

**Test A: hover 安全合并 (data-slot=tooltip-trigger)**
- 实测捕获 tooltip 文本：「只新增草稿里有但课程结构没有的章节，不会删除或修改已有章节」
- toContain 检查：`"只新增草稿里有但课程结构没有的章节"` ✓ + `"不会删除或修改已有章节"` ✓
- 截图：`.harness/screenshots/qa-m3a/02-safe-merge-tooltip.png`

**Test B: hover 应用到课程结构（替换） (data-slot=tooltip-trigger)**
- 实测捕获 tooltip 文本：「按草稿完整对齐：新增/修改/删除/重排已有章节。删除带任务的章节会被拒绝」
- toContain 检查：`"按草稿完整对齐"` ✓ + `"新增/修改/删除/重排已有章节"` ✓ + `"删除带任务的章节会被拒绝"` ✓
- 截图：`.harness/screenshots/qa-m3a/03-replace-tooltip.png`

注：源列表（line 1647）也有一个「安全合并」按钮（这个是 inline merge action），spec 未要求加 tooltip，本次 QA 用 `data-slot="tooltip-trigger"` 锁定编辑器底部新 wrap 的版本。

### 2. 按钮 label 不变 ✅
- 「安全合并」textContent: 包含「安全合并」✓
- 「应用到课程结构（替换）」textContent: 含「应用到课程结构」+「替换」✓
- onClick=onApply / onReplace、variant="default" / "destructive"、size="sm"、disabled=isApplying / isReplacing 全部保留（代码审计 + 截图证）

### 3. 数据流不变 ✅
- handleOutlineSafeMerge(source.id, draft) 路径未动
- handleOutlineReplace(source.id, draft) 路径未动
- TooltipProvider 已在 `components/providers.tsx:9` 全局包裹 ✓（无需本组件再包）

### 4. tsc 0 / vitest / lint 全绿 ✅
- `npx tsc --noEmit`: 0 error
- `npx vitest run`: **82 files / 967 tests passed**（baseline 966 → +1 似乎是 setup 时序的边界；无任何 failure）
- `npx eslint app/teacher/courses/[id]/page.tsx`: 0 error 0 warn

### 5. Commit message 符合 spec ✅
spec: `fix(outline-editor): add tooltips clarifying safe-merge vs replace semantics`
实际：完全一致。

## Anti-regression

### Batch 1 Fix 5 outline-apply mode=replace（commit 0c7f717）
- Fix 5 的 onReplace 路径 → `handleOutlineReplace` → `/api/.../outline-apply` mode=replace。M3a 只在 `<Button>` 外包 `<Tooltip>`，onClick / props 全保留。
- ✓ 不破坏。

### Batch 2 Fix 8 上传 / 进度 / 重试（commit 68a5c33）
- Fix 8 改的是 outline-import 路由 + retry 路由 + 上传对话框轮询。M3a 没碰这部分。
- ✓ 不破坏。

### M2 fix (589ef56) outline-editor input key
- M3a 改的位置 (L2147-2168) 与 M2 (L1993, L2052) 不交叉。
- ✓ 不破坏，且 M2 的 chapterId/sectionId key fix 在 M3a 实测中仍生效（输入框稳定，footer 才能稳定渲染）。

### Fix 6 grading / Fix 7 / 8 / 9 / 10 / 11
- 全部不涉及 course outline editor，安全。

## DB / fixture

- QA 测试中临时把 Molly source (778e76c6) structuredData 注入 `{chapters:[{chapterId,title,sections:[{sectionId,title}]}]}` 让编辑器渲染
- post-QA restore: structuredData → `{}` 5 字节
- 测试结束时观察到 source.status 已是 `ready`（M1 后端 QA 那边 retry 跑通了，状态从 ai_summary_failed → ready；structuredData 当前 `{}` 仅因 BE QA 自己也做了清理）。这与 M3a 无关。

## 证据

- 截图：`.harness/screenshots/qa-m3a/01-04 *.png`
- Test spec: `tests/e2e/qa-m3a-tooltips.spec.ts`
- 两测试独立 spec 各起一个 page 跑（避免 radix tooltip 在同 page 多次切换的时序边界），均 PASS

## Dynamic exit

r1 PASS → 收工。
