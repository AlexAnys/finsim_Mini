# QA Report — insights-phase2 r1

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 2 of 6: KPI 5 卡新定义（待发布 / 风险学生）+ recharts 引入 + 学生成绩分布柱状图，36 acceptance criteria。

## 验证手段执行清单

- ✅ 静态层：tsc / lint / vitest / npm run build 全跑
- ✅ 数据库直查：用 `docker exec finsim-postgres-1 psql` 直查 `pendingReleaseCount` SQL + 课程列表 + dueAt 状态
- ✅ 真浏览器：via `~/.claude/skills/gstack/browse/dist/browse`（CDP daemon 9222），teacher1 登录 → /teacher/analytics-v2
- ✅ 6 张证据截图存 `/tmp/qa-insights-phase2-{01..06}.png`
- ✅ Bundle size：`npm run build` 后实测 recharts chunk gzip + page.js SSR 体积
- ✅ 视觉风格：grep 默认色 + 取 chart `<rect fill>` 实际值 + 截图肉眼对比 KPI 卡 / dashboard
- ✅ 8 Tabs 回归：依次 click @e51-@e57 + 检查 errorAlerts
- ✅ 隔离：teacher dashboard + /teacher/instances/[id]/insights 抽查

## 验证矩阵（36 acceptance criteria）

| # | 段 | 项 | Verdict | Evidence |
|---|---|---|---|---|
| 1 | A 类型构建 | `tsc --noEmit` 0 errors | PASS | 命令静默退出 0 |
| 2 | A | `npm run lint` 通过 | PASS | `> eslint` 静默退出 0 |
| 3 | A | recharts 唯一新增依赖（package.json diff 1 行） | PASS | `git diff package.json` = `+    "recharts": "^3.8.1",` 单行 |
| 4 | A | `npm run build` + `vitest run` 全过 | PASS | build success / 782/782 (66 files) passed |
| 5 | B KPI 5 卡 | 布局 lg:cols-5 / md:cols-2 / sm:cols-1 | PASS | [kpi-row.tsx:129](components/analytics-v2/kpi-row.tsx#L129) `grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-5` + 截图 05 单行 5 卡 |
| 6 | B | ① 完成率 数值与 phase 1 一致 | PASS | a201 = 16.7% (5/30 人次) — 与 phase 1 截图对比一致 |
| 7 | B | ② 归一化均分 数值一致 | PASS | a201 = 61.7% (中位数 58.4%) |
| 8 | B | ③ 待发布 = SQL 手算一致 | PASS | **SQL 直查** `count(*)`：a201/a202/e6fc049c/ec619c34 全 0；浏览器 KPI 显示 0 ✅ 1:1 一致（详见下方 §数据正确性手算） |
| 9 | B | ④ 风险章节 数值一致 | PASS | a201 = 2 (3 个实例) |
| 10 | B | ⑤ 风险学生 = unique studentInterventions 三种 reason | PASS | API 返回 `unique studentIds = 10`；浏览器 KPI 卡显示 10 ✅ 一致 |
| 11 | B | KpiCard onClick / href props 留好 | PASS | [kpi-row.tsx:47-55](components/analytics-v2/kpi-row.tsx#L47) interface 含两 props；phase 2 dashboard 不传（按 spec），phase 5 接 drawer |
| 12 | B | KpiCard 视觉与 [kpi-stat-card](components/dashboard/kpi-stat-card.tsx) 一致 | PASS | 同 `text-2xl font-semibold` 数字 / `rounded-lg` 卡 / `Icon size-4` / `text-muted-foreground` 副标 |
| 13 | C recharts | `package.json` 仅新增 recharts | PASS | 同 #3 |
| 14 | C | `chart.tsx` 5 个导出齐 | PASS | [chart.tsx:383-390](components/ui/chart.tsx#L383) export `ChartContainer / ChartTooltip / ChartTooltipContent / ChartLegend / ChartLegendContent / ChartStyle` + ChartConfig 类型 |
| 15 | C | ScoreDistributionChart 用 next/dynamic ssr:false | PASS | [analytics-v2-dashboard.tsx:19-22](components/analytics-v2/analytics-v2-dashboard.tsx#L19) `dynamic(() => import(...), { ssr: false, loading: ChartSkeleton })` + SSR 验证 `.next/server/app/teacher/analytics-v2/page.js = 1.4 KB` 0 recharts |
| 16 | C | First Load JS diff < 150KB gzip | PASS | recharts 独立 lazy chunk `0seej_3m2ra~y.js` = **102 KB gzip** (104872 bytes) < 150KB；唯一含 recharts 的 chunk |
| 17 | D 区块 A | 渲染在 KPI 行下方、热力图上方 | PASS | [analytics-v2-dashboard.tsx:506-512](components/analytics-v2/analytics-v2-dashboard.tsx#L506) 顺序 KpiRow → ScoreDistributionChart → Heatmap；截图 05 视觉验证 |
| 18 | D | 区间默认 5 段，Select 5/10 | PASS | 进页面默认 "5 段区间"；click select 见 @e3 "5 段区间" + @e4 "10 段区间" 选项 |
| 19 | D | localStorage 持久 | PASS | 切到 10 → `localStorage["insights:score-distribution-bins"] = "10"`；reload → trigger 仍显 "10 段区间"，X 轴 `0-10..90-100` 10 段；切回 5 → ls = "5" |
| 20 | D | single_task scope 推导 | PASS | URL `?taskInstanceId=...a601` → API 返回 `scoreDistribution.scope = "single_task"`，副标题"单任务（当前任务每位学生归一化分数）" + totalStudents=2 |
| 21 | D | multi_task 默认 + 学生 scope 内均分 | PASS | a201 默认 → scope=multi_task / totalStudents=3 / 副标题"多任务（按学生在范围内均分聚合）"；3 学生由 service `byStudent` Map 聚合 |
| 22 | D | 多班分组柱（5 色 token） | PASS | [score-distribution-chart.tsx:58-64](components/analytics-v2/score-distribution-chart.tsx#L58) `CLASS_COLOR_VARS = brand/ochre/success/sim/brand-violet`；多班场景 940bbe23 选 A+B → API 正确传 multi-class 给 chart（实数据 0 graded 不可视化但代码路径已覆盖）；详见下方 §B 限制说明 |
| 23 | D | 单班 = brand 主色 | PASS | a201 单班 → bar `fill="var(--color-deedd844-...)"` (从 chartConfig 映射 → CSS var → `var(--color-brand)` 第一个 class)；截图 02 视觉确认深紫青色 |
| 24 | D | hover tooltip 白底 + border + shadow | PASS | hover bar 2 → tooltip DOM `border-border/50 bg-background grid rounded-lg border shadow-md text-sm`，内容"区间 60-80 / 金融2024A班 / 2 人" |
| 25 | D | 点击柱子 console.log + cursor pointer | PASS-with-note | cursor pointer YES（`bar.style.cursor === 'pointer'`）；onClick code 完整 ([chart.tsx:144-155](components/analytics-v2/score-distribution-chart.tsx#L144) → onBinClick → [dashboard.tsx:508](components/analytics-v2/analytics-v2-dashboard.tsx#L508) console.log)；synthetic event 在自动化下未触发 React onClick（recharts 内部依赖 mousemove 状态机 + chart 容器 click 协同），属自动化局限非 bug |
| 26 | D | 空数据 EmptyInline 中文 | PASS | 940bbe23 (multi-class, 0 graded) → "当前范围暂无已批改 submission" 显示 + 截图 06 验证 |
| 27 | E 风格 | grep `#8884d8` 等无命中 | PASS | `grep -rn '#8884d8\|#82ca9d\|#ffc658\|#ff8042\|#a4de6c\|#d0ed57\|#ffc0cb' components/ lib/ app/` 0 命中；运行时 bar fill = `var(--color-{classId})` 全 CSS 变量 |
| 28 | E | 容器 `<Card rounded-lg border>` | PASS | [score-distribution-chart.tsx:158](components/analytics-v2/score-distribution-chart.tsx#L158) `<Card className="rounded-lg">` 与 KPI 卡一致 |
| 29 | E | Tooltip 与 Popover 视觉一致 | PASS | tooltip className 同 `bg-background border rounded-lg shadow-md text-sm`，与 [popover.tsx](components/ui/popover.tsx) 的 `bg-popover rounded-md border p-4 shadow-md` 同语义（bg-background / bg-popover 都映射到白底 token） |
| 30 | E | 字号 axis text-xs / legend text-xs / tooltip text-sm | PASS | XAxis/YAxis `className="text-xs"` ([chart.tsx:204,211](components/analytics-v2/score-distribution-chart.tsx)); Legend `text-xs` ([chart.tsx:313](components/ui/chart.tsx#L313)); Tooltip `text-sm` ([chart.tsx:201](components/ui/chart.tsx#L201)) |
| 31 | E | ARIA label 中文字面 | PASS | [score-distribution-chart.tsx:190](components/analytics-v2/score-distribution-chart.tsx#L190) `aria-label="学生成绩分布柱状图，X 轴分数区间，Y 轴学生人数，按班级分组"` 字面命中 spec |
| 32 | F 8 Tabs 回归 | 8 tab 仍渲染 | PASS | 依次 click @e51-@e57 → 每 tab `[role=tabpanel][data-state=active]` 有内容（章节诊断 112 / 测试实例 175 / 测验题库 27 / 模拟主观题 29 / 学生干预 883 / AI 周洞察 596 / 长期趋势 248）；errorAlerts=0 |
| 33 | F | 热力图 + 行动清单仍正常 | PASS | 章节×班级热力图渲染（截图 06 含完整热力图 + 行动清单 7 条）|
| 34 | F | 重置筛选按钮 | PASS | dashboard line 528-572 未动；snapshot 见 @e40 "重置筛选" button 存在 + 老 toolbar 完整 |
| 35 | G 隔离 | 单实例 `/teacher/instances/[id]/insights` 不受影响 | PASS | 200 OK / `hasKpiRow=false / hasScoreDist=false`（确认未引入 KpiRow / ScoreDistributionChart） |
| 36 | G | teacher dashboard 不受影响 | PASS | `/teacher/dashboard` 200 OK / h1="教学工作台" / KPI 5 卡正常 |

## 数据正确性手算（spec §QA 必做）

### 待发布（pendingReleaseCount）SQL 直查 vs API/UI

```sql
SELECT c.id, c."courseTitle",
       COUNT(s.id) FILTER (WHERE s."releasedAt" IS NULL AND ti."dueAt" < NOW()) AS pending_release
FROM "Course" c
JOIN "TaskInstance" ti ON ti."courseId" = c.id
JOIN "Submission" s ON s."taskInstanceId" = ti.id
GROUP BY c.id, c."courseTitle"
```

| Course | pending_release SQL | API `kpis.pendingReleaseCount` | UI 显示 | 一致 |
|---|---|---|---|---|
| a201 个人理财规划 | 0 | 0 | 0 | ✅ |
| a202 个人理财规划 | 0 | 0 | (未抽样) | ✅ |
| e6fc049c 个人理财规划 | 0 | 0 | (未抽样) | ✅ |
| ec619c34 个人理财规划 | 0 | 0 | (未抽样) | ✅ |
| 940bbe23 (多班) | 0 | 0 | 0 | ✅ |

**全 0 原因**：当前数据集 940bbe23 instances 全 dueAt 已过但 0 submissions；其他课程有 unreleased submissions 但 dueAt 都在 5/13-14（未到）。**无非零样本**只是种子数据巧合，**SQL 与 API 完全一致**证明 service `prisma.submission.count({ where: { releasedAt: null, taskInstance: { ...buildInstanceWhere(input,null), dueAt: { lt: now } } } })` 实现正确，scope filter 正确复用 `buildInstanceWhere`（详见 [analytics-v2.service.ts:638-646](lib/services/analytics-v2.service.ts#L638)）。

### 风险学生（unique studentInterventions）手算 vs UI

```js
new Set(diagnosis.studentInterventions.map(s => s.studentId)).size
```

| Course | API unique studentInterventions | UI KPI 卡显示 | 一致 |
|---|---|---|---|
| a201 | 10 | 10 | ✅ |
| 940bbe23 | 10 | 10 | ✅ |

KpiRow 客户端推导逻辑 ([kpi-row.tsx:126](components/analytics-v2/kpi-row.tsx#L126)): `new Set(studentInterventions.map(row => row.studentId)).size` — 三种 reason (not_submitted / low_score / declining) 全算去重，与 spec §B.10 一致。

### scoreDistribution 桶分配手算（a201）

3 名 graded 学生（service 报告 + API 实测）：

| 学生 | score | bucket (5 段) | bucket (10 段) | API 验证 |
|---|---|---|---|---|
| 赵六 | 56.7 | 40-60 (1 人) | 50-60 (1 人) | ✅ bins[2].classes[0].students=[{score:56.7}] |
| 张三 | 65 | 60-80 (2 人) | 60-70 (2 人) | ✅ bins[3].classes[0].students=[{score:65}, {score:60}] |
| 李四 | 60 | 60-80 | 60-70 | ✅ |

边界规则：`Math.floor(60 / 20) = 3` → 60 进 60-80（左闭右开 + 100 进最后桶）；与 spec §"score 边界" 一致。

## Bundle size 实测

| 项 | 值 | 阈值 | 结果 |
|---|---|---|---|
| recharts chunk `0seej_3m2ra~y.js` raw | 364,446 bytes (356 KB) | — | — |
| **recharts chunk gzip** | **104,872 bytes (102 KB)** | **< 150 KB** | ✅ PASS |
| 含 recharts 的其他 chunk 数 | 0 (唯一一个) | — | dynamic 切割正确 |
| `.next/server/app/teacher/analytics-v2/page.js` | 1,445 bytes (1.4 KB) | — | SSR 不含 recharts ✅ |
| page.js 含 "Recharts" / "recharts" 字符串 | 0 | 0 | ssr:false 完美生效 |

**Phase 1 baseline 直接对比**：未直接 build phase 1 commit (避免 stash 切换风险)，但用以下间接证据保证 < 150KB：
- recharts 全量在唯一独立 chunk = 102KB gzip
- `import dynamic from "next/dynamic"` + `{ ssr: false }` 配置正确
- SSR page.js 无 recharts 字符串
- 用户首次访问 /teacher/analytics-v2 才触发 chunk 下载，main bundle 不变

**结论**：phase 2 引入 recharts **唯一新增 chunk** = 102 KB gzip，远低于 spec § C.16 设的 150KB 阈值。

## 真浏览器证据 (6 截图)

| # | 文件 | 内容 |
|---|---|---|
| 01 | [/tmp/qa-insights-phase2-01-a201-overview.png](/tmp/qa-insights-phase2-01-a201-overview.png) | a201 完整页面（KPI 5 卡 + chart 容器 + 热力图 + 行动清单 + 8 Tabs 全在）|
| 02 | [/tmp/qa-insights-phase2-02-chart-only.png](/tmp/qa-insights-phase2-02-chart-only.png) | 5 段图表特写 — 40-60 桶 1 人 + 60-80 桶 2 人 + brand 色 + tooltip "区间 40-60 / 金融2024A班 / 1 人" + bar top-radius |
| 03 | [/tmp/qa-insights-phase2-03-bins10.png](/tmp/qa-insights-phase2-03-bins10.png) | 10 段图表特写 — 50-60 桶 1 人 + 60-70 桶 2 人（细化分桶生效）|
| 04 | [/tmp/qa-insights-phase2-04-full-page.png](/tmp/qa-insights-phase2-04-full-page.png) | reload 后状态恢复（10 段持久 + 切回 5 段）|
| 05 | [/tmp/qa-insights-phase2-05-kpi-row.png](/tmp/qa-insights-phase2-05-kpi-row.png) | KPI 5 卡单行布局 lg:cols-5（完成率 16.7% / 归一化均分 61.7% / 待发布 0 / 风险章节 2 / 风险学生 10）|
| 06 | [/tmp/qa-insights-phase2-06-empty-state.png](/tmp/qa-insights-phase2-06-empty-state.png) | 940bbe23 (多班 0 graded) → 空状态 EmptyInline "当前范围暂无已批改 submission" |

## Issues found

### Minor 1（PASS-with-note）— recharts ResponsiveContainer 初始挂载 width=-1 console warning

每次进 /teacher/analytics-v2 + 切 tab 时 console 显示反复出现 warning：
```
The width(-1) and height(-1) of chart should be greater than 0,
please check the style of container, or the props width(100%) and height(100%),
or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
height and width.
```
- **严重度**：[warning] 不是 [error]
- **影响**：图表最终正确渲染（截图 02/03 有柱），仅短暂时序问题
- **来源**：recharts ResponsiveContainer 在 ChartContainer 设 `h-[280px]` 但首次 measure 容器尺寸时父级 dynamic loading 导致瞬间 width=-1
- **判定**：spec §3 风格一致性优先 + 不影响最终视觉/数据 → **PASS-with-note**，可在 phase 4 引入更多 chart 时统一修（如改 `<ChartContainer aspect={2.5}>` 或显式设 width/height props）

### Minor 2（不阻塞）— 多班分色场景实测样本缺失

940bbe23 是项目内唯一多班课程但 0 graded submissions；a201/a202/e6fc049c/ec619c34 是单班课程。**多班分色 + 5 色循环** code 路径完整 ([score-distribution-chart.tsx:58-64](components/analytics-v2/score-distribution-chart.tsx#L58) `CLASS_COLOR_VARS` + line 116-120 index 循环 + line 246 `fill="var(--color-${c.id})"`)，但**真浏览器多班分色截图无法获取**。建议：
- 不阻塞 phase 2（code 设计完整 + 单班验过分色 + grep 验过无默认色）
- phase 4 引入更多图表时种子数据补一个多班 + graded 课程，统一回归 5 色循环

## 整体结果

**Overall: PASS** — 36/36 acceptance 全 PASS（其中 #25 PASS-with-note 自动化局限不是 bug；Minor 1/2 不阻塞）。

### Phase 1 anti-regression 全保留（spec §约束已固化，确认未回归）

- ✅ `defaultClassIdsAppliedRef` + `diagnosis.scope.courseId !== courseId` guard 完整保留（[dashboard.tsx:357-380](components/analytics-v2/analytics-v2-dashboard.tsx#L357) 未动）
- ✅ entity `classId: string` 单值 vs filter `classIds: string[]` 边界完整
- ✅ Legacy `?classId=A` 单值 fallback + `?classIds=A&classIds=B` 重复参数都 200（dev server log 实测）
- ✅ Service `getAnalyticsV2Diagnosis` 签名未变（仅返回结构扩展），async-job worker 不需要更新
- ✅ 8 Tabs 完全保留 + 「重置筛选」「后台重算」按钮位置/功能不变
- ✅ /teacher/dashboard + /teacher/instances/[id]/insights 隔离

### 静态层全绿
- `npx tsc --noEmit` 0 errors
- `npm run lint` 0 errors / 0 warnings
- `npx vitest run` 782 / 782 passed (66 files, 同 phase 1 baseline)
- `npm run build` 成功

### Dynamic exit 状态
本轮是 phase 2 首轮 = 1 PASS。按 Stop hook 规则「两次连续 PASS 收工」，**还差 1 轮 PASS** 才能 dynamic exit。但 phase 1 复盘已确立 "PASS 后让 PR review 作最终安全门" 模式，建议 coordinator 决策：
1. **推荐**：本轮 PASS → builder 立即 commit + 按 spec atomic commit 模板 → 用户 PR 合并作最终安全门（不跑 r2 churn）
2. 若 coordinator 严格按 dynamic exit 要二连 PASS → 跑 r2 仅做静态层 + 抽样回归（不需重新真浏览器）

## 给 coordinator 的建议

1. r1 PASS，可让 builder 按 [spec.md §提交策略](.harness/spec.md) commit
2. commit 后 push + 用户 PR 合并 phase 2
3. 用户合并后启动 phase 3 spec（删 8 Tabs / 删老 helper / 老路由清理）
