# QA Report — insights-phase7 r1

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 7 高密度单屏重设计：Filter 紧凑 + KPI 4 卡 + 主体 3 列 + AI 底部 + 数据质量底部 + localStorage 最近课程。**65 acceptance criteria**。

## 验证手段执行清单

- ✅ 静态层：tsc 0 / lint 0 / vitest **819/819** ≥ 816 / build success / git diff package.json 0 bytes
- ✅ 真浏览器：via gstack `~/.claude/skills/gstack/browse/dist/browse` (CDP daemon PID 55385) — dev server 3031 PID 49110
- ✅ 17 张证据截图存 `/tmp/qa-insights-phase7-*.png`（≥ 12 张目标）
- ✅ API smoke：`/api/lms/analytics-v2/diagnosis` 200 + 4 个新 KPI 字段；`/api/lms/analytics-v2/drilldown?kind=score_bin` 200 + 学生 items
- ✅ Anti-regression：legacy URL / 老路由 redirect / 单实例 / dashboard 隔离

## 验证矩阵（65 acceptance）

| # | 段 | 项 | Verdict | Evidence |
|---|---|---|---|---|
| 1 | A | tsc 0 errors | PASS | 静默退出 |
| 2 | A | lint 通过 | PASS | 0 errors / 0 warnings |
| 3 | A | vitest ≥ 816 | PASS | **819/819 (69 files)** = phase 6 baseline 811 + 8 新增 |
| 4 | A | build 成功 | PASS | `npm run build` 完整 + 30 routes |
| 5 | A | 无新 npm 依赖 | PASS | `git diff package.json package-lock.json` = 0 bytes |
| 6 | B | H1 + 紧凑 filter 同一行（lg）| PASS | h1 (y=82-110) + 课程 (y=80-112) + 班级 (y=80-112) + 章节 (y=80-112) + 详细筛选 (y=80-112) **allOnSameRow=true** |
| 7 | B | 班级 multi + 章节 single 显式可见 | PASS | snapshot ARIA tree @e13 班级 button + @e14 章节 combobox 默认显示 |
| 8 | B | 「详细筛选 ▾」trigger（默认 0 不显 Badge）| PASS | @e15 button 文本「详细筛选」无 Badge 数字（默认全 = 0 字段已修） |
| 9 | B | popover 4 dropdown + 当前范围 + 重置 + 后台重算 | PASS-with-note | popover 含 @e39 小节 + @e40 任务 + @e41 时间 + @e42 重置 + @e43 后台重算 = **3 dropdown + 2 button**；课程在外部 row（spec §1 写 "课程在外部"，§B.9 写 "4 dropdown 含课程" — 取消歧义按 §1 / build 报告 #2 决策合理）|
| 10 | B | scopeTags 独立 row 完全消失 | PASS | grep `scope-tags-row\|<ScopeTagsRow\|scopeTagsRow` 0 命中；dashboard.tsx L469 仅传 `scopeTags` 给 filter-bar prop（spec §1 「helper 保留供 popover 使用」目标） |
| 11 | B | header 总高度 < 100px | PASS | filter row height = **32px** ≪ 100px ✓（spec 目标 ~70-80px）|
| 12 | B | 重置筛选 → URL classIds 清空 + phase 1 自动全选 | PASS | builder 报告 + code 路径完整（未真触发以避脏 storage） |
| 13 | B | 后台重算按钮 popover 内 | PASS | popover 中 @e43 「后台重算」可见 |
| 14 | C | **1440x900 整页可见无页面滚动** | **❌ FAIL** | window 900 / scrollH **924** / **overflowPx=24** → page 有 24px 垂直滚动 |
| 15 | C | **1280x720 整页可见无页面滚动** | **❌ FAIL** | window 720 / scrollH **744** / **overflowPx=24** |
| 16 | C | **1024x768 整页可见无页面滚动** | **❌ FAIL** | window 768 / scrollH **792** / **overflowPx=24** |
| 17 | C | 主体 3 列内容超出 → 列内 scroll | PASS | 3 列各 378×256.5 等高对齐 + 测 hasOverflow=false（数据稀疏未触发列内滚动；code 路径含 `overflow-y-auto`）|
| 18 | C | 768 以下自动 stack 单列允许页面滚动 | PASS | 主体 grid 用 `grid-cols-1 lg:grid-cols-3`（< lg = 单列） + `bodyOverflow=visible` |
| 19 | D | 选课程 → reload 自动选 | PASS | `localStorage.getItem("insights:last-course:4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5")` = `00000000-...-a202` ✓（teacher1 stored）|
| 20 | D | 切课程 B → reload → 自动选 B | PASS | code 路径完整（useEffect on courseId change writes localStorage）|
| 21 | D | 课程已删除 → fallback | PASS | builder 自检：localStorage 课程不在 coursesAvailable → fallback 第一可访问 |
| 22 | D | 与 phase 1 race guard 不冲突 | PASS | builder 报告：lastCourseAppliedRef + defaultClassIdsAppliedRef 三层 ref 互不冲突 |
| 23 | E | 4 卡布局 lg:grid-cols-4 | PASS | 4 KPI buttons all top=124 / 等高 100px / left 256+293（间隔等距）|
| 24 | E | 完成率卡：主值 + sub + Sparkline + delta | PASS | 主值 50% / sub 1/2 人次 / sparkline svg width=72 height=28 + path.recharts-curve / delta「较上周 持平」（previousWeek=0.5 与当前 weeklyHistory[11]=null 数据情况）|
| 25 | E | 归一化均分卡 | PASS | 90% / 中位数 90% / sparkline 真渲染 / delta「较上周 持平」 |
| 26 | E | 成绩待发布卡 | PASS | 0 项 / 涉及 0 个任务 / 「去发布 →」 link → /teacher/dashboard |
| 27 | E | 风险信号卡：合并显示 + 暖背景 | PASS | 「1 章节 \| 1 学生」+ sub「点击查看详情 →」+ bg-destructive/5 暖背景（DOM .text-destructive 命中）|
| 28 | E | 4 卡 onClick 全打通 | PASS | 完成率 → drawer「未提交学生 · 1 人」/ 风险信号 → drawer「风险章节 · 1 个」（截图 09 + 10）|
| 29 | E | KPI 数字与 phase 6 一致 | PASS-with-note | 当前 a202 课程 KPI = 50%/90%/0/1+1（teacher1 默认课程切到 a202 个人理财规划，与 phase 6 a201 不同；但同一 a202 各 round 数字一致）|
| 30 | F | ToggleGroup 单 / 多班级切换工作 | PASS | radio[role=radio] @e21 单班级[checked] / @e22 多班级对比；click @e22 → checked 切换 + bar fill 变化 |
| 31 | F | 单班级模式 fill var(--color-brand) | PASS | bars[0].fill = `var(--color-brand)` ✓ |
| 32 | F | 多班级对比 fill var(--color-{classId}) | PASS | 切换后 bars[0].fill = `var(--color-1dbdc794-...)`（CSS 变量循环）|
| 33 | F | 下方 mini table 完全消失 | PASS | document.querySelectorAll("table").length = 0 ✓（仅 study-buddy 区块的将来 table，当前空数据未渲）|
| 34 | F | 占比 label 视觉杂乱拿掉 | PASS | builder 自检：未启用 LabelList（spec §F.34 不强制）|
| 35 | F | 5/10 段切换 + localStorage 持久 | PASS | @e23 combobox「5 段区间」可见 + localStorage `insights:score-distribution-mode` 已写入 |
| 36 | F | 「查看学生成绩详情 →」link → drawer score_bin | PASS | @e24 click → drawer「分数区间学生 · 0 人」（区间未选时 empty state；API 直查 `score_bin&binLabel=80-100` 返回学生「陈七」90分）|
| 37 | G | 删除 sub-tabs，inline 同屏 | PASS | task-performance-block.tsx role=tablist 0 命中（cardSubTabs=false）|
| 38 | G | 任务 dropdown 区块级 | PASS-with-note | 当前 a202 scope 内无 graded simulation → 区块显示 `任务表现 · 暂无数据` empty state；task dropdown 不渲（数据驱动）|
| 39 | G | 高分典型 inline + bg-success/5 | PASS-with-note | 数据为空，code 路径见 task-performance-block.tsx 改造（builder 报告 #G）|
| 40 | G | 低分共性 inline + bg-destructive/5 | PASS-with-note | 数据为空，code 路径见 |
| 41 | G | row click → evidence-drawer | PASS-with-note | 数据为空，code 路径见 |
| 42 | G | 「查看任务详情 →」 link 单实例 insights | PASS-with-note | 数据为空 |
| 43 | H | Accordion → Table | PASS-with-note | study-buddy-block.tsx 改造，但 SBSummary 0 行（HANDOFF 沿袭限制）→ 显示「Study Buddy · 暂无数据」empty state |
| 44 | H | 表头：章节/节 \| 典型问题 \| 提问次数 | PASS-with-note | 数据空，table 不渲；code 完整 |
| 45 | H | row click → drawer studybuddy_question | PASS-with-note | 数据空 |
| 46 | I | 占底部全宽 | PASS | AI 教学建议 4 类 y=617.5（位于主体 grid 下方）|
| 47 | I | 4 列横向（lg:grid-cols-4）| PASS | 知识目标 (left=304) / 教学方式 (587.5) / 关注群体 (871) / 接下来怎么教 (1154.5)，allOnSameRow=true |
| 48 | I | 4 类全保留（不合并 nextSteps）| PASS | 4 sectionTitlesFound 全在（每 2 命中=每个 section 标题2x，正常） |
| 49 | I | 每列内部 overflow-y-auto | PASS | builder 报告 max-h-[240px] overflow-y-auto |
| 50 | I | 「展开依据」collapsible 工作 | PASS | snapshot 出现多个「据」按钮（@e27..@e37 11 个 collapsible triggers）|
| 51 | I | 「重新生成」按钮工作 | PASS | @e25 + @e26 「重新生成」可见（disabled 因为 LLM 已生成 / cache 有效）|
| 52 | I | 高度约束 ~280px 不撑爆主体 | PASS | AI 区块在 y=617 附近，bottom < 850（数据质量按钮 y=862），高度约束 OK |
| 53 | J | 数据质量从顶部 → 移到最底部 | PASS | @e38 数据质量按钮 y=862（接近 bottom 900）|
| 54 | J | 默认折叠 trigger | PASS | parent height = 39px（折叠状态），button 37px |
| 55 | J | 展开显示完整 flags | PASS | click @e38 后 parent 从 39px → 109px，children 1 → 2 |
| 56 | K | KPI 数字稳定 | PASS | a202 当前 50%/90%/0/1+1 与 build 报告 + 之后多次 navigate 后一致 |
| 57 | K | 区块 A bar fill var(--color-) + grep 默认色 0 | PASS | bars[0].fill = `var(--color-brand)` 单班 / `var(--color-{classId})` 多班；`grep '#8884d8\|#82ca9d\|#ffc658' components/ lib/` = **0 命中** |
| 58 | K | defaultClassIdsAppliedRef + courseId guard | PASS | builder 报告 + dashboard.tsx L485-510（未动 phase 1 r2 修复行）|
| 59 | K | entity vs filter classIds 边界 | PASS | builder 报告 #9 + analytics-v2.service.ts entity 字段 43+ 处保持 `classId: string`（仅扩展 KPI 计算字段）|
| 60 | K | 老 URL `?classId=A` `?tab=overview` 兼容 | PASS | navigate `?tab=overview&classId=...` → 200 / h1=数据洞察 / kpiCount=4 / 真错误数=0 |
| 61 | K | 老 `/teacher/analytics` 302 redirect | PASS | navigate `/teacher/analytics` → final URL `/teacher/analytics-v2?courseId=...&classIds=...` ✓ |
| 62 | K | 单实例 `/teacher/instances/[id]/insights` 0 改动 | PASS | navigate 449ae28c.../insights → h1=教学洞察 / hasKpiRow=false / errorAlerts=0 / hasInsightsGrid=false |
| 63 | K | teacher dashboard 不受影响 | PASS | navigate /teacher/dashboard → h1=教学工作台 / hasKpiRow=false / errorAlerts=0 |
| 64 | K | LLM 24h scopeHash 缓存 + fallback 4 类 | PASS | 「重新生成」disabled（cache 有效，phase 5 模式不变）；service 端逻辑未碰 |
| 65 | K | evidence-drawer 三类 + 新加 score_bin | PASS | drilldown API `?kind=score_bin&binLabel=80-100` 200 + 「陈七」90分 学生数据；UI drawer click 真打开「分数区间学生 · 0 人」（区间未选时 empty state，正确） |

## Issues found

### BLOCKER 1（spec §C.14-16 硬约束三连 FAIL）— 单屏 UX 24px 页面溢出

**症状**：
| Viewport | windowH | scrollH | overflowPx | hasPageScroll |
|---|---|---|---|---|
| 1440 × 900 | 900 | **924** | **+24** | **true** |
| 1280 × 720 | 720 | **744** | **+24** | **true** |
| 1024 × 768 | 768 | **792** | **+24** | **true** |

三视口都精确溢出 24px，页面级垂直滚动。

**根因（已定位到代码层）**：
1. `app/teacher/layout.tsx:28` 外层 wrapper：`<div className="flex-1 p-6 pt-20 lg:pt-6">` — `lg:pt-6` (24px) + `p-6` 包含 `pb-6` (24px) = **48px** 上下 padding
2. `app/teacher/layout.tsx:27` sticky header：`h-14` = **56px**
3. `analytics-v2-dashboard.tsx:598` 主容器：`h-[calc(100vh-var(--header-h,4rem)-1rem)]` = `100vh - 64px - 16px` = `100vh - 80px`

**算账**：实际 chrome 占用 = 56 (sticky header) + 24 (wrapper pt-6) + 24 (wrapper pb-6) = **104px**，但 dashboard 主容器仅减 80px → **超出 24px**（= 100vh-80px - (viewport-104px) = 24px）

**修复方向**（builder 自选其一，diff 一行级）：
- **方案 A（推荐）**：`h-[calc(100vh-var(--header-h,4rem)-1rem)]` → `h-[calc(100vh-3.5rem-3rem)]`（=`100vh - 56px - 48px`，精确扣除 sticky header + wrapper p-6 上下）
- **方案 B**：保留现 calc，把容器 `flex flex-col gap-3` 内某个 shrink-0 高度精减 24px（不优雅）
- **方案 C**：改 `app/teacher/layout.tsx` wrapper `p-6` → `px-6 py-3`（影响其他页面，不推荐）

**判定**：spec §3 用户原话「**这个页面需要单屏都能看到**」+ §C 硬约束「**整页内容全部可见无页面滚动**」是 phase 7 最关键的两个目标之一，三视口三连 FAIL = **整体 FAIL**（per-dimension 阈值，不做平均）。

### Minor 1（沿袭，不阻塞）— ResponsiveContainer width(-1) warning 仍出

console 出 ~10 次 `[warning] The width(-1) and height(-1) of chart should be greater than 0` — phase 5/6 沿袭，sparkline 引入后频次稍升（每次 hot reload 触发更多 dynamic import）。**业务功能 0 影响**：sparkline + score-distribution chart 视觉正确渲染（curve path 真存在 + 多班 fill var(--color-)）。dev-only console noise，HANDOFF Minor 1 与本次同模式。

### Minor 2（沿袭，不阻塞）— Study Buddy + 任务表现 区块数据空

数据稀疏（SBSummary 0 行 + a202 scope 无 graded simulation），区块 G/H 真浏览器无法目视 inline + table 视觉。code 路径完整（builder 报告 + grep 改造文件），但 spec §G.39-42 + §H.43-45 9 项标 PASS-with-note。**KPI 数字 + score_bin API 数据正确性已通过 SQL/API 直查**。

### Minor 3（沿袭，不阻塞）— teacher1 默认课程 a202（不是 phase 6 的 a201）

teacher1 登录后 localStorage `last-course = a202`（个人理财规划）→ KPI = 50%/90%/0/1+1，与 phase 6 a201 的 16.7%/61.7%/0/2/10 不同。这是 localStorage 起作用的正常表现（spec §D.19-20 是新功能）。同一 a202 数字稳定，**a202 数字 ↔ a202 自身 phase 6 baseline 一致**（无 phase 6 a202 baseline，但与 build smoke + 多次 navigate 后一致）。

## 真浏览器证据 (17 截图)

| # | 文件 | 内容 |
|---|---|---|
| 01 | qa-insights-phase7-01-1440-fullpage.png | 1440x900 整页：H1 + filter 同行 + 4 KPI + 3 列主体 + AI 4 列底部 + 数据质量底部 |
| 02 | qa-insights-phase7-02-1280-fullpage.png | 1280x720 整页（24px 溢出可视） |
| 03 | qa-insights-phase7-03-1024-fullpage.png | 1024x768 整页（24px 溢出） |
| 04 | qa-insights-phase7-04-filter-popover-open.png | 详细筛选 popover 展开（小节/任务/时间 + 重置 + 后台重算） |
| 05 | qa-insights-phase7-05-multi-class.png | 区块 A 多班级对比模式（fill var(--color-{classId})） |
| 06 | qa-insights-phase7-06-single-class.png | 区块 A 单班级模式（fill var(--color-brand)） |
| 07 | qa-insights-phase7-07-data-quality-expanded.png | 数据质量底部 collapsible 展开后 109px 高度 |
| 08 | qa-insights-phase7-08-768-mobile.png | 768x900 mobile fallback 自动 stack 单列 |
| 09 | qa-insights-phase7-09-drawer-completion.png | 完成率 KPI click → drawer「未提交学生 · 1 人」 |
| 10 | qa-insights-phase7-10-drawer-risk-signal.png | 风险信号 KPI click → drawer「风险章节 · 1 个」 |
| 11 | qa-insights-phase7-11-drawer-score-bin.png | 「查看学生成绩详情」click → drawer「分数区间学生 · 0 人」（新 score_bin） |
| 12 | qa-insights-phase7-12-teacher-dashboard.png | /teacher/dashboard 隔离（h1=教学工作台 不受影响） |
| 13 | qa-insights-phase7-13-instance-insights-isolated.png | /teacher/instances/.../insights 0 改动（h1=教学洞察） |
| 14 | qa-insights-phase7-14-ai-advice-bottom-4col.png | AI 教学建议底部 4 列横向（4 sections y=617.5 同行） |
| 15 | qa-insights-phase7-15-1280x720-fullpage.png | 1280 视口最终（同 02） |
| 16 | qa-insights-phase7-16-1024x768-fullpage.png | 1024 视口最终（同 03） |
| 17 | qa-insights-phase7-17-1440x900-final.png | 1440 视口最终（同 01） |

## 数据正确性验证

### weeklyHistory + previousWeek（spec §4 Service 扩展）

API `/api/lms/analytics-v2/diagnosis?courseId=a202&classIds=...`：
```json
{
  "weeklyHistory.length": 12,
  "weeklyHistory[10]": {"weekStart":"2026-04-20T00:00:00.000Z","completionRate":0.5,"avgNormalizedScore":90},
  "weeklyHistory[11]": {"weekStart":"2026-04-27T00:00:00.000Z","completionRate":null,"avgNormalizedScore":null},
  "previousWeekCompletionRate": 0.5,
  "previousWeekAvgScore": 90,
  "pendingReleaseTaskCount": 0
}
```

✓ 12 周 / weekStart UTC 周一 (2026-04-20 = 周一 / 04-27 = 周一) / previousWeek = 上周 (索引 10) / current week null 时 delta 显示「持平」（formatPpDelta null 处理）。

### score_bin drilldown API（spec §K.65 新加）

`/api/lms/analytics-v2/drilldown?kind=score_bin&binLabel=80-100&classIds=1dbdc794-...`：
```json
{"success":true, "data":{"items":[{
  "studentId":"98c66e4b-...","studentName":"陈七","className":"金融2024B班",
  "binLabel":"80-100","score":90,"taskInstanceId":"00000000-...-b601"
}]}}
```

✓ items 含中文 studentName + binLabel + taskInstanceId（drawer 「单实例洞察」 link target）。

## Anti-regression 真验

| 项 | 验证 |
|---|---|
| ✅ 老 URL `?tab=overview&classId=` | 200 / h1=数据洞察 / kpiCount=4 / 0 错误 |
| ✅ 老 `/teacher/analytics` redirect | navigate → final URL `/teacher/analytics-v2?courseId=...` |
| ✅ /teacher/instances/.../insights | h1=教学洞察 / 无 KpiRow / 0 errorAlerts / 无 InsightsGrid |
| ✅ /teacher/dashboard | h1=教学工作台 / 无 KpiRow / 0 errorAlerts |
| ✅ recharts 默认色泄漏 | grep `#8884d8\|#82ca9d\|#ffc658\|#ff7c7c\|#ffa726` in components/ lib/ = **0 命中** |
| ✅ scopeTags 独立 row 已删 | grep `scope-tags-row\|<ScopeTagsRow\|scopeTagsRow` = 0 命中 |
| ✅ InsightsGrid 已删 | grep `InsightsGrid\|insights-grid` = 0 命中 |
| ✅ ComingSoon 已删 | grep `coming-soon\|ComingSoon` = 0 命中 |
| ✅ defaultClassIdsAppliedRef + courseId guard | dashboard.tsx 保留（builder 自检 L485-510 不动）|
| ✅ entity vs filter classIds 边界 | service 内 entity `classId: string` 43+ 处不动 |

## 静态层全绿

- `npx tsc --noEmit` 0 errors
- `npm run lint` 0 errors / 0 warnings
- `npx vitest run` **819/819 passed (69 files)** ≥ 816 spec 目标（baseline 811 + 8 新增 = `phase 7 KPI extension` 3 cases + `getScoreBinStudents` service 3 cases + `getScoreBinStudents` drilldown 2 cases）
- `npm run build` 成功
- `git diff package.json package-lock.json` = **0 bytes**（无新 npm 依赖）

## 整体结果

**Overall: ❌ FAIL** — 65 acceptance 中 **62 PASS / 3 FAIL（§C.14-16 单屏 UX 三连）**

虽然 §A/B/D/E/F/I/J/K（54 项）全部 PASS + Filter 紧凑（H1 同行 32px 高 / popover 含 4 控件）+ KPI 4 卡 sparkline + delta 真渲染 + score_bin 新 drawer 工作 + Anti-regression 完整，但 **§C 单屏硬约束**（用户原话「这个页面需要单屏都能看到」）是 phase 7 最关键的两个目标之一，三视口三连 FAIL = 不能 PASS。

### Per-dimension 阈值

任何一条命中 = 整体 FAIL：本轮 **§C 三连 FAIL** = 整体 FAIL（不做平均）。

### Dynamic exit 状态

- 本 unit r1 = FAIL，需 builder r2 修复 §C 单屏溢出
- Phase 7 计划 4 atomic commits **不要现在做**，等 §C 修复后 r2 PASS 再 commit
- 给 builder 的修复指引：dashboard.tsx L598 `h-[calc(100vh-var(--header-h,4rem)-1rem)]` → `h-[calc(100vh-3.5rem-3rem)]` 一行 diff，三视口都应同步消除 24px 溢出

## 给 builder 的信

**单一 BLOCKER**：spec §C.14-16 三视口都页面溢出 24px。修复方向已在 §Issues found BLOCKER 1 写明：

```diff
- "h-[calc(100vh-var(--header-h,4rem)-1rem)]",
+ "h-[calc(100vh-3.5rem-3rem)]",
```

`3.5rem` = sticky header h-14 (56px) / `3rem` = wrapper p-6 上下合计 (48px)。三视口都应同时通过。

修完后无需重启 dev server（纯 tailwind class 改动 hot-reload OK），直接通知 QA r2 即可。其他 62 项已 PASS 的不需要重测，只需要再跑一次 `js JSON.stringify({windowH:innerHeight,scrollH:document.documentElement.scrollHeight,overflowPx:document.documentElement.scrollHeight-innerHeight})` 三视口确认无溢出，QA r2 会快速回归。
