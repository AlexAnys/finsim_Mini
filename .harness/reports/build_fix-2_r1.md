# Build report — Fix 2 (TaskInstanceAnalytics live) · r1

- **Worktree**：`finsim-wt-dashboard`
- **分支**：`claude-fix-batch1-dashboard`
- **基线 commit**：`c91e46b`（Fix 1）
- **本次 commit**：`c2457bd` — `fix(dashboard): compute task analytics live from submissions`
- **改动文件**：
  - `lib/services/dashboard.service.ts`（+64/-2）
  - `tests/teacher-dashboard.test.ts`（+52/-0）
- **总 diff**：116 insertions / 2 deletions — 低于 150 行上限

## 根因

`TaskInstanceAnalytics` 表全仓 0 producer：

```sh
grep -rn "analytics.upsert\|analytics.create\|analytics.update" lib/services/  # → empty
```

DB 验证：`SELECT COUNT(*) FROM "TaskInstanceAnalytics"` = **0 行**。但 `dashboard.service.ts:29` 通过 Prisma include 把它读出来，永远拿到 `null`，导致下游 transforms 全部失效：
- `buildKpiSummary.avgScore` → null
- `buildWeakInstances` → []（"暂无薄弱任务"）
- `buildClassPerformance` → []（"暂无班级模拟分"）
- `buildCourseClassPerformance` → 课程下班级对比无数据

而 DB 里 teacher1 scope 有 23 条 graded submission，13 个 instance 有真实均分，7 个均分 <60（应作为"薄弱任务"列出）。

## 修复

1. **删** `dashboard.service.ts:29` 的 `analytics: { select: { avgScore: true, submissionCount: true } }` include（停止从死表读）。
2. **加** `computeLiveAnalytics(instanceIds: string[])` 帮手函数：
   - 一次 `prisma.submission.findMany` 拉取这批 instance 的 graded submissions（only `taskInstanceId/score/maxScore` 三字段，最少读）
   - 用 analytics-v2.service.ts 里已经 export 的 `normalizeScore`（`(score/maxScore)*100`，与 insights 同口径）算每条归一化均分
   - 按 instanceId 分组 → 每组取算术平均 → 返回 `Map<instanceId, { avgScore, submissionCount }>`
3. **回填** taskInstances（同名 `analytics` 字段），让下游 transforms 0 改动即生效。

```ts
const liveAnalytics = await computeLiveAnalytics(taskInstances.map((ti) => ti.id));
const taskInstancesWithAnalytics = taskInstances.map((ti) => ({
  ...ti,
  analytics: liveAnalytics.get(ti.id) ?? null,
}));
```

**未触碰**：
- schema.prisma 不动（无三步铁律风险）— `TaskInstanceAnalytics` 表暂留，但 dashboard 不再依赖它
- `teacher-dashboard-transforms.ts` 不动（input 形状不变）
- `teacher-courses-transforms.ts` 不动（同样消费 `analytics.avgScore`，自动从 live 数据受益）
- `insights.service.ts` / `analytics-v2.service.ts` 不动（自己路径已是 live）

## DB 真值对账

```sql
-- teacher1 scope graded subs（dashboard.service 同样的 OR 逻辑）
WITH teacher_subs AS (
  SELECT s.id, s."taskInstanceId", s.score, s."maxScore", s.status
  FROM "Submission" s
  JOIN "TaskInstance" ti ON ti.id = s."taskInstanceId"
  LEFT JOIN "Course" co ON co.id = ti."courseId"
  WHERE (ti."createdBy" = (SELECT id FROM "User" WHERE email='teacher1@finsim.edu.cn')
      OR co."createdBy" = (SELECT id FROM "User" WHERE email='teacher1@finsim.edu.cn'))
  AND s.status='graded' AND s.score IS NOT NULL AND s."maxScore" > 0
)
SELECT COUNT(*), ROUND(AVG((score::float/"maxScore"::float)*100)::numeric, 2) FROM teacher_subs;
-- → 23 条 / overall avg 58.06%
```

Per-instance（实测 13 行）：

| instance | DB 均分(%) | API 返回 analytics.avgScore | 一致？ |
|---|---|---|---|
| 449ae28c（理财基础概念测验） | 0.00 | 0.00 | ✅ |
| d8099300 | 20.00 | 20.00 | ✅ |
| f1494008 | 25.00 | 25.00 | ✅ |
| b7ca71ef（风险收益基础测验） | 45.00 | 45.00 | ✅ |
| 00000000…a602 | 55.00 | 55.00 | ✅ |
| e34afdc0 | 56.00 | 56.00 | ✅ |
| 00000000…a603 | 56.67 | 56.70 | ✅（rounding） |
| 00000000…a601 | 67.50 | 67.50 | ✅ |
| 57c9940b（家庭预算分析报告） | 67.75 | 67.75 | ✅（与 instance insights 一致） |
| c0c0c1e5（客户风险沟通模拟） | 72.00 | 72.00 | ✅ |
| a5d8f119 | 73.00 | 73.00 | ✅ |
| 483fbaf6 | 85.71 | 85.70 | ✅（rounding） |
| 00000000…b601（B 班独立测验） | 90.00 | 90.00 | ✅ |

**全 13 个 instance 一致**（仅 rounding 误差 ≤0.05）。

## 实测（dev server PORT=3001 webpack 模式 + curl）

- `/api/lms/dashboard/summary` 返回 23 个 taskInstances，13 个有 `analytics` 字段（其余 10 个无 graded sub → analytics=null，符合预期）
- `buildWeakInstances` 上来后将列出 **6 个 weak 任务**（排除 avg=0 的 449ae28c，因为 transform 的 `n > 0` 过滤；与旧行为一致）：
  - b7ca71ef avg=45.00
  - 00000000…a602 avg=55.00
  - 00000000…a603 avg=56.70
  - d8099300 avg=20.00
  - f1494008 avg=25.00
  - e34afdc0 avg=56.00
- `buildKpiSummary.avgScore` 将变成 **59.47**（12 个 scored 实例的算术平均，排除 avg=0 那一条；老逻辑就是这么过滤的）

## 性能

```
curl /api/lms/dashboard/summary
  request 1: total=0.232s (cold + Next.js compile)
  request 2: total=0.067s
  request 3: total=0.034s
```

远低于 spec 给的 **≤1.7s** 退化阈值（baseline 0.82s 的 2x），且实际比 baseline 还快（多 1 次 findMany，但去掉了 analytics include 的 JOIN 也省了一点）。

## 测试

- 单测加 4 条 case 在 `tests/teacher-dashboard.test.ts`：
  1. `"does not include the dead TaskInstanceAnalytics relation in the findMany include"` — 确认死 include 已删
  2. `"attaches live analytics (avgScore + submissionCount) computed from graded submissions"` — 端到端 mock：ti-A (80, 60) → avg=70 count=2；ti-B (5/10) → avg=50 count=1；ti-C 无 sub → analytics=null
  3. `"scopes live analytics query to the returned instance ids only"` — 确认查询限定到 `taskInstanceId.in` + `status='graded'`，不读跨老师范围
  4. 既有 2 个 test（OR scope / draftCount-publishedCount）继续通过
- `npx tsc --noEmit` → 0 error
- `npx vitest run` → 74 files / **877 tests 全过**（baseline 874 + 3 new = 877，且既有 dashboard-formatters/dashboard.service/teacher-dashboard-transforms 全过）
- `npm run lint` → 0 error / 3 pre-existing warning

## Anti-regression 检查（CLAUDE.md）

- ✅ 只改与 fix 相关的 2 文件（service + service test），未触碰 transforms 或业务无关
- ✅ Service interface 未改（`getTeacherDashboard(teacherId)` 签名 + return shape 兼容；`taskInstances[].analytics` 同名字段、同 `{ avgScore: number|null, submissionCount: number }` 形状）
- ✅ 下游 consumer 0 改动：`teacher-dashboard-transforms.ts`、`teacher-courses-transforms.ts`、`app/teacher/dashboard/page.tsx`、`app/teacher/courses/page.tsx` 全不动
- ✅ 中文 UI 文案无变化（数据驱动，UI 自然渲染真值）
- ✅ Diff 116 lines（< 150）
- ✅ Bug fix rule（rule 7）：只动 dashboard.service 入口 + 一处实时聚合 helper，无 drive-by
- ✅ Prisma schema 未动（无三步铁律风险）
- ✅ Fix 1 不被回滚（buildKpiSummary studentCount sum 逻辑保留）
- ✅ Mimo reasoning param fix（da9a505）不被回滚

## 给 QA 的关键验证点

1. **DB 真值对账**：上述 13 个 instance 均分（看报告表格）vs `/api/lms/dashboard/summary` 返回的 `taskInstances[].analytics.avgScore`，逐条对齐。
2. **真浏览器 teacher1 `/teacher/dashboard`**：
   - "薄弱任务"卡片：应**有 6 个条目**（baseline 0 → 修复后 6）
   - "班级表现"图：应**有真实数据**（baseline 空 → 修复后有 A 班 / B 班均分柱状）
   - KPI 卡 "均分" 应**显示 59.47**（baseline null → 修复后 59.5）
3. **回归**：Fix 1 的 "12 名学生" 不能掉
4. **性能**：dashboard 首屏加载 ≤ 1.7s（实测 ~250ms）
5. **代码独立 review**：
   - 确认 `dashboard.service.ts:29` 的 `analytics: { select: ... }` include 已删
   - 确认 `computeLiveAnalytics` 用 `taskInstanceId.in` scope（不会跨老师泄露）
   - 确认 transforms 文件未被改

## 已知边界

- avg=0 的 instance（449ae28c）不出现在 "薄弱任务" 列表中，因为 `buildWeakInstances.ts:460-461` 过滤 `n > 0`。这是**保留旧行为**（旧 analytics 也会被同样过滤），未来若想把"0 分"也列为 weak 需单独拍板。
- `TaskInstanceAnalytics` 表保留，不删 schema（spec 明确"不要做 schema migration，避免触发同步点"）。后续可单独 PR 删表 / 删 model relation。

## 后续

Worktree A 的两个 fix 全部 PASS 后，会 SendMessage team-lead 报告完工状态等 integration。
