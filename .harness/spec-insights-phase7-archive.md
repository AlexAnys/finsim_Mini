# Spec — 数据洞察 Phase 7：高密度单屏重设计

> Phase 1-6 已 commit (`0f823d0` ... `90969f4`)，PR #1 开。本 spec **仅** 负责 Phase 7。
> 完整 plan：`~/.claude/plans/linked-wobbling-anchor.md`。

## Unit 标识
- `insights-phase7`，build/qa 报告 r1, r2...
- Dynamic exit：2 PASS 收工 / 同 fail 3 轮回 spec / 不跑保险轮

## 用户原话（最终确认）

> "目前这版空间利用率依然很差, 请参考这个图片, 并回忆下我之前的需求, 形成一个新的计划. 颜色可以适当设计符合应用的色彩,但图片和数据分析的方向,以及空间利用率可以参考图片中的布局. 包括其中的功能也需参考,比如多班级对比, 任务详情等. 目前这个数据质量提示可以放最下面, 另外默认可以显示最近浏览的一堂课,而不是每次进去是空白"

> "filter占用了过多不必要的空间, 直接在数据洞察右边的空白处 你看下如何利用好这个空间显示filter + 当前的filter. 单独的filter 可能只是班级 + 章节即可, 其他的可以是一个toggle的详细filter"

> "这个页面需要单屏都能看到, 每个模块的空间可以相对固定,如果显示不全的可以通过滑动来显示"

## 当前 Baseline
- 分支 `claude/elastic-davinci-a0ee14`，**7 commits ahead** of main `e311571`，已 push origin（PR #1）
- dashboard 现状：4 区块 2x2 grid（Filter 行 + DataQualityPanel 顶部 banner + KPI 5 卡 + InsightsGrid 4 区块）
- 所有 service / API / drawer / LLM 缓存机制完整（phase 4-6 实装）

## Phase 7 范围

### ✅ 必须做的 10 件事

#### 1. Filter 紧凑化（用户最关键反馈）

[components/analytics-v2/insights-filter-bar.tsx](components/analytics-v2/insights-filter-bar.tsx) 重构：

**布局**：H1 同行右侧紧凑 filter
```
┌──────────────────────────────────────────────────────────┐
│ 📊 数据洞察          [班级 金融2024A班 ▾] [章节 全部 ▾] [详细筛选 ▾(2)]│
│ 课程范围内的完成、掌握...                  更新于 05/03 19:09 │
└──────────────────────────────────────────────────────────┘
```

- **班级 dropdown**：保留 phase 1 multi-select popover + checkbox + 全选/取消（trigger 文本规则不变）
- **章节 dropdown**：单选 Select，options 来自 `diagnosis.filterOptions.chapters` + 「全部章节」
- **「详细筛选」按钮**：`<Button variant="outline" size="sm">详细筛选 <ChevronDown />` + Badge 数字（已修改字段数）
  - click → Popover (≈480px 宽) 含 4 个 dropdown：
    - **课程**（必选 — 配最近浏览课程默认）
    - **小节**（option 来自 `diagnosis.filterOptions.sections` 按 chapterId 过滤）
    - **任务**（option 来自 `diagnosis.filterOptions.taskInstances`）
    - **时间**（7d / 30d / term）
  - popover 底部：当前范围一行简短文字 + 「重置筛选」+「↻ 后台重算」按钮
- **删除 scopeTags 独立 row**（信息已搬进 popover；`buildScopeTags` helper 保留供 popover 使用）

**Filter 顺序**（详细 popover 内部）：课程 → 小节 → 任务 → 时间

**header 高度**：从 ~150px 压缩到 ~70px（节省 ~80px 给主体）

#### 2. localStorage 最近浏览课程

[components/analytics-v2/analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) 加 useEffect：
- key: `insights:last-course:${userId}`（依赖 session userId）
- 读：URL 无 `courseId` 且 storage 有值且课程在 `coursesAvailable` → `onReplaceQuery({ courseId: stored })`
- 写：`courseId` 变化时 `localStorage.setItem(key, courseId)`
- 与 phase 1 `defaultClassIdsAppliedRef` race guard 不冲突

#### 3. KPI 4 卡（合并风险信号 + Sparkline + 周对比 delta）

[components/analytics-v2/kpi-row.tsx](components/analytics-v2/kpi-row.tsx) 重构：

| 卡 | 主值 | sub | sparkline | 周对比 / 行动 |
|---|---|---|---|---|
| 完成率 | `23.1%` | `9/39 人次` | LineChart 12 周 | `较上周 +3.2pp ↑` |
| 归一化均分 | `62.7 分` | `中位数 58 分` | LineChart 12 周 | `较上周 +4.8 分 ↑` |
| 成绩待发布 | `12 项` | `涉及 3 个任务` | 无 | `去发布 →` link → 跳批改页 |
| 风险信号 | `2 章节 \| 6 学生` | `点击查看详情 →` | 无 | `bg-destructive/10` 暖背景 |

- 5 卡 → 4 卡（合并风险章节 + 风险学生 → 风险信号）
- 完成率 / 归一化均分 卡内右侧加 [components/analytics-v2/sparkline.tsx](components/analytics-v2/sparkline.tsx)（**新建**，dynamic import recharts LineChart）
- delta helper `formatWeekDelta(current, previous)` → `+3.2pp ↑` / `-1.5 分 ↓` / `—`（previousWeek null 时 em-dash）
- 风险信号卡 onClick → drawer kind=`risk_chapter` 列章节 + `risk_student` 列学生（合并展示，可加 sub-tabs 切换；或单独 drawer 列两类）

#### 4. Service 扩展 [analytics-v2.service.ts](lib/services/analytics-v2.service.ts)

```ts
kpis: {
  // 现有字段保留
  weeklyHistory: Array<{ weekStart: string, completionRate: number | null, avgNormalizedScore: number | null }>,  // 最近 12 周
  previousWeekCompletionRate: number | null,
  previousWeekAvgScore: number | null,
  pendingReleaseTaskCount: number,        // unique taskInstanceIds
}
```

实现：
- 复用 `instanceMetrics` 已有 submissions 集合，按 `submission.submittedAt` 周维度 group（不二次 DB 查询）
- weekStart 取每周一 00:00（UTC）
- 取最近 12 周（含本周 + 前 11 周），缺失周填 null
- previousWeek* = weeklyHistory[10] (上周)
- currentWeek 默认是 weeklyHistory[11] (本周)
- pendingReleaseTaskCount = `unique(submissions.where(dueAt < now AND releasedAt is null).map(s => s.taskInstanceId))`

#### 5. 主体 3 列单屏布局

新建 [components/analytics-v2/analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) 主容器：
```tsx
<div className="flex flex-col h-[calc(100vh-var(--header-h))] overflow-hidden gap-3">
  {/* shrink-0 - Compact filter header (~70px) */}
  <CompactFilterHeader />
  
  {/* shrink-0 - KPI 4 cards (~140px) */}
  <KpiRow />
  
  {/* flex-1 min-h-0 - 3 columns scroll inside */}
  <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 overflow-hidden min-h-0">
    <ScoreDistributionPanel />
    <TaskPerformancePanel />
    <StudyBuddyPanel />
  </div>
  
  {/* shrink-0 - AI advice 4 cols (~280px) */}
  <TeachingAdvicePanel />
  
  {/* shrink-0 - Data quality collapsible (~50px collapsed) */}
  <DataQualityCollapsible />
</div>
```

- `h-[calc(100vh-var(--header-h))]` + `overflow-hidden` 防页面级 scroll
- 主体 grid `flex-1 min-h-0` 让列可 shrink
- 每列内 `Card` 组件根 `h-full overflow-hidden`，内部 content `overflow-y-auto`
- 小屏 < lg → 自动 stack 单列，允许页面 scroll
- 删除 [components/analytics-v2/insights-grid.tsx](components/analytics-v2/insights-grid.tsx) + [coming-soon.tsx](components/analytics-v2/coming-soon.tsx)

#### 6. 区块 A：学生成绩分布

改造 [components/analytics-v2/score-distribution-chart.tsx](components/analytics-v2/score-distribution-chart.tsx)：
- 标题「学生成绩分布」+ sub「多任务筛选时，分布基于学生平均分」
- **右上 ToggleGroup**「单班级 / 多班级对比」（[components/ui/toggle-group.tsx](components/ui/toggle-group.tsx)，**需 `npx shadcn@latest add toggle-group`**）
  - 单班级：单色 `var(--color-brand)` 柱（filter 多班选中时取第一班）
  - 多班级对比：分组色（brand/ochre/success/sim/brand-violet 5 班循环，超出循环）
- 5/10 段切换保留（右上角 segmented 或 inline，避免 toggle 与 5/10 段挤占）
- **删除现有的下方 mini table**
- 占比 label：尝试 `<LabelList dataKey="percent" position="top" className="text-xs fill-muted-foreground" />`，**实施时若视觉杂乱拿掉**
- 「查看学生成绩详情 →」link → drawer (kind=`score_bin` — 加 risk-drawer)
- 容器 `Card` 内 `CardContent overflow-y-auto` 满足模块 scroll

#### 7. 区块 B：任务表现

改造 [components/analytics-v2/task-performance-block.tsx](components/analytics-v2/task-performance-block.tsx)：
- **删除 sub-tabs**（高分 / 低分切换），改成两个 section **inline 同屏显示**
- 标题「任务表现 (Simulation)」+ 右上**任务 dropdown**（区块级 select，scope 内 simulation taskInstances，默认第一个）
- **高分典型** section（`bg-success/5 border-l-2 border-success` 浅色块）
  - 3-4 例 inline：`<头像> 学生名 <Badge>92 分</Badge> · "原话片段..."`（line-clamp-2）
  - row 可 click → evidence-drawer `type: "highlight"`
  - 「查看全部 →」link
- **低分共性问题** section（`bg-destructive/5 border-l-2 border-destructive`）
  - 3-4 例 inline：`<icon> 问题 title · "原话样本..." · ×N 人 badge`
  - row 可 click → evidence-drawer `type: "issue"`
  - 「查看全部 →」link
- 「查看任务详情 →」link → 跳 [/teacher/instances/{id}/insights](app/teacher/instances/[id]/insights/page.tsx)
- 容器 overflow-y-auto

#### 8. 区块 C：Study Buddy 典型问题

改造 [components/analytics-v2/study-buddy-block.tsx](components/analytics-v2/study-buddy-block.tsx)：
- **Accordion → Table**（[components/ui/table.tsx](components/ui/table.tsx)）
- 表头：`章节/节 | 典型问题 | 提问次数`
- 每节 top-1 直接显示（避免 expand），最多 5 行总（可调整）
- row click → drawer `type: "studybuddy_question"`
- 「查看全部对话 →」link → drawer 列全部
- 容器 overflow-y-auto

#### 9. AI 教学建议底部 4 列横向

改造 [components/analytics-v2/teaching-advice-block.tsx](components/analytics-v2/teaching-advice-block.tsx)：
- 占据底部全宽（删除现 4 区块 D 位置）
- **4 列横向**（`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`）
- 4 类**保留全部**（不合并 nextSteps）：
  - 知识目标（Lightbulb 蓝 `text-brand`）
  - 教学方式（BookOpen 绿 `text-success`）
  - 关注群体（Users 紫 `text-brand-violet`）
  - 接下来怎么教（ArrowRight 橙 `text-ochre`）
- 每条：主文 + 「展开依据」collapsible（保留现 phase 5 模式）
- 每列内部 `overflow-y-auto`（约束底部高度 ~280px）
- 卡 header generatedAt + source Badge（缓存/已生成/降级）+ 重新生成按钮位置不变
- **LLM prompt 不变**（仍输出 4 类，phase 5 cache 兼容）

#### 10. 数据质量提示底部 collapsible

[components/analytics-v2/analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) 内 DataQualityPanel 移位：
- 从顶部 banner 移到最底部
- 默认折叠：trigger button「数据质量提示 (4 项) <ChevronDown>」
- 展开后显示现有 DataQualityPanel 全部 flags
- 收起时仅 ~50px

### ❌ 必须不做的 7 件事

1. ❌ 不动 Prisma schema
2. ❌ 不动 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx) / teacher dashboard
3. ❌ 不动 entity vs filter classIds 边界
4. ❌ 不动 `defaultClassIdsAppliedRef + courseId guard`
5. ❌ 不引入新 npm 依赖（recharts 已有；shadcn toggle-group 是现有项目 CLI add，无 npm install）
6. ❌ **不做底部 6 tabs / 顶部「方案 A」/ 导出报告**（连 placeholder 都不放，phase 8 才考虑）
7. ❌ **不做每周成绩趋势折线图**（service 端 `weeklyHistory` 数据预留即可，UI 不做）

## Acceptance Criteria

### A. 类型与构建
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过
3. `npx vitest run` ≥ 816 cases（phase 6 baseline 811 + 新增 ≥ 5：sparkline / weekly delta / score_bin drilldown）
4. `npm run build` 成功
5. 不引入新 npm 依赖（package.json `git diff` 仅 toggle-group 相关 import 增加，无 dependencies 数组改动）

### B. Filter 紧凑化（用户最关键反馈）
6. H1「数据洞察」+ 紧凑 filter **同一行**显示（lg 视口）
7. 班级 dropdown + 章节 dropdown 始终显式可见（多选 popover + checkbox 保留）
8. 「详细筛选 ▾」trigger 显示 Badge 数字（已修改字段数，默认 0 不显 Badge）
9. 「详细筛选」click 展开 popover：4 个 dropdown（课程 / 小节 / 任务 / 时间）+ 当前范围简短文字 + 重置筛选 + 后台重算
10. **scopeTags 独立 row 完全消失**（grep `scopeTags` 在 dashboard.tsx 下无独立 div / Card）
11. header 总高度 < 100px（实测：从原 ~150px 压缩到 ~70-80px）
12. 「重置筛选」点击 → URL classIds 清空 → 触发 phase 1 自动全选课程全部班
13. 「后台重算」按钮在 popover 内，触发现有 recompute API 工作

### C. 单屏 UX 硬约束
14. **1440x900** 视口：整页内容全部可见无页面滚动（QA 截图证）
15. **1280x720** 视口：同
16. **1024x768** 视口：同（最低支持）
17. 任意主体 3 列内容超出 → 该列内 scroll（不影响其他列 + 不影响页面）
18. 768 以下：自动 stack 单列，允许页面滚动（移动端 fallback）

### D. localStorage 最近课程
19. 清空 localStorage → 选课程 A → reload → 自动选 A
20. 切到课程 B → reload → 自动选 B
21. localStorage 课程已删除（无 access） → fallback 第一可访问课程
22. 与 phase 1 默认全部班 race guard 不冲突（先 set courseId → diagnosis 加载 → ref 触发自动选全部班）

### E. KPI 4 卡
23. 4 卡布局 lg:grid-cols-4
24. 完成率卡：主值 + sub + Sparkline + delta「较上周 +X pp ↑」/「-Y pp ↓」/「—」
25. 归一化均分卡：同上 + 「分」单位
26. 成绩待发布卡：主值「N 项」+ sub「涉及 X 个任务」+ 「去发布 →」link
27. 风险信号卡：合并显示「N 章节 \| M 学生」+ sub「点击查看详情 →」+ 暖背景
28. 4 卡 onClick 全打通（与 phase 5 drawer 衔接）
29. KPI 数字与 phase 6 一致（完成率 / 归一化均分 / 待发布 仍正确）

### F. 区块 A 学生成绩分布
30. ToggleGroup 单班级 / 多班级对比 切换工作（trigger 视觉 + 颜色变化）
31. 单班级模式：单色 `var(--color-brand)` 柱
32. 多班级对比：分组色（5 班循环 brand/ochre/success/sim/brand-violet）
33. **下方 mini table 完全消失**
34. 占比 label：实施时若视觉杂乱拿掉（不强制）
35. 5/10 段切换 + localStorage 持久仍工作
36. 「查看学生成绩详情 →」link → drawer kind=`score_bin` 列每区间学生

### G. 区块 B 任务表现
37. **删除 sub-tabs**，高分典型 + 低分共性问题 inline 同屏显示
38. 任务 dropdown（区块级，scope 内 simulation tasks，默认第一个）切换工作
39. 高分典型 3-4 例 inline，bg-success/5 浅色块
40. 低分共性问题 3-4 例 inline，bg-destructive/5 浅色块
41. row click → evidence-drawer
42. 「查看任务详情 →」link → 跳单实例 insights

### H. 区块 C Study Buddy
43. **Accordion → Table** 形式
44. 表头：章节/节 | 典型问题 | 提问次数
45. row click → drawer `type: "studybuddy_question"`

### I. 区块 D AI 教学建议
46. 占底部全宽（不再 4 区块右下）
47. 4 列横向（lg:grid-cols-4）
48. **4 类全保留**（知识目标 / 教学方式 / 关注群体 / 接下来怎么教）
49. 每列内部 overflow-y-auto
50. 「展开依据」collapsible 仍工作
51. 「重新生成」按钮工作（POST scope-insights）
52. 高度约束 ~280px（不撑爆主体 3 列）

### J. 数据质量提示底部
53. 从顶部 banner 移到最底部
54. 默认折叠（trigger 显示「数据质量提示 (N 项)」+ chevron）
55. 展开显示完整 flags

### K. Phase 1-6 anti-regression
56. KPI 数字与 phase 6 一致
57. 区块 A 5/10 段 + bar fill `var(--color-{classId})` CSS 变量（grep `#8884d8` 等默认色 0 命中）
58. defaultClassIdsAppliedRef + courseId guard 完整保留
59. entity vs filter classIds 边界完整
60. 老 URL `?classId=A` / `?tab=overview` 仍兼容
61. 老 `/teacher/analytics` 仍 302 redirect
62. 单实例 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx) 视觉/功能 0 改动
63. teacher dashboard 不受影响
64. LLM 24h scopeHash 缓存 + 失败兜底 4 类 schema 仍工作
65. evidence-drawer 三类（highlight / issue / studybuddy_question）+ 新加 score_bin 全工作

## Risks

| 风险 | 防御 |
|---|---|
| weekly bucketing 算法慢 | LIMIT 12 周 + 复用 instanceMetrics 不二次查 DB |
| Sparkline 渲染卡顿（2 KPI 卡 × 1 chart）| dynamic import + ssr false（同 phase 2 模式）|
| 删除 InsightsGrid 漏改某个 import | grep `InsightsGrid` 全仓 + tsc 0 errors gate |
| ToggleGroup shadcn add 失败 | fallback 用现有 [Tabs](components/ui/tabs.tsx) 模拟 segmented button |
| 单屏布局 overflow 计算错误（内容溢出页面）| QA 用 1440/1280/1024 三视口实测 + 加 min-h-0 给主体 grid |
| localStorage 课程不存在 | fallback 第一可访问课程，写入 localStorage 防错误 key 永久卡住 |
| Filter Popover 内部 Select 嵌套 z-index 问题 | 用 shadcn Popover 自带 layer + 高层 z-50 |
| 风险信号合并卡 onClick 不知打开哪个 drawer | 卡内 2 个独立 click 区域（章节区 / 学生区）或 drawer 内 sub-tabs 切换 |

## QA 验证

### 必做
1. tsc / lint / vitest（≥ 816 cases）/ build
2. 真浏览器 via gstack `/qa-only`：
   - dev server worktree 3031 重启（含新 sparkline + ToggleGroup 验证）
   - 全部 65 acceptance 逐条验证（特别 §B Filter 紧凑 + §C 单屏 UX）
   - 截图 ≥ 12 张 `/tmp/qa-insights-phase7-*.png`：
     - Filter 紧凑（含 popover 展开）× 2
     - KPI 4 卡 sparkline 特写 × 1
     - 1440x900 / 1280x720 / 1024x768 整页 × 3（验单屏）
     - 成绩分布 ToggleGroup 单 / 多 × 2
     - 任务表现 inline + drawer × 1
     - Study Buddy table × 1
     - AI 建议底部 4 列 × 1
     - 数据质量底部展开 × 1
3. 数据正确性：SQL 直查 weeklyHistory + previousWeek delta 与 UI 一致
4. Anti-regression：phase 6 commit `90969f4` 全功能保留，单实例 / dashboard 隔离

### 跳过
- ❌ Prisma 三步（无 schema 改动）
- ❌ Bundle size 详细对比（推测 < 30KB diff，仅复用 recharts）
- ❌ /cso

## 提交策略

按 plan §atomic 4 commits 拆分（每 < 300 行 diff），但 **builder 可以一个 build round 内全部完成**（不需要 4 round QA），最后做 4 atomic commits（保持 git history 干净）：

| Commit | 范围 |
|---|---|
| 1 | feat(insights): phase 7.1 — service 扩展 (weeklyHistory + previousWeek + pendingReleaseTaskCount + score_bin drilldown) + 单测 |
| 2 | feat(insights): phase 7.2 — KPI 4 卡 + Sparkline + 周对比 delta + 风险信号合并 + ToggleGroup shadcn add |
| 3 | feat(insights): phase 7.3 — Filter 紧凑 (header 同行 + 详细筛选 popover + 删 scopeTags) + 主体 3 列单屏 + 3 区块改造 (ToggleGroup / inline / Table) + module scroll + localStorage |
| 4 | feat(insights): phase 7.4 — AI 建议底部 4 列 + 数据质量底部 collapsible + 删 InsightsGrid + 删 coming-soon.tsx |

每 commit message 末尾加 `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`。

QA PASS 后 builder 一次性做 4 atomic commits（按上述顺序）；Coordinator 不需要每 commit 单独信号，QA verdict 后给 builder commit 信号即可。

PR #1 最终 12 commits（6 phase + 2 chore + 4 phase 7）。
