# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 行为底线（不可妥协，所有 session / agent 必须遵守）

**按 AGENTS.md 的变更分类选择验证：纯说明文档走正常轻量路径，无须额外申请跳过测试；代码、运行时指令与配置保留完整验证。不得把未完成的检查写成通过。**

## Project Overview

FinSim is a financial education platform for Chinese university courses. Core loop: teacher creates tasks → students complete them → AI grades → analytics flow back to teacher. All UI text is in Simplified Chinese.

## Harness

保留 coordinator / builder / qa 三角色，定义在 `.claude/agents/`。当前任务唯一入口是本 worktree 的 `.harness/current-task.json`，由 `.harness/scripts/task_state.py` 管理；独立 spec、代码指纹、实际运行 SHA、环境与 QA 证据绑定。没有入口时不启动旧 spec.md 的计划。

流程与命令见 `.harness/WORKFLOW.md`。Stop 只做确定性的证据有效性检查，不调用模型，不在讨论/等待用户时阻断，不替代独立 QA。写入报告不会使源码 QA 失效，修改源码会。历史 progress.tsv/报告/交接保留只读，新结果使用带锁 JSONL ledger；归档默认预览且不删除原件。

## Commands

```bash
docker compose up postgres -d          # Start PostgreSQL
npx prisma migrate dev                 # Run DB migrations (creates + applies)
npx prisma generate                    # Regenerate Prisma Client (REQUIRED after schema changes)
npm run db:seed                        # Seed test data
npm run dev                            # Dev server (port 3000)
npx tsc --noEmit                       # Type check (application changes)
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

## Validation scope

Follow `AGENTS.md` and `agent_docs/validation-routing.md`. Before committing, run `python3 .github/scripts/change_policy.py --base origin/main --working-tree`. For `docs_only=true`, run the lightweight docs check and inspect changed media/links; do not install app dependencies, run app tests, start servers, deploy, or force `.harness` updates. Workflow changes receive routing/YAML checks locally and one full CI validation. All other application checks below apply to the full path.

## Workflow (Must Follow)

1. 明确计划与验收，沿用用户已给的授权；范围不清时再澄清。
2. For application changes: run `npx tsc --noEmit` and the required tests; pure docs use the validation scope above.
3. Keep each diff under 150 lines
4. After editing `schema.prisma`: **must** `npx prisma migrate dev` + `npx prisma generate` + **kill & restart dev server** + 验证页面正常加载（不能跳过重启！）
5. List modified files and validation evidence; pure docs record this in the PR without forced `.harness` edits.
6. If unsure, switch to Plan Mode: explore + propose plan before editing.
7. **Model upgrade review** — 每次 Claude 模型升级后，回看 `.claude/agents/` 定义 + Stop/SessionStart hooks + `.harness/` 结构，删掉不再增值的脚手架，在独立 QA 报告记录删/留决策。这是防止 harness 随模型进化持续膨胀的唯一机制。

### Anti-Regression Rules

6. Before modifying function signatures / data structures / API interfaces: search ALL callers, list impact scope, then change
7. Bug fixes: change only the minimal code that caused the bug — no "drive-by" refactors
8. When modifying `lib/services/` interfaces (params, return values): update all callers in the same commit
9. Don't modify files outside the current task scope unless explicitly confirmed
10. 同一失败重复出现时记录现状和证据，回根因/计划，不做无意义的固定轮数迭代。

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
- Application code changes retain the full vitest suite. Pure docs do not run it; workflow-only changes use their full CI run instead of duplicating local application checks.
- TDD: write test → confirm failure → write implementation → test passes — never modify tests to accommodate implementation

## CI/CD & Deployment

- 仓库：GitHub `AlexAnys/finsim_Mini`（公开）
- main 受 branch protection 保护：必须 PR + `quality` + `staging-deploy` 两项 check 全绿才能 merge；不关闭或绕过保护
- 流程：feature 分支 → PR → 变更分类 → `quality` + `staging-deploy`。纯说明文档走轻量检查且不部署；完整路径保留应用测试、staging 与生产部署。
- 本地开发：`docker compose up --build`
- 详见 `agent_docs/deployment.md`、`AGENTS.md`

## Workflow（多 agent 协作）

> 详见仓库根目录 `AGENTS.md`。所有 agent（Claude / Codex / 其他）在本仓库工作必须遵守。

1. **不直 push main**：被 protection 拒绝。每个任务一个 feature 分支 `<agent>-<topic>`（例 `claude-quiz-fix`、`codex-deploy-env`）
2. **提交前按变更分类验证**：纯说明文档轻量检查；应用代码跑类型与全套测试；工作流修改本地验证路由/YAML、CI 完整验证一次。
3. **完整路径起 staging**：https://staging.finsim.anlanai.cn（共享栈）；纯说明文档同名检查直接完成轻量验证。
4. **按内容验证**：文档看排版/引用/媒体；应用变更在 staging 实测。
5. **squash merge**：repo 强制 squash + 自动删分支，main 历史一行一 PR
6. **撞车 rebase**：`git rebase origin/main` + `git push --force-with-lease` 自己分支
7. **core-change 标签自动打**：触摸 `lib/auth/`、`grading.service`、`prisma/schema.prisma`、`prisma/migrations/`、`.github/workflows/`、`Dockerfile`、`docker-compose*.yml` 时自动加红色 `core-change` 标签提醒（不阻塞 merge）

## CLAUDE.md 维护原则

- 精心维护，只放每个 session 都需要知道的信息
- 详细的专题文档放 `agent_docs/` 目录，CLAUDE.md 中仅放摘要 + 引用路径

## Compact Instructions
- When compacting, preserve: list of modified files, commands run, failing tests, and the current TODO.
