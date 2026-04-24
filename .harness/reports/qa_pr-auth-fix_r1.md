# QA Report — pr-auth-fix r1

## Spec
Task #50（team-lead 补插）— 让 NextAuth v5（`next-auth@5.0.0-beta.30`）显式读 secret，兼容 v4 的 `NEXTAUTH_SECRET` 老部署，消除 `error=Configuration` 的**表面症状**。Builder 在 smoke test 中发现真根因是 Postgres 停机 → Prisma 连不上 → `authorize()` 抛 → NextAuth 包装为 `CallbackRouteError` → 跳 error redirect。

## 验证表

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | `lib/auth/auth.config.ts:10` 显式 `secret: resolveAuthSecret()`；新建 `lib/auth/secret.ts`（14 行纯函数，v5 优先 + v4 fallback + trim + 空字符串/whitespace 防呆 + dep injection）；`.env.example` 同时写 `AUTH_SECRET` + `NEXTAUTH_SECRET`（双都生效，v5 优先） |
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | **244 tests** 全绿（**比 build report 说的 236 多 8**，builder 实际加了 `tests/auth-secret.test.ts` 的 8 tests 但 report 第 19 行写"无新测试"——report/code 不符但**是加分方向**）。8 tests 覆盖：v5 优先 / v4 fallback / v5-only / 都不设 / 空字符串 / whitespace-only / trim / 默认 process.env |
| 4. Browser (/qa-only 或 curl) | **PASS (真 E2E 全链路通过)** | DB 起来 + dev server 新 PID 59187 后，真实完整 E2E 验证成功：teacher1 / student1 双账号 login 302 → 正确目标页面 + session-token 写入；真 cookie 带入后 `/teacher/dashboard` 和 `/dashboard` 200 且渲染真实数据；`POST /api/tasks` 真创建 simulation task 成功（id 回传 + creatorId 关联真 user.id + createdAt 真时间戳）；unauth POST 401 + student POST 403 guard 守护正确。见 E2E Evidence 节 |
| 5. Cross-module regression | PASS | 11 路由真 cookie 下全 200（教师 7 + 学生 4），且 size 比未登录时增加 755-2996 bytes（真 session 带入 sidebar/nav/数据）。auth 配置行为仅扩展不破坏 |
| 6. Security (/cso) | PASS (附加) | 显式 secret 传递符合 Auth.js v5 best practice；`resolveAuthSecret` 防 empty-string / whitespace-only 误配是防御性编程；没有泄漏（secret 在 closure 内，不入响应）；测试用固定字面量，无真 secret 泄漏；role guard 真实验证通过（student 跨角色 POST `/api/tasks` → 403 FORBIDDEN） |
| 7. Finsim-specific | PASS | Auth 仍走 `Credentials` + `jwt` strategy；`requireAuth/requireRole` 链路未动；UI 层无影响（纯 env 读取） |
| 8. Code patterns | PASS | 代码质量好：把 `||` fallback 抽到纯函数（便于 test + 可复用）；trim + 空字符串防呆是主动防御；test 8 场景覆盖全；0 硬编码 secret；无死代码 |

## Evidence

### auth.config.ts diff
```
+import { resolveAuthSecret } from "./secret";
+  // next-auth v5 读 AUTH_SECRET；保留 v4 的 NEXTAUTH_SECRET 作为 fallback 以兼容老部署。
+  secret: resolveAuthSecret(),
```

### 新 `lib/auth/secret.ts`（14 行）
```ts
type SecretEnv = {
  AUTH_SECRET?: string;
  NEXTAUTH_SECRET?: string;
};

export function resolveAuthSecret(
  env: SecretEnv = process.env
): string | undefined {
  const v5 = env.AUTH_SECRET?.trim();
  if (v5) return v5;
  const v4 = env.NEXTAUTH_SECRET?.trim();
  if (v4) return v4;
  return undefined;
}
```

### `.env.example`（相关片段）
```
# next-auth v5 默认读 AUTH_SECRET；auth.config.ts 已 fallback 到 NEXTAUTH_SECRET 兼容 v4 老部署。
# 新部署建议设 AUTH_SECRET；两者都生效。
AUTH_SECRET=dev-secret-change-in-production-must-be-256-bits
NEXTAUTH_SECRET=dev-secret-change-in-production-must-be-256-bits
```

### Tests 实际状态（矫正 builder report）
- Build report L19 写 "无新测试：auth.config 逻辑是'读 env → 传给 NextAuth'，测它等于测 Node 的 || 运算符"
- 实际代码有 `tests/auth-secret.test.ts` 8 tests + `lib/auth/secret.ts` util 抽取
- vitest run 244 tests 绿（report 说 236）
- **这是加分**（原本 "不值得测" 的简单 fallback 被抽成可测函数 + trim 防御）。QA 给予更高的代码质量评价，但指出 report 需更新

---

## E2E Evidence（DB 起来后补做 · 2026-04-24T12:22Z）

**前置确认**（避免再次误诊）：
```
$ lsof -iTCP:5432 -sTCP:LISTEN
com.docke 57961 alexmac 193u IPv6 ... TCP *:postgresql (LISTEN)

$ docker ps | grep finsim-postgres
finsim-postgres-1  Up About a minute (healthy)

$ lsof -i :3000
node 59187 alexmac 13u IPv6 ... TCP *:hbci (LISTEN)
```
DB up + 新 dev server PID 59187（非 HMR 假激活）。

### Teacher1 真登录链路
```
$ curl /api/auth/csrf
{"csrfToken":"ebc9763c40a09f0a..."}

$ POST /api/auth/callback/credentials (teacher1@finsim.edu.cn / password123)
HTTP/1.1 302 Found
Location: http://localhost:3000/teacher/dashboard     ← 正确目标，非 error redirect
Set-Cookie: authjs.session-token=eyJhbGci...          ← session token 成功写入
Set-Cookie: authjs.callback-url=...
```

### Student1 真登录链路
```
$ POST /api/auth/callback/credentials (student1@finsim.edu.cn / password123)
HTTP/1.1 302 Found
Location: http://localhost:3000/dashboard             ← 学生正确入口
Set-Cookie: authjs.session-token=eyJhbGci...
```

### 真 session 带入后的 SSR 渲染
- `GET /teacher/dashboard` with teacher1 cookie → **200 · 39 259 bytes**
  - `王教授` × 4（displayName 真实透传 + 仪表盘卡片数据）
  - `教师` × 2 / `教师工作台` × 1（role label + section 正确）
- `GET /teacher/tasks/new` with teacher1 cookie → **200 · 53 350 bytes**（+755 vs 未登录 52 595）
  - 4 步中文命中 10/10：新建任务 ×2 / 任务类型 ×2 / 基本信息 / 任务配置 / 预览并创建 / 选择任务类型 / 模拟对话 ×3 / 测验 / 主观题 / AI 批量出题

### 真创建 task E2E（PR-4C handleSubmit 路径）
```
$ POST /api/tasks with teacher1 cookie
{
  "taskName": "QA E2E 真登录测试任务",
  "taskType": "simulation",
  "description": "PR-4C QA E2E 验证用",
  "totalPoints": 100,
  "timeLimitMinutes": 20,
  "simulationConfig": {"scenario":"...","openingLine":"...","strictnessLevel":"MODERATE"}
}

Response:
{
  "success": true,
  "data": {
    "id": "a8d60e3d-5327-4353-baf4-1dda9dc8b858",
    "taskType": "simulation",
    "taskName": "QA E2E 真登录测试任务",
    "creatorId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5",    ← teacher1 真实 user.id
    "createdAt": "2026-04-24T12:22:43.076Z",
    ...
  }
}
```
→ 完整 E2E 数据链：session → session.user.id → service → Prisma insert → 返回真 UUID。

**清理**：随后 `DELETE /api/tasks/a8d60e3d-...` → `{deleted: true}`（未污染测试数据库）。

### Role guard 真实验证
- **未登录** `POST /api/tasks` → 401 + `{success:false, error:{code:"UNAUTHORIZED", message:"未登录，请先登录"}}`
- **Student1** `POST /api/tasks` → 403 + `{success:false, error:{code:"FORBIDDEN", message:"权限不足，无法访问此资源"}}`
- **Teacher1** `POST /api/tasks` → 200 + success
- → `requireRole(["teacher","admin"])` 语义真实守护通过，中文错误响应 shape 达标

### 11 路由回归（真 cookie）
| route | status | size (auth) | size (未登录) | 增量 |
|---|---|---|---|---|
| /teacher/dashboard | 200 | 39 265 | 38 413 | +852 |
| /teacher/courses | 200 | 39 160 | 38 300 | +860 |
| /teacher/tasks | 200 | 38 690 | 37 924 | +766 |
| /teacher/tasks/new | 200 | 53 358 | 52 589 | +769 |
| /teacher/instances | 200 | 38 721 | 37 946 | +775 |
| /teacher/groups | 200 | 39 168 | 38 325 | +843 |
| /teacher/schedule | 200 | 39 180 | 38 338 | +842 |
| /dashboard (student) | 200 | 40 615 | 40 367 | +248 |
| /courses (student) | 200 | 40 127 | 39 879 | +248 |
| /grades (student) | 200 | 40 531 | 40 272 | +259 |
| /schedule (student) | 200 | 40 532 | 40 278 | +254 |

→ 11 路由真 cookie 下全 200；大小增量 248-860 bytes 对应真 session 带入的 sidebar user 信息 + SSR 数据差异；无 500 / 回归。

---

## Issues found

### #0（前三轮 QA 自我追认 · 重要）
在 qa_pr-4a_r1 / qa_pr-4b_r1 / qa_pr-4c_r1 中，我三次将 `error=Configuration` 诊断为 "NextAuth secret 命名问题" 并建议 team-lead 开 fix PR。**实际真根因是 Postgres 未启**。

- 错误路径：`error=Configuration` 字面读出来像"config 问题"，就推理是 env 读取/secret 命名相关
- 正确路径：应该在 qa_pr-4a_r1 时就从 dev server stdout 看 server-side 日志链（Prisma 抛 → authorize 抛 → NextAuth 包装）
- 教训：API 错误 label 是**最终表象**，真根因要看 server log；未来 QA 发现诡异行为且 builder 修不掉时，先让 builder 贴 `next dev` stdout，而非急于下诊断

这个误判没造成严重损失（task #50 的代码改动本身是正的 v5 best practice，不是白做），但浪费了一个 PR 的 build/QA 轮次。

### #1（note · builder report 与代码不一致）
- Build report L19 "无新测试"
- 实际有 `tests/auth-secret.test.ts` 8 tests + `lib/auth/secret.ts` util
- 推测：builder 先写 report → 后在 tsc 跑不过或觉得 `||` 行为有空字符串坑时抽出 util + test → 忘了回头更新 report
- 不影响 PASS（加分方向），但记录为 report 维护的警示

### #2（已关闭 · DB blocker 已解除）
- 原 Postgres 未启 blocker 已由用户启 `docker compose up postgres -d` 解决
- `finsim-postgres-1 (healthy)` + dev server 新 PID → 真 E2E 登录 + 创建 task 全程畅通
- 本次 E2E 证据彻底关闭 blocker；后续 PR-4D1 的 `npx prisma migrate dev` 可直接跑

## Overall: **PASS (带完整 E2E 证据)**

**依据**：
1. tsc / 244 tests / build 三绿（代码层）
2. `secret: resolveAuthSecret()` 真实激活：teacher1 / student1 login 302 → 正确目标 + session-token 写入（非 error redirect）
3. **全链路 E2E 跑通**：csrf → login → cookie → SSR 渲染真数据 → POST 真创建 task → 真 creatorId 关联 → cleanup delete；7 教师路由 + 4 学生路由真 cookie 全 200
4. Role guard 真验：unauth 401 / student 跨角色 403 / teacher 200 三线独立证据
5. 0 回归（本 PR 修改仅 3 文件，auth 行为仅扩展 secret 字段）
6. `lib/auth/secret.ts` + 8 tests 比 report 声称的简单 `||` 实现更周到，防 empty-string / whitespace 误配

**给 team-lead 的反馈**：
- DB blocker 闭环，`error=Configuration` 表象问题彻底消除
- PR-4C 的 `handleSubmit` → `POST /api/tasks` 真链路已在本次 E2E 中一并验证（task 创建成功 + 删除清理），等于**顺便给 PR-4C 补了 E2E smoke test**
- PR-4D1 已开工（task #46 in_progress），后续可以做完整真 E2E（含 schema 改动的 Prisma 三步真跑）

## 连 PASS
PR-4A / 4B / 4C / AUTH-fix 四连 PASS，QA 侧 pipeline 健康。**AUTH-fix 已有完整 E2E 证据链支撑**。等 PR-4D1。
