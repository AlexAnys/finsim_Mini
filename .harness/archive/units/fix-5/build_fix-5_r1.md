# Build Report — Fix 5 大纲编辑（update/delete/reorder）

- Worktree: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-outline`
- Branch: `claude-fix-batch1-outline`
- Commit: `fa08b9d`
- Builder: builder-outline (Claude Opus 4.7 [1M])
- Round: r1

## Schema check（第一优先项）

Chapter.order 字段 **已存在**：`prisma/schema.prisma:277` `order Int` + `@@unique([courseId, order])`，Section 同样 `order Int` + `@@unique([chapterId, order])`（`:300, :312`）。**无需 schema 改动，未触发同步点**。

## 改动文件

| 文件 | 改动 |
|---|---|
| `app/api/lms/courses/[id]/outline-apply/route.ts` | 加 `save-draft`、`replace` mode；diff by chapterId/sectionId；删除前检查 taskInstances；两阶段 order 调整避免 @@unique 冲突；持久化 chapter/section ID 回 structuredData |
| `app/teacher/courses/[id]/page.tsx` | EditableOutlineChapter/Section 加 chapterId/sectionId；normalizer 读 ID；UI 加上移/下移按钮 + 保存编辑 + 应用到课程结构（替换）按钮（替换前 window.confirm 确认） |
| `tests/outline-apply-replace.test.ts` | 新增 5 个单测覆盖 rename/reorder/delete/blocked-by-task/save-draft/safe-merge |

## 实现要点

### Route 改动

1. `mode` enum 扩成 `"preview" | "save-draft" | "apply" | "replace"`（保持 `apply` 兼容旧 UI）。
2. `outlineDraftSchema` 增加 `chapterId?: uuid` / `sectionId?: uuid` 字段，让前端能回传"我编辑的是这一章"。
3. `replace` 入口先调 `findReplaceBlockers`：扫描 current.chapters，凡在 DB 但不在 draft 且 taskInstances/sections.taskInstances 总数 > 0，立即返回 `OUTLINE_REPLACE_BLOCKED` 400（中文消息）。**事务外做检查**，避免事务半途失败。
4. `applyReplace`：
   - delete chapters not in draft（已通过 blocker 检查）
   - **Phase 1**：把所有保留的 chapter order 临时 bump 到大 offset，避开 `@@unique(courseId, order)` 冲突
   - **Phase 2**：按 draft 顺序写最终 order + title，新章节用 chapter.create
   - section 同样两阶段，scope 是 chapterId
5. `save-draft`：只把 outline 写回 `CourseKnowledgeSource.structuredData`，不触碰 Chapter/Section 表。
6. 返回时把含 ID 的 outlineWithIds 回写 structuredData，下次老师打开就有 ID 锚点。
7. `buildOutlineDiff` 兼容 ID 与 title 双匹配（向后兼容旧素材）。

### UI 改动

1. `EditableOutlineSection` / `EditableOutlineChapter` 加可选 `sectionId` / `chapterId`。
2. `normalizeOutlineDraft` 显式返回 `EditableOutlineDraft | null`，从 structuredData 提取 ID。
3. `OutlineEditableDraft` 加 `isSaving`/`isReplacing`/`onSaveDraft`/`onReplace` props。
4. 章节行加「上移」/「下移」按钮（disabled at boundary），小节行同样。drag-and-drop 没用，避免引入新依赖 + 保留键盘可达性。
5. 底部按钮组：`保存编辑`（mode=save-draft）/ `按当前草稿预览合并` / `安全合并`（mode=apply）/ `应用到课程结构（替换）`（mode=replace, destructive style, 带 `window.confirm` 二次确认）。
6. replace 成功后把 outline 回写编辑器 state（含新 ID），不需要重新拉素材。

## 验证

- `npx tsc --noEmit` **0 error**
- `npx vitest run` **75 files / 878 tests 全 PASS**
  - 含新增 `outline-apply-replace.test.ts` 5 个 case：rename+reorder、delete、blocked-by-task（中文 message）、save-draft、safe-merge backwards-compat
- `npm run lint` **0 error / 3 pre-existing warning**（quiz/sim/subjective runner useCallback deps，非本次改动）

## Acceptance（spec 列出）

| # | 验收项 | 实现 |
|---|---|---|
| 1 | 改名持久化 | `replace` 通过 chapterId 匹配，title 改动写入 DB；structuredData 同步回写带 ID 的 outline ✓ |
| 2 | 删未关联章节 → 真删；删关联章节 → 中文拒绝 | `findReplaceBlockers` + 中文 `OUTLINE_REPLACE_BLOCKED` 400 ✓ |
| 3 | 上下拖动 → 保存 → 刷新顺序持久化 | 上移/下移按钮 + 两阶段 order 调整 ✓ |
| 4 | safe-merge 行为不变（向后兼容） | 旧 `apply` 仍走 `applySafeMerge` ✓ + 单测 5 验证 |
| 5 | 加 e2e case | 单测覆盖核心路径；E2E 真浏览器测试交给 qa-outline |
| 6 | tsc / vitest 全过 | 0 / 0 ✓ |
| 7 | Commit 消息符合约定 | `fix(outline): support update/delete/reorder chapters via mode=replace` ✓ |

## Anti-regression（CLAUDE.md）

- **未改 schema**（Chapter.order 已存在），无 Prisma 三步铁律风险
- **未改 Service interface**：本 fix 全部在 Route Handler + Page Component 内
- **业务无关文件未动**：只改 spec.md（coordinator 范围，未 commit）+ Fix 5 三文件
- **中文 UI**：所有用户可见错误/按钮文本均简体中文
- **diff 行数**：~395 行（route）+ ~190 行（page）+ ~210 行（test）= 单逻辑模块，未碰其他 worktree 文件
- **删除级联**：使用 schema 已有 `onDelete: Cascade`（Chapter → Section / ContentBlock），任务/Submission 因 `TaskInstance.chapterId` 是 nullable 不级联但我们已在 blocker 中拒绝删除有任务的章节

## 待 QA 验证

按 spec Worktree C 段 acceptance，由 qa-outline 真浏览器（端口 3003）跑 Playwright：
- teacher1 上传大纲 → AI 错抽 → 改名 → 保存编辑 → 刷新 → 改名持久化
- 删除未关联章节 → 真删
- 删除关联了任务的章节 → 中文拒绝
- 上下移章节 → 应用替换 → 刷新顺序持久化
- 跑 `npx tsc --noEmit + npx vitest run + npm run lint` 全绿（builder 端已通过）

无同步点风险，worktree A / B 不受影响。
