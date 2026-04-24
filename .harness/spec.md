# Spec — Phase 2 · 学生端全体重做（Round 2 起，2026-04-24）

## 背景

Phase 0（Round 1 基座）+ Phase 1（技术债清理）已全部 commit 落地（7 commit，30+ 文件）。进入视觉重构主战场。

Phase 2 目标：学生端 5 个页面按设计稿落地，建立 TopBar 共享 shell。参考设计源：
- `.harness/mockups/design/student-dashboard.jsx`
- `.harness/mockups/design/student-courses.jsx`
- `.harness/mockups/design/course-detail.jsx`
- `.harness/mockups/design/student-grades.jsx`
- `.harness/mockups/design/student-buddy.jsx`
- `.harness/mockups/design/student-schedule.jsx`

设计稿浏览器访问：`http://localhost:8765/FinSim%20%E8%AE%BE%E8%AE%A1%E6%8F%90%E6%A1%88.html`

## Round 2 拆分（4 PR 串行）

本会话目标：完成 PR-2A + PR-2B（可能 PR-2C）。PR-2D 跨会话续做。

### PR-2A · TopBar 共享 shell（~250 行）

**目标**：建立顶部栏组件，挂到两个 layout（学生 + 教师），之后所有页面共享。

**改动**：
- 新建 `components/layout/topbar.tsx`：
  - 左侧面包屑（`学生 / 仪表盘` 格式，从 pathname 派生）
  - 右侧三个动作：通知 icon（placeholder）、"AI 助手" 按钮（subtle variant + sparkles icon，点击先 no-op 占位）、用户头像菜单（现有的登出逻辑复用）
  - 高 56px，底边 `1px border-fs-line`，bg `var(--fs-bg)`
- `app/(student)/layout.tsx` + `app/teacher/layout.tsx`：把 main 外包一层 flex-col，顶部挂 `<Topbar />`

**不做**：
- `⌘K` 搜索/cmd palette（Round 7 统一）
- 通知实际功能（只 icon 占位 + 未读数徽标假设数据）
- "AI 助手" 打开 sheet（Round 5 任务向导时再做）

**Acceptance**：
- 学生 + 教师任一页面打开，顶部栏 56px 高，包含面包屑/通知/AI 助手/用户头像
- 面包屑根据当前路由动态变化
- 登出按钮仍能走 `signOut()`
- tsc + vitest + build 全过
- 移动端（375px）顶部栏不破坏（可能需要隐藏面包屑只留右侧三按钮）

### PR-2B · 学生 `/dashboard` 重设计（~500 行）

**目标**：按 `student-dashboard.jsx` 完整结构重做。

**结构**（从上到下）：
1. **问候 Hero** — "下午好，{name}" + 今日日期/教学周/本周状态一句话（如 "你今天有 2 节课、3 项待办"）+ 右侧两个 action（"我的课表" 次要 + "继续学习" 主要）
2. **4 KPI 卡** — 本周待办 / 连续完成 / 平均得分 / 掌握度（每卡：label + 大号数字 fs-num + 小 sub + icon badge）
3. **左栏**：
   - 今日课程（卡片内嵌时间条 + 地点/老师 + "进行中" 徽标）
   - 优先待办（第一项用琥珀左边框强调 "今晚截止"，其他普通列表）
   - 最近成绩（表格式：类型 chip / 标题 / 日期 / 进度条 + 分数）
4. **右栏 320px**：
   - 我的课程列表（封面色块 + 名 + 进度条）
   - 公告（未读红点 + 标题 + 课程 tag + 时间）
   - AI 学习伙伴深色卡（深靛渐变 bg + 暖赭 sparkles + 推荐文案 + "开始复习" 按钮）

**数据源映射（硬约束：不改 schema / 不加字段）**：

| 设计稿字段 | 后端现状 | 本 PR 落地策略 |
|---|---|---|
| name (问候) | `session.user.name` | ✓ |
| 今日日期 + 教学周 | `semesterStartDate` + 当前日期计算 | ✓（复用 `getCurrentWeekNumber`） |
| 本周待办数 | `dashboard/summary` 有 tasks 数组 → 按 status 过滤 | ✓ |
| 连续完成天数 streak | ❌ 无字段 | **降级**：隐藏或显示"本周完成 X 项" |
| 平均得分 | 从 submissions 聚合 | ✓ |
| 掌握度 % | ❌ 无 | **降级**：隐藏，或用"已完成课时/总课时"比例顶替 |
| 今日课程 | scheduleSlots + 当前日过滤 | ✓ |
| 优先待办 | tasks 数组按 dueAt 排序 | ✓ |
| 最近成绩 | submissions 最近 3 条 | ✓ |
| 课程列表 + 进度 | courses + 章节完成数 | 章节进度无字段 → **降级**：只显示课名 + 任务完成率 |
| 公告未读状态 | ❌ 无 "已读" 字段 | **降级**：最近 3 天内的标红点 |
| AI 学习伙伴推荐 | ❌ 无主动推荐 | **降级**：卡片改为 "最近对话 / 立即提问" 入口，跳 `/study-buddy`（设计师 C1 已决策） |

**改动**：
- `app/(student)/dashboard/page.tsx` 全量重写 JSX 结构（保留所有现有数据 fetch hooks / 状态 — 只换 view）
- 可能新建几个小组件：`components/dashboard/greeting-hero.tsx` / `kpi-stat-card.tsx` / `today-classes.tsx` / `priority-tasks.tsx` / `recent-grades.tsx` / `course-progress-sidebar.tsx` / `ai-buddy-callout.tsx`
- 保留/复用 Round 1 改过的 `task-card.tsx` / `announcement-card.tsx` / `timeline.tsx`（如设计稿允许） — 如果设计稿要求完全不同的样式，则旧卡片在新 dashboard 里不再使用，但组件本身保留给其他页面用

**不做**：
- 不改 `/api/lms/dashboard/summary` 的任何字段
- 不加 streak / mastery / recommendation 后端字段（留给 Round 2+ 决策）
- 不动权限/auth

**Acceptance**：
- `/dashboard` 真登录 student1 打开，视觉对齐设计稿（问候 / 4 KPI / 三列 / 深色 AI 卡）
- 降级字段以 gracefull fallback 呈现（不是空白、不是报错）
- 移动端（375px）布局合理（可能单栏堆叠）
- tsc + vitest + build 全过
- 无 hard-coded Tailwind 色（所有色走 tokens）

### PR-2C · 学生 `/courses` 列表（~400 行）

按 `student-courses.jsx`。本会话若时间够则做，否则 HANDOFF 续下次。

**结构**：顶部 summary strip（4 指标） + 2 列 CourseCard 网格 · 每卡：courseCode 徽章 + 班级 + 课名 + description + 教师头像堆叠 + 进度行 + 下次课 + mini stats + "进入" 按钮。

**数据降级**：`stats.avgScore` 可从 submissions 算；`nextLesson` 从 scheduleSlots 派生；`chapters/completedChapters` 如无字段 → 只显示"任务完成率"。

### PR-2D · 学生 `/courses/[id]` 详情（~550 行）

按 `course-detail.jsx`。本会话极大概率做不完，HANDOFF 续。

**结构**：深色 Hero（进度+课程信息+tab 条） + 左栏章节导航（已完成/当前/未开始三态） + 主栏 5.x 小节（课前/课中/课后三态时间线） + 右栏（教师卡 + 本章掌握度 + AI 建议）。

**ContentBlockType 6 种对应**（`lecture / simulation / quiz / subjective / resource / link`）都要有对应视觉占位（设计师 Review §D）。

## Risks

- **TopBar 与 layout 的 hydration**：Phase 1 已把 layout 升 RSC，TopBar 作为 RSC 孩子可以直接用 `getSession()`，但面包屑需要 `usePathname` 这是 client hook — 所以 TopBar 整体是 client component。auth 不走 TopBar 内部，由 layout server 端传 initial。
- **设计稿尺寸 vs 真实屏幕**：设计稿是 `1400×980`，真实浏览器经常 `1280×800` 或更小。主栏/侧栏宽度需要响应式降级（`lg:grid-cols-[1fr_320px]` → `grid-cols-1`）。
- **降级字段视觉**：KPI "连续完成/掌握度" 如果隐藏，会剩 2 KPI 卡 — 视觉会空。建议把他们改成有数据的指标（如 "本周已完成 X / Y 任务" / "已批改 X 份"）避免视觉塌陷。
- **task-card.tsx 复用性**：Round 1 改的 task-card 当前在 Timeline 里用，dashboard 重设计后可能有更紧凑的需求 — 允许 builder 在必要时加 `variant` prop（如 `"compact" | "hero"`）而不是 fork 新组件。
- **Prisma 三步**：本 Phase 不改 schema，不涉及。
- **不改 API**：所有改动在 page 和 component 层，`/api/lms/*` 零改动。

## 执行策略

- 单 team（继续 `finsim-redesign-r1`，new agents `builder-p2` + `qa-p2`）
- Tasks：PR-2A → PR-2B（blockedBy 链）→ PR-2C（如时间） → PR-2D
- 每 PR PASS 后 coordinator 自动 commit 独立 commit
- Phase 2 结束或本 session 能做到的 PR 边界处 coordinator 更新 HANDOFF
- 按用户指示 "迭代到最后" — 本 session 不停，直到 agent 报完成或 coordinator 判断该收尾

## Phase 3-5 路线（下次 session 续）

- Phase 2 剩余 PR（如有）+ Round 3 学生 `/grades` + `/study-buddy` + `/schedule`
- Phase 3 · 教师端 dashboard + courses + courses/[id] + 任务向导 + instances
- Phase 4 · Runner 外壳 + 登录 + 空错态
- Phase 5 · Simulation 对话气泡专题
