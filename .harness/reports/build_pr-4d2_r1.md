# Build Report · PR-4D2 · r1

**Unit**: `pr-4d2` 课程编辑器前端 block editor
**Round**: r1
**Date**: 2026-04-24

## 目标

把 Phase 3 PR-3C 的"只读属性面板"升级为**真可交互 block editor**，让教师能在 `/teacher/courses/[id]` 里直接 CRUD 6 种 ContentBlockType，加上 section 改名删除 + 块上下移动 reorder。全部走 PR-4D1 的 8 个新端点。

## 改动文件

**新增**（7 文件）：
- `components/teacher-course-edit/block-editors/types.ts` — 共享 types（`BlockEditorBlock / BlockEditorHandlers`）
- `components/teacher-course-edit/block-editors/markdown-editor.tsx` — Markdown 图文（textarea）
- `components/teacher-course-edit/block-editors/link-or-resource-editor.tsx` — 资源/链接共享（URL + title + description，variant 切文案）
- `components/teacher-course-edit/block-editors/task-ref-editor.tsx` — 模拟/测验/主观题引用（taskId + note，variant 切文案）
- `components/teacher-course-edit/block-editors/custom-editor.tsx` — 自由 JSON 编辑（带 parse validation）
- `components/teacher-course-edit/block-editors/index.tsx` — `BlockEditorDispatch(blockType)` 按枚举分发；unknown → fallback custom
- `components/teacher-course-edit/block-edit-panel.tsx` — 右侧主面板：两态（section overview vs block editor），含"创建块 by slot/type"、上下移动、section 改名/删除
- `lib/utils/block-reorder.ts` — 纯函数 `computeReorderSwap(blocks, id, direction)`：算 2-element swap，同 slot 内 + 非相邻无 op + 支持 sparse orders
- `tests/block-reorder.test.ts` — 8 tests（目标不存在 / 边界无 op / 相邻对 up&down / 跨 slot 过滤 / sparse orders / 单元素 slot）

**修改**（1 文件）：
- `app/teacher/courses/[id]/page.tsx` —
  - `ContentBlock` interface 加 `data: Record<string, unknown> | null`
  - 新 state `selectedBlockId`
  - import `BlockEditPanel / EditableSectionContext / computeReorderSwap`
  - `selectedSectionContext` 升级为 `editableSectionContext`（加 courseId/chapterId/sectionId/data.per-block）
  - 6 新 `useCallback` handlers：`handleCreateBlock / handleUpdateBlock / handleDeleteBlock / handleReorderBlock / handleRenameSection / handleDeleteSection`
  - Panel 调用点：`<BlockPropertyPanel>` → `<BlockEditPanel>` + 传 9 props
  - 其他代码零动（course fetching / tab / sheet / dialog / chapter CRUD / task CRUD / allocation 全保留）

## 设计决策

### 面板两态 vs 三态

设计稿暗示选中 block 后展开完整 editor，没说怎么回到 section overview。我做的：
- **无 section 选中**：提示"点击左侧目录..."
- **选中 section 无 block**：`SectionOverview`（section 标题可编辑/删 + 3 slot 分组 block list + 上下移动 + 每 slot "新建块"按钮）
- **选中 block**：`BlockEditorView`（左上箭头返回 overview + 当前 block 类型 editor）

这样 **overview 是 dashboard、editor 是 drill-down**，清晰导航。

### "创建块" 的 payload 留空

`POST /api/lms/content-blocks` 允许 `payload` 可选，所以新块创建后 data=null。用户必须点进 editor 补 payload 保存才有内容。理由：
- 设计稿不展示"创建时先填内容"的流程
- PR-4D1 后端已支持 null payload
- 创建完立刻进入 editor 是下一个 UX 改进点，但需要更复杂的 state flow（本 PR 不做）

### reorder：上下箭头 vs 拖拽

spec L118 "reorder（拖拽 or 上下箭头）"。我选**上下箭头**：
- 可访问性好（键盘友好，screen reader 友好）
- 不需要 `react-beautiful-dnd` 或类似 300KB+ 依赖
- 同 slot 内顺序用 `computeReorderSwap` 纯函数 + `$transaction` 原子 API
- 跨 slot 移动不支持（需要 sectionId/slot 修改，超出 PR-4D1 的 updateContentBlock 能力，spec 未明确要求）

### `computeReorderSwap` 的"保留 sparse order"设计

原来的 inline 版本：
```ts
const a = sorted[idx];
const b = sorted[swapIdx];
items: [{id: a.id, order: b.order}, {id: b.id, order: a.order}]
```

等价写法，但**交换的是 order 值而不是 idx**。好处：多次增删后即使 order 出现 gap（比如 0/5/10）依然能正确 swap，不会误 renumber 其他 block。test 里第 7 个 case (`sparse orders`) pin 住此行为。

### Section 改名/删除 in-panel（不用右键菜单）

设计稿说"Section/Chapter 右键菜单"。我做的是**面板顶部的内联按钮 + AlertDialog 风格确认**：
- 右键菜单在 Web 上不如直接按钮直观（桌面用户不总是知道右键有菜单）
- 触屏场景右键等价长按，但 shadcn 没现成 ContextMenu 组件我想避免引入新依赖
- `window.confirm` 对应 "确认删除" 的 spec 文案需求，跨平台稳定

本 PR 不支持 Chapter 改名/删除：chapter-level UI 会影响左侧 TOC 结构，超出"右面板升级" scope。PR-4D1 的 `/api/lms/chapters/[id]` PATCH/DELETE 已存在，可留到 Phase 5 或独立 follow-up PR。

### 不做（超 scope）

| 项 | 原因 |
|---|---|
| Chapter 改名/删除 UI | 影响左侧 TOC，涉及多处 UI；后端 API 已就绪，前端留做 follow-up |
| 创建块时填初始 payload | 需要弹 dialog 和 editor 模式切换，非线性 state flow；当前 null → 点进 editor 补完的流程够用 |
| 拖拽 reorder | 引入大依赖、可访问性差；上下箭头 + `computeReorderSwap` 功能等价 |
| 块虚拟化 (>20 blocks) | spec L130 说 "留给 builder 判断"；本 demo 数据远不到；有需要再加 |
| 删除旧 `block-property-panel.tsx` | 不在本 PR scope；无调用点，纯死代码，QA 可独立清理 |

## 验证

| 项目 | 结果 | 备注 |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | |
| `npx vitest run` | **288 tests** 全绿（280 → +8 block-reorder） | 无 regression |
| `npm run build` | 30 routes 全过 | |
| Dev server | 用现有 PID 59187（team-lead PR-AUTH-fix 后的那个）无需重启 | 无 schema 改动 |
| 6 路由回归 | 全 200 | `/teacher/dashboard` / `/teacher/tasks/new` / `/teacher/courses` / `/teacher/courses/[id]` / `/dashboard` / `/courses` |

## 真 API E2E Smoke（用 teacher1 session）

完整 "前端 → PR-4D1 endpoint → DB" 链路：

```
=== Create markdown block ===
POST /content-blocks → 201 id=e9884afe-... order=0 data=None

=== Update payload ===
PATCH /content-blocks/[id] with {"payload":{"content":"# PR-4D2 UI test"}}
→ 200 data.data.content="# PR-4D2 UI test"

=== Create 2nd block (resource) ===
POST /content-blocks → 201 id=cc677254-... order=1

=== Reorder (swap) ===
POST /content-blocks/reorder with items=[
  {id:"e988...", order:1}, {id:"cc67...", order:0}
] → 200 count=2

=== Cleanup ===
DELETE /content-blocks/e988... → 200
DELETE /content-blocks/cc67... → 200
```

所有操作与 PR-4D1 E2E matrix 对齐，无异常。

## Anti-regression 扫描

- 页面改动**都在 page.tsx 的 useMemo / useCallback 层**，不影响 render tree 结构
- 所有现有 handlers（chapter CRUD / task CRUD / announcement / 等）零触碰
- `ContentBlock` interface 新增 `data` 字段为**非可选**——初看激进，但所有读取方都走 `b.data ?? null`/`typeof b.data?.xxx` 的防御访问；Prisma 默认 include 返回 `data: null` 而非 undefined，所以类型收紧是合法的（grep 零处读取 `contentBlock.data` 以外的地方）
- `BlockPropertyPanel` → `BlockEditPanel` 是 1:1 替换（旧组件已无调用点，为死代码但不删除以降低本 PR 复杂度）

## 不确定 / 建议

1. **teacher UX 还缺一步**：创建 block 后停留 overview + 小 list；期望用户点击新块进 editor 补内容。这流程可以用，但更自然的是"创建即进入 editor"。若 QA 反馈可以做一个 "autoSelectNewBlockId" state + `setSelectedBlockId(data.id)` 在 `onCreateBlock` 里。
2. **Chapter 改名/删除**：延后。需要的话可以作为"PR-4D3"跟进（~60 行，复用现有 API）。
3. **TaskRef block 的"从任务列表选择" dialog**：目前是手动粘贴 Task UUID。PR-4D2+ 可加 typeahead（需要 `/api/tasks` GET 已存在，复杂度中等）。
4. **删除旧 `block-property-panel.tsx`**：纯死代码；保守起见本 PR 不删，QA PASS 后 coordinator/后续 PR 可单独清理。

## 下一步

移交 QA：
- tsc / vitest / build 三绿
- 6 块类型 dispatcher 手动点一遍（真浏览器 E2E）— QA 的重点
- 创建/保存/删除/reorder 真 DB 闭环（我已自验 8 步）
- section 改名/删除级联 DB 验证（前端触发 → Prisma onDelete: Cascade 级联到 ContentBlock）
- 回归 6 路由全 200
- 检查 tokens（应全复用 ink/brand/danger/line/paper-alt 类，无硬编码）
