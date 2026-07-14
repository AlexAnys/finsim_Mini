# 数据洞察专项审查报告 · audit-insights

> 审查基线：main @ f45b94c · 只读审查（未改任何应用代码）
> 审查面：/teacher/analytics(-v2)、instances/[id]/insights、ai-usage、weekly-insight cron、study-buddy analytics、dashboard/summary
> 服务：analytics-v2 / insights / scope-insights / scope-drilldown / instance-objective-stats / weekly-insight / dashboard，及 utils transcript-stats / sim-objective-stats / analytics-utils
> **DB 对账限制**：本次会话共享 dev DB (finsim-postgres:5432) 实测为空（0 submissions / 0 graded / 0 AnalysisReport），dev server 未运行。按审查纪律严禁 seed，故无法做"活数据"数值对账；改为**公式级对账 + 可复算的算例**（见 §5），证据强度等同。

---

## 0. 执行摘要 —— 直答用户三问

**问1：数据的分析呈现是否有更优、更符合理解的方式？**
有，且有硬伤要先修。当前主看板 `/teacher/analytics-v2` 把**已算好的客观维度丢弃不渲染**（题目级正确率 `quizDiagnostics`、章节×班级热力 `chapterClassHeatmap`、rubric 维度诊断、时间序列 `trends`/`weeklyHistory`、规则版周报 `weeklyInsight` 全部在组件里被声明为 `Array<unknown>` 从未上屏），却把 3/4 的版面让给 **AI 叙事面板**（模拟洞察、Study Buddy、AI 教学建议）。结果是"客观的没展示、展示的靠 AI"。重设计方向见 §6：把题目/维度/班级对比这些**确定性可核验**的图表提到主看板，AI 叙事降级为可选辅助。

**问2：数据分析是否客观、基于不同维度的数据？**
**部分客观，但有 P0 级硬伤**。最严重：**周报 cron 的"班级平均分""概念错误率"是让 AI 直接在 200 行原始数据上算出来的数字**（`weekly-insight.service.ts:124/137`），不是代码聚合——LLM 对几百行做算术不可靠，教师据此做班级对比是被误导。其次：**同一个任务的"均分"跨面板有三套口径且不标注**（原始分 vs 归一化%、去重 vs 不去重），教师在不同页面看到同一任务不同数字。AI 单次评分被当 ground truth 直接聚合，无样本量/信度提示；小样本（n=3~10）无任何客观性提示。逐指标裁定见 §2。

**问3：哪些维度缺失？**
库里已有、但没被有效利用的维度一大把：**题目区分度（discrimination index）完全没有**；**提交时间分布（赶 DDL vs 提前，`submittedAt` 相对 `dueAt`）没做**；**作答时长 `durationSeconds` 只在一个 quiz tab 出现**、课程级无时间维度；**班级间确定性对比**没有（唯一的班级对比来自不可靠的 AI 周报）；**时间序列趋势**算了但不渲染；**知识点掌握图（`knowledgeTagIds` 聚合）没有**。清单见 §3。

**发现计数：P0 × 2 · P1 × 7 · P2 × 7**（共 16 条）。Quick-win（低成本高收益）：把 `weekly` cron 的 avgScore/errorRate 改成代码算（F-INS-01）、默认展开数据质量面板（F-INS-07）、给所有"率"类指标补 n（F-INS-04）。

---

## 1. 系统全景（谁算、谁显示、口径几套）

| 面板 / 入口 | 数据来源 | "均分"口径 | 洞察性质 |
|---|---|---|---|
| 教师首页 dashboard/summary | `dashboard.service.computeLiveAnalytics` | 归一化%，**全部 graded 提交**求均（不去重、不管学生是否在班） | 纯数值 |
| `/teacher/analytics-v2` 主看板 | `analytics-v2.service.getAnalyticsV2Diagnosis` | 归一化%，**每生一分**（scorePolicy latest/best/first 去重）、仅在册学生 | KPI+分布=规则；3 面板=**AI** |
| `/teacher/instances/[id]/insights` 页 | `/insights` route（Handler 内联业务） | **原始分**均值，全部 graded，maxScore=Σrubric 满分(缺则100) | 规则+证据抽屉 |
| instance-detail「分析」tab | `analytics-utils.computeKPIs` | **原始分**均值，全部 graded | 规则+题目正误网格+时长散点 |
| instance-detail「洞察」tab | `insights.service.aggregateInsights` | — | **AI** commonIssues/highlights/mood/配比演变 |
| `/teacher/analytics-v2` AI 面板 | `scope-insights.service` | — | **AI** 教学建议/模拟诊断+确定性证据 |
| 周报弹窗 / cron | `weekly-insight.service.generateWeeklyInsight` | **AI 自己算的 avgScore** | **AI**（含数值） |
| ai-usage（→ai-workbench） | `ai-usage.service` | — | 成本/token 聚合 |
| study-buddy 课程分析 | `/study-buddy/analytics` route | — | 分组统计+**AI** 摘要 |

> 备注：`/teacher/analytics`（v1）与 `/teacher/ai-usage` 均为 redirect stub（v1→v2，ai-usage→ai-workbench?tab=usage），**页面级冗余已消除**；但**数据口径的冗余/分裂仍在**（见 F-INS-02）。

---

## 2. 指标审计表（面板 / 指标 / 公式 / 客观性裁定）

### 2.1 analytics-v2 主看板（KPI + 分布）

| 指标 | 公式（代码位置） | 分母 / 聚合 | 客观性裁定 |
|---|---|---|---|
| 完成率 | `rate(ΣsubmittedCount, ΣassignedCount)`，`analytics-v2:676` | 分母=各实例应交人数之和（在册学生或分组成员）；分子=有任意提交的人数之和 | ✅ 客观。缺考/未提交计入分母（正确）。多实例是"人次"求和，非"人" |
| 归一化均分 | `average(allScores)`，`:677`；allScores=各实例 selectedScore 展平 | 分母=**已评分的学生-实例数**；缺考/未评分不进分母 | ⚠️ 均分只看完成者，**掩盖未完成**（完成率单独给，需并读）；submission-weighted：做 5 个任务的学生占 5 权重 |
| 中位数 | `median(allScores)`，`:678` | 同上 | ✅ 有中位数（对抗偏态），但**未展示分布形态之外的方差/离散** |
| 及格率 | `rate(scores≥60, scores.length)`，`:679` | 分母=已评分数 | ✅ 阈值 60 硬编码，全系统一致（`PASS_THRESHOLD`） |
| 成绩分布直方图 | `computeScoreDistribution`，`:780`；多任务=**先按生求各任务 selectedScore 均值再分箱**（`:844`） | student-weighted | ⚠️ **与 KPI 均分口径不一致**（KPI 是 submission-weighted）→ 同一面板 KPI 中心 ≠ 直方图中心（F-INS-09） |
| 风险信号 | 风险章节数（`isRiskChapter`：完成率<0.6 或均分<60）+ 干预学生去重数 | 规则阈值 | ✅ 规则透明 |
| 数据质量 flags | `buildDataQualityFlags` + 每实例 flags | — | ✅ 有护栏（分>100/完成率>100%/异常分/小样本/多次提交）；❌ **默认折叠**、小样本阈值 n<3 且 info 级（F-INS-04/07） |

### 2.2 analytics-v2 三个 AI 面板

| 指标/内容 | 生成方式 | 客观性裁定 |
|---|---|---|
| 模拟共性问题 commonIssues | 确定性抽取 rubric 低分项(score/max<阈值)→按维度分组→**AI 只写标题/描述**，证据(学生/分数/摘录)**回绑真实低分项** `scope-insights:630` | ✅ 设计良好，证据不可幻觉。⚠️ 但 `frequency` 用 AI 返回值非 `items.length`（F-INS-16） |
| 模拟亮点 highlights | 按归一化分排序取高分（`pickHighlights`） | ✅ 纯规则 |
| Study Buddy 分组 | `StudyBuddySummary.topQuestions` + **模糊字符串匹配** `p.question.includes(q.text)‖q.text.includes(p.question.slice(0,8))` `:300` | ⚠️ 匹配脆弱（前 8 字），可能错配学生样例 |
| AI 教学建议（知识目标/教法/下一步） | 全 AI 生成，**evidence 为 AI 自由文本、未回绑** `:975-986`；仅 focusGroups 的学生名回绑真实 id | ❌ "evidence"标签暗示有据实则可幻觉（F-INS-06） |

### 2.3 instance insights 页（`/insights` route）

| 指标 | 公式（`insights/route.ts`） | 客观性裁定 |
|---|---|---|
| 均分 | `Σ Number(score)/gradedCount`，**原始分** `:50` | ❌ 与 v2 归一化%口径不同、无标注（F-INS-02）；不去重 |
| maxScore | `Σ scoringCriteria.maxPoints ‖ 100` `:53` | ❌ **quiz 无 rubric→退 100**，与 quiz 实际 maxScore 脱节→分布归一化 `score/100` 可能错（F-INS-14） |
| 分数分布 | `(score/maxScore)*100` 分 10 档 | ⚠️ 依赖上面的 maxScore；quiz 场景失真 |
| 各维度得分 / 薄弱维度 | rubricBreakdown 维度均分（**扣分前原始分**） | ✅ 维度分客观；❌ 但页面**未标注** summary 均分(扣分后总分) 与维度分(扣分前)基准不同，教师加总维度对不上均分 |

### 2.4 instance-detail「分析」tab（`analytics-utils`）

| 指标 | 公式 | 裁定 |
|---|---|---|
| 均分/中位/及格率 | 原始分均值/中位；及格=score/maxScore≥0.6 | ⚠️ 原始分，与 insights 页一致但与 v2 不一致 |
| **平均作答时长** | `mean(durationSeconds>0)` `analytics-utils:65` | ✅ **唯一用到时长维度的地方**（仅 quiz 有 durationSeconds） |
| 时长×得分散点 | `buildScatter` | ✅ 好维度，但仅此一处、仅 quiz |
| 题目正误网格 | 逐生×逐题 correct 布尔（`:363-435`） | ✅ 有题目级正误；❌ 但**无题目正确率排名/区分度**，且与未渲染的 `quizDiagnostics` 重复造轮子 |

### 2.5 客观体检面板（`instance-objective-stats` + `sim-objective-stats`，simulation-only）

| 指标 | 公式 | 裁定 |
|---|---|---|
| 对话参与度 | 学生发言条数=轮次；总字数；每轮均字（`transcript-stats`） | ✅ 明确说明生产 timestamp 全同、时长不可算，改用轮次/字数——**诚实的降级**，好 |
| 维度短板 | rubricBreakdown 扣分前原始分，得分率升序，**带 `basisLabel` 显式标注口径** | ✅ **全系统最规范的一处**——把口径差异显式透传，其他面板应学它 |
| 概念热力 | conceptTags 同义归并→按出现人数 | ✅ 客观计数；⚠️ 归并表是硬编码维护 |
| 配置画像 | 关键词分类 equity/lowRisk/other，"基金"默认归 equity | ⚠️ 关键词误分类风险（F-INS-11） |
| **200 截断** | `take:200` graded by gradedAt desc `:101` | ❌ >200 人静默按最近 200 算（F-INS-08） |

### 2.6 周报 cron（`weekly-insight`）—— 客观性重灾区

| 指标 | 生成方式 | 裁定 |
|---|---|---|
| 班级平均分 classDifferences.avgScore | **AI 在 200 行原始 score 上自己算** `schema:137` | ❌❌ **P0**：数值交给 LLM，可算错→误导班级对比（F-INS-01） |
| 概念错误率 errorRate | **AI 自己算** `schema:124` | ❌ P0：同上 |
| 学生聚类 studentClusters | AI 判定分群+size | ⚠️ 主观、无据可核 |
| 200 截断 | `take:200` released-graded | ❌ 高峰周静默截断、recency 偏 |

### 2.7 mood 情绪时间线（`insights.service`）

| 指标 | 生成方式 | 裁定 |
|---|---|---|
| 情绪分 moodScore | 优先 AI 产出的 moodScore；缺失时 `moodKeyToScoreFallback` **硬编码中位猜测** `:14-26` | ⚠️ AI 生成的情绪当客观信号；fallback 是猜值；且该 timeline 算了持久化但 insights 页不渲染（F-INS-12） |

---

## 3. 维度盘点（已用 vs 躺在库里没用上）

**已利用的维度**：原始/归一化分、完成率、及格率、中位数、分数分布、rubric 维度分、conceptTags 热力、模拟参与度(轮次/字数)、配置画像、尝试次数/首末提升、mood(AI)、Study Buddy 提问、quiz 作答时长(单点)、quiz 逐题正误(单点)。

**库里已有、但缺失或严重underused 的维度**：

| 维度 | 库字段 | 现状 | 缺什么 |
|---|---|---|---|
| **题目区分度** | QuizQuestion + quizBreakdown | 完全没算 | 高分组vs低分组正确率差（item discrimination）——判"坏题/歧义题"的关键，教研必需 |
| **题目难度校准** | `QuizQuestion.difficulty` vs 实际正确率 | 只用于 adaptive 出题 | 没有"标注难度 vs 实际正确率"对照，无法校准题库 |
| **提交时间分布** | `Submission.submittedAt` vs `TaskInstance.dueAt` | 未做 | 赶 DDL/拖延画像、临期集中提交预警 |
| **作答时长（课程级）** | `QuizSubmission.durationSeconds` | 仅 instance-detail 一个散点 | 课程级"投入时长 vs 成绩"、异常快速作答(疑似敷衍)检测 |
| **知识点掌握图** | `QuizQuestion.knowledgeTagIds` | 仅 adaptive 诊断用 | 班级级知识点掌握热力（按 tag 聚合正确率） |
| **班级间确定性对比** | 全字段齐 | `chapterClassHeatmap` 算了不渲染；唯一对比来自 AI 周报 | 确定性的班级×章节均分/完成率对比矩阵 |
| **时间序列趋势** | 齐 | `trends`/`weeklyHistory` 算了不渲染 | 完成率/均分周走势线（主看板不可见） |
| **配比演变轨迹** | `assets.snapshots` | `allocationSnapshots` 抽了、仅 AI tab | 模拟过程中风险敞口随对话演变——教学富矿，几乎没用 |
| **多次尝试学习曲线** | 多 Submission | 只取 first/latest/best 三点 | 练习模式下的完整成长曲线 |
| **批改/发布时效** | `gradedAt`/`releasedAt` | 只统 pending 数 | 批改延迟、成绩滞留时长 |
| **分组队列对比** | `StudentGroup` (含 auto_score_bucket) | 分组用于派发，不用于分析 | 按能力分组的 cohort 对比 |

---

## 4. 教师决策检验表（每面板"看完能做什么"）

| 面板 | 教师能立刻采取的行动 | 判级 |
|---|---|---|
| analytics-v2 KPI 行 | 看完成率/均分/待发布/风险数→点风险抽屉拿到未完成&低分名单去跟进 | ✅ 可行动 |
| 成绩分布直方图 | 点箱子看该分段学生名单→分层辅导 | ✅ 可行动（但与 KPI 数不吻合会困惑） |
| 模拟共性问题（AI） | 拿到低分维度+真实对话证据→课堂讲评 | ✅ 可行动（证据可核） |
| AI 教学建议 | "知识目标/教法/下一步"——**多为泛化教学法**，evidence 未回绑，教师难判断该不该照做 | ⚠️ 半可行动（易沦为正确的废话） |
| Study Buddy 分组 | 看高频提问→备课补讲 | ✅ 可行动 |
| instance insights 页 | 看分布+维度短板+点学生看证据→个案辅导 | ✅ 可行动（但均分口径困惑） |
| instance-detail 分析 tab | 题目正误网格→定位难题；时长散点→抓异常 | ✅ 可行动（quiz 最实用，却被埋在 tab 里） |
| 客观体检面板 | 参与度/维度短板对照 AI 判分→核验 AI 是否判错 | ✅ 设计初衷就是可行动，很好 |
| **周报班级对比** | 看"班级A 78 / B 65"决定重点扶哪个班 | ❌ **数字可能是 AI 算错的**→行动建立在错误数据上 |
| ai-usage | 看各功能成本→控预算 | ✅ 可行动（高频课程会低估） |

**呈现失败面板**：主看板丢弃的 `quizDiagnostics`（题目正确率排名）——教师最想要的"哪道题最多人错"在主看板上答不出（只能进 instance-detail tab 逐个看网格）。

---

## 5. 对账结果（公式级 + 可复算算例）

> DB 空，无法数值对账；以下算例直接由代码路径推导，任何人可手算复现。

### 算例 A —— 同一任务、三面板三个"均分"
设某任务实例，在册 3 生。学生甲交 2 次(6/10 早、9/10 晚，均 graded)；乙交 1 次(8/10)；丙未交。rubric 满分合计=10。

- **教师首页**（`computeLiveAnalytics`，归一化%全 graded 不去重）：((6+9+8)/3 顺次归一)= (60+90+80)/3 = **76.7%**
- **analytics-v2**（每生一分，latest 策略）：甲取 9→90、乙 80、丙无 → mean(90,80)= **85.0%**
- **instance insights 页**（原始分全 graded）：(6+9+8)/3 = **7.7 / 10**（≈76.7%）

→ 同一个任务，教师首页看到 76.7%、洞察看板看到 85.0%、实例洞察页看到 7.7/10。**三个数、两套口径、零标注**。差异根因：(a) 是否按学生去重多次提交，(b) 原始分 vs 归一化。→ F-INS-02。

### 算例 B —— analytics-v2 面板内 KPI ≠ 直方图
设甲做 2 任务(90,90)、乙做 1 任务(60)。
- KPI 均分 `average(allScores)` = mean(90,90,60)= **80.0**
- 直方图（多任务先按生求均再分箱）：甲均 90、乙均 60 → 柱子中心 mean(90,60)= **75.0**，且只有 2 个学生点。

→ 同一屏 KPI 显示 80，直方图重心 75。→ F-INS-09。

### 算例 C —— 周报班级均分（AI 计算）不可对账
`classDifferences[].avgScore` 直接取 AI JSON 输出（`schema:137`），无代码复算。即使给定确定的 200 行输入，输出数值取决于 LLM 算术，**不可复现、不可对账**。这本身就是最强的不客观证据。→ F-INS-01。

---

## 6. 重设计提案（维度 × 呈现矩阵）

### 提案一：主看板"确定性优先"重构（最高优先）
把已算好但被丢弃的确定性维度提到主看板，AI 叙事降为可折叠副栏：

| 版面槽位 | 现在放的 | 建议改放 | 数据源（已存在！） |
|---|---|---|---|
| 主行左 | 成绩分布 | 成绩分布（保留）+ 修口径与 KPI 对齐 | scoreDistribution |
| 主行右 | AI 模拟诊断 | **题目正确率排行 + 区分度**（quiz）/ **rubric 维度短板条**（sim/subj） | `quizDiagnostics`(已算未用)、`buildRubricDiagnostics`(已算未用) |
| 次行左 | Study Buddy | **班级×章节热力对比矩阵** | `chapterClassHeatmap`(已算未用) |
| 次行右 | AI 教学建议 | **完成率/均分周趋势线** + AI 建议(收进抽屉) | `trends`/`weeklyHistory`(已算未用) |
| 底部 | 数据质量(折叠) | **默认展开**，critical 常驻顶部 | dataQualityFlags |

→ 几乎零新增计算：这些字段服务层已产出，只是组件把它们 typed 成 `Array<unknown>` 扔了。ROI 极高。

### 提案二：统一"均分"口径 + 全局口径标签
- 定 1 个 canonical 口径（建议：**归一化%、每生按 scorePolicy 去重、在册学生**），所有面板复用同一 service 函数；原始分视图必须并排标注"扣分前/原始分"。
- 学 `sim-objective-stats` 的 `basisLabel` 做法：每个均分旁挂一句口径说明（"每生取最近一次、按满分归一"）。
- 每个"率/均分"强制带样本量 `n=`；n<10 显式弱化（灰显+"样本少，仅供个案参考"），把小样本 flag 阈值从 3 提到 10、从 info 提到 warning。

### 提案三：把数值从 AI 手里拿回来（客观性修复）
- 周报 `classDifferences.avgScore`、`errorRate`、`studentClusters.size` 一律**代码聚合**，AI 只写 `summary`/`characteristics` 文字。这是 P0 必修。
- teaching-advice 的 `evidence` 要么回绑真实数据（如 commonIssues 那样），要么改名"参考"，别用"evidence"暗示有据。
- 给所有基于 AI 单次评分的聚合加一句全局声明："分数来自 AI 单次评判，聚合值反映 AI 判定而非绝对标准"，并考虑对关键任务做二次评分抽检信度。

### v1/v2 应合并成什么形态
v1 页面已是 redirect，无需再合并页面。真正要合并的是**口径与实例级三视图**：
- 把 instance-detail「分析」tab（题目网格/时长散点）、「洞察」tab（AI mood/配比）、独立 `/insights` 页（分布/维度/客观体检）**收敛成一个实例洞察页的分区**，共用同一口径的均分；题目级分析（正确率+区分度）作为 quiz 实例的一等公民，不再埋在 tab 网格里。

---

## 7. 发现清单

## F-INS-01 · 周报班级均分/错误率由 AI 计算而非代码聚合
- 严重级: **P0**
- 证据: `lib/services/weekly-insight.service.ts:137`（`classDifferences[].avgScore: z.number().nullable()`）与 `:124`（`errorRate`）均直接取 `aiGenerateJSON` 输出；`generateWeeklyInsight` 把最多 200 行原始 `score/maxScore/feedback` 喂给 AI（`:315,:370-372`），无任何代码复算。
- 影响: 教师用周报做"扶哪个班/哪个概念最弱"的班级级决策，而这些数字是 LLM 在几百行上做的算术，可静默算错且不可复现。
- 修复方向: avgScore/errorRate/size 等一切数值在代码里聚合，AI 只产出文字 summary。

## F-INS-02 · 同一任务"均分"跨面板三套口径、零标注
- 严重级: **P0**（误导教师）
- 证据: 首页 `dashboard.service.ts:170-179`（归一化%、全 graded 不去重）；v2 `analytics-v2.service.ts:677,1018`（归一化%、按 scorePolicy 每生一分、在册学生）；实例页 `insights/route.ts:50-52`（原始分、全 graded）。算例见 §5-A（同任务 76.7% / 85.0% / 7.7分）。`dashboard.service.ts:148` 注释宣称"同口径"，实则只指逐行 normalize 公式，未涵盖聚合(去重/在册)差异。
- 影响: 教师在首页、洞察看板、实例洞察页看到同一任务不同均分，信任崩塌。
- 修复方向: 统一 canonical 口径 + 全局口径标签（提案二）。

## F-INS-03 · 题目级正确率诊断算了却从不渲染
- 严重级: P1（核心呈现失败）
- 证据: `buildQuizDiagnostics`（`analytics-v2.service.ts:1888`）产出每题 correctRate/unansweredRate/avgScoreRate/weakTags；但全仓 `quizDiagnostics` 唯一引用是 `components/analytics-v2/analytics-v2-dashboard.tsx:142` 的 `Array<unknown>` 类型声明，无渲染。`chapterClassHeatmap`/`simulationDiagnostics`/`trends`/`weeklyHistory`/规则版 `weeklyInsight` 同样被丢弃。
- 影响: 教师最需要的"哪道题最多人错"在主看板答不出；已投入的计算白算。
- 修复方向: 提案一，把这些字段接到组件。

## F-INS-04 · 率/均分类指标普遍无样本量与置信提示
- 严重级: P1（客观性）
- 证据: `QuizQuestionDiagnostic`/`RubricCriterionDiagnostic` 接口（`analytics-v2.service.ts:263,273`）无 sampleSize 字段；唯一小样本护栏 `:1195` 阈值 `submittedCount<3` 且 `severity:info`，n=3~10 无提示，且藏在默认折叠面板。
- 影响: n=3 的班级/题目正确率与 n=200 同样展示，教师对偶发波动过度反应。
- 修复方向: 所有率/均分带 n；小样本阈值提到 10、级别提到 warning、灰显弱化。

## F-INS-05 · AI 单次评分被当 ground truth 直接聚合，无信度提示
- 严重级: P1（客观性）
- 证据: 所有均分/分布/维度短板/正确率的底层 `Submission.score` 与 `evaluation.rubricBreakdown`、`conceptTags` 均来自 AI 一次评分（grading 路径产出 evaluation JSON 后即固化）；下游聚合（`instance-objective-stats`、`analytics-v2`、`insights`）无方差/重评信度/置信带。
- 影响: 系统把 AI 主观判分呈现为精确客观事实；同一份答卷重评可能不同分，教师无从知晓。
- 修复方向: 全局声明"分数=AI 单次判定"；关键任务二次评分抽检；客观体检面板(参与度/维度)已是好的对照机制，应更醒目。

## F-INS-06 · 教学建议 evidence 为 AI 自由文本、未回绑
- 严重级: P1
- 证据: `scope-insights.service.ts:975-986`，knowledgeGoals/skillGoals/pedagogyAdvice/nextSteps 的 `evidence` 直接取 AI 输出字符串，无匹配校验；仅 `focusGroups.studentNames` 回绑真实 id（`:982-984`）。对比 commonIssues 的 evidence 是从真实低分项 deterministically 匹配（`:630-649`）。
- 影响: "evidence"标签让教师以为有数据支撑，实为可幻觉的叙述。
- 修复方向: evidence 回绑真实指标，或改名"参考"。

## F-INS-07 · 数据质量护栏默认折叠
- 严重级: P1（呈现）
- 证据: `analytics-v2-dashboard.tsx:690` `DataQualityCollapsible` 默认 `dataQualityOpen=false`（`:245`）；含 critical 级"分数超100/完成率超100%/异常分"需教师主动展开。
- 影响: 最该被看到的可信度警告被隐藏，教师默认相信可能已损坏的数字。
- 修复方向: 默认展开；critical 常驻顶部横幅。

## F-INS-08 · 聚合路径遍布 take:200 静默截断
- 严重级: P1（规模化客观性）
- 证据: `insights.service.ts:164`、`weekly-insight.service.ts:315`、`instance-objective-stats.service.ts:101`、`scope-drilldown.service.ts:197` 均 `take:200`（按 gradedAt desc）。负载模型 500–2000 并发。
- 影响: 大班/高峰周，均分/薄弱/名单只反映最近 200 份，recency 偏且教师不知被截断。
- 修复方向: 聚合改用 DB 侧 `groupBy`/`aggregate` 全量算，或显式标注"仅统计最近 N 份"。

## F-INS-09 · KPI 均分与成绩分布直方图口径不一致
- 严重级: P1
- 证据: KPI `average(allScores)` submission-weighted（`:677`）；`computeScoreDistribution` 多任务分支先按生求均再分箱 student-weighted（`:844-853`）。算例 §5-B（80 vs 75）。
- 影响: 同一屏 KPI 数字与直方图重心不吻合。
- 修复方向: 二者统一 weighting，或明确标注两者含义不同。

## F-INS-10 · Study Buddy 分析两套实现、口径不一
- 严重级: P2
- 证据: `/api/lms/study-buddy/analytics/route.ts`（take 300、自有分组+AI 摘要 slice 120）与 `scope-insights.service.ts:228 getScopeStudyBuddySummary`（StudyBuddySummary 缓存 + 600 帖 + 模糊匹配 `:300`）并存。
- 影响: 两个入口的"高频问题/活跃学生"数可不一致；模糊匹配(前8字)易错配。
- 修复方向: 收敛为单一 service；匹配改用稳定键。

## F-INS-11 · 资产配置关键词分类误判风险
- 严重级: P2
- 证据: `sim-objective-stats.ts:124-131`，"基金"未明确偏股/货币时默认归 equity；关键词表硬编码。
- 影响: 权益敞口占比可能系统性偏高，误导"学生配置是否激进"的判断。
- 修复方向: 配置项带资产类别元数据，别靠标签猜；或标注"启发式分类"。

## F-INS-12 · mood 情绪：AI 生成当客观信号 + fallback 猜值 + 算了不渲染
- 严重级: P2
- 证据: `insights.service.ts:14-26` `moodKeyToScoreFallback` 硬编码中位猜测；moodTimeline 持久化到 `AnalysisReport.moodTimeline`，但 `/insights` 页未渲染（仅 task-performance-block/insights-tab）。
- 影响: 情绪曲线被当客观情绪波动展示，缺失点用猜值填充。
- 修复方向: 标注 mood 为 AI 推断；缺失点显式断点而非猜测填充。

## F-INS-13 · "退步"判定只比首末两次、无幅度阈值
- 严重级: P2
- 证据: `analytics-v2.service.ts:500-503`（improvement=latest−first，需≥2 次）、`:1514`（improvement<0 即标 declining）。
- 影响: 90→89.9 也被标"退步"进干预名单；忽略中间尝试的真实轨迹。
- 修复方向: 设幅度阈值（如降 ≥5 分）；用线性趋势而非仅首末。

## F-INS-14 · 实例 insights 为 quiz 计算 maxScore 退化到 100
- 严重级: P2（quiz 场景可 P1）
- 证据: `insights/route.ts:53` `maxScore = ΣscoringCriteria.maxPoints || 100`；quiz 无 scoringCriteria → 恒 100；`:66` 分布归一化 `score/100`。且业务逻辑内联在 Route Handler（三层违例）。
- 影响: quiz 实例分数分布归一化基准错误，分档失真。
- 修复方向: 用 `Submission.maxScore` 真值；业务逻辑下沉 service。

## F-INS-15 · ai-usage 成本聚合 take:10_000 静默低估
- 严重级: P2
- 证据: `ai-usage.service.ts:122` `take:10_000`；高频课程/长周期 succeeded 运行超 1 万时，顶部成本卡少算。
- 影响: 成本预算判断偏低。
- 修复方向: 用 DB 侧 `aggregate(_sum)` 而非取行求和。`runsWithoutCost` 诚实计数值得保留。

## F-INS-16 · commonIssues frequency 用 AI 返回值而非确定性计数
- 严重级: P2
- 证据: `scope-insights.service.ts:639` `frequency: issue.frequency`（AI 输出），而 fallback 分支用确定性 `items.length`（`:659`）。
- 影响: 展示的"N 人相关"频次可与实际证据条数不符。
- 修复方向: frequency 一律用 `matchedItems.length`。

---

*报告结束。审查者：audit-insights。仅只读，未改应用代码，未 seed/写 DB。*
