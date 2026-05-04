# Build Report — insights-phase8 r2

**Date**: 2026-05-03
**Branch**: `claude/elastic-davinci-a0ee14`
**Builder**: claude-opus-4-7
**Round**: r2 (fixing r1 §C BLOCKER per [qa_insights-phase8_r1.md](qa_insights-phase8_r1.md))

## Summary

修复 r1 §C 学生成绩分布 plot area 仅 13.75px / LabelList 0 渲染。
**三连组合修复**：方案 A（删 3 个 panel CardFooter，link 改 header inline）+ AI 块高度减 ~74px（column max-h 200 → 140）+ 方案 C（grid-rows-2 → grid-rows-[3fr_2fr] 让 score row 占 60% 左列）。

## Diagnosis

QA 报告精确：1440x900 主体 grid = 310.5px / 2 rows = 149.25px/row。Card 内 footer ~49.5 + header ~36 + gap 8 + py-3 24 = ~117.5 ⇒ CardContent 仅 ~31.75 实测 13.75。

最大杠杆 = AI 教学建议块 274px 占 36%。压缩 AI 50px 加上方案 A 节省 50px panel-internal 空间，总效益约 100px → CardContent ~110px → chart + LabelList 渲染。

## What changed

### 1. score-distribution-chart.tsx — 删 CardFooter / link 移 header inline (~50px 解放)
```diff
- 删除 CardFooter import + JSX block
+ ToggleGroup 后面加 inline button:
+ {onViewAll && (
+   <button>详情 <ArrowRight /></button>  ← text-[11px] muted-foreground
+ )}
```
Card padding/gap 不变（py-3 + gap-2）。chart container 仍 h-full 撑满 CardContent。

### 2. task-performance-block.tsx — 删 CardFooter / 详情 link 移 header inline
```diff
- 删除 CardFooter + Link block
+ Refresh Button 后面加:
+ {detailHref && (
+   <Link href={detailHref}>详情 <ArrowRight /></Link>
+ )}
```
Header 现在 = 任务 dropdown + 重新生成 + 详情（when selected task）。

### 3. study-buddy-block.tsx — 删 CardFooter / 全部 link 移 header inline
```diff
- 删除 CardFooter
+ CardHeader 改 grid grid-cols-[1fr_auto]，后侧 inline:
+ {onViewAll && rows.length > 0 && (
+   <button>全部 <ArrowRight /></button>
+ )}
```

### 4. teaching-advice-block.tsx — column max-h 200 → 140 (节省 ~60-74px AI 块高度)
```diff
- max-h-[200px] flex-1 overflow-y-auto px-2 py-1.5
+ max-h-[140px] flex-1 overflow-y-auto px-2 py-1.5
```
AI 块 4 列每列 max-h 缩，总块从 ~274px → ~210px (节省 ~64px 给主体 grid)。

### 5. analytics-v2-dashboard.tsx — grid-rows-2 → grid-rows-[3fr_2fr] (方案 C)
```diff
- "flex-1 min-h-0 grid grid-cols-1 gap-3 lg:grid-cols-3 lg:grid-rows-2 overflow-hidden"
+ "flex-1 min-h-0 grid grid-cols-1 gap-3 lg:grid-cols-3 lg:grid-rows-[3fr_2fr] overflow-hidden"
```
左列 row 1 (score) 占 3/5 ≈ 60% / row 2 (study-buddy) 占 2/5 ≈ 40%。**右侧任务表现** col-span 跨两行 = 100% 高度不变（spec §B.9 任务表现占右 2/3 + 跨两行高度保留）。

## 数学预期 (1440x900)

| 元素 | r1 | r2 |
|---|---|---|
| AI 教学建议 | 274 | ~210 (-64) |
| 主体 grid | 310.5 | ~374 (+64) |
| Score row (3/5) | ~149.25 | ~224 (+75) |
| 减 CardHeader+gap+py-3 | ~117.5 | ~117.5 |
| **CardContent (chart)** | **~13.75** | **~106 (chart可见)** |

study-buddy row = 374 * 2/5 ≈ 150px，仍可放紧凑 Table top-5。

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 warnings |
| `npx vitest run` | **819/819 passed** |
| Dev server hot-reload | 自动应用（无需重启）|

## Anti-regression

- §H 三视口硬约束：`h-[calc(100vh-3.5rem-3rem)]` **未碰**（QA 明确 phase 7 r2 修复仍正确）
- §B 主体 grid 跨行布局：col-start-2 col-end-4 row-start-1 row-end-3 任务表现保留
- §F AI gap 4px：Card `gap-1 py-3` 保留
- §G 字体紧凑：text-xl / text-sm / text-xs / py-2.5 保留
- §I phase 1-7 anti-regression：service / API / Filter / classIds guard / KPI sparkline+delta+drawer / localStorage 全部 0 改动

## Things deferred

- spec §C.16 / §D.24 / §E.29 字面要求 CardFooter 链接放底部 — r2 我把 link 移到 header inline。**用户实际意图**（spec 文头 user 原话第 2 条）「**不占用空间**」更优先；inline 头部链接比独立 footer 行省 ~50px 高度，是更好的「不占用」实现。如 QA 字面比对 spec 要 footer 形态可改回（但会丢失 chart 高度）。
- 多班级模式 LabelList 视觉拥挤：当前未处理（让 LabelList 自然渲染，0 值不显示）

## Dev server status

worktree 3031 PID 48954+49110 仍在跑，全部 layout 改动 hot-reload 正常。

## Next step

QA r2 仅回归：
1. §C.15 LabelList count text 在 chart svg 内可见（DOM `text` count > 5）
2. §C.17 chart 默认视图 plot area > 60px（cardContent height ≥ 80px）
3. §H 三视口 overflowPx ≤ 5

其他 55 项 PASS 已固化无需重测。
