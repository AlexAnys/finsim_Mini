# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FinSim is a financial education platform for Chinese university courses. Core loop: teacher creates tasks → students complete them → AI grades → analytics flow back to teacher. All UI text is in Simplified Chinese.

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
4. After editing `schema.prisma`: **must** `npx prisma generate` and restart dev server
5. Each session ends with: list all modified files
6. If unsure, switch to Plan Mode: explore + propose plan before editing.

### Anti-Regression Rules

6. Before modifying function signatures / data structures / API interfaces: search ALL callers, list impact scope, then change
7. Bug fixes: change only the minimal code that caused the bug — no "drive-by" refactors
8. When modifying `lib/services/` interfaces (params, return values): update all callers in the same commit
9. Don't modify files outside the current task scope unless explicitly confirmed
10. Beyond 5 conversation rounds: write progress to status, let user decide whether to continue

### Bug Fix Rule

- **Fix root causes, never bypass**: trace the failing code path, repair it, verify the original path works. Workarounds (e.g. replacing `router.push` with `window.location.href`) are not fixes.

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

- After editing `schema.prisma`: **must** `npx prisma generate`, then **restart dev server** — old client is cached in memory
- Every nested relation referenced in frontend (e.g., `task.analytics`, `task.chapter`) **must** be explicitly included in the Prisma query's `include`
- `npx tsc --noEmit` passes even when Prisma runtime fields are wrong — always verify queries actually run
- When adding `include`/`select` fields, verify the field name exists in `schema.prisma`

### Testing Strategy

- Service layer: at least one happy path + one edge case per public method
- API layer: at least test 200 + 401 + 403 per endpoint
- After each milestone: create smoke tests verifying core end-to-end flows
- Smoke tests are never deleted — all sessions must ensure they pass
- Run `npx vitest run` after changes (full suite, not just the current module)
- TDD: write test → confirm failure → write implementation → test passes — never modify tests to accommodate implementation

## CI/CD & Deployment

### Git Remote

- GitHub: `AlexAnys/finsim_Mini`（私有仓库）
- Remote: `origin` → `https://github.com/AlexAnys/finsim_Mini.git`

### CI/CD Pipeline (GitHub Actions)

两个 workflow，位于 `.github/workflows/`：

| Workflow | 触发条件 | 作用 |
|----------|---------|------|
| `ci.yml` | PR + push 到非 main 分支 | 类型检查 + lint + 测试 + Docker 构建验证 |
| `deploy.yml` | push 到 main | 质量检查 → 构建镜像推送 ghcr.io → SSH 部署到服务器 |

### 镜像仓库

- `ghcr.io/alexanys/finsim_mini`
- 每次部署打两个 tag：`:latest` + `:<git-sha>`

### 生产服务器

- 地址：`47.100.98.69`，端口 3000
- 部署目录：`/opt/finsim/`
- `.env` 在服务器上 `/opt/finsim/.env`，不由 CI/CD 管理
- 部署方式：GitHub Actions SSH 到服务器 `docker compose pull app && docker compose up -d`

### 日常开发部署流程

```
feature 分支开发 → git push → CI 自动检查
    ↓ 通过后
创建 PR → merge 到 main → Deploy 自动触发
    ↓
GitHub runner 构建镜像 → push ghcr.io → SSH 部署到服务器
```

### 关键命令

```bash
# 推送代码（触发 CI）
git push origin <branch>

# 合并到 main（触发部署）
git checkout main && git merge <branch> && git push

# 回滚（在服务器上）
IMAGE_TAG=<旧sha> docker compose up -d

# 本地开发（不走 CI）
docker compose up --build
```

### docker-compose.yml 双模式

- `image` + `build` 同时存在
- 本地开发：`docker compose up --build`（使用 build 构建）
- 生产部署：设置 `IMAGE_TAG` 环境变量，`docker compose pull app`（拉取 ghcr.io 镜像）

### GitHub Secrets（已配置在仓库 Settings）

- `SERVER_HOST` — 服务器 IP
- `SERVER_USER` — SSH 用户
- `SERVER_SSH_KEY` — SSH 私钥
- `GITHUB_TOKEN` — ghcr.io 认证（自动提供）

## Compact Instructions
- When compacting, preserve: list of modified files, commands run, failing tests, and the current TODO.
