# Build · PR-6A · 登录注册页重设计 · r1

**Phase 6 · 第 1 PR / 3** — 2026-04-25 builder-p6

## Scope（spec L18-40）

按 `.harness/mockups/design/auth-states.jsx` 的 LoginPage 重做 `/login` + `/register`：
- 去掉硬编码 `from-blue-50 to-slate-100` 渐变（Phase 1 QA 观察的遗留）
- 左侧品牌区（深靛 gradient + Wordmark + tagline + 3 stat dots）
- 右侧 form（角色 chip 选择 + email + password + 主按钮）
- 错误状态：账号/密码错误 inline error
- 移动端 375px 响应式

**spec 锁定的不做项**（已严格遵守）：
- 不改 NextAuth credentials provider（PR-AUTH-fix 已稳）
- 不改 `/api/auth/register` 请求体结构
- 不加新角色

## Changed files

| 文件 | 改动量 | 性质 |
|---|---|---|
| `app/(auth)/layout.tsx` | -8/+3 行 | 简化为 `min-h-screen bg-paper` 容器（去掉 max-w-md 居中卡） |
| `app/(auth)/login/page.tsx` | rewrite, 232 行 | split-screen + role chip + inline error |
| `app/(auth)/register/page.tsx` | rewrite, 393 行 | 同样视觉 + 保留 student/teacher 分支 + class 加载 + adminKey |

**未触动**：`lib/auth/`、`app/api/auth/*`、`components/sidebar.tsx`、`components/layout/topbar.tsx`（这些都引用 `/login` 路径但不依赖页面内部结构）。

## Anti-regression scope（CLAUDE.md rules 5/6/7/8/9）

- ✅ `signIn("credentials", {...})` 调用签名 byte-equivalent（`email/password/redirect:false`）
- ✅ 登录后角色路由保留：`teacher|admin → /teacher/dashboard`，其他 → `/dashboard`
- ✅ `/api/auth/register` POST body 结构未变（`email/password/name/role/classId/adminKey`）
- ✅ `/api/classes` 加载逻辑未动（仍是 `role===student && classes.length===0` 触发）
- ✅ register 内部三步流程（fetch register → signIn → push by role + refresh）byte-equivalent
- ✅ 没有改 service 层 / 不动 `lib/auth/`
- ✅ 没碰 `/login` 路径常量（sidebar/topbar 的 `signOut({ callbackUrl: "/login" })` 无影响）

**API caller grep 结果**（用于验证 register 不破）：
```
app/page.tsx:6:                redirect("/login");
components/sidebar.tsx:99:    signOut({ callbackUrl: "/login" });
components/layout/topbar.tsx:55: signOut({ callbackUrl: "/login" });
lib/auth/auth.config.ts:53:    signIn: "/login",
```
全部仍指向相同 URL，无需改动。

## 设计落地说明

**Token-based**（无任何硬编码颜色）：
- 左侧 hero 用 `var(--fs-primary-deep) → var(--fs-primary-lift)` linear-gradient
- 装饰圆使用 `color-mix(in oklab, var(--fs-sim) 30%, transparent)`
- 右侧 form 用 `bg-paper-alt`、`border-line`、`text-ink` / `text-ink-3/4/5`
- inline 错误用 `var(--fs-danger-soft)` + `var(--fs-danger)` 边框/前景
- 主 CTA 按钮 `var(--fs-ink)`（黑色，和设计稿一致）

**响应式策略**：
- 桌面（lg+）：`grid-cols-[1.1fr_1fr]`（1.1:1），左侧 hero 显示
- 移动（<lg）：`grid-cols-1`，左侧 hero `hidden`（`hidden lg:flex`），form 全宽，顶部加 mobile-only logo bar（`lg:hidden`）
- 真渲染验证：login/register HTML 都有 `lg:hidden` 和 `hidden ... lg:flex` 两种类（grep -c=1）

**角色 chip 切换**：
- login 上是 **视觉提示**（仅切换文案 sub："使用学校邮箱" vs "使用工作邮箱"），真实角色仍由账号决定（NextAuth 不变）
- register 上是 **真切换**：影响后续表单分支（学生 → 班级选择，教师 → adminKey）和提交 body 的 `role` 字段
- 两者都用 `role="group"` + `aria-label` 提供 a11y

**Inline error 取代 toast**：
- 设计稿要求"账号/密码错误 inline error"
- 实现：`useState<string|null>` + `role="alert"` 红色卡片
- 保留 `toast.success("登录成功")` 在成功路径（feedback 一致性）
- toast.error 仅在 register 自动登录失败和 class 加载失败这种**间接错误**保留（非主路径错误）

## Verification

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型 | `npx tsc --noEmit` | 0 错（completed silent） |
| 单测 | `npx vitest run` | **366 / 366 passed**（37 files / 366 tests，无新增也无破坏） |
| 构建 | `npm run build` | 25+ routes 全 compile，`/login` 和 `/register` 仍是 `○ Static` |
| /login 真渲染 | `curl -s http://localhost:3000/login` | HTTP 200 · 29708b · 命中"欢迎回来 / FinSim AI / 学生登录 / 教师登录 / 立即注册 / 登录" 全部 |
| /register 真渲染 | `curl -s http://localhost:3000/register` | HTTP 200 · 32370b · 命中"创建账号 / 学生注册 / 教师注册 / 加入老师的课堂 / 立即登录 / 至少 6 个字符" 全部 |
| 真 teacher1 登录 | NextAuth /api/auth/csrf → callback/credentials | 302 redirect + session cookie set + /api/auth/session role=teacher |
| 真 student1 登录 | 同上 | 302 + role=student |
| /dashboard regression | curl 带 student cookie | 200 |
| /teacher/dashboard regression | curl 带 teacher cookie | 200 |
| 错误密码路径 | bad pw signIn | 302（NextAuth 写法），session=null（前端 signIn(redirect:false) 会拿到 result.error，触发 inline error）|
| 6 路由 regression | /courses /grades /teacher/courses /teacher/instances 等 | 全 200 |

## 未确定 / 未做（明确清单）

- **a11y**：button 没加显式 `aria-pressed` 表示 chip 选中（用了 `role="group"` 包裹），如果 QA 觉得需要可以加。
- **forgot password link**：mockup 里有"忘记密码？"超链接，但项目没有这个端点。我把它改成纯文本"忘记密码？请联系管理员"避免出现死链。
- **OAuth/SSO buttons**：mockup 底部"学校统一认证 / 邮箱登录"按钮，因为后端没实现这两条路径，留空白。spec 没要求做。
- **Dev server restart**：本 PR 仅前端改动（无 schema、无 service interface 改动），dev server **无需重启**——curl 已实测路由 200 全在 PID 33924 上响应。
- **暗色模式**：tokens 里有 `.dark` 完整覆盖，本页用 token 自动跟随暗色（spec 没要求显式验证，未实测）。

## Builder 自报担心的点

- 本来想用 shadcn 的 `Card`/`Button` 组件，但设计稿要的是**全屏 split layout**，shadcn Card 自带的 `border/shadow/rounded-xl` 不适合做 hero panel——所以全部用裸 `div` + 内联 `style` + Tailwind。token 全部走 CSS 变量，没有任何硬编码颜色。
- register 改成 `useState<"student" | "teacher">` 默认 `"student"` 而不是空串：mockup 默认就是学生 tab 高亮，且 spec 锁了"角色 chip 选择 student/teacher"。原代码用 `""` 空串只是为了让 placeholder 显示"请选择角色"，但 chip 切换不需要这个状态。**副作用**：register 进入页面立即就会跑 `/api/classes` 的加载（之前要先选学生角色才跑）——我认为这是符合设计意图的（默认就是学生注册场景，立即加载班级列表更顺）。如 QA 觉得不妥，把 default 改回 `"student"` 但延迟到点击后才 fetch（加 `hasInteracted` flag）。
- mockup 里有"7 天内免登录"勾选框，没在登录里实现，因为 NextAuth 默认就是 30 天 session 不需要勾。如 QA 强求加，得改 auth.config.ts 的 maxAge——超出本 PR 范围。

## 给 QA 的复测清单

- 真访问 `/login` desktop 看左侧深靛 hero 渲染（gradient + 3 stat dots + tagline），mobile 看 `lg:hidden` 后 form 全宽 + mobile-only logo bar
- 真访问 `/register` 切换 student/teacher chip：student → 班级 Select 出现 + 拉 /api/classes，teacher → adminKey 输入框出现
- 错密码 inline 显示"邮箱或密码错误"红色 alert
- 真登录 teacher1/student1 → 302 + session cookie + 跳到对应 dashboard
- 真 register（拿一个临时邮箱）跑通"注册→自动登录→跳 dashboard"流程
- 6 个回归路由（dashboard/courses/grades/teacher/courses/teacher/instances）全 200
- 0 硬编码颜色（grep `#0F\|#1E\|#2A\|#FF\|blue-50\|slate-` 应只在 layout 旧引用）

## 下一步（依赖链）

PR-6A r1 PASS 后 → 我认领 PR-6B（8 空错态组件 + boundary 挂载，task #67）。
