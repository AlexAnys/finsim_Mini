# Build Report — PR-1A · SSR 角色闪烁修复（r1）

**日期**：2026-04-23  
**Builder**：builder-p1  
**Spec**：`.harness/spec.md` § PR-1A

## 改动文件（3 个）

1. `app/(student)/layout.tsx` — RSC async，用 `getSession()` 解析 role+name 传给 Sidebar
2. `app/teacher/layout.tsx` — 同上
3. `components/sidebar.tsx` — Sidebar / SidebarContent 新增 `initialRole?: UserRole` + `initialName?: string | null` props；`useSession` hook 保留作为 hydration 后的权威来源，未命中时 fallback 到 initial props

## 实现细节

### 两个 layout（之前已是 RSC，无需抽 client wrapper）

之前版本是纯 server component，只渲染 `<Sidebar />` 和 `<main>`。我把它们改成 `async function`，调 `getSession()`（已有 helper in `lib/auth/guards.ts`，wrap NextAuth v5 `auth()`），把 `session.user.role` 和 `session.user.name` 作为初始值下传。

NextAuth v5 pattern（这个项目的实际版本，`next-auth@5.0.0-beta.30`）使用 `auth()` helper，不是 NextAuth v4 的 `getServerSession(authOptions)`。spec 提到后者是示意，实际走 `getSession()` 包装。

### Sidebar / SidebarContent props

```ts
interface SidebarProps {
  initialRole?: UserRole;
  initialName?: string | null;
}
```

SidebarContent 里的逻辑：
```ts
const role = (user?.role as UserRole | undefined) ?? initialRole;
const displayName = user?.name ?? initialName ?? undefined;
```

- SSR 阶段：`useSession().data === null`，`user?.role === undefined`，fallback 到 `initialRole`（server 注入）
- Hydration 后：`useSession` 的数据就位，走 client session。登出场景时 session 变 null，`initialRole` 仍在，但 `signOut` 会 redirect 到 `/login`，layout 不再渲染 sidebar，所以"登出后残留"不是问题
- 未登录场景（layout 被 `/login` bypass，正常用户不会看到）：`initialRole` undefined → `getNavItems(undefined)` 返 student nav（原 fallback 行为，未变）

### 不动的东西

- `providers.tsx` 里 `SessionProvider` 保留，client-side hooks 正常运作
- `getNavItems` / `getSectionLabel` / `getRoleLabel` / studentNav / teacherNav 数组内容零改动
- 登录/登出/session 存储逻辑零改动
- 任何 API endpoint 零改动

## 验证

### `npx tsc --noEmit`
通过，无输出。

### `npx vitest run`
```
Test Files  11 passed (11)
     Tests  61 passed (61)
```

### `npm run build`
通过。所有使用 sidebar 的路由（`/dashboard`、`/teacher/*`、`/courses` 等）标记为 `ƒ (Dynamic)` — 这是预期：`getSession()` 依赖 cookies，layout 必须在 request time 渲染。这些路由本就已经是 dynamic（要读 auth）所以无性能 regression。

### Acceptance 对齐

- [x] `/teacher/dashboard` SSR 将直接渲染 "教师工作台" section label（初始 role=teacher）
- [x] `/dashboard` SSR 将直接渲染 "学习空间" section label（初始 role=student）
- [x] tsc + vitest + build 全过
- [x] 登出流程不破坏（SessionProvider 未动，signOut 仍走 `callbackUrl: "/login"`）

真浏览器验证（`curl` 抓 HTML grep）由 QA 执行，需要 dev server 在运行，不在 builder 范围。

## 不确定 / 待确认

- **未登录访问 student 页**：之前 middleware 应该已 redirect 到 `/login`。如果某种路径下未登录用户能进到 layout，会看到 student nav（fallback 行为，与旧版一致）。未改变风险表面。
- **admin 登录**：`getSectionLabel` / `getNavItems` 对 admin 返回 teacher 版本（现有逻辑）。新的 initialRole 透传不改变这个映射。

## Dev server 重启

本 Phase 不改 schema，Prisma 三步不触发。但 layout 变为 async RSC 属 React tree 结构变化，dev server hot-reload 通常能吃下，如果 QA 观察到路径不加载，踢一下 dev server 即可（`.harness` 外操作，coordinator 负责）。

## 文件 diff 规模

- `app/(student)/layout.tsx`: 17 → 22 行（+5）
- `app/teacher/layout.tsx`: 17 → 22 行（+5）
- `components/sidebar.tsx`: 212 → 232 行（+20）

合计 ~30 行净增，远低于 spec "~200 行" 的预算上限（spec 的 200 是担心要抽 client wrapper，但两 layout 之前已是纯 RSC 无需抽分）。
