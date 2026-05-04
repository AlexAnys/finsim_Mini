# Build Report — insights-phase8 r1

**Date**: 2026-05-03
**Branch**: `claude/elastic-davinci-a0ee14`
**Builder**: claude-opus-4-7
**Round**: r1

## Summary

Phase 8 layout polish — 主体 grid 重构（左 1/3 上下分 + 右 2/3 跨两行），各 panel header 紧凑化（5 段 + ToggleGroup 移 header 同行 / 任务 dropdown 移 header），任务表现 grid-cols-2 并排高分+低分，Study Buddy 紧凑 Table，AI 教学建议消除 header/content gap，全局字体紧凑（KPI text-xl / CardTitle text-sm / 内容 text-xs / Card padding p-3）。

## What changed

### `components/analytics-v2/analytics-v2-dashboard.tsx`
主体 grid 重构（surgical 替换主体 grid 区块）：
```diff
- <div className="flex-1 min-h-0 grid grid-cols-1 gap-3 lg:grid-cols-3 overflow-hidden">
+ <div className="flex-1 min-h-0 grid grid-cols-1 gap-3 lg:grid-cols-3 lg:grid-rows-2 overflow-hidden">
+   <div className="flex flex-col overflow-hidden lg:col-start-1 lg:row-start-1">
      <ScoreDistributionChart ... />
+   </div>
+   <div className="flex flex-col overflow-hidden lg:col-start-1 lg:row-start-2">
      <StudyBuddyBlock ... />
+   </div>
+   <div className="flex flex-col overflow-hidden lg:col-start-2 lg:col-end-4 lg:row-start-1 lg:row-end-3">
      <TaskPerformanceBlock ... />
+   </div>
  </div>
```

### `components/analytics-v2/score-distribution-chart.tsx`（重写 ~80 行）
- Card 改 `gap-2 py-3`（覆盖 Card default `gap-6 py-6`），消除 header/content 多余 gap
- CardHeader 改 `grid grid-cols-[1fr_auto]` 单行：标题（含 inline 「N 名学生 · 单任务」副标）+ 5 段 select + ToggleGroup
- CardContent `flex-1 min-h-0 pt-0 pb-1 px-3` + ChartContainer `h-full w-full`（自适应填满），`margin.top: 16` 给 LabelList 留空间
- `<Bar>` 内嵌 `<LabelList dataKey="..." position="top" formatter={(v) => Number(v) > 0 ? String(v) : ""}>` — **柱顶显示人数**（user 关键反馈）
- 单班级模式 + 多班级模式都加 LabelList（多班级每柱独立显示）
- 0 值柱子不显示标签（formatter 返回空字符串）
- 新 CardFooter 「查看学生成绩详情 →」link 移到底部
- XAxis/YAxis text-[10px] + YAxis width=24 收紧

### `components/analytics-v2/task-performance-block.tsx`（重写）
- Card `gap-2 py-3` 消除 default gap
- CardHeader 改 `grid grid-cols-[1fr_auto]` 单行：图标 + 标题（含 inline 「缓存 · 时间」）+ 任务 Select(w-220px) + 重新生成 Button
- 任务 Select 从 CardHeader 第二行移到 header 同行右侧（spec §D.18）
- CardContent 改 `grid grid-cols-2 gap-2.5 h-full`：左高分典型 + 右低分共性问题 (spec §D.19)
- SectionColumn 替代旧 SectionInline：每列独立 flex-col + header 显示 icon+label+count Badge + 滚动区 overflow-y-auto
- 高分典型 = bg-success/5 + border-l-2 border-success + CircleCheck 图标
- 低分共性 = bg-destructive/5 + border-l-2 border-destructive + CircleAlert 图标
- HighlightRow / IssueRow 紧凑化：text-xs 学生名/title + text-[11px] line-clamp-2 描述 + score/×N badge h-4 px-1
- 每列限 6 例（之前 4 例，跨两行高度可放更多）
- 新 CardFooter「查看任务详情 →」当 selectedTaskId 存在时 link 单实例 insights

### `components/analytics-v2/study-buddy-block.tsx`（重写）
- Card `gap-2 py-3`
- CardHeader 单行：图标 + 标题（含 inline 「时间 · N 节 / N 题」副标）
- Table 紧凑：TableHead h-6 px-1.5 text-[10px]，TableCell px-1.5 py-1.5 text-xs / text-[11px]
- 章节列 w-[32%] truncate / 次数列 w-10 text-right / 问题列 line-clamp-2
- top-5 保留（MAX_ROWS = 5）
- 新可选 onViewAll prop + CardFooter「查看全部对话 →」link
- EmptyPanel 紧凑（min-h-[80px] / size-7 icon）

### `components/analytics-v2/teaching-advice-block.tsx`（surgical patch header + content）
- Card `gap-1 py-3` （核心 gap 修复，**消除 user 反馈的 header/content 之间 gap**）
- CardHeader `pb-1 px-3 grid-cols-[1fr_auto]` 单行：图标 + 标题（含 inline 「缓存 · 时间」）+ 重新生成 Button
- 副标 `<p>` 删（合并到 title 内 inline span）
- CardContent `px-3 pb-1 pt-0` 紧贴 header
- notice 块 `col-span-2` 跨两列在 header 内（如 LLM 失败 fallback 提示）
- ColumnCard `max-h-[200px]`（从 240px 缩，给 4 列横向均衡）+ `py-1.5`（从 py-2 缩）

### `components/analytics-v2/kpi-row.tsx`（surgical font compaction）
- Card `py-3` → `py-2.5`
- CardContent `px-4 py-0` → `px-3 py-0`
- 主值 `text-2xl` → `text-xl`（spec §G.34）
- mt-2 → mt-1.5（主值上方间距）
- 副标 `text-xs` → `text-[11px]`（spec §G.36 CardDescription text-xs，但 KPI sub 比 description 还紧）

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 warnings |
| `npx vitest run` | **819/819 passed**（phase 7 baseline 819，未加测） |
| `npm run build` | success |
| Dev server smoke | 3031 + teacher1 login + diagnosis 200 + page 200 |

## Decisions / non-obvious

1. **`Card` 默认 `gap-6 py-6` 是关键 gap 罪魁**（不是 CardHeader/CardContent 自身 padding）：
   - shadcn `Card` = `flex flex-col gap-6 rounded-xl border py-6 shadow-sm`
   - 之前 phase 7 的 AI block CardContent `pt-0` 仍有视觉 gap，因为 Card 自身 `gap-6` (24px)
   - r2 修：`Card className="gap-1 py-3"` 才能彻底消除（gap-1 = 4px 微间距，符合视觉合理性）
   - 同样套路应用到 score-distribution / task-performance / study-buddy（都从 `gap-2 py-3` 开始）

2. **CardHeader `grid grid-cols-[1fr_auto]`**：
   - shadcn CardHeader 默认 grid auto-rows / grid-rows-[auto_auto]，要单行需显式设 grid-cols-[1fr_auto]
   - 加 `space-y-0` 抹去默认 row-gap

3. **ChartContainer `h-full w-full`**（替换 phase 7 的 `h-[260px]`）：
   - 跟随 CardContent flex-1 撑满父高度，让 grid 1/2 高度（约 280-340px @ 1440x900）的柱状图自适应填满
   - LabelList `position="top"` + margin.top: 16 防止柱顶 label 被裁

4. **LabelList 0 值不显示**：
   - `formatter={(v) => Number(v) > 0 ? String(v) : ""}`
   - 因为多班级对比时某区间某班 0 人很常见，避免「0 0 0 0」噪点
   - 类型 cast `(v) => { const n = Number(v); ... }`（recharts 6 LabelFormatter 类型是 RenderableText 不是 number）

5. **任务表现各列限 6 例（spec 默认 4）**：
   - spec §D 没明确数量上限，但跨两行高度足够放更多
   - 6 例 + line-clamp-2 描述 ≈ 每例 ~50px = 6 例 ~300px，1/2 视口高（680/2 = 340px）刚好

6. **Study Buddy onViewAll 是新 prop**（之前没用）：
   - spec §E.29 要求「查看全部对话 →」CardFooter
   - 接口加 `onViewAll?: () => void`，dashboard 暂不传（无回调），footer 只在 prop 存在时显示
   - 留给 phase 9 接 dialog/drawer 列全部对话

7. **不动：service / API / Prisma / 单实例 insights / teacher dashboard / classIds guard / localStorage hook / 老 URL / 老 redirect**（spec §不做的事 6 条全保留）

## Anti-regression checklist

| 项 | 验证 |
|---|---|
| `defaultClassIdsAppliedRef + courseId guard` | 完整保留（dashboard.tsx 未动 useEffect） |
| Phase 4 LLM scopeHash 24h cache | 路径未动 |
| Phase 5 evidence-drawer 三类 + score_bin | 全保留 |
| 单实例 `/teacher/instances/[id]/insights` | 完全未碰 |
| Teacher dashboard | 未碰 |
| Phase 7 KPI sparkline + delta + onClick | 全保留（仅 font 缩小） |
| `var(--color-{classId})` CSS 变量 | grep `#8884d8` 0 命中（multi 模式 fill 不变） |
| Phase 7 ToggleGroup 单/多班级 | 仍工作（仅位置移到 header 同行） |
| Phase 7 任务级 dropdown | 仍工作（仅位置移到 header 同行 w-220px） |
| Filter 紧凑布局 phase 7 保留 | InsightsFilterBar 0 改动 |
| 数据质量底部 collapsible 默认折叠 | DataQualityCollapsible 0 改动 |
| Phase 7 单屏 UX 三视口硬约束 | dashboard h-[calc(100vh-3.5rem-3rem)] 不变 |
| localStorage 最近课程 | userId scope 0 改动 |

## Things deferred / unsure

1. **多班级 multi 模式 LabelList 视觉**：当 5 班全部柱子并列每柱顶都显示 count 可能挤；如视觉杂乱，QA 反馈后可加只在 count >= max(counts) * 0.3 时显示 label 的阈值过滤。
2. **Study Buddy onViewAll**：当前 dashboard 没传，footer 不显示；phase 9 接全部对话 drawer 时再传。
3. **Footer link 字色**：选 `text-muted-foreground hover:text-foreground`（user 提示 spec 用此色）— 比之前 phase 7 的 `text-brand` 弱化，更不抢戏；如 QA 反馈 brand 色更可见可改回。

## Dev server status

worktree 3031 PID 48954+49110 仍在跑，全部 layout 改动 hot-reload 正常。**不需要重启 dev server**（无 schema / API / service 改动）。

## Next step

QA `/qa-only` 真浏览器三视口（1440/1280/1024）+ 主体 2 行 3 列 + 任务表现 2 列并排 + AI gap 消除 + 字体紧凑 + 整页 0 overflow 验证 57 acceptance。

PASS 后单 atomic commit + push。
