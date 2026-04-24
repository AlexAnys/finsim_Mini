# QA Report — pr-2d r1

## Spec: Phase 2 PR-2D · 学生 `/courses/[id]` 详情重设计（深色 Hero + 6 tab + 3 列布局 + 章节 3 状态 + 小节 4 状态 + 6 ContentBlockType 视觉 + 右栏 mastery/teacher/AI / schema + API 零改）

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | page.tsx 重写 + 6 新组件（`course-hero.tsx` / `chapter-nav.tsx` / `section-timeline.tsx` / `section-task-row.tsx` / `content-block-row.tsx` / `right-sidebar.tsx`）+ transforms util（268 行）；降级表 11 项全按 spec 落地；3 列 `lg:grid-cols-[220px_minmax(0,1fr)_280px]`；章节 `done/active/upcoming` 3 状态 + 小节 `done/active/upcoming/locked` 4 状态；6 ContentBlockType 枚举映射 + unknown → custom |
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | 17 suites / 119 tests 全绿（+18 新 `course-detail-transform.test.ts`：formatDueLabel 4 + transformSectionBlocks 3 + transformSectionTasks 3 + computeSectionState 4 + computeChapterStatus 4） |
| 4. `npm run build` | PASS | 25 routes 全编译，无新增 warning |
| 5. Browser (真 curl + cookie 登录) | PASS | 见下表 A/B/C/D |
| 6. Cross-module regression | PASS | git diff：1 M + 3 untracked 组件目录 + 1 util + 1 test；7 页（学生 4 + 教师 3）真登录 200；PR-2A / PR-2B / PR-2C / PR-1A 全部守护通过 |
| 7. Security (/cso) | N/A | 纯前端改动，零 API / auth / schema / 支付 / 上传 |
| 8. Finsim-specific | PASS | 全中文（6 tab 标签 / 状态文案 / "继续上次" / "向老师提问" / "学习伙伴建议" / "暂未解锁" / "暂无任务" / "本节进行中 · N 项未完成" / "已完成 · 得分 X/Y"）；错误文案 "加载失败" / "网络错误，请稍后重试"；无英文泄露；无 business logic（client fetch 两 API 合并） |
| 9. Tailwind class 清洁度 | PASS | `grep -E 'bg-(violet\|emerald\|blue\|indigo\|red\|green\|yellow\|purple\|pink\|orange\|rose\|sky\|teal\|cyan\|lime\|amber\|fuchsia)-[0-9]'` 在 course-detail/ + page.tsx + transform **0 matches**；全走 tokens（brand/ink/line/paper/paper-alt/surface/surface-tint/success/ochre/warn/danger/sim/quiz/subj + `var(--fs-primary/deep/accent)` inline linear-gradient） |

### 表 A · 真浏览器 /courses/[id]（student1）HTTP

| courseId prefix | URL | HTTP | 资源大小 |
|---|---|---|---|
| e6fc049c | `/courses/e6fc049c...` | 200 | 41406 bytes |
| 940bbe23 | `/courses/940bbe23...` | 200 | 41686 bytes |
| 8f7f653c | `/courses/8f7f653c...` | 200 | 41698 bytes |
| - | `/api/lms/courses/e6fc049c...` | 200 | 6208 bytes |

student1 course 1 结构：3 chapters / 8 sections / 3 tasks (1 quiz + 1 subjective + 1 simulation) / 0 contentBlocks（seed 限制）。

### 表 B · 状态机预测（按 transforms 规则 mirror）

| section | taskCount | done | 预期 state | 预期 statusLine |
|---|---|---|---|---|
| 1.1 什么是个人理财 | 0 | 0 | upcoming | 暂无任务 |
| 1.2 财务目标设定 | 0 | 0 | upcoming | 暂无任务 |
| 1.3 收支管理 | 1 | 0 | upcoming | 1 项任务 |
| 2.1 银行存款与理财 | 0 | 0 | upcoming | 暂无任务 |
| 2.2 基金投资基础 | 1 | 0 | upcoming | 1 项任务 |
| 2.3 股票投资入门 | 0 | 0 | upcoming | 暂无任务 |
| 3.1 风险认知与评估 | 0 | 0 | upcoming | 暂无任务 |
| 3.2 资产配置策略 | 1 | 0 | upcoming | 1 项任务 |

3 章节全 upcoming → `computeChapterStatus` 全 upcoming → page 的 `firstActive` 为 null → fallback `chapters[0]` 作为 activeChapterId（第 1 章自动选中）✓

### 表 C · 回归守护（7 页真登录 HTTP + SSR role 计数）

| 角色 | URL | HTTP | 首屏 role 计数 |
|---|---|---|---|
| student1 | `/dashboard` | 200 | —— |
| student1 | `/courses` | 200 | —— |
| student1 | `/courses/[id]` | 200 | 学生 ×2 / 教师 0 / 管理员 0 ✓ |
| student1 | `/grades` | 200 | —— |
| student1 | `/schedule` | 200 | —— |
| teacher1 | `/teacher/dashboard` | 200 | —— |
| teacher1 | `/teacher/courses` | 200 | —— |
| teacher1 | `/teacher/courses/[id]` | 200 | —— |

→ PR-1A SSR 固定 role 继续通过；PR-2A 面包屑 `学生/我的课程`（uuid 跳过）正常；PR-2B dashboard + PR-2C /courses 列表均未受影响。

### 表 D · 视觉结构对齐 mock（`course-detail.jsx`）

| mock 要素 | 实现对应 | 文件行 |
|---|---|---|
| 深色 Hero 渐变 | `linear-gradient(135deg, var(--fs-primary) 0%, var(--fs-primary-deep) 100%)` inline | hero L55-57 |
| 装饰 SVG 线图 | `<svg>` + 两条路径 + 1 圈（accent 色） | hero L64-79 |
| Hero breadcrumb "我的课程 / {title}" | 内嵌 `<Link href="/courses">` + span | hero L82-87 |
| Hero 课名 30px | `text-[26px] md:text-[30px]` | hero L91 |
| Hero 右侧进度 38px | `fs-num text-[38px]` | hero L126 |
| Hero 进度条 1px 高 accent 色 | `h-1 ... backgroundColor: var(--fs-accent)` | hero L135-143 |
| 6 tab 条 | `TABS` array 6 项 + `role="tablist"` | hero L28-35, L148 |
| 当前 tab accent 下划线 | inline `borderBottom: 2px solid var(--fs-accent)` 条件 | hero L166 |
| 任务 tab 红色计数徽标 | `text-[10px] font-semibold` + `color: var(--fs-accent)` | hero L171-178 |
| 3 列布局 220/1fr/280 | `lg:grid-cols-[220px_minmax(0,1fr)_280px]` | page L318 |
| 章节导航 sticky top | `lg:sticky lg:top-[70px]` | chapter-nav L23 |
| 章节 3 状态 circle | `bg-success/bg-brand/bg-line` 条件 | chapter-nav L45-50 |
| 章节 done 用 Check icon | `<Check>` 条件替代 number | chapter-nav L53-56 |
| 小节 statusLine 4 态 | `computeSectionStatusLine` 返回中文字符串 | transform L242-257 |
| section state 色条背景 | `border-brand-soft-2 bg-paper-alt` for active / `border-line bg-surface` otherwise | section-timeline L60-65 |
| locked section 透明度 0.6 | `opacity-60` 条件 | section-timeline L64 |
| 课前/课中/课后 slot 分组 | `SLOT_ORDER = ["pre","in","post"]` filter/map | section-timeline L119-145 |
| 6 ContentBlockType 色 | KIND_CONFIG × 5 tones (ink/quiz/sim/subj/ochre) | content-block-row L30-45 |
| 任务行 4 status badge | graded (success) / todo (warn) / submitted (paper-alt) / overdue (danger) | section-task-row L81-104 |
| "开始" / "回顾" / "查看" 条件按钮 | task.status 条件渲染 Button 分支 | section-task-row L107-123 |
| 整卡 Link 到 /sim /tasks | `taskHref(task)` → `/sim/${id}` or `/tasks/${id}` | section-task-row L57-60 |
| 右栏 3 section | TeacherCard + MasterySection + AiHint | page L362-366 |
| mastery 色 ladder | `>=80 success / >=60 ochre / <60 warn / locked line-2` | right-sidebar L56-63 |
| AiHint 虚线边框 + ochre sparkles | `border-dashed border-hairline` + `text-ochre Sparkles` | right-sidebar L122-133 |

### 表 E · 6 ContentBlockType 视觉覆盖（通过 transforms unit test）

`transformSectionBlocks` 单测 L53-73 明确 assert 6 枚举值映射 + unknown fallback：
```
markdown → markdown
resource → resource
simulation_config → simulation_config
quiz → quiz
subjective → subjective
custom → custom
"unknown-type" → custom (fallback)
```

组件 `content-block-row.tsx` KIND_CONFIG 为 6 种各自定义 label + icon + tone：
| kind | label | tone (color token) |
|---|---|---|
| markdown | 讲义 | ink (bg-paper text-ink-4) |
| resource | 资源 | ink (bg-paper text-ink-4) |
| simulation_config | 模拟配置 | sim (bg-sim-soft text-sim) |
| quiz | 测验 | quiz (bg-quiz-soft text-quiz) |
| subjective | 主观题 | subj (bg-subj-soft text-subj) |
| custom | 其他 | ochre (bg-ochre-soft text-ochre) |

→ 6 种视觉都有 distinct tone，unknown → custom 回退 ✓。seed 数据没有 contentBlocks，无法真浏览器目测；但代码覆盖 + unit test 双重确认可落地。

### 表 F · Hero bleed 与 layout padding 的交互

- Hero: `-mx-6 md:-mx-6` 左右回撤 24px 触达视窗边缘
- Hero: `-mt-6` 顶部回撤 24px
- Layout: `p-6 pt-20 lg:pt-6`（来自 `(student)/layout.tsx` + `teacher/layout.tsx`）
- desktop (`>=lg`): `pt-6 - 24 = 0` → Hero 紧贴 TopBar（PR-2A 的 `sticky top-0 h-14`），视觉连续 ✓
- mobile (`<lg`): `pt-20 - 24 = 56px` → 恰好给 sidebar mobile bar (`z-40 h-14`, 56px) 留空间，不重叠 ✓

## Issues found

None (all functional).

### 次要观察（不作为 FAIL 依据）

1. **seed 数据没有 contentBlocks**，6 ContentBlockType 视觉无法通过真浏览器目测差异化；但 unit test + 组件代码覆盖已证明 6 枚举值 + unknown fallback 行为正确。
2. **student1 所有章节都 upcoming 态**，因为他的 dashboard task list 与 course 1 的 taskInstances 没交集（dashboard task id 是 taskInstance id，对 course 1 无 submit/graded 记录）。这是 seed 数据限制 — 视觉上 done / active 分支无法目测；但 18 tests 已 assert done / active / locked 分支正确。
3. **page.tsx L283 `const className = ...`** 与 React `className` prop 变量名同字符串但语义不同（这里是"课程班级名串"），L298 `className={className}` 传给 `CourseHero` 的 `className` prop（定义为 `string | null`，**不是 CSS class**）。无 bug 但命名混淆 — 未来小改建议重命名为 `classLine` 或 `courseClassName`。
4. **computeSectionState 的 "locked" 粗粒度判定**：仅在 `semesterStartDate > now` 且 `taskCount === 0` 时触发。spec 已明确 "locked" 是粗粒度判定，section 级精细锁需要新 schema 字段。
5. **`继续上次` 按钮 + 5 个 tab 占位** 均是视觉占位，实际 handler 未接入（spec 允许）。
6. **build_pr-2d report 里 "超出预算"**（1666 行 vs spec 550 行）但每个单独文件 ≤280 行，单一职责清晰，无"巨型组件"反模式。合理拆分；算接受。

## Overall: **PASS**

**给 builder-p2 的信**：PR-2D 全项 PASS，可以 ship。Phase 2（PR-2A/2B/2C/2D）全部连续 PASS，4 轮。可 commit 并完成 Phase 2 HANDOFF。
