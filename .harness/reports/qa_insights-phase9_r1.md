# QA Report — insights-phase9 r1

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-04 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 9 KPI trailing visual + 小视口适配。**54 acceptance criteria**。

## 验证手段执行清单

- ✅ 静态层：tsc 0 / lint 0 / vitest **822/822** ≥ 819 / build success / git diff package.json 0 bytes
- ✅ 真浏览器：via gstack `~/.claude/skills/gstack/browse/dist/browse` daemon — dev server 3031 PID 49110
- ✅ 10 张证据截图存 `/tmp/qa-insights-phase9-*.png`（≥ 10 spec 目标）
- ✅ API 直查 4 新字段（recentTasksTrend / pendingReleaseInstances / riskChapterSamples / riskStudentSamples）
- ✅ Anti-regression：KPI drawer 5 kinds / Filter 紧凑 / AI 4 cols / 老路由 redirect / 单实例 + dashboard 隔离 / LabelList

## 验证矩阵（54 acceptance）

| # | 段 | 项 | Verdict | Evidence |
|---|---|---|---|---|
| 1 | A | tsc 0 errors | PASS | 静默退出 |
| 2 | A | lint 通过 | PASS | 0 errors / 0 warnings |
| 3 | A | vitest ≥ 819 | PASS | **822/822** = phase 8 baseline 819 + 3 新增 |
| 4 | A | build 成功 | PASS | builder 报告 build success |
| 5 | A | 不引入新 npm 依赖 | PASS | git diff package.json package-lock.json = 0 bytes |
| 6 | B | 4 卡 flex-row items-center horizontal layout | PASS-with-fail-at-小视口 | **1440 PASS**：内 div `flex-row items-center` ✓；**1280/1024 FAIL**：cards 视觉 horizontal 但内容 wrap 让 card 高度超出 88px (1280=108 / 1024=174) |
| 7 | B | 主数据保留 icon+标签+主值+sub+delta（**数据格局不变**） | **❌ FAIL at 1024** | 1024 视口 KPI 卡 width 仅 177px，主数据 div `flex-1 min-w-0` 实际 43px wide × 77.5px tall — **「完成率」三字垂直显示成「完 / 成 / 率」**（截图证 phase9-03-1024-fullpage.png）；spec §6 「不动现有 KPI 数据格局」直接被破坏 |
| 8 | B | trailing 宽度 ~80-96px + gap-3 | PASS-with-fail | 1440：trailing div `w-20 lg:w-24` = lg active = w-24 = 96px ✓；但**1024 也是 lg 断点** (Tailwind v4 lg=1024) → trailing 仍 96px 占卡 54%（177-96-padding 给主数据仅 43px）→ §G.34 spec「md w-20 / lg w-24」实际未生效 |
| 9 | B | min-h-[88px] | PASS-with-fail | 1440: 4 卡 height=88 ✓；**1280: height=108.5 / 1024: height=174.5**（card 自然高度因内容 wrap 已经 > min-h-88，min-h 仅是下限，无法压缩）|
| 10 | C | 完成率卡 trailing line chart（dynamic recharts）| PASS（code 路径，数据稀疏未渲）| code: `<LineChart>` dynamic ssr:false ✓；当前 data <2 → 显示 placeholder 「暂无趋势」（§C.15 触发）|
| 11 | C | 归一化均分卡 trailing | PASS（同上）| 同 |
| 12 | C | line stroke var(--color-brand) | PASS（code 验证）| kpi-trailing-visual.tsx 内 `<Line stroke="var(--color-brand)">` |
| 13 | C | height ≈ 48px | PASS | trailing div 实测 height = **48px** ✓ |
| 14 | C | tooltip 任务名 + 值 | PASS（code 路径）| code 包含 Tooltip + content formatter |
| 15 | C | 数据稀疏 < 2 任务 placeholder「暂无趋势」 | PASS | 实测：完成率 + 均分 trailing 显示 "暂无趋势" 灰色 placeholder（a202 仅 1 graded student，validCount<2 触发）|
| 16 | C | dot 仅最后一个 | PASS（code 路径）| InternalLineChart 含 `<Dot>` 仅末点 |
| 17 | D | trailing 显示 top-3 待发布任务 | PASS（code 路径）| code: `pendingReleaseInstances.slice(0,3)` |
| 18 | D | text-[10px] 紧凑字体 | PASS（code 路径）| code 用 `text-[10px]` |
| 19 | D | **0 项 trailing 不显示** | PASS | 实测 a202 待发布 0 项 → trailing 区域空（`📦` 图标都不显示），主数据 div 扩展 ✓ |
| 20 | D | click → drawer pending_release | PASS | KPI 卡 onClick 路径完整（phase 5 实装），drawer 5 kinds 全工作 |
| 21 | E | trailing top-2 章节 + top-2 学生 | PASS | 实测：「📖 理财基础概念 + 👤 周八」两条；a202 数据仅 1 chapter + 1 student，slice(0,2) 取尽 ✓ |
| 22 | E | text-[10px] 紧凑 | PASS（code）| code `text-[10px]` |
| 23 | E | > 4 项「+ 更多」 | PASS（code 路径，数据未触发）| code: `(chapter.length + student.length > 4) && "+ 更多"`；当前 1+1=2 不触发 |
| 24 | E | 0 项 trailing 不显示 | PASS（code 路径）| code 0 项 conditional 隐藏 |
| 25 | F | recentTasksTrend ≤ 10 | PASS | API 实测：1 instance「ANL-2 B 班独立测验」/ completionRate=0.5 / avgScore=90 / publishedAt 2026-04-20 ✓ |
| 26 | F | pendingReleaseInstances ≤ 3 | PASS | API: `pendingInst: []` (0 条 a202 课程没有 dueAt 过+ 未发布) ✓ |
| 27 | F | riskChapterSamples ≤ 3 | PASS | API: `[{chapterId, title:"理财基础概念"}]` 1 条 ✓ |
| 28 | F | riskStudentSamples ≤ 3 | PASS | API: `[{studentId, name:"周八", reason:"not_submitted"}]` 1 条 ✓ |
| 29 | F | SQL 直查与 service 一致 | PASS | a202 instanceMetrics 有 1 graded instance → recentTasksTrend 1; chapterDiagnostics filter isRiskChapter → 1 章节; studentInterventions → 1 学生 ✓ |
| 30 | G | **1440x900 chart cardContent ≥ 100px** | PASS | 实测 cardContent = **106.19px** / svg = 102px ✓（phase 8 r2 baseline 维持）|
| 31 | G | **1280x720 chart cardContent ≥ 25px** | **❌ FAIL** | 实测 cardContent = **9.89px** / svg = 6px；spec 目标 ≥ 25px → **未达**（phase 8 baseline 7.5 → r1 9.89，仅 +2.4px 改善，spec 要求 3x+ 改善）|
| 32 | G | **1024x768 chart cardContent ≥ 40px** | **❌ FAIL hard** | 实测 cardContent = **4px** / svg = 1px；spec 目标 ≥ 40px → **不仅未达，反而比 phase 8 (12.3px) 退步 -8.3px**；根因：1024 KPI 卡 horizontal layout 因卡宽 177px 不够，文本 wrap 让 KPI 行从 phase 8 的 93px 涨到 174.5px → 主体 grid 从 phase 8 的 163px 缩到 120.5px |
| 33 | G | AI max-h responsive 1440+ 160 / 1280 120 / 1024 100 | PASS | 实测 AI 列内 max-h-[100px] (default) + min-[1280px]:max-h-[120px] + min-[1440px]:max-h-[160px]：1440=160 / 1280=120 / 1024=100 ✓（getComputedStyle maxHeight）|
| 34 | G | KPI 主值字体 lg+ text-xl / md text-lg | PASS-with-fail | 1440: 主值 fontSize=20px (text-xl) ✓；但 spec §G.34 「md text-lg」未达成 — 1024 (md) 的主值仍 text-lg lg:text-xl，**实际 1024=lg 断点 (Tailwind v4)** → text-xl 仍 active，spec 「md → 1024 视口 text-lg」未生效 |
| 35 | G | 三视口仍 0 overflow（继承 phase 7/8 硬约束） | PASS | 1440=0 / 1280=0 / 1024=0 ✓ |
| 36 | H | recentTasksTrend = instanceMetrics by publishedAt desc | PASS | 数据 1 instance 排序唯一项 ✓ |
| 37 | H | pendingReleaseInstances = 待发布 top-3 by dueAt asc | PASS | 0 条 (a202 课程无符合条件) |
| 38 | H | riskChapterSamples = chapterDiagnostics filter(isRiskChapter) | PASS | 1 条 chapterId/title 全 ✓ |
| 39 | H | riskStudentSamples = studentInterventions unique | PASS | 1 条 studentId/name/reason 全 ✓ |
| 40 | I | KPI 主数据数字与 phase 8 一致 | PASS | 1440 实测：完成率 50% / 归一化均分 90% / 待发布 0 项 / 风险信号 1 章节+1 学生（a202）— 与 phase 8 r2 一致 |
| 41 | I | KPI 4 卡 onClick → drawer 5 kinds | PASS | 风险信号 click → 「风险章节 · 1 个」drawer + 完成率 click → 「未提交学生 · 1 人」drawer ✓ |
| 42 | I | Filter 紧凑保留 | PASS | filter row 32px ✓ + h1Top=82 + 同行 H1+课程+班级+章节+详细筛选 |
| 43 | I | 主体 grid 2 行 3 列 + 任务表现跨右 2/3 | PASS | mainGridClass `lg:grid-cols-3 lg:grid-rows-[3fr_2fr]` ✓；任务表现跨 col-2/4 row-1/3 ✓ |
| 44 | I | 学生分布柱顶 LabelList(count) 保留 | PASS | 1440 score chart svgTexts 含 "1" LabelList count ✓ |
| 45 | I | AI 4 列 4 类保留 | PASS | grid4Exists=true / colCount=4 / 4 类 (知识目标/教学方式/关注群体/接下来怎么教) |
| 46 | I | 数据质量底部 collapsible | PASS | dq y=838 ✓ default collapsed |
| 47 | I | defaultClassIdsAppliedRef + courseId guard | PASS | builder 未碰 dashboard.tsx phase 1 r2 修复行 |
| 48 | I | entity vs filter classIds 边界 | PASS | service 加 4 字段（仅扩展），entity 字段未动 |
| 49 | I | localStorage 最近课程 | PASS | localStorage `insights:last-course:${userId}` 正常 |
| 50 | I | 老 URL `?classId=A` `?tab=overview` 兼容 | PASS（builder 报告 + phase 7-8 持续验证）| |
| 51 | I | 老 `/teacher/analytics` 302 redirect | PASS | navigate `/teacher/analytics` → final URL `/teacher/analytics-v2?courseId=...` ✓ |
| 52 | I | 单实例 / teacher dashboard 隔离 | PASS | navigate 449ae28c.../insights → h1=教学洞察 / errors=0；/teacher/dashboard → h1=教学工作台 |
| 53 | I | recharts CSS 变量配色 | PASS | grep `#8884d8\|#82ca9d\|#ffc658\|#ff7c7c` in components/ lib/ = **0 命中** |
| 54 | I | LLM 24h cache + fallback 4 类 | PASS | scope-insights service 0 改动；AI advice 4 类「缓存」可见 |

## Issues found

### BLOCKER 1（spec §G.31 + §G.32 双 FAIL）— 1280/1024 视口 chart cardContent 仍紧凑，**1024 比 phase 8 还退步**

**症状**：

| Viewport | Spec 目标 | Phase 8 baseline | Phase 9 r1 实测 | Verdict |
|---|---|---|---|---|
| 1440 × 900 | ≥ 100px | 115.5 | **106.19** | ✓ PASS |
| 1280 × 720 | ≥ 25px | 7.5 | **9.89** | ❌ FAIL（仅 +2.4） |
| 1024 × 768 | ≥ 40px | 12.3 | **4** | ❌ **退步 -8.3** |

phase 9 不仅未达成 §G.31/§G.32 改善目标，**1024 视口反而比 phase 8 还差 8.3px**。

**根因（小视口 KPI horizontal layout 反作用）**：

1024 viewport (windowH=768)：
| 模块 | Phase 8 baseline | Phase 9 r1 | Δ |
|---|---|---|---|
| Filter | 72 | 72 | 0 |
| **KPI row** | 93 | **174.5** | **+81.5** |
| Main grid | 163 | **120.5** | **-42.5** |
| AI block | 250 | 210 | -40 (max-h responsive 起作用) |
| DQ | 39 | 39 | 0 |

KPI row 1024 height **174.5px**（vs phase 8 的 93px）— 主因是 horizontal layout 在 lg-cols-4 + 卡宽 177px 时，trailing 96px 占 54% 卡宽，主数据 div 仅 43px wide，导致**「完成率」三字 wrap 成垂直「完 / 成 / 率」字符链**（截图证 phase9-03-1024-fullpage.png）。

AI block max-h-100 修复有效（-40px），但被 KPI 增长（+81.5px）抵消有余 → 主体 grid 反而 -42.5px。

1280 viewport (windowH=720) 类似但程度较轻：KPI 88→108.5（text wrap）+主体 grid 158→159 几乎不变 → chart 9.89（比 phase 8 改善 +2.4px 但远未达 spec 25px）。

### BLOCKER 2（spec §B.7 「数据格局不变」破坏，1024 严重）

spec §6 明令「不动现有 KPI 数据格局（主值 / sub / delta 全保留）」。但 1024 视口 KPI 主数据 div 实测 width=43px，导致：

- 「完成率」三字垂直 stack：完 → 成 → 率（每字一行）
- 「50%」 → 「5 / 0%」拆分？(实际看是 "50%" 仍一行但其他 wrap)
- 「1/2 人次」+「— 暂无趋势」全部 wrap 多行

视觉上 KPI 数据「格局」明显**被破坏**，与 spec §6 直接冲突。

### Minor 1（spec §G.34 字面 vs Tailwind 实际行为）— text-xl 在 1024 仍 active

spec §G.34: 「KPI 主值字体 responsive：lg+ text-xl / md text-lg」。

实际 Tailwind v4 默认断点 lg = 1024px，所以 1024 视口已经是 lg → text-xl 仍 active。spec 字面是 「md text-lg」即 1024 应该 text-lg，但 builder class `text-lg lg:text-xl` 在 lg=1024 时 text-xl 触发 → 不达 spec 字面。

要让 1024 → text-lg，需用 `text-lg min-[1280px]:text-xl`（明确指定 1280+ 才大）。

### Minor 2（spec §G.34 字面 vs 实际）— trailing w-24 在 1024 仍 active

同 Minor 1：spec 「lg w-24 / md w-20」实际 1024 触发 lg → w-24 (96px)；如要 1024 用 w-20 (80px) 需 `w-20 min-[1280px]:w-24`。

trailing 16px 缩减 → 主数据 +16px，1024 主数据 width 43→59px，仍不够「完成率」三字 inline。

### Minor 3（沿袭 phase 5/6/7/8 不阻塞）— ResponsiveContainer width(-1) warning

dev-only console noise。

### Minor 4（沿袭 r1 不阻塞）— Study Buddy + 任务表现 数据空

a202 SBSummary 0 + simulation graded 0 → empty state；§E.21 风险 trailing + §F service 4 字段都已 SQL 验证，code 路径完整。

## 真浏览器证据 (10 截图)

| # | 文件 | 内容 |
|---|---|---|
| 01 | qa-insights-phase9-01-1440-fullpage.png | 1440x900 整页：KPI 4 卡 horizontal layout + trailing visual 完整（完成率/均分 「暂无趋势」placeholder + 风险信号 「📖+👤」 list + 待发布 0 项无 trailing） |
| 02 | qa-insights-phase9-02-1280-fullpage.png | 1280x720 整页：KPI 卡因 trailing 96px 抢宽，主数据轻微 wrap (height 108.5)；chart 仍紧凑 9.89 |
| 03 | qa-insights-phase9-03-1024-fullpage.png | **1024x768 整页：KPI 卡严重崩坏「完/成/率」垂直字符 wrap，KPI 行 174.5px，chart 4px**（spec §B.7 §G.31/32 双 BLOCKER 证据） |
| 04 | qa-insights-phase9-04-kpi-trailing-1440.png | 1440 KPI 4 卡 trailing 特写 |
| 05 | qa-insights-phase9-05-risk-trailing.png | 风险信号 trailing「📖 理财基础概念 + 👤 周八」 |
| 06 | qa-insights-phase9-06-1280-final.png | 1280 final（chart 仍紧凑） |
| 07 | qa-insights-phase9-07-1024-final.png | 1024 final（KPI 崩坏） |
| 08 | qa-insights-phase9-08-1440-final.png | 1440 final（陈述清晰） |
| 09 | qa-insights-phase9-09-drawer-completion.png | 完成率 KPI click → drawer「未提交学生 · 1 人」 |
| 10 | qa-insights-phase9-10-drawer-risk.png | 风险信号 KPI click → drawer「风险章节 · 1 个」 |

## 静态层全绿
- `npx tsc --noEmit` 0 errors
- `npm run lint` 0 errors / 0 warnings
- `npx vitest run` **822/822 passed (69 files)** = phase 8 baseline 819 + 3 新增
- builder 报告 build success
- `git diff package.json package-lock.json` = 0 bytes（无新 npm 依赖）

## 整体结果

**Overall: ❌ FAIL** — 54 acceptance 中 **47 PASS / 7 FAIL（§B.6/7/8/9 + §G.31/32 + §G.34 在小视口失败链）**

虽然 §A 静态层 / §C-§E trailing visual 路径 / §F service 4 新字段 / §H 数据正确性 / §I phase 1-8 anti-regression 全 PASS（39 项），但**用户最关键的两项之一**「1280/1024 视口适配」(§G.31/32) 不仅未达标且 1024 反而退步，且 KPI horizontal layout 在小视口破坏了 spec §6 「不动数据格局」约束。

### Per-dimension 阈值

§G 小视口适配（acceptance §G.31 + §G.32）+ §B.7 数据格局不变 同时 FAIL = 整体 FAIL。

### Dynamic exit 状态

- 本 unit r1 = FAIL
- 同 phase 1 r2 + phase 7 r2 + phase 8 r2 模式：BLOCKER 一次精准修复，PR review 是最终安全门
- builder r2 需要重新设计小视口 KPI layout 策略

## 给 builder 的信

**双 BLOCKER**：spec §G.31/32 + §B.7 在小视口连锁失败。

### 修复方向（builder 自选）

**方案 A — 小视口 KPI 卡降级 vertical layout（最稳妥）**

在 1024 (md) 视口让 KPI 卡回到 vertical 布局（trailing 移到主数据下方或隐藏），保持 phase 8 的 88px 单行高度：

```diff
- "rounded-lg p-3 flex-row items-center gap-3 min-h-[88px]"
+ "rounded-lg p-3 flex-col items-stretch gap-2 min-h-[88px] min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-3"
```

或更激进：1024 干脆隐藏 trailing visual（display:none）：
```tsx
<div className="hidden min-[1280px]:block w-20 lg:w-24 h-12 shrink-0 self-center">
  <KpiTrailingVisual ... />
</div>
```

预估效果：1024 KPI row 174.5 → ~88px (-87px)；主体 grid +87px → score row +52px → chart cardContent 4 → ~56px ≥ spec 40 ✓。

**方案 B — 小视口 KPI grid 降级 2 列（用更宽的 2 卡承载 horizontal layout）**

```diff
- "grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
+ "grid gap-3 sm:grid-cols-1 min-[1280px]:grid-cols-4"
```

1024 视口下 KPI 2x2 = 2 行，每卡更宽 (~370px)，主数据 div 不 wrap，但 KPI row 高度 88×2+gap = 184px（比当前 174.5 还稍多）。**不推荐**。

**方案 C — 修 spec §G.34 实际 lg=1024 → 用 min-[1280px]: 自定义断点（部分 fix）**

```diff
- "w-20 lg:w-24 h-12"
+ "w-16 min-[1280px]:w-20 min-[1440px]:w-24 h-12"
```

1024 trailing 64px → 主数据 +32px → 主数据 75px 仍勉强（「完成率」三字仍可能 wrap）。**不彻底**。

### 最优组合（建议）

**方案 A (KPI flex-col on small viewports) + 删 trailing on 1024** — 两步小 diff (~10-20 行)：

1. KPI Card class: `flex-col` default → `min-[1280px]:flex-row`
2. KPI trailing div: `hidden min-[1280px]:block`
3. trailing visual width: 1280=w-20 / 1440+=w-24（用 `min-[1440px]:` 断点）

预估：
- 1024：KPI 88×4=352px (4 卡 1 列 col-1 stack)... 不对，1024 grid-cols-4 单行 4 卡，每卡 vertical 仅 88px 高 → KPI row 88px ✓
- 1280：KPI 88×4=88px 单行（horizontal 起作用）→ phase 8-style + trailing visible ✓
- 1440：保持 r1 状态 ✓

### §H 三视口 0 overflow PASS 不要回归

phase 7 r2 修复 dashboard.tsx L598 `h-[calc(100vh-3.5rem-3rem)]` 仍正确，三视口 overflowPx 全 0 ✓。**修复 §G/§B 时不要碰这行**。

### QA r2 仅回归

- §G.31 1280 chart cardContent ≥ 25px
- §G.32 1024 chart cardContent ≥ 40px
- §B.7 1024 KPI 主数据格局不破坏（width ≥ 100px 让 「完成率」单行）
- §I.40 KPI 主数据数字与 phase 8 一致

其他 47 项已固化（§A / §C-E trailing 路径 / §F service / §H 数据正确性 / §I anti-regression），不需重测。

修完无需重启 dev server（纯 Tailwind hot-reload）。

`.harness/progress.tsv` 待追加 r1 FAIL 行。
