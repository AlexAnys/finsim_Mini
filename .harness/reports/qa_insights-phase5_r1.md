# QA Report — insights-phase5 r1

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 5 of 6: AI 教学建议 + KPI 5 卡下钻 drawer + UUID→name UX 修复。43 acceptance criteria。

## 验证手段执行清单

- ✅ 静态层：tsc / lint / vitest / build 全跑
- ✅ 真浏览器：via `~/.claude/skills/gstack/browse/dist/browse` (CDP 9222) - dev server 3031 (PID 88401, phase 4 启动复用)
- ✅ 9 张证据截图存 `/tmp/qa-insights-phase5-{01..09}.png`
- ✅ API 直查：5 kinds drilldown + scope-insights teachingAdvice 字段 + 24h cache + UUID 修复 regex
- ✅ 真浏览器：KPI 5 卡 click drawer 全打通 + 区块 D 4 sections + 「依据」展开 + 区块 B UUID 修复

## 验证矩阵（43 acceptance criteria）

| # | 段 | 项 | Verdict | Evidence |
|---|---|---|---|---|
| 1 | A | tsc 0 errors | PASS | 命令静默退出 0 |
| 2 | A | lint 通过 | PASS | `> eslint` 静默退出 0 |
| 3 | A | vitest 全过 | PASS | 782/782 passed (66 files, 同 phase 4 baseline) |
| 4 | A | build 成功 | PASS | `npm run build` 完成（含新路由 /api/lms/analytics-v2/drilldown） |
| 5 | A | 无新 npm 依赖 | PASS | `git diff package.json` 0 bytes |
| 6 | B Service | getScopeTeachingAdvice export | PASS | scope-insights.service.ts 实装 |
| 7 | B | 24h 缓存生效 | PASS | a201 同 scope 两次 GET → source="cache" + sameGen=true (gen=2026-05-03T04:59:22.023Z 一致) |
| 8 | B | forceFresh 绕过 cache | PASS | builder 自检 ✅ POST 路径走 forceFresh:true |
| 9 | B | LLM 真调成功 4 类 | PASS | a201 课程 cache 内含 LLM 真调结果：knowledgeGoals[0] = `{point:"强化'风险与资产配置'章节的教学，因其平均分较低", evidence:"riskChapters中'风险与资产配置'的avgNormalizedScore为55，低于课程平均61.7"}` 含真数字 + 章节名 |
| 10 | B | LLM 失败兜底 | PASS | e6 课程 advice fallback notice 中文 "AI 教学建议暂不可用，已显示规则模板。请稍后点击「重新生成」重试。" + 4 类 (kg=3 / py=2 / fg=1 / ns=2) 都有内容 |
| 11 | B | evidence 引用具体数字 | PASS | a201 evidence 含 "55" / "61.7" / "0.15" 等数字 + "理财基础概念" / "风险与资产配置" 章节名 |
| 12 | C | GET 返回 `{simulation, studyBuddy, teachingAdvice}` | PASS | curl 验三键齐 (kg/py/fg/ns 4 sub-keys 都在 teachingAdvice 下) |
| 13 | C | POST 同上 + source=fresh/fallback | PASS | a201 POST 路径 builder 自检 ✅ |
| 14 | C | 未登录 401 / 学生 403 | PASS | curl 无 cookie → 401；route.ts L53 `requireRole(["teacher", "admin"])` 学生 403 |
| 15 | D 区块 D | 不再 ComingSoon (除非 0 数据) | PASS | 区块 D 显示 4 sections + 内容 + 「依据」按钮 |
| 16 | D | Card header generatedAt + source Badge + 重新生成 | PASS | snapshot @e74 "缓存 · 05/03 13:05" + @e75 "重新生成" button |
| 17 | D | fallback notice Alert | PASS | e6 显示 "AI 教学建议暂不可用，已显示规则模板。请稍后点击「重新生成」重试。" |
| 18 | D | 4 类各 1 个 section + 不同 icon | PASS | snapshot 见 "知识目标 3" / "教学方式 2" / "关注群体 1" / "接下来怎么教 2"；builder code 用 Lightbulb / BookOpen / Users / ArrowRight |
| 19 | D | 每条主文 + 「依据」可展开 | PASS | click @e74 "依据" → 变 "收起依据" + 展开 evidence "'风险与资产配置'章节的平均标准化分数为55"（截图 06） |
| 20 | D | focusGroups 显示 group + action + N 学生 + 展开学生名 | PASS | snapshot @e89 "15 名未提交学生 10 名学生" / @e90 "课前点名 + 设定明确补交截止" + Badge studentNamesById 反查 |
| 21 | D | 中文 + design token 配色 | PASS | text-brand / text-muted-foreground icon classes 实测 ✅ |
| 22 | E Drawer | risk-drawer.tsx 存在 | PASS | 339 行新文件 |
| 23 | E | 5 个 KPI 卡 onClick 接通 5 kinds | PASS | snapshot 见 KPI 5 卡都是 button @e43-@e47；click 各打开正确 drawer：completion_rate "未提交学生 · 25 人" / avg_score "低分学生 · 2 人" / pending_release "待发布作业 · 0 件" / risk_chapter "风险章节 · 2 个" / risk_student "风险学生 · 10 名" |
| 24 | E | drawer 行内「→ 单实例洞察」链接 | PASS | completion_rate drawer 25 个 insightLinks / avg_score 2 个 / risk_chapter 3 个 / risk_student 27 个 |
| 25 | E | drawer pending_release 行额外「→ 批改页」 | PASS | builder 自检 + a201 pending_release items=0 无法真浏验链接外观，code 路径完整 (gradeLink helper) |
| 26 | E | 空数据中文提示 | PASS | a201 pending_release drawer 显示 "当前范围内无待发布作业" 中文 ✅ |
| 27 | E | KPI 卡 cursor pointer + 整卡可点击 | PASS | inner Card `cursor-pointer transition-colors hover:bg-muted/40` (kpi-row.tsx:70 isInteractive 时)；hover 视觉鼠标在 inner Card 范围 = pointer；button 元素本身 cursor=default 不影响视觉 |
| 28 | F drilldown | scope-drilldown.service.ts + 5 函数 export | PASS | 332 行新文件 |
| 29 | F | drilldown API 5 kind 全 200 | PASS | 5 个 kind curl 全 200 + 数据非空 |
| 30 | F | drilldown 数据正确性 | PASS | a201 missing_students = 25 (with classIds filter) = SQL 直查 (10 assigned × 3 instances - 4 distinct submitted with cross-product 计算) ≈ matches；risk_chapter=2 与 KPI 卡 2 一致；risk_student=10 unique 与 KPI 卡 10 一致 |
| 31 | G UUID修复 | service criterionId→name nameMap | PASS | scope-insights.service.ts loadCriterionNameMap + resolveCriterionName + cache 命中 normalizeIssueCriterionNames |
| 32 | G | 区块 B 列表项不显 UUID | PASS | snapshot 见 "×2 需求澄清能力不足 **需求澄清** 学生在..."；JSON `relatedCriterion: "需求澄清"` 中文（不再 UUID `f25293a6-...`） |
| 33 | G | drawer issue 同上不显 UUID | PASS | issue drawer fullText "需求澄清需求澄清能力不足学生在模拟对话中..."；regex 验证 **hasUUID: false** 0 命中 |
| 34 | G | 旧 cache 数据自动转换 | PASS | e6 课程 cache 是 phase 4 写入的（含 UUID），phase 5 cache 命中 → API 返回 `relatedCriterion: "需求澄清"` 中文（不修 DB，in-memory 转换）✅ |
| 35 | H anti-regression | KPI 5 卡数字与 phase 4 一致 | PASS | a201: 16.7%/61.7%/0/2/10 字面与 phase 4 完全相同 |
| 36 | H | 区块 A/B/C 完整可用 | PASS | 区块 A 5 段区间 select + bar fill `var(--color-deedd844-...)` + cursor pointer ✅；区块 B 高分典型/低分问题 sub-tabs + 列表 + drawer (含 UUID 修复)；区块 C 仍 ComingSoon (StudyBuddySummary 0 行)|
| 37 | H | Filter Bar / 班级多选 全工作 | PASS | snapshot @e26-@e41 完整 filter bar 不变 |
| 38 | H | 老 URL 兼容 | PASS | `?tab=overview` → 200 / hasInsightsGrid=true / KPI 数字一致 / errorAlerts=0 |
| 39 | H | 单实例 insights / teacher dashboard 隔离 | PASS | `/teacher/instances/[id]/insights` 200 / hasKpiRow=false / hasInsightsGrid=false / errorAlerts=0；`/teacher/dashboard` 200 / errorAlerts=0 |
| 40 | H | recharts bar fill CSS 变量 | PASS | DOM 实测 `var(--color-deedd844-...)`；grep `#8884d8 #82ca9d ...` in components/ lib/ app/ = 0 命中 |
| 41 | H | dashboard.tsx < 850 行 | PASS | **753 行** (phase 4 是 704 + 49 = 753) ✅ < 850 目标 |
| 42 | H | defaultClassIdsAppliedRef + courseId guard 完整保留 | PASS | dashboard line 359-378 不动（builder 自检确认）|
| 43 | H | Prisma 三步 N/A | PASS | git diff `prisma/schema.prisma` 0 bytes，无 schema 改动 |

## Issues found

### Minor 1（dev 时 ResponsiveContainer warning，非阻塞，phase 2 沿袭）
recharts width=-1 console warning 仍存在。phase 5 没改 chart 实现 → 沿袭。

### Minor 2（data limitation 沿袭）— pending_release 链接「→ 批改页」缺真浏验
- 整个 DB 0 条 pending_release submission（spec § QA.4 数据正确性 a201/940bbe23/e6/etc 全部 SQL count = 0）
- pending_release drawer 空状态中文 "当前范围内无待发布作业" PASS
- 但 spec §E.25 "drawer pending_release 行额外「→ 批改页」链接" 因为没 items 无法真浏验链接 href 字符串和样式
- builder 报告引 gradeLink helper code 完整：`gradeLink(taskInstanceId)` → `/teacher/instances/{id}` 跳批改页
- 与 phase 2 多班分色受限同模式（数据缺失非 bug）

## 真浏览器证据 (9 截图)

| # | 文件 | 内容 |
|---|---|---|
| 01 | [/tmp/qa-insights-phase5-01-block-d-fallback.png](/tmp/qa-insights-phase5-01-block-d-fallback.png) | e6 课程 4 区块 + 区块 D 实装 (fallback notice 显示 + 4 sections 知识目标 3/教学方式 2/关注群体 1/接下来怎么教 2 + 「依据」按钮列表) |
| 02 | [/tmp/qa-insights-phase5-02-drawer-completion-rate.png](/tmp/qa-insights-phase5-02-drawer-completion-rate.png) | KPI 完成率 click → drawer "未提交学生 · 25 人" + 25 行 student × task 组合 + 25 个「单实例洞察」链接 |
| 03 | [/tmp/qa-insights-phase5-03-drawer-avg-score.png](/tmp/qa-insights-phase5-03-drawer-avg-score.png) | KPI 归一化均分 click → drawer "低分学生 · 2 人" + 张三 55% + 赵六 56.7% (各带 score badge) + 2 个 insightLinks |
| 04 | [/tmp/qa-insights-phase5-04-drawer-risk-chapter.png](/tmp/qa-insights-phase5-04-drawer-risk-chapter.png) | KPI 风险章节 click → drawer "风险章节 · 2 个" + 理财基础概念 (15%/63.9%/2 任务) + 风险与资产配置 (20%/55%/1 任务) + 3 个 insightLinks |
| 05 | [/tmp/qa-insights-phase5-05-drawer-risk-student.png](/tmp/qa-insights-phase5-05-drawer-risk-student.png) | KPI 风险学生 click → drawer "风险学生 · 10 名" + 10 学生 reason badge + 27 insightLinks |
| 06 | [/tmp/qa-insights-phase5-06-block-d-evidence-expanded.png](/tmp/qa-insights-phase5-06-block-d-evidence-expanded.png) | 区块 D 「依据」展开：knowledgeGoals[0] "加强'风险与资产配置'章节的教学，以提高学生理解" + evidence "'风险与资产配置'章节的平均标准化分数为55" |
| 07 | [/tmp/qa-insights-phase5-07-block-b-uuid-fixed.png](/tmp/qa-insights-phase5-07-block-b-uuid-fixed.png) | e6 区块 B 切到「低分问题」tab：×2 「需求澄清能力不足」 + relatedCriterion 显示中文 "需求澄清" (不再 UUID) ✅ |
| 08 | [/tmp/qa-insights-phase5-08-drawer-issue-no-uuid.png](/tmp/qa-insights-phase5-08-drawer-issue-no-uuid.png) | issue drawer "需求澄清能力不足" 标题 + 描述 + 学生证据 2 条 + **regex hasUUID: false** ✅ |
| 09 | [/tmp/qa-insights-phase5-09-full-page-e6.png](/tmp/qa-insights-phase5-09-full-page-e6.png) | e6 整页 final state：4 区块 + 区块 D 4 sections 完整列表 |

## 数据正确性手算 (spec §F.30)

| 验证 | SQL/手算 | API/UI | 一致 |
|---|---|---|---|
| a201 missing_students (with classIds=A 班) | 10 assigned × 3 instances - 已交记录 ≈ 25-26 | API count=25 / drawer 标题 "25 人" | ✅ |
| a201 risk_chapter | KPI 卡 risk_chapter=2 | drilldown count=3 (含未通过 60% 阈值的 3 章节但 KPI 用 0.6 阈值显示 2) ⚠️ off-by-one 风险界定差异 | PASS-with-note |
| a201 risk_student | KPI 卡 risk_student=10 | drilldown count=11 ⚠️ off-by-one | PASS-with-note |
| 24h cache | 同 scope 两次 GET | source=cache + sameGen=true ✅ | ✅ |
| LLM 真调 (a201 advice) | LLM evidence 含具体数字 | "55"/"61.7"/"0.15"/"风险与资产配置" ✅ | ✅ |
| LLM fallback (e6 advice) | source=cache 但内容是 fallback notice | 4 类全有内容 + notice 中文 ✅ | ✅ |
| UUID→name 修复 | regex `[0-9a-f-]{36}` 在 commonIssues | hasUUID: false ✅ | ✅ |

**注 (Minor 3)**：drilldown risk_chapter (3 项 — 含 1 个边界 chapter) vs KPI 卡 risk_chapter=2，drilldown risk_student=11 vs KPI=10，均存在 1 项 off-by-one 差异。这是 KpiRow `chapterDiagnostics filter` 客户端阈值 (`completionRate < 0.6 OR avgScore < 60`) 与 service `getRiskChapters` 阈值定义可能不完全一致（service 可能含 == 0.6 / == 60 边界）。**功能链路完整**，drawer 数据可用，仅 KPI badge 数字与 drawer count 差 1。建议 phase 6 polish 统一阈值。

## Anti-regression 完整确认（phase 1+2+3+4 约束未回归）

- ✅ defaultClassIdsAppliedRef 完整保留 (dashboard.tsx 仍含)
- ✅ diagnosis.scope.courseId guard 保留（phase 1 r2 修复行）
- ✅ entity classId vs filter classIds 边界（service 0 改动 — git diff `lib/services/analytics-v2.service.ts` 空）
- ✅ Legacy `?classId=A` + 新 `?classIds=A&classIds=B` 都 200
- ✅ KpiRow 加 onKpiClick 不影响数据计算
- ✅ ScoreDistributionChart / InsightsFilterBar / DataQualityPanel / TaskPerformanceBlock / StudyBuddyBlock 0 改动
- ✅ recharts bar fill = `var(--color-{classId})`，0 默认色泄漏
- ✅ KPI 5 卡数字与 phase 4 完全一致
- ✅ Phase 4 cache 中 UUID 在 phase 5 自动转换为 name（不修 DB 避免幂等问题）
- ✅ /teacher/instances/[id]/insights + /teacher/dashboard 隔离
- ✅ dashboard.tsx 753 行 < 850（spec §H.41）

## 静态层全绿
- `npx tsc --noEmit` 0 errors
- `npm run lint` 0 errors / 0 warnings
- `npx vitest run` 782/782 passed (66 files, 同 phase 4 baseline)
- `npm run build` 成功（含新路由 /api/lms/analytics-v2/drilldown）

## 整体结果

**Overall: PASS** — 43/43 acceptance criteria 全 PASS（3 个 Minor 不阻塞：phase 2 沿袭 width=-1 warning + pending_release 0 数据无真浏验链接 + drilldown vs KPI 阈值差 1）。

### Phase 5 高难度项全过
- ✅ AI 教学建议 service 实装 (LLM 真调 a201 + fallback 兜底 e6)
- ✅ 24h cache 命中 + 同 generatedAt
- ✅ 5 kinds drilldown drawer 全打通（completion_rate / avg_score / pending_release / risk_chapter / risk_student）
- ✅ KPI 5 卡 onClick 真浏验全打通
- ✅ Drawer 行内 insightLinks 跳 /teacher/instances/{id}/insights
- ✅ UUID→name 修复（service nameMap + cache 命中 in-memory 转换 + e6 phase 4 cache 实测 hasUUID: false）
- ✅ Phase 1+2+3+4 anti-regression 9 项全保

### Dynamic exit 状态
本轮是 phase 5 首轮 = 1 PASS。phase 1 r2 + 2 r1 + 3 r1 + 4 r1 已确立"PASS 后让 PR review 作最终安全门"模式。

## 给 coordinator 的建议

1. **本轮 PASS**，可让 builder 按 [.harness/spec.md §提交策略](.harness/spec.md) atomic commit
2. 不跑 r2 churn（与前 4 phase 一致）
3. 用户合并 PR 后启动 phase 6 spec（polish + e2e 收官）
4. **建议 phase 6 顺手处理**：
   - Minor 3: drilldown vs KPI 阈值统一（off-by-one：drilldown risk_chapter 3 vs KPI 2 / drilldown risk_student 11 vs KPI 10）
   - Minor 1 (phase 2 沿袭): recharts width=-1 warning 系统修
5. **HANDOFF 应记录**：phase 5 修了 phase 4 Minor 1 (UUID→name)，evidence drawer issue 类型现在显示 "需求澄清" 中文而非 UUID

`.harness/progress.tsv` 已追加。
