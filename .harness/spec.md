# Spec — 数据洞察 Phase 9：KPI trailing visual + 小视口适配

> Phase 1-8 已 commit (`0f823d0` ... `384c6e4`)，PR #1 push 13 commits。本 spec 仅负责 Phase 9。

## Unit 标识
- `insights-phase9`，build/qa 报告 r1, r2...
- Dynamic exit：2 PASS 收工 / 同 fail 3 轮回 spec / 不跑保险轮

## 用户原话（最新反馈）

> "1280/1024 是否能吧现在对布局和字体稍做适配,比如变小一些?"

> "另外对于第一行 完成率 归一均分 成绩带发布,风险信号右边空白处 是否方便在不调整现有数据大小和格局的前提下,可以在空白处浮动一个折线图? 代表一些过往信息? 比如完成率和归一均分放上过去10个任务的情况. 成绩带发布显示三个过了DDL但还没发布的任务,风险信号也显示相应的? 不确定是否方便,我们可以试下"

## 当前 Baseline（phase 8 收官状态）

- 分支 `claude/elastic-davinci-a0ee14`，**13 commits ahead**，已 push origin
- KPI 4 卡布局：vertical (icon + 标签 / 主值 / sub / delta)，**右侧空白**（需求点）
- KPI 卡现已有 phase 7 `Sparkline`（weeklyHistory 12 周），但视觉弱
- Phase 8 r2 1440x900 完美 + 1280/1024 chart cardContent 7.5px / 12.3px 仍紧凑（QA Minor 1）

## Phase 9 范围

### ✅ 必须做的 5 件事

#### 1. KPI 卡 trailing visual（4 卡各自不同）— 用户最关键反馈

**KPI 卡 layout 改 horizontal**（左主数据 + 右 trailing visual）：

```tsx
<Card className="rounded-lg p-3 flex-row items-center gap-3 min-h-[88px]">
  {/* 左：现有数据 (不动数据/格局) */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" />
      <span>完成率</span>
      {warning && <Badge>需核对</Badge>}
    </div>
    <div className="text-xl font-semibold mt-0.5 tabular-nums">{value}</div>
    <div className="text-xs text-muted-foreground mt-0.5">
      {sub} · {weekDelta}
    </div>
  </div>
  {/* 右：trailing visual (~80-96px 宽) */}
  <div className="w-24 shrink-0">
    <KpiTrailingVisual kind={kind} data={trailingData} />
  </div>
</Card>
```

#### 2. 各 KPI 卡 trailing visual 内容

##### a. 完成率卡 — 过去 10 个任务的折线图
```tsx
<TrailingLineChart 
  data={recentTasksTrend.map(t => ({ x: t.publishedAt, y: t.completionRate }))}
  metric="rate"
  height={48}
/>
```
- recharts LineChart, dynamic ssr:false
- stroke `var(--color-brand)`
- dot 仅最后一个（`<Dot r={2}>`）
- tooltip 显示 任务名 + 该任务完成率
- 数据稀疏（< 2 任务）时显示「暂无趋势」灰色 placeholder

##### b. 归一化均分卡 — 过去 10 个任务的折线图
- 同 a，但 metric="percent"，data y = avgNormalizedScore

##### c. 成绩待发布卡 — 3 个待发布任务 mini list
```tsx
<TrailingMiniList items={pendingReleaseInstances.slice(0, 3)} renderItem={(t) => (
  <div className="text-[10px] leading-tight truncate">
    <span className="font-medium">{t.title}</span>
    <span className="text-muted-foreground"> DDL过{daysSince(t.dueAt)}天</span>
  </div>
)} />
```
- 每行 12-14px 高（text-[10px] / 11px）
- 0 项时不显示 trailing
- click trailing 展开列表 → drawer kind=`pending_release`（已 phase 5 实装）

##### d. 风险信号卡 — top-2 章节 + top-2 学生 mini list
```tsx
<div className="text-[10px] space-y-0.5">
  {riskChapterSamples.slice(0, 2).map(c => <div className="truncate">📖 {c.title}</div>)}
  {riskStudentSamples.slice(0, 2).map(s => <div className="truncate">👤 {s.name}</div>)}
  {(riskChapterSamples.length + riskStudentSamples.length > 4) && (
    <div className="text-muted-foreground">+ 更多</div>
  )}
</div>
```
- 0 项时不显示 trailing（卡内整 row 只显示主数据，左侧扩展）

#### 3. Service 扩展（**仅 sample 抽取，不破坏现有数据契约**）

[lib/services/analytics-v2.service.ts](lib/services/analytics-v2.service.ts) 给 `kpis` 加 4 字段：

```ts
kpis: {
  // 现有字段全保留
  recentTasksTrend: Array<{
    taskInstanceId: string;
    title: string;
    completionRate: number | null;     // 0..1
    avgNormalizedScore: number | null; // 0..100
    publishedAt: string;
  }>;                                  // 最近 10 个 instances by publishedAt desc

  pendingReleaseInstances: Array<{
    id: string;
    title: string;
    dueAt: string;
  }>;                                  // top-3 by dueAt asc (最早过 DDL 的优先)

  riskChapterSamples: Array<{
    chapterId: string;
    title: string;
  }>;                                  // top-3 风险章节 (复用 isRiskChapter helper)

  riskStudentSamples: Array<{
    studentId: string;
    name: string;
    reason: "not_submitted" | "low_score" | "declining";
  }>;                                  // top-3 风险学生 (复用 studentInterventions)
}
```

实现：
- `recentTasksTrend`：从 `instanceMetrics` 排序 + 取前 10
- `pendingReleaseInstances`：复用 phase 4 pendingReleaseTaskCount 同 query 但返回 instances 详情（top-3 by dueAt asc）
- `riskChapterSamples / riskStudentSamples`：从 chapterDiagnostics + studentInterventions 抽 top-3

#### 4. 1280/1024 视口字体 + AI max-h responsive

##### KPI 卡 responsive
- 主值字体：`text-xl`（lg+）→ `text-lg`（md, 1024 视口）
- trailing visual 宽度：`w-24`（lg+）→ `w-20`（md）
- min-height：保持 `min-h-[88px]`（避免上下不齐）

##### AI 教学建议 max-h responsive
当前 `max-h: 140px` 全视口固定 → 改 responsive：
- 1440+: `max-h-[160px]`（保持现 phase 8）
- 1280: `lg:max-h-[120px]`（节省 20px 给主体 grid）
- 1024: `md:max-h-[100px]`（节省更多）

**预估效果**：1280 chart cardContent 7.5 → ~25-30px；1024 chart cardContent 12.3 → ~50px。

##### 主体 grid-rows 比例 responsive
当前 `grid-rows-[3fr_2fr]` 固定 → 小视口可加 `lg:grid-rows-[2fr_3fr]` 让 score row 更多分（视情况测试）

#### 5. KPI 卡 responsive 4 → 2 列 fallback

当前 KPI 卡 `lg:grid-cols-4`，加 horizontal layout 后单卡更宽，需要：
- 1440+: `lg:grid-cols-4` 保持
- 1280: 如果 4 卡挤压可降级 `md:grid-cols-2`（但优先保 4 卡，仅当 chart 显示不全时降级）
- 1024: `md:grid-cols-2` 或 `lg:grid-cols-4` 但 trailing visual 宽度缩

实施时先尝试**全视口 4 卡 + trailing visual 宽度 responsive**，如挤压再降级。

### ❌ 必须不做的 6 件事

1. ❌ 不动现有 KPI 数据格局（主值 / sub / delta 全保留，仅扩展 trailing visual）
2. ❌ 不动 Prisma schema
3. ❌ 不引入新 npm 依赖
4. ❌ 不动单实例 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx) / teacher dashboard
5. ❌ 不动 entity vs filter classIds 边界 / defaultClassIdsAppliedRef + courseId guard / localStorage
6. ❌ 不动 Filter 紧凑布局 / 主体 3 列布局 / AI 4 列保留 / 数据质量底部

## Acceptance Criteria

### A. 类型与构建
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过
3. `npx vitest run` ≥ 819 cases（service 加字段不破坏现有 mock）
4. `npm run build` 成功
5. 不引入新 npm 依赖（package.json 0 改动）

### B. KPI 卡 horizontal layout
6. 4 KPI 卡内布局改为 `flex-row items-center` （左主数据 / 右 trailing visual）
7. 主数据保留：icon + 标签 + 主值 + sub + delta（数据格局不变）
8. trailing visual 宽度 ~80-96px，与主数据 `gap-3`
9. 所有卡 `min-h-[88px]` 视觉对齐

### C. 完成率 + 归一化均分卡 trailing line chart
10. 完成率卡 trailing：过去 10 个任务的 line chart（dynamic import recharts）
11. 归一化均分卡 trailing：同
12. line stroke `var(--color-brand)`
13. height ≈ 48px
14. tooltip 显示任务名 + metric 值
15. 数据稀疏（< 2 任务）时显示「暂无趋势」灰色 placeholder
16. dot 仅最后一个数据点显示

### D. 成绩待发布卡 trailing list
17. trailing 显示 top-3 待发布任务（任务名 + DDL 过几天）
18. text-[10px] 紧凑字体
19. 0 项时 trailing 不显示（左主数据扩展）
20. click trailing 任意位置 → 卡 onClick → drawer kind=`pending_release`（已实装）

### E. 风险信号卡 trailing samples
21. trailing 显示 top-2 风险章节 + top-2 风险学生（icon + 名称）
22. text-[10px] 紧凑字体
23. > 4 项时显示「+ 更多」
24. 0 项时 trailing 不显示

### F. Service 扩展
25. `kpis.recentTasksTrend` 返回 ≤ 10 条 instances（按 publishedAt desc）
26. `kpis.pendingReleaseInstances` 返回 ≤ 3 条（按 dueAt asc）
27. `kpis.riskChapterSamples` 返回 ≤ 3 条（用 isRiskChapter helper）
28. `kpis.riskStudentSamples` 返回 ≤ 3 条（从 studentInterventions 抽）
29. SQL 直查 与 service 返回数据一致

### G. 1280/1024 视口适配
30. 1440x900：现有视觉保持（chart cardContent ≥ 100px，phase 8 r2 baseline）
31. 1280x720：chart cardContent ≥ 25px（从 phase 8 的 7.5 改善 3x+）
32. 1024x768：chart cardContent ≥ 40px（从 phase 8 的 12.3 改善 3x+）
33. AI max-h responsive：1440+ 160px / 1280 120px / 1024 100px
34. KPI 主值字体 responsive：lg+ text-xl / md text-lg
35. 三视口仍 0 overflow（继承 phase 7/8 硬约束）

### H. 数据正确性
36. recentTasksTrend 数据 = instanceMetrics 按 publishedAt desc 取 10
37. pendingReleaseInstances = phase 4 pendingReleaseTaskCount 关联 instances top-3 by dueAt asc
38. riskChapterSamples = chapterDiagnostics filter(isRiskChapter) top-3
39. riskStudentSamples = studentInterventions unique studentId top-3

### I. Phase 1-8 anti-regression
40. KPI 主数据数字与 phase 8 一致（完成率 / 归一化均分 / 待发布 / 风险信号 主值）
41. KPI 卡 onClick → drawer 5 kinds 全工作
42. Filter 紧凑（H1 + 班级 + 章节 + 详细筛选 popover）保留
43. 主体 grid 2 行 3 列 + 任务表现跨右 2/3 保留
44. 学生分布柱顶 LabelList(count) 保留
45. AI 4 列 4 类保留
46. 数据质量底部 collapsible 保留
47. defaultClassIdsAppliedRef + courseId guard 完整
48. entity vs filter classIds 边界
49. localStorage 最近课程
50. 老 URL `?classId=A` / `?tab=overview` 兼容
51. 老 `/teacher/analytics` 仍 302 redirect
52. 单实例 / teacher dashboard 隔离
53. recharts CSS 变量配色（grep `#8884d8` 0 命中）
54. LLM 24h 缓存 + 失败兜底

## Risks

| 风险 | 防御 |
|---|---|
| KPI 卡 horizontal layout 让卡过宽，1024 视口 4 卡挤压 | trailing visual width responsive (md w-20 / lg w-24) + 必要时 fallback md:grid-cols-2 |
| recentTasksTrend 数据稀疏（仅 1-2 任务）→ chart 看起来错 | < 2 任务显示「暂无趋势」placeholder |
| trailing list text-[10px] 太小不可读 | text-[11px] 备选；hover/focus 时显示完整 tooltip |
| AI max-h 缩到 100px 在 1024 让内容看不全 | 每列内 overflow-y-auto 仍工作（可滑动看全部）|
| 主体 grid-rows 比例 responsive 影响 1440 视觉 | 谨慎仅小视口改，1440+ 保持 phase 8 baseline |
| service 加 instance level data 慢 | 复用 instanceMetrics 已有数据，0 二次 DB 查询 |

## QA 验证

### 必做
1. tsc / lint / vitest（≥ 819）/ build
2. 真浏览器 via gstack `/qa-only`：
   - 1440x900 / 1280x720 / 1024x768 三视口整页可见 0 overflow
   - KPI 4 卡 horizontal layout + trailing visual：
     - 完成率 + 归一化均分 mini line chart 渲染（dot + stroke）
     - 待发布 trailing 显示任务列表（如 0 项则无 trailing）
     - 风险信号 trailing 显示章节 + 学生 list
   - 1280/1024 chart cardContent 高度比 phase 8 改善 3x+
   - AI max-h responsive
   - KPI 卡 onClick → drawer 5 kinds 全工作
   - 截图 ≥ 10 张 `/tmp/qa-insights-phase9-*.png`：
     - 1440 整页 / 1280 整页 / 1024 整页
     - KPI 4 卡 trailing 特写 × 2（完成率 line chart / 待发布 list）
     - 风险信号 trailing
     - chart cardContent 1280 / 1024 高度对比 phase 8
3. **数据正确性**：API 直查 recentTasksTrend / pendingReleaseInstances / riskChapterSamples / riskStudentSamples 与 SQL 手算一致

### 跳过
- ❌ Prisma 三步（无 schema）
- ❌ Bundle size（不引入新 deps）

## 提交策略

Phase 9 atomic commit：

```
feat(insights): phase 9 — KPI trailing visuals + small viewport responsive

- KPI 4 卡 vertical layout → horizontal (左主数据 / 右 trailing visual)
- 完成率 + 归一化均分 trailing: 过去 10 个任务 mini LineChart
  (recharts dynamic ssr:false, stroke var(--color-brand), dot 仅末点)
  数据稀疏 < 2 任务显「暂无趋势」placeholder
- 成绩待发布 trailing: top-3 待发布任务 mini list (任务名 + DDL 过几天,
  text-[10px] 紧凑, 0 项时 trailing 不显示)
- 风险信号 trailing: top-2 章节 + top-2 学生 mini list (icon + 名称,
  > 4 项「+ 更多」)
- Service kpis 加 4 字段 (复用 instanceMetrics 0 二次 DB):
  - recentTasksTrend (≤10 instances by publishedAt desc)
  - pendingReleaseInstances (≤3 by dueAt asc)
  - riskChapterSamples (≤3 用 isRiskChapter helper)
  - riskStudentSamples (≤3 从 studentInterventions)
- 小视口适配:
  - AI max-h responsive: 1440+ 160px / 1280 120px / 1024 100px
  - KPI 主值字体 responsive: lg+ text-xl / md text-lg
  - trailing visual 宽度 responsive: lg w-24 / md w-20
- 1280 chart cardContent 7.5 → ~30px / 1024 12.3 → ~50px
  (phase 8 Minor 1 修复)

Phase 1-8 anti-regression preserved (KPI 主数据格局保持, drawer 5 kinds,
filter 紧凑, 主体 3 列, 学生分布 LabelList, AI 4 列, classIds guard,
localStorage, 单实例 + dashboard 隔离, 老 URL + 老路由)。

QA: r1 PASS X/X (tsc/lint/vitest 819+/build 全绿)
- 三视口 1440/1280/1024 整页 0 overflow
- 1280 chart cardContent 改善 4x / 1024 4x
- KPI trailing 4 类视觉 + 数据正确

PR #1 最终 14 commits

See plan: ~/.claude/plans/linked-wobbling-anchor.md
See spec: .harness/spec.md
See QA: .harness/reports/qa_insights-phase9_r1.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

QA PASS 后 builder 1 个 atomic commit + push origin。
