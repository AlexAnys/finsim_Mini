# Spec — 数据洞察重构 · Phase 3：删 8 Tabs + Heatmap/ActionList，落地 4 区块骨架

> Phase 1 commit `0f823d0` + chore `40b504a`，Phase 2 commit `a311478`。本 spec 仅负责 Phase 3。完整 plan：`~/.claude/plans/main-session-snug-tide.md`。

## Unit 标识
- `insights-phase3`，build/qa 报告 r1, r2...
- Dynamic exit：2 PASS 收工 / 同 fail 3 轮回 spec / 不跑保险轮

## 当前 Baseline
- 分支 `claude/elastic-davinci-a0ee14`，**3 commits ahead** of main `e311571`
- [analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) 当前 **1377 行**（含所有 8 个 Tab 子组件 + Heatmap + ActionList + 8 个 helper）
- KpiRow / ScoreDistributionChart / InsightsFilterBar 已在 phase 2 实装，**保留**
- service AnalyticsV2Diagnosis type **完全保留**（含 simulationDiagnostics / studentInterventions / weeklyInsight 等字段，phase 4-5 会复用）

## D8 决策（用户已默认接受）
**彻底删 8 Tabs + Heatmap + ActionList，不保留快速链接入口**。新页面 4 区块够用。

## Phase 3 范围

### ✅ 必须做的 4 件事

#### 1. 删 [analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) 中的 8 Tabs + Heatmap + ActionList

**精确删除清单**（以当前文件 1377 行为基准）：
- `<Tabs defaultValue="overview">` 整个 JSX 段（约 line 535-575，含 TabsList + 8 TabsContent）
- 8 个 Tab 子组件函数：`OverviewTab` / `ChapterTab` / `InstanceTab` / `QuizTab` / `RubricTab` / `StudentInterventionTab` / `WeeklyInsightTab` / `TrendsTab`（全部）
- `<Heatmap rows={diagnosis.chapterClassHeatmap} />` 调用 + `Heatmap` 函数定义
- `<ActionList items={diagnosis.actionItems} />` 调用 + `ActionList` 函数定义
- 不再使用的 helper：`InsightColumn` / `TrendMetric` / `MetricBar` / `WeaknessBadges` / `TagList` / `PlaceholderTab` / `buildModeSplit` / `heatClass` / `actionMetric` / `insightBadgeVariant` / `insightSeverityLabel` / `formatPointChange` / `formatRate`（如果只在删除的组件里用）/ `dataQualitySeverityLabel` / `compareDataQualityFlag` / `INTERVENTION_LABELS`（仅在 StudentInterventionTab 用）/ `TASK_TYPE_LABELS`（如果其他地方还用就留）/ `RANGE_LABELS`（如果还在 buildScopeTags 用就留）/ `SCORE_POLICY_LABELS`（同）/ `dataQualitySeverityLabel`
- **必留**：`<DataQualityPanel flags={diagnosis.dataQualityFlags ?? []} />` + `DataQualityPanel` 函数（数据质量提示对老师有价值，区块 D AI 建议依赖这层信号；放在 KPI 行上方）+ `CenteredState` + `EmptyInline`（其他组件还要用）+ `cn` import + 各种格式化 helper（`formatDate` / `formatDateTime` / `formatPercentNumber` / `clampProgress` / `isAbnormalMetric` / `hasQualityCategory` / `isJobRunning` / `jobStatusLabel` / `isAnalyticsDiagnosis`）— 若被删除的部分用了某 helper 但 KpiRow / ScoreDistributionChart / InsightsFilterBar / DataQualityPanel 还要用，就保留
- **谨慎判断原则**：删除前 grep `helper_name` 在剩余引用里是否还在用；只删 0 引用的 helper

#### 2. 新建 4 区块容器组件 `components/analytics-v2/insights-grid.tsx`

```ts
interface InsightsGridProps {
  diagnosis: AnalyticsV2Diagnosis;
  filterState: { courseId: string; classIds: string[]; ... };  // 用于点击下钻 phase 4-5
  onBinClick?: (bin, classId) => void;  // phase 2 已留
}
```

布局：
- `lg:grid-cols-2 grid-cols-1` 2x2 栅格
- 顺序：A → B → C → D（左上、右上、左下、右下）
- 区块间 `gap-4`
- 区块 A 已实装（接 ScoreDistributionChart）
- 区块 B/C/D 是 stub（下条详述）

#### 3. 新建 3 个 stub 组件（phase 4-5 再实装真实功能）

##### `components/analytics-v2/task-performance-block.tsx`
```tsx
<Card className="rounded-lg">
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <Sparkles className="size-4 text-brand" />
      任务表现典型例子
    </CardTitle>
  </CardHeader>
  <CardContent>
    <ComingSoon
      icon={Sparkles}
      title="任务表现 · 即将推出"
      description="下一阶段将基于学生真实回答抽取高分典型 3-4 例 + 低分常见问题 + 证据抽屉。"
    />
  </CardContent>
</Card>
```

##### `components/analytics-v2/study-buddy-block.tsx`
```tsx
title: "Study Buddy 共性问题"
icon: MessageCircleQuestion
description: "下一阶段将按节聚合学生在学习过程中提出的共性问题 (top-5 排序 + 提问学生列表)。"
```

##### `components/analytics-v2/teaching-advice-block.tsx`
```tsx
title: "AI 教学建议"
icon: Lightbulb
description: "下一阶段将基于上述统计 + 风险信号生成 4 类教学建议 (知识目标 / 教学方式 / 关注群体 / 接下来怎么教)，每条带依据。"
```

##### `ComingSoon` 共用空态（在 insights-grid.tsx 内部或单独 helper）

```tsx
function ComingSoon({ icon: Icon, title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[280px] gap-3 text-center px-6">
      <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-base font-medium">{title}</p>
      <p className="text-sm text-muted-foreground max-w-[260px]">{description}</p>
    </div>
  );
}
```

#### 4. 主 dashboard 接入 InsightsGrid

[analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) `return` 部分变成：

```tsx
<InsightsFilterBar ... />
{coursesLoading ? <CenteredState ...> : !courseId ? <CenteredState 提示选课程 /> : error ? <CenteredState ...> : diagnosisLoading && !diagnosis ? <CenteredState ... loading /> : diagnosis ? (
  <>
    <DataQualityPanel flags={diagnosis.dataQualityFlags ?? []} />
    <KpiRow diagnosis={diagnosis} />
    <InsightsGrid diagnosis={diagnosis} filterState={...} onBinClick={onBinClick} />
  </>
) : null}
```

`<ScoreDistributionChart />` 不再直接放在 dashboard 里，**移入 InsightsGrid 内的区块 A**。

### ❌ 必须不做的 5 件事

1. ❌ 不动 service / API / schema（service 函数和类型全保留，phase 6 polish 才清理无用 service 代码）
2. ❌ 不实装区块 B/C/D 真功能（phase 4-5）
3. ❌ 不引入新依赖
4. ❌ 不动 KpiRow / ScoreDistributionChart / InsightsFilterBar / DataQualityPanel
5. ❌ 不动 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx) / teacher dashboard

## Acceptance Criteria

### A. 类型与构建
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过
3. `npx vitest run` 全过（service 测试不变）
4. `npm run build` 成功

### B. 删除完整性
5. `<Tabs>` JSX 不再出现在 dashboard.tsx
6. 8 个 Tab 子组件函数（OverviewTab/ChapterTab/InstanceTab/QuizTab/RubricTab/StudentInterventionTab/WeeklyInsightTab/TrendsTab）函数定义全部删除
7. `Heatmap` 和 `ActionList` 函数定义删除
8. dashboard.tsx 文件行数 < 800 行（从 1377 行删到 < 800，预计 -600 行 +50 行 = 净 -550 行）
9. `git diff --stat` 主 dashboard 净删除 ≥ 500 行

### C. 4 区块骨架
10. `components/analytics-v2/insights-grid.tsx` 存在 + export `InsightsGrid`
11. 4 区块布局：lg:grid-cols-2，A→B→C→D 顺序
12. 区块 A：标题「学生成绩分布」+ 内容 = ScoreDistributionChart（**完整可用**，继承 phase 2）
13. 区块 B：标题「任务表现典型例子」+ 内容 = ComingSoon "下一阶段将基于学生真实回答抽取高分典型 3-4 例 + 低分常见问题 + 证据抽屉"
14. 区块 C：标题「Study Buddy 共性问题」+ 内容 = ComingSoon "下一阶段将按节聚合学生在学习过程中提出的共性问题"
15. 区块 D：标题「AI 教学建议」+ 内容 = ComingSoon "下一阶段将基于上述统计 + 风险信号生成 4 类教学建议"
16. ComingSoon 视觉：圆形 icon 图标 + 标题 + 描述，居中，min-height 至少 280px（与区块 A 同高视觉对齐）
17. ComingSoon 文案全中文

### D. 视觉与功能保留
18. Filter Bar 单行布局 + 班级多选 + 默认全部班 全保留（phase 1 已确立）
19. KPI 5 卡 + 数据正确性 全保留（phase 2 已确立）
20. DataQualityPanel 仍渲染（在 KPI 行上方）
21. 区块 A 内 5/10 段切换 + tooltip + 点击 cursor pointer 全保留
22. 多班对比时区块 A 仍显示分组柱

### E. 老 URL 兼容（不报错）
23. `/teacher/analytics-v2?tab=overview` 不报错（旧 hash 被忽略，页面正常渲染 4 区块）
24. `/teacher/analytics-v2?tab=quiz` 同上
25. `/teacher/analytics-v2?classIds=A&taskInstanceId=...` 等旧 URL 全部仍工作

### F. 隔离
26. `/teacher/instances/[id]/insights` 单实例洞察页 200 + 无 console error
27. `/teacher/dashboard` 教师工作台 200 + 无 console error

### G. Phase 1+2 anti-regression
28. defaultClassIdsAppliedRef + courseId guard 完整保留（dashboard.tsx 中相应 useEffect 仍存在）
29. entity vs filter classIds 边界 service 不变
30. 多班 / 单班 / 单实例 filter 切换 4 种场景视觉正常
31. recharts bar fill 仍是 `var(--color-{classId})` CSS 变量（grep 验证）
32. KPI 5 卡数字与 phase 2 一致

## Risks

| 风险 | 防御 |
|---|---|
| 删 helper 时漏看其他引用 → tsc 报错 | 每删一个先 grep 验证 0 引用 |
| 4 区块 lg:grid-cols-2 在中等屏幕拥挤 | 用 `lg:grid-cols-2 grid-cols-1`，区块内部 padding 留白 |
| 老 URL hash 触发 React error | URL 参数读不到不报错（`searchParams.get("tab")` 返 null OK），不触发 unknown route |
| 删 ActionList 后 actionItems 数据弃用 | service 字段保留 (phase 5 AI 建议会消费它)，仅前端不渲染 |
| ComingSoon 看起来太空让用户以为坏 | 文案明确「下一阶段将…」+ 圆形 icon 引导视觉 |
| service 中 weeklyInsight 不再被 dashboard 用 | 保留（phase 5 复用 + AI 建议生成依赖现有数据） |

## QA 验证

### 必做
1. tsc / lint / vitest / build
2. `wc -l components/analytics-v2/analytics-v2-dashboard.tsx` < 800
3. `git diff --stat dashboard.tsx` 显示 ≥ 500 行净删除
4. **真浏览器** via gstack `/qa-only`：
   - dev server worktree 3031 仍 alive
   - teacher1 → /teacher/analytics-v2 → 4 区块布局
   - 切课程 / 多班 / 单实例 filter 看区块 A 仍工作
   - Console 无 error
   - 截图 ≥ 4 张 `/tmp/qa-insights-phase3-*.png`：4 区块 lg / md / ComingSoon 区块 / 单实例 insights 隔离
5. 老 URL 兼容测试：`?tab=overview` `?tab=quiz` 不报错
6. 单实例 insights + teacher dashboard 抽查回归

### 跳过
- ❌ Prisma 三步（无 schema）
- ❌ 性能测试（删代码只会变快）

## 提交策略

Atomic commit message：
```
feat(insights): phase 3 — remove 8 tabs / heatmap / actionlist, land 4-block layout

- Delete dashboard's <Tabs> JSX + 8 TabsContent + their function definitions
  (OverviewTab / ChapterTab / InstanceTab / QuizTab / RubricTab /
   StudentInterventionTab / WeeklyInsightTab / TrendsTab)
- Delete <Heatmap> + <ActionList> components and their function defs
- Delete unused helpers (InsightColumn / TrendMetric / MetricBar /
  WeaknessBadges / TagList / PlaceholderTab / etc., grep 验证 0 引用)
- New components/analytics-v2/insights-grid.tsx (lg:grid-cols-2 2x2 layout)
- New 3 stub blocks: task-performance-block / study-buddy-block /
  teaching-advice-block (ComingSoon placeholder, 中文 description hint phase 4-5)
- Move ScoreDistributionChart into Block A inside InsightsGrid
- Keep DataQualityPanel rendered above KPI Row (data quality signal)
- Service / API / schema unchanged (types preserved for phase 4-5 reuse)

Page now: Filter → DataQualityPanel → KPI 5 cards → 2x2 InsightsGrid (A实装/B/C/D stub)
Net: dashboard.tsx 1377 → ~700 lines (-{N} lines)

Phase 1+2 anti-regression preserved (filter / classIds guard / entity vs filter /
recharts design tokens / Legacy URL fallback)。

QA: r1 PASS X/X (tsc/lint/vitest/build 全绿)
- 4 区块布局 lg/md/sm 视觉验证
- 老 URL ?tab=... 不报错 (param 忽略)
- 单实例 insights / teacher dashboard 隔离

See plan: ~/.claude/plans/main-session-snug-tide.md
See spec: .harness/spec.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
