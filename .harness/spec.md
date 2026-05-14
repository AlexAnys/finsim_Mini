# Spec — finsim 2026-05-14 全模块修复（65 bugs + 用户决策）

> Coordinator: claude (main agent) · Builder + QA: team `probe-demo`
> Branch: `claude-demo-fixes` (created from main `98017c8`)
> Dev DB 已备份：`.harness/dev-db-backup-2026-05-14.sql` (701K)
> 演示账号：molly@qq.com / 123456（teacher） + alex/belle/charlie/dexter@qq.com / 11（students）

## 用户决策（拍板固化）

1. **真实自适应模式**：按知识点 + 题型难度（多选 0.8 > 简答 0.9 > 单选 0.5 > 判断 0.3）+ 答对率自适应，目标 ≤8 题诊断 ≥3 知识点掌握度；末尾输出"薄弱知识点报告"；规则引擎 + 简化贝叶斯混合
2. **Study Buddy 自由问**：taskId 改 optional；有素材引素材（含 excerpt），无素材用章节名/课程概要兜底，**不能拒答**
3. **演示账号 = molly@qq.com**，不切回 teacher1；不重做全局 seed；改造 molly 课的真实数据
4. **AI 回帖不需审核**：Study Buddy AI 回帖即时可见；学生提问 + AI 回帖聚合到老师"Study Buddy 管理页"
5. **协作教师权限上扬**：协作者**可改课程结构 + 可建班**（与 owner 接近，不再限制为只读）
6. **任务管理常理功能**：实例可重开 + 任务总览页全 config 可见可改 + 删除盘点全实体覆盖
7. **TaskBuildDraft 仍保留审核闭环**（任务发给学生前需老师审一遍）—— 区别于 SB AI 回帖（不审）

## Bug 清单引用

完整：`.harness/reports/bug_inventory_teacher_r1.md`（30 bugs）+ `.harness/reports/bug_inventory_student_r1.md`（35 bugs）

下面 Unit 中的 `B-XXX` 编号对应这两份报告。

---

## Phase 1 — 核心 P0（让 molly 能正常操作演示流程）

**目标**：修完 Phase 1，molly 能正常完成"造课程 → 上传材料 → 发任务 → 学生答题 → 批改 release → 一周洞察 → 数据洞察"全流程不被 UI bug 阻塞。Phase 1 全部不动 Prisma schema。

### Unit 1 — KPI Hydration + 一周洞察 Dialog A11y

**修**：B-INSIGHT-01, B-DASH-02 dialog 部分

**Acceptance**：
- 进 `/teacher/analytics-v2` 控制台 0 条 `<button> cannot be a descendant of <button>` warning
- 一周洞察 modal 打开时 0 条 `Missing Description or aria-describedby for {DialogContent}` warning
- KPI 卡仍可点击进 drilldown（功能不变）

**Scope**：`components/teacher/analytics-v2/kpi-row.tsx` + `components/dashboard/weekly-insight-modal.tsx`

**风险**：低（纯 DOM/aria 修改）

---

### Unit 2 — 任务实例状态机（关闭确认 + 重开 + 删除）

**修**：B-INSTANCE-01, B-INSTANCE-02, B-INSTANCE-03

**Acceptance**：
- 实例详情页"关闭实例"按钮点击弹 confirm dialog（中文："关闭后学生无法继续提交，确认关闭？"）
- 已关闭实例详情页 + 列表行尾出现"重新开放"按钮，点后实例状态回 published、closedAt 清空
- 已关闭/草稿状态的实例支持删除（前提：0 submission；有 submission 时按钮 disabled 并 tooltip）
- 后端 PATCH/DELETE 端点保留原 audit
- TypeScript / vitest / lint 全过

**Scope**：`app/teacher/instances/[id]/page.tsx` + `app/teacher/instances/page.tsx` + `lib/services/task-instance.service.ts` + Prisma 字段已支持（`closedAt`, `status`），仅做服务端 reopen 方法

**风险**：低-中（状态机扩，需测 reopen 后学生侧能看到任务）

---

### Unit 3 — 学生侧主路径阻塞修复（/tasks 404 + closed 403 + dashboard 跳转）

**修**：B-STU-TASKS-1, B-STU-AUTH-2, 意外 #3

**Acceptance**：
- 新建 `app/(student)/tasks/page.tsx`：按"待办 / 进行中 / 已批改 / 已结束"4 个 tab 分类显示；带课程 / 类型筛选
- 学生 sidebar 加"任务中心" nav 项
- `lib/auth/resource-access.ts` 改：closed 状态对**有自己已提交 submission 的学生**放行（只读）
- ForbiddenState 文案区分三种 case："任务尚未开放" / "任务已结束" / "你不在该任务班级"
- dashboard 学习任务卡 closed 状态的 [结果] 按钮跳 `/grades?focus=<submissionId>` 而不是 `/tasks/[id]`
- 跨班 / 未发布的真 403 路径不被破坏（回归测试）

**Scope**：`app/(student)/tasks/page.tsx`（新）+ `app/(student)/tasks/[id]/page.tsx`（文案）+ `lib/auth/resource-access.ts`（权限）+ `components/sidebar.tsx`（导航）+ `components/dashboard/priority-tasks.tsx`（跳转）

**风险**：中（权限边界改动需保留跨班/未发布 403）

---

### Unit 4 — 任务总览页全 config 可见可改 + 高危改动拦截

**修**：B-TASK-04, B-TASK-05, B-DEMO-02（任务知识点/章节展示）

**Acceptance**：
- `/teacher/tasks/[id]` 总览页**展示所有 config**：题目（quiz）/ rubric + AI 客户人设（simulation）/ scoring + allocation（subjective）/ 知识点 / 章节-小节关联 / 评分严格度 / timeLimit / 自适应配置
- 编辑模式：上述全部可改（除 type 不能改）
- 保存前若 task 已有 ≥1 graded submission，弹 dialog 警告 "改动可能影响分数解读" + 三选项：直接保存 / 复制为新任务 / 取消
- 改动后写 audit log（model: `task.update`, before/after diff）
- 已发布 instance 仍跑改前 config 还是改后？— **本 unit 仅做"任务模板"层面修改**（task 表）；instance 表沿用 instance 创建时 snapshot 的 config（如果 schema 没 snapshot 字段 → 提到 Phase 2）

**Scope**：`app/teacher/tasks/[id]/page.tsx`（编辑入口扩）+ `components/teacher-course-edit/task-wizard-modal.tsx` 内组件复用 + `lib/services/task.service.ts`（高危拦截）+ `lib/services/audit.service.ts`

**风险**：高（page.tsx 编辑模式分支大改 + 高危拦截影响所有 task PATCH）。建议 unit 完成后整体回归测一遍。

---

### Unit 5 — 删除盘点全实体覆盖 + 协作教师权限上扬

**修**：B-COURSE-01, B-COURSE-04, B-COURSE-05, B-DELETE-01, B-DELETE-02

**Acceptance**：
- **课程**：列表 + 详情加"归档"按钮（软删，schema 已有 archivedAt 或新建）；有 instance 的拒删并提示"先关闭所有任务实例"
- **章节 / 小节 / ContentBlock**：UI 入口确实可见可点（probe 报告说"⚠️可能在 inline-section-row"需点击确认）；删除前 confirm
- **任务模板**：`/teacher/tasks/[id]` 加"删除"按钮（前提：0 instance；有 instance 拒删）
- **CourseKnowledgeSource**：已有删除按钮，新增"协作者删 owner 素材必弹二级 confirm + audit"
- **StudyBuddyPost**：后端加 DELETE 端点 + 老师 SB 管理页删除按钮（学生只能删自己的 post）
- **Submission**：后端加"撤销批改"端点（status: graded → ungraded），保留作答数据；UI 在批改抽屉里露出
- **协作教师权限上扬**：service 层允许协作者改 chapter/section/block/class/knowledge-source（之前可能拒绝）；UI 不再隐藏；audit 标记 actor=collaborator
- 删除/归档/撤销批改全部走 audit log

**Scope**：`lib/services/course.service.ts`(deleteCourse/archiveCourse) + `task.service.ts`(deleteTask) + `study-buddy.service.ts`(delete) + `submission.service.ts`(ungrade) + `class.service.ts` + 各对应 route.ts 加 DELETE + 各对应 page.tsx 加 UI + `lib/auth/course-access.ts` (协作权限) + `lib/services/audit.service.ts`

**风险**：高（涉及 6 个 service + N 个 page，工作量大）。建议拆 5a/5b/5c 子 unit：
- 5a: 课程归档 + 任务删除（最常用）
- 5b: SB 删除 + Submission 撤销批改
- 5c: 协作者权限上扬（独立的，service-only 改）

---

### Unit 6 — Study Buddy 自由问 + excerpt 持久化 + 老师管理页

**修**：B-STU-SB-3, B-STU-SB-1, B-SB-01, B-SB-03

**Acceptance**：
- `app/api/study-buddy/posts/route.ts` schema：`taskId` 改 optional
- 提问 dialog：顶部 segmented "通用提问 / 任务相关"；"通用提问"模式不显示任务选择，仅选课程（可选 = 全课程）
- service `generateReply`：
  - 有素材 → 拼 materialContext + excerpt 入 `contextSources`（含 fileName + excerpt + page）
  - 无素材 → fallback prompt 用"章节名 + 课程概要 + 通用金融常识"，回答标注"未引用具体素材"
  - **绝不拒答**
- UI message 渲染 contextSources 时显示 excerpt（hover 展开）
- 加 `/teacher/study-buddy` 全局聚合页：跨课程的热门提问 / 未答疑 / 按知识点分类 + 删除/隐藏入口
- 学生 dashboard "随时提问"callout 可点击进入新的通用提问 flow

**Scope**：`app/api/study-buddy/posts/route.ts` + `lib/services/study-buddy.service.ts` + `components/study-buddy/study-buddy-new-post-dialog.tsx` + `components/study-buddy/study-buddy-message.tsx` + 新页 `app/teacher/study-buddy/page.tsx`

**风险**：中（service 改动 + 新页）

---

### Unit 7 — 仪表盘 + 课表去重 + 一周洞察 meta footer

**修**：B-DASH-01, B-DASH-03, B-STU-SCHED-1（同根因课表 dedupe）, M1 课表重复

**Acceptance**：
- `buildUpcomingSchedule()` 按 `scheduleSlotId + 日期` 去重
- 一周洞察 modal footer 新增"由 {model} 生成 · 耗时 {ms}s · 生成于 {generatedAt}"
- "重新生成"按钮加 60s 冷却倒计时（前端 disable + 后端服务端节流见 Unit 11）
- molly 仪表盘"今日 N 节课"在 0 节时改文案"今日无排课"（不再硬显 0）

**Scope**：`lib/utils/schedule-transforms.ts` 或 service + `components/dashboard/weekly-insight-modal.tsx` + `lib/services/weekly-insight.service.ts`（meta 字段）

**风险**：低

---

## Phase 2 — schema 改动 + 兑现演示承诺

**注意**：本 Phase 全部走 Prisma 三步（migrate → generate → 重启 dev server + 实测页面）。

### Unit 8 — 真自适应模式（schema 消费 + IRT 规则混合引擎 + UI）

**修**：B-STU-QUIZ-2/4（=probe r1 B1）

**Acceptance**：
- `QuizConfig.{mode, maxQuestions, startDifficulty, difficultyStep}` 4 字段被运行时消费
- 新引擎 `lib/services/quiz-adaptive.service.ts`：
  - 按知识点维护学生能力估计（每题答对 +diff×step / 答错 -diff×step）
  - 题型难度系数：判断 0.3 / 单选 0.5 / 多选 0.8 / 简答 0.9
  - 下一题选自"能力区间 ±1 step × 薄弱知识点优先"
  - 末尾出"薄弱知识点报告" + 各知识点掌握度估计
- `components/quiz/quiz-runner.tsx` adaptive 模式真按引擎出题；导航条不预渲染所有题
- 末尾报告 UI：知识点掌握度雷达图（recharts 已有依赖）
- 单测覆盖：3 知识点 × 8 题路径出"≥3 知识点诊断"

**Scope**：`lib/services/quiz-adaptive.service.ts`（新）+ `components/quiz/quiz-runner.tsx` + `app/api/submissions/route.ts`（提交逻辑改）+ schema（如需加字段，否则复用 QuizConfig）+ vitest

**风险**：高（核心算法 + 严重影响 quiz 提交逻辑）

---

### Unit 9 — 模拟对话评分依据结构化 quote

**修**：probe r1 B2

**Acceptance**：
- Rubric schema 加 `evidence: Array<{ studentText: string, comment: string }>`
- AI evaluate prompt 强制"每项 rubric 至少 1 条 evidence，studentText 必须是对话中学生原句的精确引用"
- 服务端 post-process 校验：transcript 包含每条 studentText（regex），否则触发一次 retry
- 教师 grading 抽屉 UI 显示"评分依据"块：rubric 项 + 引用气泡（点击高亮原对话）
- 学生侧成绩页同步显示

**Scope**：schema `SimulationConfig.rubric` 或 `Submission.evaluation` 嵌套字段 + `lib/services/ai.service.ts:1480 evaluate prompt` + `lib/services/grading.service.ts`(post-process) + `components/instance-detail/grading-drawer.tsx` + `app/(student)/grades/*`

**风险**：中（schema 改 + AI prompt 调）

---

### Unit 10 — TaskBuildDraft 审核闭环

**修**：B-DEMO-01

**Acceptance**：
- `TaskBuildDraft` 状态机加 `approved` 中间态：`draft → queued → processing → ready → **approved** → published`（失败分支 failed）
- schema 加 `aiPayload Json` + `editedPayload Json`（教师可视化 diff 用）
- 审核 UI：`/teacher/tasks/drafts/[id]`，左右对照 AI 原稿 vs 教师编辑稿，单 row 接受/拒绝
- PATCH 路由：approve 操作走 `task-build-draft.service.ts`，写 audit `task_draft.approve`，actor + timestamp
- 未 approved 的 draft 不能直接发布给学生
- TaskBuildDraft 列表页加状态过滤

**Scope**：schema `TaskBuildDraft.status` enum + 新字段 + `app/teacher/tasks/drafts/[id]/page.tsx` + `app/api/lms/task-build-drafts/[id]/approve/route.ts` + `lib/services/task-build-draft.service.ts`

**风险**：高（状态机 + 双 payload + 新审核页）

---

### Unit 11 — AI 留痕 UI + 服务端节流 + AiRun 完整字段

**修**：B-ADMIN-01, B-ADMIN-02, B-DASH-01（与 Unit 7 协作）, probe r1 PR-2/3, M1 一周洞察无节流

**Acceptance**：
- schema `AiRun` 加 `inputTokens Int? / outputTokens Int? / costEstUSD Decimal? / summary String?(200)`
- `ai.service.ts` 三大入口（generate/json/stream）回填 token + summary（prompt 前 200 字哈希）
- cron 兜底：`running > 5min` 自动转 failed
- 新建 `/teacher/ai-usage` 列表（feature/dateRange/provider/model 筛选；按 feature 聚合的成本估算卡）
- 新建 `/admin/audit`：管理员视角，跨教师 AuditLog + AiRun
- 服务端节流：`weekly-insight` + `scope-insights` + `task-draft-ai`：同 userId + feature 60s 内 force=true 仅 1 次（用 redis-less 的 in-memory throttle 或写 AiRun 查询）
- 一周洞察 modal 显示 AI Run 信息（model/token/duration），与 Unit 7 footer 合并

**Scope**：schema `AiRun.*` + cron + 新 `/teacher/ai-usage/page.tsx` + 新 `/admin/audit/page.tsx` + `lib/services/ai.service.ts` 节流装饰 + 各调用方

**风险**：高（schema migrate + admin 角色 layout + 节流是横切关切）

---

## Phase 3 — molly 真实演示数据建设（主分支，不开 unit）

Phase 1 + 2 全部完成 + merge 后，由 coordinator (我) 直接执行：

- **M-1**：molly 自建课程结构（个人理财规划完整大纲：5-6 章 × 3-4 节）
- **M-2**：molly 上传 3-5 份真实教学材料（PDF/DOCX/XLSX）→ 跑 AI 解析 → 验证章节-知识点匹配
- **M-3**：molly 用任务向导 + AI 生成 3 类任务各 1-2 个（simulation 客户人设、quiz 8-10 题、subjective）
- **M-4**：alex / belle / charlie / dexter 真实跑通：每人答 1-2 个任务，问 SB 几个问题（含通用提问）
- **M-5**：molly 真实批改 + release + 跑一周洞察 + 跑数据洞察
- **M-6**：验证演示视频脚本能从 0 到 6'13" 自然演绎（不卡 bug）

每个步骤的实测结果 + 截图记录到 `.harness/reports/molly_demo_seed_r1.md`。

---

## Phase 4 — 剩余 P1/P2 polish

按需做，不阻塞 Phase 3：

- Unit 12: 主观题 allowedAttachmentTypes 实接 + capture 拍照（B-STU-SUBJ-1/2）
- Unit 13: 协作教师 dialog 完整化（B-COURSE-02 + B-STU-COURSES-1 资源/讨论 tab 隐藏）
- Unit 14: 学生 dashboard 学习任务卡折叠（B-STU-DASH-1）+ AI buddy callout 视口
- Unit 15: 一周洞察 LLM 空数据机械重复修（probe r1 M1-P1-3）+ 错误降级文案分级
- Unit 16: 全 P2 一次性扫尾

---

## Phase 5 — 整体 code review + PR

- 全部 unit merge 到 `claude-demo-fixes` 后
- 跑全量 `npx tsc --noEmit && npx vitest run && npm run lint`
- code review report：结构 / 一致性 / 性能 / 必要小重构
- PR → main，等 CI quality + staging deploy → 用户 staging 实测 → squash merge

---

## 工作流（每个 unit 严格遵守）

1. **Builder 接手**：读 spec + 该 unit 引用的 bug 报告条目 + 触及文件，**计划自己输出"实现方案 + 文件清单 + 风险"给 coordinator 审一眼**（避免误读）
2. **Builder 实现**：单 commit；每 commit 跑 `npx tsc --noEmit`；diff 控制 ≤ 200 行（schema 改动除外）
3. **Builder 提交报告** `.harness/reports/build_unit{N}_r{M}.md`，列：改动文件 / 关键决策 / 自测结果
4. **QA 独立验证**：read spec + build 报告 + 不读 builder 改动方案；用 Playwright 真浏览器跑 acceptance；写 `qa_unit{N}_r{M}.md`
5. **Dynamic exit**：
   - PASS 连续 2 轮 → unit completed → coordinator 标完成 → 进下个 unit
   - FAIL 同样问题连续 3 轮 → 回 spec 重规划，**不要硬磨**
6. **每个 unit completed 写一行到** `.harness/progress.tsv`

## 不修的项（用户已表态 / 设计选择）

- Study Buddy AI 回帖**不**走审核（与 TaskBuildDraft 不同）
- Seed 重做（演示用 molly，造真实数据）
- 逐字稿"4 维度建议"代码实际 5 块：用户未表态 → 默认改话术为"4 维 + 1 行动项"或保留代码现状（Unit 11 顺手做）

## 风险登记

- Unit 4 + Unit 5 + Unit 10 都触及 `/teacher/tasks/[id]/page.tsx` 或 task.service，**串行执行避免互踩**
- Unit 8 + Unit 9 改 Prisma schema，**Phase 2 内串行**（一次 migrate 多个改动 OK，但建议分开 migrate 便于回滚）
- molly 演示数据建设期间，dev DB 状态会变化，QA 回归测试可能需要重新做 snapshot
