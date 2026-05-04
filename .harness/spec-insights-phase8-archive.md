# Spec — 数据洞察 Phase 8：布局重构 + 字体紧凑 + 模块内 polish

> Phase 1-7 已 commit (`0f823d0` ... `ced2802`)，PR #1 已 push 12 commits。本 spec 仅负责 Phase 8。

## Unit 标识
- `insights-phase8`，build/qa 报告 r1, r2...
- Dynamic exit：2 PASS 收工 / 同 fail 3 轮回 spec / 不跑保险轮

## 用户原话（最新反馈）

> "目前这个布局不太好, 虽然必要时 每个模块上下滑动,但不代表 默认的情况下很难显示完整. 需要进一步高效利用空间"

> "学生成绩分布 5段区间 这颗悬着移动到第一行, 查看学生成绩详情放在底部不占用空间. 这个柱状图尽量在默认视图可以显示完整 而不需要上下滑动 每个区间的人数直接显示"

> "任务表现这里 全部simulation任务 也放在第一行 ... 合并使用Study buddy这个位置, 低分和高分可以同时分两列显示"

> "study buddy 移动到学生成绩分布下面, 第二行, 相当于 学生成绩分布和study buddy占比不超过1/3, 任务表现和AI 教学建议占比不低于2/3"

> "AI教学建议布局需要优化, 缓存时间 和下面实际4模块内容中间不应该有空"

> "可以调整各模块字体大小,让整体显示更有效率"

## 当前 Baseline（phase 7 收官状态）
- 分支 `claude/elastic-davinci-a0ee14`，**12 commits ahead**，已 push origin
- 主体布局：3 列横向（学生成绩分布 / 任务表现 / Study Buddy）每列等宽
- 字体：`text-2xl`（KPI 主值）/ `text-base`（卡标题）/ `text-sm`（描述+正文）/ `p-4` padding
- AI 建议：底部全宽 4 列，CardHeader 与 CardContent 之间有 gap
- 数据质量：底部 collapsible

## Phase 8 范围

### ✅ 必须做的 7 件事

#### 1. 主体布局：3 列横向 → **左 1/3 上下分 + 右 2/3 跨两行**

[components/analytics-v2/analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) 主体 grid 重构：

```tsx
<div className="flex-1 grid grid-cols-3 grid-rows-2 gap-3 overflow-hidden min-h-0">
  {/* 左上 1/3 */}
  <ScoreDistributionPanel className="col-start-1 row-start-1 overflow-hidden flex flex-col" />
  
  {/* 左下 1/3 */}
  <StudyBuddyPanel className="col-start-1 row-start-2 overflow-hidden flex flex-col" />
  
  {/* 右侧 2/3 跨两行 */}
  <TaskPerformancePanel className="col-start-2 col-end-4 row-start-1 row-end-3 overflow-hidden flex flex-col" />
</div>
```

实现要点：
- 左侧 1 列宽 = 1/3，右侧 2 列宽 = 2/3
- 左侧上下 2 行各占 1/2 高（学生成绩分布 + Study Buddy）
- 右侧任务表现单独占据 2 行高度（信息密度匹配 user 反馈）
- 每个 panel `flex flex-col` 让内部 CardHeader / CardContent / CardFooter 正确分配高度
- 所有 panel `overflow-hidden`，CardContent 内部 `overflow-y-auto`

**< lg 视口（< 1024px）回退**：3 panels 单列 stack（仍允许页面滚动 mobile fallback）。

#### 2. 学生成绩分布 polish

改造 [components/analytics-v2/score-distribution-chart.tsx](components/analytics-v2/score-distribution-chart.tsx)：

**Header 同行紧凑**：
```tsx
<CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
  <CardTitle className="text-sm font-medium">学生成绩分布</CardTitle>
  <div className="flex items-center gap-1.5">
    <Select size="sm">5 段区间</Select>           {/* 移到 header */}
    <ToggleGroup size="sm">单 / 多班级</ToggleGroup>
  </div>
</CardHeader>
```

**柱状图区间数字直接显示**（user 明确要求）：
```tsx
<Bar dataKey="count" radius={[4,4,0,0]} fill={...}>
  <LabelList dataKey="count" position="top" className="text-xs fill-foreground" />
</Bar>
```
- 柱顶显示**人数 count**（不是 percent，user 原话「每个区间的人数直接显示」）
- 多班级对比时每个柱子分别显示 count
- 即使值为 0 也显示 `0` 标签（让 0 区间也明确）

**Footer 链接放底部**：
```tsx
<CardFooter className="pt-2 border-t">
  <Link className="text-xs text-muted-foreground hover:text-foreground">
    查看学生成绩详情 →
  </Link>
</CardFooter>
```

**默认视图柱状图完整显示**（不需要滑动）：
- 容器高度 ~280-340px (受 grid 1/2 高约束)
- 柱状图 `<ResponsiveContainer width="100%" height="100%">` 自适应
- X 轴标签 `text-xs` 字体收紧
- Y 轴**省略**（柱顶 LabelList 已显数值）或保留但 ticks 减少

#### 3. 任务表现 polish — **2 列并排（高分 + 低分）**

改造 [components/analytics-v2/task-performance-block.tsx](components/analytics-v2/task-performance-block.tsx)：

**Header 同行（任务 dropdown + 重新生成）**：
```tsx
<CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
  <div className="flex items-center gap-1.5">
    <Sparkles className="size-3.5 text-brand" />
    <CardTitle className="text-sm font-medium">任务表现 (Simulation)</CardTitle>
  </div>
  <div className="flex items-center gap-1.5">
    <Select size="sm" className="w-48">全部 simulation 任务</Select>
    <Button size="sm" variant="ghost"><RefreshCw className="size-3.5" /> 重新生成</Button>
  </div>
</CardHeader>
```

**Content 改 grid-cols-2**（高分 + 低分并排）：
```tsx
<CardContent className="flex-1 pt-0 overflow-hidden">
  <div className="grid grid-cols-2 gap-3 h-full">
    {/* 左：高分典型表现 */}
    <div className="bg-success/5 border-l-2 border-success rounded-r p-2.5 overflow-y-auto">
      <h4 className="text-xs font-medium text-success-deep mb-2 flex items-center gap-1">
        <CircleCheck className="size-3" /> 高分典型表现
      </h4>
      <div className="space-y-2">
        {highlights.slice(0, 4).map(h => (
          <button onClick={() => openEvidence(h)} className="block w-full text-left text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{h.studentName}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">{h.normalizedScore}分</Badge>
            </div>
            <p className="text-muted-foreground line-clamp-2 mt-0.5">"{h.transcriptExcerpt}"</p>
          </button>
        ))}
      </div>
    </div>
    
    {/* 右：低分共性问题 */}
    <div className="bg-destructive/5 border-l-2 border-destructive rounded-r p-2.5 overflow-y-auto">
      <h4 className="text-xs font-medium text-destructive mb-2 flex items-center gap-1">
        <CircleAlert className="size-3" /> 低分共性问题
      </h4>
      <div className="space-y-2">
        {issues.slice(0, 4).map(i => (
          <button onClick={() => openEvidence(i)} className="block w-full text-left text-xs">
            <div className="flex items-start gap-1.5">
              <Badge variant="destructive" className="text-[10px] h-4 px-1 shrink-0">×{i.frequency}</Badge>
              <span className="font-medium">{i.title}</span>
            </div>
            <p className="text-muted-foreground line-clamp-2 mt-0.5">{i.description}</p>
          </button>
        ))}
      </div>
    </div>
  </div>
</CardContent>
```

**Footer 链接**：
```tsx
<CardFooter className="pt-2 border-t">
  <Link className="text-xs text-muted-foreground hover:text-foreground">查看任务详情 →</Link>
</CardFooter>
```

#### 4. Study Buddy 紧凑化（移到左下）

改造 [components/analytics-v2/study-buddy-block.tsx](components/analytics-v2/study-buddy-block.tsx)：
- 保持 Table 形式
- 紧凑字体（text-xs）+ 减少 row 高度
- 因为左侧 1/3 宽度 + 1/2 高度（约 280-340px），top-3 或 top-4 即可（不强求 5）
- Header `pb-2` 紧凑

```tsx
<CardHeader className="pb-2">
  <CardTitle className="text-sm font-medium flex items-center gap-1.5">
    <MessageCircleQuestionMark className="size-3.5 text-brand" />
    Study Buddy 共性问题
  </CardTitle>
</CardHeader>
<CardContent className="flex-1 pt-0 overflow-y-auto">
  <Table>
    <TableHeader>
      <TableRow className="text-xs">
        <TableHead className="h-7 text-xs">章节/节</TableHead>
        <TableHead className="h-7 text-xs">典型问题</TableHead>
        <TableHead className="h-7 text-xs text-right w-12">次数</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {questions.slice(0, 5).map(q => (
        <TableRow className="text-xs cursor-pointer" onClick={() => openDrawer(q)}>
          <TableCell className="py-1.5 text-muted-foreground">{q.sectionLabel}</TableCell>
          <TableCell className="py-1.5">{q.text}</TableCell>
          <TableCell className="py-1.5 text-right tabular-nums">{q.count}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</CardContent>
<CardFooter className="pt-2 border-t">
  <Link className="text-xs text-muted-foreground hover:text-foreground">查看全部对话 →</Link>
</CardFooter>
```

#### 5. AI 教学建议 polish — 消除 header/content 之间 gap

改造 [components/analytics-v2/teaching-advice-block.tsx](components/analytics-v2/teaching-advice-block.tsx)：

**问题**：当前 phase 7 实装中 CardHeader 和 CardContent 之间有视觉 gap（user 反馈"缓存时间和下面实际 4 模块内容中间不应该有空"）

**修复**：
```tsx
<Card className="rounded-lg">
  <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
    <div>
      <CardTitle className="text-sm font-medium flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-brand" />
        AI 教学建议
      </CardTitle>
      <CardDescription className="text-xs mt-0.5">
        缓存 · {generatedAt} · {sourceLabel}
      </CardDescription>
    </div>
    <Button size="sm" variant="ghost"><RefreshCw className="size-3.5" /> 重新生成</Button>
  </CardHeader>
  <CardContent className="pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
    {/* 4 列 */}
    <AdviceColumn title="知识目标" icon={Lightbulb} className="text-brand" items={knowledgeGoals} />
    <AdviceColumn title="教学方式" icon={BookOpen} className="text-success" items={pedagogyAdvice} />
    <AdviceColumn title="关注群体" icon={Users} className="text-brand-violet" items={focusGroups} />
    <AdviceColumn title="接下来怎么教" icon={ArrowRight} className="text-ochre" items={nextSteps} />
  </CardContent>
</Card>
```

关键：
- `<CardHeader pb-2>` + `<CardContent pt-0>` 让两者紧贴（消除 default `pb-3 + pt-3 = 6` gap）
- 4 列布局保留（不合并 nextSteps）
- 每列内部 overflow-y-auto 约束高度

#### 6. KPI 4 卡字体紧凑

[components/analytics-v2/kpi-row.tsx](components/analytics-v2/kpi-row.tsx)：
- KPI 主值：`text-2xl` → `text-xl`（仍醒目）
- KPI 标签：`text-sm` → `text-xs`
- KPI 副标 (sub)：`text-xs` 保持
- delta 文案：`text-xs` 保持
- Card padding：`p-4` → `p-3`
- Sparkline 高度：保持 28px（已紧凑）

整体高度从 ~140px → ~115-125px（节省 ~20px 给主体）。

#### 7. Header 和数据质量字体微调

[components/analytics-v2/insights-filter-bar.tsx](components/analytics-v2/insights-filter-bar.tsx)：
- H1：保持 `text-xl font-semibold`（页面级标题）
- sub：保持 `text-xs text-muted-foreground`
- Filter dropdown：`size="sm"` 保持（已紧凑）

[components/analytics-v2/analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) DataQualityCollapsible：
- trigger：`text-xs` 保持
- 展开内容：`text-xs` 保持

### ❌ 必须不做的 6 件事

1. ❌ 不动 Prisma schema / service / API（**纯前端 layout + 字体**）
2. ❌ 不实装 quiz/subjective 任务表现（user 提到的 future work）
3. ❌ 不实装知识点统计（user 提到的 future work）
4. ❌ 不引入新 npm 依赖
5. ❌ 不动 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx) / teacher dashboard
6. ❌ 不动 entity vs filter classIds 边界 / defaultClassIdsAppliedRef + courseId guard

## Acceptance Criteria

### A. 类型与构建
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过
3. `npx vitest run` 819+ cases（phase 7 baseline 819 不少，本 phase 不加测）
4. `npm run build` 成功
5. **不引入新 npm 依赖**（package.json 0 改动）

### B. 主体布局重构（用户最关键反馈）
6. 主体 grid 2 行 3 列（`grid-cols-3 grid-rows-2`），任务表现 `col-start-2 col-end-4 row-start-1 row-end-3` 跨 2 行 2 列
7. 学生成绩分布在左上 1/3（`col-start-1 row-start-1`）
8. Study Buddy 在左下 1/3（`col-start-1 row-start-2`）
9. 任务表现占据右 2/3 + 跨两行高
10. 左侧（学生成绩分布 + Study Buddy）总宽 = 1/3
11. 右侧（任务表现）宽 = 2/3
12. < lg 视口自动 stack 单列 fallback

### C. 学生成绩分布 polish
13. 「5 段区间」selector 移到 CardHeader 同行右侧
14. 「单/多班级 ToggleGroup」也在 CardHeader 同行（之前 phase 7 已是）
15. **柱顶直接显示 count 数值**（用 `<LabelList dataKey="count" position="top">`）
16. 「查看学生成绩详情 →」link 移到 CardFooter（不占主体空间）
17. 默认视图（无 scroll）柱状图完整显示（QA 1440x900 截图证）

### D. 任务表现 2 列并排
18. CardHeader 同行：标题 + 任务 dropdown + 重新生成按钮
19. CardContent 内部 `grid-cols-2`：左高分典型 + 右低分共性问题
20. 高分典型 section bg-success/5 + border-l-2 border-success
21. 低分共性问题 section bg-destructive/5 + border-l-2 border-destructive
22. 每例显示：学生名 + 分数 badge + 原话片段（line-clamp-2）/ 问题 title + ×N badge + description
23. row click → evidence-drawer
24. 「查看任务详情 →」link 移到 CardFooter

### E. Study Buddy 紧凑（左下）
25. 移到左下位置（grid col-start-1 row-start-2）
26. Table 形式保留（章节/节 | 典型问题 | 提问次数）
27. 字体 `text-xs`，行高 `py-1.5`
28. top-5 显示（如果空间不足 top-3，建议优先 top-5）
29. 「查看全部对话 →」link 在 CardFooter

### F. AI 教学建议 gap 修复
30. CardHeader `pb-2` + CardContent `pt-0`，两者紧贴无 gap
31. 4 类全保留（知识目标 / 教学方式 / 关注群体 / 接下来怎么教）
32. 4 列横向布局（lg:grid-cols-4）
33. 每条主文 + 「展开依据」collapsible 仍工作

### G. 字体紧凑
34. KPI 主值 `text-xl`（从 text-2xl 缩）
35. CardTitle `text-sm`（从 text-base 缩）
36. CardDescription `text-xs`
37. 内容文本 `text-xs`（除 transcript 等阅读重点保持 text-sm）
38. Card padding `p-3` 或 `p-2.5`（从 p-4 缩）

### H. 单屏 UX（继承 phase 7 硬约束）
39. **1440x900** 整页可见无页面滚动（QA 截图证）
40. **1280x720** 同
41. **1024x768** 同
42. 模块超出用 module-level overflow-y-auto

### I. Phase 1-7 anti-regression
43. KPI 4 卡数字与 phase 7 一致（完成率 / 归一化均分 / 待发布 / 风险信号合并 + Sparkline + delta + onClick drawer）
44. 区块 A bar fill `var(--color-{classId})` CSS 变量（grep `#8884d8` 0 命中）
45. ToggleGroup 单/多班级仍工作
46. 任务级 dropdown 仍工作
47. defaultClassIdsAppliedRef + courseId guard 完整保留
48. entity vs filter classIds 边界
49. localStorage 最近课程仍工作
50. 老 URL `?classId=A` / `?tab=overview` 兼容
51. 老 `/teacher/analytics` 仍 302 redirect
52. 单实例 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx) 视觉/功能 0 改动
53. teacher dashboard 不受影响
54. LLM 24h scopeHash 缓存 + 失败兜底 4 类
55. evidence-drawer 三类 + score_bin 全工作
56. Filter 紧凑布局 phase 7 保留（H1 + 班级 + 章节 + 详细筛选 popover）
57. 数据质量底部 collapsible 默认折叠

## Risks

| 风险 | 防御 |
|---|---|
| 任务表现跨 2 行高度过大导致内容稀疏 | grid-cols-2 高分+低分并排已填充宽度；如视觉空虚加数量上限 5 例 |
| 学生成绩分布 1/2 高度不够柱状图完整显示 | ResponsiveContainer 自适应 + Y 轴减少 ticks + 柱顶 LabelList |
| Study Buddy 1/3 宽度 Table 列太挤 | 章节列 truncate w-32 + 问题列 line-clamp-1 + 次数列 w-12 |
| LabelList 在 0 值柱子上挤压视觉 | LabelList 只在 count > 0 时显示（条件渲染）或显示 `0` 但小字 |
| 字体过小影响阅读 | text-xs 是最小阈值，不再缩；保留 transcript / evidence 内容 text-sm |
| AI 4 列 pt-0 后视觉过紧 | 用 `pb-2 + pt-0 + gap-3` 平衡，gap 给列间间距 |
| col-span 跨行布局在 < lg 视口 break | < lg 用 flex-col stack（`<lg:flex-col`）|

## QA 验证

### 必做
1. tsc / lint / vitest（≥ 819）/ build
2. 真浏览器 via gstack `/qa-only`：
   - 1440x900 / 1280x720 / 1024x768 三视口整页可见
   - 主体布局：左上学生成绩分布 + 左下 Study Buddy + 右侧任务表现跨两行
   - 学生成绩分布：5 段区间在 header + 柱顶 count + footer 链接
   - 任务表现：2 列并排高分+低分 + 任务 dropdown 在 header + footer 链接
   - AI 教学建议：header 与 4 列内容紧贴无 gap
   - 字体紧凑（KPI text-xl / CardTitle text-sm / 内容 text-xs）
   - 截图 ≥ 8 张 `/tmp/qa-insights-phase8-*.png`：1440 整页 / 1280 整页 / 1024 整页 / 学生分布柱顶 count / 任务表现 2 列 / AI gap 修复 / Study Buddy 紧凑 / 字体对比
3. **数据正确性**：phase 7 KPI 数字保持
4. Anti-regression：所有 phase 1-7 功能保留

### 跳过
- ❌ Prisma 三步（无 schema 改动）
- ❌ Service 单测扩展（不动 service）
- ❌ Bundle size（不引入新 deps）

## 提交策略

Phase 8 atomic commit 1 个（layout polish 不需要拆分）：

```
feat(insights): phase 8 — layout density + module reflow + font compaction

- Main grid 3 列横向 → 2 行 3 列 (col-3 grid-rows-2):
  - 学生成绩分布: col-1 row-1 (左上 1/3)
  - Study Buddy: col-1 row-2 (左下 1/3)
  - 任务表现: col-2 row-1/3 (右 2/3 跨两行高)
- 学生成绩分布: 5 段 + ToggleGroup 移 CardHeader; 柱顶 LabelList(count)
  显示人数; 「查看学生成绩详情 →」移 CardFooter
- 任务表现: 任务 dropdown + 重新生成 移 CardHeader; CardContent grid-cols-2
  并排显示「高分典型 (左 bg-success/5)」+「低分共性问题 (右 bg-destructive/5)」;
  「查看任务详情 →」移 CardFooter
- Study Buddy: 移到左下位置, 紧凑 Table (text-xs + py-1.5 + top-5)
- AI 教学建议: CardHeader pb-2 + CardContent pt-0 消除 gap (user 反馈
  缓存时间和 4 模块内容中间不应该有空); 4 列 4 类全保留
- 字体紧凑: KPI 主值 text-2xl→text-xl; CardTitle text-base→text-sm;
  CardDescription text-xs; 内容 text-xs (transcript 保 text-sm); padding
  p-4→p-3
- < lg 视口 fallback: panels stack 单列允许页面滚

Phase 1-7 anti-regression preserved (KPI sparkline + delta + drawer 5 kinds,
filter 紧凑 + scopeTags row 删, ToggleGroup, classIds guard,
recharts CSS var, LLM 24h cache, 单实例隔离, teacher dashboard 隔离)。

QA: r1 PASS X/X (tsc/lint/vitest 819+/build 全绿)
- 1440/1280/1024 三视口整页可见 0 overflow
- 主体 grid 跨行布局任务表现占右 2/3 + 学生分布+Study Buddy 占左 1/3
- 柱顶 count 直接显示 + AI gap 消除
- Phase 1-7 全功能保留

See plan: ~/.claude/plans/linked-wobbling-anchor.md
See spec: .harness/spec.md
See QA: .harness/reports/qa_insights-phase8_r1.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

每 commit 后 tsc / lint / vitest / build 全过。

QA PASS 后 builder 1 个 atomic commit + push origin。PR #1 最终 13 commits（6 phase + 2 chore + 4 phase 7 + 1 phase 8）。

## 用户提到的 future work（不在本 phase）

- 答题任务（quiz）也可以有任务表现（与 simulation 同模式）
- 未来与每章知识点结合：统计**薄弱知识点 + 掌握较好的知识点**
- 这是 phase 9+ 的事，本 phase 仅 simulation
