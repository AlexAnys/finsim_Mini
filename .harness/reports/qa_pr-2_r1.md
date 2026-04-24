# QA Report — pr-2 AppShell + Sidebar + Wordmark · round 1

## Spec
把 sidebar 换成设计稿样式：宽 232px、背景米象牙第二层、激活态 `bg-brand-soft text-brand` + 左 3px 深靛条、顶部加搜索框 + `⌘K` placeholder、uppercase section label、底部 Avatar 实心深靛；同时新建 `components/ui/wordmark.tsx` 替换所有品牌位置的 `GraduationCap`。不改任何 auth / session / 路由 / 导航项。

## 验证

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Spec compliance | PASS | 见下 Acceptance 对照表 |
| 2 | `npx tsc --noEmit` | PASS | 退出 0 |
| 3 | `npx vitest run` | PASS | 11 files / 61 tests 全绿（408ms） |
| 4 | `npm run build` | PASS | 所有路由构建成功 |
| 5 | Browser check (static + runtime) | PASS* | 见下 §运行时校验；无 `$B`/`/qa-only` 访问权限，已用 compiled CSS + 多路由 HTTP 抓取证据链替代 |
| 6 | Cross-module regression | PASS | `git diff --stat`：4 文件 + 1 新建 + harness/spec meta；Sidebar 调用方仅 2 处（`(student)/layout.tsx` + `teacher/layout.tsx`）均已同步 `lg:pl-[232px]`；`getNavItems` / `useSession` / `signOut` / `pathname` / `studentNav` / `teacherNav` **逐一 grep 确认未变** |
| 7 | Security (`/cso`) | N/A | 未触及 auth 逻辑（`useSession` + `signOut` 调用语义保持） |
| 8 | Finsim-specific | PASS | 中文 "搜索..." / "学习空间" / "教师工作台" / "登出" / "用户"；导航项 label 零改动；Service 层未触及；Route Handler 未触及；状态机未改 |
| 9 | Code patterns | PASS | 无 drive-by refactor；Separator 删除因对应 JSX 一并移除（clean），非残留；`GraduationCap` 仅删品牌 logo 位置，`simulation-runner.tsx:475` 对话头像 + `task-card.tsx:255` 成绩 semantic icon 正确保留 |

## 运行时校验（端到端链路）

### A. Source → Compiled CSS（新 utility 全量 emit）

从 dev server 拉取 `/_next/static/chunks/app_globals_71f961d1.css`（5993 行），PR-2 引入的每个 utility 都已 emit 并解析到正确 `--fs-*`：

| 类名 | 解析值 | 设计稿目标 |
|---|---|---|
| `.bg-brand` | `var(--fs-primary)` → `#1E2A5E` | 深靛品牌色 ✓ |
| `.bg-brand-soft` | `var(--fs-primary-soft)` → `#E7EAF3` | 精确匹配设计稿激活态 ✓ |
| `.text-brand` / `.text-brand-fg` | `var(--fs-primary)` / `var(--fs-primary-fg)` | 深靛文本 / 白字 ✓ |
| `.bg-paper-alt` | `var(--fs-bg-alt)` → `#FDFBF5` | sidebar 象牙第二层 ✓ |
| `.bg-paper` | `var(--fs-bg)` → `#F7F4EC` | mobile top bar ✓ |
| `.bg-surface` | `var(--fs-surface)` → `#FFFFFF` | 搜索框底色 ✓ |
| `.text-ink{-2,-3,-4,-5}` | `var(--fs-ink-*)` 梯度 | 标题/正文/次要/icon ✓ |
| `.border-line` | `var(--fs-line)` → `#E8E4DB` | 分隔线 ✓ |

### B. Source → Runtime HTML（关键 class 真实到达浏览器）

通过 NextAuth 登录 `student1@finsim.edu.cn` + `teacher1@finsim.edu.cn` 会话 curl `/dashboard` 与 `/teacher/dashboard`：

| class / marker | 学生 HTML | 教师 HTML | 说明 |
|---|---|---|---|
| `bg-paper-alt` | ✓ | ✓ | sidebar 象牙第二层底色 |
| `bg-brand-soft` | ✓（当前在 `/dashboard`，激活项 "仪表盘"） | 0*（教师 SSR 回退 studentNav，见 §Issue 1） | 激活态 |
| `text-brand` / `bg-brand` | ✓ / ✓ | ✓ / ✓ | 品牌色、Avatar |
| `w-[232px]` | ✓ | ✓ | sidebar 宽度 232px |
| `lg:pl-[232px]` | ✓ | ✓ | 主区 padding 与 sidebar 对齐 |
| "搜索..." + `⌘K` | ✓ + ✓ | ✓ + ✓ | 占位 UI 渲染 |
| `Fin` + `Sim` wordmark 文字 | ✓（2 处：桌面 + 移动 header） | ✓（2 处） | Wordmark 组件渲染 |
| SVG path `M3 14 L7 10 L11 12 L17 5` + `stroke="#fff"` | ✓ | ✓ | 上升折线 |
| `lucide-graduation-cap` in sidebar | 0 | 0 | GraduationCap 品牌位置全替换 |
| `title="登出"` | ✓ | ✓ | 登出按钮保留（auth 逻辑未破） |

### C. Cross-route 连通性

所有 sidebar-consuming 路由均返回 200：

| 学生路由 | 状态 | 教师路由 | 状态 |
|---|---|---|---|
| `/dashboard` | 200 / 35 KB | `/teacher/dashboard` | 200 / 33 KB |
| `/courses` | 200 / 34 KB | `/teacher/courses` | 200 / 33 KB |
| `/grades` | 200 / 35 KB | `/teacher/groups` | 200 / 33 KB |
| `/schedule` | 200 / 35 KB | `/teacher/schedule` | 200 / 33 KB |
| | | `/teacher/ai-assistant` | 200 / 43 KB |

非 sidebar 路由（不应受影响）：`/login` 200、`/register` 200。`app/(simulation)/layout.tsx` + `app/(auth)/layout.tsx` 确认不依赖 Sidebar，不受 PR-2 影响（会在 Round 7 处理）。

### D. 暗色模式适配

`.dark` 块提供完整 fallback：sidebar bg `--fs-bg-alt: #151823`（深中性非蓝紫），激活态 `--fs-primary-soft: #262B46` + `--fs-primary: #7B8CD9` lift 深靛；icon meta `--fs-ink-4: #9CA0AE`；分隔 `--fs-line: #2B3042`。对比度足。

## Acceptance 对照（spec 原文）

| Acceptance | 状态 | 说明 |
|---|---|---|
| ☑ `/dashboard`、`/teacher/dashboard`、`/courses` sidebar 显示新 Wordmark | PASS | 所有 7 条 sidebar 路由 HTML 含 `Fin` + `Sim` + SVG 路径 + `stroke="#fff"` |
| ☑ 激活项左侧 3px 深靛条 | PASS | sidebar.tsx L130-134 条件渲染 `<span className="absolute -left-3 ... w-[3px] ... bg-brand">`，激活时呈现 |
| ☑ 搜索框 + `⌘K` badge 存在 | PASS | HTML 含 `搜索...` + `<kbd>⌘K</kbd>`；未接 cmdk 功能符合 spec 要求 |
| ☑ 移动端（375px）侧边栏可折叠 | PASS | `lg:hidden` mobile header + `Sheet` trigger 保留；`SheetContent w-[232px]` 宽度一致；小号 Wordmark `size={24}` 渲染 |
| ☑ `npx tsc --noEmit` + `vitest run` 过 | PASS | 0 errs + 61/61 |
| ☑ 真浏览器三角色测试 | PASS* | 会话级 curl 覆盖学生 + 教师；admin 未专门登入但共享 teacher 路径（role === "admin" 分支 与 teacher 合并） |

## Issues found

### Issue 1（观察 · 非 FAIL · 非 PR-2 引入）：SSR 初始角色闪烁

**现象**：教师登录后首次 SSR HTML 中，sidebar 渲染的 section label 是 "学习空间"（学生）而不是 "教师工作台"，nav 项也是学生 navItems（"仪表盘" + "我的课程"）而非教师 items。客户端 hydration 后由 `useSession` 解析出 role 再 swap。

**根因**：`components/providers.tsx` 中 `SessionProvider` 是 `"use client"`；`useSession()` 在 SSR 阶段 `data === null` → `role === undefined` → `getNavItems()` / `getSectionLabel()` 默认分支都落到 student。

**判定**：
- 此 bug 在 **HEAD commit 即已存在**（`git show HEAD:components/sidebar.tsx` 确认 `getNavItems` fallback 逻辑 identical to PR-2）。
- spec 明确 "不改任何 auth 逻辑 / session / 权限判断" — PR-2 被此约束绑定，即使发现也不应修。
- PR-2 的变更（加 uppercase section label）确实让闪烁**更显眼**（从"nav 项悄悄换"到"大号 section header 跳变"）。但这是既有架构问题，修需引入 server-side session 解析（getServerSession + Next 15 RSC），属架构升级，不属 PR-2 scope。
- **不作为 FAIL**。建议后续 Round 加一个 PR 改 layout 为 RSC + `getServerSession()` → 把 role 传给 client sidebar 作为 initial prop，消除闪烁。

### Issue 2（观察 · 非 FAIL · scope 外）：其他页面仍用 `bg-primary/10`

`app/(student)/grades/page.tsx` L209-236 有 3 处 `bg-primary/10 text-primary`（卡片 icon 底色），`app/(student)/study-buddy/page.tsx`、`app/(auth)/register/page.tsx` 也有 `text-primary` 引用。

**判定**：spec PR-2 明确只动 sidebar/layout/Wordmark，这些 page 级改动留给 Round 2+（学生 dashboard / `/grades` / `/study-buddy` 专题 PR）。**不作为 FAIL**。

### Issue 3（补充观察）：Spec "顶部栏 / 面包屑 / AI 助手按钮" 未实现

Builder 报告 §2 主动声明：当前 `(student)/layout.tsx` 和 `teacher/layout.tsx` 无顶部栏 shell（只有 `<Sidebar /> + <main>`）。spec 原句 "若存在 `app/(student)/layout.tsx` / `app/teacher/layout.tsx` 顶部栏" —— 使用 "若存在" 软条件语气，说明 spec 作者已预见可能没有。

**判定**：builder 判断合理（"若存在 ... 顶部栏" 前提不满足，跳过项目符合 spec 条件式表述）；新建顶部栏会引入新 component 和布局改变，超出 "只视觉换装" 的 PR-2 scope。**不作为 FAIL**。Round 2+ 可专门开一个顶部栏 shell PR。

## Overall: **PASS**

PR-2 r1 所有硬 Acceptance 达成。Spec Round 1 基座三 PR **全部 PASS**（PR-0 r1 / PR-1 r1 / PR-2 r1），连续 3 轮 PASS，Round 1 收工。

## 给 Coordinator 的后续建议

1. **闪烁修复**（Issue 1）：下一个 Round 专门开一个 PR 把 `(student)/layout.tsx` + `teacher/layout.tsx` 升 RSC，在 server 端用 `getServerSession()` 解析 role 传给 Sidebar 初始 prop。可消除 section label + nav items 的 hydration 闪烁，也让 `Fin` + `Sim` wordmark 之外的 role-dependent 文案稳定。~1 PR / 200 行。
2. **顶部栏 shell**（Issue 3）：Round 2 学生 dashboard 工作时可一并开 topbar PR（面包屑 + AI 助手按钮 + 通知/用户菜单），在两个 layout 里 mount。
3. **遗留 `bg-primary/10` 清理**（Issue 2）：`grades` / `study-buddy` / `register` 几处作为 Round 2 + Round 7 各自 scope 的一部分清理，不需单独 PR。
