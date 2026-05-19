# Build Report — PR-15 builder-student-fixes r1

> Owner: builder-student-fixes · Branch: `claude-bugfix-pr15` · Base: `41f2564`
> Scope: bug 5 (dashboard 任务滚动) + bug 6 (评分页 P0)
> Plan: `.harness/plans/pr15_student-fixes_plan_r1.md` (approved)

## 完成总结

✅ bug 6 (P0) 三件事全修 — criterion CUID → name + transcript 气泡 + 移动端响应式
✅ bug 5 — 滚动容器 (max-h-60vh 移动 / max-h-500px 桌面) 替换折叠/查看全部链接
✅ 桌面 (1280) + 移动端 (375x667) 全 e2e 真浏览器 PASS 4/4 + 6 截图
✅ tsc / vitest / lint 全绿 (1110/1110 + 0 error)

## 改的文件

| 文件 | 修改 | 行数 |
|---|---|---|
| `lib/services/submission.service.ts` | `getSubmissions` include 扩展: `task` 改 select 模式纳入 `scoringCriteria{id,name,maxPoints,order}` (orderBy order asc) — 单 caller (`/api/submissions` GET) 透传到 client | +11/-1 |
| `lib/utils/grades-transforms.ts` | `GradeRow` 加 `scoringCriteria` + `transcript` 字段；`RawSubmissionLite.task.scoringCriteria` 类型；`joinSubmissions` 派生：透传 criteria + defensive filter transcript (role ∈ {student,ai} && text:string) | +49/-1 |
| `components/grades/evaluation-panel.tsx` | bug 6a: 建 `criterionNameMap`, rubric 标题用 `name ?? criterionId`；bug 6b: 加 transcript section (40 行 时间轴气泡，brand-soft 右 student / paper-alt 左 AI)；bug 6c: 分数区 `flex-col sm:flex-row`, padding `px-3 sm:px-5`, break-words, whitespace-pre-wrap | +57/-4 |
| `components/grades/grades-hero.tsx` | 移动端响应式：左卡 px/py 缩 (5→7) + 大数 40→52px；右卡 grid-cols-1 sm:grid-cols-3, hairline 改纵向 (border-t) + 各列大数 28→34px | +5/-5 |
| `components/grades/grades-tabs.tsx` | `flex-wrap`, 横向 padding px-3 sm:px-[18px]，"按提交时间降序" 文案 `hidden sm:block` (移动端隐藏给 tab 留宽) | +2/-2 |
| `components/grades/submission-row.tsx` | 移动端 grid-cols `[1fr_60px_36px]` (中右瘦化), padding px-3 sm:px-[18px] | +2/-2 |
| `components/dashboard/priority-tasks.tsx` | 撤销 Unit 14 折叠 + "查看全部"链接，改 `<div data-testid="priority-tasks-scroll" max-h-[60vh] md:max-h-[500px] overflow-y-auto pr-1>` 包裹所有任务 (无 .slice) | +9/-15 |
| `tests/grades-transforms.test.ts` | `makeRow` 默认值加 scoringCriteria/transcript；新增 6 个测试覆盖：scoringCriteria 透传 / 缺失 fallback / transcript 正常 / 过滤非法 role / 缺 text / 非数组 schema drift | +137/-0 |
| `tests/e2e/qa-pr15-student-grades.spec.ts` | **新增** 4 个真浏览器测试：桌面+移动端 grades 页 + 桌面+移动端 dashboard 滚动 | +205 |
| `.harness/plans/pr15_student-fixes_plan_r1.md` | **新增** 计划 | +110 |

总 diff: ~590 行 (实现 ~285 / 测试 ~342 / 文档 ~110), 远低于 1500 上限.

## 根因 + 修法

### bug 6a — 维度显示"原始 JSON 代码"

**根因**: `components/grades/evaluation-panel.tsx:237` 直接渲染 `r.criterionId`，该字段是 `ScoringCriterion.id` (CUID, 例如 `872e174b-f683-4f08-a2b0-9e6ddf79f461`)，不是友好中文 name。`getSubmissions` API include 只 select `task.{id,taskName,taskType}` 没拉 `scoringCriteria`，前端无 id→name 映射数据。

**修法 (root cause fix)**:
1. service `getSubmissions` include 扩展，task 字段下加 `scoringCriteria: { select: {id, name, maxPoints, order}, orderBy: {order: 'asc'} }`
2. transforms `joinSubmissions` 透传 criteria 到 `GradeRow.scoringCriteria`
3. panel 用 Map<id, name> 渲染：`criterionNameMap.get(r.criterionId) ?? r.criterionId` — fallback 回 ID 防 schema 漂移

不走 workaround (不绕过 API、不在 frontend 二次 fetch criteria)，全程一条数据链。

### bug 6b — 无对话历史

**根因**: 面板完全没渲染 transcript section, 而 `SimulationSubmission.transcript` Json 已在 `getSubmissions` include (`simulationSubmission: true`) 里, 数据在但 UI 没读。

**修法**:
1. transforms `joinSubmissions` 加 defensive filter: 只保留 `role ∈ {student, ai}` 且 `text: string` 的消息 (防 review_data_r1.md F-1 Json schema drift)
2. panel 加 transcript section: 只在 `isReleased && taskType === "simulation" && transcript?.length > 0` 时渲染时间轴气泡。student 右 brand-soft，AI 左 paper-alt
3. 注释含 `// TODO: PR-2 候选 B (lib/validators/transcript.schema.ts) 落地后用 schema.parse 替换 defensive filter` (按 team-lead 要求)

### bug 6c — 手机端无法显示

**根因**: 三处响应式断点缺失：
- `grades-hero.tsx` 右卡 `grid-cols-3 gap-0` 在 375 下三列挤
- `grades-tabs.tsx` 单行 flex + 文案 → 横向溢出
- `evaluation-panel.tsx` 分数区 `flex items-end` 在窄屏下分数 + progress bar 挤
- `submission-row.tsx` `grid-cols-[1fr_70px_90px]` 中右两列偏宽
- 多处 `whitespace-pre-wrap` + `break-words` 缺失导致长 comment 溢出

**修法**: 全部加 `sm:` 断点 (768px+)。375px 下: hero 右卡 stack 1 列 / tabs flex-wrap + 隐藏文案 / 分数区 flex-col / submission-row col 瘦化。

### bug 5 — 学生 dashboard 任务区可滚动

**根因**: `priority-tasks.tsx:165` `.slice(0,5)` + 下方 "查看全部 → /tasks" Link 是 Phase 4 Unit 14 的折叠设计 — 用户反馈希望全部任务可滚浏览, 不要再跳转到 /tasks。

**修法**: 撤销 Unit 14 折叠 — 删 .slice + 删"查看全部"Link, 任务行外加 `<div max-h-[60vh] md:max-h-[500px] overflow-y-auto pr-1>` 包裹。`data-testid="priority-tasks-scroll"` 让 e2e 可断言。

## 验证 (按 acceptance criteria 逐项)

### 通用
- ✅ `npx tsc --noEmit`: 0 new error (2 errors 在 `app/teacher/tasks/drafts/[id]/page.tsx` 是 builder-teacher-fixes 的 WIP, 不属我 scope, 已确认 `git stash` 验证为我提交的零错误)
- ✅ `npx vitest run`: 1110/1110 PASS (基线 1104 → +6 新测试, 0 regression)
- ✅ `npm run lint`: 0 error (33 pre-existing warnings 与本 PR 无关)
- ✅ 改动总和 ~590 行 (远低于 1500 上限)
- ✅ 无 schema 改动

### bug 5
- ✅ dashboard 任务区可纵向滚动 (`max-h-[60vh] md:max-h-[500px] overflow-y-auto`)
- ✅ 适配 < md (60vh of 667px = 400.2px max-h)
- ✅ 不破坏 AiBuddyCallout / KPI 卡 / 公告 (e2e 验证 KPI 仍可见)
- ✅ 真浏览器 desktop 1280 + mobile 375x667 全 PASS — scroll computed style `{overflowY: "auto", maxHeight: "500px"}` 桌面 / `400.2px` 移动

### bug 6 (P0)
- ✅ **6a**: 5/5 真实 criterion 中文名渲染 — 开场与建立信任 / 需求识别 / 风险偏好评估 / 沟通技巧 / 初步建议合理性 (CUID `872e174b...` 反向断言 not.toContain — PASS)
- ✅ **6b**: 桌面 + 移动端 transcript "完整对话记录" section 标题 + 气泡 PASS
- ✅ **6c**: 375x667 scrollWidth=375 == innerWidth=375 (`0` 横向溢出); 维度 + 对话仍清晰可读
- ✅ vitest: 6 新测试 — scoringCriteria 透传 (happy) / 缺失 fallback (edge) / transcript defensive filter (3 case schema drift) / 缺 transcript (edge)
- ✅ 桌面截图 `.harness/screenshots/pr15-student-fixes/desktop-{01-grades-list,02-rubric-detail,03-dashboard}.png` + 移动端 `mobile-{01-grades-top,02-transcript,03-dashboard}.png`

## E2E 真浏览器结果

```
✓ PR-15 bug 6 · 学生 /grades 评分页 (P0) › 桌面: 维度显示 name (非 CUID) + transcript 气泡 + 分数完整 (5.3s)
✓ PR-15 bug 6 · 学生 /grades 评分页 (P0) › 移动端 375x667: 完整显示 + 无横向溢出 + 维度 + 对话可读 (5.0s)
✓ PR-15 bug 5 · 学生 dashboard 任务区可滚动 › 桌面: priority-tasks 区有 overflow-y-auto + max-height 限制 (4.1s)
✓ PR-15 bug 5 · 学生 dashboard 任务区可滚动 › 移动端 375x667: priority-tasks 滚动容器仍有 max-height (4.2s)

4 passed (19.7s)
```

## 风险登记 + 不确定项

1. **`getSubmissions` payload 增量**: 每条 submission 透传 N ≤ 6 个 criteria record (~120 bytes each)，pageSize 100 时 ≤ 72 KB 增量。教师批阅列表未直接读 criteria 但会接收 (无害). 实测桌面 dashboard 加载流畅, 不构成性能 regression.
2. **transcript Json 无 Zod parse** (review_data_r1.md F-1): defensive filter 兜底处理 (只接受 role ∈ {student, ai} && text:string)；schema drift 时 silent drop 不破坏 UI，但有可能掩盖 writer 的字段漂移。已在代码加 `TODO: PR-2 候选 B (lib/validators/transcript.schema.ts)` 注释。
3. **`evaluation-panel` 不属于纯 logic — 没有 vitest 直接覆盖**: vitest 是 node env 不支持 jsdom render，UI render 逻辑全靠 e2e 真浏览器验。已经覆盖 (4/4 PASS)。
4. **alex@qq.com 是有真实数据的种子账户**：e2e 依赖该账户的具体 submission ID (25cf3504...) + 评分维度 (5 项)。若未来 seed 调整，e2e 命名查找会失败 — 但失败信号清晰 (criterion name 0 命中)，QA 易诊断。
5. **不需要 dev server 重启**: 本 PR 无 schema 改动，仅修 service include 字段 + 前端组件，HMR 已自动重载。e2e 通过验证服务正常工作。

## 不在范围 (deferred)

- bug 1/2/3/4 (teacher 端) — 由 builder-teacher-fixes 并行处理 (task #67)
- F-1 Json blob Zod parse (review_data_r1.md backlog) — PR-2 候选 B
- 优化 `getSubmissions` 含 `scoringCriteria` 后的教师 list 性能 (review_data_r1.md F-10 already 标注)
- AiBuddyCallout 在 dashboard 上的位置 / 显示 (acceptance 只要"不破坏"，已 e2e 验证 KPI 仍可见)

## 给 QA 的提醒

1. **桌面 + 移动端 375px 都必须真浏览器测过** — 已自测全 PASS，QA 复测建议同样跑 desktop + mobile
2. **bug 6a 关键断言**: 切到模拟 tab 后, 在评分明细看 criterion 名 — 期望中文 (开场与建立信任 等), 不应见 CUID (`xxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
3. **bug 6b 测试样本**: alex@qq.com sim 提交 `25cf3504-aedd-40a6-8bfa-47efdcab772a` (releasedAt 非 null, 5 维度 + 1 transcript msg). 也可用 student1@finsim.edu.cn 的 `1e4bcf48-...916b` (2 transcript msg + 3 维度)
4. **bug 5 dashboard**: alex@qq.com 有 17+ 任务，滚动效果明显
5. **dev server 不需要重启** (无 schema 改动). 但若 QA 重启了，加载页面应仍正常 — 已自测.

构建完成。
