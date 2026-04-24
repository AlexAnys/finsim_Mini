# Spec — Phase 3 · 教师端全体重做（2026-04-24）

## 背景

Phase 0/1/2 全部 commit 落地（main HEAD=424cb4a，12 个 commit）。学生端全部重设计完成，设计系统 tokens / TopBar / Sidebar / 4 学生页面全部对齐设计稿。

Phase 3 进入教师端 — 这是用户亲口说最想看的模块（teacher-dashboard 结构优于原来）。参考设计源：
- `.harness/mockups/design/teacher-dashboard.jsx`
- （`/teacher/courses` 和 `/teacher/courses/[id]` 设计师未出稿，按学生端 courses 的风格推导）

## Phase 3 路线（3 PR 串行，单 team）

### PR-3A · `/teacher/dashboard` 重设计（~500-600 行）

**目标**：按 `teacher-dashboard.jsx` 完整结构落地，这是 Phase 3 核心 PR。

**结构**（从上到下，对齐设计稿）：
1. **Header** — "教学工作台" + 日期/教学周 + 一句话摘要（"今日 3 节课 · 待批 12 份 · 本周新发布 5 项任务"）+ 右侧 2 action（"AI 生成任务" 次要 + "新建任务" 主要）
2. **5 KPI strip**（按业务优先级排，待批改排第一而非最后）：
   - 在教班级 / 本周提交(+delta) / 待批改(warn 橙色) / 班级均分(+trend) / 薄弱概念(降级为"待分析实例")
3. **左栏**（主区，flex 1）：
   - **需要你关注**（4 项，Badge count）— AI 整理后的工作清单
     - 最紧急第一项用琥珀左边框强调（"AI 已批改 32 份 · 待你复核"）
     - 其他普通任务行：类型 icon + 标题 + 班级 + 截止 + 完成率进度条 + "查看"按钮
   - **班级表现** + "本周/本月/学期" tab
     - 左半：平均分大号数字 + trend + 按班级 4 条水平进度条
     - 右半：SVG 折线图（8 周趋势）+ 柱状图（提交量叠加）
   - **学生薄弱概念**（降级为 "待分析实例 top 3"）
     - 每行：红色左条 + 概念名 / 课程 / 错答人数 + 错误率 % + "查看洞察"按钮
4. **右栏 340px**：
   - **今日课表** — 今日课程 3 行（时间 + 课名 + 班级/教室 + "进行中"徽标）
   - **动态** — 最近活动 4 条（学生 X 完成了 Y，得 Z 分 / 学生 W 提交了...）
   - **AI 助手本周建议** — 深色 ink-2 bg 卡（不是深靛渐变，区别于学生 buddy）+ 暖赭 sparkles + 降级为"查看洞察"入口

**数据降级**（schema 零改，延续 Phase 2 策略）：

| 设计稿字段 | 后端现状 | 本 PR 策略 |
|---|---|---|
| 今日/待批/均分/提交/班级 5 KPI | dashboard.service 有 stats | ✓ 直接 |
| "薄弱概念 top 3" | ❌ 无跨 instance 聚合 | **降级**：改为"待分析实例 top 3"（有 AnalysisReport 的 instance 按未看过或过期排序）— 设计师 C2 决策 |
| 需要你关注清单 | 现有 taskInstances 足够 | ✓ |
| 8 周班级表现趋势 | submissions 按周聚合（客户端算） | ✓ 前端聚合 |
| 动态 feed | submissions + 状态变更时间戳 | ✓ 前端聚合最近 10 条 |
| AI 本周建议 | ❌ 无主动建议数据 | **降级**：改为"查看洞察"入口跳 `/teacher/analytics`，按钮文案 "打开 AI 助手"（跳 `/teacher/ai-assistant`）|
| 多教师 / 多班级 | CourseTeacher / CourseClass 已支持 | ✓ |

**改动**：
- `app/teacher/dashboard/page.tsx` 全量重写 JSX
- 可能新建 `components/teacher-dashboard/{greeting-header,kpi-strip,attention-list,performance-chart,weak-instances,today-schedule,activity-feed,ai-suggest-callout}.tsx`
- 可能复用 Phase 2 建立的 `greeting-hero.tsx`（如果结构匹配）或建 teacher 版本

**不做**：
- 不改 `dashboard.service.ts` / `/api/lms/dashboard/summary` 任何字段
- 不加 AI 建议主动推荐的后端数据源
- 不改权限/auth
- 不动学生端 dashboard（PR-2B 已稳定）

**Acceptance**：
- 真登录 teacher1 / teacher2 打开 `/teacher/dashboard`，视觉对齐设计稿
- 5 KPI 显示真实数据（待批/均分/班级等）
- 8 周趋势图用真 submissions 数据聚合
- "薄弱概念"降级成"待分析实例 top 3"，点"查看洞察"跳 `/teacher/instances/{id}/insights`
- 多教师 / 多班级场景正确（teacher2 只看自己课，与 Phase 1 PR-1B 缩紧行为一致）
- 375px 移动端合理堆叠
- tsc + vitest + build 过
- 无硬编码 Tailwind 色

### PR-3B · `/teacher/courses` 列表（~350 行）

**目标**：教师课程管理列表，参照学生 courses 的 2 列 CourseCard 风格但加教师工具（新建/编辑/发布状态）。

**结构**：
- Header 本学期 + "新建课程" 主按钮
- Summary strip（4 指标：总课程 / 学生总数 / 本周活跃任务 / 待批改）
- 2 列 TeacherCourseCard 网格
  - 顶 3px 色条
  - courseCode + 多教师头像堆叠（主讲/协讲）+ 多班级徽标
  - 课名 + description
  - 状态 badge（草稿/已发布/已归档）
  - 进度（学期周数 + 完成章节）
  - mini stats（任务 / 学生 / 均分）
  - 操作：编辑 / 发布 / 复制

**数据**：
- courses list from `/api/lms/courses`（现有）
- 教师 / 班级多对多关系已支持
- 状态字段 `Course.status`（如果 schema 已有 — builder 确认）

**Acceptance**：
- teacher1 看到自己创建 + CourseTeacher 参与的课
- 多教师 / 多班级视觉正确
- 状态徽章正确
- tsc+vitest+build 过

### PR-3C · `/teacher/courses/[id]` 课程编辑器（~600 行，体量最大）

**目标**：课程详情/编辑页 — 章节/小节/内容块 CRUD，Notion 式文档编辑器。

**结构**：
- 深色 Hero（同学生端风格但加"编辑"入口）
- 三列：220px 左目录（章节/小节树）+ 主内容流（section + blocks 编辑）+ 280px 右块属性面板
- Block 编辑：6 ContentBlockType 每个有自己的编辑面板
- 任务嵌入/脱嵌
- 拖拽排序（现有有的话保留）

**Builder 执行授权**：
- 如果读完现有 page 发现 scope > 800 行，可主动拆成 PR-3C1（骨架）+ PR-3C2（block 编辑细节）
- 如遇需要改 API（违反硬约束）SendMessage 给 team-lead

## Risks

- **AI 建议降级**：设计稿里的"AI 本周建议深色卡"是设计师视觉重点，降级成"入口占位"会削弱设计张力。方案选择权留 builder：
  - A（推荐）：深色卡仍在，文案改为 "打开 AI 助手查看本周建议" + sparkles icon，点击跳 `/teacher/ai-assistant`
  - B：隐藏整卡
- **8 周趋势聚合**：如果 `/api/lms/dashboard/summary` 没返回足够 submissions 数据做 8 周聚合，可能需要额外 fetch 一次 `submissions?pageSize=100&last=60days`。这是前端 fetch，不改 API。
- **薄弱概念→待分析实例**：按钮文案从"生成讲解"改为"查看洞察"，更诚实且点击有实际行为。
- **多教师 / 多班级显示**：UI 预留位置已经在 Phase 1 backfill 过，Phase 1 PR-1B 的 `assertCourseAccess` 缩紧保证老师只看自己课。
- **Prisma 三步**：本 Phase 不改 schema，不涉及。

## 执行策略

- 单 team（`finsim-redesign-r1` 沿用，new agents `builder-p3` + `qa-p3`）
- Task 链：#13 PR-3A → #14 PR-3B → #15 PR-3C
- 每 PR PASS 后 coordinator auto-commit
- 本 session 目标：至少完成 PR-3A（教师 dashboard）— 用户亲口最想看的
- 如 context / time 允许：PR-3B / PR-3C 继续
- 任何 Phase 3 的 PR 边界都更新 HANDOFF 让下次 session 续得上

## Phase 4-7 路线（下次 session 续）

- Phase 4 任务向导 `/teacher/tasks/new` 重做（1500 行巨型向导，可能拆 2 PR）
- Phase 5 `/teacher/instances/[id]` + insights + analytics
- Phase 6 Runner 外壳 + 登录 + 空错态
- Phase 7 Simulation 对话气泡专题
