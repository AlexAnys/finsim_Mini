# Spec — Codex 深度审查 27 finding 全修（2026-04-26）

## Coordinator review 结论

我对 27 条 finding 逐条 review，判定：
- **22 条真问题**（必须修）
- **5 条部分真**（含 UX 决策项 → 给用户拍板）
- **0 条 false positive**（codex GPT-5.5/xhigh 0 误报，质量极高）

## 真问题清单（按批次组织）

### Batch A · 纯安全（API guard，9 条）— **直接修**

| ID | 文件 | 修法 |
|---|---|---|
| A1 | `app/api/lms/task-instances/route.ts:18` | POST 加 `assertTaskReadable(taskId)` + `assertCourseAccess(courseId)` + 验证 classId∈courseId |
| A2 | `app/api/submissions/route.ts:23` | POST 必填 taskInstanceId + `assertTaskInstanceReadable` + 派生 taskId/taskType（不信任客户端） |
| A3 | `app/api/lms/content-blocks/[id]/markdown/route.ts:28` | 改为按 path `[id]` block 反查真 courseId，或按 body.sectionId 反查 → `assertSectionWritable` |
| A4 | `app/api/lms/chapters/route.ts:24` | POST 加 `assertCourseAccess(courseId)` |
| A5 | `app/api/lms/sections/route.ts:25` | POST 加 `assertCourseAccess(courseId)` + 验证 chapterId.courseId === courseId |
| A6 | `app/api/lms/announcements/route.ts:54` | teacher 角色：传 courseId 时也走 `assertCourseAccess`，不只在没传时加 teacherId |
| A7 | `app/api/lms/schedule-slots/route.ts:29` | POST/查询：传 courseId 时 `assertCourseAccess` |
| A8 | `app/api/lms/task-instances/[id]/insights/aggregate/route.ts:55` | POST 先读 cache + freshness（< 5min 直接返回 cache） + force=true 才重跑 + per-instance Mutex（避免并发刷 token） |
| A9 | `app/api/ai/chat/route.ts:7` | 加 transcript 长度上限（≤50 条/单条 ≤2000 字符）+ scenario/systemPrompt ≤4000 字符 + 服务端只保留最近 N 轮 |

### Batch B · AI 实现 + 数据模型（7 条）— **直接修**

| ID | 文件 | 修法 |
|---|---|---|
| B1 | `lib/services/ai.service.ts:365` | hint 节流：服务端用 transcript 推导 lastHintTurn（不信任客户端 optional 字段）+ 服务端校验 0≤lastHintTurn≤currentTurn |
| B2 | `lib/services/ai.service.ts:237` | mood_label 改 `z.enum([...8 labels])`，非法降级到 NEUTRAL key 时同步重写 label 字段 |
| B3 | `lib/services/insights.service.ts:82` | aggregateSchema 数组 `.default([])` + AI 失败时仍保存 weaknessConcepts + 空 issues/highlights |
| B4 | `app/api/ai/evaluate/route.ts:20` | assets schema 加 snapshots 字段（复用 assetAllocationSchema）防 zod strip |
| B5 | `lib/validators/submission.schema.ts:49` | snapshots 数组 `.max(20)` + 单 snapshot allocations max 20 项 |
| B6 | `prisma/schema.prisma` AnalysisReport | 加 `@@unique([taskInstanceId])` + insights.service 改 `prisma.analysisReport.upsert`（替换 findFirst+create/update） |
| B7 | `prisma/schema.prisma` Submission/AnalysisReport.taskInstance | 改 `onDelete: Cascade`（**B7 实际是 UX/产品决策项，见底部 UX 列表**）|

### Batch C · 前端 + 纪律（5 条）— **直接修**

| ID | 文件 | 修法 |
|---|---|---|
| C1 | `app/api/submissions/[id]/grade/route.ts:33` | manualGradeSchema 加 feedback + rubricBreakdown，updateSubmissionGrade 接收 evaluation 字段并 merge 到现有 evaluation |
| C2 | `components/simulation/simulation-runner.tsx:195` | allocationSubmitCount 从 `snapshots.length` 派生（不维护独立 state），按钮 disabled 用 `snapshots.length >= maxSubmissions` |
| C3 | `components/teacher-course-edit/block-edit-panel.tsx:208` | SectionOverview 加 `key={section.sectionId}`（切换小节自动 reset 编辑态） |
| C4 | `lib/services/ai.service.ts` evaluation prompt | conceptTags 输出指令 + grading.service.ts 解析写入（覆盖 simulation/quiz/subjective 三类） |
| C5 | `lib/services/insights.service.ts` aggregate fallback | 当所有 submission 都无 conceptTags 时，不抛 NO_CONCEPT_TAGS，转为生成空 weaknessConcepts + 仍跑 commonIssues/highlights |

### Batch D · 部分真（部分需要 UX 决策，部分纯技术）

| ID | 文件 | 我的判定 |
|---|---|---|
| D1 | `app/teacher/tasks/new/page.tsx:404` 旧 5 档 [MOOD:] prompt | **纯技术**：清掉旧指令（与 PR-7B 8 档 JSON 协议保持一致）— 直接修 |
| D2 | `app/api/ai/evaluate/route.ts` 客户端传 systemPrompt | **部分真**：现有架构教师向导预览依赖。修法：教师 role 允许 + 学生 role 拒绝 + 长度上限。算半 UX 决策 |
| D3 | `app/api/lms/task-instances/[id]/insights/route.ts:21` route 含业务 | **架构重构**：迁 service 层，标 P3 后做（不阻塞） |
| D4 | `app/api/lms/content-blocks/route.ts:21` ContentBlock.data Zod | **优化**：discriminated schema by blockType。可分 PR 做，标 P3 |
| D5 | `lib/services/audit.service.ts` audit 默认关 | **运维权衡**：建议安全敏感写不依赖开关强制写（小改 ~30 行），标 P3 |

### UX / 产品决策（5 条 → 给用户拍板）

详见底部 §UX 决策列表

## 修复路线（5 PR 拆分）

- **PR-FIX-1 · Batch A 安全 9 条**（~600 行）— 9 个 route 加 guard + 7-10 新 tests
- **PR-FIX-2 · Batch B AI/数据 7 条**（~400 行 + schema 改 1 次）— 含 Prisma 三步
- **PR-FIX-3 · Batch C 前端 5 条**（~250 行）— grade route 扩展 + UI 状态修
- **PR-FIX-4 · D1（旧 MOOD prompt 清理）**（~30 行）— 纯模板字符串改
- **PR-FIX-5 · UX 决策项**（待用户回复）

预计 4 PR + 1 等用户 = 总 ~1300 行 + 35 新 tests。

## UX 决策列表（用户拍板）

每条**给我的推荐**，用户回 "全走推荐" 或针对某条覆盖。

### UX1 · TaskInstance 删除是否级联 Submission/AnalysisReport？

- **推荐：不级联**（onDelete: SET NULL，保留历史成绩） + aggregate/查询时 filter null
- 替代：级联（彻底清理 + 减少孤儿数据）
- 影响：教育平台学生历史成绩通常重要，老师删任务不应该清学生记录

### UX2 · 批量批改"下一份"按钮是否限定在 selected ids？

- **推荐：按 selected ids**（教师选 A C 不应跳到 B）
- 替代：自动跳到全列表下一未批改（当前行为）
- 影响：批量批改流程明确性

### UX3 · 全选 checkbox 语义？

- **推荐：只选未批改 + checkbox 显示"全选未批改"**（当前 toggleSelectAll 已实现这逻辑，只是 checked 状态判定不一致）
- 替代：含已批改全选（用于"批量重批"场景）
- 影响：UX 一致性

### UX4 · AI chat 学生客户端 system prompt 限制？

- **推荐：学生 role 拒绝传 systemPrompt（403）+ 教师 preview 模式允许**
- 替代：完全禁用（教师向导预览功能受影响）
- 影响：教师向导"预览模拟对话"功能可能需要改为服务端读 task config（更安全但实施成本高）

### UX5 · Audit log 强制写？

- **推荐：安全敏感写（DELETE/PATCH course/chapter/section/contentBlock + grade）强制写 audit，不依赖 ENABLE_AUDIT_LOGS env**
- 替代：保持现状（运维灵活）
- 影响：增加少量 DB 写，但满足合规追责需求

## 执行策略

- 单 team `finsim-codex-fix`，fresh agents `builder-fix` + `qa-fix`
- Task 链：PR-FIX-1 → 2 → 3 → 4，串行
- 每 PR PASS auto-commit
- UX 决策项 user 回复后单独再开 PR-FIX-5

## Acceptance（每 PR）

- tsc 0 / 全 vitest 绿（新增 tests 覆盖每条 fix）
- build 过
- 真 curl E2E 验证关键 guard / cascade / 缓存
- /cso 安全审计无新 High/Critical
- 学生 + 教师所有路由真登录 200 无回归（沿用 Phase 4-7 的 cookie session pattern）

## Phase 8 软结尾后续

D3 / D4 / D5 + 其他 P2 优化级，单独 increment PR 做。
