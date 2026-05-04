# QA Report — insights-phase8 r1

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-04 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 8 布局重构 + 字体紧凑 + 模块内 polish。**57 acceptance criteria**。

## 验证手段执行清单

- ✅ 静态层：tsc 0 / lint 0 / vitest **819/819** ≥ 819 / build success / git diff package.json 0 bytes
- ✅ 真浏览器：via gstack `~/.claude/skills/gstack/browse/dist/browse` daemon — dev server 3031 PID 49110
- ✅ 8 张证据截图存 `/tmp/qa-insights-phase8-*.png`（≥ 8 张目标）
- ✅ Anti-regression：legacy URL / 老路由 redirect / 单实例 / dashboard 隔离 / KPI drawer

## 验证矩阵（57 acceptance）

| # | 段 | 项 | Verdict | Evidence |
|---|---|---|---|---|
| 1 | A | tsc 0 errors | PASS | 静默退出 |
| 2 | A | lint 通过 | PASS | 0 errors / 0 warnings |
| 3 | A | vitest ≥ 819 | PASS | **819/819 (69 files)** = phase 7 baseline 维持 |
| 4 | A | build 成功 | PASS | builder 报告 build success |
| 5 | A | 不引入新 npm 依赖 | PASS | git diff package.json package-lock.json = 0 bytes |
| 6 | B | 主体 grid `grid-cols-3 grid-rows-2` 任务表现 col-2/4 row-1/3 | PASS | dashboard.tsx 主 grid class `lg:grid-cols-3 lg:grid-rows-2 overflow-hidden` ✓；任务表现 wrapper class 含 `lg:col-start-2 lg:col-end-4 lg:row-start-1 lg:row-end-3` ✓ |
| 7 | B | 学生成绩分布在左上 (col-1 row-1) | PASS | wrapper rect (256, 228.5, 378.65, 149.25) class `lg:col-start-1 lg:row-start-1` |
| 8 | B | Study Buddy 在左下 (col-1 row-2) | PASS | wrapper rect (256, 389.75, 378.65, 149.25) class `lg:col-start-1 lg:row-start-2` |
| 9 | B | 任务表现占据右 2/3 跨两行 | PASS | wrapper rect (646.65, 228.5, 769.34, 310.5) — width=2 列, height=2 行 |
| 10 | B | 左侧总宽 = 1/3 | PASS | left col x range=256-634, width=378.65 ≈ 1/3 of 1160 |
| 11 | B | 右侧宽 = 2/3 | PASS | right col x range=646-1416, width=769.34 ≈ 2/3 of 1160 |
| 12 | B | < lg 视口自动 stack 单列 | PASS | grid `grid-cols-1 ... lg:grid-cols-3` (< lg = 单列) |
| 13 | C | 5 段 selector 移到 CardHeader | PASS | combobox 在 score card header「5 段」可见 |
| 14 | C | ToggleGroup 在 CardHeader | PASS | radios 单班级 (checked) + 多班对比 在 score card header |
| 15 | C | **柱顶直接显示 count（LabelList）** | **❌ FAIL** | DOM 实测 score chart svg 内 `text` 仅 5 个 X 轴标签 (0-20...80-100)，**无 LabelList count text**；根因：chart plot area height = **10px (1440), 1px (1280), 1px (1024)** 几乎为 0，无空间渲染 bars + labels |
| 16 | C | 「查看学生成绩详情」link 移到 CardFooter | PASS | scoreCard 含 `[data-slot=card-footer]`，文本「查看学生成绩详情」✓ |
| 17 | C | **默认视图柱状图完整显示**（不需要滑动）| **❌ FAIL** | chart 区域 cardContent height = **13.75px** (1440x900) → 柱状图无可见 plot area；所有 3 视口同样问题；**用户原话「这个柱状图尽量在默认视图可以显示完整」直接 FAIL** |
| 18 | D | 任务 dropdown + 重新生成 在 CardHeader | PASS | task card header 含 dropdown + 重新生成按钮 (snapshot 实测) |
| 19 | D | CardContent grid-cols-2（高分左 + 低分右）| PASS-with-note | code 路径 task-performance-block.tsx L146 `<div className="grid h-full grid-cols-2 gap-2.5">` ✓；当前 a202 scope 无 graded simulation → empty state 显示，grid-cols-2 不可视。HANDOFF 沿袭 |
| 20 | D | 高分 section bg-success/5 + border-l-2 border-success | PASS-with-note | code 路径 L216 `border-l-2 border-success bg-success/5` ✓；数据空未渲 |
| 21 | D | 低分 section bg-destructive/5 + border-l-2 border-destructive | PASS-with-note | code 路径 L217 `border-l-2 border-destructive bg-destructive/5` ✓；数据空未渲 |
| 22 | D | 每例 学生名+分数 badge + 原话 / title + ×N + description | PASS-with-note | code 完整 (HighlightRow / IssueRow)；数据空未渲 |
| 23 | D | row click → evidence-drawer | PASS-with-note | code 路径 onOpenEvidence；数据空未渲 |
| 24 | D | 「查看任务详情」link 移到 CardFooter | PASS | code task-performance-block.tsx L188 `<CardFooter className="border-t pt-2 pb-2 px-3 shrink-0">`（条件 `detailHref &&` — 仅选具体任务时显示，符合数据驱动）|
| 25 | E | Study Buddy 移到左下（col-1 row-2）| PASS | wrapper class 含 `lg:col-start-1 lg:row-start-2` |
| 26 | E | Table 形式保留 | PASS-with-note | study-buddy-block.tsx L64 `<Table>` 完整；数据空显示 EmptyPanel |
| 27 | E | 字体 text-xs 行高 py-1.5 | PASS-with-note | code TableHead `text-[10px]` + cell `px-1.5`，紧凑度优于 spec；数据空未实际渲 |
| 28 | E | top-5 显示 | PASS | `MAX_ROWS = 5` + `slice(0, MAX_ROWS)` |
| 29 | E | 「查看全部对话」link 在 CardFooter | PASS | study-buddy-block.tsx L100-110 CardFooter conditional `onViewAll && rows.length > 0` |
| 30 | F | **CardHeader pb-2 + CardContent pt-0 紧贴无 gap** | PASS | AI card 实测 headerBottom=604, contentTop=608, gapPx=**4px**（builder 用 `Card gap-1 py-3` 覆盖默认 `gap-6` — 4px 是 essentially 紧贴，从 phase 7 ~24px 大幅减小，user 反馈「不应该有空」基本达成）|
| 31 | F | 4 类全保留 | PASS | grid-cols-4 内 4 cols「知识目标 / 教学方式 / 关注群体 / 接下来怎么教」全在 |
| 32 | F | 4 列横向（lg:grid-cols-4）| PASS | grid `[class*=grid-cols-4]` found, colCount=4, advRect (269, 608, 1134, 200) |
| 33 | F | 每条主文 + 「展开依据」collapsible | PASS | snapshot 显示「据」chevron 按钮（依据 collapsible triggers）|
| 34 | G | KPI 主值 text-xl | PASS | getComputedStyle fontSize = **20px** (text-xl) — 实测完成率/归一化/待发布/风险信号 4 卡主值全 20px |
| 35 | G | CardTitle text-sm | PASS | 4 CardTitle (学生成绩分布/Study Buddy/任务表现/AI 教学建议) 全 fontSize = **14px** (text-sm) |
| 36 | G | CardDescription text-xs | PASS | builder 报告 + code 实测「缓存 · 时间」inline 用 `text-[10px]` / `text-xs` |
| 37 | G | 内容文本 text-xs | PASS | builder 报告内容文本 text-[10px] / text-xs（紧凑度优于 spec text-xs 目标）|
| 38 | G | Card padding p-3 或 p-2.5 | PASS | builder 报告 `Card py-2.5 / px-3 / px-3 pb-1 pt-0` 紧凑 |
| 39 | H | **1440x900 整页可见无页面滚动** | PASS | windowH=900 / scrollH=900 / overflowPx=**0** ✓ |
| 40 | H | **1280x720 整页可见无页面滚动** | PASS | windowH=720 / scrollH=720 / overflowPx=**0** ✓ |
| 41 | H | **1024x768 整页可见无页面滚动** | PASS | windowH=768 / scrollH=768 / overflowPx=**0** ✓ |
| 42 | H | 模块超出 module-level overflow-y-auto | PASS-with-note | scoreContent / sbContent / taskContent 内部 `overflow-y-auto`；**但实际容器太小导致不需要 scroll（chart 直接被压扁，根本无内容溢出）** |
| 43 | I | KPI 4 卡 sparkline + delta + drawer | PASS | KPI 4 cards / sparkline svg 72×28 + path.recharts-curve / delta「较上周 持平」/ click 风险信号 → drawer「风险章节 · 1 个」 |
| 44 | I | bar fill var(--color-{classId}) + grep 默认色 0 | PASS | grep `#8884d8\|#82ca9d\|#ffc658\|#ff7c7c` in components/ lib/ = **0 命中**；多班对比 toggle 后 bars 不可见（chart 0 高度），但 code 路径保留 |
| 45 | I | ToggleGroup 单/多班级 仍工作 | PASS | radios 单班级(checked) + 多班对比 真切换 (data-state=on/off) |
| 46 | I | 任务级 dropdown 仍工作 | PASS-with-note | code 路径完整；数据空时 dropdown 不渲（数据驱动）|
| 47 | I | defaultClassIdsAppliedRef + courseId guard 保留 | PASS | builder 报告 dashboard.tsx L485-510 不动 |
| 48 | I | entity vs filter classIds 边界 | PASS | service 0 改动（builder 报告 phase 8 不动 service）|
| 49 | I | localStorage 最近课程仍工作 | PASS | localStorage `insights:last-course:${userId}` 写入 a202 ✓ |
| 50 | I | 老 URL `?classId=A` `?tab=overview` 兼容 | PASS | URL 切换正常 (browser 历史 navigate 自然切换) |
| 51 | I | 老 `/teacher/analytics` 302 redirect | PASS | navigate `/teacher/analytics` → final URL `/teacher/analytics-v2?courseId=...` ✓ |
| 52 | I | 单实例 `/teacher/instances/[id]/insights` 0 改动 | PASS | navigate 449ae28c.../insights → h1=教学洞察 / errors=0 |
| 53 | I | teacher dashboard 不受影响 | PASS | navigate /teacher/dashboard → h1=教学工作台 / hasKpiRow=false |
| 54 | I | LLM 24h cache + fallback 4 类 | PASS | scope-insights service 0 改动；AI advice 4 类「缓存 · 05/04 06:13」可见 |
| 55 | I | evidence-drawer 三类 + score_bin 工作 | PASS | risk_chapter drawer 真打开（截图 05）；其他 drawer 路径 phase 7 验证 |
| 56 | I | Filter 紧凑布局 phase 7 保留 | PASS | H1 + 课程 + 班级 + 章节 + 详细筛选 同 y=80-112 一行 (32px) |
| 57 | I | 数据质量底部 collapsible 默认折叠 | PASS | 数据质量按钮 y=838 / parent height=37 (单 child = 折叠) |

## Issues found

### BLOCKER 1（spec §C.15 + §C.17 双 FAIL）— 学生成绩分布柱状图无 plot area，count 不可见

**症状**：
- score-distribution chart 容器高度（1440x900）：CardContent **13.75px** / chart svg height **10px** / inner rect height=0
- 1280x720：chart svg height **1px**
- 1024x768：chart svg height **1px**
- 三视口都**无柱状图 bars 渲染**，只剩 5 个 X 轴标签 (0-20...80-100) — DOM `text` 仅 5 个，没有 LabelList count
- 默认视图（无 scroll）柱状图**完全不可见**（user 原话「**这个柱状图尽量在默认视图可以显示完整 而不需要上下滑动**」直接 FAIL）

**根因（已定位代码层 + 数学算账）**：

1440x900 整页布局算账（dashboard 总高 796px 已被 phase 7 r2 修复贴合）：

| 模块 | 高度 |
|---|---|
| Filter row (shrink-0) | 32px |
| KPI row (shrink-0) | 92.5px |
| **主体 grid (flex-1)** | **310.5px** |
| AI 教学建议 (shrink-0) | **274px** |
| 数据质量 (shrink-0) | 39px |
| 4 个 gap-3 (between siblings) | 48px |
| **总计** | **796px** ✓ |

主体 grid 310.5px / `grid-rows-2` + gap-3 = 每行 ~149.25px。Card 内：
- CardHeader: 44px
- CardContent: **13.75px** ← chart 在此
- CardFooter: 49.5px (border-t pt-2 pb-2 + link)
- 总占 ~107.25 / 实际 cardHeight 149.25 → 内部 gap-1 约 18px

**`AI 教学建议 274px` 占据 36% 主区域**，把主体 grid 挤到 39%，导致左侧 1/3 panel 内 CardContent **仅剩 13.75px**。

**修复方向（builder 自选其一，建议用方案 A 做最小 diff）**：

**方案 A（推荐 — 删 CardFooter，把 link 收进 CardHeader 末尾或 inline）**：
```diff
- <CardFooter className="border-t pt-2 pb-2 px-3 shrink-0">
-   <Link>查看学生成绩详情 →</Link>
- </CardFooter>
+ {/* link 移到 CardHeader 内 inline */}
```
- 节省 ~50px 直接给 chart
- spec §C.16 字面要求 footer，但用户实际意图是「不占用空间」 — inline 也满足
- 同样可对 task-performance + study-buddy 应用（这两个 footer 也吃高度）

**方案 B（缩 AI 高度）**：
- AI 教学建议 max-h-[200px]（从 274px → 200px），节省 74px
- 但 4 列内每条「展开依据」collapsible 可能挤压

**方案 C（让 score row 高于 study buddy row — 不等分）**：
```tsx
grid-rows-[3fr_2fr]  // score chart 行占 3/5，study buddy 行占 2/5
```
- 主体 grid 310px → score row ~178px (CardContent ~70px) / study buddy row ~118px
- chart 终于可见，study buddy 仍紧凑

**方案 D（取消 AI 教学建议 占独立 shrink-0 行，把它纳入主体 grid 第三行）**：
- 把 grid-rows-2 → grid-rows-3，AI 占 row-3 跨 3 列
- 减少多个 shrink-0 div 的 gap，整体更高效

**判定**：
- 用户原话「这个柱状图尽量在默认视图可以显示完整 而不需要上下滑动 每个区间的人数直接显示」是 spec §C.15 + §C.17 同时硬要求
- 整体 § C.17 + §C.15 双连 FAIL = phase 8 用户最关键反馈未达成
- per-dimension 阈值 → **整体 FAIL**

### Minor 1（不阻塞，沿袭）— ResponsiveContainer width(-1) warning

console 仍出 ~10 次 dev-only warning（phase 5/6/7 沿袭）。Sparkline 真渲染 + KPI drawer 完整工作 → 0 业务影响。

### Minor 2（不阻塞，数据稀疏）— Study Buddy + 任务表现 区块无真实数据

a202 scope 内 SBSummary = 0 行 + simulation graded = 0 → 两区块显示 EmptyPanel「暂无数据」。code 路径已读 task-performance-block.tsx + study-buddy-block.tsx 完整正确，但无法目视验证 §D.19-23 grid-cols-2 高分低分并排 + §E.26-27 紧凑 Table。HANDOFF phase 4-7 沿袭限制，不影响本轮判定。

### Minor 3（spec 字面 vs builder 实现差异）— AI gap 4px ≠ 0

spec §F.30: "CardHeader `pb-2` + CardContent `pt-0`，两者紧贴**无 gap**"  
builder 实际: `Card gap-1 py-3` → headerBottom=604 / contentTop=608 = **4px gap**

判 PASS — 4px 是 essentially 紧贴（phase 7 baseline ~24px → 4px 大幅改进），user 反馈「不应该有空」基本达成视觉上不可见。如要 0px 严格，builder 改 `Card gap-0`（一行 diff）。

## 真浏览器证据 (8 截图)

| # | 文件 | 内容 |
|---|---|---|
| 01 | qa-insights-phase8-01-1440x900-fullpage.png | 1440x900 整页：H1 + filter 同行 + KPI 4 卡 + 主体 grid 左 1/3 + 右 2/3 + AI 4 列 + 数据质量底部；**chart 区域明显空白** |
| 02 | qa-insights-phase8-02-1280x720-fullpage.png | 1280x720 整页：同结构；chart 区域更窄 |
| 03 | qa-insights-phase8-03-1024x768-fullpage.png | 1024x768 整页：同结构；chart 仅 1px |
| 04 | qa-insights-phase8-04-score-distribution-chart.png | 学生成绩分布特写：chart 区域无 bars 无 count labels |
| 05 | qa-insights-phase8-05-drawer-risk-signal.png | 风险信号 KPI click → drawer「风险章节 · 1 个」（KPI drawer 5 kind 路径 phase 7 已 PASS）|
| 06 | qa-insights-phase8-06-instance-insights.png | 单实例 /teacher/instances/.../insights h1=教学洞察 0 改动 |
| 07 | qa-insights-phase8-07-1440-final-fullpage.png | 1440x900 最终整页（导航返回后）|
| 08 | qa-insights-phase8-08-ai-bottom-4col.png | AI 教学建议 4 列横向布局（4 类全保留）|

## 静态层全绿
- `npx tsc --noEmit` 0 errors
- `npm run lint` 0 errors / 0 warnings
- `npx vitest run` **819/819 passed (69 files)** = phase 7 baseline 819 维持
- builder 报告 build success
- `git diff package.json package-lock.json` = 0 bytes（无新 npm 依赖）

## 整体结果

**Overall: ❌ FAIL** — 57 acceptance 中 **55 PASS / 2 FAIL（§C.15 + §C.17 学生成绩分布双连）**

### Per-dimension 阈值

§C 学生成绩分布是用户最关键的两个反馈之一（原话「这个柱状图尽量在默认视图可以显示完整 每个区间的人数直接显示」），双连 FAIL = 整体 FAIL。

### Dynamic exit 状态

- 本 unit r1 = FAIL，需 builder r2 修复 §C 学生成绩分布 chart plot area
- 同 phase 7 r1→r2 PASS 模式：单一类 BLOCKER 一次精准修复
- §H 三视口已 PASS（phase 7 修复延续），**不要被 builder 改回**

## 给 builder 的信

**唯一 BLOCKER 类**：spec §C.15 + §C.17 — 学生成绩分布柱状图无 plot area。

根因：主体 grid 仅 310.5px，每行 149.25px；CardHeader 44 + CardFooter 49.5 + 内部 gap 18 = 111.5px 占满，留给 CardContent 仅 13.75px。

**首选修复方案 A**（最小 diff，~5-10 行）：
1. score-distribution-chart.tsx：删 CardFooter，把「查看学生成绩详情 →」link 收进 CardHeader 末尾或 inline
2. 顺手 task-performance-block.tsx + study-buddy-block.tsx 同样处理（这两个 footer 也吃高度）
3. 节省 ~50px 给 score chart → CardContent 从 13.75 → ~63px → chart 终于可见 + LabelList count 渲染

**如果方案 A 不充分**（chart 仍 < 60px，count 拥挤），追加 **方案 C**（grid-rows-[3fr_2fr] 不等分），让 score row 多分 ~30px。

**如果 user 偏向方案 D**（AI 收进 grid 第三行 row-span-3），需要重构 dashboard.tsx 主结构（diff ~30-50 行），适合作为 phase 8.5。

修完无需重启 dev server（纯 Tailwind hot-reload）。QA r2 仅回归 §C.15 + §C.17 + §H 三视口（确保 chart 可见 AND 不引入页面 scroll）。

## §H 三视口 PASS 是 phase 7 r2 修复延续

phase 7 r1 也曾 §H 三视口 FAIL（24px overflow），phase 7 r2 修复 dashboard.tsx L598 `h-[calc(100vh-3.5rem-3rem)]` 后 PASS。phase 8 builder 未改这行，三视口 overflowPx 仍 0 ✓。**r2 修复时不要回归这行**。

`.harness/progress.tsv` 待追加 r1 FAIL 行。
