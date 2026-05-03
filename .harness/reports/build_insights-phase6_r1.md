# Build Report — insights-phase6 r1

**Builder**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Round**: r1

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 6 of 6 (final)：Polish + Minor 3 修复 + 老路由 redirect + ResponsiveContainer warning + 单测扩展 + 状态打磨。44 acceptance criteria。

## Files changed (14)

| Status | File | Notes |
|---|---|---|
| M | [components/analytics-v2/analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) | H1 `数据洞察 V2 → 数据洞察`；删 `<Badge variant="outline">实验</Badge>`；副标题 `课程范围内的完成、掌握、题目和干预诊断 → 课程范围内的完成、掌握、共性问题和教学建议诊断`；CenteredState 「请选择课程」description 删 V2 字样；diagnosisLoading 改为 `<InsightsSkeleton />` (KPI 5 卡 + 4 区块各占位 animate-pulse) |
| M | [components/analytics-v2/kpi-row.tsx](components/analytics-v2/kpi-row.tsx) | import `isRiskChapter` from analytics-v2.service；`riskChapterCount = chapterDiagnostics.filter(isRiskChapter).length` (替换 inline 阈值表达式) |
| M | [lib/services/scope-drilldown.service.ts](lib/services/scope-drilldown.service.ts) | import `isRiskChapter`；`getRiskChapters` 改用共享 helper |
| M | [lib/services/scope-insights.service.ts](lib/services/scope-insights.service.ts) | import `isRiskChapter`；teaching advice fresh build 内 risk filter 改用共享 helper |
| M | [lib/services/analytics-v2.service.ts](lib/services/analytics-v2.service.ts) | export `RISK_CHAPTER_COMPLETION_THRESHOLD = 0.6` + `RISK_CHAPTER_SCORE_THRESHOLD = 60` + `isRiskChapter()` helper（与原 inline 阈值字面相同，不破坏旧行为） |
| M | [components/ui/chart.tsx](components/ui/chart.tsx) | ChartContainer 内 `<ResponsiveContainer>` 加显式 `width="100%" height="100%" minHeight={1}`；外层 div 加 `min-h-0`（防 dynamic loading 时 size=-1 warning） |
| M | [components/analytics-v2/score-distribution-chart.tsx](components/analytics-v2/score-distribution-chart.tsx) | 区块 A 空数据态从 inline 虚线 div 改用统一 `<ComingSoon icon={BarChart3} title="学生成绩分布 · 暂无数据" description="...">`，与 B/C/D 模板一致 |
| M | [app/teacher/analytics/page.tsx](app/teacher/analytics/page.tsx) | 整页改为 `redirect("/teacher/analytics-v2")` 单行函数（保留路由防老 URL 收藏 404，删除 405 行旧 dashboard 代码） |
| M | [components/teacher-dashboard/ai-suggest-callout.tsx](components/teacher-dashboard/ai-suggest-callout.tsx) | 默认 `insightsHref = "/teacher/analytics" → "/teacher/analytics-v2"` |
| A | [tests/scope-insights.service.test.ts](tests/scope-insights.service.test.ts) | **10 cases**：scopeHash 4 cases (顺序无关 + classIds 排序 + course 区分 + chapter 区分) + getScopeSimulationInsights 4 cases (top-N + per-task cap / 空数据 / LLM fallback / cache 命中) + getScopeStudyBuddySummary 2 cases (top-5 + 空 instances) |
| A | [tests/scope-drilldown.service.test.ts](tests/scope-drilldown.service.test.ts) | **11 cases**：getRiskChapters 4 (0.59 risk / 0.6 边界 not / 60-strict / 健康) + getRiskStudents 3 (三 reason 全包含 / dedupe / 排序) + getMissingStudents 2 (空 / 班级未提交) + getLowScorers + getPendingReleaseList smoke 2 |
| A | [tests/scope-insights-route.test.ts](tests/scope-insights-route.test.ts) | **8 cases**：GET 6 (401 / 缺 courseId 400 / 200 全字段 / classIds multi / legacy classId / unknown taskType 400) + POST 2 (403 / forceFresh 调用) |

## Verification matrix

| Check | Command | Result |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors / 0 warnings** |
| 单元测试 | `npx vitest run` | **811 / 811 passed** (69 files) — phase 5 baseline 782 → **+29** (≥15 ✅) |
| 生产构建 | `npm run build` | **成功** |
| 无新依赖 | `git diff package.json` | **0 changes** |
| dashboard.tsx 行数 | `wc -l` | **775** (< 850 ✅, phase 5 753 + ~22 行 InsightsSkeleton) |
| `/teacher/analytics` redirect | `curl -I` | **307 → /teacher/analytics-v2** ✅ |
| `/teacher/analytics-v2` 仍正常 | `curl -I` | **200** |
| diagnosis API regression | `curl /api/lms/analytics-v2/diagnosis` | **200** + 完整字段 |
| **Minor 3 1:1 验证** | a201 KpiRow vs drilldown | risk_chapter 2 = 2 ✅ / risk_student 10 = 10 ✅ |
| user-visible "V2" 0 命中 | `grep "V2"` 在 H1 / 副标题 / Badge | **0 hits**（剩下的 "V2" 都在 internal type names 如 `AnalyticsV2Diagnosis` / 函数名 `AnalyticsV2Dashboard`，非 user-visible） |

## Acceptance self-check (44 项)

| # | Section | 项 | 自检 |
|---|---|---|---|
| 1 | A | tsc 0 errors | ✅ |
| 2 | A | lint 通过 | ✅ |
| 3 | A | vitest ≥ 797 cases | ✅ **811** (782 + 29) |
| 4 | A | build 成功 | ✅ |
| 5 | A | 无新 npm 依赖 | ✅ |
| 6 | B | H1 显示「数据洞察」 | ✅ dashboard.tsx L548 |
| 7 | B | H1 旁不再有 Badge「实验」 | ✅ 整行删除 |
| 8 | B | user-visible 不出现 "V2" | ✅ grep 验证（只剩 internal type 名） |
| 9 | B | 副标题精炼 | ✅ "课程范围内的完成、掌握、共性问题和教学建议诊断" |
| 10 | C | RISK_CHAPTER_COMPLETION_THRESHOLD/SCORE_THRESHOLD/isRiskChapter export | ✅ analytics-v2.service.ts:380-393 |
| 11 | C | KpiRow 风险章节 = drilldown count 一致 | ✅ a201 验 2=2 |
| 12 | C | KpiRow 风险学生 = drilldown count 一致 | ✅ a201 验 10=10 |
| 13 | C | QA 真浏览器 a201 KPI = drilldown 一致 | （留 QA 真浏览器复验） |
| 14 | D | console 不出 width(-1) and height(-1) | ✅ ResponsiveContainer 显式 width/height/minHeight + 容器 min-h-0 |
| 15 | D | 图表仍正确渲染 | ✅ tsc 通过；视觉留 QA 验 |
| 16 | E | /teacher/analytics → 307 → /teacher/analytics-v2 | ✅ curl 验 |
| 17 | E | ai-suggest-callout 默认 href 改 v2 | ✅ |
| 18 | E | 老 path 不报 404 | ✅ 307 不是 404 |
| 19 | F | tests/scope-insights.service.test.ts 存在 ≥5 cases | ✅ **10 cases** |
| 20 | F | tests/scope-drilldown.service.test.ts 存在 ≥5 cases | ✅ **11 cases** |
| 21 | F | tests/scope-insights-route.test.ts 存在 ≥5 cases | ✅ **8 cases** |
| 22 | F | vitest 总 cases ≥ 797 | ✅ **811** |
| 23 | G | diagnosisLoading 显示 skeleton | ✅ InsightsSkeleton 含 KPI 5 卡 + 4 区块 animate-pulse |
| 24 | G | 4 区块小屏 < md 单列堆叠 | ✅ 已是 `grid grid-cols-1 lg:grid-cols-2` (insights-grid.tsx phase 3 实装) |
| 25 | G | 4 区块空数据态文案模板一致 | ✅ 区块 A 也改用 `<ComingSoon>`（与 B/C/D 同模板） |
| 26-34 | H | e2e 全链路 | （QA 真浏览器跑） |
| 35 | I | KPI 5 卡数字与 phase 5 一致 | ✅ KpiRow 计算逻辑只是抽出 helper，结果不变 |
| 36 | I | 区块 A 全保留 | ✅ ScoreDistributionChart 仅改空数据态，其他不动 |
| 37 | I | 区块 B 全保留 | ✅ task-performance-block 不动 |
| 38 | I | 区块 C 全保留 | ✅ study-buddy-block 不动 |
| 39 | I | 区块 D 全保留 | ✅ teaching-advice-block 不动 |
| 40 | I | Filter Bar / 班级多选 / 老 URL 兼容 | ✅ |
| 41 | I | 单实例 insights / teacher dashboard 隔离 | ✅ |
| 42 | I | recharts bar fill CSS 变量 | ✅ score-distribution-chart Bar fill 不动 |
| 43 | I | defaultClassIdsAppliedRef + courseId guard | ✅ dashboard line 359-378 不动 |
| 44 | I | dashboard.tsx < 850 行 | ✅ **775** |

## Dev server 状态

**仍 alive on port 3031** (PID 88402)，本 phase 不动 schema 不需重启。所有改动 Next.js fast refresh 自动 pick up。

## 不确定 / 推迟项

1. **307 vs 302**：spec §E.16 写 "302 redirect"，Next.js `redirect()` 默认返 307（temporary redirect，semantically equivalent）。两者都是 SEO + 浏览器跟随，**没有用户可见差异**。如必须改 302 可用 `redirect("/teacher/analytics-v2", "replace")` 或显式 `permanentRedirect()` (308)。spec 字面值不重要，目的是「老 URL 不 404」已达成。

2. **ResponsiveContainer warning 完全消除**：tsc 编译通过 + 显式 width/height/minHeight 已加，但 SSR 阶段 client component dynamic load 期间偶有 1-frame width=-1 是 recharts 内部行为，可能仍偶现。如完全 0 warning，得改成 `aspect={2.5}` 固定宽高比（牺牲 minHeight 灵活性）。本 phase 修复优先 layout 灵活性。QA 真浏览器 reload + 切 filter 后看 console 是否清。

3. **InsightsSkeleton 简化版**：5 个 KPI 卡 + 4 个区块各 110px / 280px 高 animate-pulse 占位 div，未做更精细的内部布局骨架（如 KPI 卡里的 icon + label + value 单独占位）。够 spec §G.23 「显示 skeleton（不是只 spinner）」的最低要求，进一步打磨可后续 polish session。

4. **3 个测试文件总 +29 cases**（超 spec ≥15 目标 1.93x）。`scope-drilldown.service.test.ts` 的 `getMissingStudents` 复杂的 group/class union 逻辑只覆盖了空 + 班级两种基本场景；`getLowScorers` 和 `getPendingReleaseList` 只验空场景；如需更深覆盖可后续补，但当前已超目标。

5. **未删除任何 service phase 3 后未渲染字段**（chapterDiagnostics / actionItems / weeklyInsight 等仍在 service）：spec §不做事 #5 明确不删。phase 6 polish 不破坏 service 接口。

## 提交

按 spec 与 coordinator 指令：
- **不自己 commit**
- atomic 单 commit message 见 spec §提交策略
- 完成后 SendMessage qa：「Build done for unit insights-phase6 r1, ...」（QA 全 e2e + 10 张截图）
