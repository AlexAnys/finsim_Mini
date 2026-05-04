# Spec — 数据洞察重构 · Phase 2：KPI 5 卡新定义 + 学生成绩分布柱状图（recharts）

> Phase 1 已合并到 worktree 分支（commit 0f823d0 + chore 40b504a）。本 spec **仅** 负责 Phase 2。完整 6-phase plan：`~/.claude/plans/main-session-snug-tide.md`。

## Unit 标识

- **unit name**：`insights-phase2`
- **轮次约定**：build_insights-phase2_r1.md → qa_insights-phase2_r1.md → 失败则 r2、r3...
- **Dynamic exit**：连续 2 PASS 收工；同一 fail 连续 3 轮回 spec 重规划；不跑保险轮 r3。

## 用户已确认（不要再问）

> "1. 替换 2. 可以但要效果最好风格一致 3. 默认全部 4. DDL 已到但未发布"
> "改确认的已经确认了, 相信你的判断, 过程里也不断对齐我高层意图, 质量和稳定 重于效率"
> "全部完成再给我看, 我只看结果呈现, 中间步骤你自己来检查"

**最高优先级**：质量 > 稳定 > 效率。Phase 2 引入 recharts **必须严格遵守 §3 设计约束**——这是用户对"风格一致"的明确要求。

## 当前 Baseline

- Worktree 分支：`claude/elastic-davinci-a0ee14`，**2 commits ahead** of main `e311571`
- 上轮 commit：`0f823d0` (Phase 1 feat) + `40b504a` (chore HANDOFF)
- 现 KPI 5 卡布局已在 [analytics-v2-dashboard.tsx:512-520](components/analytics-v2/analytics-v2-dashboard.tsx)：完成率 / 归一化均分 / 低掌握人数 / 待批改 / 风险章节
- 8 Tabs 仍保留（phase 3 才删）
- recharts 没装；现有图表用原生 SVG / CSS bar
- TaskInstance.dueAt（DateTime, 必填）+ Submission.releasedAt（DateTime?）已存在

## Phase 2 范围（必须做 + 必须不做）

### ✅ 必须做的 5 件事

#### 1. KPI 5 卡新定义 + 重构

| # | 老定义 | 新定义 | 数据源 |
|---|---|---|---|
| ① 完成率 | `submittedStudents / assignedStudents`（保留） | 同 | `kpis.completionRate` |
| ② 归一化均分 | `avg(score/maxScore × 100)`（保留） | 同 | `kpis.avgNormalizedScore` |
| ③ **待发布**（D4 用户口径） | ~~"待批改" = `submittedStudents - gradedStudents`~~ | **`taskInstance.dueAt < now() AND submission.releasedAt == null` 的 submission 数** | **service 新增 `kpis.pendingReleaseCount`** |
| ④ 风险章节 | `chapterDiagnostics filter(c.completionRate < 0.6 OR c.avgNormalizedScore < 60).length`（保留） | 同 | 客户端从 `chapterDiagnostics` 推导 |
| ⑤ **风险学生**（独立成卡） | ~~"低掌握人数" 仅 low_score reason~~ | **`studentInterventions` 三种 reason 全算（not_submitted / low_score / declining）按 studentId 去重** | 客户端从 `studentInterventions` 推导 |

**KPI 卡组件**：新建 `components/analytics-v2/kpi-row.tsx`，5 张卡 lg:grid-cols-5 / md:grid-cols-2 / sm:grid-cols-1。每张卡复用现 [KpiCard](components/analytics-v2/analytics-v2-dashboard.tsx:703) 模式但提取为独立组件，加 props：

```ts
interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  warning?: boolean;       // 现有：数据质量警告
  onClick?: () => void;    // 新增：可点击下钻（phase 5 才接 drawer，phase 2 暂不接）
  href?: string;           // 新增：直接跳转（如「待发布」可跳批改页，phase 5 接）
}
```

Phase 2 **不**实装 onClick / href（phase 5 接 risk-drawer），但 props 先留好。

#### 2. 引入 recharts + shadcn chart wrapper

- `npm install recharts`（**唯一允许的新依赖**，phase 4 不再加新依赖）
- 新建 `components/ui/chart.tsx`：shadcn/ui 官方 chart wrapper（[shadcn chart docs](https://ui.shadcn.com/docs/components/chart)）。包含：
  - `ChartContainer`（设置 CSS 变量供 recharts 用 → 配色走 design token）
  - `ChartTooltip` + `ChartTooltipContent`（白底 + border + shadow-md，与 [Popover](components/ui/popover.tsx) 一致）
  - `ChartLegend` + `ChartLegendContent`
  - 类型：`ChartConfig`（color / label / theme）
- **包大小控制**：用 `next/dynamic` 包 chart 组件，`ssr: false`，避免污染首屏。bundle diff < 150KB gzip（用 `npm run build` 看 stat 验证）。

#### 3. 学生成绩分布柱状图（区块 A）

新建 `components/analytics-v2/score-distribution-chart.tsx`（dynamic import）。

**数据契约**（service 新增 `scoreDistribution: ScoreDistribution`）：
```ts
interface ScoreDistribution {
  bins: Array<{
    label: string;          // "0-20" "20-40" ...
    min: number;
    max: number;            // exclusive (last bin inclusive)
    classes: Array<{
      classId: string;
      classLabel: string;   // 班级名
      students: Array<{ id: string; name: string; score: number; taskInstanceId?: string }>;
    }>;
  }>;
  binCount: number;         // 5 or 10
  scope: "single_task" | "multi_task";  // 当 filter 单实例 → single_task；否则 multi_task（按学生在 scope 内均分聚合）
}
```

**聚合规则**：
- `single_task`（filter 选了某 task 或 scope 内只有 1 个 instance）：每个学生 = 该任务该计分口径（latest）的归一化分数
- `multi_task`（默认）：每个学生 = 学生在 scope 内**所有 graded submissions** 的归一化均分
- 多班选中：按班级分组成多色柱

**图表配置**：
- 图表类型：[`BarChart`](https://recharts.org/en-US/api/BarChart) 分组柱状（`<Bar dataKey="班级A" fill="..." />` 多列并排）
- 区间默认 5 段（0-20/20-40/40-60/60-80/80-100，最后一段含 100），右上角 [Select](components/ui/select.tsx) 切 5/10 段
- localStorage key `insights:score-distribution-bins` 持久化区间偏好
- 多班分组用 5 色 token：`brand` / `ochre` / `success` / `sim` / `brand-violet`（已在 [globals.css](app/globals.css)）；超过 5 班循环用色（实际场景不太可能 > 5 班同选）
- 单班单色 = `brand`
- Bar 圆角 `radius={[4, 4, 0, 0]}`（top-only `rounded-t-sm` 视觉）
- Hover 高亮 + tooltip 显示「班级 + 学生数 + 区间范围」
- **点击柱子** → 调用 `onClick(bin, classId)` props，phase 2 暂不接 drawer（phase 4 才接学生列表 + 跳单实例洞察）；phase 2 实装 console.log 占位 + 鼠标 cursor pointer
- 空数据：用 [EmptyInline](components/analytics-v2/analytics-v2-dashboard.tsx:1396) 模式（虚线框 + 中文「当前范围暂无已批改 submission」）

**Card 容器**：
- 标题：「学生成绩分布」
- 副标题：「按归一化分数 (0-100) 分组｜N 名学生｜单任务 / 多任务说明」
- 右上 controls：5/10 段 Select
- 容器走 [Card](components/ui/card.tsx) `rounded-lg` + `border`，内边距 `p-4`

#### 4. 布局插入

[analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) 主组件：
- 老 KPI 5 卡 inline grid（line 512-520）→ 替换为 `<KpiRow diagnosis={diagnosis} />`
- 在 KPI 行下方、章节×班级热力图上方插入 `<ScoreDistributionChart distribution={diagnosis.scoreDistribution} />`
- 8 Tabs **保留** 在底部（phase 3 才删）
- 章节×班级热力图、行动清单 保留（phase 3 才决定是否删）

#### 5. Service 扩展

[lib/services/analytics-v2.service.ts](lib/services/analytics-v2.service.ts)：

**type 加字段**：
```ts
interface AnalyticsV2Diagnosis {
  // 现有字段保留
  scoreDistribution: ScoreDistribution;  // 新增
  kpis: {
    // 现有字段保留
    pendingReleaseCount: number;          // 新增 = DDL 已到 + releasedAt null 的 submission 数
  };
}
```

**实现新增**：
- `computeScoreDistribution(input, instanceMetrics, classOptions, binCount=5): ScoreDistribution`：
  - 从 instanceMetrics 收集所有 graded submissions（按 scorePolicy 取分）
  - single_task / multi_task 判断：filter 含 taskInstanceId 或 instanceMetrics.length === 1 → single
  - 多任务：按 studentId 聚合 = avg(归一化分数)
  - 单任务：直接用每条 submission 的归一化分数
  - 按 classId 分组
  - 按区间分桶（0-20 / 20-40 / 40-60 / 60-80 / 80-100，最后一段含 100）
  - 每桶内每班 students 数组按 score 降序排
- `computePendingReleaseCount(input)` 或在 `buildKpis` 内补算：
  ```ts
  // SELECT count(*) FROM submission s JOIN task_instance ti ON s.taskInstanceId = ti.id
  // WHERE ti.<scope filter> AND ti.dueAt < now() AND s.releasedAt IS NULL
  // 注意：ti.<scope filter> = courseId + chapterId + sectionId + classIds + taskType + taskInstanceId
  ```
  推荐复用 `buildInstanceWhere(input, dateFrom)` 拿到 instance scope，然后 `prisma.submission.count({ where: { taskInstance: scope, taskInstance: { dueAt: { lt: now } }, releasedAt: null } })`。**注意 dueAt 是必填 DateTime，不需 null check**。

### ❌ 必须不做的 5 件事

1. ❌ 不删 8 Tabs（phase 3）
2. ❌ 不动 Prisma schema（phase 4）
3. ❌ 不实装区块 B（任务表现）/ C（Study Buddy）/ D（AI 建议）（phase 4-5）
4. ❌ KPI onClick 不接 drawer（phase 5），仅留 props
5. ❌ 不动 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx)

## §3 recharts 设计约束（用户明确要求"效果最好且风格一致"）

### 配色 — 走项目现有 token，不用 recharts 默认色

- 主色：`var(--color-brand)` （已在 [globals.css](app/globals.css)）
- 多班对比 5 色：`brand / ochre / success / sim / brand-violet`
- 警告 / 风险色：`var(--color-destructive)`，不要用 recharts 默认红
- ChartContainer 通过 CSS 变量映射给 recharts：
  ```tsx
  const chartConfig = {
    classA: { label: "A 班", color: "var(--color-brand)" },
    classB: { label: "B 班", color: "var(--color-ochre)" },
    // ...
  } satisfies ChartConfig;
  ```

### 字体 / 圆角 / 间距

- XAxis/YAxis label：`text-xs` (12px) `fill-muted-foreground`
- Legend：`text-xs`
- Tooltip 主体：`text-sm`，bg `bg-background`，border `border`，shadow `shadow-md`，radius `rounded-lg`
- Bar：`radius={[4,4,0,0]}` 顶部圆角
- 容器：`<Card class="rounded-lg">` 包 chart，padding `p-4`

### 交互

- Hover：高亮当前柱，其他柱降饱和度（`opacity-70`）— recharts 自带 `cursor` 配置
- 点击：触发 `onClick(bin, classId)` props（phase 2 console.log + cursor pointer）
- Tooltip：跟随鼠标，显示班级 + 学生数 + 区间范围
- 空状态：[EmptyInline](components/analytics-v2/analytics-v2-dashboard.tsx:1396) 中文虚线框

### 可访问性

- ARIA：chart container `role="img" aria-label="学生成绩分布柱状图，X 轴分数区间，Y 轴学生人数，按班级分组"`
- 颜色对比度：tooltip 文字与背景 ≥ 4.5:1（WCAG AA）— design token 已满足
- 键盘：Tab 进入图表后方向键切换柱（recharts 默认支持）

### 性能

- `next/dynamic` 包 ScoreDistributionChart `ssr: false`
- `npm run build` 后 First Load JS diff < 150KB gzip（QA 验证）

## Acceptance Criteria（QA 必须逐条 verify）

### A. 类型与构建
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过
3. `recharts` 是**唯一**新增依赖（package.json diff 仅一行）
4. `npm run build` 通过；`npx vitest run` 全过

### B. KPI 5 卡新定义
5. KPI 行布局：lg:grid-cols-5 单行 5 卡 / md:grid-cols-2 / sm:grid-cols-1
6. ① 完成率 — 数值与 phase 1 一致
7. ② 归一化均分 — 数值与 phase 1 一致
8. ③ **待发布** — 数值 = `count(submission WHERE taskInstance.dueAt < now() AND releasedAt IS NULL AND scope filter)`，**与 SQL 手算一致**
9. ④ 风险章节 — 数值与 phase 1 一致
10. ⑤ 风险学生 — `unique studentIds in studentInterventions`（三种 reason 都算），**与手算一致**（应 ≥ phase 1 的「低掌握人数」）
11. KPI 卡支持 `onClick` / `href` props（phase 5 接 drawer，phase 2 props 已留）
12. KPI 卡视觉与 [kpi-stat-card](components/dashboard/kpi-stat-card.tsx) 风格一致（icon 圆角 / 字号 / 边距）

### C. recharts 引入
13. `package.json` 新增 `recharts` 依赖（其他依赖不变）
14. `components/ui/chart.tsx` 存在 + 导出 `ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartLegend`/`ChartLegendContent`/`ChartConfig` 类型
15. ScoreDistributionChart 用 `next/dynamic` + `ssr: false`
16. `npm run build` 后 First Load JS（route /teacher/analytics-v2）diff < 150KB gzip vs phase 1 baseline

### D. 学生成绩分布柱状图（区块 A）
17. 区块 A 渲染在 KPI 行下方、热力图上方
18. 区间默认 5 段（0-20 / 20-40 / 40-60 / 60-80 / 80-100），右上 Select 可切 5/10
19. localStorage key `insights:score-distribution-bins` 持久化偏好
20. 单任务 filter（filter 选 taskInstance）→ scope `single_task`，柱高=该任务每区间学生数
21. 多任务（默认）→ scope `multi_task`，柱高=每区间学生数（按学生 scope 内均分）
22. 多班选中 → 分组柱（每区间 N 班并排），色用 brand / ochre / success / sim / brand-violet
23. 单班选中 → 单色 brand
24. 鼠标 hover 柱子 → tooltip 白底 + border + shadow，显示「班级 / 学生数 / 区间」
25. 点击柱子 → console.log(bin, classId)，cursor pointer（drawer 在 phase 4）
26. 空数据 → EmptyInline「当前范围暂无已批改 submission」

### E. 视觉风格一致性（用户明确要求）
27. 图表配色走 design token，**不出现 recharts 默认蓝色** `#8884d8`（grep 验证 + 视觉验证）
28. 图表容器 `<Card rounded-lg border>` 与 KPI 卡一致
29. Tooltip 视觉与 [Popover](components/ui/popover.tsx) 一致（白底 + border + shadow-md + rounded-lg）
30. 字号：轴标签 text-xs / 图例 text-xs / tooltip text-sm
31. ARIA label 中文 `"学生成绩分布柱状图，X 轴分数区间，Y 轴学生人数，按班级分组"`

### F. 8 Tabs 全功能回归（不破坏）
32. 8 个 tab 全部仍能渲染数据，多班选中时为聚合视图
33. 章节×班级热力图、行动清单仍正常显示
34. 重置筛选按钮仍工作

### G. 与单实例洞察隔离
35. 单实例 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx) 不受影响
36. teacher dashboard 不受影响

## Risks / 反退化清单

| 风险 | 触发场景 | 防御 |
|---|---|---|
| recharts 默认蓝色泄漏 | 忘了在 chart config 里 set color | grep `#8884d8` + 视觉 QA |
| 待发布 SQL 错算 | scope filter 用错（如忘 chapterId/classIds） | 复用 buildInstanceWhere 同 filter |
| dueAt 时区错位 | dueAt 存 UTC，比较 now() 时区不对 | Prisma 自动用 UTC，前端不参与；用 `new Date()` 即可 |
| Bundle size 暴涨 | recharts 全量 import | `import { BarChart, Bar, XAxis, ... } from 'recharts'` 命名导入；dynamic + ssr false |
| KPI 卡 phase 1 → phase 2 数值跳变让 user 怀疑 | 「待批改」改名「待发布」语义变 | KPI 卡 sub 字段写明「DDL 已到未发布」+ 旧 pendingGrading 删除 |
| 多班并排 5 色超 | scope 选了 6+ 班 | 循环用色（实际不太可能 6 班同选），不报错即可 |

## QA 验证手段

### 必做
1. `npx tsc --noEmit` / `npm run lint` / `npx vitest run` / `npm run build`
2. **真浏览器** via gstack `/qa-only`：
   - dev server 在 worktree 内启动 `next dev -p 3031`（沿用 phase 1 模式，确保拿到 worktree 改动而非 main repo 旧版）
   - teacher1 登录 → /teacher/analytics-v2
   - 验 acceptance #5-#34 全部
   - 单班 / 多班 / 单实例 / 全部 4 种 filter 组合切换
   - 区间 5/10 段切换 + 刷新看 localStorage 持久
   - 点柱子看 console.log
   - 截图 ≥ 6 张存 `/tmp/qa-insights-phase2-*.png`：KPI 5 卡 / 区块 A 单班 / 区块 A 多班 / 区间切换 / hover tooltip / 8 Tabs 回归
3. **数据正确性**：
   - 手算「待发布」= `psql` 直查 `count(*)` 与 KPI 数字对比
   - 手算「风险学生」= unique `studentInterventions[].studentId` 与 KPI 数字对比
4. **bundle size**：`npm run build` 取 `.next/build-manifest.json` route /teacher/analytics-v2 First Load JS，与 phase 1 commit `0f823d0` 比 diff < 150KB

### 跳过项
- ❌ 端到端 e2e（phase 6 才做）
- ❌ Prisma 三步（无 schema 改动）
- ❌ /cso（无安全敏感改动）

## 提交策略

Phase 2 atomic commit，message：
```
feat(insights): phase 2 — KPI 5 cards new definition + score distribution chart (recharts)

- KPI 5 卡新定义：「待批改」→「待发布」(dueAt < now AND releasedAt null)；
  独立「风险学生」(unique studentInterventions, 三种 reason 全算)
- 引入 recharts + 新建 components/ui/chart.tsx (shadcn chart wrapper, design token)
- 新建 components/analytics-v2/kpi-row.tsx (5 KPI cards, lg:cols-5)
- 新建 components/analytics-v2/score-distribution-chart.tsx (dynamic import)
  - 分组柱状图，多班分色 (brand/ochre/success/sim/brand-violet)
  - 区间切 5/10 段 + localStorage 持久
  - 点击柱触发 onClick (phase 4 接 drawer)
  - ARIA label 中文 + tooltip 视觉一致 Popover
- service 新增 computeScoreDistribution + kpis.pendingReleaseCount
- 8 Tabs 全保留 (phase 3 才删)

QA: r{N} PASS (M/M acceptance, tsc/lint/vitest 全绿, bundle <150KB)
See plan: ~/.claude/plans/main-session-snug-tide.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

完成后我（coordinator）写 chore commit 更新 HANDOFF.md。
