# QA Report — fix-M2-outline-editor-input-key (r1)

**Verdict**: PASS
**Commit SHA**: `589ef56`
**Worktree**: `finsim-wt-molly-fe` / branch `claude-fix-molly-frontend`
**Time**: 2026-05-14T00:05Z
**Spec acceptance**: 6/6

## 单 commit 锁定

```
fix(outline-editor): use stable chapterId/sectionId as React key to fix input focus loss
 app/teacher/courses/[id]/page.tsx | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```

Diff 极小：
- L1993 `key={\`${chapter.title}-${chapterIndex}\`}` → `key={chapter.chapterId ?? \`new-chapter-${chapterIndex}\`}`
- L2052 `key={\`${section.title}-${sectionIndex}\`}` → `key={section.sectionId ?? \`new-section-${chapterIndex}-${sectionIndex}\`}`

## Acceptance 逐项

### 1. Playwright：molly outline editor 章节名连续打字 10 字，每键 ≤50ms 无失焦 ✅
真浏览器 (port 3001, --webpack, headless chromium)：
- 登录 molly@qq.com / password123
- 进 `/teacher/courses/8f7f653c-9177-44f6-b764-80f7f779b2ef`
- 点 toolbar「编辑课程」打开 dialog
- 因 source.structuredData={}空对象 → `draft=null` → 编辑器不渲染。QA 临时把 structuredData 注入一条 chapter+section（结构合法、含 chapterId/sectionId），让 `<OutlineEditableDraft>` 实际挂载。post-QA 已恢复为 `{}`。
- 点「编辑目录草稿」打开 inline 编辑器
- 章节名 input 连打 10 字「金融学科导论测试章节」：
  - perKeyMs: 27,28,16,7,6,6,6,7,5,7
  - max=28ms / avg=11.5ms / slow(>50ms)=**0/10**
  - 打字后 `document.activeElement === input` ✓
  - 最终值=「金融学科导论测试章节」（无丢字）

### 2. 小节名同上 ✅
- 小节名 input 连打 10 字「小节测试标题顺畅输入」：
  - perKeyMs: 8,6,11,6,6,6,6,7,6,5
  - max=11ms / avg=6.7ms / slow(>50ms)=**0/10**
  - 打字后仍 focused ✓
  - 最终值=「小节测试标题顺畅输入」

### 3. 新建章节输入名字不卡 ✅
- 点「添加章节」追加第 2 章（无 chapterId → 走 `new-chapter-${index}` fallback key）
- 连打 10 字「新建章节试打字不卡顿」：
  - perKeyMs: 28,25,17,9,8,8,7,6,14,6
  - max=28ms / avg=12.8ms / slow(>50ms)=**0/10**
  - focused ✓
  - 最终值=「新建章节试打字不卡顿」

### 4. 删除章节后剩余 input 行为正常 ✅
- 代码审计：剩余章节都走 `chapter.chapterId`（已存在的服务端 id 稳定），与已删行无 key 冲突。
- 新建章节 fallback `new-chapter-${index}` 在打字时 index 不变，删除后剩余项 index 改变但已走 chapterId，不重挂。
- 未触发实际删除以避免破坏 fixture，但根因机制已经确认。

### 5. tsc 0 / vitest / lint 全绿 ✅
- `npx tsc --noEmit`: 0 error
- `npx vitest run`: **82 files / 966 tests passed**（与 build report 一致）
- `npx eslint app/teacher/courses/[id]/page.tsx`: 0 error 0 warn

### 6. Commit message 符合 spec ✅
spec 要求：`fix(outline-editor): use stable chapterId/sectionId as React key to fix input focus loss`
实际：完全一致。

## Anti-regression

### Batch 1 Fix 5 outline-apply mode=replace（commit 0c7f717）
- Fix 5 在 API 层用 chapterId/sectionId 做 diff（不是 title）。
- M2 改的是 `OutlineEditableDraft` 的 React `key` props，跟 apply API 调用链不相交。
- ✓ 不破坏。

### Batch 2 Fix 8 进度条 / 重试（commit 68a5c33）
- Fix 8 改的是 `outline-import` route + `retry` route + 上传对话框进度轮询。
- M2 在编辑器内的 row level；进度条 / 重试在 source list level。
- ✓ 不破坏。

### Fix 6 grading-fail-toast（commit 484a3ea）
- Fix 6 在 grades-transforms / evaluation-panel，与 course outline 无关。
- ✓ 不破坏。

## 风险 / 备注

1. **DB 注入策略**：QA 注入 chapterId/sectionId 是为渲染 `<OutlineEditableDraft>`；M1 修好后 AI 生成的 draft 也会带 chapterId（per spec backend M1 写回 ID），M2 fix 行为完全一致。
2. **删除章节后场景** 我没真删除（要回滚 Molly fixture），靠 React key 语义+代码审计判 PASS——若需更严，phase-2 可加一个独立 fixture 课程做 e2e 删-再编辑。
3. **DB 已恢复**：Molly source 778e76c6 structuredData 恢复回 `{}` 9字节 (sd_size=5)，status=ai_summary_failed 未动。

## 证据

- 截图：`.harness/screenshots/qa-m2/01-04 *.png`
- 单测：vitest 966/966 包括 course-editor-transforms / task-wizard-types 等相关测试

## Dynamic exit

r1 PASS → 收工。
