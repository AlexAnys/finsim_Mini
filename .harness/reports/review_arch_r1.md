# Review — Architecture & Module Depth (r1)

## Reviewer charter

独立审查 finsim codebase 的三层架构落地情况（Route Handler → Service → Prisma）与模块深度：是否真薄真深，seam 是否合理，shallow 模块是否值得保留。**Scope**：`app/api/**/route.ts`、`lib/services/*.service.ts`、`components/`、`lib/api-utils.ts`、`lib/auth/`、`lib/validators/`。读 only，6 个其他 reviewer 独立工作不互通。

## Method

### Static scans

```bash
find app/api -name "route.ts" | wc -l                    # 90 routes
wc -l lib/services/*.service.ts | sort -rn               # 33 services, 14,974 lines
grep -rln "await prisma\." app/api/                       # 26 routes ↔ direct prisma (29%)
grep -rln "import.*validators" app/api/                   # 9/90 routes ↔ shared validators
grep -c "z\.object" app/api/**/*.ts                       # 37 files ↔ inline Zod
grep -c "case \"" lib/api-utils.ts                        # 76 cases in handleServiceError switch
grep -rh "throw new Error(\"[A-Z_]*\")" lib/services/ lib/auth/ | sort -u | wc -l   # 68 unique codes thrown
grep -rln "logAuditForced\|logAudit" app/api/             # 28 audit calls from routes
grep -rln "logAuditForced\|logAudit" lib/services/        # 29 audit calls from services
```

### Targeted reads

- `lib/api-utils.ts` 全文（296 行）
- `lib/auth/{guards,course-access,resource-access,actor-role}.ts` 全文
- Top-size services: `course.service.ts`、`task-instance.service.ts`、`task.service.ts`、`ai.service.ts`（局部，1736 行）、`audit.service.ts`、`group.service.ts`、`storage.service.ts`
- Top-size routes: `lms/courses/[id]/outline-apply/route.ts`（503 行）、`lms/study-buddy/analytics/route.ts`、`lms/task-instances/[id]/insights/route.ts`、`lms/task-instances/with-task/route.ts`、`submissions/route.ts`、`ai/chat/route.ts`、`auth/register/route.ts`
- 代表组件 props/接口：`simulation-runner.tsx`、`task-wizard-modal.tsx`、`grading-drawer.tsx`、`analytics-v2/study-buddy-block.tsx`

### Deletion tests applied

每个 finding 末尾标注「删除模块复杂度归宿」(消失 / 转 1 caller / 散 N callers)。

## Top findings

### F-1: `app/api/lms/courses/[id]/outline-apply/route.ts` — 503 行业务逻辑全在 route — Severity: **P0**

- **Files**: `app/api/lms/courses/[id]/outline-apply/route.ts:1-503`
- **Problem**: 严重 **leaky-abstraction** + **bad-locality**。一个 route handler 里塞了：4 个本地 Zod schema、`applySafeMerge`（90 行带 transaction 的合并算法）、`applyReplace`（150 行带顺序保护的 replace 算法）、`findReplaceBlockers`、`loadCourseStructure`、`buildOutlineDiff`、`normalizeTitle`。完全绕开 `lib/services/`。
- **Why-it-bites**: 
  - **测不动**：算法埋在 `POST` handler 里，写单测必须造 NextRequest mock，无法直接拿 outline + course state 跑 diff。`tests/` 至今没有 outline-apply 算法测试，bug 全靠 staging QA。
  - **复用断开**：若将来 import-job 或定时任务想跑同样的 outline 合并，必须 fetch HTTP（route 调 route）或大段复制粘贴。
  - **route 跟实现耦合**：`Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]` 这种 type alias 出现在 routing layer，违反 CLAUDE.md "Route Handlers contain no business logic"。
- **Deletion test**: 删掉文件 → 复杂度 **消失**（一条 API endpoint 没了，无人调用）。但**抽出算法到 `course-outline.service.ts`** → 复杂度集中且可测；route 退化到 50 行。本是教 PR-FIX-1 之后唯一被允许"暂存于 route"的复杂业务，欠债没还。
- **Suggested direction**: 把 4 个 outline 算法函数 + Zod schema 整体迁到独立 service 文件，route 只做 parse + auth + 调用 + 返回；准备一份 outline-apply 的单测套件作为新 service 的 test surface。
- **Tests would improve**: outline diff / safe-merge / replace 三个算法可直接拿 fixture 数据测，无需 NextRequest mock；并发 publish 时的 `@@unique(order)` 临时偏移逻辑（route.ts:254-263、315-324）单独可测。

---

### F-2: 26 个 route handler 直接 `await prisma.*` —— 三层契约系统性漏水 — Severity: **P1**

- **Files**（26 个）: `app/api/lms/{sections,chapters,content-blocks,courses,task-instances,course-knowledge-sources,study-buddy,quiz-questions,tasks/[id]/{tag-questions,adaptive-quiz}}/`、`app/api/ai/{evaluate,chat,task-draft/from-context}/`、`app/api/{submissions,users/me,cron/{sweep-stuck-ai-runs,weekly-insight}}`、`app/api/teacher/study-buddy/posts/route.ts`、`app/api/auth/register/route.ts`
- **Problem**: **Leaky abstraction**。CLAUDE.md 明确 "Route Handlers contain no business logic — call Service layer"，但 29% (26/90) 的 route 里有 `await prisma.*`。常见 5 种泄漏：
  1. **二次校验查 courseId**（`sections/[id]/route.ts:39-46`、`chapters/[id]/route.ts:39-44`）—— 为算 actorRole 重复查 `prisma.section.findUnique({ select: { courseId } })`，明明 `assertSectionWritable` 已经查过同样数据
  2. **服务端校验班级归属**（`task-instances/route.ts:36-47`、`task-instances/with-task/route.ts:36-47`）—— `Course.classId === instance.classId || course.classes.some(...)` 这种业务规则在两个 route 完全重复
  3. **GET 详情查询大对象**（`task-instances/[id]/insights/route.ts:21-44`）—— 100+ 行包含 nested include、Distribution buckets、criteria stats、rubricBreakdown 解析、weakness ranking
  4. **整段算法**（F-1 outline-apply，已单独 score）
  5. **资源派生 + 校验**（`submissions/route.ts:45-51`、`ai/chat/route.ts:251-294`、`ai/evaluate/route.ts:63-89`）—— `resolveSystemPrompt` / `resolveSettingsUserId` 在 route 内直接 `prisma.taskInstance.findUnique({ select: { taskId, createdBy } })`
- **Why-it-bites**:
  - **Reviewers 无法快速判断业务边界**：哪些校验属于 route 边界（请求形态），哪些属于 service（业务规则）？此 codebase 没有强制答案，每个 route 自由发挥
  - **重复 Prisma 查询浪费 DB roundtrip**：sections/[id] PATCH 路径里 `assertSectionWritable` 查 1 次 + actorRole 查 1 次 + service 查 1 次 = 3 次同一行
  - **测试矩阵爆炸**：测 service 不够，必须再造 route-level 集成测试覆盖那些 inline 逻辑（参见 review-test 报告）
  - **未来 GraphQL / RPC 端点重建几无可能**：业务规则散落在 HTTP layer
- **Deletion test**: 删除"route 直接调 prisma"模式 → 复杂度**转移到 services**（locality 集中）；不删则**散在 26 个 route**。明显应集中。
- **Suggested direction**: 列出 26 个 leaks 的语义类别（actorRole 派生、class 归属校验、type-specific resolve），按类别下沉到对应 service 或 `lib/auth/` 新 helper（如 `loadInstanceAuthContext()`）。可分批做（不必单一 PR）。
- **Tests would improve**: 一旦 service 接管，service 单测可直接 mock prisma 验业务规则，不需要 supertest / next-test-utils。

---

### F-3: `handleServiceError` 76-case switch — Adapter 集中但 error-code 强耦合 — Severity: **P1**

- **Files**: `lib/api-utils.ts:43-252`（switch 主体 200 行）；service 端产生 68 unique throws（`grep -rh "throw new Error" lib/services/`）
- **Problem**: **Adapter seam 设计正确但实现失衡**。`handleServiceError` 本意是把 service `Error("CODE")` 转 HTTP，是教科书级 anticorruption layer。但现实：
  - **每加一个 service error 都要回头改 api-utils**：本来应该是 `Error.code` + `Error.status` 携带元数据 + 一个 4-line 默认映射，现在变成 200 行 switch
  - **错误码语义混在一起**：404 (`*_NOT_FOUND`)、400 (`*_INCOMPLETE`、`*_MISMATCH`)、403 (`FORBIDDEN`、`TASK_INSTANCE_DRAFT_NOT_VISIBLE`)、429 (`RATE_LIMIT_EXCEEDED`、`AI_FEATURE_COOLDOWN`、`AGGREGATE_TOO_FREQUENT`) 全部走同一 switch
  - **中文文案 hardcoded 在 adapter**：`"任务尚未发布"`、`"该任务已发布过实例..."` 等 60+ 处文案散在这里，**违反 i18n 边界**（service 抛 code 是对的，但文案应该来自 service 或 i18n table，不该是 adapter 任意拼接）
  - **AI provider error 特殊处理**：`getAIProviderError(err)` 提前返回，使得对 AI error 的统一处理逻辑割裂
- **Why-it-bites**:
  - **新功能加新 error 必须 grep + patch api-utils**：违反"开闭原则"。Service 改了 error code 名（很常见），不一定记得改 api-utils（默认走 500，前端看到"服务器内部错误"）
  - **测试覆盖代价高**：要测 error mapping，必须 ① 让 service 抛 code，② 让 api-utils 命中 case，③ 让 frontend 看到中文 — 三层耦合
  - **error code 不在 PR/changelog 中可视化**：68 个 string literal 散在 30+ 个 service 里，没有清单
- **Deletion test**: 删掉 `handleServiceError` switch body → 复杂度**散到每个 route**（每个 route 自己 try/catch 转 HTTP）。当前实现 better than no seam，但 **switch body 本身可以 deep-er**：用 `class ServiceError extends Error { code; status; message_zh }` + 单一 fallback。
- **Suggested direction**: 让 service 抛带 `{ code, status, message }` 的 typed exception；adapter 只做 4 行 `return error(e.code, e.message_zh, e.status)`；error code & 中文文案放回 service 层（locality 修复）。
- **Tests would improve**: error mapping 单元测试由 route-level 变 service-level；类型系统能在编译期发现"新增 code 但忘记加 message_zh"的 bug。

---

### F-4: `assertTaskInstanceWritable` vs `isAuthorizedForInstance` — 同一规则两个实现 — Severity: **P1**

- **Files**:
  - `lib/auth/resource-access.ts:96-113`（`assertTaskInstanceWritable`，throws）
  - `lib/services/task-instance.service.ts:51-58`（`isAuthorizedForInstance`，returns boolean）
  - Callers of `isAuthorizedForInstance`: `task-instance.service.ts:172,257,280,312,341`（5 处：publish / update / delete / reopen / close）
  - Callers of `assertTaskInstanceWritable`: `release.service.ts:54,102,157,209` + 0 个 route
- **Problem**: **Duplicate seams** + **Inconsistent error surface**。同一权限规则——"teacher 是 instance.createdBy 或通过 course owner/collab"——有两个实现：
  - resource-access 版抛 `FORBIDDEN` / `INSTANCE_NOT_FOUND`，可 mapping 到 403/404
  - service 版返回 `boolean`，caller 抛通用 `FORBIDDEN`（丢失 404 语义、丢失 reason）
  - 行为略有差异：service 版只查 `CourseTeacher`（不调 `assertCourseAccess`），不识别 admin（admin 走 `createdBy === userId` 条件就 false，得退到 caller 自己判断或漏处理）
- **Why-it-bites**:
  - **schema 微变会让两边 drift**：如未来加 "co-creator" 角色，必须改两处
  - **测试不能共享**：写一组 fixture 测 `assertTaskInstanceWritable`，对 `isAuthorizedForInstance` 不适用
  - **生产 bug 风险**：admin 调用 `task-instance.service.ts deleteTaskInstance` 时 `isAuthorizedForInstance` 返回 false → 直接 FORBIDDEN，**实际上 admin 应该能删** — 这是一个潜在 latent bug，被 `assertX` 路径上游兜底（route 调 service 前先调 assert）才没暴露
- **Deletion test**: 删除 `isAuthorizedForInstance` → 改用 `assertTaskInstanceWritable`，复杂度**消失**且修复 admin bug；不删则两实现继续 drift。Earnings keep: 0。
- **Suggested direction**: 把 5 处 service caller 改用 `assertTaskInstanceWritable`，删除 `isAuthorizedForInstance`。Caller 由"`if !isAuth() throw FORBIDDEN`"变"`await assertX()`"（throw 走同样的 mapping）。
- **Tests would improve**: 现有 `assertTaskInstanceWritable` 测试自动覆盖 publish/update/delete/reopen/close；admin 行为得以正确测试。

---

### F-5: 审计日志(`logAudit*`) 散在 routes 和 services 两端 — Severity: **P1**

- **Files**:
  - `audit.service.ts:1-104`（提供 `logAudit` / `logAuditForced` / `listAuditLogs`）
  - Routes 调 audit 28 处：`lms/{sections,chapters,courses,content-blocks,course-knowledge-sources,courses/[id]/classes}/**`、`lms/task-instances/with-task/route.ts`
  - Services 调 audit 29 处：`course.service.ts`、`task.service.ts`、`task-instance.service.ts`、`release.service.ts`、`grading.service.ts`、`async-job.service.ts`、`question-bank.service.ts`、其他
- **Problem**: **Bad locality** + **shallow abstraction**。`logAudit*` 接口本身很薄（4 字段的 wrapper）。问题不在 service 本身，而在**调用方分布**：
  - chapter PATCH 的 audit 在 `app/api/lms/chapters/[id]/route.ts:48-55`，**但** chapter DELETE 的 audit 也在 route 而不是 service 内（同一 service `deleteChapter` 不写 audit）
  - course UPDATE audit 在 route（`lms/courses/[id]/route.ts:66-72`），course DELETE audit 在 service（`course.service.ts:453-459`）—— **同一资源两种 audit 写法**
  - actor role 计算（`getCourseActorRole`）总是在 route 里被算出来塞进 audit metadata（多 1 次 DB 查询），service 内的 audit 从不带这字段
- **Why-it-bites**:
  - **audit 完整性靠 reviewer 记忆**：新增写入操作不写 audit 不会被任何 lint / type-check 抓到；coordinator review 时也容易漏
  - **合规追责语义不一致**：`course.update` 带 actorRole（owner/collaborator/admin），`grade.update` 不带 — 同一审计表的 metadata 字段半统一
  - **route-level audit 拿不到事务上下文**：在 route 里写 audit 不在 service 的 transaction 里，theoretical 主操作回滚 ≠ audit 回滚
- **Deletion test**: 删除"在 route 写 audit"模式 → 全部下沉到 service，**locality 集中**且 transaction-safe；service 不能拿 actorRole 是问题，但 actor + role 可以 caller pass 进来。删除 audit.service.ts 本身？28+29 处 caller 需要自己拼 prisma.auditLog.create，**散开**。所以 audit.service 应该保留，但调用点应该集中。
- **Suggested direction**: 强制约定"audit 只在 service 里写"；为需要 actorRole 的 audit 加 `actor: { id, role, courseRole }` 参数；route 退出 audit business。route 仅在 service 抛错时 NOT 写 audit（已经天然如此）。
- **Tests would improve**: 写 service 单测时同步验 audit 行（service 内 mock prisma 的 auditLog.create）—— 这本来该有；目前 route-level audit 没法在 service 单测里测。

---

### F-6: 共享 Zod schema 利用率 10% (9/90 routes) — Severity: **P2**

- **Files**: 仅 `app/api/{tasks,tasks/[id],auth/register,lms/task-instances,lms/task-instances/with-task,lms/task-instances/[id],ai/evaluate,submissions,submissions/[id]/grade}/route.ts` 9 处用 `lib/validators/{auth,submission,task}.schema.ts`。其余 81 routes 都 inline 写 `z.object({ ... })`。
- **Problem**: **Shallow validation layer**。`lib/validators/` 只有 3 个文件（`auth`、`submission`、`task`），剩下的 chapter / section / contentBlock / group / studyBuddy / aiToolSetting / weeklyInsight 等都 inline。inline 不是错，但**关键约束分散**：
  - `assetAllocationSchema` 在 `lib/validators/submission.schema.ts`，正确被 `ai/evaluate/route.ts:5,26` 复用；同一 allocation 结构在 `ai/chat/route.ts:54-69` 又 inline 写了一份（含 `MAX_ALLOCATION_*` 常量）—— **drift 风险**
  - `lms/courses/[id]/outline-apply/route.ts:9-61` 的 `outlineDraftSchema` 在 route 内定义（80 行），其他可能想引用此结构的人无从复用（如 `ai/task-draft/from-context`）
- **Why-it-bites**:
  - **schema 演进不一致**：同一 allocations 增字段时，两个地方都要改且没机制提醒
  - **OpenAPI/类型导出缺位**：前端 typedef 现在靠手维护，本可以 `z.infer<typeof schema>` 共享
- **Deletion test**: 删 `lib/validators/` → 9 个 route 移回 inline，复杂度**散开但有限**（每个 route 只多 10-30 行）。Earnings keep: 比较弱，shallow seam 真实价值不高。
- **Suggested direction**: 不强求所有 schema 集中，但**至少把跨 route 复用 ≥2 次的 schema** 提到 validators（`allocationsRequestSchema` 是首选）。outline schema 可移到 service。
- **Tests would improve**: schema 单元测试代替 route-level "传 bad input 期望 400" 的重复测试。

---

### F-7: `getCourseActorRole` 召回 + audit + ctx 数据三次查同一行 — Severity: **P2**

- **Files**:
  - `lib/auth/actor-role.ts:13-30`
  - 调用点：`app/api/lms/{chapters/[id],sections/[id],courses/[id],content-blocks/[id],sections,chapters,content-blocks}/route.ts` + `course-knowledge-sources/[id]/route.ts`
- **Problem**: **Bad locality + redundant DB roundtrip**。Pattern 见 `chapters/[id]/route.ts:36-46`:
  ```
  await assertChapterWritable(id, user)   // 查 chapter (1)
  const chRec = await prisma.chapter.findUnique({ where: { id }, select: { courseId } })  // 查 chapter (2)
  const actorRole = await getCourseActorRole(chRec.courseId, user.id, user.role)  // 查 course (3)
  await updateChapter(id, parsed.data)   // 查 + update chapter (4)
  await logAuditForced({ ..., metadata: { actorRole } })  // insert audit
  ```
  4 个 DB 调用，3 个 SELECT 同一 chapter 或它的关系链。
- **Why-it-bites**: 不致命，但 PATCH 高频被前端用（编辑章节标题滚动每键触发 debounce 保存），每次多 2-3 次 SELECT；admin 路径甚至会查 course 表（actor-role 中 `prisma.course.findUnique` + `prisma.courseTeacher.findUnique`）。生产 DB 多 ~5 倍 SELECT 量。
- **Deletion test**: 删 `getCourseActorRole` 单独函数 → 把 actorRole 推断**整合**进 `assertX` 返回值（同次查询就能算）。复杂度**消失**且少 1 个 roundtrip 每路径。
- **Suggested direction**: 让 `assertChapterWritable` / `assertSectionWritable` / `assertContentBlockWritable` 返回 `{ courseId, actorRole }`；route 拿来直接塞 audit metadata；删除独立 `getCourseActorRole` 文件或保留为 helper 但不在 route 单独调用。
- **Tests would improve**: 同一 fixture 一次测 auth + role-derivation，不再写两组测试。

---

### F-8: `app/api/lms/study-buddy/analytics/route.ts` + `task-instances/[id]/insights/route.ts` — 100+ 行 GET 聚合在 route — Severity: **P2**

- **Files**: 
  - `app/api/lms/study-buddy/analytics/route.ts:50-138`（90 行 grouping + AI summary）
  - `app/api/lms/task-instances/[id]/insights/route.ts:21-159`（140 行 distribution + criteriaStats + weakness ranking）
- **Problem**: **Leaky abstraction**（同 F-2 子类）。两个 route 都做 readonly 聚合计算（Map grouping、percentile bucketing、按 dim 排序），但代码不在 service。
- **Why-it-bites**: 同 F-1/F-2。这两个 GET 聚合不像 F-1 outline-apply 那么爆炸，但每个都有"看 fixture 跑算法"的需求（test surface 不可达）。
- **Deletion test**: 删 route → 聚合移到 service，**locality 集中**；不删则继续散。
- **Suggested direction**: 在 `analytics-v2.service.ts`（已有 KPI 计算逻辑）或新 `study-buddy.service.ts` 中加 `computeCourseStudyBuddyAnalytics()` / `computeInstanceInsights()`；route 退化到 30 行。
- **Tests would improve**: bucket / weakness ranking / rubricBreakdown 聚合 可以直接用 fixture 测，不依赖 prisma 真表。

---

### F-9: Service 内 `throw new Error("CODE") as Error & { extras }` 附带额外字段，但 adapter 忽略 — Severity: **P2**

- **Files**:
  - `lib/services/course.service.ts:440,447`（`COURSE_HAS_INSTANCES.instanceCount`、`COURSE_HAS_CHAPTERS.chapterCount`）
  - `lib/services/task.service.ts:242,414`（`TASK_HAS_GRADED_SUBMISSIONS.gradedCount`、`TASK_HAS_INSTANCES.instanceCount`）
- **Problem**: **Lossy adapter**。Service 通过 `as Error & { instanceCount?: number }` 给 caller 附额外字段，但 `handleServiceError`（`api-utils.ts:159-179`）只回 hardcoded 中文 `"该任务已发布过实例..."`，**忽略 instanceCount**。前端拿不到具体数字。
- **Why-it-bites**: 前端没法显示"还有 12 个 instance 需要先关闭"。这些 service 加 instanceCount 显然是有人有这意图，但 adapter 接口设计没法传过去。这是 seam 设计不足导致的死代码。
- **Deletion test**: 删 `extras` 字段 → 无变化（adapter 不读）；改 adapter 用 `validationErrorWithCode` + 模板字符串 → extras 派上用场，前端体验提升。
- **Suggested direction**: 把 service error 改成 typed exception（同 F-3），`details` 字段标准化进 ServiceError；adapter 透传给 `validationError(message, details)`。
- **Tests would improve**: 增 service 单测 verify `error.details.instanceCount`；前端测试可断言 toast 内含数字。

---

### F-10: Components 与 service 类型双向耦合（轻度 — 多数情况合理） — Severity: **P2**

- **Files**: `components/analytics-v2/{study-buddy-block,risk-drawer,task-performance-block,kpi-row,evidence-drawer,teaching-advice-block,analytics-v2-dashboard}.tsx` 7 个组件 `import type { ScopeXXX } from "@/lib/services/scope-insights.service"`
- **Problem**: **Mild leak — but plausibly OK**。Component 通过 `lib/services/*` 拉 type，等于把 server-side data shape 当 component prop type 用。优点：避免手抄；缺点：service refactor 直接影响 frontend rebuild。**整体看属于轻度负债，不致命**。
- **Why-it-bites**: 当 service 重构（如把 `ScopeStudyBuddySummary` 拆字段），即使只是 server-internal 改动，components 也要随之改。但**实践证明**这套 shape 演化稳定（review-recent 报告应该验证）。
- **Deletion test**: 删除 component 直接 import service type → 复杂度**转移**到 shared `lib/types/`（增一份 `analytics.types.ts`）。Earnings keep: 中等，重构后 service 内部更自由。
- **Suggested direction**: 不紧迫，但若将来 service 要重构再考虑提到 shared types。当前可不动。
- **Tests would improve**: 不显著。

---

## Anti-findings（看起来像问题但其实合理）

### A-1: `requireAuth` / `requireRole` 返回 `{ session, error }` discriminated union 而非 throw

看起来不太"现代"，但实际是 **Next.js Route Handler 的 idiomatic pattern**：early `return result.error` 让 Next 把 NextResponse 直接送回。如果改 throw，必须在每个 route handler 上层包 try/catch + 把 401/403 转 response。当前模式更直观、更难误用（type-system 强制处理 error）。保留。

### A-2: 9/90 route 用 shared validators, 81 inline

F-6 标 P2 是因为：很多 inline schema 真的是 endpoint-specific（如 `ai/task-draft/from-context` 的 schema 涉及 15 个嵌套 z.object，明显只服务这一个端点）。**不强求集中**是对的；只是关键复用资源（allocations / outline）应该统一。

### A-3: SimulationRunner (1977 行) / TaskWizardModal (1490 行) 看起来 "巨石组件"

实际它们是 **fat-but-coherent**：state 多但都围绕一个流程（聊天 / wizard 步骤）。Prop 数 5-8 个不爆。把它们拆是常见反模式——拆完每个子组件都要 prop-drill 8 个 callback。当前结构 deep + 单一用途，**Earnings keep: 强**。保留。

### A-4: `analytics-v2.service.ts` (2433 行) 单文件巨大

直觉上想拆，但实际全是 KPI / 趋势 / 分布的 cohesive 聚合代码，依赖关系密。强行拆 → 5 个文件互相 import。**保留**。可考虑按 KPI 子域分文件，但**先 fix F-1/F-2/F-3 拿到更大回报**。

### A-5: 33 个 service 名字（如 `weekly-insight.service.ts`、`scope-drilldown.service.ts`）拆得很细

看起来 service 数量多，但都对应一个明确职能域，**没有发现 shallow CRUD wrapper** 类型的 service。Group / storage / audit 是少数较薄的，但都有合理边界（group 有 transaction、storage 是 strategy pattern hook、audit 有 forced/optional 双口）。**保留**。

---

## Cross-cutting hunches（留给其他 reviewer 参考）

### H-1 → review-test
F-1/F-2/F-8 提到 "测不动" 的算法都在 route 里：outline-apply diff、insights bucket、study-buddy analytics group。我猜 `tests/` 没有覆盖这三处算法，review-test 可统计未被单测的"算法函数"列表。

### H-2 → review-security
F-4 提到 `isAuthorizedForInstance` 不识 admin（潜在 latent FORBIDDEN bug）。review-security 验下 admin 路径在 publish/update/delete/reopen/close 是否真有问题；同时 F-2 列的 26 个 route 都是攻击面的关键点（直接查 prisma 容易绕过 auth + scope 检查）。

### H-3 → review-data
F-3 列的 68 个 error code 反映 schema 的状态机复杂度。review-data 可对照 schema.prisma 检查哪些状态转换（`draft → ready → approved → published`、`processing → ai_summary_failed`）真有 DB constraint vs 仅靠 service 校验。

### H-4 → review-recent
F-1 outline-apply 是 PR #12 期间的产物（chapter slot / structuredData 相关）。review-recent 应特别 review 这块，看 PR 后期是否本来打算抽 service 但 deadline 砍掉了。

### H-5 → review-ai
F-3 中 `getAIProviderError` 在 adapter 里手扒 provider-specific `data.error.code/type`，这是 AI provider system 的反向耦合（adapter 知道 provider 内部）。review-ai 看看 provider 抽象是否能 own 自己的 error mapping。

### H-6 → review-pr13
PR #13 56 文件 / 5234 行未合并。review-pr13 重点验：① 是否引入新的 route-level prisma usage（加重 F-2）；② 是否新增 `assertX` 路径产生新的 duplication（同 F-4 风险）；③ 是否新加 service throws 没回头改 api-utils（默认 500 风险，F-3）。
