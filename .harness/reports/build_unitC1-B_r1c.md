# Build Report · Unit C1-B · Round 1c (阅读视图 + 编辑切换)

> builder@instance-workbench · 2026-05-15
> Plan: `.harness/plans/unitC1-B_plan_r1c.md`
> 接续 r1b (commit `bb0667e`)。**C1-B 整 unit 完成。**

## 范围（r1c）

加阅读视图（read-only markdown 化展示）+ 编辑/阅读切换 button。默认 read；点「编辑」切 edit；点「完成阅读」切回 read；runTool 成功后自动 read。viewMode 持久化（per toolKey）。

## 改动文件

| 文件 | 改/新 | 净行 |
|---|---|---|
| `components/ai-assistant/result-atoms.tsx` | 改 | +135 / -10 |
| `components/ai-assistant/lesson-polish-result.tsx` | 改 | +14 / -2 |
| `components/ai-assistant/ideology-mining-result.tsx` | 改 | +79 / -25 |
| `components/ai-assistant/question-analysis-result.tsx` | 改 | +10 / -1 |
| `components/ai-assistant/exam-check-result.tsx` | 改 | +60 / -27 |
| `app/teacher/ai-assistant/page.tsx` | 改 | +36 / -8 |
| `lib/hooks/use-persisted-job.ts` | 改 | +5 / -1 |
| `tests/ai-assistant-result-views.test.ts` | 改 | +60 |

合计 +399 / -74 = +325 净。

## 实现要点

### `result-atoms.tsx`

- 新增 `ViewMode` 类型 + `ToolResultProps.viewMode` 必填字段
- 新增 read 原子：`ReadHeading(level)` / `ReadParagraph(text)` / `ReadBulletList(items, emptyText)`
- 现有原子全加 `viewMode` prop：`TitleAndSummary` / `SectionEditor` / `ActionItemsAndCautions` 各自内部根据 viewMode 分支渲染（read → reader 原子；edit → 原 input/textarea）
- `SectionEditor` read mode 使用 `stripTail` helper 去掉 label 尾部的「（一行一条）」（read mode 不需要写法提示）
- `FileReportsBlock` / `GradingTableBlock` 已是 readonly，两模式相同
- `linesFromText` / `fileStatusLabel` 保留不变

### 4 个 result 组件

- 都加 `viewMode` 解构 + 透传给 atoms
- `IdeologyMiningResult` read mode：育人目标用 `ReadBulletList`；需复核事项用 `ReadHeading + ReadBulletList`
- `ExamCheckResult` read mode：标题用 `<h2>`；总评用 `ReadParagraph`；sections `<details open={isRead}>` —— read 默认展开，edit 默认折起

### `app/teacher/ai-assistant/page.tsx`

- 新增 `viewMode` state（默认 `"read"`）
- 切回工具时从 cache hydrate `setViewMode(persisted.viewMode ?? "read")`（向后兼容）
- 写回 cache 时同步 viewMode
- runTool 成功后 `setViewMode("read")`（让教师第一眼看到整洁结果）
- 结果区 toolbar 新增「编辑」/「完成阅读」切换 button（lucide `Pencil` / `BookOpenCheck` 图标）
- `renderResultByTool` 签名加 `viewMode` 参数 → props 透传

### `lib/hooks/use-persisted-job.ts`

- 导出 `ViewMode` 类型
- `PersistedJobState` 加 `viewMode: ViewMode` 字段
- `DEFAULT_STATE.viewMode = "read"`
- `readEntry` 容错老 cache：`viewMode: parsed.viewMode === "edit" ? "edit" : "read"`（schemaVersion 不升，向后兼容）

## 自测结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（C1-B 文件） | 0 error |
| `npx tsc --noEmit`（全项目） | 6 pre-existing study-buddy 错误（同 r1a/r1b 报告） |
| `npx vitest run`（全 suite） | **86 files / 1013 tests PASS** / 0 regression（r1b baseline 1006 + r1c +7 = 1013）|
| `npx eslint <touched files>` | 0 error / 0 warning |

## Anti-regression

- AI output schema / AI prompt / `/api/ai/work-assistant` / `/api/async-jobs/[id]` / `async-job.service` 全 0 改动
- localStorage `schemaVersion` 不升级 → 老 cache 仍可读，缺 viewMode 字段时 fallback `"read"`
- r1b 4 工具差异化语义全部保留（顶部 callout / sections label 替换 / gradingTable 显隐 / examCheck 折叠）
- r1a localStorage 持久化基础全部保留（24h TTL / storage 事件 / 403/404 清缓存）
- A2 改动完全不交集（`instance-header.tsx` / `instances/[id]/page.tsx`）

## 关键决策

- **默认 read mode**：用户痛点是结果区像一堆 input field 体验奇怪 → 默认整洁阅读，按需切编辑
- **runTool 成功强制 read**：让教师第一眼看到结果，不被编辑控件干扰
- **viewMode per toolKey persist**：不同工具可独立保持各自的偏好模式
- **schemaVersion 不升**：保持向后兼容，老 cache 缺字段时 silent fallback "read"
- **不引入 markdown 渲染库**：纯 JSX 排版（`<h*>` / `<ul>` / `<li>` / `<table>`）够用，零依赖

## C1-B Unit 整体完成总结

| Round | Commit | 改动重点 |
|---|---|---|
| r1a | `918a5d7` | localStorage 持久化基础（hook + page 集成 + storage event + 24h TTL + 403/404 清缓存） |
| r1b | `bb0667e` | 4 工具差异化渲染（5 个 ai-assistant 组件 + page 重构） |
| r1c | （本 commit）| 阅读视图 + 编辑/阅读切换 |

总 vitest：**18 个 C1-B 相关测试**（7 hook + 18 result views 含 r1c 新增 7）
总改动行数：~432 (r1a) + ~605 (r1b) + ~325 (r1c) ≈ **1360 行 / 3 commit**

## 下一步

QA 验收 r1c。然后推进 Task #6 (B1) — AI 工作台合并。
