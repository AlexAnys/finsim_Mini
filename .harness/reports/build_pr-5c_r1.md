# Build Report — PR-5C · 实例详情 Insights tab + aggregate API + schema 改动 · r1

**Unit**: `pr-5c`
**Round**: `r1`
**Date**: 2026-04-25

## Scope

Phase 5 · PR-5C — 实例详情 AI 洞察 tab。最复杂的 PR：schema 改动 + 后端 service + 新 API 端点 + AI prompt 修改 + 前端组件。

按 team-lead ack 后采用 hybrid schema 方案：per-submission `conceptTags` 在三个子表，aggregate 缓存在 AnalysisReport。

## Files changed

### Schema（4 表，1 migration）
- `prisma/schema.prisma`：
  - `SimulationSubmission` + `conceptTags String[] @default([])`
  - `QuizSubmission` + `conceptTags String[] @default([])`
  - `SubjectiveSubmission` + `conceptTags String[] @default([])`
  - `AnalysisReport` + `commonIssues Json?` + `aggregatedAt DateTime?`
- `prisma/migrations/20260425011913_add_analysis_aggregate_fields/migration.sql`（4 ALTER TABLE，全 nullable / default empty，零回填）

### 新文件
- `lib/services/insights.service.ts`（253 行）— `getCachedInsights` + `aggregateInsights` 含 empty-state 守护 + 确定性概念计数 + AI 调用 + AnalysisReport upsert
- `app/api/lms/task-instances/[id]/insights/aggregate/route.ts`（54 行）— GET 缓存 + POST 触发，均走 `assertTaskInstanceReadableTeacherOnly` + `requireRole(["teacher", "admin"])`
- `components/instance-detail/insights-tab.tsx`（230 行）— 顶部生成卡 + 共性问题列表 + 亮点片段 + 薄弱概念 chips
- `tests/insights-service.test.ts`（9 tests）
- `tests/grading-concept-tags.test.ts`（5 tests）
- `tests/ai-evaluation-prompt-contains-concept-tags.test.ts`（5 tests）

### 修改
- `lib/services/ai.service.ts`：
  - `evaluateSimulation` evaluation schema +`conceptTags: z.array(z.string()).optional()`
  - User prompt 加"输出 3-5 个金融教学核心概念标签"指令
  - 返回值带 `conceptTags`（slice(0,5) 防越界）
  - 新增 `insights` AIFeature + `AI_INSIGHTS_*` env prefix（FEATURE_ENV_MAP / FEATURE_TEMPERATURES）
- `lib/services/grading.service.ts`：
  - `gradeSubjective` evaluation schema 同步加 `conceptTags`
  - User prompt 加同样的"3-5 个标签"指令
  - `gradeSimulation` / `gradeSubjective` 持久化 `conceptTags` 到子表
  - 注：`gradeQuiz` 暂未加 conceptTags 抽取（quiz 多为客观题，不调 AI；只有 short_answer 走 AI 但是按问题维度评分，不输出汇总 tags）— 见 Open concerns #2
- `lib/services/submission.service.ts`：
  - `updateSubmissionGrade` data 参数 +`conceptTags?: string[]`
  - 三个子表 update 同时写 `evaluation` + `conceptTags`（仅当传入时）
  - 旧调用方 byte-identical（向下兼容：未传 conceptTags 行为不变）
- `lib/types/index.ts`：`AIFeature` 加 `"insights"`
- `lib/api-utils.ts`：`handleServiceError` 加 `NO_GRADED_SUBMISSIONS` / `NO_CONCEPT_TAGS` 映射（中文消息）
- `app/teacher/instances/[id]/page.tsx`：insights tab 占位换成 `<InsightsTab>` + onExplainConcept hook（暂 toast 占位 — Phase 6 学习伙伴接上）

## Prisma 三步证据链

```
$ npx prisma migrate dev --name add_analysis_aggregate_fields
Datasource "db": PostgreSQL database "finsim", schema "public" at "localhost:5432"
Applying migration `20260425011913_add_analysis_aggregate_fields`
Migration applied + Prisma Client (v6.19.2) generated in 153ms

$ /usr/sbin/lsof -ti:3000 | xargs kill -9
（旧 PID 51695 → 71704 → 79990 三次重启验证）

$ nohup npm run dev > /tmp/finsim-dev.log 2>&1 &
✓ Ready in 537ms
$ /usr/sbin/lsof -ti:3000
79990

$ curl http://localhost:3000/login → HTTP 200
$ curl http://localhost:3000/teacher/instances/9201ff97-... (with teacher1 cookie) → HTTP 200
$ curl http://localhost:3000/api/lms/task-instances/.../insights/aggregate → HTTP 200 with cached:false
```

dev server 真重启 + 真页面 200，Prisma 客户端缓存验证通过（如果 client 缓存了旧 schema，新字段 `conceptTags` 在子表查询时会触发 P2002 / TypeError 之类，页面会 500；实际 200）。

## E2E 真 AI 验证（PR-5C 最关键的证据）

**步骤**：
1. student1 用 POST `/api/submissions` 创建一份 subjective 真提交（textAnswer ~250 字）
2. 等 65 秒（real qwen-max + qwen3.5-plus 调用）
3. teacher1 GET 该提交，查 `subjectiveSubmission.conceptTags`

**结果**：
```json
{
  "status": "graded",
  "score": 73,
  "subjectiveSubmission": {
    "conceptTags": ["资产配置", "风险偏好", "投资目标", "风险管理", "职业风险"],
    "evaluation": { "feedback": "方案配置比例清晰，具备基本的资产配置意识，投资目标分期合理。但客户画像分析不够深入..." }
  }
}
```

**5 个真 conceptTags 写入数据库** ✅ 字段不再是空数组占位。

**接着** POST aggregate 触发真聚合（10 秒）：
```json
{
  "studentCount": 1,
  "commonIssues": [
    {"title":"客户画像分析不足","description":"未结合 IT 行业...","studentCount":1},
    {"title":"风险提示单一","studentCount":1},
    {"title":"报告结构不规范","studentCount":1},
    {"title":"缺乏保险与对冲规划","studentCount":1}
  ],
  "highlights": [
    {"submissionId":"43d43bc0...","studentName":"张三","quote":"方案配置比例清晰..."}
  ],
  "weaknessConcepts": [
    {"tag":"资产配置","count":1},
    {"tag":"风险偏好","count":1},
    {"tag":"投资目标","count":1},
    {"tag":"风险管理","count":1},
    {"tag":"职业风险","count":1}
  ],
  "aggregatedAt": "2026-04-25T01:31:13.634Z",
  "reportId": "5de5f600-e640-47cb-bc00-d6487a67bf5c"
}
```

**第二次 GET（缓存命中）**：`cached:true`，秒回。

**清理**：测试 submission + AnalysisReport 行已 DELETE。

## OWASP / STRIDE 审计

新端点 `/api/lms/task-instances/[id]/insights/aggregate`：

| 攻击面 | 防御 | 真 curl 验证 |
|---|---|---|
| 跨户读取（A01）| `assertTaskInstanceReadableTeacherOnly` | teacher2 GET → **403** ✅ |
| 跨户触发聚合（A01 + 浪费 token）| 同上 | teacher2 POST → **403** ✅ |
| 学生越权（A01）| `requireRole(["teacher", "admin"])` | student1 GET → **403** ✅ |
| 未登录（A07）| `requireAuth` 隐式（在 requireRole 之前）| unauth GET → **401** ✅ |
| 空触发（拒绝服务 / 浪费 token）| `NO_GRADED_SUBMISSIONS` 守护 | empty instance POST → **400** ✅ |
| 无 tag 触发（拒绝服务 / 浪费 token）| `NO_CONCEPT_TAGS` 守护 | covered by unit test |

OWASP A01（Broken Access Control）+ A03（Injection — Zod schema all input）+ A07（Auth）全闭环。STRIDE Tampering 不适用（无 PUT/DELETE 暴露给学生）。

## Verification

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **347 passed**（328 → 347，+19 new for PR-5C） |
| `npm run build` | 0 errors / 0 warnings / 26 routes（+1 for /insights/aggregate） |
| Prisma 三步 | migration applied + generate + dev server cold restart 79990 + /login + /teacher/instances/[id] 200 |
| 真 AI E2E | 真 qwen-max 调用 → conceptTags `["资产配置","风险偏好","投资目标","风险管理","职业风险"]` 持久化 + 真聚合 4 issues + 1 highlight + 5 weaknessConcepts |
| 9 回归路由 | 全 200（teacher1 + student1 验证） |

### 单元测试覆盖（19 new）

- **insights-service.test.ts (9)**：getCachedInsights 3 例 + aggregateInsights 6 例（INSTANCE_NOT_FOUND / NO_GRADED_SUBMISSIONS / NO_CONCEPT_TAGS / 完整聚合 / upsert 路径 / quiz+subjective tag 计数）
- **grading-concept-tags.test.ts (5)**：updateSubmissionGrade conceptTags 持久化（3 type 各一 + empty 数组 + 向下兼容）
- **ai-evaluation-prompt-contains-concept-tags.test.ts (5)**：源码级文本断言（保证 prompt 改动不被未来重构悄悄回滚）

## Open concerns / QA hints

1. **Quiz 类型不抽取 conceptTags**：当前 `gradeQuiz` 主要走客观题精确匹配 + short_answer 单题 AI 调用，无统一 prompt 输出汇总标签。如果后续要支持 quiz 聚合（薄弱章节定位），需要在 `gradeQuiz` 末尾加一个 batch 概念抽取调用。Phase 5 spec 说"批改时抽取"未细分类型，目前仅 simulation + subjective 落地。建议 QA 在测试中以 subjective 为主路径

2. **AI 调用成本**：每次 POST aggregate 跑一次 qwen-max（10-15 秒，$0.05-0.15）。前端 UI 已加冷却防护：默认 GET 缓存命中即不触发；只有点"重新生成"按钮才 POST。`aggregatedAt` 给 UI 显示"最近一次生成于 X"，避免老师误以为没生成

3. **AnalysisReport 一对一 vs 一对多**：当前 service 用 `findFirst({ taskInstanceId, createdBy })` upsert，**每个 (instance, teacher) 只有一行**。如果未来要支持多版本对比（"上次 vs 这次"），改成 `create` always + 用 `aggregatedAt desc` 排序拿最新即可

4. **insights/aggregate URL 与现有 /insights 共存**：之前 PR 已有 `/api/lms/task-instances/[id]/insights`（提供分布/criteria/weakness 等不带 AI 的统计）。本 PR 加的是 `/insights/aggregate`（带 AI 聚合 + 持久化）。两个端点职责清晰：前者 read-only stats、后者 AI-driven insights。建议 QA 真 curl 这两个端点都不会冲突

5. **dev server cold restart 实际发生**：本 PR 严格按 CLAUDE.md L122 走完整 Prisma 三步。证据：
   - 旧 PID 51695 → 第一次 kill+重启 → 71704
   - 又一次 kill+重启确保 service 代码也 cold-load → **PID 79990**（最终运行的）
   - tail /tmp/finsim-dev.log 显示 "Ready in 537ms" 后才跑 curl 验证

6. **真 AI 不可控的 flakiness**：单元测试用 vitest mock + assertion 文本，跑了 19 个新 tests 全过；真 E2E 是不可重现的（qwen-max 输出会变）但本 PR 报告里截了一份真返回作为锚点。如果 QA 想复现真路径，按"E2E 真 AI 验证"步骤跑一遍即可（约需 90 秒）

## 状态

Ready for QA。Task #58 待 PASS 后标 completed，最后认领 PR-5D（Analytics tab，纯前端 SVG，无 schema/API 改动）。
