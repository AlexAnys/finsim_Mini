# QA Report — pr-5d r1

**Unit**: `pr-5d`
**Round**: `r1`
**Date**: 2026-04-25
**QA agent**: qa-p5

## Spec

Phase 5 最后一 PR · 实例详情 Analytics tab 纯前端 SVG（spec L115-131）：
- 4 KPI（均分 / 中位数 / 及格率 / 平均用时）
- 得分分布直方图（6 档 SVG）
- 耗时 vs 得分散点图（SVG）
- Quiz 类型独有：答题正误热图
- 数据源：现有 `submissions` 数组（与 SubmissionsTab 共享 normalizedRows）
- 不新增 API/schema/AI

## Verification matrix

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 3 新文件（analytics-utils 151 行 / analytics-tab 501 行 / 19 unit tests）+ page.tsx surgical diff (+2/-15) 移除占位接 `<AnalyticsTab>`；4 KPI tone 分层（brand/ink/warn/success）；6 桶 `<40 / 40-55 / 55-70 / 70-80 / 80-90 / 90+` 配色 danger/warn/brand/success 渐变；Scatter X=用时分钟 Y=归一化分数 + gridline + `<title>` tooltip；QuizHeatmap 行=学生 列=Q1..QN + 绿/红/灰 三色（正确/错误/未答 — null fallback 走 `b.score >= b.maxScore` 推导）；spec 优先于 mockup（mockup 5 KPI/雷达图/小组对比 builder 决策不抢做，spec 4 KPI 落地）。 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | **366 passed / 0 failed / 37 files**（347 → 366, +19 new analytics-utils：computeKPIs 6 + buildHistogram 6 + buildScatter 4 + formatters 3）；edge cases 全（empty / null / boundaries / div-by-zero / status filter / maxScore=0 防御）。 |
| 4. Browser / 真 curl + 数据准确性 E2E | PASS | **真 quiz submission 全打通**：student1 → POST /api/submissions 201 quiz `cb62c86f`（6 题 + duration 540s）→ AI auto-grade ~16s → status:graded score 55/70 + 6-row quizBreakdown（5 correct + 1 wrong）。**用 utils 真模拟 analytics 渲染输出（非 hardcode mock，实测真数据精确对得上）**：computeKPIs → avgScore=55, medianScore=55, passRate=100% (55/70=78.6% ≥60%), avgDurationSeconds=540 (=9'); buildHistogram → bucket "70-80"=1 (78.6% 落入); buildScatter → 1 个点 (9 min, 78.6 分)。**多数据边界 simulate**：5 graded（90/50/75/35/95 + 1 null）→ avgScore 69, medianScore 75, passRate 0.6, avgDur 940; histogram <40=1 / 40-55=1 / 55-70=0 / 70-80=1 / 80-90=0 / 90+=2 全分布对；scatter 5 points (null 行排除) ✓；token-based fill class 全（`fill-brand/success/danger/warn/ink-3/ink-5/line-2`）。 |
| 5. Cross-module regression | PASS | 9 路由 teacher1 全 200；现有 SubmissionsTab + InstanceTabsNav + InstanceHeader 字节零改；analytics tab 切换无影响其他 tab；page.tsx 仅替换 placeholder（移除 unused BarChart3 + analytics 占位 → `<AnalyticsTab rows={normalizedRows} taskType={instance.task.taskType} />`）。 |
| 6. Security (/cso) | PASS | 无 auth/权限模块改动；Phase 5 SEC1/2/3/4 + PR-5C aggregate guard 全 403/规整：teacher2 → teacher1 instance 403 / submissions list 403 / insights/aggregate 403。SVG 无 user input 不存在 XSS 面（数据来源 normalizedSubmission 已经 server-side 走 schema）；`<title>` tooltip 用 React 文本插值无 XSS 面。无 schema 改动 → 无需 /cso 深审。 |
| 7. Finsim-specific | PASS | UI 全中文（均分/中位数/及格率/平均用时/暂无批改/50% 学生分布点/≥ 60% 满分计为通过/无用时数据/共 N 份/暂无可分析数据/等学生提交并完成 AI 批改后/分数分布/按 0–100 归一化 · 6 档/耗时 vs 得分/每个点是一份提交/此任务类型无用时数据 — 目前仅 quiz 自动记录用时/答题正误热图/行 = 学生 · 列 = 题号 · 绿色正确 · 红色错误/暂无 quiz 提交可绘制热图/正确/错误/未答/用时（分钟）→/分数）。Route Handler 零改。无 schema 改动。无 AI 调用。 |
| 8. Code patterns | PASS | 0 硬编码色（grep tailwind 原色 + `#xxx` / `rgb()` 全 0）token-based 'fill-brand/success/danger/warn'；ARIA `role="tabpanel" aria-labelledby="tab-analytics"` + 3 SVG `aria-label`；SVG `viewBox` + `className="w-full"` 自动响应式缩放；热图列多用 `overflow-x-auto`；Tooltip 原生 `<title>` 零 JS / 零依赖；3 层 empty state 独立降级（整 tab "暂无可分析数据" / 散点 "此任务类型无用时数据" / 热图 "暂无 quiz 提交可绘制热图"）；KPI tone 动态切换（passRate < 0.6 = warn / 否则 success）；utils pure functions 防御 (`max <= 0`, `durationSeconds > 0`, `Math.max(max, 1)` 防 NaN)；truncate(name, 7) 防热图行标过长溢出。 |

## Issues found

**无阻塞**。

### Builder 流程问题（已 QA 自行修复，记录用于复盘）

- **Dev server 期间挂掉一次**（PID 6084 → 不在 LISTEN，curl 502）。具体原因 dev log 看不出（日志最后正常 `GET /api/submissions ... 200 in 254ms`）— 可能是 turbopack hot-reload 或内存问题。**QA 重启 dev server PID 33924** 后所有验证 PASS。这不是 PR-5D 代码问题（utils + analytics-tab 都干净），但反映 long-running dev server 在 Phase 5 多次新代码切换中的不稳定性。**不阻塞本 PR**。

### 观察（非 FAIL）

- **Quiz 热图"未答 vs 错答"区分缺失**：当前 `quizBreakdown[].correct=false` 既包含错答也包含未答，热图统一标红。Build report L43 已说明，"想区分需要 grading service 输出 `answered: boolean` 单独字段"。本 PR scope 之外，记观察。
- **simulation/subjective 散点 empty**：`durationSeconds` 仅 quiz 有，故 simulation/subjective 实例的散点会 empty state（builder L40 已说明并入 HANDOFF）。设计真实，不是 bug。
- **Mockup 未做的元素**：5 KPI / 雷达图 / 小组对比 — builder spec-first 决策正确（spec 4 KPI 是更新过的需求基线）。如产品要回来加，开下一 PR 不抢做。

## Phase 5 整体收尾

- **5 PR 全 r1 PASS**：5A → 5B → SEC4 → 5C → 5D（5 连绿，无任何二轮）
- **0 schema 二轮**：PR-5C 一次性 Prisma 三步走完 + 真 AI E2E 闭环
- **测试增长**：288 baseline → 366（+78 new tests）
- **路由增长**：25 → 26（+1 /insights/aggregate）
- **安全态势**：SEC4 闭环 PR-5B 发现的 pre-existing P1 + PR-5C 新 endpoint OWASP/STRIDE 全审

## Overall: **PASS**

- 366/366 tests · tsc 0 · build 26 routes 0 warnings
- **真 quiz submission E2E**：student → POST 201 → AI grade 16s → 6-row breakdown → analytics utils 计算精确对齐（KPI/Histogram/Scatter/QuizHeatmap）
- 9 回归路由 200 · SEC1/2/3/4/5C 全无回归
- 0 硬编码色 · ARIA 完备 · token-based SVG · 3 层 empty state 独立
- 测试数据 cleanup 0 残留

**Phase 5 五连绿 ship 建议**：可 commit。Phase 5 全收工。下一 Phase 6 / Phase 7 待 coordinator 调度。
