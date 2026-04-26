# Build Report — PR-DASH-1d r1

**Unit**: pr-dash-1d (Phase 8 · 教师工作台 B7 班级表现重做)
**Round**: r1
**Author**: builder
**Status**: ready for QA

## Scope

教师工作台 B7：班级表现加课程 filter；选中课程后图变多线对比 + grouped 柱；默认（全部课程）保持原聚合单线 + 单柱。

> 用户原话：「班级表现这里是可以 filter 课堂的（不需要 filter 班级），下面图中可以显示某个课的不同班级图进行对比，比如两个折线 + 两个柱状图（两个班级的话）」

## Files changed

| 路径 | 类型 | 说明 |
|---|---|---|
| `lib/utils/teacher-dashboard-transforms.ts` | edit | +213 行：新增 `buildPerformanceCourseOptions` / `buildCourseClassPerformance` / `buildCourseClassWeeklyTrend` 三个纯函数 + 2 类型 (`CourseClassPerformanceRow` / `CourseClassWeeklyTrendSeries`) + `PerformanceCourseOption`。完全 additive，老 `buildClassPerformance` / `buildWeeklyTrend` 不动 |
| `components/teacher-dashboard/performance-chart.tsx` | rewrite | 220 → 462 行；保留 props 兼容（`overallAvg/overallDelta/classes/weeklyTrend` 仍存在），新增 5 props（`courseOptions/courseClasses/courseClassWeekly/selectedCourseId/onCourseChange`）；header 加 Select + 时间维度 radiogroup 重构；正文双模式：`isMulti = selectedCourseId != null && courseClassWeekly.length > 0` 决定走多班对比还是聚合视图 |
| `app/teacher/dashboard/page.tsx` | edit | +44 行：新增 `performanceCourseId` state + 3 个 useMemo（options / classes / weeklyTrend），传入 `<PerformanceChart>` |
| `tests/pr-dash-1d-text.test.ts` | create | 25 新 test：8 UI guard + 5 transforms 守护 + 5 dashboard wiring + 7 行为单测（含跨课不混合、null avgScore 保留、空入参守护） |

**未触碰**：
- `app/api/**` 全部
- `prisma/schema.prisma` 零改
- `lib/services/dashboard.service.ts` 零改 — 既有 include 已有 `class.id/name/_count` 和 `course.id/courseTitle`，刚好够用，无需 additive include（spec 留了余地，但不需要）
- 其他 dashboard 子组件（attention-list / weak-instances / kpi-strip / today-schedule / activity-feed / ai-suggest-callout / greeting-header）零改
- simulation/quiz/subjective runner 零改

## 数据流（关键决策）

`buildCourseClassWeeklyTrend` 不依赖 service 层加 `taskInstance.classId` include。改用 transforms 层自查：从 `taskInstances` 建 `Map<taskInstanceId, { classId, className }>`，然后 `submission.taskInstanceId` 反查得到 class。这样：

- 无 schema 改动 → 无 Prisma 三步
- 无 service 改动 → 无回归担心
- 调用契约变了：`buildCourseClassWeeklyTrend(taskInstances, submissions, courseId, now?, windowWeeks?)`

如果未来 submissions 列表不再来自 dashboard summary（即 instance 信息不全），可加 service include。当前 spec 范围内不需要。

## Verification

### tsc + lint + tests + build

```
npx tsc --noEmit                 → 0 errors
npm run lint                     → 0 errors / 21 warnings (all pre-existing)
npx vitest run                   → 560/560 PASS (was 466 baseline; +25 new in pr-dash-1d-text.test.ts; +69 from intermediate PRs since last harness checkpoint)
npm run build                    → ✓ Compiled successfully in 5.2s; 25 routes
```

### 真 E2E（dev preview）

- `curl -L http://localhost:3000/teacher/dashboard` → 200, 42850 bytes (loading SSR + 王教授 hydrated client)
- `GET /api/lms/dashboard/summary` (cookie auth) → 200, 27450 bytes; success=true; 11 taskInstances; teacher1 真课程 (e6fc049c.. 个人理财规划 / 940bbe23.. 个人理财规划)
- 服务于 dev 的 chunk `_fa6448f5._.js` grep 命中 16 项关键标识/文案：
  - 函数名：`buildPerformanceCourseOptions` / `buildCourseClassPerformance` / `buildCourseClassWeeklyTrend` / `buildMultiChart` / `getSeriesToken`
  - props：`courseOptions` / `courseClassWeekly` / `selectedCourseId` / `onCourseChange`
  - token：`fs-success` / `fs-warn` / `fs-info` / `fs-danger`
  - 中文文案：`全部课程` / `按课程筛选班级表现` / `班级表现` / `所选课程暂无班级表现数据`

### 25 新测试覆盖（tests/pr-dash-1d-text.test.ts）

- UI 守护 8：`班级表现` h2、Select+`全部课程`、`aria-label=按课程筛选班级表现`、时间维度 radiogroup（本周/本月/学期）、`平均得分趋势` + `8 周提交量 & 均分`、4 个 token 色（success/warn/info/danger）、`courseClassWeekly` 字段、聚合视图保留 `overallAvg != null ? .toFixed(1) : "—"` 三元表达式
- transforms 守护 5：3 个新函数 export + 2 接口 export + 老 `buildClassPerformance/buildWeeklyTrend` 仍 export
- dashboard wiring 5：3 个新 import + state/setter + 5 props 传入
- 行为单测 7：
  - `buildPerformanceCourseOptions`：dedup + 中文排序 + 排除无 class 的 instance
  - `buildCourseClassPerformance`：跨 instance 同班聚合均分、跨课不串、null avg 保留 row、空字符串 courseId 返回 []
  - `buildCourseClassWeeklyTrend`：每班一个 series，每个 series 8 桶、跨课提交不计入、空 courseId 守护、course 全无 class 守护

## 设计点

### 多班级图渲染策略（spec 改动 3）

- **折线**：每班一条线 + 不同 token 色（最多 5 班；超过用 fallback `--fs-ink-5`）；保留小圆 dot 起 surface fill
- **柱状**：grouped bars — 每周中心位 `weekIndex * step`，N 班柱并排，每柱宽 `groupWidth / classCount`，opacity 0.55 让多重叠时不糊
- **图例**：底部 chip 平铺，5 色圆点 + 班级名（最多 5 班；超过截断由 ".slice(0, 5)" 控制）
- **左侧聚合 → 班级行**：选中课程时左侧从"总均分大数字 + 4 班均分条"切换到"5 班均分对比条 + 班级 dot 标识"

### 聚合视图（默认 / 全部课程）

完全保留：
- 总均分 32px 数字 + Δ 较上周 chip
- top-4 班级均分条（i=0 success 色、其余 brand 色 + opacity 渐变）
- 单线趋势 + 单柱提交量
- 图例「班级均分 / 提交量」

## 不确定 / 已 deferred

- **种子数据每课只有 1 班** — `940bbe23..` 和 `e6fc049c..` 都仅挂 `deedd844..金融2024A班`。多班对比 UI 在真实多班课才能视觉验证。代码逻辑由 25 unit tests + 行为单测覆盖（"跨课不混合"、"每班一 series" 全 pass）。QA 想真看到多线效果可考虑 seed 加二班，但这超出 PR scope，建议留给真实数据
- **timeWindow state（本周/本月/学期）** — 当前仅 UI 切换，不影响数据筛选（与 PR-DASH-1c 之前相同行为）。原 spec 说「现有时间维度切换保留」未要求把 timeWindow 接到数据维度，留作后续 PR
- **tooltip / 悬停** — 多线图未加 tooltip（hover 显示班级 + 周 + 数值）。原图就没 tooltip，保持一致；若要加，建议独立 PR

## Dev server restart 需求

无。本 PR 不动 schema、不动 service、不动 Prisma client；纯组件 + 纯函数 + 一次 dashboard wiring。dev server 用 turbopack 自动热加载已经把新 chunk 推出去了（chunk grep 已确认）。

## Acceptance 对齐 spec

- [x] tsc 0 errors
- [x] lint 0 errors
- [x] vitest 560 PASS（spec 要求 535+）
- [x] build 25 routes（实测 25）
- [x] "班级表现" 标题保留（test 守护）
- [x] 课程 filter Select 命中（test 守护 + chunk grep 命中 `全部课程` / `按课程筛选班级表现`）
- [x] 选具体课后图变多线 + 多柱（代码路径 `isMulti` triggers + `buildMultiChart` + `barGroups`）
- [x] 默认（全部课程）保持原单线（代码路径走老 `buildChart` + 老 SVG 渲染保持 byte-equivalent）
- [x] 不破坏现有时间维度切换（`role="radiogroup"` + 3 button 保留 + 守护 test）

## 严禁改动复核

- [x] 无 `app/api/` 改动（git diff 空）
- [x] 无 `prisma/schema.prisma` 改动
- [x] 无 simulation/quiz/subjective runner 改动
- [x] 无 `attention-list / weak-instances / kpi-strip / today-schedule / activity-feed / ai-suggest-callout / greeting-header` 改动

## Commit / push

不提交，等 coordinator 批后由其推。本地 working tree 现状：

- M `lib/utils/teacher-dashboard-transforms.ts`
- M `components/teacher-dashboard/performance-chart.tsx`
- M `app/teacher/dashboard/page.tsx`
- A `tests/pr-dash-1d-text.test.ts`
- A `.harness/reports/build_pr-dash-1d_r1.md`
