# Build Report — fix-M3a-outline-merge-tooltip (r1)

**Worktree**: `finsim-wt-molly-fe`
**Branch**: `claude-fix-molly-frontend`
**Commit**: `2df9d10`

## Root cause
`app/teacher/courses/[id]/page.tsx` OutlineDraftEditor 末尾两按钮「安全合并」/「应用到课程结构（替换）」无 tooltip，molly 老师不清楚区别。

## Fix
- 新增 import: `Tooltip, TooltipContent, TooltipTrigger` from `@/components/ui/tooltip`（TooltipProvider 已经在 `components/providers.tsx` 全局包裹）
- 两按钮用 `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip>` 包裹
- 文案严格按 spec：
  - 安全合并: "只新增草稿里有但课程结构没有的章节，不会删除或修改已有章节"
  - 应用到课程结构（替换）: "按草稿完整对齐：新增/修改/删除/重排已有章节。删除带任务的章节会被拒绝"

## Self-tests
- `npx tsc --noEmit`: 0 error
- `npx vitest run`: 82 files / 966 tests passed
- 既有 11 个修复无回归

## Anti-regression
- 按钮 label / onClick / disabled / variant 全部保留
- 数据流不变，无新依赖
- 不破坏 batch 1 Fix 5 outline-apply mode=replace
- 不破坏 batch 2 Fix 8 上传 / 进度 / 重试
- TooltipProvider 已经全局包裹（`components/providers.tsx:4` 已 import），不需在本组件再包

## Diff
```
 app/teacher/courses/[id]/page.tsx | 27 +++++++++++++++++++++------
 1 file changed, 19 insertions(+), 8 deletions(-)
```

## Acceptance mapping
1. ✅ hover 两按钮各显示中文 tooltip（radix-ui Tooltip）
2. ✅ 按钮 label 不变
3. ✅ 数据流不变（onApply/onReplace/disabled 保留）
4. ✅ tsc / vitest 全绿
5. ✅ Commit message 匹配 spec
