# Review — PR #12 12-unit 新增模块质量 (r1)

## Reviewer charter

独立审查 PR #12（commit `f2365b7`，27 commits squash）引入的 12 unit 新增/改造模块的质量 — 重点回答"堆 vs 模块化"、横切关注点是否真"around-pattern"、taskSnapshot 是否真 type guard、IRT 是否真"引擎"、structuredData 是否真 schema。Scope 限 PR #12 涉及的新代码与改造点；不评演示数据正确性、UI 文案细节、ops。

## Method

- 读 `gh pr view 12` + `git show --stat f2365b7`（644 files / +42608 / -1056）
- 读 `.harness/HANDOFF.md`（11 条承诺兑现表）+ `.harness/spec.md`（Report Format）
- 关键源码：
  - `lib/utils/task-snapshot.ts`（Unit 17 snapshot resolver）
  - `app/(student)/tasks/[id]/page.tsx` + `app/(simulation)/sim/[id]/page.tsx`（snapshot 消费）
  - `lib/services/task-instance.service.ts`（snapshot 创建 + status 转换）
  - `lib/services/ai.service.ts`（AiRun 横切关注点 + reasoning fetch interceptor + evidence retry，lines 395-509、1538-1736）
  - `lib/services/quiz-adaptive.service.ts`（IRT v1 引擎）+ `app/api/lms/tasks/[id]/adaptive-quiz/next/route.ts` + `app/api/lms/quiz-questions/[id]/check/route.ts`
  - `lib/services/quiz-question-tagger.service.ts`（knowledgeTagIds 离线打标 + byId/byIdx fallback）
  - `lib/services/course-knowledge-source.service.ts`（structuredData 写入 + outline retry）
  - `app/api/lms/courses/[id]/outline-apply/route.ts`（structuredData 消费 + replace 模式）
  - `components/course/course-context-sources-tab.tsx`（structuredData 渲染 + `hasOutlineDraft` 推断）
  - `lib/services/study-buddy.service.ts`（excerpt 持久化 + 自由问 + 跨课程 scope）
  - `lib/services/task-build-draft.service.ts` + `app/api/lms/task-instances/with-task/route.ts`（approved 状态机 + atomic publish）
  - `lib/services/audit.service.ts` + `lib/services/ai-usage.service.ts` + `lib/services/ai-throttle.service.ts`（AI 留痕配套）
  - `lib/services/weekly-insight.service.ts`（emptyState + classifyAiErrorSummary）
  - `lib/services/scope-insights.service.ts`（analytics-v2 skillGoals 字段，lines 920-995）
  - `components/quiz/quiz-adaptive-runner.tsx`（IRT runner 消费）
- 单测目录扫描：`tests/quiz-adaptive-engine.test.ts`、`tests/task-snapshot-helper.test.ts`、`tests/ai-run-tokens.test.ts`、`tests/task-build-drafts-approve.api.test.ts`、`tests/sim-evidence.test.ts`

## Top findings（按 severity 排序）

### F-1: taskSnapshot 是 shallow 字符串拷贝 + `as T` cast，缺真 type guard — Severity: P1

- **Files**: `lib/utils/task-snapshot.ts:24-43`, `lib/services/task-instance.service.ts:97-118` (`JSON.parse(JSON.stringify(taskForSnapshot))` × 2 处), `app/(simulation)/sim/[id]/page.tsx:147-151` (`(task as any).simulationConfig`)
- **Problem**: **Leaky abstraction / shallow validation**。`resolveTaskForRunner` 看似有 `isValidSnapshot` 守卫，但守卫只检查 `taskName: string && length > 0`；通过后直接 `as T` cast 把 unknown JSON 当强类型 `task`。结果：
  - sim runner 走 `(task as any).simulationConfig`（明确 `any` cast，TS 没保护）
  - task 页 runner 读 `resolvedTask.quizConfig.mode === "adaptive"`、`resolvedTask.subjectiveConfig.allowedAttachmentTypes.length` 等深层字段，全靠 snapshot 写入时的形状跟 live schema 一致；schema 演化后老 snapshot 任何字段都可能 undefined 但 TS 看不见。
  - snapshot 创建用 `JSON.parse(JSON.stringify(taskForSnapshot))`（拷贝时点 include 的 task tree），Date 字段会被序列化成字符串 → runner 端如果有 Date 读取会无声 NaN。已经看到 runner 没用 task 的 Date，但这是一颗未爆雷。
- **Why-it-bites**: 演示安全（"task 模板改动不影响 in-flight instance"）是 PR #12 11 大承诺之一；当前实现等于"Trust me, the JSON shape never changed"。下次给 `QuizConfig` 加非空字段（比如 Unit 8 后又加 `passingScore`），老 snapshot 没这个字段 → runner code path `task.quizConfig.passingScore` 跑 undefined → 学生看到 NaN 或 crash。`tsc --noEmit` 通过，但 runtime 死。这正是 CLAUDE.md "Prisma Gotchas" 说的"tsc 不会报错"陷阱的另一形态。
- **Deletion test**: 删除 `resolveTaskForRunner`，runner 直接读 `instance.task`（live）→ 复杂度消失，但 Unit 17 承诺也消失。**承诺成立** → 应该深化 abstraction 而非删除：snapshot 需要 versioned schema + 严格 zod 反序列化 + 显式 migrate path。当前 abstraction 既不 deep（type-unsafe）也不 shallow（多了一层但没真保护）— 介于两者间最糟位置。
- **Suggested direction**: 把 snapshot 变成 versioned blob（`{ version: 1, task: {...} }`），用 zod schema 在写入时校验、在读取时反序列化；schema 演化按 v1→v2 迁移函数显式补字段。`taskSnapshot` 类型 narrow 到 `TaskSnapshotV1 | TaskSnapshotV2`，runner 端走 discriminated union — TS 真正帮你看到字段缺失。
- **Tests would improve**: `tests/task-snapshot-helper.test.ts` 当前测的是"有 taskName → 走 snapshot；没有 → fallback live"，等于测了一个空守卫。改成 versioned schema 后可以测：v1 snapshot + 新 runner（v2 schema）→ 走 migrate；migrate 失败 → fallback live + 打 warn。

---

### F-2: structuredData 是 JSON blob，全链路用 `unknown` + ad-hoc 类型推断 — Severity: P1

- **Files**: `prisma/schema.prisma:895` (`structuredData Json?`), `lib/services/course-knowledge-source.service.ts:84` (interface 字段 `structuredData: unknown`), `app/api/lms/courses/[id]/outline-apply/route.ts:40-61` (`outlineDraftSchema` 在 route 内定义，与 service 内 `outlineDraftSchema` 是**两份独立的 schema**), `components/course/course-context-sources-tab.tsx:670-712` (UI 又定义了第三份 `OutlineDraft` type + `hasOutlineDraft` 自定义守卫)
- **Problem**: **Bad locality / type duplication / no single source of truth**。同一概念（outline draft）有 3 个 schema 定义：
  1. `lib/services/course-knowledge-source.service.ts:27-68` — service 写入 schema（含 `learningGoals`/`taskSuggestions` 全字段）
  2. `app/api/lms/courses/[id]/outline-apply/route.ts:30-61` — route apply schema（含 `chapterId`/`sectionId` 但 catch fallback 的字段不一样）
  3. `components/course/course-context-sources-tab.tsx:676-703` — UI render type（仅 chapter/section/taskSuggestions 核心字段，省了 valueObjectives）
- 三处独立漂移：service 写"完整版"，route apply 接收"带 ID 版"，UI 渲染"缩略版"。`structuredData` 在 Prisma 一律是 `Json?` / `unknown` — 任何字段缺失或重命名，TS 完全无感，只在 runtime 走到那个分支才暴。
- **Why-it-bites**: 演示视频核心承诺"AI 自动识别文件结构提取章节知识点"完全围绕 structuredData 转 — outline-apply 的 replace 模式还要在 DB tx 内删/重排 Chapter/Section。如果哪天 service 端 schema 升级（加 `learningOutcomes`），route 端不知道、UI 端不渲染，老师在 UI 看见的"AI 解析结果"跟 DB 里持久化的不是同一份。已经看到 outline-apply route schema 把字段单独维护 + `.catch([])` 兜底 → 老 DB JSON 不匹配新 schema 时是**静默 fallback 到 `[]`**，老师再点"应用大纲"时 chapter 全是空 sections，但**没有错误提示**。
- **Deletion test**: 删除 structuredData 字段（让 outline 解析直接落 Chapter/Section 表）→ 复杂度大部分**消失**（解析结果 = DB 表，无中间态），少部分**分散**到"草稿态 chapter"的状态字段。此模块当前更接近"中间态 JSON blob 做缓冲"，但 3 处 schema 漂移说明缓冲已经付出沉重代价。**Worth simplifying。**
- **Suggested direction**: 把 outline schema 提到 `lib/validators/outline-draft.schema.ts` 单源（service / route / UI 三处 `import` 同一 zod schema + 推导的 TS 类型）；UI 用 `schema.parse(source.structuredData)` 替代手写 `hasOutlineDraft` 守卫；Prisma 字段 type 仍 `Json?` 但 service 层 `select` 后立刻 parse 成强类型 outline。第二步可考虑把 outline 落表（脱离 JSON blob）— deletion test 后该选项更值得评估。
- **Tests would improve**: 当前 `tests/outline-apply-replace.test.ts` 只测 mode 行为；加 schema drift 测试（旧 DB JSON 缺新字段时 service 端应 throw 明确错而不是 `.catch([])`）会暴露 3 处漂移。

---

### F-3: AiRun 横切关注点已模块化进 `aiGenerateText` / `aiGenerateJSON`，但**所有 metadata、settingsUserId、provider override 都靠 caller 显式传** — Severity: P1

- **Files**: `lib/services/ai.service.ts:395-509` (`createAiRun` / `finishAiRun` + `estimateCostUSD` 私有), `lib/services/study-buddy.service.ts:209-220` (metadata 手写), `lib/services/weekly-insight.service.ts:466-509` (查 latestRun token 是 fragile race), `lib/services/course-knowledge-source.service.ts:444-453` + `474-489` (metadata 三份独立写)
- **Problem**: **Shallow leverage / leaky abstraction**。AiRun 持久化本身做到了模块化 — 只有 `ai.service` 内调 prisma — 这是好的。但**配套 metadata 上下文（feature scope、entity ID、course/task/post ID、isFreeForm、preview flag、parser tag 等）每个 caller 手工塞进 `options.metadata`**。审计场景诉求是"看到一条 AiRun 能知道是谁、为什么、关联哪个对象" — 当前 schema 字段（toolKey/feature/userId/provider/model）只覆盖前三个，关联对象一律压在 `metadata: Json?` 里。
  - `weekly-insight.service.ts:491-509` 居然在 AI 调用**之后**用 5 秒 createdAt 窗口去 `findFirst` 查 latestRun 拿 token — 不是 callback，是基于时间戳的 race 反向查询。多并发请求（同一 teacher 同 feature）会拿错。
  - cost estimation `COST_PER_1K_TOKENS` 表硬编码在 ai.service.ts:440-452，缺失模型回退 null（"未知成本"），扩 provider 必须手改这个表 — 没有 seam。
  - rate limit `checkRateLimit` 是进程内 Map（line 514-533），多实例部署无效；comments 提到这一点（"in-memory dev/demo 适用"），ai-throttle.service 同问题（line 11）。
- **Why-it-bites**: 演示承诺"AI 调用全程留痕（/teacher/ai-usage + /admin/audit + tokens/cost/summary）"成立，但运营时若想加新维度（比如"按 course 聚合成本"），必须改每个 caller 的 metadata 调用点 + 假设 metadata 字段没漂移。weekly-insight 的"reverse-lookup latest AiRun"在 staging 串行环境能跑、prod 并发跑必撞。`assertAiFeatureCooldown` 进程内 Map 在 serverless 多实例下完全无效（comment 自己承认），但没有 escape hatch — 哪天迁到 Cloud Run 多副本部署 force=true 流控直接失守。
- **Deletion test**: 删除 createAiRun/finishAiRun → 复杂度**消失**（不写 AiRun）但承诺消失。**承诺成立**，模块也实际写到了一个地方（locality 好），seam 较深。问题不是"该不该有"，是"接口太 narrow"导致 caller 把上下文压在 free-form metadata。**深化 abstraction**：把 feature → entity 关联做成显式字段（taskInstanceId、courseId、postId 全提到 AiRun schema 一级字段），caller 传强类型 context 对象而不是 free metadata；reverse-lookup 换成 callback 返回 run id 给 caller。
- **Suggested direction**: AiRun schema 加 `relatedEntityIds Json?` 替代散落 metadata；`aiGenerateText` 返回 `{ text, usage, runId }` 让 caller 直接拿 runId 写额外字段，杜绝 weekly-insight 那种反向时间戳查询。rate-limit / throttle 抽出 store 接口（in-memory 当默认实现，prod 注入 redis/db 实现）— seam 留好。
- **Tests would improve**: `tests/ai-run-tokens.test.ts` 验证 token 写入路径；当前没有"并发 2 个 force=true 同 teacher 同 feature"的 race 测试。加这个会暴露 in-memory throttle 和 weekly-insight latest-AiRun 反查的双重 race。

---

### F-4: IRT 引擎是纯函数 + clear seam，但叫"引擎"略夸大 — Severity: P2

- **Files**: `lib/services/quiz-adaptive.service.ts:1-288`, `app/api/lms/tasks/[id]/adaptive-quiz/next/route.ts`, `app/api/lms/quiz-questions/[id]/check/route.ts`
- **Problem**: **Seam OK / Naming-leverage 不匹配**。
  - 命名"IRT 引擎"（HANDOFF.md / PR body 都用 "IRT 引擎 + adaptive quiz 模式"），但实现是纯规则 — 头注释自己写"纯规则 v1（贝叶斯放 Phase 4 if needed）"；ability 公式是 `prev ± typeCoef × rawDiff/10 × step`，连 Rasch/2PL 都不是。这是"规则启发式"，叫 IRT 是过度营销。
  - 真正模块化做得不错：`buildAdaptiveState` / `selectNextQuestion` / `shouldStop` / `buildMasteryReport` 全是纯函数（input → output），route 是无状态拼接器（line 71-141）。Seam 很清晰：换"真 IRT"只需替换 `updateAbility` 实现，其他 4 个函数无关。
  - 缺陷：route 内的"fallback to fixed"判定写死 `taggedCount / total < 0.5`（line 99-114），这条边界本应是引擎的 policy（"什么时候放弃 adaptive"），但被泄到 route 里。多个消费点（runner / 教师 preview）会复制这个阈值。
  - check-answer 端点 short_answer 一律返回 `correct: true`（line 75-81），mastery 报告就基于这个"非空即对"训练。引擎本身没问题，但靠它产出的 mastery 结论对 short_answer 占比高的题库就漂移。
- **Why-it-bites**: 命名是"和用户/未来开发者的契约"。叫 IRT，未来人会以为有 item difficulty parameter + latent ability variable + likelihood update — 实际是个 step-based heuristic。换真 IRT 时若没有 evaluation harness（保留旧规则下的"诊断准确度"benchmark），改完无法验证哪个更好。fallback 阈值散在 route 是温和的复制粘贴风险，但目前只一处消费，**当前 P2 而非 P1**。
- **Deletion test**: 删除整个引擎 → adaptive 模式消失，蜕化到 fixed quiz。复杂度**消失**（4 个文件 + 一个 schema 字段 + tagger pipeline 全消失），分散度为 0。承诺成立但**功能价值与 fixed quiz 差距有限**（演示视频 IRT 仅产出"薄弱知识点报告" — 报告本身可用 fixed quiz 通过题目-知识点关联离线产生）。Borderline keep — 看演示落地后是否真在用。
- **Suggested direction**: 改名（"自适应规则引擎"or"Heuristic Adaptive v1"），把 fallback 阈值移进引擎暴露 `recommendFallback(bank, config): { fallback: boolean, reason: string }`。短期不动算法。
- **Tests would improve**: `tests/quiz-adaptive-engine.test.ts` 已经测了引擎纯函数 — 这是 seam 留好的副作用。把 fallback 阈值移进引擎后单测覆盖率会自然上升，route 测试简化为"路由 ↔ 引擎契约"。

---

### F-5: TaskBuildDraft `approved` 状态机 + `markTaskBuildDraftPublished` atomic update 是 PR 里最深的抽象，但 `assertDraftScope` 与 `assertKnowledgeSourceScope` 各写一份相似的 chapter/section 父子校验 — Severity: P2

- **Files**: `lib/services/task-build-draft.service.ts:206-225` (conditional update on `where: { id, status: "approved" }` + P2025 映射), `lib/services/task-build-draft.service.ts:236-263` (`assertDraftScope`), `lib/services/course-knowledge-source.service.ts:109-165` (`assertKnowledgeSourceScope` — 同样校验 chapter.courseId / section.chapterId)
- **Problem**: **Locality 矛盾 — atomic-publish 很好；scope 校验重复**。
  - 亮点：`markTaskBuildDraftPublished` 用 Prisma conditional update + P2025 → `TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH` 是这个 PR 里最干净的 "atomic state transition" 实现；接受 optional `tx` 参数让外部包同一 transaction，杜绝"flip 失败 instance 已建"半残（`with-task/route.ts:65-69` 用法是教科书级别的 atomic publish）。
  - 但 `assertDraftScope` 和 `assertKnowledgeSourceScope` 写两份内容几乎一致的校验（course→chapter→section 父子关系）— 知识素材和任务草稿是不同业务对象，但 scope 校验是同一概念。同一 PR 里两份都新增 / 改动，**没有共享 helper**。
  - `TaskInstance` 的 scope 校验（chapterId/sectionId/classId/courseId 一致性）又散在 `with-task/route.ts:31-47`（class-course 匹配）+ `assertKnowledgeSourceScope` 里的 `taskInstanceId` 校验 — 第三份。
- **Why-it-bites**: 校验逻辑一改就忘 — 比如 PR #12 给 Course 加了 `classes: CourseClass[]` 多班级关联，scope 校验里需要"class ∈ course.classes"而不仅是 `course.classId === class.id`；`with-task/route.ts:44-47` 处理了，`assertDraftScope` 没处理（不需要因为它只校验 course/chapter/section 父子，不校验 class）；但**这种"我哪里需要校验什么"的判断当前散在 3-4 处**，下次加 group/section 关联会出**遗漏一处的 inconsistency bug**。这种 bug Codex 已经在 PR #12 review 里抓了 1 P0 + 多 P1（HANDOFF "cross-course over-match" 说的就是这类），但根因 — scope 校验没单一来源 — 没修。
- **Deletion test**: 不能删（校验是 authorization 主轴）。但**抽公共 helper**：`assertScopeHierarchy({ courseId, chapterId?, sectionId?, taskId?, taskInstanceId?, classId? })` 替代 3 处分散校验。删除后复杂度**消失**到一个地方而不是分散 — 标准 "抽 helper" deletion test 通过。
- **Suggested direction**: 把 scope 校验抽到 `lib/auth/resource-scope.ts`（与 resource-access 旁边），覆盖所有 entity 的父子 + class 关联校验；service 端 caller 全走它。
- **Tests would improve**: `tests/resource-access.test.ts` 已经在测 instance-level access；加 resource-scope 后可以单测"chapter.courseId mismatch、section.parentChapterId mismatch、taskInstance.taskId mismatch"等 8-10 个 corner case，替代当前散在各 service 单测里的 scope-specific 小测。

---

### F-6: `app/teacher/tasks/[id]/page.tsx` 1072 行（编辑模式 inline 控件 + 拦截 dialog + 复制为新任务 + handler 一大坨） — Severity: P2

- **Files**: `app/teacher/tasks/[id]/page.tsx`（PR 内 +900 行）
- **Problem**: **Bad locality** — 单文件汇集了多个 unit 的改动（Unit 4 commit-1 拦截 + commit-2 编辑控件 + Unit 4 r2 allocation + Unit 17 taskSnapshot 验证 UI 钩子）。`buildPatchBody` / `performPatch` / `handleForceSave` / `handleCopyAsNew` 都是大状态依赖（`editing`/`editQuestions`/`editCriteria`/`editAllocations` ...），客户端 React 组件文件 1k 行没拆 sub-component。
- **Why-it-bites**: PR body 注释说"用 page 内 inline 编辑控件而非 WizardStepQuiz 重用，理由是 wizard 为 create 流程，inline 编辑器代码量与之相当但耦合面小" — 这个判断本身合理，但**没有走另一条路**：把 inline 编辑控件提取成 `TaskInlineEditor` per type（quiz / sim / sub）的 sub-component。当前所有 editing state 散在顶层 `useState` → 加新字段必须改顶层。下次 task type 演化（比如加新类型 `coding`）这个文件直接破 1500 行。
- **Deletion test**: 不能删（这是核心教师工作流页面）。但**拆 sub-component**：每个 task type 一个编辑器组件 + 一个 high-level wrapper page。删除原 page 后复杂度移到 3 个有意义的 sub-component（quiz/sim/sub editor）— 集中 → 分组而非分散，**通过 deletion test**。
- **Suggested direction**: 拆 `TaskQuizEditor` / `TaskSimEditor` / `TaskSubEditor`，state hoist 到各自；page 只做"加载 task → router 编辑器 → 提交"。
- **Tests would improve**: 当前 e2e `qa-unit4-task-editing.spec.ts`（390 行）是 page 行为级；拆后能写单测覆盖单个 editor 的 add/delete/reorder logic（无需启 dev server）。

---

### F-7: Study Buddy excerpt 持久化在 messages JSON 里，无 schema validation 进入 — Severity: P2

- **Files**: `lib/services/study-buddy.service.ts:139` (`messages as StudyBuddyMessageRecord[]`), `lib/services/study-buddy.service.ts:223-231` (写 contextSources 进 messages), `prisma/schema.prisma:671` (`messages Json?`)
- **Problem**: **Shallow type, no validator boundary**。`StudyBuddyMessageRecord` 是 service 文件内 type alias（line 12-24），cast 路径是 `(post.messages as StudyBuddyMessageRecord[]) || []`。没有 zod 解码，老 message 数据若结构漂移（PR-7B 之前的 message 格式可能缺 `contextSources`/`excerpt`）会无声混入。多端写 messages（`createPost`/`continueConversation`/`generateReply`），消费端（学生 SB 页面 / 教师 SB 查看）也各自 cast。
- **Why-it-bites**: 学生 UI 渲染 `excerpt` hover popover；老 post 没 excerpt 字段，UI 静默 fall through 到 "无引用素材" — 但其实数据库有 referencedSources，只是字段名漂了，老师会觉得"AI 没引用素材"是 bug。和 F-1 / F-2 同模式：JSON blob + cast，缺 schema 边界。
- **Deletion test**: 不能删（messages 持久化是核心）— **改 schema 边界**：messages 走 zod schema，写入 / 读取都过 parse + 显式 migrate path（v0→v1 加 contextSources）。删除后复杂度集中到 1 个 schema 文件，**通过 deletion test**。
- **Suggested direction**: `lib/validators/study-buddy-message.schema.ts` 单源 zod schema，包括 excerpt / contextSources / mood 等所有字段；service 读 messages 立即 `schema.parse`。
- **Tests would improve**: `tests/study-buddy-*.test.ts` 当前主要测 service 路径；加 schema 反序列化测试（旧 message JSON 缺字段 → 默认值填充 / 缺关键字段 → throw）会防回归。

---

### F-8: hiddenAt 删除盘点是单字段轻量级解，但默认过滤散落在每个 query — Severity: P2

- **Files**: `prisma/schema.prisma:672-674` (StudyBuddyPost 加 `hiddenAt DateTime?` + `hiddenBy String?`), `lib/services/study-buddy.service.ts:296` (`hiddenAt: null` 默认 filter), `app/api/teacher/study-buddy/posts/route.ts`（教师视图）, `app/api/study-buddy/posts/[id]/route.ts`（学生侧 hide endpoint）
- **Problem**: **Bad locality**。soft-delete 模式本身正确（idempotent return early + audit force write），但"列出 study buddy 时默认过滤 hidden"这条规则散在每个 service 查询入口（list + summary + 教师视图 + 学生视图等）。任何**新**入口（新 service 函数 / 新 route handler）若忘了加 `hiddenAt: null`，就泄漏 hidden post。
- **Why-it-bites**: 这是 PR 里最容易回归的一类"forgot to filter"。PR #12 Phase 4 加了好几个 study buddy 入口（自由问 / 教师视图 / 课程 SB tab），都得**手工**记得加 `hiddenAt: null`。Codex review 没抓到泄漏（说明当前覆盖到位），但下一个 PR 加新入口就是赌博。
- **Deletion test**: 不能删 hiddenAt（soft-delete 业务必要）。但**集中过滤**：在 service 层提供 `findStudyBuddyPosts(filters)` 单源入口，默认 `hiddenAt: null`，opt-in 拿 hidden（管理员查看）。当前已经接近这样做，但 hidden filter 还是当作"普通 where 字段"散在 3-4 处 query。
- **Suggested direction**: 抽 `studyBuddyDefaultFilter()` helper 返回 `{ hiddenAt: null, isPreview: false }`，所有 list query 一行 `where: { ...studyBuddyDefaultFilter(), ...customFilter }`；opt-in 取消默认显式传 `includeHidden: true`。
- **Tests would improve**: 当前 `tests/e2e/qa-unit5b-delete-ungrade.spec.ts` 是行为级 e2e；加一个"所有 SB 路由"清单测试（每个路由都验证 hidden post 不在 response 里）防回归。

---

### F-9: `analytics-v2` 的 `skillGoals` / `pedagogyAdvice` / `focusGroups` / `nextSteps` 4 维 schema 写死在 `scope-insights.service.ts` 里 — Severity: P2

- **Files**: `lib/services/scope-insights.service.ts:942-955`（`adviceSchema`）, lines 980-995（AI output mapping）, `lib/services/scope-insights.service.ts:1003-1080`（`buildFallbackAdvice` 手工拼同 4 维）
- **Problem**: **Schema-as-type duplication**。AI 输出 schema (`adviceSchema`) + fallback rule-based output 是两个独立实现，都返回 `ScopeTeachingAdvice`。fallback 实际是"AI 失败时的硬编码版"，4 维都靠手写规则填，逻辑跟 AI prompt 完全独立 — 任何维度调整（加 `assessmentSuggestions`）必须同时改两份。
- **Why-it-bites**: 演示承诺"数据洞察 4 维建议"绑定这 4 个字段名 — 4 维变化时（产品迭代加第 5 维 / 拆分 knowledgeGoals）需双改 + 多端测试。fallback 不靠 AI 是好事（无 AI 配置仍可见结果），但和 AI schema 完全分离是过度复制。
- **Deletion test**: 删除 fallback → 复杂度**消失**，承诺消失（AI 失败时无降级）。**承诺成立**（无 AI key 时教师仍要看到建议）。**抽 schema 单源**：把 4 维 advice schema 提到 `lib/validators/teaching-advice.schema.ts`，fallback 用同一 schema 拼，AI 也 parse 同一 schema。
- **Suggested direction**: 单源 zod schema + 共享 TS type；fallback rule code 与 AI parsing 都返回该 type 实例。第二步可考虑把 fallback 的 rule logic 也参数化（"评分阈值 / 题目数阈值 / 完成率阈值"提到 config），让产品改阈值不改代码。
- **Tests would improve**: 现有 `weekly-insight-empty-error.test.ts` 测 weekly empty state；加 scope-insights fallback 单测（AI 失败时各维度是否非空 + 是否符合 schema）。

---

### F-10: QuizQuestion.knowledgeTagIds 是 String[]，无 dedicated KnowledgeTag 表 — Severity: P2

- **Files**: `prisma/schema.prisma:494` (`knowledgeTagIds String[] @default([])`), `lib/services/quiz-question-tagger.service.ts:140-147`（AI 输出中文 string 直存 `knowledgeTagIds`）, `lib/services/quiz-adaptive.service.ts:104`（`question.knowledgeTagIds.length > 0 ? ... : ["未分类"]`）
- **Problem**: **Shallow data model**。`knowledgeTagIds` 字段名暗示是 FK（`...Ids`），实际存的是 AI 生成的中文 string（"复利"、"资产配置"）— 不是引用。后果：
  - 同义/近义合并不存在："风险偏好" vs "风险态度" 是两个 tag，跨题不聚合
  - tagger AI 输出的 "未分类" hardcoded fallback（adaptive service line 104）是 magic string
  - 老师无法管理 tag 词表（增删改不存在）
  - 跨课程聚合（即未来"班级整体在 CAPM 这个概念上薄弱"）必须做 string normalization
- **Why-it-bites**: 自适应诊断本质是"知识点掌握度" — 知识点必须是稳定的字典。当前 string-based tag 让"知识点报告"在班级 / 课程级聚合时漂移（每次 AI 措辞不同 → 字典发散）。短期演示视频里题量少 + 同教师同任务一次性 tag，问题不暴；长期会撞墙。
- **Deletion test**: 删 `knowledgeTagIds` 完全去掉自适应 — 同 F-4，IRT 引擎也跟着完蛋。**承诺成立**但**数据模型不应停在 String[]**。深化方向：建 `KnowledgeTag` 表（id / label / synonyms / courseId scope）+ FK；tagger 写入时 upsert tag → 拿 ID。
- **Suggested direction**: 建 `KnowledgeTag` 模型 + 让 tagger 在写 quizQuestion 前 upsert tag entity；adaptive 引擎读 tag.id 而非 string。
- **Tests would improve**: 当前 `tests/quiz-question-tagger.test.ts` + `tests/quiz-adaptive-engine.test.ts` 都用 string tag；改成 entity-backed 后可以测"同义 tag 合并"、"跨课程 tag scope"等更有价值的语义层用例。

---

## Anti-findings（看起来像但不是问题）

1. **`logAuditForced` vs `logAudit` 双重 API** — 看似 duplicate，但有意义：`logAudit` 受 `ENABLE_AUDIT_LOGS` env 控制（dev 可关），`logAuditForced` 是合规敏感操作（删除 / 强制覆盖）忽略 env 强写。注释清楚（audit.service.ts:21-25），不是 shallow，是显式区分两种 audit semantics。
2. **`createPublishedTaskWithInstance` 与 tx-aware `...InTransaction` 的双 API** — 看起来 duplicate wrapper，实际是"对外友好默认 + 外层需要 tx 时的 escape hatch"标准模式。`with-task` route 用 tx-aware 版本包 draft flip + create 同一 tx 是合理 atomic 设计（task-instance.service.ts:85-160 / with-task/route.ts:62-79）。Deep + has-seam，不是 shallow。
3. **MiMo `chat_template_kwargs` fetch interceptor**（ai.service.ts:256-284）— 看起来 hacky，但注释解释清楚：@ai-sdk/openai 白名单 schema 不允许非标准字段，MiMo 真 reasoning OFF 开关又只能从 body 注入。fetch 拦截是当前 SDK 限制下的合理 escape hatch，**有清晰边界**（只 MiMo branch）。属"deep workaround"而非 shallow hack。
4. **`tryRepairTruncatedJSON`**（ai.service.ts:615-751）— 132 行手写 JSON 平衡括号扫描，看起来重；实际是 MiMo 长 schema 输出 8192 token 截断的根因修复（M1 Molly XLSX 案例）。删除即倒退到老的"贪心 regex 匹配第一个 `{...}`"。属于"性能/可靠性核心代码"，复杂度合理。
5. **emptyState short-circuit in weekly-insight** — 看起来"绕过 AI"，实际是 0-submission 时不让 AI 编造结果的明确边界，写了短缓存避免锁死 7 天。良好设计。

## Cross-cutting hunches

- **JSON-blob-as-contract 是 PR 最普遍的反复模式**：taskSnapshot (F-1) / structuredData (F-2) / messages (F-7) / metadata in AiRun (F-3) / evaluation in submission tables（已存在更早 PR）— 全是 `Json?` + cast + 散落消费。建议未来 PR 把 "凡是写入 Json 字段必须配 zod schema 单源" 作为开发底线。可在 `.harness/spec.md` 加一条规则。
- **状态机 atomic publish (Unit 10)** 模式（conditional update + P2025 mapping）极佳 — 是 PR 里最值得复用到其他状态机的实践（如 TaskInstance close/reopen 当前用普通 update 不防并发，参考 F-5 atomic publish 模式改造收益高）。
- **进程内 Map 流控**（ai.service.ts:514 + ai-throttle.service.ts:11）是部署时间炸弹。当前 staging 单实例 OK，迁 Cloud Run 多副本后 force=true 流控完全失守。建议建 issue 跟踪"流控存储接口化"。
- **scope 校验跨 service 重复**（F-5）是 incident risk — Codex review 已经抓过类似问题，根因没修，下次会再撞。
- **审计场景关联对象上下文压在 free-form metadata** 是分析查询性能炸弹 — 未来若想做"按 course 聚合 AiRun 成本"必须 SQL JSONB query，比单独建字段贵 10×。
- **review-arch 视角可能也会看到** F-1 / F-2 / F-7（JSON blob 模式跨多个模块），**review-data 视角可能也会看到** F-2 / F-10 / F-3（schema 模型层），**review-security 视角可能也会看到** F-5（scope 校验），**review-ai 视角可能也会看到** F-3 / F-4 / F-9（AI 横切关注点 / IRT 命名 / advice schema）。这些点的交叉信号 = high-confidence 候选。
