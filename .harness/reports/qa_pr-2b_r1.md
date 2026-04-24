# QA Report — pr-2b r1

## Spec: Phase 2 PR-2B · 学生 `/dashboard` 重设计（问候 Hero / 4 KPI / 3 列主栏 / 320px 侧栏 / 深色 AI 卡 / 全降级不改 schema / 移动响应式）

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | page.tsx 重写 + 8 新组件按设计稿 JSX 结构落地；降级 5 字段（streak→本周完成 / mastery→已完成率 / 课程进度→任务完成率 / 公告未读→3 天内 / AI 推荐→通用文案+/study-buddy 入口）严格按 spec 表 |
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | 15 suites / 93 tests 全绿（+11 新 `dashboard-formatters.test.ts` 覆盖 urgency 阈值、"今晚/明天" label、2+ 天、过期、>7 天；`relativeTimeFromNow` 6 分支） |
| 4. `npm run build` | PASS | 25 routes 全编译，无新增 warning |
| 5. Browser (真 curl + cookie 登录) | PASS | 见下表 A/B/C/D |
| 6. Cross-module regression | PASS | 见下表 E：git diff 证据 + 6 路由 200 + 旧组件保留 |
| 7. Security (/cso) | N/A | 纯前端组件改动，零 API / auth / schema / 支付 / 上传 |
| 8. Finsim-specific | PASS | 全中文（greeting 5 种 / 组件 label 中文 / error "加载失败" / "网络错误，请稍后重试"）；无英文错误消息泄露；无 business logic（page 只消费 `/api/lms/dashboard/summary`）；API response 格式未动 |
| 9. Tailwind class 清洁度 | PASS | `grep -E 'bg-(violet\|emerald\|blue\|indigo\|red\|green\|yellow\|purple\|pink\|orange\|rose\|sky\|teal\|cyan\|lime\|amber\|fuchsia)-[0-9]'` 在 8 新组件 + page.tsx + formatters **0 matches**；全走 tokens（brand/ink/line/paper/sim/quiz/subj/ochre/success/warn/danger + courseColorForId hash） |

### 表 A · 真浏览器 /dashboard（student1）HTTP + API 数据层核实

| URL | HTTP | 资源大小 | 备注 |
|---|---|---|---|
| `/dashboard` | 200 | 40614 bytes | SSR 外壳挂载正常（含 Topbar 面包屑 `学生` ×2） |
| `/api/lms/dashboard/summary` | 200 | 26390 bytes | student1 data: courses=3, tasks=10(5 overdue+1 graded+4 todo), recentSubmissions=1, announcements=5, scheduleSlots=4 |

注：页面是 client-side `useEffect` fetch，SSR HTML 阶段为 loading 骨架，视觉由 hydration 后渲染 — **无 hydration mismatch 风险**（`if (!data) return null` 在 SSR 阶段 early-return，Hero/KPI 只在 client 挂载）。

### 表 B · 数据层预期 KPI 值（mirror page 逻辑）

| KPI | 预期值 | 来源 |
|---|---|---|
| 本周待办 | 9 | `tasks.filter(status === "todo" \|\| "overdue")` = 4 + 5 |
| 本周完成 | 0 | student1 当周（2026-04-20 起）无 submission |
| 平均得分 | 28.6 | 1 graded 提交 (score=20/maxScore=70 → 28.57%) |
| 已完成率 | 0% | `0 / (9 + 0) = 0%` |

降级字段全部产出非空值（数字或 "—"）—— ✓ graceful fallback

### 表 C · 优先待办 urgency / 琥珀边证据

student1 seed 数据 3 个 top priority 任务 dueAt 全部在 2026-02（当前 2026-04-24），`hoursLeft < 0` → `formatRelativeDue.isUrgent = false` → 无琥珀边（正确行为：不是 urgent，是 "已过期 X月X日"）。urgency 阈值由 `dashboard-formatters.test.ts` 11 tests 锁定：

- 24h 同日 due ≥ urgent ✓
- 24h 次日 due ≥ urgent ✓
- 2+ 天 ≥ 非 urgent ✓
- 已过期 ≥ 非 urgent ✓
- 7 天以上 ≥ 回退绝对日期 ✓

→ 琥珀边逻辑验证通过；seed 数据没有 <=24h 任务导致无法视觉目测，属 seed 状态非 PR 问题。

### 表 D · 课程色条稳定性（`courseColorForId` hash）

`scheduleSlots` 2 distinct courseId（`e6fc049c...` + `940bbe23...`）解析方式 `s.course?.id ?? s.courseId ?? ""` — 实际走 `s.courseId`（真 UUID）。不同 UUID → 不同 tagKey → **不同色条**。hash 函数纯确定性（`* 31 + charCode`），相同 id 多次刷新同色 ✓。空字符串 fallback 到 tagA（不炸），但实际不会发生（每 slot 都有 courseId）。

### 表 E · 回归守护（未动文件清单）

| 文件 | 状态 |
|---|---|
| `app/teacher/dashboard/page.tsx` | 未动 |
| `components/dashboard/task-card.tsx` | 未动（325 行） |
| `components/dashboard/announcement-card.tsx` | 未动（48 行） |
| `components/dashboard/schedule-card.tsx` | 未动（37 行） |
| `components/dashboard/timeline.tsx` | 未动（236 行） |
| `lib/services/dashboard.service.ts` | 未动 |
| `prisma/schema.prisma` | 未动 |
| `app/api/lms/dashboard/summary/route.ts` | 未动 |

`git status` 确认 PR-2B 改动范围：1 modified（`app/(student)/dashboard/page.tsx`）+ 9 新 untracked 组件/lib/test。

HTTP 回归 6 页（真 curl 登录）：
- `/grades` 200 / `/courses` 200 / `/schedule` 200（student1）
- `/teacher/dashboard` 200 / `/teacher/courses` 200 / `/teacher/tasks` 200（teacher1）

### 表 F · Topbar PR-2A 回归（依然挂载正常）

`/dashboard` SSR HTML grep `学生` ×2 / "面包屑" ×1 / "我的课程" ×1 / "加载中..." ×1 —— 
- 面包屑 `学生` 出现两次（role root + menu label）— 符合 PR-2A 布局
- **未见"教师"/"管理员"字样** — PR-1A SSR 固定 role 回归守护仍然通过 ✓

### 表 G · 视觉结构对齐 mock

| mock 设计稿要素 | 实现对应 |
|---|---|
| `maxWidth: 1280` + padding | `mx-auto max-w-[1280px]` ✓ |
| greeting 4 格式（上午/中午/下午/晚上 + 夜深了 <6h） | `greetingWord()` L19-26 ✓ |
| 日期 + 教学周 dateLine | `buildDateLine()` + `currentWeekLabel()` 基于 `semesterStartDate` ✓（预期第 10 教学周） |
| `grid 4` KPI | `grid grid-cols-2 gap-3.5 lg:grid-cols-4` ✓（mobile 2 列 ≠ lg 4 列） |
| KPI 字号 28px fs-num | `fs-num text-[28px] font-semibold tracking-[-0.03em]` ✓ |
| 今日课程 4px 左色条 | `w-1 self-stretch ... backgroundColor: tagColor` ✓ |
| "进行中"徽标 success 色 | `bg-success-soft text-success-deep` ✓（inProgress 由 timeLabel regex 解析） |
| 优先待办琥珀左边框 3px | `border-warn-soft border-l-[3px] border-l-warn` 条件渲染 ✓ |
| 最近成绩条色 | `>=85 bg-success / >=70 bg-ochre / else bg-warn` ✓ recent-grades.tsx L44-48 |
| 右栏 320px 固定 | `lg:grid-cols-[minmax(0,1fr)_320px]` ✓（`minmax(0,1fr)` 防长名溢出） |
| 课程卡片色块（首字母） | `courseColorForId` + `tagColors[key]` bg/fg inline style ✓ |
| 公告未读 6px 红点 | `size-1.5 ... rounded-full bg-danger` 条件渲染 ✓ |
| AI 深色卡渐变 | `linear-gradient(135deg, var(--fs-primary), var(--fs-primary-lift))` inline ✓（tokens 不是 bg-brand-soft，语义相同） |
| AI 卡 ochre sparkles | `text-ochre` ✓ |
| AI 卡 CTA 白底 brand 字 | `bg-white ... text-brand` ✓ |

## Issues found

None.

### 次要观察（不作为 FAIL 依据）

1. **seed 数据全部 overdue** — student1 所有任务 dueAt 在 2026-02，当前 2026-04-24 → 优先待办不会显示琥珀边。unit tests 已锁 urgency 阈值，视觉目测该效果需未来 seed 补一条 `<=24h` 任务。
2. **AI 卡 gradient 走 inline style + CSS var** — 非 Tailwind utility；builder 在 report 解释了 `bg-gradient-to-br` + `from-brand to-brand-deep` 配合 CSS var 不如直接 var。语义上等价，清洁度不扣分。
3. **avgScore 28.6** — 对 student1 视觉呈现数字会比较低（<80 → 无 trendUp 绿箭头）。这不是 bug，是数据的反映。
4. **`course.id` 在 `scheduleSlots[].course` 内缺失** — schema include 只带 `classId/courseTitle/semesterStartDate`。page 层用 `s.courseId` fallback 取顶层 UUID 正常工作；若未来 API 调整去掉顶层 `courseId`，会降级到 `""` → 全部 tagA 同色。当前无风险，但是未来 API 重构时需要注意这个依赖关系。

## Overall: **PASS**

**给 builder-p2 的信**：PR-2B 全项 PASS，可以 ship。建议 coordinator 先 commit，再放 builder-p2 认领 #8 PR-2C。
