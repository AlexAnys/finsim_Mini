# Stream E — 代码工程质量 review (r1)

## 1) 项目工程现状一句话

finsim 是 Next.js 16 + React 19 + Prisma 6 三层架构 LMS，335 个 TS 文件 / 30 个 service / 75 个 route handler / 73 个测试文件 868 用例 — 整体很健康，但 24 个 route handler 仍直接打 Prisma，是架构守不住的最大隐患。

## 2) 实测发现

- **`npx tsc --noEmit`**：0 error, 0 warning (输出文件 0 行) ✅
- **`npm run lint` (eslint)**：0 error / **3 warning**，全是 `react-hooks/exhaustive-deps` (quiz-runner.tsx:199 / simulation-runner.tsx:290 / subjective-runner.tsx:203)。同一类型，可能掩盖 stale-closure 隐患。
- **`npx vitest run`**：**868/868 pass**，73 test files，10.7 s，0 flake ✅
- 服务总规模：lib/services 共 **12,411 行**，30 个文件
- 错误码总量：服务层 `throw new Error("CODE")` 共 **108 处**，46 个独特码

## 3) Code Review 发现

### 🔴 R1 — Route Handler 三层架构破口 (24/75 路由直连 Prisma)
CLAUDE.md 红线："Route Handler 不放业务逻辑"，实际 `app/api/` 下有 **28 个 route 直接 `import prisma`，其中 24 个真的在路由里跑 Prisma 查询**。最严重的写入操作：
- `app/api/auth/register/route.ts:119` — `prisma.user.create` (无 service 层)
- `app/api/users/me/route.ts:48`、`app/api/users/me/password/route.ts:30` — `prisma.user.update`
- `app/api/lms/courses/[id]/route.ts:57` — `prisma.course.update`
- `app/api/lms/schedule-slots/[id]/route.ts:23`、`app/api/lms/course-knowledge-sources/[id]/route.ts:68` — `prisma.*.delete`
- `app/api/lms/courses/[id]/outline-apply/route.ts:98` — `prisma.$transaction` 在路由里  
另外 `app/api/ai/chat/route.ts` 217 行、`app/api/ai/task-draft/from-context/route.ts` 308 行已经是「事实上的微 service」。后果是改这些查询时绕开了 service 测试覆盖。

### 🟡 R2 — 8 个错误码未在 `handleServiceError` 映射 (前端拿不到中文)
`lib/services/` 抛出但 `lib/api-utils.ts` 没 case 处理，会落到默认 500：
`MISSING_SIMULATION_DATA` (grading.service.ts:183) · `MISSING_QUIZ_DATA` (:242) · `MISSING_SUBJECTIVE_DATA` (:439) · `TASK_BUILD_DRAFT_NOT_FOUND` (task-build-draft.service.ts ×3) · `TASK_BUILD_DRAFT_SCOPE_MISMATCH` · `NO_POSTS_TO_SUMMARIZE` (study-buddy:248) · `WORK_ASSISTANT_EMPTY_INPUT` (ai-work-assistant:113) · `AI_PROVIDER_NOT_FOUND` (ai-tool-settings:213)。其中 grading 三连是批改路径关键，AI 评分缺数据时前端只会看到「服务器内部错误」。

### 🟡 R3 — 超大 service 缺子模块切分 (`analytics-v2.service.ts` 2433 行 / 39 export)
单文件 2433 行，39 个 export 函数没用任何 `// === 区块 ===` 注释分割（`grep -c "^// =="` = 0）。`scope-insights.service.ts` 1161 行 / `ai.service.ts` 1023 行同样大，但 ai.service 至少按 feature 区分（chat / evaluate / task-draft）。Analytics 在 Phase 1～9 反复迭代后已经无明显边界。维护成本 = 每改一处都要 grep 2433 行确认无副作用。

### 🟡 R4 — 9 个 service 测试覆盖为 0
按 `tests/<service-name>.*` 命名搜索为 0：`ai-work-assistant` / `async-job` / `audit` / `class` / `group` / `import-job` / `storage` / `task-instance` / `task-post`。其中 `async-job.service.ts` (228 行) 是周报异步队列骨架，回归无网；`audit.service.ts` 写 audit log 失败仅 console.error（lib/services/audit.service.ts:16/36），没人验过失败路径。

### 🟢 R5 — 现状还可以的部分（防止过度悲观）
- TS strict mode 开启，全项目 0 type error；service 层 `as any` 仅 10 处（grading + insights）
- `requireAuth` / `requireRole` 用了 174 次，没发现一处手写 session 检查
- `safeParse` 在 44 个 route 用了，validators 集中在 `lib/validators/`
- 没有 `legacy analytics.service.ts` 残留（只有 v2），`insights.service` 与 `scope-insights.service` 是 instance-level / scope-level 不同职责，**不是并存死代码**
- CI 流程严格：squash merge / branch protection / quality + staging-deploy 双 check / core-change 自动标签
- commit message 风格统一 (feat/fix/refactor/docs/chore/test)
- 最近 5 次 schema 变更都跟着 migration + service 改动一起 commit，三步铁律守住
- 没找到任何 TODO / FIXME / XXX 注释（lib/ + app/ 全空）

## 4) 建议（按优先级）

🔴 **B1**：把 6 个 Prisma 写入路由 (`auth/register`, `users/me`, `users/me/password`, `courses/[id]`, `schedule-slots/[id]`, `course-knowledge-sources/[id]`) 收回 service 层。auth/register 158 行尤其值得 — register 业务逻辑（密码 hash、邮箱唯一、班级校验）现在散在 route 里没人测。

🔴 **B2**：补 8 个未映射错误码到 `lib/api-utils.ts:handleServiceError`。grading 三连 `MISSING_*_DATA` 是用户实操路径，加 4 行 case 就能让前端拿到中文。

🟡 **B3**：给 `analytics-v2.service.ts` 加 6～8 个 `// === SECTION ===` 注释或拆出 `analytics-v2/diagnosis.ts` / `analytics-v2/scoring.ts` / `analytics-v2/risk.ts` 子文件。不是重构 — 是加航标，让下一次改不用 grep 2433 行。

🟡 **B4**：把 `async-job.service.ts` 至少补一个 happy path 测试（job 创建 → 执行 → 完成）。已经踩过一次 `ASYNC_JOB_HANDLER_NOT_IMPLEMENTED` 这类硬编码错误码，没测试就靠生产兜底。

🟢 **B5**：3 个 runner 的 `react-hooks/exhaustive-deps` warning 要么加 dep 要么写注释说明为什么稳定 — 现在「全项目唯一 warning」是漏网而不是合理豁免，会把未来真问题淹没。

---

**结论**：工程基本盘扎实（typecheck/lint/test 全绿、三层模式有），但 24 路由绕开 service + 8 错误码漏映射是 architecture decay 的两个 leak point，趁现在 PR 体量小先堵上，比等 analytics-v2 长到 3000 行再拆便宜得多。
