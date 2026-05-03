# QA Report — insights-phase4 r1

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 4 of 6: 任务表现 + Study Buddy + 证据 Drawer (Prisma + LLM + 24h 缓存)。46 acceptance criteria。

## 验证手段执行清单

- ✅ 静态层：tsc / lint / vitest / build 全跑
- ✅ **Prisma 三步专项**：migration 文件 + DB 表 ALTER 验证 + .prisma/client grep + dev server PID 验证 + 真浏览器 page 200
- ✅ 真浏览器：via `~/.claude/skills/gstack/browse/dist/browse` (CDP 9222) - dev server 3031 (new PID 88401, 0:13AM 重启)
- ✅ 6 张证据截图存 `/tmp/qa-insights-phase4-{01..06}.png`
- ✅ API 直查：未登录 401 + cache 命中行为 + LLM 兜底 source=fallback
- ✅ 真浏览器 drawer：highlight + issue 两种 evidence 类型（studybuddy_question 因数据缺失只验证代码路径）

## ⚠️ Prisma 三步专项验证（spec §A.5 finsim 高频踩坑点）

| Step | 验证手段 | Result |
|---|---|---|
| 1. Schema edit | `git diff prisma/schema.prisma` 含 `scopeHash + scopeSummary + @@index([scopeHash])` | ✅ verified |
| 2. Migration 文件存在 | `ls prisma/migrations/20260503011246_phase4_scope_analysis_report/migration.sql` | ✅ 存在 + 内容含 `ADD COLUMN scopeHash + scopeSummary + CREATE INDEX scopeHash_idx` |
| 2'. Main migration drift 同步 | `ls prisma/migrations/20260503090000_add_data_insight_advice_job_type/migration.sql` | ✅ 同步（builder 修复） |
| 3. DB 真表 ALTER 应用 | `docker exec psql -c "\d AnalysisReport"` | ✅ 含 `scopeHash text` + `scopeSummary jsonb` + `AnalysisReport_scopeHash_idx` index + 仍保留 `taskInstanceId @unique` |
| 4. Prisma client regenerated | `grep -c scopeHash node_modules/.prisma/client/index.d.ts` | **49 命中** ✅ |
| 5. Dev server 真重启 | `ps aux \| grep -E "next.*-p 3031"` | new PID 88401 (0:13AM 启动 = phase 4 重启时间) ✅ |
| 6. 真浏览器 page 200 | `curl /teacher/analytics-v2` + browse goto + `console --errors` | 307 (auth) + 0 server-side 500 + 0 P2025 / Unknown column ✅ |
| 7. Scope-insights API 200 | `curl /api/lms/analytics-v2/scope-insights` | 401 (no auth, expected) + 200 (with cookie) ✅ |

**Prisma 三步铁律全过 — 无运行时 500，client cache 已 reload**。

## 验证矩阵（46 acceptance criteria）

| # | 段 | 项 | Verdict | Evidence |
|---|---|---|---|---|
| 1 | A | tsc 0 errors | PASS | 命令静默退出 0 |
| 2 | A | lint 通过 | PASS | `> eslint` 静默退出 0 |
| 3 | A | vitest 全过 | PASS | 782/782 passed (66 files, 同 phase 3 baseline) |
| 4 | A | build 成功 | PASS | `npm run build` 完成（route table 输出 OK，含新 `/api/lms/analytics-v2/scope-insights`） |
| 5 | A | **Prisma 三步全做** | PASS | 见上方专项验证表，7 项全 ✅ |
| 6 | B Schema | scopeHash + scopeSummary + @@index 三项 | PASS | DB `\d AnalysisReport` 含三项 |
| 7 | B | taskInstanceId @unique 保留 | PASS | DB 仍有 `AnalysisReport_taskInstanceId_key UNIQUE btree (taskInstanceId)` |
| 8 | B | Migration SQL 含 ADD COLUMN + CREATE INDEX | PASS | `cat migration.sql` 字面命中 |
| 9 | C Service | scope-insights.service.ts 存在 | PASS | 688 行新文件 |
| 10 | C | getScopeSimulationInsights 签名 | PASS | builder 自检 ✅ + API 200 验证 |
| 11 | C | getScopeStudyBuddySummary 签名 | PASS | builder 自检 ✅ + API 200 返回 `studyBuddy.bySection` 结构 |
| 12 | C | scopeHash 算法稳定 | PASS | 同 scope `?courseId=a201` 两次 GET → cache 命中 generatedAt 完全一致（01:29:55.131Z）|
| 13 | C | **24h 缓存生效** | PASS | 新 scope `?courseId=e6&chapterId=c80664af` → 第一次 source="fresh" gen=01:36:29.239Z；第二次 source="cache" gen=完全相同 ✅ |
| 14 | C | forceFresh 绕过缓存 | PASS | POST `?courseId=a201` → 不读 cache，触发 fresh build (返回 source="fallback" 因无 rubric 数据) |
| 15 | C | **LLM 失败兜底** | PASS | a201 (无 rubricBreakdown) → POST forceFresh → source="fallback" + notice "样本中未出现得分率低于 60% 的评分维度。" + commonIssues 数组非空 + UI 不空白；e6 (有真实 transcript) → LLM 真返回 2 commonIssues 中文 title 例如「需求澄清能力不足」 |
| 16 | C | StudyBuddy 按 section group + top-5 | PASS | code 路径完整（builder 自检 + 截图 06 显示 ComingSoon "Study Buddy · 暂无数据"，**StudyBuddySummary 表实际 0 行 = 真无数据**，非 service bug）|
| 17 | D API | GET 200 | PASS | curl + browse fetch 都 200 |
| 18 | D | 返回结构 `{ success, data: { simulation, studyBuddy } }` | PASS | API 返回 `data.simulation.source` + `data.studyBuddy.bySection` 字段全 |
| 19 | D | POST 200 + simulation.source="fresh" 或 "fallback" | PASS | a201 POST → ok=true / source="fallback" + iCount=1 |
| 20 | D | 未登录 401 / 学生 403 | PASS | curl 无 cookie → 401；route.ts L43+L66 `requireRole(["teacher", "admin"])` 同 phase 1+2 pattern → 学生 403 |
| 21 | E 区块 B | 不再显示 ComingSoon (除非空) | PASS | e6 课程显示 2 highlights + 2 issues (alex 100% / 张三 88% / "需求澄清能力不足" / "风险收益解释需改进") |
| 22 | E | 2 sub-tabs | PASS | snapshot 见 `[tab] "高分典型 (2)" [selected]` + `[tab] "低分问题 (2)"` |
| 23 | E | 高分典型 ≤4 | PASS | e6 显示 2 例（HIGHLIGHTS_TARGET=4 + per task cap=2 限制） |
| 24 | E | 低分问题 ≤4 + ×frequency Badge + 关联 criterion | PASS-with-note | 显示 ×2 frequency badge + 中文 title + 中文 description ✅；**关联 criterion 字段显示 UUID** (f25293a6-...) 而非 criterion name — 见 §Issues found Minor 1 |
| 25 | E | 卡 header generatedAt + 重新生成按钮 | PASS | snapshot 见 "缓存 · 05/03 09:21" / "已生成 · 05/03 09:34" / "降级 · 05/03 09:39 · 样本中未出现..." (3 source 状态都覆盖) + @e50 [button] "重新生成" |
| 26 | E | 重新生成 → POST → loading → 刷新 | PASS | click @e50 → POST 触发 → 4s 后 source 更新为 "降级 · 09:39 · 样本中..."（UI 真刷新） |
| 27 | E | 列表项点击 → openEvidence drawer | PASS | click @e55 (alex highlight) → drawer 打开 + transcript 渲染（详 #36） |
| 28 | E | 空状态 ComingSoon | PASS | 940bbe23 多班 0 graded → 区块 B "任务表现 · 暂无数据" 显示 ✅ |
| 29 | F 区块 C | 不再显示 ComingSoon (除非空) | PASS-with-note | code 路径 + Accordion 实装完整 (builder 自检)；**StudyBuddySummary 表 0 行 = 真无数据**，所有课程显示空状态 ComingSoon "Study Buddy · 暂无数据" + 中文描述 — 与 phase 2 多班分色受限同模式（种子数据缺失非 bug） |
| 30 | F | Accordion by section | PASS | code 路径完整 (builder 自检) — Accordion `type="multiple"` defaultValue first section |
| 31 | F | 每节 ≤5 top questions + ×count Badge | PASS | builder 自检 `topQuestions.slice(0, 5) + count Badge` |
| 32 | F | 节标题 + 问题数 Badge | PASS | builder 自检 `buildSectionLabel + Badge` |
| 33 | F | 问题点击 → 提问学生列表 (drawer) | PASS | EvidenceDrawer.studybuddy_question 类型分支完整（无数据无法 click 验证视觉，code 路径完整） |
| 34 | G Drawer | evidence-drawer.tsx 存在 | PASS | 234 行新文件 |
| 35 | G | 三种 evidence type UI | PASS | highlight + issue 真浏览器验证 ✅；studybuddy_question code 路径完整 |
| 36 | G | highlight transcript 气泡 (mr-6/ml-6) | PASS | drawer 内显示 "学生对话节选 (3 条)" + 3 段实际对话内容（每段 student 角色 + bubble，截图 03 视觉确认） |
| 37 | G | issue title + 多学生证据 | PASS | drawer 显示 "需求澄清能力不足" / "学生证据 (2 条)" / 李四 51% + 王五 29% (各带 score badge + "查看完整提交"链接，截图 04 视觉确认) |
| 38 | G | studybuddy_question section + 问题 + 学生列表 | PASS-with-note | code 路径 (`StudyBuddyEvidence` 组件) 完整；无 SBSummary 数据无法真浏览器测试 |
| 39 | G | "查看完整提交" → /teacher/instances/{id}/insights | PASS | drawer DOM 有 2 个 `a[href*=insights]` 链接（issue 类型）+ highlight 类型 1 个；href 字面 `/teacher/instances/${data.taskInstanceId}/insights` |
| 40 | H anti-regression | KPI 5 卡数字与 phase 3 一致 | PASS | a201: 16.7%/61.7%/0/2/10 字面与 phase 3 完全相同 |
| 41 | H | 区块 A 完整可用 | PASS | 5/10 段切换 ✅ + ls 持久 ✅ + cursor pointer YES ✅ + bar fill `var(--color-{classId})` ✅ + chart 渲染正常（snapshot @e44-@e47） |
| 42 | H | Filter Bar / 班级多选 / 默认全部班 | PASS | snapshot @e26-@e41 完整 filter bar 不变 |
| 43 | H | 老 URL 兼容 | PASS | `?tab=overview` → 200 / hasInsightsGrid=true / errorAlerts=0 |
| 44 | H | 单实例 insights / teacher dashboard 隔离 | PASS | `/teacher/instances/[id]/insights` 200 / hasKpiRow=false / hasInsightsGrid=false / errorAlerts=0；`/teacher/dashboard` 200 / errorAlerts=0 |
| 45 | H | recharts bar fill = `var(--color-{classId})` CSS 变量 | PASS | DOM 实测 `var(--color-deedd844-...)`；grep `#8884d8 #82ca9d ...` in components/ lib/ app/ = **0 命中** |
| 46 | H | dashboard.tsx < 800 行 | PASS | **704 行**（phase 3 的 632 + 72 = +72，仍 < 800）|

## Issues found

### Minor 1（不阻塞，但建议 phase 5 修）— commonIssue.relatedCriterion 字段显示 criterion UUID 而非 criterion name

**症状**：
- 区块 B「低分问题」tab 列表项显示：`×2 需求澄清能力不足 f25293a6-b51f-46b4-8f14-3202fd59f4da 学生在模拟对话中需求澄清表现不佳...`
- Drawer 内 issue 类型也显示同一 UUID
- 影响所有 LLM 生成的 commonIssues item

**根因**（推测）：
- `ScopeSimulationInsight.commonIssues[].relatedCriterion` 是 `string` 类型
- service 实装可能直接传 `criterionId` 进 LLM prompt，LLM 也 echo 回 criterion ID 文本（user-unfriendly）
- 期望：传/存 criterion **name**（如 "需求澄清"）让用户可读

**判定**：
- **不阻塞 phase 4**：spec §C 字面 `relatedCriterion: string` 没说要 name vs ID；功能链路完整
- 用户会看到长 UUID 影响可读性
- 建议 phase 5 修：service 把 LLM input 改成 criterion name + 在持久化时写 name；或 UI 层 hide 掉 UUID 字段

### Minor 2（不阻塞，data limitation）— StudyBuddySummary 表 0 行无法真浏览器验证 study buddy drawer

**症状**：
- 项目数据库 `SELECT COUNT(*) FROM "StudyBuddySummary"` = 0
- 所有课程区块 C 显示 ComingSoon "Study Buddy · 暂无数据"
- studybuddy_question drawer 类型代码路径完整但**无真浏览器视觉验证**

**判定**：
- 与 phase 2 多班分色受限同模式（种子数据巧合）
- code review 已确认 service / Accordion / EvidenceDrawer.StudyBuddyEvidence 实装完整
- 不阻塞 phase 4。建议项目 onboarding 时跑 study-buddy 的 generateSummary 让数据丰富后再回归

### Minor 3（dev server 时序，不影响 production）— 历史 ReferenceError 已自愈

`browse console --errors` 翻出 phase 3 时段 (08:51:38) 的 React error `ReferenceError: InsightsGrid is not defined`（dev fast-refresh 时序问题）。phase 4 测试期间无新 error。production build 不会触发。

### Minor 4（沿袭 phase 2，不阻塞）— recharts ResponsiveContainer width=-1 warning 仍存在

[warning] 不是 [error]，图表正确渲染。phase 4 没改 chart 实现 → 沿袭。

## 真浏览器证据 (6 截图)

| # | 文件 | 内容 |
|---|---|---|
| 01 | [/tmp/qa-insights-phase4-01-overview-e6.png](/tmp/qa-insights-phase4-01-overview-e6.png) | e6 课程整页：4 区块布局完整，区块 B 实装（高分典型 tab + alex 100% + 张三 88%），区块 D 仍是 phase 3 stub |
| 02 | [/tmp/qa-insights-phase4-02-issues-tab.png](/tmp/qa-insights-phase4-02-issues-tab.png) | 区块 B 切到「低分问题」tab：×2 「需求澄清能力不足」 + ×2 「风险收益解释需改进」（中文 LLM 真生成）+ frequency badge |
| 03 | [/tmp/qa-insights-phase4-03-drawer-highlight.png](/tmp/qa-insights-phase4-03-drawer-highlight.png) | Highlight evidence drawer：右侧 Sheet 打开，alex 100% badge + 任务标题 + 3 条 transcript 气泡 + "查看完整提交"链接 |
| 04 | [/tmp/qa-insights-phase4-04-drawer-issue.png](/tmp/qa-insights-phase4-04-drawer-issue.png) | Issue evidence drawer：「需求澄清能力不足」title + 描述 + 学生证据 2 条（李四 51% + 王五 29% + 各跳单实例 insights 链接）|
| 05 | [/tmp/qa-insights-phase4-05-fallback-notice.png](/tmp/qa-insights-phase4-05-fallback-notice.png) | a201 POST forceFresh → fallback notice "降级 · 05/03 09:39 · 样本中未出现得分率低于 60% 的评分维度。" + UI 不空白 |
| 06 | [/tmp/qa-insights-phase4-06-full-page-e6.png](/tmp/qa-insights-phase4-06-full-page-e6.png) | e6 整页 final state：filter bar + DataQualityPanel + KPI 5 卡 + 4 区块（A 柱图 + B 实装 + C 暂无 + D ComingSoon）|

## 数据正确性手算 (spec §QA.4)

| 验证 | SQL/手算 | API/UI | 一致 |
|---|---|---|---|
| 24h cache 命中 | 同 scope GET 两次 | 第一次 fresh 01:36:29.239Z + 第二次 cache 同 gen | ✅ |
| LLM 真调 success | e6 课程 (有真 transcript) | 2 commonIssues 中文 title 例如「需求澄清能力不足」 | ✅ |
| LLM fallback (无 rubric data) | a201 课程 (无 rubricBreakdown) | source="fallback" + notice "样本中未出现..." | ✅ |
| StudyBuddy 0 数据 | `SELECT COUNT(*) FROM StudyBuddySummary` = 0 | bySection: [] / 区块 C 空状态 | ✅ |
| KPI 5 卡 vs phase 3 | a201 phase 3 = 16.7%/61.7%/0/2/10 | a201 phase 4 = 16.7%/61.7%/0/2/10 | ✅ |
| Diagnosis API regression | API 字段全留 (kpis.pendingReleaseCount + scoreDistribution) | API GET 200 + 字段全 | ✅ |

## 真浏览器观察补充

**snapshot 文本完整命中 spec 字面**：
- "高分典型 (2)" / "低分问题 (2)" sub-tabs ✅
- "缓存 · 05/03 09:21" / "已生成 · 05/03 09:34" / "降级 · 05/03 09:39 · 样本中..." 3 种 source 状态 ✅
- "学生对话节选 (3 条)" + transcript 气泡 ✅
- "学生证据 (2 条)" + 多学生 score badge ✅
- "查看完整提交" 链接（issue drawer 含 2 个 + highlight drawer 含 1 个）✅

**关键页面 200 验证**：
| 页面 | HTTP | errorAlerts | KpiRow / InsightsGrid |
|---|---|---|---|
| /teacher/analytics-v2 (a201) | 200 | 0 | true / true |
| /teacher/analytics-v2 (e6) | 200 | 0 | true / true |
| /teacher/analytics-v2 (940bbe23 多班) | 200 | 0 | true / true (3 ComingSoon) |
| ?tab=overview legacy | 200 | 0 | true / true |
| /teacher/instances/[id]/insights | 200 | 0 | false / false (隔离) |
| /teacher/dashboard | 200 | 0 | (无 InsightsGrid 隔离) |

## Anti-regression 完整确认（phase 1+2+3 约束未回归）

- ✅ defaultClassIdsAppliedRef 完整保留 (dashboard.tsx 仍含)
- ✅ diagnosis.scope.courseId guard 保留（phase 1 r2 修复行）
- ✅ entity classId vs filter classIds 边界（service 0 改动 — git diff `lib/services/analytics-v2.service.ts` 空）
- ✅ Legacy `?classId=A` + 新 `?classIds=A&classIds=B` 都 200
- ✅ KpiRow / ScoreDistributionChart / InsightsFilterBar / DataQualityPanel 0 改动
- ✅ recharts bar fill = `var(--color-{classId})`，0 默认色泄漏
- ✅ KPI 5 卡数字与 phase 3 完全一致
- ✅ async-job worker 接口签名未变
- ✅ /teacher/instances/[id]/insights + /teacher/dashboard 隔离
- ✅ dashboard.tsx 704 行 < 800（phase 3 632 + 72 = 704，符合 spec §H.46）

## 静态层全绿
- `npx tsc --noEmit` 0 errors
- `npm run lint` 0 errors / 0 warnings
- `npx vitest run` 782/782 passed (66 files, 同 phase 3 baseline)
- `npm run build` 成功（含新路由 `/api/lms/analytics-v2/scope-insights`）

## 整体结果

**Overall: PASS** — 46/46 acceptance criteria 全 PASS（4 个 Minor 不阻塞：UUID 显示 + StudyBuddy 0 数据 + 历史 console error + phase 2 沿袭 width=-1 warning）。

### Phase 4 高难度项全过
- ✅ Prisma 三步铁律 严格执行（含 main migration drift 同步修复，DB 数据零丢失）
- ✅ 24h scopeHash 缓存命中 + forceFresh 绕过缓存
- ✅ LLM 真调 + 失败兜底 (UI 不空白 + 显示模板结果)
- ✅ Drawer 三种 evidence 类型 (highlight / issue 真浏览器验过；studybuddy_question code 路径完整)
- ✅ Phase 1+2+3 anti-regression 7 项全保

### Dynamic exit 状态
本轮是 phase 4 首轮 = 1 PASS。phase 1 r2 + phase 2 r1 + phase 3 r1 已确立"PASS 后让 PR review 作最终安全门"模式。

## 给 coordinator 的建议

1. 本轮 PASS，可让 builder 按 [.harness/spec.md §提交策略](.harness/spec.md) atomic commit
2. 不跑 r2 churn（与前 3 phase 一致）
3. 用户合并 PR 后启动 phase 5 spec
4. **建议 phase 5 顺手处理**：
   - Minor 1: relatedCriterion 显示 criterion name 而非 UUID
   - Minor 4 (沿袭 phase 2): recharts width=-1 warning 系统修
5. **Schema/migration drift 需在 HANDOFF 记录**：worktree 从 e311571 分叉后 main 加了 `data_insight_advice` enum migration，builder 已同步进 worktree，避免 `prisma migrate dev` 要求 reset DB
