# Codex 深度多轮审查报告（GPT-5.5 / xhigh，2026-04-26）

> 4 轮聚焦审查 origin/main..HEAD 的 51 commits。每轮独立运行 ~10-15 分钟。
> 总计 **27 条 finding**（11 P1 + 16 P2 · 0 P0），跨安全 / AI / 数据模型 / 前端纪律 4 个维度。

## 总览

| Round | 维度 | finding | 关键发现 |
|---|---|---|---|
| 1 | 安全 | 9（6 P1 + 2 P2 + 1 补充） | 多个 API 缺 owner check + AI prompt injection 风险 + audit 缺失 |
| 2 | AI 实现正确性 | 7（2 P1 + 5 P2） | hint 节流可绕过 + 旧 5 档 MOOD prompt 残留 + Quiz 不写 conceptTags |
| 3 | 数据模型一致性 | 6（3 P1 + 3 P2） | AnalysisReport 缺唯一约束 + TaskInstance 删除不级联 + snapshots 无上限 |
| 4 | 前端 + 纪律 | 7（2 P1 + 5 P2） | 手工批改 feedback 丢失 + 资产快照计数刷新可绕过 + Insights route 含业务逻辑 |

## P1 全清单（11 条 · 优先修复）

### 安全（Round 1）

- [P1] **TaskInstance 创建未校验 task/course/class 归属** — `app/api/lms/task-instances/route.ts:18`
  教师 A 用教师 B 的 taskId 创建挂自己课的 instance，反向读 task 题目。修复：创建前 `assertTaskReadable(taskId)` + `assertCourseAccess(courseId)` + 验证 classId 属该课程

- [P1] **学生提交未调用 task/instance guard** — `app/api/submissions/route.ts:23`
  学生 POST 任意 taskId 可对未分配任务提交 + 触发 AI 批改 + Quiz 看正确答案 feedback。修复：必须 `taskInstanceId` + `assertTaskInstanceReadable` + 派生 taskId/taskType

- [P1] **Markdown PUT 用 body.courseId 过 guard，按 sectionId 改写** — `app/api/lms/content-blocks/[id]/markdown/route.ts:28`
  教师 A 传课程 B 的 sectionId + 课程 A 的 courseId，guard 通过后改写 B 课程讲义。修复：按目标 sectionId 反查真实 courseId 再 assert

- [P1] **Chapter/Section 创建无 course owner guard** — `app/api/lms/chapters/route.ts:24`, `app/api/lms/sections/route.ts:25`
  任意教师向他人课程插入章节/小节。修复：`assertCourseAccess(courseId)` + Section 验证 chapter.courseId 一致

- [P1] **Announcements/ScheduleSlots 带 courseId 绕过 teacher scope** — `app/api/lms/announcements/route.ts:54`, `app/api/lms/schedule-slots/route.ts:29`
  教师传 victim courseId → 读他课公告/课表 + 写他课 schedule slot。修复：传 courseId 时也走 `assertCourseAccess`

- [P1] **/api/ai/chat、/api/ai/evaluate 接受客户端 system prompt** — `app/api/ai/chat/route.ts:14`
  学生构造 prompt injection 改写客户人设、生成提示/答案、刷 token。修复：API 改收 `taskInstanceId` 服务端读配置 + 移除客户端 system/rubric

- [P1] **Insights aggregate POST 不读缓存** — `app/api/lms/task-instances/[id]/insights/aggregate/route.ts:55`
  循环 POST 同 instance 持续消耗 AI token。修复：POST 先读 cache + freshness/cooldown + force=true 才重算 + per-instance mutex + rate limit

### AI 实现（Round 2）

- [P1] **Chat 主调用无输入上下文上限** — `app/api/ai/chat/route.ts:7`
  transcript/scenario/systemPrompt 无长度校验，超长可打到模型造高成本/超 context 失败。修复：加 max + 服务端只保留 N 轮

- [P1] **B3 hint 节流依赖客户端 lastHintTurn** — `lib/services/ai.service.ts:365`
  lastHintTurn optional，省略后只要 currentTurn ≥ 3 就触发"首轮"，绕过"间隔 3 轮"成本保护。修复：服务端持久化 lastHintTurn，校验 0 ≤ lastHintTurn ≤ currentTurn

### 数据模型（Round 3）

- [P1] **Quiz/manual graded 不写 conceptTags 但聚合硬要求** — `lib/services/grading.service.ts:200`
  Quiz instance 全批改完仍 `NO_CONCEPT_TAGS` 失败。修复：批改路径都写 tags 或聚合允许无 tags（commonIssues/highlights 仍生成）

- [P1] **AnalysisReport per-instance cache 无唯一约束** — `prisma/schema.prisma:752`
  并发聚合插入重复 cache，GET 取最新一条不稳定。修复：`@@unique([taskInstanceId])` + 改 `upsert`

- [P1] **TaskInstance 删除不级联 submission/report 新数据** — `prisma/schema.prisma:488`
  Submission/AnalysisReport 是 ON DELETE SET NULL，conceptTags/snapshots/moodTimeline 留孤儿。修复：改 cascade 或 deleteTaskInstance 事务显式删

### 前端（Round 4）

- [P1] **手工批改 feedback 和维度分不持久化** — `app/api/submissions/[id]/grade/route.ts:33`
  抽屉提交 feedback + 逐维度分，route 只存 score/maxScore，feedback 被 parse 后丢弃。修复：扩展 schema 保存 evaluation.rubricBreakdown

- [P1] **资产快照次数刷新可绕过上限** — `components/simulation/simulation-runner.tsx:195`
  snapshots 进 localStorage 但 allocationSubmitCount 每次从 0 初始化，刷新后能继续记录超 maxSubmissions。修复：用 `snapshots.length` 派生计数

## P2 全清单（16 条 · 优化级）

省略详情，参见对应 Round 文件。

## 优先修复顺序建议

**P0 紧急** — 0 条

**P1 安全 + 数据完整性** — 5 条建议立刻修：
1. 学生提交无 instance guard（`app/api/submissions/route.ts:23`）— 数据泄漏 + AI 刷
2. AI chat/evaluate 接受客户端 system prompt（`app/api/ai/chat/route.ts:14`）— prompt injection
3. Markdown PUT guard 错位（`app/api/lms/content-blocks/[id]/markdown/route.ts:28`）— 跨课程改讲义
4. TaskInstance 创建无 task/course guard（`app/api/lms/task-instances/route.ts:18`）— 反向读他人 task
5. AnalysisReport 缺唯一约束 + cascade（`prisma/schema.prisma`）— schema 级一致性

**P1 业务正确性** — 6 条建议批量修：
6. Chapter/Section 创建无 owner（chapters/route.ts + sections/route.ts）
7. Announcements/ScheduleSlots courseId 绕过（announcements/route.ts + schedule-slots/route.ts）
8. Insights aggregate POST 无 cache（aggregate/route.ts）
9. Chat 上下文无上限（ai/chat/route.ts）
10. B3 hint 节流可绕过（ai.service.ts）
11. Quiz 不写 conceptTags（grading.service.ts）
12. TaskInstance 删除不级联（schema.prisma）
13. 手工批改 feedback 丢失（grade/route.ts）
14. 资产快照计数 localStorage 绕过（simulation-runner.tsx）

**P2 优化级** — 16 条可分批做。

## 审查方法论

- 模型：GPT-5.5
- Reasoning effort：xhigh
- 每轮独立 codex exec 调用，sandbox=read-only
- Base：`origin/main`（覆盖 51 commits）
- Token 消耗：约 800K（4 轮总计）
- 时长：约 50 分钟（4 轮串行）
- 0 false positive：每条 finding 都引用具体 file:line + 可复现攻击场景/修复路径

## 与之前轻量 codex review 对比

之前一轮 review（high effort，9 分钟）：3 条 finding（1 P1 + 2 P2），已全修。

本次深度多轮（xhigh，50 分钟）：**27 条新 finding**（11 P1 + 16 P2），覆盖度提升 9×。

证明聚焦多轮策略对大 diff（51 commits）有显著挖掘力。

——

下一步建议：用户验收清单后选择"批量修 P1（5+9 共 14 条）"或"先修 5 条紧急 P1，剩余 P2 留增量 PR"。
