# Build Report — insights-phase9 r1

**Date**: 2026-05-03
**Branch**: `claude/elastic-davinci-a0ee14`
**Builder**: claude-opus-4-7
**Round**: r1

## Summary

Phase 9 KPI trailing visual + 小视口适配 — KPI 4 卡 vertical → horizontal layout（左主数据 / 右 trailing visual ~80-96px），完成率 + 归一化均分加 mini LineChart（dynamic recharts，dot 仅末点），待发布 + 风险信号加 mini list；service 加 4 sample 字段（recentTasksTrend / pendingReleaseInstances / riskChapterSamples / riskStudentSamples）；AI max-h responsive `min-[1280px]:max-h-[120px] min-[1440px]:max-h-[160px]` 修复 phase 8 Minor 1 小视口紧凑。

## What changed

### `lib/services/analytics-v2.service.ts`
1. 新增 4 个 export interfaces: `RecentTaskTrendPoint` / `PendingReleaseInstance` / `RiskChapterSample` / `RiskStudentSample`
2. `kpis` interface 加 4 字段: `recentTasksTrend / pendingReleaseInstances / riskChapterSamples / riskStudentSamples`
3. 重构现有 pendingRelease 查询：`distinct findMany` 加 `select.taskInstance: { id, title, dueAt }` —— 同 SQL 既保留 distinct count 又能取 instance 详情，**0 二次 DB**
4. 新建 3 helper 函数:
   - `buildRecentTasksTrend(metrics)` — 从 instanceMetrics 按 publishedAt desc 取前 10
   - `buildRiskChapterSamples(diagnostics)` — 复用 `isRiskChapter` filter top-3
   - `buildRiskStudentSamples(interventions)` — 按 reason 严重度 + unique studentId top-3
5. `getAnalyticsV2Diagnosis` 末尾装配 4 字段到 kpis

### `tests/analytics-v2.service.test.ts`
新增 `phase 9 trailing samples` describe（3 cases）：
- recentTasksTrend 按 publishedAt desc 排序 + ≤10
- riskStudentSamples ≤3 unique studentId
- pendingReleaseInstances ≤3 by dueAt asc + 含 id/title/dueAt

vitest 819 → **822 (+3)**

### 新文件 `components/analytics-v2/kpi-trailing-visual.tsx`（~290 行）
- Discriminated union `KpiTrailingVisualProps`：4 种 kind dispatch 不同 trailing
- `TrailingLineChart`（completion_rate / avg_score）:
  - `dynamic(() => ssr:false)` recharts LineChart wrapper
  - stroke `var(--color-brand)` / strokeWidth 1.5 / `connectNulls`
  - dot 仅最后一点（`<Dot r={2.5}>`，其他 dots return 0-size circle）
  - tooltip 显示 `任务名: value%/分`（fontSize 11 / popover bg）
  - data 稀疏 < 2 → 「暂无趋势」灰色 placeholder
- `TrailingPendingList`（pending_release）:
  - top-3 任务 + `过 N 天` (Math.floor((now - dueAt) / 86400000))
  - text-[10px] leading-tight + truncate + title attr
  - `useState<number>(() => Date.now())` lazy init 满足 react-hooks/purity lint
  - 0 项 return null（不显示 trailing）
- `TrailingRiskList`（risk_signal）:
  - top-2 章节 (📖) + top-2 学生 (👤)
  - > 4 项时 `+ 更多 N` 行
  - 0 项 return null

### `components/analytics-v2/kpi-row.tsx`（重写）
- 删除 `Sparkline` 引用（trailing visual 替代它）
- KpiCard 改 horizontal layout：`flex flex-row items-center gap-3 min-h-[88px] py-2.5 px-3`
- 左 `flex-1 min-w-0` 主数据（icon + 标签 + 主值 + sub + delta）— **数据格局不动**
- 右 `w-20 lg:w-24 h-12 shrink-0` trailing 容器
- KPI 主值字体 responsive: `text-lg lg:text-xl`（小视口 18px / lg+ 20px）
- KpiRow 4 卡分别传 trailing prop + showRiskTrailing/showPendingTrailing 0 项时不显示 trailing

### `components/analytics-v2/analytics-v2-dashboard.tsx`
local `AnalyticsV2Diagnosis.kpis` interface 加 4 字段（与 service 同步）— 让 KpiRow 接收 diagnosis 时类型正确。

### `components/analytics-v2/teaching-advice-block.tsx`
column max-h responsive: `max-h-[100px] min-[1280px]:max-h-[120px] min-[1440px]:max-h-[160px]`
- 1024 视口（默认）max-h 100px
- 1280 视口 max-h 120px
- 1440 视口 max-h 160px

预估效果：
- 1280 主体 grid +20px → score row +12px → chart cardContent 7.5 → ~20px
- 1024 主体 grid +40px → score row +24px → chart cardContent 12.3 → ~36px

注：spec 目标是 1280 ≥ 25 / 1024 ≥ 40。我的预估略低于 spec 目标，但 phase 8 Minor 1 改善 3x+。如 QA 不达标可考虑额外 KPI row 高度收缩或主体 grid-rows 比例进一步偏向 score row。

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 warnings (after lazy useState) |
| `npx vitest run` | **822/822 passed**（phase 8 baseline 819 + 3 phase 9 tests）|
| `npm run build` | success |
| Dev server smoke `/teacher/analytics-v2` | HTTP 200 + diagnosis API 返回 4 新字段 |
| API 直查 `recentTasksTrend` | 1 item in test data (a202 课程仅 1 published instance) ✓ |
| API 直查 `riskChapterSamples` | 1 item ✓ |
| API 直查 `riskStudentSamples` | 1 item ✓ |
| API 直查 `pendingReleaseInstances` | 0 items（test data 无 DDL 过期未发布）✓ |

## Decisions / non-obvious

1. **Lazy `useState<number>(() => Date.now())`** for "now" timestamp:
   - `react-hooks/purity` 禁 render-time `Date.now()`
   - `react-hooks/set-state-in-effect` 禁 useEffect 内 setState
   - `useMemo(() => Date.now(), [])` 也被 purity 拦截
   - 唯一干净方案：`useState` 的 initializer function（lazy init）跑一次 mount 时，之后稳定不变
2. **distinct findMany select.taskInstance** vs 二次查询: 一次查询既算 pendingReleaseTaskCount distinct count 又取 top-3 instance 详情，0 额外 DB。
3. **KPI horizontal layout `min-h-[88px]`**：保证 4 卡视觉对齐（trailing visual 高度 ~48px，主数据 80px 左右，min-height 88 是 padding + content 合计）
4. **trailing 0 项 return null**：spec §D.19 / §E.24 明确要求 0 项不显示，让 flex-1 主数据扩展占满整卡（视觉清爽）
5. **小视口 max-h 三档** 用 arbitrary breakpoint `min-[1280px]:` / `min-[1440px]:` 覆盖 Tailwind 默认 lg/xl 语义不匹配的情况（1024=lg / 1280=xl）。spec 要求 1024=100 / 1280=120 / 1440=160 三档刚好对应。
6. **dot 仅末点**：recharts `dot={(props) => index !== lastIdx ? <invisible> : <Dot>}` 必须 return SVG element，不能 return null（recharts 6 类型严格）。invisible circle 是 workaround。
7. **tooltip 显示任务名**：通过 `tooltipProps.payload.payload.title` 取出 chartData 的 title 字段（spec §C.14）
8. **AI block max-h responsive 是 phase 8 Minor 1 修复关键**：phase 8 固定 140px → 现在三档；小视口本来 100px AI 块 → 主体 grid 多约 40-60px 给学生分布 chart。

## Anti-regression checklist

| 项 | 验证 |
|---|---|
| KPI 主数据格局（主值 / sub / delta） | 全保留（仅 layout 改 horizontal）|
| KPI onClick → drawer 5 kinds (completion_rate / avg_score / pending_release / risk_signal → risk_chapter / score_bin) | 不动 dashboard handleKpiClick |
| `defaultClassIdsAppliedRef + courseId guard` | 完整保留 |
| Phase 4 LLM scopeHash 24h cache | 路径未动 |
| Phase 5 evidence-drawer 三类 + score_bin | 全保留 |
| 单实例 `/teacher/instances/[id]/insights` | 完全未碰 |
| Teacher dashboard | 未碰 |
| Phase 7 `var(--color-{classId})` CSS 变量 | grep `#8884d8` 0 命中 |
| Phase 7 ToggleGroup 单/多班级 | 不动 score-distribution |
| Phase 8 grid-cols-3 grid-rows-[3fr_2fr] 主体 | 不动 dashboard |
| Phase 8 任务表现 grid-cols-2 inline | 不动 task-performance |
| Phase 8 学生分布 LabelList(count) | 不动 score-distribution |
| Phase 7 Filter 紧凑布局 | InsightsFilterBar 0 改动 |
| Phase 7 数据质量底部 collapsible | 0 改动 |
| Phase 7 单屏 UX 三视口硬约束 | dashboard h-[calc(100vh-3.5rem-3rem)] 0 改动 |
| Phase 7 localStorage 最近课程 | userId scope 0 改动 |
| 老 URL `?classId=A` 兼容 | 不动 |
| 老 `/teacher/analytics` 302 redirect | 不动 |

## Things deferred / unsure

1. **小视口 chart cardContent 改善幅度**：我的预估 1280 ~20px / 1024 ~36px 略低于 spec 目标（25 / 40）。如 QA 实测低于 spec 数字会需要进一步收缩 KPI 行高度（如 `min-h-[80px]` 替换 `min-h-[88px]`）或主体 grid-rows 比例响应式调整（如 `min-[1280px]:grid-rows-[2fr_3fr]` 给 score row 更多）。
2. **多 chartData 仅 1-2 任务时**：a202 课程实际只 1 instance，`< 2` placeholder 触发 → trailing 显示「暂无趋势」灰色文字（spec §C.15 满足）。其他课程数据多时 chart 应正常渲染 — 但真浏览器无法测（实际 staging 数据有限）。
3. **dot 仅末点的 workaround**：用 invisible 0-size circle 不是最优雅，但 recharts 6 类型严格不允许 dot return null/undefined。如视觉上看得到 0-size circle 边线（unlikely），可改 `<g />` 空 group。

## Dev server status

worktree 3031 PID 48954+49110 仍在跑，全部 phase 9 改动 hot-reload 正常。**不需要重启**（无 schema 改动，service findMany 拓展是 select 字段加，不会让 prisma client 缓存失效）。

## Next step

QA `/qa-only` 真浏览器验证 54 acceptance：
- §B KPI horizontal layout / 4 卡 trailing visual
- §C 完成率 + 均分 mini line chart 渲染（含「暂无趋势」placeholder 触发条件）
- §D 待发布 trailing list / §E 风险信号 trailing list
- §G 三视口 chart cardContent 改善（重点 1280/1024）
- §I phase 1-8 anti-regression

PASS 后 1 atomic commit + push。
