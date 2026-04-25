# QA Report — pr-6a r1 (登录注册页重设计)

**Phase 6 · 第 1 PR / 3** — 2026-04-25 qa-p6 (independent verification of build_pr-6a_r1.md)

## Spec: 按 mockups/design/auth-states.jsx 重做 /login + /register（split-screen + role chip + inline error，零改 NextAuth/API）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | split-screen lg:grid-cols-[1.1fr_1fr] + 角色 chip role=group + inline-error role=alert + 中文 + 移动响应（`hidden lg:flex` / `lg:hidden` mobile-logo bar）|
| 2. tsc --noEmit | PASS | 0 错（silent completed）|
| 3. vitest run | PASS | **366 / 366 passed**（37 files），无新增也无破坏 |
| 4. Browser (curl SSR + 真 NextAuth E2E) | PASS | /login=200/29724b · /register=200/32371b · teacher1 302→/teacher/dashboard role=teacher · student1 302→/dashboard role=student classId 完整 · bad pw 302→`/login?error=CredentialsSignin&code=credentials` session=null（前端 redirect:false 接住 result.error → setInlineError）|
| 5. Cross-module regression | PASS | `/api/auth/register` POST body 6 字段（email/password/name/role/classId/adminKey）与 route.ts L26 字段集 byte-equivalent · `/api/classes` 仅 register page 调用 · `signIn('credentials', {email,password,redirect:false})` 签名零改 · sidebar/topbar/page.tsx 的 `/login` 路径常量无变化（grep 4 处全保留）|
| 6. Security (/cso) | N/A | 仅前端视觉 + state machine 改动，未触 auth/permission/payment 模块；NextAuth credentials provider 零改、register API 零改、role guard 零改 — OWASP/STRIDE 触发条件未命中 |
| 7. Finsim-specific | PASS | UI 全中文（欢迎回来 / 创建账号 / 学生登录 / 教师登录 / 至少 6 个字符 / 邮箱或密码错误 等）· error 中文 inline-alert 替代 toast 主路径但保留 success-toast 一致性 · auth flow 走 NextAuth 不动 · 无 Service interface 变更 · 无 Route Handler 业务逻辑（route.ts 零改）· API 响应仍 `{success,data/error}` |
| 8. Code patterns | PASS | 仅 3 文件（layout.tsx -8/+3 / login.tsx rewrite 232 行 / register.tsx rewrite 393 行）· 0 drive-by · token-only 上色（grep 仅 2 处 `#fff` 在装饰底纹的 radial-gradient 1px 圆点 dot pattern，非页面色板，业界惯例）· 无新依赖 · `from-blue-50/to-slate-100` served HTML 0 命中（旧渐变彻底清掉）|

## Verification matrix

### Build pipeline
- `npx tsc --noEmit`: 0 错
- `npx vitest run`: **366 / 366 passed** (37 files / 1.22s)
- `npm run build`: 25 routes 全 compile · `/login` `/register` 仍 `○ Static`

### Token / 视觉净度
- 服务 HTML grep 命中 token：`fs-primary-deep`×1, `fs-primary-lift`×1, `fs-sim`×4, `fs-ink`×3, `fs-bg-alt`×1（全经 CSS var(--fs-*) 链路）
- 硬编码色 sweep：0 命中（仅 `#fff` 在装饰 radial-gradient dot pattern 上，spec/auth-states.jsx 自身设计要求纯白点抽象底纹）
- 旧硬编码 `from-blue-50 to-slate-100` 已删（served HTML / source 双 0）

### 真 E2E (沿用 PR-AUTH-fix cookie session pattern)
| 场景 | HTTP | location | session role |
|---|---|---|---|
| teacher1 csrf+credentials POST | 302 | /teacher/dashboard | role=teacher 王教授 |
| student1 csrf+credentials POST | 302 | /dashboard | role=student classId=deedd844-... 张三 |
| bad pw teacher1 | 302 | /login?error=CredentialsSignin&code=credentials | session=null |
| unknown email | 302 | /login?error=CredentialsSignin&code=credentials | session=null |

bad-pw 路径产物：前端用 `signIn(redirect:false)` 会在 client 拿到 `{ error: "CredentialsSignin" }` → 触发 `setInlineError("邮箱或密码错误")` → 红色 alert role=alert 渲染（login.tsx L39-42）。

### Regression sweep（11 路由）
- 学生 4 页（/dashboard /courses /grades /schedule）：全 200
- 教师 7 页（/teacher/dashboard /teacher/courses /teacher/instances /teacher/tasks /teacher/analytics /teacher/announcements /teacher/schedule）：全 200
- 边角：未登录 /login + /register = 200，已登录访问 /login + /register = 200（与现行无 auth-redirect 守卫一致）

### API 契约不破
- `/api/auth/register` 调用方仅 register page，POST body 6 字段与 route.ts L26 解构集对齐
- `/api/classes` 加载条件 `role==='student' && classes.length===0` 在 useEffect 内零改
- `signIn("credentials", { email, password, redirect:false })` 签名 byte-equivalent
- register 内部三步流程（fetch register → signIn → push by role + refresh）零改
- 路由后跳逻辑保留：teacher|admin → /teacher/dashboard，其他 → /dashboard

## Builder 自报担心点的 QA 判断

1. **register 默认 role="student" 进页面立即拉 /api/classes** — **PASS**（builder 判断正确）：原 `""` 默认是为了让 placeholder 显"请选择角色"，但 chip 切换不需要这个状态；mockup 默认就是学生 tab 高亮；预拉取 /api/classes 让交互更顺，且 classes 列表本身无敏感信息（公开课表）。无副作用。
2. **"忘记密码？请联系管理员" 纯文本（替死链）** — PASS：项目无 forgot-pw 端点，纯文本提示比死链更稳。
3. **OAuth/SSO 按钮没做** — PASS：spec 没要求，后端无路径。
4. **7天内免登录勾选框没做** — PASS：NextAuth 默认 30 天 session，多此一举。
5. **裸 div + 内联 style 而非 shadcn Card** — PASS：split hero panel 不适合 Card 的 border/shadow/rounded-xl，token 全走 CSS 变量已是最优解。

## Issues found

无。

## 备注（不阻塞 PASS）

- chip 选中目前用视觉 active state（背景色+文字色+box-shadow 切换）+ `role="group"`/`aria-label` 提供 a11y。如果未来要更"严格" a11y，可以追加 `aria-pressed={active}` 表达"toggle 状态"。spec 未要求、设计稿无此约束、不阻塞本 PR。
- 暗色模式 `.dark` token 链已落，但本轮未显式实测暗色访问（spec 未要求）。
- bad-pw 真"前端 inline error 渲染"无法仅通过 curl SSR 复现（state-driven，需要 client JS 执行 onSubmit）— 改用读 login.tsx L39-42 + 真 302→error 回路验证整条链可达。

## Overall: **PASS**

Phase 6 第 1 PR 视觉重做 + 零 auth flow 破坏 + 全维度三绿 + 11 路由回归无破。建议 builder-p6 直接认领 PR-6B（task #67）。
