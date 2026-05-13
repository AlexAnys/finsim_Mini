# Stream C · 数据统计准确性 review (2026-05-13)

Reviewer: reviewer-data · 范围: analytics-v2.service, scope-insights, scope-drilldown, dashboard, weekly-insight, insights · 实测: Playwright + 直连 Postgres 对照

## 一、做了什么 / 看了什么

- 直连 `acc4fef29d82_finsim-postgres` 取真值: teacher1 名下 5 课程、2 班级 (A=10 学生, B=2 学生)、20 个 published 实例、24 份 submission (graded=22, submitted=2, released=11)；overdue+unreleased = 3 sub / 3 instance。
- Playwright 实测: 老师 dashboard、`/teacher/analytics-v2` (注：spec 给的 URL `/analytics-v2/dashboard` 是 404，真实路径无 `/dashboard` 后缀)、instance insights 两例 (无 sub / 有 sub)、KPI 4 卡 drilldown drawer、班级切换。
- 代码核对: KPI 5 个计算路径 (completionRate, avgNormalized, pendingRelease, riskChapter, riskStudent) + 缓存层 (scope 24h, weeklyInsight 7d 内存)。
- 截图: `.harness/screenshots/review-2026-05-13/data/01..09-*.png`。

## 二、好的发现 (验证为对)

1. **analytics-v2 KPI 数字对得上**: 默认 scope = "个人理财规划 + 金融2024B班"，完成率 50% (1/2) ✓、归一化均分 90% ✓、待发布 0 项 ✓ (B 班唯一实例 dueAt=2026-05-15 > today=05-13)、风险 1 章节 ✓。
2. **drilldown 1:1 KPI**: 点 "完成率" → drawer "未提交学生 · 1 人" 列出周八 (assigned=2, submitted=1, missing=1) ✓；"待发布" → drawer "0 件 · 当前范围内无待发布作业" ✓；"风险信号" → "风险章节 · 1 个" 列出理财基础概念 ✓。phase6 minor3 的 1:1 不变性成立。
3. **instance insights 实时正确**: 取 `57c9940b…家庭预算分析报告` 实测页面显示 `提交 4 / 批改 4 / 均分 67.8 / 最高 86 / 最低 48`，DB 真值 `subs=4, graded=4, avg_pct=67.75, score 范围 48-86` — 完全一致。该路径走 `insights.service.ts`，**实时从 Submission 表算**，不读 TaskInstanceAnalytics 缓存表。
4. **scope-insights 24h LLM 缓存不影响 KPI**: 阅 `scope-insights.service.ts:120 CACHE_TTL_MS`、`:151 cached.scopeSummary` — 24h 缓存只覆盖 LLM 生成的 `scopeSummary` 和教学建议文本；KPI 数字每次都过 `getAnalyticsV2Diagnosis()` 新算，不会因缓存读到陈旧数字。
5. **空态文案明确**: 待发布 0 时显示 "当前范围内无待发布作业" 而不是误导性 "无风险"；风险 0 时显示 "暂无数据"。
6. **未提交 vs 低分逻辑分离**: `scope-drilldown.service.ts:289 getRiskStudents` 用 `reason: not_submitted | low_score | declining` 三态，drawer 里能看出原因。

## 三、风险 / 问题 (按严重度)

### P0 — 老师 dashboard "学生数" 显示错误
`lib/utils/teacher-dashboard-transforms.ts:51-54`: `studentCount = max(ti.class._count.students)` — 取**最大**班级人数而非求和。teacher1 名下 A 班 10 + B 班 2 = **12 人**，dashboard 实测显示 "共 10 名学生"。班级越多越偏低，老师误以为少了。正确口径应该 `sum(distinct classIds → classSize)` 或基于 `classIds` set 重新查 User count。

### P0 — TaskInstanceAnalytics 表全空 → dashboard 多个卡片实际跑不出数
DB 真值: `SELECT COUNT(*) FROM TaskInstanceAnalytics` = **0 行**。grep 全仓 `analytics.upsert|create|update` 在 `lib/services/` 下 **零 producer**。但 `dashboard.service.ts:29` include `analytics: { avgScore, submissionCount }`，`teacher-dashboard-transforms.ts:65 buildKpiSummary` 的 `avgScore`、`weakInstanceCount`、`buildWeakInstances` 全部依赖该字段。结果：dashboard 实测显示 "薄弱任务 0 / 暂无薄弱任务"、"班级表现 → 暂无班级模拟分"，但 DB 中实际有 4 个实例均分 < 60。**整张 dashboard 的分析类小部件是死的**。要么写个 cron / submission 写 hook 维护 TaskInstanceAnalytics，要么这些卡片改成像 instance insights 那样实时 SELECT。

### P1 — dashboard 完成率 vs analytics-v2 完成率两套口径
- dashboard `computeCompletionRate` (`teacher-dashboard-transforms.ts:102`): `Σ min(subs, classSize) / Σ (classSize × instance)`。实测 11%。
- analytics-v2 (`analytics-v2.service.ts:676`): `submittedStudents (distinct) / assignedStudents`，按 instance 聚合再加总。实测 50% (B 班窄 scope)。

两个数字都"对"但口径不同，老师从 dashboard 跳到数据洞察会困惑 "为什么差 40 个百分点"。建议在分析数据上分别加 hover tooltip 说明分母口径，或者直接统一为 distinct-student 口径。

### P1 — pendingRelease 分母不一致
`analytics-v2.service.ts:698-721`: KPI `pendingReleaseCount` = 全量 `submission.count(releasedAt=null, dueAt<now)`；`pendingReleaseInstances` 只取 **distinct top 3 by dueAt**。drilldown `scope-drilldown.service.ts:221 getPendingReleaseList` 上限 `RESULT_LIMIT=50`。如果有 >50 待发布 sub，drilldown 列表会被截断而 KPI 数字继续涨，1:1 不变性破。当前数据规模 (3 sub) 不触发，但作为代码 review 应该补 "查看全部" 链接或对齐分页。

### P1 — weeklyInsight 7 天进程内缓存可能出错过时数据
`weekly-insight.service.ts:85 CACHE_TTL_MS = 7*24h`、`:86 const cache = new Map<>`。该缓存：(a) 7 天后才过期，(b) 没有 grade/submission 写入时的失效，(c) 仅进程内 (重启即失)。dashboard "一周洞察 modal" 走该路径。最坏情况：周一生成后，本周内所有新增 graded sub 都不会反映到洞察文本里。dashboard 页面有 `force=true` 按钮 (page.tsx:218) 用户可手动 refresh，但默认体验是"看的是上周快照"。

### P2 — analytics-v2 默认 scope 选 B 班 (2 学生) 容易给出错觉
实测 `/teacher/analytics-v2` 默认显示 "个人理财规划 · 金融2024B班"，那里只有 1 sub / 2 学生。完成率、均分、风险数据样本极小 (n=1)。`dataQualityFlags` 里给了"信息 2 项"的提示，但首屏 KPI 仍以 50%/90% 大字呈现，老师容易当成全局指标。建议默认 scope 选 "全部班级" 或样本量最大的课程。

### P3 — 风险 KPI 卡显示 "1 章节 | 1 学生"，drawer 只看到 "风险章节" tab
KPI 风险卡显示组合数 `1 章节 | 1 学生`，但点开 drawer 标题是 `风险章节 · 1 个`，drawer 内没有 "切到学生 tab" 的 toggle 可见。`scope-drilldown.service.ts` 有独立的 `getRiskStudents`，但 drawer UI 未提供切换路径 (至少在此 viewport 没看到)。若设计本意是合并查看，则需把章节与学生条目并列在同 drawer。

### P3 — instance insights `taskInstanceId` 全 0 sub 的零态没有 CTA
实测 `ca3b34d3-…理财基础知识随堂测验` 显示 `提交 0 / 已批改 0 / 均分 0 / 0 (空分布)`。零态信息 OK，但缺乏 "去查看任务详情 / 提醒学生" 的 CTA，老师不知道下一步该做啥。

## 四、建议优先级

| # | 修复 | 影响 | 工作量 |
|---|------|------|--------|
| 1 | dashboard 学生总数取 sum 而非 max (`teacher-dashboard-transforms.ts:51-54`) | P0 信任度 | <1h |
| 2 | 决定 `TaskInstanceAnalytics`：要么补 producer (在 `grading.service.ts` finalize 时 upsert)；要么删表 + dashboard 改成实时 SELECT | P0 数据可见性 | 1d |
| 3 | dashboard 与 analytics-v2 完成率口径统一，或加 tooltip 说明分母 | P1 一致性 | 0.5d |
| 4 | pendingRelease drilldown 加 "查看全部" 或分页 | P1 1:1 不变性 | 0.5d |
| 5 | weeklyInsight 改为 30 min 缓存 + grade-hook 失效，或在 UI 显著标注 "本周快照截止 XX 时刻" | P1 体感 | 0.5d |
| 6 | analytics-v2 默认 scope 选样本最大的班，或显示"样本量低"水印 | P2 误读 | 1h |
| 7 | 风险 drawer 加 章节↔学生 tab 切换 | P3 可达性 | 0.5d |

## 五、未触达 (时间所限)

- 缓存命中刷新：未触发一次 study-buddy / scope-insights 重生成对比 fresh vs cache 差值。
- 多老师隔离：只测 teacher1，没验证 teacher2 数据是否会泄露到 teacher1 视图。
- `analytics-v2.service.ts:1218` `kpis.completionRate > 1` 守卫意味着代码自己也担心溢出 — 没在数据集中复现到这个 edge case。

参考截图: `.harness/screenshots/review-2026-05-13/data/{01..09}-*.png`
测试脚本: `tests/e2e/review-data.spec.ts`、`tests/e2e/review-data-final.spec.ts`
