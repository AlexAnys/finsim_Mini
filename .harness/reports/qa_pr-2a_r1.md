# QA Report — pr-2a r1

## Spec: Phase 2 PR-2A · TopBar 共享 shell（面包屑 / 通知 / AI 助手 / 用户菜单 · 挂到学生 + 教师 layout · desktop only · 不破坏 SSR 固定 role）

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | TopBar 组件 `components/layout/topbar.tsx`：左面包屑（client + `usePathname`）、右通知/AI 助手/用户菜单；挂到 `app/(student)/layout.tsx:15-24` + `app/teacher/layout.tsx:15-24`；高度 `h-14`（56px）、底边 `border-b border-line`、底色 `bg-paper`、`sticky top-0 z-30` — 全部对齐 spec |
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | 14 suites / 82 tests 全绿（含新 `breadcrumbs.test.ts` 8 tests） |
| 4. `npm run build` | PASS | 25 routes 全编译，无新增 warning |
| 5. Browser (真 curl + cookie 登录) | PASS | 见下表 A/B |
| 6. Cross-module regression | PASS | sidebar 结构未改（仅 layout 外壳加一层 flex-col）；`/api/lms/*` 零改动；`requireAuth/requireRole` 零改动；无 schema 改动；登录 302 → 6 页 200 全部正常 |
| 7. Security (/cso) | N/A | 不触及 auth/session/token/支付/上传，仅 UI |
| 8. Finsim-specific | PASS | 全中文面包屑标签（仪表盘/我的课程/我的成绩/任务中心/课表）；中文登出标签；用户菜单角色 label 走中文（教师/学生/管理员）；TopBar 只是 client UI，无业务逻辑 |
| 9. Tailwind class 清洁度 | PASS | `grep -E 'bg-(violet\|emerald\|blue\|indigo\|red\|green\|yellow\|purple\|pink\|orange)-[0-9]'` 在 PR-2A 4 个文件 **0 matches**；全走 tokens（`bg-paper`、`bg-brand-soft`、`border-line`、`text-ink-2/4/5`、`text-brand`、`text-danger`） |

### 表 A · 真浏览器面包屑 SSR 抓取（cookie 登录 student1 + teacher1）

| URL | HTTP | 面包屑 SSR 内容 |
|---|---|---|
| `/dashboard`（student1） | 200 | `学生 / 仪表盘` |
| `/grades`（student1） | 200 | `学生 / 我的成绩` |
| `/schedule`（student1） | 200 | `学生 / 课表` |
| `/teacher/dashboard`（teacher1） | 200 | `教师 / 仪表盘` |
| `/teacher/courses`（teacher1） | 200 | `教师 / 我的课程` |
| `/teacher/tasks`（teacher1） | 200 | `教师 / 任务中心` |
| `/teacher/courses/893aae18-c98b-4f02-ab4a-2b21d195025e` | 200 | `教师 / 我的课程`（uuid 被 `isOpaqueId` 跳过，**未进面包屑**） |

→ 所有 7 路由面包屑动态跟随路由；`teacher/` 前缀被正确剥离；uuid 跳过生效。

### 表 B · 回归守护（PR-1A SSR 固定 role 不被破坏）

| 页面 | 首屏 HTML 角色 label 计数 | 判定 |
|---|---|---|
| `/dashboard`（student1） | "学生" ×2，"教师" 0，"管理员" 0 | PASS — 无角色闪烁 |
| `/teacher/dashboard`（teacher1） | "教师" ×3，"学生" 0，"管理员" 0 | PASS — 无角色闪烁 |

→ TopBar 作为 client component 接受 layout 传入 `initialRole/initialName` SSR seed，PR-1A 的固定 role 模式延续。

### 表 C · TopBar 结构元素 SSR 落地验证（student1 /dashboard 首屏）

| 元素 | Evidence |
|---|---|
| 外层容器 class | `hidden lg:flex sticky top-0 z-30 h-14 items-center gap-3.5 border-b border-line bg-paper px-7` — 完整匹配 |
| 通知按钮 | `aria-label="通知"` ×1 |
| AI 助手按钮 | 文案 "AI 助手" ×1，class `bg-brand-soft text-brand hover:bg-brand-soft-2`（token 化，无硬编码） |
| 用户菜单 trigger | `aria-label="用户菜单"` ×1；avatar fallback "张"（student1 = 张三，SSR 即正确） |
| teacher1 avatar fallback | "王"（teacher1 = 王老师） |

### 表 D · Mobile 不重叠验证（sidebar 自有 mobile top bar 并存）

| 组件 | Class | Breakpoint |
|---|---|---|
| TopBar | `hidden lg:flex ... z-30` | 仅 `>=lg` 显示 |
| Sidebar mobile bar | `fixed top-0 ... z-40 ... lg:hidden`（`components/sidebar.tsx:205`） | 仅 `<lg` 显示 |

→ 两断点互斥，`<lg` 只有 sidebar mobile bar（z-40 + Menu + Wordmark），`>=lg` 只有 TopBar（z-30），**不可能同时出现、不会重叠**。

### 表 E · signOut 逻辑

| 来源 | 代码 |
|---|---|
| TopBar `components/layout/topbar.tsx:54-56` | `signOut({ callbackUrl: "/login" })` |
| Sidebar（既有） | 同样 `callbackUrl: "/login"` |

→ 行为与 sidebar user card 完全一致；两个入口，一致行为。

## Issues found

None.

### 次要观察（不作为 FAIL 依据）

- `app/teacher/layout.tsx` 与 `app/(student)/layout.tsx` 内容几乎完全相同（只是路径不同）。builder 保留两份是因为 Next.js 两 layout 必须分别存在；未来可提取共享子组件减少重复，但本 PR 范围合理。
- Mobile（`<lg`）下 TopBar 整个隐藏 — spec 允许（"可能需要隐藏面包屑只留右侧三按钮"）。通知/AI 助手在 mobile 下无入口；若将来要求 mobile 也有，builder 已在 report 里声明这是 conscious trade-off，后续 PR 可补。
- "AI 助手" 和通知按钮目前都是视觉占位，无 handler — spec 明确要求（Round 5 / 未来 backend 再接）。

## Overall: **PASS**

**给 builder-p2 的信**：PR-2A 全项 PASS，可以 ship。coordinator 可直接 commit 并进 PR-2B。
