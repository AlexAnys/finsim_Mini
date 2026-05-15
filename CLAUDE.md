# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 行为底线（不可妥协，所有 session / agent 必须遵守）

**不走捷径 — 任何跳过 / 接受 < 100% acceptance 必须先 ask 用户，结果立刻写进 `.harness/spec.md` + commit。**

## Project Overview

FinSim is a financial education platform for Chinese university courses. Core loop: teacher creates tasks → students complete them → AI grades → analytics flow back to teacher. All UI text is in Simplified Chinese.

## Harness

本项目使用 coordinator / builder / qa 三角色 Agent Team（定义在 `.claude/agents/`）：

| 角色 | 产出 | 读什么 | 工具范围 |
|---|---|---|---|
| coordinator | `.harness/spec.md`（计划 + acceptance criteria） | 用户意图、CLAUDE.md、`.harness/` 全部 | Agent/TeamCreate/SendMessage/Task*/Read/Write/Bash |
| builder | `.harness/reports/build_{unit}_r{N}.md` | spec.md、现有代码、gstack `/investigate`（debug 用） | Read/Write/Edit/Bash + SendMessage |
| qa | `.harness/reports/qa_{unit}_r{N}.md` | spec.md、build 报告、**gstack `/qa-only` 真浏览器**、`/cso`（安全类改动） | Read/Write/Bash + SendMessage（**无 Edit**）|

**自动 QA**：`.claude/settings.json` 的 Stop hook 在每次 Claude 回复结束时触发独立 QA gate，检查 git diff 是否符合 spec + finsim 规则（Prisma 三步、Service interface 全同步、中文 UI、Route Handler 无业务逻辑）。

**Dynamic exit**：两次连续 PASS 即收工；同一 FAIL 三连即回 spec 重规划，不硬磨。

**Progress tracking**：`.harness/progress.tsv` 每轮 QA 追加一行；跨会话续工用 `.harness/HANDOFF.md`（由 coordinator 在会话结束前更新，SessionStart hook 自动在新会话显示）。

## Commands

```bash
docker compose up postgres -d          # Start PostgreSQL
npx prisma migrate dev                 # Run DB migrations (creates + applies)
npx prisma generate                    # Regenerate Prisma Client (REQUIRED after schema changes)
npm run db:seed                        # Seed test data
npm run dev                            # Dev server (port 3000)
npx tsc --noEmit                       # Type check (run after every change)
npm run build                          # Production build
npm run lint                           # ESLint
docker compose up --build              # Full Docker deploy
```

## Test Accounts (after seeding)

- Admin: `admin@finsim.edu.cn` / `password123`
- Teacher: `teacher1@finsim.edu.cn` / `password123`
- Student: `student1@finsim.edu.cn` / `password123` (Class A)

## Architecture

### Three-Layer Pattern

```
Route Handler (app/api/)  →  Service (lib/services/)  →  Prisma (lib/db/)
     ↑ Zod validation            ↑ Business logic           ↑ DB queries
     ↑ Auth guards               ↑ Error throwing           ↑ Type-safe ORM
```

- **Route Handlers**: Thin wrappers. Parse request → call service → return response. No business logic.
- **Services**: All business logic. Throw `new Error("ERROR_CODE")` for known errors (mapped in `lib/api-utils.ts` → `handleServiceError()`).
- **API response format**: Always `{ success: true, data }` or `{ success: false, error: { code, message } }` via helpers in `lib/api-utils.ts`.

### Routing Structure

- `(auth)/` — Login/register (route group, no URL prefix)
- `(simulation)/sim/[id]` — Fullscreen simulation runner (no sidebar, supports `?preview=true`)
- `(student)/` — Student pages (route group, no URL prefix: `/dashboard`, `/tasks/[id]`, `/grades`)
- `teacher/` — Teacher pages (path segment: `/teacher/dashboard`, `/teacher/tasks`, `/teacher/instances`)

### Data Flow: Tasks

```
Task (template) → TaskInstance (assigned to class, has dueAt) → Submission → AI Grading → Score
```

Three task types, each with a dedicated Runner component and config model:

| Type | Config Model | Runner Component | Grading |
|------|-------------|-----------------|---------|
| `simulation` | `SimulationConfig` | `SimulationRunner` | AI evaluates dialogue + rubric |
| `quiz` | `QuizConfig` + `QuizQuestion[]` | `QuizRunner` | Auto + AI for short answer |
| `subjective` | `SubjectiveConfig` | `SubjectiveRunner` | AI evaluates with rubric |

### Auth Pattern

```typescript
// In Route Handlers — always use these, never check session manually
const result = await requireAuth();        // Any logged-in user
const result = await requireRole(["teacher", "admin"]);  // Role-specific
if (result.error) return result.error;
const { user } = result.session;
```

### AI Provider System

Configured via env vars. Default provider + per-feature overrides:
- `AI_PROVIDER` / `AI_FALLBACK_PROVIDER` — default providers
- `AI_SIMULATION_PROVIDER`, `AI_EVALUATION_PROVIDER`, etc. — feature-specific overrides
- Providers: `qwen`, `deepseek`, `gemini`, `openai` (all OpenAI-compatible via Vercel AI SDK)
- See `.env.example` for full list

### DB Field ↔ Frontend Mapping

Runner components use different naming than DB. Mapping happens in `(student)/tasks/[id]/page.tsx`:
- `QuizConfig.timeLimitMinutes` → runner `timeLimit`
- `QuizConfig.mode: "fixed"` → runner `"exam"`, `"adaptive"` → `"practice"`
- `SubjectiveConfig.allowedAttachmentTypes.length > 0` → runner `allowAttachment`
- `AllocationItem` has no `defaultValue`; runner defaults to 0

## Workflow (Must Follow)

1. Present plan first, don't write code until confirmed
2. After each feature: run `npx tsc --noEmit` (full type check)
3. Keep each diff under 150 lines
4. After editing `schema.prisma`: **must** `npx prisma migrate dev` + `npx prisma generate` + **kill & restart dev server** + 验证页面正常加载（不能跳过重启！）
5. Each session ends with: list all modified files + update `.harness/HANDOFF.md` if work spans sessions
6. If unsure, switch to Plan Mode: explore + propose plan before editing.
7. **Model upgrade review** — 每次 Claude 模型升级后，回看 `.claude/agents/` 定义 + Stop/SessionStart hooks + `.harness/` 结构，删掉不再增值的脚手架，追加一行到 `.harness/progress.tsv`（unit=harness-upgrade，记录删/留决策）。这是防止 harness 随模型进化持续膨胀的唯一机制。

### Anti-Regression Rules

6. Before modifying function signatures / data structures / API interfaces: search ALL callers, list impact scope, then change
7. Bug fixes: change only the minimal code that caused the bug — no "drive-by" refactors
8. When modifying `lib/services/` interfaces (params, return values): update all callers in the same commit
9. Don't modify files outside the current task scope unless explicitly confirmed
10. Beyond 5 conversation rounds: write progress to status, let user decide whether to continue

### Bug Fix Rule

- **Fix root causes, never bypass**: trace the failing code path, repair it, verify the original path works. Workarounds (e.g. replacing `router.push` with `window.location.href`) are not fixes.
- 若走不通，builder 调用 gstack `/investigate` 做结构化根因追查，不用 workaround。

### Code Standards

- All UI text in Simplified Chinese; error messages returned to frontend must be Chinese
- Route Handlers contain no business logic — call Service layer
- Auth: `requireAuth()` / `requireRole()` — never manual session checks
- Validation: Zod with `safeParse()` always, schemas in `lib/validators/` or inline in Route Handler
- Errors: Services `throw new Error("CODE")`, handled by `handleServiceError()` in API layer
- API response format: `{ success: true, data }` / `{ success: false, error: { code, message } }`
- Schema changes: `npx prisma generate` (dev), `npx prisma migrate deploy` (prod) — never edit migration files manually
- Commits: `feat:` / `fix:` / `refactor:` / `docs:` / `test:`
- Imports: `@/` alias points to project root

### Prisma Gotchas

- **⚠️ CRITICAL — 已多次导致 500 错误**: 编辑 `schema.prisma` 后，必须执行完整三步：`npx prisma migrate dev` → `npx prisma generate` → **杀掉并重启 dev server**。仅 generate 不够，运行中的 dev server 内存里缓存了旧 client，新的 model/relation 会导致运行时 500 错误，而 `tsc --noEmit` 不会报错。**在完成所有代码改动之后、告知用户"完成"之前，必须重启 dev server 并验证页面能正常加载。**
- Every nested relation referenced in frontend (e.g., `task.analytics`, `task.chapter`) **must** be explicitly included in the Prisma query's `include`
- `npx tsc --noEmit` passes even when Prisma runtime fields are wrong — always verify queries actually run（qa 用 `/qa-only` 真加载页面验证）
- When adding `include`/`select` fields, verify the field name exists in `schema.prisma`

### Testing Strategy

- Service layer: at least one happy path + one edge case per public method
- API layer: at least test 200 + 401 + 403 per endpoint
- After each milestone: create smoke tests verifying core end-to-end flows
- Smoke tests are never deleted — all sessions must ensure they pass
- Run `npx vitest run` after changes (full suite, not just the current module)
- TDD: write test → confirm failure → write implementation → test passes — never modify tests to accommodate implementation

## CI/CD & Deployment

- 仓库：GitHub `AlexAnys/finsim_Mini`（私有）
- main 受 branch protection 保护：必须 PR + `quality` + `staging-deploy` 两项 check 全绿才能 merge；admin 可紧急 bypass
- 流程：feature 分支 → push → 自动开 PR → CI quality + staging deploy 并行 → 用户 staging 实测 → squash merge → 生产部署 (~4 min)
- 本地开发：`docker compose up --build`
- 详见 `agent_docs/deployment.md`、`AGENTS.md`

## Workflow（多 agent 协作）

> 详见仓库根目录 `AGENTS.md`。所有 agent（Claude / Codex / 其他）在本仓库工作必须遵守。

1. **不直 push main**：被 protection 拒绝。每个任务一个 feature 分支 `<agent>-<topic>`（例 `claude-quiz-fix`、`codex-deploy-env`）
2. **commit 前必跑** `npx tsc --noEmit && npx vitest run`，绿了才 commit
3. **每个 PR 自动起 staging**：https://staging.finsim.anlanai.cn（共享栈，跨 PR 串行）
4. **用户兜底 QA**：靠 staging 浏览器实测，不读代码 review
5. **squash merge**：repo 强制 squash + 自动删分支，main 历史一行一 PR
6. **撞车 rebase**：`git rebase origin/main` + `git push --force-with-lease` 自己分支
7. **core-change 标签自动打**：触摸 `lib/auth/`、`grading.service`、`prisma/schema.prisma`、`prisma/migrations/`、`.github/workflows/`、`Dockerfile`、`docker-compose*.yml` 时自动加红色 `core-change` 标签提醒（不阻塞 merge）

## CLAUDE.md 维护原则

- 精心维护，只放每个 session 都需要知道的信息
- 详细的专题文档放 `agent_docs/` 目录，CLAUDE.md 中仅放摘要 + 引用路径

## Compact Instructions
- When compacting, preserve: list of modified files, commands run, failing tests, and the current TODO.
