# Spec — FinSim v2 设计系统重构（Round 1 / 基座三 PR，2026-04-23）

## 背景

设计师在 claude.ai/design 做了完整的高保真重设计稿，用户已批准方向：

- **三色骨架**：深靛 `#1E2A5E`（主）· 米象牙 `#F7F4EC`（背景）· 暖赭 `#C48A3C`（AI/成就）
- **任务类型 3 色**（非 8 色）：sim `#5B4FB8` / quiz `#2E5FB4` / subj `#0F7A5A`
- **课程标签 6 色**（非 8 色）：tagA-F 降饱和
- **字体**：中文 PingFang SC；数值全部走 SF Mono + `tabular-nums`
- **保留深色模式**（用户选择 A）

设计包已复制到 `.harness/mockups/`。核心文件：
- `mockups/design/tokens.css` — 完整 CSS 变量（canonical 源）
- `mockups/design/tokens.jsx` — JS 对照（给 inline chart 用）
- `mockups/design/primitives.jsx` — Wordmark / Btn / Badge / Card / TypeChip 参考实现
- `mockups/design/student-dashboard.jsx` · `teacher-dashboard.jsx` · `course-detail.jsx` · 4 张学生端页面

浏览器访问：`http://localhost:8765/FinSim%20%E8%AE%BE%E8%AE%A1%E6%8F%90%E6%A1%88.html`（后台 python server 已起）

## 全局硬约束（设计师 Review F 节 — 所有 PR 都要守）

1. **不变更 schema**
2. **不新增页面**（只重设计现有 17 页）
3. **不移除任何 API 触发点**
4. **不改核心状态机**（Task→Instance→Submission→Grade）
5. **中文 UI**
6. **任务类型 3 色 + 状态 1 色**（sim/quiz/subj + 状态独立于类型）
7. **AI 动作就地触发**（不做 "AI 中心"）
8. **克制** — 每卡 ≤2 徽章 / 每页 ≤4 语义色

## Round 1 — 基座三 PR（本会话目标）

### PR-0 · Design Tokens 落地（~250 行）

**目标**：把新设计 tokens 写入 `app/globals.css`，并建立 Tailwind 映射，后续所有 PR 的基础。

**改动**：
- `app/globals.css` — 替换 `:root` 和 `.dark` 的 oklch 蓝紫为深靛/象牙/暖赭
  - 浅色：严格按 `mockups/design/tokens.css` 中的 HSL/OKLCH 值
  - 深色：保留 `.dark` 块，但适配新品牌 — accent 保持暖赭；primary 改为深靛的 lift 版（`oklch(0.75 0.08 229)` 方向），ink 继续使用深色文本
  - 保留 `--radius` `--sidebar-*` `--chart-*` 等现有 shadcn token 名
  - 追加全新 FinSim 专有 token（前缀 `--fs-*`）：
    - `--fs-bg` / `--fs-bg-alt` / `--fs-surface` / `--fs-surface-tint` / `--fs-ink-*` / `--fs-line*`
    - `--fs-primary*` / `--fs-accent*` 系列
    - `--fs-success*` / `--fs-warn*` / `--fs-danger*` / `--fs-info*`
    - `--fs-sim*` / `--fs-quiz*` / `--fs-subj*`
    - `--fs-tag-{a..f}-bg` / `--fs-tag-{a..f}-fg`
    - `--fs-shadow` / `--fs-shadow-lg` / `--fs-shadow-pop`
  - 加 `.fs-num` utility（`font-variant-numeric: tabular-nums`）

- `lib/design/tokens.ts`（新文件）— 导出 JS 对象，给 inline SVG chart / inline style 使用
  - 结构镜像 `tokens.jsx` 的 T 对象（`primary`、`tagA.bg/fg`、`sim`、`success` 等）
  - 加 `courseColorForId(id: string): keyof typeof tagColors` helper — 基于 courseId hash 稳定返回 tagA-F 之一

- `tailwind.config.ts`（如存在；查一下当前是 `tailwind.config.js/ts` 还是新 Tailwind 4 @theme 写法）
  - 若是 Tailwind 4：已经用 `@theme inline` 在 globals.css 里配置 `--color-*`，追加 `--color-brand-*` / `--color-accent-*` / `--color-sim-*` 等映射即可
  - 若是传统 config：在 `theme.extend.colors` / `fontFamily` / `boxShadow` 加映射（参见 `tokens.css` 底部注释）

**不做**：
- 不替换任何页面里现有的硬编码 Tailwind class（`bg-violet-100` 等）— 留给 PR-1/2 逐步清理
- 不改任何组件的 JSX 结构

**Acceptance**：
- [ ] `npm run dev` 启动后所有页面打开不报错
- [ ] 页面整体背景从纯白变为米象牙色（`#F7F4EC`）
- [ ] 侧边栏激活项从蓝紫变深靛（`#1E2A5E`）
- [ ] 暗色模式切换后页面仍可读（用户可切主题验证）
- [ ] `npx tsc --noEmit` 过
- [ ] `npm run build` 过
- [ ] `npx vitest run` 全过（预期不受影响）
- [ ] 硬编码 bg-violet/bg-emerald 等 class 仍存在、仍正常显示（不是 blocker）

### PR-1 · 三张核心卡去硬编码（~450 行）

**目标**：把 `bg-violet-100` / `bg-emerald-100` / `bg-blue-100` 等硬编码 Tailwind 颜色全部替换为 tokens。

**改动**（大致范围，builder 自行精确定位）：
- `components/dashboard/task-card.tsx` — 任务卡，按类型色（sim/quiz/subj）+ 状态色统一
- `components/dashboard/announcement-card.tsx` — 公告卡，改用 primary soft + 课程 tag 色
- `components/dashboard/timeline.tsx` — Timeline mixed items，按 §6 硬约束收敛色彩
- 可能关联：`components/course-card.tsx`（若存在）、其他直接 import TaskCard/AnnouncementCard 的页面验证 props

**不做**：
- 不重排卡片布局 / 不改 props / 不加功能 — 本 PR 只换色
- 不改 Timeline 的数据聚合逻辑

**Acceptance**：
- [ ] `grep -r "bg-violet\|bg-emerald\|bg-blue-\|bg-rose\|bg-amber-\|bg-cyan\|bg-indigo" components/dashboard/` 无匹配（或仅剩注释）
- [ ] 学生/教师 dashboard 在浏览器打开，TaskCard/AnnouncementCard 颜色从"每卡一色"变成"三色任务类型 + 单色状态"的克制方案
- [ ] `npx tsc --noEmit` 过；`npx vitest run` 全过
- [ ] QA 真浏览器验证：/dashboard、/teacher/dashboard 任务卡视觉一致、无色彩冲突

### PR-2 · AppShell + Sidebar + Wordmark 换装（~350 行）

**目标**：把侧边栏和顶部栏换成设计稿里的样子，替换 `GraduationCap` 为手绘 Wordmark（上升折线 + 暖赭端点）。

**改动**：
- `components/sidebar.tsx` — 按 `mockups/design/app-shell.jsx` 重写
  - 宽度从 `w-64` 调整为 232px（设计稿值）
  - 加顶部搜索框（placeholder "搜索..." + `⌘K` hint badge）
  - 导航小节用 `primarySoft` 激活态 + 左侧 3px 深靛条
  - 底部用户卡（姓名 + 角色 + `settings` 图标）
  - 新 Wordmark 组件替换 GraduationCap

- `components/ui/wordmark.tsx`（新建）— 手绘 SVG 折线图标 + "Fin**Sim**" 文字
- 若存在 `app/(student)/layout.tsx` / `app/teacher/layout.tsx` 顶部栏：加面包屑 "学生 / 仪表盘" 样式 + 右上角 "AI 助手" 按钮

**不做**：
- 不改任何 auth 逻辑 / session / 权限判断
- 不改路由
- 不改导航项（items 不变，只是视觉）

**Acceptance**：
- [ ] /dashboard、/teacher/dashboard、/courses 等页面侧边栏都显示新 Wordmark
- [ ] 激活项左侧有 3px 深靛条
- [ ] 搜索框 + `⌘K` badge 存在（先不做 cmdk 搜索功能，留 placeholder）
- [ ] 移动端（375px）侧边栏可折叠（保留现状）
- [ ] `npx tsc --noEmit` + `vitest run` + 真浏览器三角色测试

## Scope 外（Round 2+ 的工作量预告，用户参考）

| Round | 内容 | 预计会话数 |
|---|---|---|
| Round 2 | 学生 dashboard + `/courses` + `/courses/[id]` | 2 |
| Round 3 | 学生 `/grades` + `/study-buddy` + `/schedule` | 2 |
| Round 4 | 教师 dashboard + `/teacher/courses` + `/teacher/courses/[id]` | 3 |
| Round 5 | 教师任务向导 `/teacher/tasks/new`（1500 行向导） | 2 |
| Round 6 | 教师 `/teacher/instances/[id]` + insights + analytics | 2 |
| Round 7 | Runner 外壳 + 登录 + 空错态全局打磨 | 1 |
| Round 8 | Simulation 对话气泡单独重做（设计师 Q4） | 1 |

## Risks

- **Tailwind 版本差异**：当前项目用 `@import "tailwindcss"` 是 Tailwind 4 写法，`@theme inline` block 里的 `--color-*` 才是激活映射。builder 必须先查清楚，别在传统 `tailwind.config.ts` 白写。
- **Dark mode 适配**：设计师原稿没出深色 tokens。builder 需基于"深靛 = brand，ivory = paper"的设计 DNA，把深色模式的 primary 做成深靛的高亮版（lift），surface 保持深中性，accent 继续用暖赭。设计师原则：**色少但准**。
- **硬编码色的可见性**：PR-0 后，页面里的 `bg-violet-100` 仍会直接用 Tailwind 的紫色，与新主色深靛不协调。这是**预期中间状态**，PR-1 才清理。如果 QA 看到紫色以为是 regression，不是。
- **Wordmark 替换**：所有 `GraduationCap` 引用要找全（可能在 sidebar、登录页、空状态）。builder 用 grep 列出所有 caller 再改。
- **Anti-regression**：不要动 sidebar.tsx 里的 session hook / routing / 权限检查，只换视觉。
- **Prisma 三步**：本 Round 不改 schema，不涉及。

## 执行策略

- 三个 PR 在**同一个 builder** 上顺序做：PR-0 → PR-1 → PR-2
- 每个 PR 由 builder 改完后，直接给 QA（同一个 QA）验证
- Dynamic exit：两 round 连续 PASS 进下一个 PR；三 round 同一 FAIL 回 spec
- 全部三个 PR PASS 后，Coordinator 更新 HANDOFF 并总结

## 关联历史

- 本 session 早期完成课表日历化（commit `c1cdb0f` + `26f00c3`），未出新回归
- 上一 session 完成 ultrareview 8 finding 修复
- 设计评审（FinSim 功能Review.html）识别了 10 个冲突点，4 个需决策已由用户同意设计师预案（C1/C2 走最小改、W1-W3 不给主入口、Q3 Runner 壳换 tokens、Q4/Q5 后议）
