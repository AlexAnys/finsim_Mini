# QA Report — PR-1A · SSR 角色闪烁修复 r1

**日期**：2026-04-24
**QA**：qa
**Spec**：`.harness/spec.md` § PR-1A
**Build report**：`.harness/reports/build_pr-1a_r1.md`

## Spec 摘要

RSC 化 `(student)/layout.tsx` + `teacher/layout.tsx`，在 server 端 `getSession()` 解析 role + name，传给 Sidebar 新增的 `initialRole` / `initialName` props。SSR 阶段直接用 server role 渲染 nav，避免 hydrate 前的 student fallback 闪烁。

## 验证表

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 两 layout async+getSession；sidebar 新增 props；providers/auth/nav items/API 零改（git diff --stat 仅 4 文件）|
| 2. tsc --noEmit | PASS | 无输出，0 错误 |
| 3. vitest run | PASS | 11 files / 61 tests 全过，530ms |
| 4. Browser (curl + 真登录) | PASS | teacher/student 首 SSR HTML grep 双向命中（见下 Evidence） |
| 5. Cross-module regression | PASS | 额外抽查 `/teacher/courses` + `/courses` 均正确；未登录 HTTP 200 走 student fallback（pre-existing 行为，spec 明示非 regression） |
| 6. Security (/cso) | N/A | 无 auth/session 存储/token/权限逻辑改动（providers.tsx + auth.config.ts 零改），不触发 CSO 门槛 |
| 7. Finsim-specific | PASS | UI 全中文；仍走 `requireAuth`（未动）；API response shape 未变；无新增 API |
| 8. Code patterns | PASS | diff 极干净，无 drive-by refactor；根因修复（SSR role 透传）非 workaround |
| 9. npm run build | PASS | 编译过；使用 sidebar 的路由 `ƒ Dynamic`（预期，auth 依赖 cookies） |

## Evidence — 真浏览器 curl 验证

**Dev server**：localhost:3000 已运行；无需重启（layout 仅 async+props 变化，Next.js hot-reload 正常吃下）。

### 教师登录 → `/teacher/dashboard` 首 SSR HTML

- CSRF → `POST /api/auth/callback/credentials`（teacher1@finsim.edu.cn / password123）→ HTTP 302 + `authjs.session-token` 写入
- `GET /teacher/dashboard` → HTTP 200, 35118 bytes
- `教师工作台`：**1 次** ✅（section label 命中）
- `学习空间`：**0 次** ✅（无学生 label 泄露）
- `课程管理`：**1 次** ✅、`班级管理`：**1 次** ✅（教师 nav 命中）
- `我的课程`：**0 次** ✅、`我的成绩`：**0 次** ✅（学生 nav 无泄露）
- 用户卡显示：`王教授</p>...教师</p>` — displayName + role label SSR 正确透传
- `>学生<` + `>管理员<`：0 次 ✅

### 学生登录 → `/dashboard` 首 SSR HTML

- `POST /api/auth/callback/credentials`（student1@finsim.edu.cn / password123）→ HTTP 302 + session token OK
- `GET /dashboard` → HTTP 200, 36470 bytes
- `学习空间`：**1 次** ✅、`教师工作台`：**0 次** ✅
- `我的课程` / `我的成绩`：各 **1 次** ✅
- `课程管理` / `班级管理`：各 **0 次** ✅
- `>学生<`：1 次；`>教师<`/`>管理员<`：0 次 ✅

### Cross-route 抽查

- 教师访问 `/teacher/courses`：HTTP 200，`教师工作台=1`，`学习空间=0`
- 学生访问 `/courses`：HTTP 200，`学习空间=1`，`教师工作台=0`

### 未登录 edge case

- 未登录 `GET /teacher/dashboard` → HTTP 200（非 500），走 student fallback（因 `initialRole` undefined）
- HTML 含 "Error" 关键字来自 React `HTTPAccessErrorFallback` preamble + `Error.stackTraceLimit`，非实际错误页
- Spec 在 § Risks 明示 "未登录访问 layout 时 fallback 到 student nav 是 pre-existing 行为"，非 PR-1A regression，middleware 侧的 auth 强制在别处生效

## Scope & Risk 复核

- `providers.tsx`（含 `SessionProvider`）：零改动 ✅（spec 明示不动）
- `lib/auth/auth.config.ts` / 登录登出 flow：零改动 ✅
- Nav items 数组内容：零改动（仅结构调整 role 来源）✅
- API endpoints：零改动 ✅
- Prisma schema：未涉及（Phase 1 不改 schema）✅
- `npm run build` 下所有使用 sidebar 的路由已是 Dynamic — builder 正确标注无性能 regression

## NextAuth 版本说明

Spec 示意 `getServerSession(authOptions)` 是 v4 写法；项目实际用 v5（`next-auth@5.0.0-beta.30`），走 `lib/auth/guards.ts#getSession()` wrap `auth()`。语义等价，**非偏离 spec**。

## Issues found

无。

## Overall: **PASS**

两 layout 的 SSR 角色透传在真浏览器 HTML grep 双向验证命中（教师侧 "教师工作台=1/学习空间=0"，学生侧相反）；tsc/vitest/build 全过；scope 精准，无 drive-by。builder 可继续 PR-1B。
