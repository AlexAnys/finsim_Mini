# Build Report — Fix 11 完成率 tooltip (r1)

**Builder**: claude opus 4.7 (worktree Z)
**Branch**: `claude-fix-batch2-error-data-polish`
**Commit**: `972dabd fix(dashboard): add completion-rate tooltip to clarify dashboard vs analytics-v2 metric scope`

## Problem (recap)

Source: Stream C 🟡 review_data_r1.md。
- Dashboard `computeCompletionRate` (`teacher-dashboard-transforms.ts:110`)：`Σ min(subs, classSize) / Σ (classSize × instance)` — 实测 11%
- Analytics-v2 (`analytics-v2.service.ts:676`)：`submittedStudents distinct / assignedStudents` — 实测 50%
- 两个口径都"对"但定义不同，老师跨页困惑。

按 coordinator 决策：**加 tooltip 显示口径**，不改算法（避免破坏老师已习惯的数字）。

## Changes

2 files, +73 / -6：

### 1. `components/teacher-dashboard/kpi-strip.tsx` — dashboard tooltip

- `KpiCellProps.sub` 类型从 `string` 改为 `React.ReactNode`，允许传入 JSX
- 新增 import：`Info` (lucide) + `Tooltip / TooltipTrigger / TooltipContent` (`@/components/ui/tooltip`)
- 「本周提交」KPI card 的 sub-text「完成率 X%」旁加 `Info` icon button，hover/focus 出 tooltip
- Tooltip 文案：
  > 完成率 = 各任务提交总数 ÷ 各任务应交总数（按班级人数 × 任务数累计）。
  > 本页与「数据洞察」口径不同：数据洞察按「至少提交一次的学生数 ÷ 应交学生数」。
- TooltipProvider 全局已在 `components/providers.tsx` 包了，无需新增

### 2. `components/analytics-v2/kpi-row.tsx` — analytics-v2 tooltip

- 新增 `KpiCardProps.labelTooltip?: React.ReactNode`（可选 prop，向后兼容）
- KpiCard label 区域新增条件渲染：`labelTooltip` 提供时，label 后挂一个 `Info` icon button（`stopPropagation` 防止误触发 KPI onClick）
- 「完成率」KpiCard 传入 labelTooltip：
  > 完成率 = 至少提交一次作业的学生数 ÷ 应交学生数。
  > 本页与「教师仪表盘」口径不同：仪表盘按「各任务提交总数 ÷ 各任务应交总数（按班级人数 × 任务数累计）」。
- 其他三个 KPI（归一化均分 / 成绩待发布 / 风险信号）未传 labelTooltip，行为不变

## Anti-regression

- ✅ **数字不变**：未触碰 `computeCompletionRate` 或 `analytics-v2.service.ts:676` `submittedStudents / assignedStudents`
- ✅ 不破坏 batch 1 Fix 1 (`dashboard` 学生数 sum) — `KpiStrip` 在教班级/学生数 sub-text 未动
- ✅ 不破坏 batch 1 Fix 2 (实时聚合) — analytics-v2 service 未动
- ✅ Analytics-v2 KPI click handler（onClick→onKpiClick）保留；tooltip icon 用 `stopPropagation` 防误触发
- ✅ Sub-text "完成率 X%" / "暂无提交" 文案保留，老师视觉差异最小

## Verification

- `npx tsc --noEmit` ：0 错
- `npx vitest run` ：78 files / 933 tests 全过（无回归）
- 手动 grep 确认 `computeCompletionRate` / `submittedStudents / assignedStudents` 仅在 tooltip 文案里被引用，算法未改动

## Acceptance Coverage（待 QA Playwright 实测）

1. hover dashboard `/teacher/dashboard` 完成率位置（"本周提交" KPI sub-text 旁 info icon）→ 中文 tooltip ✓ 代码逻辑确认
2. hover analytics-v2 (`/teacher/instances/[id]/analytics-v2` 或 course analytics-v2) 完成率 KPI 标题旁 info icon → 中文 tooltip ✓
3. 两个数字本身不变 ✓ 算法未改
4. tsc 0 / vitest 全过 ✓
5. Commit message 符合 spec 模板 ✓

## Open Questions / Notes

- Tooltip 用 `Info` icon button（accessible label "完成率口径说明" / "${label}口径说明"），键盘焦点可触发，符合 a11y
- QA 也可顺便验证 tooltip 点击不会误触发 KPI 卡片的 onClick（已 stopPropagation）
- 没加 unit test（项目无 React Testing Library，UI 测试走 Playwright）；Playwright 实测覆盖 acceptance #1/2

## Next

Fix 7 + Fix 9 + Fix 11 全部 build 完成，等 QA Fix 11 PASS 后向 team-lead 报告完工。
