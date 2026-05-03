# Build Report — insights-phase7 r1

**Date**: 2026-05-03
**Branch**: `claude/elastic-davinci-a0ee14`
**Builder**: claude-opus-4-7

## Summary

Phase 7 高密度单屏重设计 — 全量实现 §B Filter 紧凑化 + §C 单屏 UX + §D-§J 五区块 + 数据质量底部 + localStorage 最近课程。**未 commit**（按 spec atomic 4 commits 等 QA PASS 后批量执行）。

## What changed

### Service layer (lib/services/)
- **`analytics-v2.service.ts`**：
  - 新 `WeeklyMetricPoint` interface（weekStart / completionRate / avgNormalizedScore）
  - KPI 接口扩展：+ `pendingReleaseTaskCount` / `weeklyHistory` (12 周) / `previousWeekCompletionRate` / `previousWeekAvgScore`
  - `getAnalyticsV2Diagnosis` 内：
    - 新增 `prisma.submission.findMany({ ..., distinct: ["taskInstanceId"] })` 算 distinct task 数
    - 调用新的 `buildWeeklyHistory(metrics, now)` 复用 instanceMetrics（**不二次 DB 查询**）
  - 新函数 `buildWeeklyHistory`：UTC 周一为 weekStart，最近 12 周 + 缺失填 null
  - 新函数 `getWeekStartUtc(date)`：周一 00:00 UTC
  - 新 export `getScoreBinStudents(distribution, binLabel, classId?)`：按区间标签摘取学生
- **`scope-drilldown.service.ts`**：
  - 新 `ScoreBinStudent` interface
  - 新 export `getScoreBinStudents(scope, binLabel, classFilter?)`：通过 loadDiagnosis 后从 scoreDistribution 摘取，限 50 行

### API layer (app/api/lms/analytics-v2/)
- **`drilldown/route.ts`**：
  - `KINDS` set + `validationError` 描述加入 `score_bin`
  - switch case 新增 `score_bin`：读 `binLabel` 必选 + `binClassId` 可选 → `getScoreBinStudents`

### UI layer (components/analytics-v2/)
- **`analytics-v2-dashboard.tsx`** — 完整重写主容器：
  - 主容器 `flex flex-col h-[calc(100vh-var(--header-h,4rem)-1rem)] overflow-hidden`
  - H1 「数据洞察」+ 紧凑 filter 同一行（删除原顶部 banner）
  - localStorage 最近课程（`insights:last-course:${userId}` key）+ ref guard 防 stale
  - 主体 grid `flex-1 min-h-0 lg:grid-cols-3`：score-distribution / task-performance / study-buddy
  - AI 教学建议卡 shrink-0 占底部全宽
  - 数据质量提示 `DataQualityCollapsible` 移到底部 + 默认折叠（~50px）
  - `handleKpiClick(kind: KpiKind)` 把 `risk_signal` 映射到 `risk_chapter` drawer（用户从 drawer 内点章节/学生 link 切换）
  - `handleBinClick` + `handleViewAllScores` 触发 `score_bin` drawer
  - 删除 `DataQualityPanel` 顶部 banner

- **`insights-filter-bar.tsx`** — 紧凑化重写：
  - 课程 + 班级 multi-select + 章节 + 「详细筛选 ▾(N)」popover 单行 horizontal flex
  - Popover 480px 宽 含 4 个 dropdown（小节 / 任务 / 时间 + 课程在外面）+ scopeTags 当前范围 + 重置 / 后台重算
  - Badge 数字 = 已修改字段数（sectionId + taskInstanceId + range !== "term"）
  - 「更新于 MM/DD HH:mm」右侧 ml-auto

- **`kpi-row.tsx`** — 5 卡 → 4 卡：
  - 完成率 / 归一化均分 / 成绩待发布 / 风险信号合并
  - 前 2 卡：dynamic Sparkline + delta（formatPpDelta / formatScoreDelta）
  - 待发布：「N 项」+ 「涉及 X 个任务」+ 「去发布 →」link → /teacher/dashboard
  - 风险信号：bg-destructive/5 暖背景 + 「N 章节 \| M 学生」合并文案

- **`sparkline.tsx`** — **新建**：
  - dynamic LineChart + ResponsiveContainer + 32×80 默认尺寸
  - `connectNulls` 过 null gap，aria-hidden（装饰）

- **`score-distribution-chart.tsx`**：
  - 右上 ToggleGroup 单 / 多班级（localStorage 持久 `insights:score-distribution-mode`）
  - 单班级模式：单色 var(--color-brand) 柱，多班级：分组色循环
  - 5/10 段切换挪到 header 第二行（与 ToggleGroup 不挤占）
  - 「查看学生成绩详情 →」link 触发 score_bin drawer
  - 删除原下方 mini table
  - Card 内 `flex flex-col h-full overflow-hidden` + content overflow-y-auto

- **`task-performance-block.tsx`** — 删 sub-tabs：
  - 高分典型 / 低分共性 inline 同屏（border-l-2 border-success bg-success/5 / destructive 同款）
  - 区块级任务 dropdown（filter scope 内 simulation tasks）
  - 切到具体任务：filter highlights+issues + 「查看任务详情 →」单实例 insights link

- **`study-buddy-block.tsx`** — Accordion → Table：
  - 章节/节 | 典型问题 | 提问 三列
  - 每节 top-1 + 最多 5 行（spec 规定）
  - Row click → drawer `studybuddy_question`

- **`teaching-advice-block.tsx`** — 4 列横向：
  - 知识目标 / 教学方式 / 关注群体 / 接下来怎么教（**4 类全保留，不合并 nextSteps**）
  - 4 类色：brand / success / brand-violet / ochre
  - 每列 max-h-[240px] overflow-y-auto + 「依」可展开依据
  - 重新生成按钮 + LLM source label 保留

- **`risk-drawer.tsx`**：
  - `RiskDrawerKind` 加 `score_bin`
  - `score_bin` rendering case：Row + score badge + 单实例 insights link
  - labels (header/empty/description) 三个 Record 都补 `score_bin` entry

### Deleted
- `components/analytics-v2/insights-grid.tsx`（116 行）
- `components/analytics-v2/coming-soon.tsx`（21 行）— 4 个 block 内联 `EmptyPanel` helper 取代

### Tests
- `tests/analytics-v2.service.test.ts`：
  - 加 `submission.findMany` mock
  - 新 `phase 7 KPI extension` describe（3 cases）：weeklyHistory 12 长 + previousWeek delta / pendingReleaseTaskCount distinct 数 / null previous
  - 新 `getScoreBinStudents` describe（3 cases）：跨班级 / 单班级 filter / not found
- `tests/scope-drilldown.service.test.ts`：
  - 新 `getScoreBinStudents` describe（2 cases）：跨班级 / classFilter

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors / 0 warnings（修复了 2 个 unused import warning） |
| `npx vitest run` | **819/819 passed**（phase 6 baseline 811 + 8 新增 tests）|
| `npm run build` | success（route 数 / static / dynamic 不变） |
| Dev server smoke `/api/lms/analytics-v2/diagnosis` | 200 + 全部 4 个新 KPI 字段返回正确（teacher1 → 个人理财规划，weeklyHistory 12 长 + previousWeek 0.5/90） |
| Dev server smoke `/api/lms/analytics-v2/drilldown?kind=score_bin` | 200 + items 含 binLabel/score 字段 |

### Bundle size 影响
- recharts LineChart 已被引入（dynamic import + ssr false），不增加 initial bundle
- ToggleGroup shadcn 是已有 `radix-ui` 包子模块（现有依赖），无新 npm install
- 删除 InsightsGrid + ComingSoon 净减约 137 行

### Dev server 重启
**已重启** — `kill 88401 88363 25399` → `npm run dev -- -p 3031` 在 3031 上跑（PID 48954+49110），新的 `prisma.submission.findMany` 调用 + service helper 全部 hot-reload OK。recharts width(-1) dev-only warning 仍然存在（HANDOFF Minor 1，等用户决定是否深修）。

## Decisions / non-obvious

1. **风险信号 KPI click 落到 risk_chapter drawer（而不是同时打开两个）**：单一打开点更简洁；用户从 drawer header 看完章节后可手动从 KPI row 再点其他卡，或后续 phase 8 改为 sub-tab 切换 risk_chapter / risk_student。
2. **localStorage key 用 userId scope**：避免多账号在同一浏览器互相覆盖；session 不可用时（loading）暂不写入。
3. **localStorage 与 phase 1 race guard 协同**：先 set courseId（this useEffect ref），再触发 fetchDiagnosis（已有 effect），最后 defaultClassIdsAppliedRef 自动选全部班（phase 1 r2 修复）。三层 ref 互不冲突（lastCourseAppliedRef 仅在 mount 跑一次，defaultClassIdsAppliedRef 按 courseId 跑）。
4. **5/10 段下拉与 ToggleGroup 不挤一行**：5/10 段挪到 header 第二行 left（左对齐），「查看学生成绩详情 →」link 在右；ToggleGroup 在 header 第一行右上。两个互不干扰。
5. **占比 LabelList**：spec §F.34 说「实施时若视觉杂乱拿掉，不强制」 — 我未启用，柱状图保持简洁（多班级对比时容易拥挤）。
6. **TaskPerformance 区块级任务 dropdown 默认值**：default `""` 即「全部 simulation 任务」，用户主动选具体任务才 filter；切到具体任务后「查看任务详情 →」生效。
7. **Sparkline 防 dev-only width(-1) warning**：使用 ResponsiveContainer 100%/100% 在固定 width/height 容器内（32×80），避免 minHeight 警告
8. **`getScoreBinStudents` 在 service 层 + drilldown 层都 export**：service 层是 in-memory helper（重用 distribution 已计算结果），drilldown 层是面向 API（loadDiagnosis 后摘取，加 50 行限制）。
9. **不动 entity vs filter classIds 边界**：service 内 43+ 处 entity 字段（heatmap/intervention/instance/trend/growth）保持 `classId: string`，input 仍 `classIds?: string[]`。weeklyHistory 内部用周聚合，不改这条边界。

## Anti-regression checklist

| 项 | 验证 |
|---|---|
| Phase 1 `defaultClassIdsAppliedRef + courseId guard` | 完整保留（dashboard.tsx:485-510） |
| Phase 4 LLM scopeHash 24h cache | 路径未动（`/api/lms/analytics-v2/scope-insights`） |
| Phase 5 evidence-drawer 三类 | highlight/issue/studybuddy_question 全保留，新加 score_bin |
| 单实例 `/teacher/instances/[id]/insights` | 完全未碰 |
| Teacher dashboard | 未碰 |
| 老 URL `?classId=A` 兼容 | searchParams.getAll("classIds") + legacy fallback 完整保留 |
| 老 `/teacher/analytics` redirect | 未动 |
| Prisma schema | 未动（仅扩展 service 计算字段，零 schema 改动） |
| recharts 默认色泄漏 | grep `#8884d8` `#82ca9d` `#ffc658` 全仓 0 命中 |

## Things I'm unsure about / deferred

1. **DataQualityPanel 默认折叠 vs 展开**：spec §J.54 说「默认折叠」，我设为折叠。如果 QA 反馈用户更需要"看到一眼有多少 critical"，可改为初始展开 critical > 0 时。
2. **风险信号 KPI 卡 onClick 单一打开 vs 双卡**：spec §C.27 说「合并显示 + 点击查看详情」，未明确是否一次打开两个 drawer。我选择 risk_chapter（更高严重度通常）+ drawer 内可点章节查看，risk_student 学生通过 evidence 切换。如 QA 要求 sub-tabs，需改 RiskDrawer 加 sub-tabs UI（非阻塞）。
3. **LineChart Sparkline minHeight warning**：dev-only，prod build 正常。可加 `minWidth(0)` props 完全消，但需要测试 layout 不破。
4. **班级颜色 var(--color-{classId})**：score-distribution multi-mode 仍用此命名（保留 phase 2 fix）。如果 classId 是 UUID（如 `deedd844...`），`--color-deedd844-...` 这种 CSS 变量不会被定义，fallback 到 recharts 默认色 — 但实际我用的是从 chartConfig 注入 `--color-{key}`，应该有效。建议 QA 真浏览器验证多班级渲染时颜色正确。

## Next step

- 等 QA `/qa-only` 真浏览器验证（1440 / 1280 / 1024 三视口 + 各项 65 acceptance）
- QA PASS 后按 atomic 4 commits 顺序提交：
  1. service 扩展（analytics-v2.service.ts + scope-drilldown.service.ts + drilldown route + tests）
  2. KPI 4 卡 + Sparkline + ToggleGroup（kpi-row.tsx + sparkline.tsx + toggle-group.tsx + score-distribution-chart.tsx 的 ToggleGroup 部分）
  3. Filter 紧凑 + 主体 3 列单屏 + 3 区块改造（insights-filter-bar.tsx + dashboard.tsx + score-distribution-chart.tsx + task-performance-block.tsx + study-buddy-block.tsx）
  4. AI 4 列底部 + 数据质量底部 + 删 InsightsGrid + 删 coming-soon（teaching-advice-block.tsx + dashboard.tsx 收尾 + 文件删除 + risk-drawer.tsx score_bin case）
