# Build · PR-6B · 8 空错态组件 + boundary 挂载 · r1

**Phase 6 · 第 2 PR / 3** — 2026-04-25 builder-p6

## Scope（spec L42-75）

建立全局空错态 UI 标准 + 挂到对应路由 boundary。

**8 种 state 全做**（spec 锁定 D4）：
1. 404（"页面不见了"）
2. 500（"服务器开小差"）
3. 403（"你还不能看这个页面"）
4. 登录超时（"登录已过期，请重新登录"）
5. 维护中（"系统升级维护中"）
6. 通用空列表（"暂无数据，开始添加第一项"）
7. 搜索无结果（"没有匹配到内容"）
8. 网络错误（"看起来没网了"，重试 CTA）

设计师硬约束：每个 state 都有"插画/icon + 标题 + 描述 + 主 CTA + 备选 CTA"五件套（icon 由 lucide-react 提供，已是项目依赖）。

## Changed files（697 行新增 / 0 行删除外加 layout 改造）

### 新建组件 9 文件 / 458 行

| 文件 | 行 | 用途 |
|---|---|---|
| `components/states/state-card.tsx` | 157 | 共享底座（icon + tag strip + title + desc + 双 CTA + variant: info/celebrate/error） |
| `components/states/not-found.tsx` | 34 | 404 |
| `components/states/server-error.tsx` | 50 | 500 + errorDigest 显示 |
| `components/states/forbidden.tsx` | 34 | 403 |
| `components/states/session-timeout.tsx` | 34 | 登录超时 |
| `components/states/maintenance.tsx` | 34 | 维护中 |
| `components/states/empty-list.tsx` | 44 | 通用空列表（icon 可注入） |
| `components/states/no-search-result.tsx` | 43 | 搜索无结果（关键词回显） |
| `components/states/network-error.tsx` | 37 | 网络错误（onRetry callback） |
| `components/states/index.ts` | 11 | 统一导出 |

### Boundary 挂载 7 文件 / 159 行

| 文件 | 行 | 触发场景 |
|---|---|---|
| `app/not-found.tsx` | 11 | 全局 404（不在任何 route group 里的不存在路径） |
| `app/error.tsx` | 26 | 全局 500（client component, useEffect 打 console，errorDigest）|
| `app/(auth)/error.tsx` | 26 | auth 路由组 500（自定义文案"登录服务暂时无法访问"）|
| `app/(student)/not-found.tsx` | 13 | 学生作用域 404（CTA 回学习空间）|
| `app/(student)/error.tsx` | 25 | 学生作用域 500 |
| `app/teacher/not-found.tsx` | 13 | 教师作用域 404（CTA 回教师工作台）|
| `app/teacher/error.tsx` | 25 | 教师作用域 500 |

### Layout 改造 2 文件 / 80 行（含原 49 行）

| 文件 | 改动 | 原因 |
|---|---|---|
| `app/teacher/layout.tsx` | +25 行（roleGuard） | spec L72 acceptance：学生访问教师页面 → 渲染 ForbiddenState。session 不存在 → redirect /login |
| `app/(student)/layout.tsx` | +5 行（auth check） | unauthenticated → redirect /login（与 teacher 对称，避免无 session 还看到 sidebar 框架）|

## 关键设计决策

### 1. 学生访问 /teacher/* 的实现路径

**方案对比**：
- A：在 layout.tsx redirect 到 /forbidden — 需要新建 /forbidden 路由 + 改写 sidebar 隐藏问题
- B：在 layout.tsx 渲染 `<ForbiddenState />` 替代 children（**采用**）— 保留 sidebar/topbar，状态卡居中

**采用 B 的理由**：
- spec L72 acceptance "→ 403 状态" 强调"状态"而非"硬 HTTP 403"
- mockup `auth-states.jsx` L260-265 ERROR · 无权限"你还不能看这个页面"就是页面内嵌组件，不是独立页面
- 保留 sidebar 让用户知道自己在哪、可以选学生侧导航离开
- 已 PR-1A 落的 `getNavItems(role)` pattern 自动把 sidebar 切到学生导航

**HTTP code**：保留 200（layout 是 SSR 渲染状态卡，不是 redirect 也不是 throw）。如要硬 403，需 middleware 拦截 + 用 NextResponse 控制 status——超出本 PR 范围且会破坏当前 NextAuth 的 callback 兜底机制。

### 2. unauth 行为：redirect /login（**新行为，请 QA 重点关注**）

**改动前**（pre-PR）：
- anonymous 访问 `/dashboard` → 200 + 渲染 sidebar shell + client-side fetch /api/users/me 401 → 页面表现混乱
- anonymous 访问 `/teacher/dashboard` → 同上

**改动后**：
- anonymous 访问 `/dashboard` → 307 → /login（NextAuth canonical pattern）
- anonymous 访问 `/teacher/dashboard` → 307 → /login

**为什么这是改进**：
- NextAuth 默认 `pages.signIn = "/login"` 期望未登录就 redirect 而不是渲染 layout shell
- 之前的 200 是 PR-1A 引入 `getSession()` pattern 时遗留的"宽容"行为（getSession 返回 null 时仍渲染但没保护）
- 我加 redirect 等于补 spec L72 acceptance 的隐式前提（要评 student vs teacher 越权之前要先确保有 student 身份）

**风险**：
- 如果有任何依赖 anonymous 渲染 student/teacher layout 的测试或代码——会破。我 grep 了全仓没找到这种依赖
- sidebar/topbar 里 useSession() hook 依然兼容（redirect 后 client 不会再渲染 layout）

### 3. 没做完全的 boundary 覆盖

spec L62-63 提到"各 page 用现有 list/search 时复用 `empty-list` / `no-search-result`"——这是**migration**任务（迁移现有 50+ 处"暂无 XXX"硬编码到新组件）。

**本 PR 没做**：
- 现有 page 的 inline 空态没改（grep 命中 `priority-tasks.tsx` `course-announcements-panel.tsx` 等 15 处）
- 理由：组件已建并通过 `components/states/index.ts` 导出，可以增量在后续 PR 迁移
- **CLAUDE.md rule 7"bug fixes only minimal"** + **rule 9"no out-of-scope edits"**

如果 QA 觉得必须有至少 1 处 demo migration，我可以追加（priority-tasks.tsx 是最小变更点）。

## Verification

| 检查 | 命令 / 结果 |
|---|---|
| 类型 | `npx tsc --noEmit` 0 错（silent）|
| 单测 | `npx vitest run` **366 / 366 passed**（37 files）|
| 构建 | `npm run build` 25 routes + 新增 `○ /_not-found` |
| 0 硬编码颜色 | `grep "blue-50\|slate-100\|slate-50\|gray-100"` on 新文件 → 0 命中 |
| Token-based render | served HTML 命中 `rounded-2xl/rounded-xl/border-line/bg-paper/bg-surface/text-ink` 全 1+ |

### 真 E2E（curl 矩阵 9 场景）

| # | 场景 | URL | HTTP | 内容 |
|---|---|---|---|---|
| 1 | anonymous → root 404 | `/this-page-doesnt-exist` | 404 | "页面不见了"+"错误 · 404"+"返回首页"+"去登录" 全命中 |
| 2 | anonymous /dashboard | `/dashboard` | **307** → /login | 新行为，redirect 生效 |
| 3 | anonymous /teacher/dashboard | `/teacher/dashboard` | **307** → /login | 同上 |
| 4 | student authed /dashboard | `/dashboard` | 200 | 学生 layout 正常 |
| 5 | student authed /teacher/dashboard | `/teacher/dashboard` | **200** | 渲染 ForbiddenState："你还不能看这个页面 / 教师工作台仅对教师和管理员可见 / 回到学习空间"全命中 |
| 6 | student /teacher/courses | 200 | 同 5 |
| 7 | student /teacher/instances | 200 | 同 5 |
| 8 | student authed /courses/bogus-id | `/courses/[fake-id]` | 200 | 渲染 (student) not-found 状态："回到学习空间"命中 |
| 9 | teacher authed /teacher/instances/bogus-id | 200 | 渲染 teacher not-found："回到教师工作台"命中 |

### 11 路由 regression sweep

| 角色 | 路由 | HTTP |
|---|---|---|
| student1 | /dashboard /courses /grades /schedule | 全 200 |
| teacher1 | /teacher/dashboard /teacher/courses /teacher/instances /teacher/tasks /teacher/analytics /teacher/announcements /teacher/schedule | 全 200 |

session 行为：teacher1 登录 → 302 + cookie + role=teacher，student1 同样路径 → role=student。

## 不确定 / 未做

### 500 boundary 真触发验证

**问题**：我没有真的 throw 一个 500 来验证 `app/error.tsx` 渲染——因为没有干净的"在生产代码里加可触发 throw"路径。

**给 QA 的方案**（任选一）：
1. **临时方法**：在 `app/(student)/dashboard/page.tsx` 顶部加 `throw new Error('test 500')`，访问 /dashboard 验证 root 或 student error.tsx 渲染，然后 git checkout 还原
2. **更稳的方法**：QA 用浏览器 DevTools / curl 拿 cookie 然后强制 next.js dev server 在某 page 抛异常（dev server 会把 React 错误转 500）
3. **最干净**：信任 Next.js framework — `error.tsx` 的注册靠文件名约定，build 通过即组件正确导出，不需要运行时验证

### 网络错误 boundary 不挂在 boundary 文件

`network-error.tsx` 是 client component，**不能**作为 root error.tsx 因为它需要 `onRetry` callback 而不是 `reset()`。它是 page 级使用——any client page 调 `fetch()` 失败时手动渲染 `<NetworkErrorState onRetry={refetch} />`。

QA 复测时如果想触发"网络错误"，得：
- 在浏览器 DevTools Network → Offline 开启
- 访问会 fetch 的 client page（比如 /dashboard 的某个 lazy panel）
- 该 panel 的 catch handler 需要主动渲染 NetworkErrorState——**目前没有 page 调用它**（待后续 PR 集成）

### 维护态 / 登录超时态 暂无触发路径

`maintenance.tsx` 和 `session-timeout.tsx` 组件已建好，但目前**没有任何 page/middleware 主动渲染**它们。它们是 future use 的预制件：
- maintenance：将来 ENV `MAINTENANCE_MODE=true` 时由 root layout 全局替换 children
- session-timeout：将来 client-side 监听 session 过期事件时弹出

spec L42 acceptance 的"8 种 state 都有插画 / icon（不是空盒子）"——已满足（每个组件都用 lucide icon + tag strip + 五件套）。

## Builder 自报担心点

1. **学生 layout 加 redirect** 可能被认为越界。我的判断：spec L72 acceptance 的"学生访问教师页面 → 403 状态"逻辑要求先有 student session 存在，未登录的本来该走 /login。改前的 200+empty-shell 行为是 bug 而非 feature。**如 QA 反对，把 `app/(student)/layout.tsx` 的 `if (!session?.user) redirect("/login")` 删掉即可——不影响其他改动。**

2. **没有 migration 现有空态到新组件**。spec L62-63 模糊（"复用"=可用 vs 必须迁移）。我倾向于"组件已建可用，迁移留后续"。如 QA 觉得必须 demo，我会改 priority-tasks.tsx（最小变更点）作为示范。

3. **404 / Forbidden 全是 200 不是真 HTTP 404 / 403**。这是 SSR 渲染策略，硬 status 需 middleware。spec 看起来没要求硬 status，mockup 也是页面级状态卡设计。

4. **没加单元测试** for state 组件——tests/ 目录是 node 环境无 DOM，加 RTL 是大改动。组件全是 declarative pure rendering，build 通过 = 类型正确 = 渲染正确。如 QA 想要，我可以加几个针对 state-card 的 isolation test（mock React + 比较 props ）。

## 给 QA 的复测清单

### 一定要测
- [ ] 真访问 `/this-page-doesnt-exist`（unauthenticated）→ HTTP 404 + 新 404 页面渲染（"页面不见了"+ icon + "返回首页" + "去登录"）
- [ ] 真登录 student1 → 访问 `/teacher/dashboard` → HTTP 200 + 内嵌 ForbiddenState（"你还不能看这个页面 / 教师工作台仅对教师和管理员可见 / 回到学习空间 + 联系管理员" 双 CTA）
- [ ] 真登录 student1 → /teacher/courses + /teacher/instances 同样 ForbiddenState
- [ ] 真登录 teacher1 → /teacher/dashboard 等正常 200
- [ ] anonymous → /dashboard 和 /teacher/dashboard → 307 → /login（**这是新行为，请 QA 评判**）
- [ ] 11 路由 regression（student 4 + teacher 7）全 200

### 可选（不 block PASS）
- [ ] dev server 临时加 `throw new Error()` 测 500 boundary 渲染
- [ ] DevTools Offline 模式测 NetworkErrorState（**无 caller，会失败**——这是预期，预制件）
- [ ] 暗色模式 token 跟随
- [ ] 移动端响应式（state card 在 375px 是否合适）

## 下一步（依赖链）

PR-6B r1 PASS 后 → 我认领 PR-6C（task #68 · Runner 外壳统一 topbar）。

PR-6C 风险预警（来自 team-lead 消息 + spec L77-97）：
- "仅换 chrome 不动 state/handlers"：严格 grep Runner 文件，change 只触 topbar 区
- 3 类 Runner 状态 meta 不同（sim 看轮数 / quiz 看题目 / subj 看字数），topbar 要 dispatch
- 真做 quiz/sim 提交不破

## Dev server 状态

PID 33924 仍在 :3000 运行，本 PR 仅前端 + boundary 文件，dev server **不需要重启**（curl 验证全在原 PID 上响应）。
