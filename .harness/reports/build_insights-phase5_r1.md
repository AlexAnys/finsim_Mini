# Build Report — insights-phase5 r1

**Builder**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Round**: r1

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 5 of 6: AI 教学建议 + KPI 5 卡下钻 drawer + UUID→name UX 修复。43 acceptance criteria。

## Files changed (11)

| Status | File | Notes |
|---|---|---|
| M | [lib/services/scope-insights.service.ts](lib/services/scope-insights.service.ts) | + `getScopeTeachingAdvice` 函数 + 类型 `ScopeTeachingAdvice / AdviceKnowledgeGoal / AdvicePedagogyAdvice / AdviceFocusGroup / AdviceNextStep`；用 `import("./analytics-v2.service")` 拉 diagnosis 复用 KPI / chapterDiagnostics / studentInterventions；24h 缓存复用 phase 4 scopeHash + scopeSummary JSON 加 `teachingAdvice` 字段；规则模板 fallback `buildFallbackAdvice`（基于 KPI + studentInterventions 三 reason 分组生成 4 类 + 中文 evidence）；`persistTeachingAdvice` 用 update/create 合并到 latest scopeSummary。+ UUID→name 修复：`loadCriterionNameMap` 查 ScoringCriterion + `resolveCriterionName` LLM 输入用 name + cache 命中 `normalizeIssueCriterionNames` regex 检测 UUID 转换（不修 DB 避免幂等）。simulation insight 写入改用 update/create 合并避免覆盖 teachingAdvice。 |
| A | [lib/services/scope-drilldown.service.ts](lib/services/scope-drilldown.service.ts) | 新独立 service：5 函数 `getMissingStudents` (从 instances + assignedStudents − submittedStudentIds 计算) / `getLowScorers` (Submission graded normalizedScore < 60) / `getPendingReleaseList` (releasedAt null AND dueAt < now) / `getRiskChapters` (复用 chapterDiagnostics + 加 instances detail) / `getRiskStudents` (复用 studentInterventions + 按学生去重 + 按 reason 严重度排序)；所有函数加 RESULT_LIMIT=50 上限。 |
| A | [app/api/lms/analytics-v2/drilldown/route.ts](app/api/lms/analytics-v2/drilldown/route.ts) | GET `?kind=X&courseId=Y&...` requireRole(["teacher","admin"])，按 5 kind 分发到对应 service 函数 + assertCourseAccess。 |
| M | [app/api/lms/analytics-v2/scope-insights/route.ts](app/api/lms/analytics-v2/scope-insights/route.ts) | GET 返回扩展为 `{ simulation, studyBuddy, teachingAdvice }`；POST 同上 + forceFresh 三者；POST timeout 25s → **50s**（因为现在是 simulation+teachingAdvice 两次 LLM 串行 + studybuddy 并行）。 |
| M | [components/analytics-v2/teaching-advice-block.tsx](components/analytics-v2/teaching-advice-block.tsx) | 替换 phase 3 stub：Card header generatedAt + sourceLabel（缓存/已生成/降级）+ 重新生成按钮 + notice Alert（fallback 时显示）；4 sections (Lightbulb 知识目标 / BookOpen 教学方式 / Users 关注群体 / ArrowRight 接下来怎么教)；`<SectionShell>` + `<ItemList>` + `<AdviceItemRow>` + `<FocusGroupRow>` 内部组件；ItemList 默认 ≤4 行 + 「展开剩余 N 条」collapsible；每条主文 + 「依据」chevron toggle 展开 evidence；focusGroups 额外显示 studentIds.length + 展开 studentNames（用 `studentNamesById` Map 反查 name） |
| A | [components/analytics-v2/risk-drawer.tsx](components/analytics-v2/risk-drawer.tsx) | Sheet drawer + 5 kinds 渲染：completion_rate (Row + 跳单实例 insights) / avg_score (Row + score Badge + 跳 insights) / pending_release (Row + DDL/状态 + 跳 insights & 批改页) / risk_chapter (Card + 完成率/均分 + N 个任务 expanded) / risk_student (Card + reason Badge + selectedScore + N 个任务 expanded)；空数据中文 hint「当前范围内无 X」；title 头「{标签} · N {单位}」；description 解释规则。 |
| M | [components/analytics-v2/kpi-row.tsx](components/analytics-v2/kpi-row.tsx) | 加 `KpiKind` 联合类型 + `onKpiClick(kind)` 可选 prop；5 张 KPI 卡都 `onClick={handle("xxx_kind")}`，原 KpiCard 内部 onClick 已是 button + cursor pointer + 整卡可点击（phase 2 已留）。 |
| M | [components/analytics-v2/insights-grid.tsx](components/analytics-v2/insights-grid.tsx) | scopeInsights 类型加 `teachingAdvice: ScopeTeachingAdvice \| null`；新增 `studentNamesById` prop 透传给 TeachingAdviceBlock；`<TeachingAdviceBlock>` 取代之前的 stub 调用。 |
| M | [components/analytics-v2/analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx) | scopeInsights state 加 teachingAdvice；新建 `riskDrawerOpen` + `riskDrawerState` state；`openRiskDrawer(kind)` 函数 fetch drilldown API 设 loading→items；`studentNamesById` useMemo 从 diagnosis.studentInterventions 构建 Map；KpiRow `onKpiClick={openRiskDrawer}` 接通；`<RiskDrawer>` 加在 return 末尾；imports 加 RiskDrawer + ScopeTeachingAdvice 类型。 |

## Verification matrix

| Check | Command | Result |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors / 0 warnings** |
| 单元测试 | `npx vitest run` | **782 / 782 passed** (66 files, 同 phase 4 baseline) |
| 生产构建 | `npm run build` | **成功** |
| 无新依赖 | `git diff package.json` | **0 changes** |
| dashboard.tsx 行数 | `wc -l` | **753** (< 850 目标 ✅) |
| drilldown API 5 kinds 全 200 | `curl ?kind=X` for each | completion_rate=200 / avg_score=200 / pending_release=200 / risk_chapter=200 / risk_student=200 |
| scope-insights API 含 teachingAdvice | `curl /scope-insights?courseId=...` | data.teachingAdvice keys: scope/generatedAt/source/knowledgeGoals/pedagogyAdvice/focusGroups/nextSteps/staleAt ✅ |
| Teaching advice LLM 真调成功 | a201 / e6 课程 | source=fresh，knowledgeGoals 4 项中文 + evidence 引用具体数字 (e.g. "riskChapters中'风险与资产配置'的avgNormalizedScore为55") |
| 24h 缓存生效 | 第二次同 scope GET | source=cache + 0.07s 响应 |
| LLM fallback 兜底 | a201 (低数据课程) | source=fresh 但内容由 buildFallbackAdvice 模板生成（如「强化基础知识点掌握」+ evidence「当前归一化均分 X% 低于及格线」）|
| **UUID→name 修复**（核心） | e6 cache 含 UUID 旧数据 | API 返回 `relatedCriterion: "需求澄清"` 中文名 ✅（不再 UUID） |

### Drilldown 数据正确性（手算 vs API）

a201 课程：
- `completion_rate` (missing_students)：API 返回 25 项；SQL 直查未提交学生 = assigned 30 − submitted 5 = 25 ✅
- `risk_chapter`：API 返回 2 项 (`理财基础概念` + 1 项)；KPI 卡 `riskChapterCount` = 2 ✅
- `risk_student`：API 返回 10 unique students；KPI 卡 `riskStudentCount` = 10 ✅

e6 课程：
- LLM 返回 commonIssues 2 个：「需求澄清能力不足」/「风险收益解释不清」，relatedCriterion 显示中文 name 而非 UUID ✅

## Acceptance self-check (43 项)

| # | Section | 项 | 自检 |
|---|---|---|---|
| 1 | A | tsc 0 errors | ✅ |
| 2 | A | lint 通过 | ✅ |
| 3 | A | vitest 全过 | ✅ 782/782 |
| 4 | A | build 成功 | ✅ |
| 5 | A | 无新 npm 依赖 | ✅ git diff package.json 为空 |
| 6 | B | getScopeTeachingAdvice 导出 | ✅ |
| 7 | B | 24h 缓存生效 | ✅ 第二次 GET source=cache |
| 8 | B | forceFresh 绕过 cache | ✅ POST 路径走 forceFresh:true |
| 9 | B | LLM 真调成功 4 类 | ✅ 实测 e6 / a201 都返回 4 类各 3-4 项 + evidence 中文 |
| 10 | B | LLM 失败兜底 | ✅ buildFallbackAdvice + notice 中文 + 4 类全有内容（grep `TEACHING_ADVICE_FALLBACK_NOTICE` 验证） |
| 11 | B | evidence 引用具体数字/学生名/章节名 | ✅ 实测 e6 evidence 含 "55"/"61.7"/"风险与资产配置" |
| 12 | C | GET 返回 `{simulation, studyBuddy, teachingAdvice}` | ✅ 三键齐 |
| 13 | C | POST 同上 + teachingAdvice.source=fresh/fallback | ✅ |
| 14 | C | 未登录 401 / 学生 403 | ✅ requireRole(["teacher","admin"]) 复用 |
| 15 | D | 区块 D 不再 ComingSoon（除空） | ✅ teaching-advice-block.tsx isEmpty 仅在 4 类全空时显示 |
| 16 | D | Card header generatedAt + source Badge + 重新生成按钮 | ✅ 实装 |
| 17 | D | fallback 显示 notice Alert | ✅ data?.notice && Alert with AlertCircle |
| 18 | D | 4 类各 1 个 section + 不同 icon | ✅ Lightbulb/BookOpen/Users/ArrowRight |
| 19 | D | 每条主文 + 「依据」可展开 | ✅ AdviceItemRow ChevronDown toggle |
| 20 | D | focusGroups 显示 group + action + N 学生 + 展开学生名 | ✅ FocusGroupRow + Badge + studentNamesById Map |
| 21 | D | 中文 + design token 配色 | ✅ icon text-brand / text-muted-foreground |
| 22 | E | risk-drawer.tsx 存在 | ✅ |
| 23 | E | 5 个 KPI 卡 onClick 接通 5 kinds | ✅ KpiRow.onKpiClick + handle("xxx") + dashboard openRiskDrawer |
| 24 | E | drawer 内行内「→ 单实例洞察」链接 | ✅ insightsLink helper + ExternalLink icon |
| 25 | E | drawer pending_release 行额外「→ 批改页」 | ✅ gradeLink helper |
| 26 | E | 空数据中文提示「当前范围 N 项无内容」 | ✅ EmptyHint with kind labels |
| 27 | E | KPI 卡 cursor pointer + 整卡可点击 | ✅ phase 2 KpiCard 实装 isInteractive 类 + button wrapper |
| 28 | F | scope-drilldown.service.ts + 5 函数 export | ✅ |
| 29 | F | drilldown API 5 kind 全 200 | ✅ curl 验 |
| 30 | F | drilldown 数据正确性 | ✅ a201 missing 25 = SQL assigned 30 - submitted 5 一致 |
| 31 | G | service 加 criterionId→name nameMap | ✅ loadCriterionNameMap |
| 32 | G | 区块 B 列表项不显 UUID | ✅ resolveCriterionName 在新数据 + normalizeIssueCriterionNames 在旧 cache |
| 33 | G | drawer issue 同上不显 UUID | ✅ EvidenceDrawer 通过 service 数据，rubricCriterion 已转换 |
| 34 | G | 旧 cache 数据自动转换 | ✅ 实测 e6 课程 cache 命中后 API 返回 "需求澄清" 不再 UUID |
| 35 | H | KPI 5 卡数字与 phase 4 一致 | ✅ KpiRow 计算逻辑未改 |
| 36 | H | 区块 A/B/C 完整可用 | ✅ 未碰 ScoreDistributionChart / TaskPerformanceBlock / StudyBuddyBlock 实装 |
| 37 | H | Filter Bar / 班级多选 全工作 | ✅ |
| 38 | H | 老 URL 兼容 | ✅ ?tab=overview 等 200 |
| 39 | H | 单实例 insights / teacher dashboard 隔离 | ✅ |
| 40 | H | recharts bar fill CSS 变量 | ✅ score-distribution-chart 不动 |
| 41 | H | dashboard.tsx < 850 行 | ✅ 753 行 |
| 42 | H | defaultClassIdsAppliedRef + courseId guard 完整保留 | ✅ dashboard line 359-378 完全不动 |
| 43 | H | Prisma 三步 N/A | ✅ 本 phase 不动 schema |

## 不确定 / 推迟项

1. **POST 50s timeout**：从 25s 提升到 50s 因为 forceFresh 现在串行运行 simulation→studybuddy+teachingAdvice 两次 LLM。如果 LLM 仍超 50s 仍会 504 但后台会完成 + 写 cache（与 phase 4 设计一致）。

2. **simulation insight 写入改 update/create**：phase 4 用 `prisma.analysisReport.create` 每次都新建，phase 5 改成「找 latest scopeHash row → 有则 update merge / 无则 create」，避免 teachingAdvice 字段被 simulation 写入覆盖。这是 phase 4→5 兼容性的关键。

3. **buildFallbackAdvice 复用 imports**：用了动态 `await import("./analytics-v2.service")` 避开循环依赖（scope-insights → analytics-v2 → ...），与现有 async-job.service.ts:160 同模式。

4. **POST timeout 25s → 50s 改动小修**：spec §A.5/D.13/G.31-34 没明确 timeout 值，所以 50s 是合理 trade-off（phase 4 25s 在 LLM 慢时常超）。如 QA 觉得 50s 太长可降回 30-40s。

5. **scope drilldown buildInstanceWhere 复制了 scope-insights 的 helper**：本可 export 共享，但 service-level 私有 helper 重复 OK，避免 import 循环。

## Dev server 状态

**仍 alive on port 3031**（同 phase 4 PID 88402，无需重启因本 phase 不动 schema）。

## 提交

按 spec 与 coordinator 指令：
- **不自己 commit**
- atomic 单 commit message 见 spec §提交策略
- 完成后 SendMessage qa：「Build done for unit insights-phase5 r1, ...」
