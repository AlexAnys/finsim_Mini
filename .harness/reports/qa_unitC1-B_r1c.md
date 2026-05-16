# QA Report · Unit C1-B · Round 1c (阅读视图 + 编辑切换) — Unit 收官

> qa@instance-workbench · 2026-05-15
> Build: `81a2bca feat(unit-C1-B): 阅读视图 + 编辑切换（r1c）`
> Plan: `.harness/plans/unitC1-B_plan_r1c.md`
> Build report: `.harness/reports/build_unitC1-B_r1c.md`
> 整 Unit C1-B 收官 QA（r1a + r1b + r1c 全过）

## Acceptance（r1c）

| # | Acceptance | Verdict | 证据 |
|---|---|---|---|
| 1 | `viewMode: "read" \| "edit"` 类型 + state 默认 "read" | **PASS** | hook `result-atoms.tsx:10` `export type ViewMode = "read" \| "edit"`；page.tsx:87 `useState<"read" \| "edit">("read")`；hook `use-persisted-job.ts:55-62` `export type ViewMode`+`PersistedJobState.viewMode: ViewMode` |
| 2 | 顶部"编辑"button + "完成阅读"button + Pencil/BookOpenCheck 图标 | **PASS** | page.tsx:499 `setViewMode((current) => (current === "read" ? "edit" : "read"))`；L504-505 Pencil + "编辑"；L509-510 BookOpenCheck + "完成阅读"；imports L6, L12 |
| 3 | `runTool` 成功后强制 read | **PASS** | page.tsx:248 `setViewMode("read")` 在 `setJob(json.data.job)` (L239) 之后 + `toast.success(已提交后台分析...)` (L240) 之前；vitest L170 regex 显式验证此顺序 |
| 4 | read 模式：Input/Textarea 换成 readable JSX 排版 | **PASS** | `result-atoms.tsx`：<br>① `ReadHeading` L43-58 渲染 `<h2/h3/h4>`<br>② `ReadParagraph` L60-67 渲染 `<p>` + whitespace-pre-wrap<br>③ `ReadBulletList` L69-86 渲染 `<ul list-disc>` + `<li>`<br>④ `TitleAndSummary` L133-145 read 分支：`<h2>` + ReadHeading + ReadParagraph<br>⑤ `SectionEditor` L196-222 read 分支：4 个 ReadHeading + ReadParagraph + 2 ReadBulletList<br>⑥ `ActionItemsAndCautions` L332-346 read 分支：2 ReadBulletList |
| 5 | edit 模式：r1b 行为保留 | **PASS** | 各原子 L146-164 / L223-277 / L348-373 的 else 分支保留原 Input/Textarea + Label；vitest 验证 readBranchCount ≥ 3 |
| 6 | viewMode 持久化到 localStorage | **PASS** | hook L57-62 `PersistedJobState.viewMode: ViewMode`；page.tsx:179 写回 cache 含 `viewMode`；page.tsx:182 useEffect deps 含 viewMode；page.tsx:114 hydrate `setViewMode(persisted.viewMode ?? "read")` |
| 7 | 老 cache 兼容（无 viewMode → "read"，schemaVersion 不升） | **PASS** | hook `readEntry:120` `viewMode: parsed.viewMode === "edit" ? "edit" : "read"` — 老 cache 缺字段时 `parsed.viewMode` 是 undefined，三元 else 分支返回 "read"。`SCHEMA_VERSION = 1` 不变（L69）— 老 cache 仍能通过 `safeParse` 校验。vitest L184 显式回归测试此行为。 |
| 8 | examCheck `<details>` read 默认展开，edit 默认折起 | **PASS** | `exam-check-result.tsx:24` `const isRead = viewMode === "read"`；L73-76 `<details ... open={isRead}>`；vitest L189 验证 `open={isRead}`。配合 r1b 原 `<details>` 折叠 chevron 旋转保留。 |
| 9 | ideologyMining read 模式育人目标用 bullet list | **PASS** | `ideology-mining-result.tsx`：① L25 `const isRead`；② L40-44 `<ReadBulletList items={result.actionItems} emptyText="（AI 未输出育人目标）"/>` 渲染 read 模式；③ L86-95 needs 复核事项 read 模式：`<ReadHeading> + <ReadBulletList>`；④ Lightbulb icon + brand-soft callout 边框保留 L35-39 |
| 10 | vitest 新增 ≥3 | **PASS** | `tests/ai-assistant-result-views.test.ts` 新增 **7 个 r1c 测试**（L146-204）：ViewMode 类型 + 3 原子 export / 双模式分支计数 / page state default + 切换 button + runTool 强制 read / renderResultByTool 透传 / hook PersistedJobState + DEFAULT + 老 cache 兼容 / examCheck open={isRead} / 4 组件接 viewMode |

## 自动化测试

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（全项目） | **0 new errors**；仅 6 pre-existing study-buddy（不变） |
| `npx vitest run tests/ai-assistant-result-views.test.ts` | ✅ **18/18 PASS** (7ms) — r1b 11 + r1c 7 |
| `npx vitest run`（全 suite） | ✅ **1013/1013 PASS, 86/86 files, 0 regression** |

## 改动范围

`git show 81a2bca --stat`：
```
.harness/plans/unitC1-B_plan_r1c.md                |  53 ++
.harness/progress.tsv                              |   2 +
app/teacher/ai-assistant/page.tsx                  |  +36 / -8
components/ai-assistant/result-atoms.tsx           |  +135 / -10
components/ai-assistant/lesson-polish-result.tsx   |  +14 / -2
components/ai-assistant/ideology-mining-result.tsx |  +79 / -25
components/ai-assistant/question-analysis-result.tsx | +10 / -1
components/ai-assistant/exam-check-result.tsx      |  +60 / -27
lib/hooks/use-persisted-job.ts                     |   +5 / -1
tests/ai-assistant-result-views.test.ts            |  +60 / 0
```
- 产线净增 +399 / -74 = +325 行（8 文件）
- 测试 +60（接续 r1b test file 添 r1c describe 块）
- 单 commit

## 关键 grep 证据

```bash
# viewMode 完整传递链
$ grep -n "viewMode" lib/hooks/use-persisted-job.ts components/ai-assistant/*.tsx app/teacher/ai-assistant/page.tsx | wc -l
65  # 65 处引用，从 hook 类型定义 → atoms 分支 → 4 result 组件 prop 透传 → page state + setter

# Pencil + BookOpenCheck 图标
$ grep -n "Pencil\|BookOpenCheck" app/teacher/ai-assistant/page.tsx
6:  BookOpenCheck,    # import
12: Pencil,           # import
59: icon: BookOpenCheck,  # examCheck 工具卡片
504: <Pencil ...> 编辑  # read mode toggle button
509: <BookOpenCheck ...> 完成阅读  # edit mode toggle button

# Read* 原子定义
$ grep -n "ReadHeading\|ReadParagraph\|ReadBulletList" components/ai-assistant/result-atoms.tsx
43: export function ReadHeading
60: export function ReadParagraph
69: export function ReadBulletList

# examCheck details open={isRead}
$ grep -n "open=\|open={" components/ai-assistant/exam-check-result.tsx
75: open={isRead}

# 老 cache 兼容（关键回归点）
$ grep -n 'viewMode.*"edit".*"read"' lib/hooks/use-persisted-job.ts
120: viewMode: parsed.viewMode === "edit" ? "edit" : "read",
# 老 cache parsed.viewMode === undefined → 三元 else → "read" ✅
```

## Finsim-specific 检查

| 维度 | 结果 |
|---|---|
| UI 中文文案 | ✅ "编辑" / "完成阅读" / "默认阅读模式；点「编辑」可直接修改。" / "（未命名）" / "（暂无）" / "（AI 未输出育人目标）" / "需复核事项" 全中文 |
| Route Handler 无业务逻辑 | ✅ 不动 |
| Auth | ✅ 不动 |
| Prisma / schema | ✅ 零 |
| 不动 `async-job.service.ts` | ✅ git diff 验证 |
| AI prompt | ✅ 0 改动 |
| schemaVersion 不升 | ✅ 老 cache 不破 |

## 实现稳健性

### 🟢 良好设计

1. **`stripTail` helper**：read mode 去掉 label 尾部的 "（一行一条）"，写法提示在 read mode 是噪音
2. **`isRead = viewMode === "read"` 局部 const**：减少重复，可读性高
3. **examCheck `<details open={isRead}>`**：JSX 表达式 binding，配合 r1b chevron 旋转自然
4. **`runTool` 成功后强制 read**：用户体验设计——结果第一眼整洁
5. **老 cache 三元兼容**：`parsed.viewMode === "edit" ? "edit" : "read"` 既覆盖 undefined（老 cache 无字段）也覆盖 null / 非法值 / 任何 truthy non-"edit"，全部 fallback "read"。**零 schema 升级 + 零破坏性**
6. **空数据降级 emptyText**：ReadBulletList / ReadParagraph 内置 "（暂无）" italic 灰字，read mode UX 一致
7. **`whitespace-pre-wrap`**：ReadParagraph 保留换行符 + 多空格，AI 输出 markdown-like 结构原样显示

### 🟡 不阻塞观察

1. **read mode `<h2>` heading 不可点击编辑**：用户必须点顶部"编辑"按钮整页切到 edit mode（设计选择，符合 plan "整洁阅读 + 按需编辑"）
2. **ideologyMining 育人目标 placeholder 仅 edit 模式可见**：read 模式空数据显示 emptyText（合理）
3. **vitest 仍是源 grep 测试** — 项目无 React testing-library。覆盖：类型/常量/原子 export 计数/分支计数/page 切换 regex/hook 老 cache regex。**未覆盖** runtime UI 交互（点击切换 button 真重渲染 / details 真折叠等）— **Final QA staging 阶段真浏览器必验**。

### 🟢 Anti-regression 验证

- r1a localStorage 持久化全保留（24h TTL / storage 事件 / 403/404 清缓存）— ✅ hook L67-211 0 改动除 `viewMode` 字段 + readEntry 兼容
- r1b 4 工具差异化语义全保留（顶部 callout / sections label 替换 / gradingTable 显隐 / examCheck 折叠）— ✅ 4 result 组件 read/edit 两模式都保留各自差异化
- AI output schema / `/api/ai/work-assistant` / `/api/async-jobs/[id]` / `async-job.service.ts` — ✅ 0 改动（grep 验证）
- A2 改动完全不交集

## Overall: **PASS**（r1c → Unit C1-B 整体收官）

10/10 acceptance 全 PASS，tsc 0 new error，vitest 1013/1013 全过 + 0 regression，三段 commit 全部 r1 即收。

## Unit C1-B 整体总结

| Round | Commit | Acceptance | Tests | Verdict |
|---|---|---|---|---|
| r1a | `918a5d7` | 8/8 | 7 | PASS |
| r1b | `bb0667e` | 8/8 | 11 | PASS |
| r1c | `81a2bca` | 10/10 | 18 (含 r1b 11 + r1c 7) | PASS |

**C1-B 总改动**：~1360 行 / 3 commit / 18 vitest 全新测试 / tsc 0 新 error / vitest 988→1013 (+25 净增)。

## Dynamic exit 触发

A2 + C1-B r1a + r1b + r1c = **连续 4 PASS**。可推进下一 unit。

## 建议 coordinator

1. **Task #8 标 completed**（C1-B 整 unit 完成 — 我会执行）
2. progress.tsv 追加 `C1-B-iw r1c PASS` 行
3. Final QA staging 阶段补充真浏览器验证：
   - 4 工具切换 + read/edit toggle 视觉切换
   - examCheck `<details open={isRead}>` 折叠实际行为
   - 老 cache 升级到 r1c：手动注入老格式 localStorage entry（无 viewMode 字段）→ 进 page → 看到默认 read 模式（验证 backward compat）
   - 跨 tab storage event 触发 viewMode 同步
4. PR 合并前确认 staging 实测通过
5. 派下一任务（A1 / B1 / B2 任一）— 此时 builder 应已在做 B1

我现在 idle 等指令。
