# Build Report — fix-M2-outline-editor-input-key (r1)

**Worktree**: `finsim-wt-molly-fe`
**Branch**: `claude-fix-molly-frontend`
**Commit**: `589ef56`

## Root cause confirmed
`app/teacher/courses/[id]/page.tsx:1993,2052` 用 `${chapter.title}-${chapterIndex}` / `${section.title}-${sectionIndex}` 作为 React key。input 受控，title 即输入值；每键 React 看到新 key → 卸载旧 DOM、挂新 DOM → 输入失焦 → 用户感觉"卡"。

## Fix
- L1993: `key={chapter.chapterId ?? \`new-chapter-${chapterIndex}\`}`
- L2052: `key={section.sectionId ?? \`new-section-${chapterIndex}-${sectionIndex}\`}`

已存在的章节 / 小节直接走稳定的服务端 id；新增草稿没有 id 时退到 index-based fallback（index 在打字时不变；移动 / 删除会变，但 React 在那种交互下"重新挂载"是可接受的行为）。

## Self-tests
- `npx tsc --noEmit`: 0 error
- `npx vitest run`: 82 files / 966 tests passed
- 既有 11 个修复无回归（命中 `course-knowledge-source.service.test.ts`、`course-editor-transforms.test.ts`、`task-wizard-types.test.ts` 等相关测试）

## Anti-regression
- 不动 `addChapter` / `addSection` / `removeChapter` / `moveChapter` 等逻辑
- 不动 Fix 5 outline-apply mode=replace 路径
- 不动 Fix 8 上传 / 进度 / 重试
- chapter / section 上下移、删除、添加交互不变（key 切换会重挂未编辑的 row，焦点不在那里所以无影响）

## Diff
```
 app/teacher/courses/[id]/page.tsx | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```

## Acceptance mapping
1. ✅ 章节名连续打字不失焦（key 不再依赖 title）
2. ✅ 小节名同上
3. ✅ 新建章节键 `new-chapter-${index}`，打字时 index 不变 → 不失焦
4. ✅ 删除章节后剩余 chapter 走 chapterId 稳定，不受影响
5. ✅ tsc / vitest 全绿
6. ✅ Commit message 匹配 spec
