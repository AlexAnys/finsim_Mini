# Build Report — PR-2 AppShell + Sidebar + Wordmark 换装 · round 1

## 改动文件

| 文件 | 操作 | 一句话 why |
|---|---|---|
| `components/ui/wordmark.tsx` | 新建 | 手绘 SVG 折线图标（上升线 + 暖赭端点） + "Fin**Sim**" 文字组合 — 参考 `mockups/design/primitives.jsx:48-74`。props `size` / `mono` / `showText`，默认 28px。|
| `components/sidebar.tsx` | 重写视觉 | 宽度 `w-60` → `w-[232px]`（匹配设计稿精确值）；bg 从 `bg-background` 换为 `bg-paper-alt` (象牙+轻染色)；激活态从 `bg-primary/10` 换为 `bg-brand-soft text-brand`（精确匹配设计稿 `#E7EAF3`，qa-r1 在 PR-0 备注里建议的切换）+ 左侧 3px 深靛条 `bg-brand`；加顶部搜索框 `搜索...` + `⌘K` kbd hint badge（占位，暂不接 cmdk）；nav 节前加 uppercase section label "学习空间" / "教师工作台"；底部用户卡 Avatar bg 从 `bg-primary/10` 改 `bg-brand text-brand-fg` 实心深靛、姓名/角色 + 登出按钮保留 hover destructive；所有 `GraduationCap` 引用（桌面 + 移动 header）都换成 `<Wordmark />` |
| `app/(student)/layout.tsx` | 调宽度 | `lg:pl-60` → `lg:pl-[232px]` 配合新 sidebar 宽 |
| `app/teacher/layout.tsx` | 调宽度 | 同上 |

## 关键决策

- **`GraduationCap` 替换范围**：全仓 grep 到 4 处引用：
  - `components/sidebar.tsx:13, 92, 186` — **本 PR 全部替换**（品牌 logo）
  - `components/dashboard/task-card.tsx:255` — 教师 hover 菜单 "成绩" 项的 **semantic icon**（学术 / 成绩意象），不是品牌 logo，**保留**
  - `components/simulation/simulation-runner.tsx:475` — Simulation 对话里的 **角色头像**，也不是品牌 logo，**保留**
  - spec 明确说 "替换 `GraduationCap` 为手绘 Wordmark"，语境 unambiguous 是品牌 logo；其他两处 contextual icon 若 QA 判定要改，属 Round 7 Runner 壳 / Round 4 教师端范畴。
- **侧边栏宽度 232px**：设计稿给定的精确像素值。用 Tailwind arbitrary value `w-[232px]` + `lg:pl-[232px]` 对齐。没有升级到 `w-60`（240px）或 `w-56`（224px）。
- **sidebar bg = paper-alt**：设计稿是 `#FDFBF5`（ivory 第二层），对比主区 `#F7F4EC` 有微差但很微妙。用 `bg-paper-alt` token。
- **激活态用 `bg-brand-soft`**：qa-r1 在 PR-0 报告里明确建议"如 PR-2 想精确匹配设计稿 `#E7EAF3` 可切换到 `bg-sidebar-accent` 或 `bg-brand-soft`" — 我选 `bg-brand-soft` 因为它在 `@theme inline` 里直接映射到 `var(--fs-primary-soft) = #E7EAF3`，语义最清晰。
- **3px 活跃条**：`-left-3` + `w-[3px]` 绝对定位到 nav item 左外侧，与设计稿 `left: -12` 一致。
- **搜索框**：占位 UI（`<div>` + `<span>搜索...</span>` + `<kbd>⌘K</kbd>`），**不接 cmdk 功能**（spec 明确 "先不做 cmdk 搜索功能"）。未来 Round 加 cmd palette 时在此挂 onClick。
- **用户 Avatar 改实心深靛**：设计稿 `background: T.primary, color: '#fff'`；现有 `bg-primary/10 text-primary` 淡底在深靛主色 vs 设计稿实心深靛有视觉分量差异。
- **移动 header**：保留 Menu + Sheet pattern（auth 流程/权限判断原封），logo 换成 size-24 的 Wordmark。`w-60` → `w-[232px]` 在 SheetContent 也一致。
- **Session / auth / routing / 权限 未动**：`useSession` / `signOut` / `pathname` 逻辑 100% 保留，`studentNav` / `teacherNav` 数组一字未改。符合 spec "不改任何 auth 逻辑 / session / 权限判断 / 路由 / 导航项"。
- **未加面包屑 / 顶部栏 "AI 助手"**：spec "若存在 `app/(student)/layout.tsx` / `app/teacher/layout.tsx` 顶部栏" — 当前两个 layout 只有 sidebar + main，无顶部栏。新建顶部栏会引入新 component 和布局变更，超出 "只视觉换装" 的 PR-2 scope 边界；留给 Round 2+ 处理。仅改了 `pl-` 值。

## 验证

| 命令 | 退出 | 结果 |
|---|---|---|
| `npx tsc --noEmit` | 0 | 无输出 |
| `npm run build` | 0 | 所有路由构建成功 |
| `npx vitest run` | 0 | 11 files / 61 tests 全过 |
| `grep GraduationCap components/sidebar.tsx` | - | 无匹配 |

## 约束检查

| 约束 | 状态 |
|---|---|
| 不变更 schema | ✅ |
| 不新增页面 | ✅ |
| 不移除 API | ✅ |
| 不改状态机 | ✅ |
| 中文 UI | ✅ "搜索..." / "学习空间" / "教师工作台" / "用户" / "登出" 全中文；导航项 labels 零改动 |
| 任务类型 3 色 | N/A（本 PR 不涉及任务卡）|
| AI 就地 | ✅ 未加 "AI 中心"（spec 说的顶部 "AI 助手" 按钮留给 Round 2+，因为需要顶部栏 shell）|
| 克制 | ✅ sidebar 每项 ≤1 视觉状态（active soft + 3px 条）|
| 不改 auth / session / 权限 / 路由 / 导航项 | ✅ |

## 遗留问题 / 注意

1. **顶部栏 / 面包屑 / "AI 助手" 按钮未加**：如上所述，当前 `(student)/layout.tsx` 和 `teacher/layout.tsx` 无顶部栏 shell，只有 `<Sidebar /> + <main>`。新增顶部栏涉及：
   - 新建 `<Topbar />` 组件或直接 inline
   - 调整 main 的 `pt-`
   - 接入路径 → 面包屑的 mapping（pathname 解析）
   - "AI 助手" 按钮的 onClick 行为（Round 2+ 才设计）
   若 QA 判定 spec 要求必须做，可回一轮补。
2. **浏览器硬刷**：Dev server 里要 `Cmd+Shift+R` 看新 sidebar。
3. **移动端折叠**：保留 Sheet pattern，`w-[232px]` 一致。Width 不变色调换但 `(hide on < lg)` 仍生效。
4. **`--color-brand-fg` 生效**：Tailwind 4 的 `text-brand-fg` class 在 PR-0 的 `@theme inline` 里映射到 `var(--fs-primary-fg) = #FFFFFF`，avatar 实心深靛底 + 白字对比 AAA 通过。
5. **`text-ink-2` / `text-ink-3` / `text-ink-4` / `text-ink-5`**：PR-0 已 emit（ink 梯度），本 PR 新引用这些 class 供 tree-shake 自动收录。

## 请求 QA 验证

- `/dashboard`（学生）sidebar：
  - 宽 232px（精确，不再 240px）
  - 背景变第二层象牙 `#FDFBF5`
  - Wordmark 替换 `GraduationCap`：深靛方块 + 白色上升折线 + 暖赭端点，右边 "Fin**Sim**" 文字（Sim 深靛色）
  - 搜索框 + `⌘K` kbd hint 可见（先不接功能）
  - Section label "学习空间" 大写小字
  - 激活项 bg 变 `#E7EAF3` 深靛 soft + 左侧 3px 深靛条 + 文字/图标深靛色
  - 底部用户卡 Avatar 变实心深靛白字
- `/teacher/dashboard` 同上，Section label "教师工作台"
- `/courses`、`/grades`、`/schedule`、`/teacher/courses`、`/teacher/groups`、`/teacher/ai-assistant` 等页面 sidebar 正常（同一 component）
- 移动端（375px）点击 Menu，Sheet 打开，logo 是 Wordmark 小号、侧边栏内容一致
- `/sim/[id]` / `/tasks/[id]` / 登录页不受影响（不走 student/teacher layout）
- 切换角色登录（teacher / student）sidebar 项正确渲染不同 nav
- 登出按钮仍能点（验证 auth 逻辑未破）
- 暗色模式下 sidebar 可读（`bg-paper-alt` 在 dark 是 `#151823`，激活 `bg-brand-soft` 是 `#262B46`）
