# Plan — PR-15 builder-student-fixes r1

> Owner: builder-student-fixes · Branch: `claude-bugfix-pr15` (base = main `41f2564`)
> Scope: bug 5 (dashboard 任务滚动) + bug 6 (学生评分页 P0) — 共两 bug, 纯 UI + service include 增量, 无 schema 改动
> Sequencing: **bug 6 (P0) 先做, bug 5 后做** (按 spec 优先级)

## 根因分析

### bug 6a — 维度显示"原始 JSON 代码"

读完 `components/grades/evaluation-panel.tsx:237-238`:

```tsx
<span className="text-[12.5px] font-medium text-ink-2">
  {r.criterionId}    {/* ← BUG 在这里 */}
</span>
```

`rubricBreakdown[i].criterionId` 是数据库 `ScoringCriterion.id` (CUID, 例如 `cm5xyzabc...`), 不是友好名。grading.service.ts:152 / 576 写入时把 `c.id` 当 `criterionId` 写进 evaluation JSON, 真正的中文名在 `ScoringCriterion.name` 字段 (`schema.prisma` 表 ScoringCriterion line 8: `name String @db.VarChar(200)`).

对比 `components/simulation/evaluation-view.tsx:161-172` (sim 端) — 正确做法是 join `scoringCriteria.find(c => c.id === rb.criterionId)?.label`. 但 `/grades` 页拿到的 `getSubmissions` API include 里**没**包含 `task.scoringCriteria`, 所以学生看到的就是 CUID 字串, 像"代码".

### bug 6b — 无对话历史

`evaluation-panel.tsx` 完全没渲染 transcript section. `SimulationSubmission.transcript` (Json field on schema.prisma 表 SimulationSubmission) 已包含在 `getSubmissions` API include (`simulationSubmission: true`). 数据已在 grade row 上 (虽 GradeRow 接口当前没声明 transcript 字段, 但 raw item 上有), 只是 UI 没显示.

### bug 6c — 手机端无法显示

主页 `app/(student)/grades/page.tsx:195` 用 `grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]` — 已经默认单列, 这点 OK. 但:

- `components/grades/grades-hero.tsx:104` `grid-cols-3 gap-0` 在右卡里写死 3 列, 手机 (375px) 三列+左右 hairline + 各 px-4 → 总宽过窄, 大数 `text-[34px]` 溢出
- `components/grades/grades-tabs.tsx:25` `flex items-center gap-1` 4 tab + 右侧"按提交时间降序"在手机上水平溢出
- `submission-row.tsx:101` 用 `grid w-full grid-cols-[1fr_70px_90px]` — 1fr 中标题/课程/时间在 375px 下挤
- `evaluation-panel.tsx:148` 分数区 `flex items-end gap-3.5` — 分数 + progress bar 并排, 手机过窄
- 详情面板内 rubric/quiz 卡片在 < md 下用 `sm:grid-cols-2` 也都 OK

### bug 5 — dashboard 任务区滚动

`components/dashboard/priority-tasks.tsx:165` 用 `.slice(0, 5)` 折叠, 下方加"查看全部 → /tasks"链接. 改成内部滚动 — `<div class="max-h-[500px] overflow-y-auto space-y-2 pr-1">` 包住所有任务行, 不要 slice. 手机端给一个较小的 max-h (~ 60vh).

## 决策点回应

**1. transcript 显示**: **新写 read-only 显示**, 不复用 `components/simulation/evaluation-view.tsx`. 理由:
- `EvaluationView` 是 fullscreen runner-end 组件 (带 onSubmit/onRedo/onClose 等交互 props, 高度 100vh, ScrollArea + Card heavy)
- /grades 详情面板内嵌, 视觉需匹配 `evaluation-panel.tsx` 既有 design system (ochre/brand tokens, rounded-lg, text-[13px]). 直接新写一段时间轴气泡 (~ 40 行 JSX) 比改造 EvaluationView 接受可选只读模式更轻

**2. rubric 维度卡片**: **保留现状的纵向列表** (`evaluation-panel.tsx:225-289` 已经是纵向 + 进度条 + 颜色档位). 不需要改成 grid. 只需:
- 把 `r.criterionId` 替换为 `criterionMap.get(r.criterionId)?.name ?? r.criterionId` (fallback 仍显 ID 保护未来 schema 改动)
- 评分继续用进度条 (已经是) — 用户题面"评分用进度条还是数字"答: 两者都保留, ratio bar + `{score}/{maxScore}` 数字并列

**3. bug 5 max-height**: **`max-h-[500px]` (桌面) + `max-h-[60vh]` (< md)**. 不加 sticky filter. 理由:
- 60vh 在 375x667 viewport ~ 400px, 够显示 4-5 任务 + filter chip 仍可见在上
- sticky filter 在小卡片内 sticky 视觉杂乱, 而且 filter chip 已经在 section header, scroll 区只放任务行
- 桌面 500px 大约 6-7 任务一屏, 超出滚动

## 实现步骤

### Step 1 (bug 6 — P0 先做)

**S1.1** `lib/services/submission.service.ts` `getSubmissions` include 加 `task: { include: { scoringCriteria: ... } }` (替换现 `task: { select: {...} }`). 影响:
- 现状 select 只拉 `id/taskName/taskType` → 改 include 拉同样字段 + `scoringCriteria.{id, name, maxPoints, order}` (`orderBy: { order: "asc" }`)
- `getSubmissions` 只有 1 个 caller (`app/api/submissions/route.ts:110`), 透传到学生/教师, 不破坏
- payload 增量 — 每条 submission 多 N 个 criteria record (typical N ≤ 6 × 2 字段) → 单页 100 submissions 约 +几 KB, 可接受

**S1.2** `lib/utils/grades-transforms.ts`:
- `GradeRow` 加 `scoringCriteria: Array<{ id, name, maxPoints }> | null`, `transcript: TranscriptMessage[] | null`
- `joinSubmissions` 把 `s.task?.scoringCriteria` 派生到 row.scoringCriteria, 把 `s.simulationSubmission?.transcript` (Json[]) 派生到 row.transcript

**S1.3** `components/grades/evaluation-panel.tsx`:
- props 多收 `row.scoringCriteria` + `row.transcript` (实际从 `row` 取, 不改 props 签名)
- rubric 渲染时建 `criterionMap = new Map(scoringCriteria.map(c => [c.id, c.name]))`, 显示 `criterionMap.get(r.criterionId) ?? r.criterionId`
- 加 transcript section (only when `taskType === "simulation" && isReleased && transcript?.length > 0`):
  - 标题"完整对话记录"
  - student msg 右气泡 `bg-brand text-brand-fg rounded-2xl rounded-br-md`
  - ai msg 左气泡 `bg-paper-alt rounded-2xl rounded-bl-md`
  - 时间戳 toLocaleTimeString
- 响应式: 已用 `px-5 pb-5 pt-4` + `text-[13px]` 等 — 检查无横向溢出, 必要时 < md 缩小 padding (`px-3 md:px-5`)

**S1.4** `components/grades/grades-hero.tsx` 移动端响应式:
- 左卡 `px-7 py-6` → `px-5 py-5 md:px-7 md:py-6`
- 右卡 `grid-cols-3 gap-0` → `grid-cols-1 gap-3 md:grid-cols-3 md:gap-0`
- 各列分隔 `i === 0 ? "" : "border-l border-line-2"` 改 `i === 0 ? "" : "border-t border-line-2 md:border-l md:border-t-0"` (移动端纵向分隔上方 hairline)
- 大数 `text-[34px]` → `text-[28px] md:text-[34px]`

**S1.5** `components/grades/grades-tabs.tsx` flex 加 `flex-wrap`, 右侧排序文案 `ml-auto` 改 `ml-auto hidden sm:block`

**S1.6** `components/grades/submission-row.tsx` `grid-cols-[1fr_70px_90px]` → `grid-cols-[1fr_60px_70px] sm:grid-cols-[1fr_70px_90px]` (中右两列在手机端略瘦)

**S1.7** `components/grades/evaluation-panel.tsx` 分数区 (`mt-4 flex items-end gap-3.5 ...`):
- mobile: `flex-col items-stretch gap-2 sm:flex-row sm:items-end sm:gap-3.5`

**S1.8** 新增 vitest `tests/grades-evaluation-panel.test.tsx`:
- happy: rubricBreakdown 带 criterionId 渲染 → 通过 scoringCriteria map 显示 name (而非 id)
- edge: scoringCriteria 缺 (未找到 criterion) → fallback 显 criterionId
- happy: transcript 数组 → 渲染 N 个气泡 + role 区分
- edge: 非 simulation taskType → 不渲染 transcript section
- edge: !isReleased → 不渲染 transcript / rubric

**S1.9** 真浏览器 e2e (新增 `tests/e2e/qa-pr15-student-grades.spec.ts`):
- 桌面 (default 1280x720) student1 登录 → /grades → 选 alex 评过的 sim → 截图 → 验维度显示 name + 对话气泡 + 分数/进度条
- 手机 (375x667) 同上 → 截图 → 验完整加载 + 无横向溢出 + 维度/对话可读

### Step 2 (bug 5)

**S2.1** `components/dashboard/priority-tasks.tsx`:
- 删除 `.slice(0, 5)` 及"查看全部"链接 (Unit 14 折叠逻辑反向)
- 任务行外 wrapper 改 `<div class="max-h-[60vh] md:max-h-[500px] space-y-2 overflow-y-auto pr-1">`
- 注释更新: "Unit 14 → PR-15 bug 5: 可滚动列表, 不再折叠到 5"

**S2.2** vitest `tests/priority-tasks-scroll.test.tsx` (若 priority-tasks 已有测试则扩展):
- 给 7 任务 → 全部 render (不是 5)
- 验外层 wrapper 有 overflow-y-auto class (用 container 选择)

**S2.3** e2e: `qa-pr15-student-grades.spec.ts` 加 sub-section
- student1 dashboard → 验 priority-tasks 区有 overflow-y-auto + 滚动测试 (Playwright `evaluate(el => el.scrollHeight > el.clientHeight)`)
- 手机 375 视图 → 同上

### Step 3 — 验证

- `npx tsc --noEmit` 0 error
- `npx vitest run` 0 regression
- `npm run lint` 0 error
- 启 dev server + playwright headed 真跑 e2e
- 截图存 `.harness/screenshots/pr15-student-fixes/desktop-*.png` + `mobile-*.png`

## 风险

1. **`getSubmissions` include 加 `scoringCriteria` 影响教师 list 性能**: scoringCriteria 已索引 `(taskId, order)` 但 N+1 风险低 (Prisma include 走 join). pageSize ≤ 100, criteria 每 task ≤ 6, 增量 ≤ 600 records. 可接受.
2. **`transcript` Json 没 Zod parse** (review_data_r1.md F-1 同根): 学生页直接读 `transcript` 数组, 若 schema drift (mood enum 新增) 仍 render fine — 不显示 mood/hint 只显示 role+text+timestamp. 防御 fallback: `(transcript ?? []).filter(m => m && typeof m.text === "string" && (m.role === "student" || m.role === "ai"))`
3. **现 `evaluation-panel.tsx:237` 已 commit 在 main**: 改前用 grep 确认无其它读 criterionId 字符串文本. 已查无.
4. **bug 5 max-h-[60vh]**: 极端用户 ≥ 30 任务 (实际不太可能), 列表内部滚动比折叠更友好 — 真出问题再加 client-side 分页

## 文件清单

修改:
- `lib/services/submission.service.ts` (getSubmissions include +scoringCriteria)
- `lib/utils/grades-transforms.ts` (GradeRow + joinSubmissions)
- `components/grades/evaluation-panel.tsx` (criterionMap + transcript section + 响应式)
- `components/grades/grades-hero.tsx` (响应式)
- `components/grades/grades-tabs.tsx` (响应式)
- `components/grades/submission-row.tsx` (响应式)
- `components/dashboard/priority-tasks.tsx` (滚动 + 去 slice/Link)

新增:
- `tests/grades-evaluation-panel.test.tsx`
- `tests/priority-tasks-scroll.test.tsx`
- `tests/e2e/qa-pr15-student-grades.spec.ts`
- `.harness/screenshots/pr15-student-fixes/*.png`
- `.harness/reports/build_pr15_student-fixes_r1.md`

预计 diff ~600 行 (含测试 ~ 200, 实现 ~ 400), 远低于 1500 上限.

## 不在范围

- bug 1/2/3/4 (teacher scope, 由 builder-teacher-fixes)
- schema 改动 (本 PR 纯 UI/service include)
- F-1 Json Zod parse (review_data_r1.md backlog, 不是本 PR)
- adaptive masteryReport 已在面板上 render 不动
