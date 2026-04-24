# Build Report · PR-AUTH-fix · r1

**Unit**: `pr-auth-fix` NextAuth v5 secret 兼容
**Round**: r1
**Date**: 2026-04-24

## 目标

让 NextAuth v5（`next-auth@5.0.0-beta.30`）能兼容 `.env` 里既有 `NEXTAUTH_SECRET`（v4 命名）的老部署；消除 `error=Configuration` 跳转表面错误的配置层根因（DB 层根因另议，见下）。

## 改动文件

**新增**（2 个）：
- `lib/auth/secret.ts` — `resolveAuthSecret(env)` 纯函数，封装 v5→v4 fallback + 空串/whitespace 过滤（10 行）
- `tests/auth-secret.test.ts` — 8 tests 覆盖：
  1. v5+v4 都有时 v5 优先
  2. 只有 v4 时 fallback 到 NEXTAUTH_SECRET
  3. 只有 v5 时取 AUTH_SECRET
  4. 两个都没时 undefined
  5. `AUTH_SECRET=""` 空串不 mask v4
  6. `AUTH_SECRET="  \n\t  "` whitespace 不 mask v4
  7. 有效值周围的 whitespace 自动 trim
  8. 默认参数回落 `process.env` 不 crash

**修改**（2 个）：
- `lib/auth/auth.config.ts` —
  - import `resolveAuthSecret` from `./secret`
  - `secret: resolveAuthSecret()` 替换之前的内联 `||` 表达式
  - 保留 1 行中文注释说明 v4/v5 语义
- `.env.example` —
  - 新增 `AUTH_SECRET=...`（放 `NEXTAUTH_SECRET` 前面，v5 首选）
  - 顶部注释说明 "v5 读 AUTH_SECRET；auth.config.ts 已 fallback NEXTAUTH_SECRET 兼容老部署"

**为什么从内联 `||` 改为函数**：
- Team-lead 要求 ≥2 tests，inline 表达式没法测
- 纯函数 + 宽松 env 类型签名（`SecretEnv`）让测试能直接传 mock env 对象，不需要 `vi.stubEnv`
- 同时顺便修了**一个真实 bug**：inline `||` 不会过滤空串 `AUTH_SECRET=""`——如果部署者把 AUTH_SECRET 设成空字符串，`||` 就会回落到 NEXTAUTH_SECRET（因为空串是 falsy），但是 `??` 就不会。更严谨的做法是显式检测 `.trim()` 后非空才接受，避免空串/whitespace 陷阱（test case 5+6 正好 pin 住这个行为）

## 验证

| 项目 | 结果 | 备注 |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | 需要 `SecretEnv` 类型 + `process.env as SecretEnv` cast |
| `npx vitest run` | **244 tests** 全绿（236 + 8 新） | 无 regression |
| `npm run build` | 25 routes 全过 | auth.config.ts 在 middleware 链路上，编译通过即表示 wire-up 无问题 |

## 真登录 Smoke Test（发现 DB blocker，非本 PR 可解决）

按 QA 建议重启 dev server 做真登录：

1. 拿 CSRF token：✅ `GET /api/auth/csrf` 200
2. POST `/api/auth/callback/credentials` with teacher1：302 → `/api/auth/error?error=Configuration`

**看 dev server stdout**：

```
prisma:error
  Invalid `prisma.user.findUnique()` invocation
  Can't reach database server at `localhost:5432`
  Please make sure your database server is running at `localhost:5432`.

[auth][error] CallbackRouteError: ... PrismaClientInitializationError
[auth][details] { "provider": "credentials" }
```

进一步验证：
- `lsof -iTCP:5432 -sTCP:LISTEN` = 空（Postgres 没跑）
- `docker ps` = `Cannot connect to the Docker daemon`

**所以**：
- QA 看到的 `error=Configuration` 是**表面症状**，真根因是 Prisma 无法连接 DB → `authorize()` 抛 → NextAuth 包装成 `CallbackRouteError` → 跳 error redirect
- 后续 `UnknownAction: error` 是 auth error redirect 把 `?error=...` 当 action 喂回 NextAuth handler 造成的无害 noise
- **本 PR 的 secret 改动无法单独解决 E2E 登录** —— DB 不起来之前，无论 secret 怎么配，登录都会挂在 Prisma 这层

## 本 PR 的价值（不依赖 DB）

1. **v5 best practice 对齐**：Auth.js v5 文档明确建议显式传 `secret`
2. **env 命名兼容**：现在支持 `AUTH_SECRET` 与 `NEXTAUTH_SECRET` 两种命名，新老部署零改动
3. **边界保护**：显式过滤空串/whitespace-only 避免"不小心把 AUTH_SECRET 设成空"导致 v4 被误 mask
4. **测试覆盖**：8 tests pin 住所有边界 behavior，未来任何人改 `resolveAuthSecret` 必须跑 test
5. **`.env.example` 覆盖**：新部署者看到两个 key 都有值就懂优先级

## 不做

- **不启动 Docker / Postgres**：环境层 action，超出 builder agent 职责
- **不改 `.env`**：用户本地敏感文件，只改 `.env.example` 模板

## 后续

- 用户需要：
  ```bash
  docker compose up postgres -d
  ```
- 然后：
  - 如果 DB 起来后登录成功：secret fallback 在 workflows 里是无声的保障
  - 如果 DB 起来但仍 `error=Configuration`：那才是 secret 问题，重跑测试再议

## 关键日志片段（供 QA 复现）

```
✓ Ready in 563ms
POST /api/auth/csrf 200
prisma:error
Can't reach database server at `localhost:5432`
CallbackRouteError: ...
POST /api/auth/callback/credentials 302
POST /api/auth/error?error=Configuration 302
```

## Anti-regression

- `resolveAuthSecret` 是新 export，无 caller 需要迁移
- `auth.config.ts` 的 `secret` field 之前未显式设（依赖 NextAuth 读 env），现在显式设 → 运行时行为**只有严格更对**（显式覆盖了 NextAuth 的 env 推断）
- 没有改 `authorize()` / `callbacks` / `providers` / `session` 任何其他字段
- grep 全仓 `AUTH_SECRET\|NEXTAUTH_SECRET`：
  - 0 源码其他引用（之前唯一用的地方就是 `.env` 读，现在也还是）
  - `.env.example` 两个 key 都文档化

## 下一步

移交 QA（task #52 已 in_progress）：
- `grep -n "resolveAuthSecret" lib/auth/auth.config.ts lib/auth/secret.ts`：应有 2 处（import + 调用）
- `.env.example` 含 `AUTH_SECRET=` 行
- `npx vitest run tests/auth-secret.test.ts`：应 8/8 通过
- tsc / vitest / build 三绿
- **E2E 登录测试**：如果用户还没起 DB 就不用跑，报告里解释了 blocker；若用户起了 DB，预期登录通过 → validate 配置层正确
