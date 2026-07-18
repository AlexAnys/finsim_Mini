# QA Report — Fix 11 完成率 tooltip (r1) — PASS

**QA**: claude opus 4.7 (worktree Z, qa-errdata)
**Date**: 2026-05-13
**Branch**: `claude-fix-batch2-error-data-polish`
**Commit under test**: `972dabd fix(dashboard): add completion-rate tooltip to clarify dashboard vs analytics-v2 metric scope`
**Result**: ✅ PASS r1（按 dynamic exit r1 PASS 即收工）

## 1. 单 commit 锁定

`git show 972dabd --stat`：2 文件 +73 / -6
- `components/teacher-dashboard/kpi-strip.tsx` (+38 / -6)
- `components/analytics-v2/kpi-row.tsx` (+35 / 0)

无 schema 改动，无 service 改动，仅 UI 组件。`teacher-dashboard-transforms.ts` / `analytics-v2.service.ts` 未触及。

## 2. 代码 review（read-only）

### dashboard tooltip (`kpi-strip.tsx`)

- `KpiCellProps.sub` 类型 `string` → `React.ReactNode` 允许传 JSX（向下兼容：`"暂无提交"` 等 string sub 仍工作）
- 「本周提交」KPI sub-text 改为 `inline-flex` 包裹「完成率 X%」+ Info icon button
- Tooltip 用 `@/components/ui/tooltip` (Radix)，`TooltipProvider` 由 `components/providers.tsx` 全局已包
- aria-label "完成率口径说明" 满足 a11y
- 文案：`完成率 = 各任务提交总数 ÷ 各任务应交总数（按班级人数 × 任务数累计）。本页与「数据洞察」口径不同：数据洞察按「至少提交一次的学生数 ÷ 应交学生数」。`

### analytics-v2 tooltip (`kpi-row.tsx`)

- `KpiCardProps.labelTooltip?: React.ReactNode` 新增 optional prop（向下兼容：其他 3 个 KpiCard 不传 prop 行为不变）
- 「完成率」KpiCard label 旁加 Info icon button
- **关键**：`onClick={(e) => e.stopPropagation()}` 防止误触发 `KpiCard.onClick`（KPI 卡有 onClick 导航行为，spec line 222 不破坏要求）
- 文案：`完成率 = 至少提交一次作业的学生数 ÷ 应交学生数。本页与「教师仪表盘」口径不同：仪表盘按「各任务提交总数 ÷ 各任务应交总数（按班级人数 × 任务数累计）」。`

两个文案互相 cross-reference 对方页面，老师跨页一次就明白口径差异，不再误判。

## 3. Static checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx vitest run` | 78 files / **933 tests passed**（与 Fix 9 后基线一致，无回归） |
| `npm run lint` | 0 error / 3 pre-existing warning（quiz/sim/subjective runner useCallback，与 Fix 11 无关） |

## 4. Playwright 真浏览器实测（1440x900 chromium headless）

Dev server `PORT=3003 npm run dev -- --webpack` 已在跑。脚本 `/tmp/qa-fix-11-screenshots/*`。

### Acceptance 1: hover `/teacher/dashboard` 完成率 → Chinese tooltip

- ✅ Info 按钮 `aria-label="完成率口径说明"` 计数 = 1
- ✅ 完成率显示值 **11%**（与 batch 1 baseline + spec 一致）
- ✅ Hover Info icon → Radix tooltip 出现，`[role="tooltip"]` 内文：
  > 完成率 = 各任务提交总数 ÷ 各任务应交总数（按班级人数 × 任务数累计）。本页与「数据洞察」口径不同：数据洞察按「至少提交一次的学生数 ÷ 应交学生数」。
- ✅ Tooltip 含中文（`/[一-鿿]/`）✓ Formula A 关键词「各任务提交总数」「任务数累计」✓ 提及「数据洞察」对照

Screenshot: `/tmp/qa-fix-11-screenshots/02-dashboard-hover-info.png`

### Acceptance 2: hover `/teacher/analytics-v2` 完成率 → Chinese tooltip

- ✅ Info 按钮 `aria-label="完成率口径说明"` 计数 = 1
- ✅ 完成率显示值 **50%**（与 batch 1 baseline + spec 一致；URL 自动选 courseId=a202 / classIds 集合）
- ✅ Hover Info icon → Tooltip 内文：
  > 完成率 = 至少提交一次作业的学生数 ÷ 应交学生数。本页与「教师仪表盘」口径不同：仪表盘按「各任务提交总数 ÷ 各任务应交总数（按班级人数 × 任务数累计）」。
- ✅ Tooltip 含中文 ✓ Formula B 关键词「至少提交一次」「应交学生数」✓ 提及「教师仪表盘」对照

Screenshot: `/tmp/qa-fix-11-screenshots/04-analyticsv2-hover-info.png`

### Acceptance 3: 两个数字本身不变

- ✅ Dashboard 完成率 **11%**（spec line 205 baseline = 11%）
- ✅ Analytics-v2 完成率 **50%**（spec line 205 baseline = 50%）
- ✅ 算法未改动（grep 确认 `computeCompletionRate` / `submittedStudents/assignedStudents` 仅在 tooltip 文案中被引用）

### stopPropagation anti-regression

- ✅ 点击 analytics-v2 Info icon → URL 不变（urlBefore === urlAfter），证明 `e.stopPropagation()` 生效，未误触发 `KpiCard.onClick → onKpiClick`
- Screenshot: `/tmp/qa-fix-11-screenshots/05-analyticsv2-after-icon-click.png`

### Anti-regression: KPI strip 结构未破坏

- ✅ Dashboard 仍有「学生 / 班级 / 本周提交 / 完成率」全部 KPI label
- ✅ Analytics-v2 「归一化均分 / 成绩待发布 / 风险信号 / 完成率」其他 3 个 KpiCard 未传 labelTooltip 行为不变

## 5. DB 对账

`docker exec acc4fef29d82_finsim-postgres psql -U finsim -d finsim`：

```
Class           | students
金融2024A班     | 10
金融2024B班     | 2
Total students  | 12  ← 与 batch1 Fix1 baseline (student=12) 完全一致

Submissions   | TaskInstances | DistinctSubmitters
25            | 13            | 8
```

- batch 1 Fix 1（学生 sum=12）未回滚 ✓
- batch 1 Fix 2（13 instance live 聚合）未回滚 ✓
- 完成率 11%（dashboard 口径）/ 50%（analytics-v2 口径）算术上限来自这些底数，未被 Fix 11 改动

## 6. Anti-regression（CLAUDE.md + spec line 220-223）

- ✅ **数字不变**：`computeCompletionRate` (`teacher-dashboard-transforms.ts:102`) 未改；`analytics-v2.service.ts:676` 未改 → Dashboard 11% / Analytics-v2 50% 保持
- ✅ batch 1 Fix 1（学生数 sum=12）不破坏 — `KpiCell` 学生 KPI sub-text 不动
- ✅ batch 1 Fix 2（实时聚合 13 inst）不破坏 — analytics-v2 service 不动
- ✅ Analytics-v2 其他 KpiCard 3 个（归一化均分/成绩待发布/风险信号）不传 labelTooltip 行为不变
- ✅ analytics-v2 KpiCard.onClick 导航行为保留，tooltip icon stopPropagation 防误触
- ✅ Fix 7/9 commit (`d251a1e` / `d8ff071`) 文件域不重叠未被 Fix 11 改动
- ✅ Sub-text "完成率 X%" / "暂无提交" 文案保留，老师视觉差异最小

## 7. Conclusion

**Fix 11 r1 PASS**，4 项 acceptance + 7 项 anti-regression 全通过；tsc/vitest/lint 全绿；Playwright 5 测试 + DB 对账齐全。Tooltip 文案中文准确，cross-reference 设计清晰，对老师有解释性而非误导。Dynamic exit：r1 PASS 收工，不跑 r2。

---

# Worktree Z 总结（Fix 7 + 9 + 11 全 PASS）

| Fix | Commit | QA r1 | 关键证据 |
|---|---|---|---|
| 7 | `d251a1e` | PASS | NotFoundState + ForbiddenState 复用 / sim auth guard `getSession+redirect("/login")` / 3 截图 |
| 9 | `d8ff071` | PASS | 8 service throw 点 grep 实证 / 11/11 测试断言 / 933 tests pass |
| 11 | `972dabd` | PASS | Tooltip 真浏览器 hover Chinese 内文 ✓ / 数字 11% + 50% 与 baseline 一致 / DB 学生 12 不变 |

3 commits 按时序：`9267bb6 → d251a1e → d8ff071 → 972dabd`，cherry-pick 可串行无冲突。
