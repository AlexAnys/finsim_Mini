# Build Report — insights-phase3 r1

**Builder**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Round**: r1

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 3 of 6: 删 8 Tabs + Heatmap + ActionList，落地 4 区块骨架。32 acceptance criteria。

## Files changed

| Status | File | Notes |
|---|---|---|
| M | [components/analytics-v2/analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) | **1377 → 632 行** (-749 / +4 = **net -745**)。删除：`<Tabs>` JSX + 8 TabsContent / Heatmap+ActionList 调用 / `<ScoreDistributionChart>` 直接调用（移入 InsightsGrid 区块 A）。删除函数：Heatmap, ActionList, OverviewTab, ChapterTab, InstanceTab, QuizTab, RubricTab, StudentInterventionTab, WeeklyInsightTab, InsightColumn, TrendsTab, TrendMetric, PlaceholderTab, ChartSkeleton, MetricBar, WeaknessBadges, TagList, EmptyInline, buildModeSplit, heatClass, clampProgress, isAbnormalMetric, actionMetric, insightBadgeVariant, insightSeverityLabel, formatPointChange, formatDate, formatRate, formatPercentNumber。删除常量：INTERVENTION_LABELS。删除 imports：`dynamic`, `ListChecks`, `CardHeader`, `CardTitle`, `Tabs/TabsContent/TabsList/TabsTrigger`, `Progress`。新增 import：`InsightsGrid`。 |
| A | [components/analytics-v2/insights-grid.tsx](components/analytics-v2/insights-grid.tsx) | 4 区块容器：`grid-cols-1 lg:grid-cols-2 gap-4`，A→B→C→D 顺序。区块 A = `<ScoreDistributionChart>`（dynamic ssr:false 包装，含 ChartSkeleton loader）。区块 B = `<TaskPerformanceBlock>`，C = `<StudyBuddyBlock>`，D = `<TeachingAdviceBlock>`。 |
| A | [components/analytics-v2/coming-soon.tsx](components/analytics-v2/coming-soon.tsx) | 共用空态：圆形 icon (size-12 rounded-full bg-muted/50) + 标题 + 描述，min-h-[280px] 居中。受 LucideIcon prop。 |
| A | [components/analytics-v2/task-performance-block.tsx](components/analytics-v2/task-performance-block.tsx) | 区块 B：`<Card rounded-lg>` → `<CardHeader>` Sparkles + 「任务表现典型例子」→ `<CardContent>` `<ComingSoon>` "下一阶段将基于学生真实回答抽取高分典型 3-4 例 + 低分常见问题 + 证据抽屉。" |
| A | [components/analytics-v2/study-buddy-block.tsx](components/analytics-v2/study-buddy-block.tsx) | 区块 C：MessageCircleQuestionMark + 「Study Buddy 共性问题」 → ComingSoon "下一阶段将按节聚合学生在学习过程中提出的共性问题（top-5 排序 + 提问学生列表）。" |
| A | [components/analytics-v2/teaching-advice-block.tsx](components/analytics-v2/teaching-advice-block.tsx) | 区块 D：Lightbulb + 「AI 教学建议」 → ComingSoon "下一阶段将基于上述统计 + 风险信号生成 4 类教学建议（知识目标 / 教学方式 / 关注群体 / 接下来怎么教），每条带依据。" |

也有 untracked：`.harness/spec.md` (M, coordinator 改) + `.harness/spec-insights-phase2-archive.md` (A, coordinator 写) — 不属本次代码改动。

## Verification matrix

| Check | Command | Result |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors / 0 warnings** |
| 单元测试 | `npx vitest run` | **782 / 782 passed** (66 files, 同 phase 2 baseline) |
| 生产构建 | `npm run build` | **成功** |
| dashboard.tsx 行数 | `wc -l` | **632** (< 800 目标 ✅) |
| dashboard.tsx 净删除 | `git diff --stat` | **-745 行** (≥ 500 目标 ✅) |
| `<Tabs>` 不再出现 | `grep -nE "<Tabs"` | **0 命中** |
| 8 个 Tab 函数定义 | `grep -nE "^function (OverviewTab\|ChapterTab\|InstanceTab\|QuizTab\|RubricTab\|StudentInterventionTab\|WeeklyInsightTab\|TrendsTab)"` | **0 命中** |
| Heatmap / ActionList | `grep -nE "^function (Heatmap\|ActionList)"` | **0 命中** |
| 默认色泄漏 | `grep -rn "#8884d8\|#82ca9d\|#ffc658\|#ff8042" components/ lib/` | **0 命中** |

### 老 URL 兼容（spec §E.23-25）

| URL | HTTP | 说明 |
|---|---|---|
| `/teacher/analytics-v2?tab=overview` | **200** | 未知 param 静默忽略 |
| `/teacher/analytics-v2?tab=quiz` | **200** | 同上 |
| `/teacher/analytics-v2?courseId=...&taskInstanceId=foo` | **200** | 老 URL 全字段仍工作 |

### 隔离（spec §F.26-27）

| Page | HTTP |
|---|---|
| `/teacher/instances/{id}/insights` | **200** |
| `/teacher/dashboard` | **200** |
| `/teacher/instances` | **200** |

### Anti-regression（spec §G.28-32）

- ✅ `defaultClassIdsAppliedRef` + `diagnosis.scope.courseId !== courseId` guard 完整保留 — line 353-376（与 phase 1+2 完全相同）
- ✅ entity vs filter classIds 边界（service 不动）
- ✅ recharts bar fill = `var(--color-{classId})` CSS 变量 — `score-distribution-chart.tsx:59-63` `var(--color-brand)` 等 5 个 token
- ✅ KPI 5 卡数字与 phase 2 一致（KpiRow 不动）
- ✅ Diagnosis API 仍返回完整 `kpis.pendingReleaseCount` + `scoreDistribution` 字段（curl 直查）

## Acceptance self-check (32 项)

| # | Section | 项 | 自检 |
|---|---|---|---|
| 1 | A 类型构建 | tsc 0 | ✅ |
| 2 | A | lint 通过 | ✅ |
| 3 | A | vitest 全过 | ✅ 782/782 |
| 4 | A | build 成功 | ✅ |
| 5 | B 删除 | `<Tabs>` JSX 不再出现 | ✅ grep 0 命中 |
| 6 | B | 8 个 Tab 函数定义全删 | ✅ grep 0 命中 |
| 7 | B | Heatmap + ActionList 函数删 | ✅ grep 0 命中 |
| 8 | B | dashboard.tsx < 800 行 | ✅ 632 |
| 9 | B | 净删除 ≥ 500 | ✅ -745 |
| 10 | C 4 区块骨架 | insights-grid.tsx 存在 + export InsightsGrid | ✅ |
| 11 | C | lg:grid-cols-2，A→B→C→D 顺序 | ✅ insights-grid.tsx line 36-44 |
| 12 | C | 区块 A：ScoreDistributionChart 完整可用 | ✅ dynamic ssr:false 接现有组件 |
| 13 | C | 区块 B 标题「任务表现典型例子」+ ComingSoon hint | ✅ task-performance-block.tsx |
| 14 | C | 区块 C 标题「Study Buddy 共性问题」+ ComingSoon hint | ✅ study-buddy-block.tsx |
| 15 | C | 区块 D 标题「AI 教学建议」+ ComingSoon hint | ✅ teaching-advice-block.tsx |
| 16 | C | ComingSoon 视觉：圆形 icon + 标题 + 描述，min-h-280px 居中 | ✅ coming-soon.tsx (size-12 rounded-full) |
| 17 | C | ComingSoon 文案全中文 | ✅ |
| 18 | D 视觉保留 | Filter Bar 不动 | ✅ phase 1 组件未碰 |
| 19 | D | KPI 5 卡 + 数据正确性 | ✅ KpiRow 未碰 |
| 20 | D | DataQualityPanel 仍渲染（KPI 行上方） | ✅ dashboard line 489 |
| 21 | D | 区块 A 5/10 段切换 + tooltip + cursor pointer | ✅ ScoreDistributionChart 未碰 |
| 22 | D | 多班对比时区块 A 仍分组柱 | ✅ 数据/逻辑链条未碰 |
| 23 | E 老 URL | `?tab=overview` 不报错 | ✅ 200 |
| 24 | E | `?tab=quiz` 不报错 | ✅ 200 |
| 25 | E | 旧 URL 全字段仍工作 | ✅ 200 |
| 26 | F 隔离 | 单实例洞察 200 + 0 console error | ✅ HTTP 200（QA 真浏览器跑 console） |
| 27 | F | teacher dashboard 200 + 0 console error | ✅ HTTP 200（QA 真浏览器跑 console） |
| 28 | G anti-regression | defaultClassIdsAppliedRef + courseId guard 保留 | ✅ line 353-376 |
| 29 | G | entity vs filter classIds 边界 service 不变 | ✅ service 不动 |
| 30 | G | 多班/单班/单实例 filter 4 场景视觉正常 | ✅ filter-bar 不动 + InsightsGrid 数据透传（QA 真浏览器） |
| 31 | G | recharts bar fill = `var(--color-{classId})` | ✅ grep `score-distribution-chart.tsx` 5 处 var(--color-...) |
| 32 | G | KPI 5 卡数字与 phase 2 一致 | ✅ KpiRow + service 不动 |

## Deletion accountability（每个 helper 删除前 grep 0 引用验证）

| Helper / 组件 | 删除前 grep 验证 | 状态 |
|---|---|---|
| Tabs JSX (538-575) | 仅在 dashboard 主 return 出现 | ✅ 删 |
| OverviewTab/ChapterTab/InstanceTab/QuizTab/RubricTab/StudentInterventionTab/WeeklyInsightTab/TrendsTab (8 个) | 仅被 Tabs JSX 调用 | ✅ 删 |
| Heatmap (558-619) | 仅被 dashboard return 调用 | ✅ 删 |
| ActionList (620-650) | 仅被 dashboard return 调用 | ✅ 删 |
| InsightColumn / TrendMetric (924-1107) | 仅被 WeeklyInsightTab/TrendsTab 调用 | ✅ 删 |
| PlaceholderTab (1108) | 0 引用（dead code） | ✅ 删 |
| ChartSkeleton (506-514) | 仅被 dynamic 的 loading prop 调用，那个 dynamic 已移到 insights-grid.tsx 内（独立 ChartSkeleton inline） | ✅ 删 |
| MetricBar (1142-1156) | 仅被 OverviewTab 调用 | ✅ 删 |
| WeaknessBadges (1157-1161) | 仅被 OverviewTab/ChapterTab/InstanceTab 调用 | ✅ 删 |
| TagList (1162-1174) | 仅被 WeaknessBadges 调用 | ✅ 删 |
| EmptyInline (1175-1178) | 仅被 Heatmap/ActionList/8 Tabs 调用，全部已删 | ✅ 删 |
| buildModeSplit (1208-1215) | 仅被 ChapterTab 调用 | ✅ 删 |
| heatClass (1217-1224) | 仅被 Heatmap 调用 | ✅ 删 |
| clampProgress / isAbnormalMetric (1226-1236) | 仅被 MetricBar / TrendMetric / Heatmap 调用 | ✅ 删 |
| actionMetric (1271-1275) | 仅被 ActionList 调用 | ✅ 删 |
| insightBadgeVariant / insightSeverityLabel (1277-1287) | 仅被 WeeklyInsightTab/InsightColumn 调用 | ✅ 删 |
| formatPointChange (1289-1292) | 仅被 TrendsTab 调用 | ✅ 删 |
| formatDate (1294-1300) | 仅被 InsightColumn 调用 | ✅ 删 |
| formatRate / formatPercentNumber (1312-1319) | 仅被上述 dead code 调用 | ✅ 删 |
| INTERVENTION_LABELS const | 仅被 StudentInterventionTab 调用 | ✅ 删 |

## 保留对照（仍在用，不删）

| 保留项 | 引用方 |
|---|---|
| `DataQualityPanel` | dashboard return line 489 |
| `CenteredState` | dashboard return line 478, 484, 486 |
| `buildScopeTags` | useMemo line 380 → InsightsFilterBar.scopeTags prop |
| `compareDataQualityFlag` | DataQualityPanel line 503 |
| `dataQualitySeverityLabel` | DataQualityPanel line 525 |
| `isJobRunning` | startRecompute() line 416 |
| `jobStatusLabel` | header line 460 |
| `isAnalyticsDiagnosis` | recompute polling line 349 |
| `formatDateTime` | header line 459 + jobStatusLabel line 608 |
| `TASK_TYPE_LABELS` | buildScopeTags line 631 |
| `SCORE_POLICY_LABELS` | buildScopeTags line 633 |
| `RANGE_LABELS` | buildScopeTags line 634 |
| `InsightItem` interface | `AnalyticsV2Diagnosis.weeklyInsight.{highlights,risks,recommendations}` 类型用 |

## Dev server 状态

**已 alive，phase 3 不需要重启**。port 3031, PID 7417（来自 phase 2 build report）。Curl 直查 page 200 + diagnosis API 200，没有 fast refresh 错误。

## 不确定 / 推迟项

1. **`InsightItem` interface 仍在 dashboard.tsx**：被 service 数据类型 `AnalyticsV2Diagnosis.weeklyInsight.highlights` 等用作 element type。本可移到 service，但 phase 3 不允许改 service / 不允许大动 dashboard 类型，留给 phase 6 polish。

2. **`AnalyticsV2Diagnosis` interface 在 dashboard.tsx 内部声明（line 32-203）**：本来可以从 service 直接 import，但移植要改不少 type re-export，phase 3 范围不动。phase 6 重构机会。

3. **`InsightsGrid` 类型轻量化**：spec 字面 `filterState: { courseId, classIds, ... }` 给 phase 4-5 点击下钻用，phase 3 没实装下钻所以未传 filterState，仅传 `diagnosis` + `onBinClick`。phase 4 接 drawer 时再扩展。这是 spec 约定的"phase 4-5 才接"的尊重。

## 提交

按 spec 与 coordinator 指令：
- **不自己 commit**
- atomic 单 commit message 见 spec §提交策略

## 下一步

通知 QA：「Build done for unit insights-phase3 r1, ...」
