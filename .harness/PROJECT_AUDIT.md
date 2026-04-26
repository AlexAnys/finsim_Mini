# FinSim v2 · 项目审核手册（给 Codex 的背景文档）

> 给独立审核者（Codex / 其他 AI / 人类 reviewer）使用。读完即可理解架构 + 本次更新 + 已知 trade-offs，然后做 forensic 级审查。

## 一、项目是什么

**FinSim v2** — 中国高校金融教育实训 SaaS 平台。

**核心循环**：教师建任务 → 指派给班级 → 学生在 Runner 里做 → AI 批改 → 数据分析回流给教师。

**三类核心任务**（Runner + Config 一一对应）：

| Type | Runner 组件 | Config 模型 | 批改方式 |
|---|---|---|---|
| `simulation` | `SimulationRunner` | `SimulationConfig` | AI 评估对话 + 资产配置 + rubric（4 维度 + 置信度） |
| `quiz` | `QuizRunner` | `QuizConfig` + `QuizQuestion[]` | 选择/判断 自动 + 简答 AI |
| `subjective` | `SubjectiveRunner` | `SubjectiveConfig` | 老师主批 + AI 建议评分 |

**三角色**：student / teacher / admin（admin 可见全局）。

## 二、技术栈

```
Next.js 15 App Router + React 18 + TypeScript
Tailwind 4（@theme inline 写法）+ shadcn/ui
NextAuth v5 beta（credentials provider）
Prisma 6 + PostgreSQL（Docker compose）
Vercel AI SDK + qwen-max / qwen3.5-plus 通过 OpenAI 兼容 API
Vitest + tanstack-virtual + react-virtual
```

## 三、架构（三层硬约束）

```
Route Handler (app/api/**)  →  Service (lib/services/**)  →  Prisma (lib/db/prisma.ts)
     ↑ Zod safeParse              ↑ 业务逻辑 throw Error("CODE")    ↑ schema.prisma + onDelete:Cascade
     ↑ Auth guards                ↑ 中文错误码                     ↑ 类型安全
```

**铁律**：
- Route Handler **不写业务逻辑**，只 parse + 调 service + 包响应
- Service 抛 `new Error("ERROR_CODE")`，由 `lib/api-utils.ts:handleServiceError` 映射成 HTTP + 中文 message
- API 响应固定 shape：`{ success: true, data }` | `{ success: false, error: { code, message } }`
- Auth：用 `requireAuth()` / `requireRole(["teacher","admin"])`，不手动查 session
- 中文 UI（所有 user-facing 文本）

## 四、数据模型核心（Prisma schema）

```
User { role, classId? }
Class { name, students[] }
Course { creatorId, semesterStartDate, classes[]:CourseClass[], teachers[]:CourseTeacher[] }
  └─ Chapter[] (order)
       └─ Section[] (order)
            └─ ContentBlock[] (order, slot:before|in|after, type:lecture|simulation|quiz|subjective|resource|link, data:Json)

Task (template) { type, courseId, sectionId?, config:Json (Sim/Quiz/Subj 三种 schema 之一) }
TaskInstance { taskId, classId?, dueAt, status }
Submission { studentId, taskInstanceId, status, score, maxScore, evaluation:Json, conceptTags[] (per type sub-table) }
  └─ SimulationSubmission { transcript:Json, assets:Json (含 snapshots[]), conceptTags[] }
  └─ QuizSubmission { answers:Json, breakdown:Json, conceptTags[] }
  └─ SubjectiveSubmission { content, attachments:Json, conceptTags[] }

AnalysisReport (per-instance aggregate, teacher-only)
  { taskInstanceId, report:Json (含 commonIssues/highlights/weaknessConcepts/allocationSnapshots),
    moodTimeline:Json?, commonIssues:Json?, aggregatedAt:DateTime? }

ScheduleSlot { courseId, dayOfWeek, slotIndex, weekType:all|odd|even, startWeek/endWeek, classroom }
Announcement { creatorId, courseId?, classId? }
StudyBuddyPost { studentId, taskId, mode:socratic|direct, anonymous, messages:Json }
```

**Cascade**：Course delete 级联 chapters/sections/blocks/tasks/instances；TaskInstance delete 级联 submissions。

## 五、关键 API 端点（按层组织）

```
auth:    /api/auth/*  /api/auth/register
core:    /api/lms/dashboard/summary  (角色感知)
         /api/lms/courses[/:id[/classes|teachers]]  (PATCH/DELETE 严格守护)
         /api/lms/courses/:id/classes  /teachers
         /api/lms/chapters/:id  PATCH/DELETE  (Phase 4 新)
         /api/lms/sections/:id  PATCH/DELETE  (Phase 4 新)
         /api/lms/sections (POST 已有)
         /api/lms/content-blocks  POST/PATCH/DELETE/reorder  (Phase 4 新 4 端点)
         /api/lms/content-blocks/:id/markdown  PUT (PR-SEC3 已守护)
         /api/lms/task-instances/:id  GET/PATCH  +/insights  +/insights/aggregate (Phase 5 新)
         /api/lms/announcements  GET/POST/PATCH/DELETE
         /api/lms/schedule-slots  CRUD
         /api/lms/legacy-tasks  (历史，无 UI 入口，待评估)
tasks:   /api/tasks  POST  /api/tasks/:id  GET/PATCH/DELETE
         /api/submissions  GET (PR-SEC4 加 owner scope guard)  POST
         /api/submissions/:id  GET/PATCH/DELETE  /grade  POST
         /api/submissions/batch  /api/quiz-questions  /batch
study:   /api/study-buddy/posts  /summaries
ai:      /api/ai/chat  (Sim runner 用，Phase 7 扩展返回 mood/hint)
         /api/ai/evaluate  (批改 + conceptTags 抽取，Phase 5 升级)
         /api/ai/study-buddy/reply  /summary
         /api/ai/task-draft/quiz  /subjective  (AI 出题)
         /api/ai/import/parse  (题库导入)
import:  /api/import-jobs  (历史)
groups:  /api/groups  (学生分组)
files:   /api/files/upload  /[...path]
```

**安全守护层**（lib/auth/）：
- `auth.config.ts` — NextAuth v5（PR-AUTH-fix 加 `secret: AUTH_SECRET || NEXTAUTH_SECRET` 兼容）
- `course-access.ts` — `assertCourseAccess(courseId, userId, role)` admin 直通 / teacher creator-or-CourseTeacher / 否则 403
- `course-access.ts` — `assertCourseReadable` student 也能（学生在该课任意班级 → 200）
- `resource-access.ts` — 6 个 reader guard（task / instance / class / submission / chapter / section / contentBlock）
- `resource-access.ts` — 3 个 writer guard（chapter/section/contentBlock writable）
- `guards.ts` — re-export 给 route 层（避免 ESM 解析 next-auth 在单测里炸）

## 六、AI Provider 配置（env 驱动，全可覆盖）

```
AI_PROVIDER=qwen
AI_MODEL=qwen3.5-plus                   # 默认
AI_SIMULATION_MODEL=qwen-max            # 客户对话 + mood 顺带（A1+A7 同一调用）
AI_TASK_DRAFT_MODEL=qwen-max            # AI 出题
AI_EVALUATION_MODEL=qwen3.5-plus        # 批改
AI_EVALUATION_FALLBACK_MODEL=qwen-max   # 低置信度复合校验
AI_STUDY_BUDDY_MODEL=qwen3.5-plus       # Socratic 引导
AI_INSIGHTS_MODEL=qwen-max              # 教师聚合洞察
```

`lib/services/ai.service.ts:FEATURE_ENV_MAP` 把 feature → env 名映射；硬编码模型名 grep 0 命中。

## 七、本次更新概览（51 commits / 7 个 Phase / 跨两天）

```
Phase 0 · 设计系统基座        4 commits  (tokens + 核心卡 + sidebar + Wordmark)
Phase 1 · 技术债清理          3 commits  (SSR 闪烁 RSC 改造 + 4 latent bug)
Phase 2 · 学生端全体          5 commits  (dashboard + courses + course detail + TopBar)
Phase 3 · 教师端全体          4 commits  (dashboard + courses + course editor 占位版)
Phase SEC · 4 P1 安全闭环     4 commits  (SEC1/2/3/4)
Phase 4 · 任务向导 + 课程编辑器升级  8 commits  (向导 4 步 + AI 出题 + 6 种 block editor + AUTH-fix)
Phase 5 · 实例详情 4 tabs    6 commits  (overview + submissions + insights AI 真聚合 + analytics)
Phase 6 · Runner 外壳 + 登录 + 8 空错态  3 commits
Phase 7 · Simulation 对话气泡专题  3 commits  (mood 8 档真 AI + Socratic hint + 资产 snapshots)
+ 多次 harness/HANDOFF chore commits
```

**指标**：
- Tests：61 → **366**（+305，+500%）
- 新组件：35+
- 新 API 端点：8 + 2 + chat 响应扩展 = 共 10 个新端点 + 1 个响应扩展
- Schema 改动：2 次（Phase 5 conceptTags/commonIssues/aggregatedAt + Phase 7 moodTimeline），全部走完 Prisma 三步
- P1 安全漏洞闭环：4 个（全 pre-existing，QA regression sweep 独立发现）
- 真 AI E2E：qwen-max 真聚合 7.5s + 缓存 0.045s + mood 8 档真切档 + Socratic hint 真渲染 + AI 评分真引用 snapshots 演变

## 八、Codex 审核重点（按价值排序）

### A. 安全 · OWASP / STRIDE 复审

本次新增 10 个 API 端点 + 5 次 schema 接触。已通过的 4 个 P1 闭环（PR-SEC1/2/3/4）建议你独立验证：

1. **`assertCourseAccess` / `assertCourseReadable`** 在 `lib/auth/course-access.ts` 是否真覆盖：admin 直通 / teacher 仅自己课 / student 仅自己班的课。SQL injection / IDOR 攻击面。
2. **`/api/lms/content-blocks/*` 8 个新端点**（Phase 4 PR-4D1）— `assertChapterWritable / assertSectionWritable / assertContentBlockWritable` 链路是否正确。reorder endpoint 的 `prisma.$transaction` 原子性。
3. **`/api/lms/task-instances/[id]/insights/aggregate`** — POST 触发 AI 调用的成本守护：未批改 instance 应 400（避免 token 浪费）。
4. **`/api/submissions` GET**（PR-SEC4）— `taskInstanceId` 参数必填 + `effectiveStudentId` 强制 override 学生身份（防 spoof）。
5. **`/api/ai/chat`** 新返回 mood/hint — 是否会把 AI prompt 注入风险扩大？mood_label 是否枚举校验防止 stored XSS？
6. NextAuth v5 secret resolution（`lib/auth/secret.ts`）— `process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET` 是否有 trim/whitespace edge case？

### B. 数据模型一致性

1. **Hybrid 字段放置** — Phase 5 builder 主动修正 spec 错配：conceptTags 放 per-submission 三个子表（不是 AnalysisReport）；Phase 7 builder 主动修正 spec 错配：allocationSnapshots 放 SimulationSubmission.assets.snapshots（不是 AnalysisReport.allocationSnapshots）。这两个决策**对不对**？
2. **`AnalysisReport.report:Json` 字段聚合**：`commonIssues / highlights / weaknessConcepts / allocationSnapshots` 全塞一个 Json 是否合理？查询/索引会不会有问题？
3. **`SimulationSubmission.assets:Json` shape**：`{ allocations: [{label,value}], snapshots: [{turn, ts, allocations}] }` 是否合 Zod schema 严格校验？老数据（无 snapshots）的兼容？
4. **mood 8 档枚举**：`HAPPY/RELAXED/EXCITED/NEUTRAL/SKEPTICAL/CONFUSED/ANGRY/DISAPPOINTED` 重映射中文（5 档迁移到 8 档）— 旧 5 档值仍合法（向后兼容），但 UI 文案已改。是否有遗漏 caller？

### C. AI 实现的产品级正确性

1. **mood/hint 触发规则（Phase 7 PR-7B）**：service 端判定 hint 而非 AI 决定，规则 `(student_perf < 0.5 OR deviated_dimensions.length >= 1) AND (currentTurn - lastHintTurn >= 3)`。第一次 hint 触发放宽到 currentTurn >= 3。是否会出现 hint 永远不触发或每轮都触发的边界？
2. **`/api/ai/chat` JSON 输出格式**：AI prompt 要求输出 `{ response, mood_score, mood_label, student_perf, deviated_dimensions, hint? }`。如果 AI 返回非 JSON 或字段缺失，前端如何降级？是否会 500？
3. **`evaluateSimulation` prompt 指令**：要求"参考资产配置演变（snapshots 数组）"+"输出 3-5 个概念标签到 conceptTags 字段"。如果 AI 输出 0 个或 10 个 tag，service 是否截断？
4. **conceptTags 跨 instance 聚合**（`insights.service.aggregateInsights`）：是否正确去重 + 计数 + 排序成 `weaknessConcepts: [{tag, count}]`？

### D. 前端关键交互

1. **TopBar SSR 角色固定**（PR-1A） — `(student)/layout.tsx` + `teacher/layout.tsx` 已升 RSC + `getSession()`，把 `initialRole` 传给 client Sidebar 防 hydration 闪烁。是否真的没闪？
2. **教师课程编辑器**（Phase 4 PR-4D2）— 6 种 ContentBlockType 编辑面板，新建/编辑/删除/reorder（上下箭头，非拖拽）。是否所有路径都对？dispatcher 有 `case "link"` 但 schema 没 `link` enum（builder 自注释"未来扩展"），是否 dead code？
3. **任务向导 4 步**（Phase 4 PR-4A/B/C） — Step 0 三大卡 + Step 1 基本 + Step 2 type-specific config + Step 3 review。表单 state byte-equivalent 保留（验证 Zod schema）。AI 出题 dialog 的"主题/难度/数量" → `/api/ai/task-draft/quiz` 是否真传 qwen-max env？
4. **Submissions tab 虚拟化**（Phase 5 PR-5B） — `@tanstack/react-virtual` 在 >50 行场景。批改 drawer：左答卷（type dispatch）+ 右评分（scoringCriteria 维度分档 + AI 置信度 badge）。是否有内存泄漏 / scroll 错位？
5. **Simulation Runner 三列**（Phase 7 PR-7A） — 左 280 客户档案 + 中 flex 气泡 + 右 320 资产滑杆 + donut。byte-EQ 字节级 anti-regression（builder 自核 7 个 handler）。state machine 真没动？
6. **资产配置滑杆 snapshots**（Phase 7 PR-7C） — debounce localStorage + 提交时塞 `assets.snapshots`。如果学生不点"记录"按钮，AI 评分能拿到啥？多 tab 同 instance 是否冲突？

### E. 验证 / 测试覆盖

- 366 tests（vitest）— 覆盖 service 层 + auth guards + utils + 部分 API + 组件
- Tests **不覆盖**：
  - 真浏览器 E2E（仅 QA agent 真 curl 验证，无 Playwright）
  - 真 AI 调用（成本考虑，仅 QA 真测但未常态化跑）
  - 真 Prisma migration 链路（仅 dev 跑，无 prod migration test）

### F. CLAUDE.md 硬约束遵守度

1. 每个 schema 改动是否走完 Prisma 三步（migrate dev / generate / 杀重启 dev server / 真访问页面验证）？
2. Service interface 改动时是否同步所有 caller？
3. Route Handler 是否真的"无业务逻辑"？
4. 新加 npm 依赖（`@tanstack/react-virtual`）是否有重启 dev server 验证？
5. 中文 UI / Zod safeParse / handleServiceError 是否一致？

### G. 已知未做（待评估必要性）

- 学生端 `/grades`、`/study-buddy`、`/schedule` 页面骨架仅 token 化，**未按设计稿重布局**
- AI 助手页 `/teacher/ai-assistant` 不存在（教师 dashboard AI 卡降级为占位入口）
- 50+ inline 空态未迁移到 `components/states/empty-list`（Phase 6 已建组件）
- Sim Runner mood 高亮色 4 处硬编码 `#E6B34C` / `#51C08E`（设计源 verbatim，黑底 topbar 需更亮，token 系统未提供 -bright 变体）
- AI Dialog `courseName: taskName` prompt 语义错位（PR-4B 遗留）
- `prisma/seed.ts` 未补 CourseTeacher collab 关系（E2E collab 路径覆盖不全）
- Subjective Runner SavedChip 永显"已自动保存"（hasSaved state 缺）
- block-edit-panel dispatcher 有 `case "link"` 但 schema 无 `link` enum
- 教师 `/teacher/announcements` PR-1B 已缩紧到自己课，但其他可能存在的 owner-scope 漏洞未系统扫
- 长 running dev server 加新依赖后偶发死亡（Phase 5/6 builder/QA 多次重启）

### H. 工程纪律观察

本次过程中出现的有趣事件（你可以独立判断这些是否是 anti-pattern）：

- **2 次 spec 架构错配主动识别**（builder-p7）：spec 写的 `POST /api/instances/:id/messages` 不存在；spec 写的 `AnalysisReport.allocationSnapshots` 是教师聚合表学生越权写。Builder 提 hybrid 方案改用现架构。Coordinator ack。是 anti-pattern 还是合理工程实践？
- **多次 QA 自我追认**（qa-p4、qa-p5）：有过 NextAuth `Configuration` 误诊（实际是 Postgres 停机）+ SQL vs API E2E 路径选择错误。值得保留还是该改流程？
- **dev server 加新依赖后没重启**（PR-5B builder 报告 PID 错误）：CLAUDE.md L122 硬规则违规，QA 自己重启的。下一次怎么避免？
- **byte-EQ 字节级 anti-regression**（Phase 7 builder 自核 7 个 handler）：是 over-engineering 还是恰当纪律？

## 九、git 状态

```
HEAD：本地领先 origin/main 51 commits（本次工作全在本地）
工作树：clean
分支：main
未推送
```

建议 codex review base：`origin/main`（覆盖全 51 commits）

## 十、推荐审查路径

1. **第一遍**：`git log origin/main..HEAD --oneline` 看 51 commits 描述，建立时间线
2. **第二遍 · 抽样深审**（每 Phase 1-2 个 commit）：
   - PR-1B `41decaa` — 4 latent bug 清理（schedule.service where 重写 + 老师公告 teacherId + allSettled）
   - PR-4D1 `bcbbe4d` — 8 新端点 + 3 guards + cascade + transaction
   - PR-5C `2eaf5be` — schema 改动 + AI 真聚合 + insights aggregate API
   - PR-7B `3f82923` — mood schema + AI JSON prompt + B3 触发规则
   - PR-7C `8e3cd48` — Plan C 纯净版（非 spec 字面，hybrid 方案）
3. **第三遍 · 横切**：
   - 全仓 grep `assertCourse` / `assertResource` 看 guard 一致性
   - 全仓 grep `bg-violet|bg-emerald|...` 看硬编码色清理
   - 全仓 grep `console.log` 看是否漏调试输出
   - `prisma/schema.prisma` diff 看两次 schema 改动是否合理
4. **第四遍 · 边界**：
   - 老 5 档 mood 数据兼容性
   - cascade delete 是否真的清掉所有子数据
   - AI prompt 注入风险（学生输入直接进 prompt 的位置）

## 十一、对你的提问（Codex 自由判断）

1. 41 commits 的 spec → impl → QA 流程是否产生了真实 forensic 级证据？还是流程化痕迹大于实际质量？
2. "不改 schema/API 硬约束" 在 Phase 4 解锁 → Phase 7 又解锁。每次解锁是否都换来了实质价值？
3. AI 评分 + mood + hint + conceptTags 这套产品差异化在**当前实现状态**下，对真实老师/学生而言是否有用？还是 demo path 的 happy case？
4. 给一个排序的优先级建议：本次 51 commits 之后应该最先做什么？

——

**审核者请把发现按 P0 / P1 / P2 分级输出**，每条引用具体文件 + 行号。
