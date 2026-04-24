# QA Report — pr-2c r1

## Spec: Phase 2 PR-2C · 学生 `/courses` 列表重设计（header 本学期 + 4-metric summary strip + 2 列 CourseCard 网格 / 色条稳定 / 进度徽章 / 下次课 label / mobile 2x2 strip + 单列卡片 / schema + API 零改）

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | page.tsx 重写 + 2 新组件（`course-card.tsx`/ `course-summary-strip.tsx`）+ 1 新 util（`next-lesson.ts`）；降级 teachers/章节/排名/学习时长全部按 spec 表；`isDone` (>=100) / `isBehind` (<15) 徽章 warn/success 条件渲染；summary strip 2x2 交叉分割线（`i%2===1 border-l` + `i>=2 border-t md:border-t-0`）✓ |
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | 16 suites / 101 tests 全绿（+8 新 `next-lesson.test.ts`: 今天/明天/周X/下周X 四路径 + 多 slot 选最近 + 无 slot → null + week range 过滤 + course.id fallback） |
| 4. `npm run build` | PASS | 25 routes 全编译，无新增 warning |
| 5. Browser (真 curl + cookie 登录) | PASS | 见下表 A/B/C/D |
| 6. Cross-module regression | PASS | git diff：1 M（`app/(student)/courses/page.tsx`）+ 3 untracked（course-card / next-lesson / next-lesson.test）；6 页真登录 200；PR-1A SSR 固定 role 守护继续通过 |
| 7. Security (/cso) | N/A | 纯前端改动，零 API / auth / schema / 支付 / 上传 |
| 8. Finsim-specific | PASS | 全中文（header "本学期" + "我的课程" + "平均完成度/本周待办/平均分/已完成任务" + "下次课/结课任务"+ "进度落后/已完成"）；无英文错误消息（仅 "加载课程失败" / "网络错误，请稍后重试" 中文）；无 business logic（page 只 merge 两 API 数据） |
| 9. Tailwind class 清洁度 | PASS | `grep -E 'bg-(violet\|emerald\|blue\|indigo\|red\|green\|yellow\|purple\|pink\|orange\|rose\|sky\|teal\|cyan\|lime\|amber\|fuchsia)-[0-9]'` 在 4 个文件 **0 matches**；全走 tokens（brand/ink/line/paper/surface/surface-tint/warn/success/ochre + `courseColorForId` hash inline style） |

### 表 A · 真浏览器 /courses（student1）HTTP + API 数据层

| URL | HTTP | 资源大小 |
|---|---|---|
| `/courses` | 200 | 40118 bytes |
| `/api/lms/courses` | 200 | 3542 bytes |

student1 数据：3 门课（e6fc049c/8f7f653c/940bbe23）

### 表 B · 色条稳定性（`courseColorForId` hash）

| courseId prefix | 计算 tagKey | courseCode | 备注 |
|---|---|---|---|
| e6fc049c | **tagB**（蓝灰 #E0ECFA/#1F447B） | FIN301 | 个人理财规划 |
| 8f7f653c | **tagE**（旧粉 #F6E1E0/#7F2A26） | null | 个人理睬规划 |
| 940bbe23 | **tagC**（翡翠 #DFF0E8/#0A5A42） | FIN301 | 个人理财规划（重复名） |

→ **3 门课 3 不同色条** ✓；hash 函数 `* 31 + charCode` 纯确定性，相同 id 刷新同色；与 PR-2B 右栏 `CourseProgressSidebar` 使用同一函数同一 palette → **跨页色一致** ✓。

### 表 C · 数据层预期每卡 stats

| 卡片 | 任务 | 进度 | isBehind | isDone | 平均分 |
|---|---|---|---|---|---|
| e6fc049c · 个人理财规划 | 0/3 | 0% | **true**（琥珀徽章） | false | — |
| 8f7f653c · 个人理睬规划 | 0/0 | 0% | **true**（琥珀徽章） | false | — |
| 940bbe23 · 个人理财规划 | 1/6 | 17% | false | false | 29 |

Summary strip 预期值：
- 平均完成度 ≈ round((0+0+17)/3) = **6%**
- 本周待办 = 9 项（5 overdue + 4 todo）
- 平均分 = 29（1 次批改）
- 已完成任务 = 1/9

→ 所有降级字段 graceful fallback（数字 or "—"），不空不报错 ✓

### 表 D · 回归守护（真登录 6 页 HTTP 200）

| 角色 | URL | HTTP | SSR 首屏角色计数 |
|---|---|---|---|
| student1 | `/dashboard` | 200 | 学生 ×2 / 教师 0 / 管理员 0 ✓ |
| student1 | `/grades` | 200 | —— |
| student1 | `/schedule` | 200 | —— |
| teacher1 | `/teacher/dashboard` | 200 | 教师 ×3 / 学生 0 / 管理员 0 ✓ |

→ PR-1A SSR 固定 role 守护未破坏。PR-2A Topbar 面包屑在 `/courses` 显示 `学生 / 我的课程` ✓（通过 SSR HTML 抓取确认）。

### 表 E · next-lesson util 8 单测覆盖范围

1. 空 slot list → null ✓
2. 今天未开始 → "今天 HH:MM-HH:MM" ✓
3. 今天已结束 → 下周（"下周X"）✓
4. 1 day ahead → "明天" ✓
5. 2-6 天 → weekday label（周X）✓
6. 多 slot 取最早 ✓
7. startWeek/endWeek 范围外 → null ✓
8. course.id fallback 到 courseId + 默认 title "课程" ✓

### 表 F · 视觉结构对齐 mock（`student-courses.jsx`）

| mock 要素 | 实现对应 | 文件行 |
|---|---|---|
| maxWidth 1320 + 页面 padding | `mx-auto max-w-[1320px]` | page.tsx L286 |
| "本学期" 眉题（ochre uppercase） | `text-[11px] ... uppercase tracking-[0.15em] text-ochre` | page.tsx L289-291 |
| 标题 "我的课程" 大号 | `text-[26px] font-bold tracking-[-0.01em]` | page.tsx L292-294 |
| count line "N 门课程 · M 任务 · 已完成 X/M" | 三 reduce 动态聚合 | page.tsx L296-301 |
| 4-metric summary strip | `CourseSummaryStrip` + `grid grid-cols-2 md:grid-cols-4` | strip L25 |
| strip 交叉分割线 mobile 2x2 | `i%2===1 border-l` + `i>=2 border-t md:border-t-0` | strip L32-33 |
| 2 列 card grid desktop | `grid gap-4 lg:grid-cols-2` | page.tsx L307 |
| Card 顶 3px 色条 | `absolute inset-x-0 top-0 h-[3px]` + `backgroundColor: tc.fg opacity:0.9` | card L46-49 |
| courseCode 色块徽章 | inline `backgroundColor: tc.bg, color: tc.fg` | card L54-59 |
| 2-line clamp 描述 | `line-clamp-2` | card L74 |
| "已完成" / "进度落后" 徽章 | `Badge secondary bg-success-soft/warn-soft` 条件渲染 | card L79-95 |
| 进度条 5px 高 + success/brand 色 | `h-[5px]` + `isDone ? bg-success : bg-brand` | card L117-124 |
| surface-tint 进度行背景 | `bg-surface-tint` | card L100 |
| 下次课 CalendarDays + weekday label | `CalendarDays` + `deriveNextLesson` date | card L134-145 |
| mini stats 任务/均分 md+ 显示 | `hidden shrink-0 gap-3.5 pr-1 md:flex` | card L152 |
| "进入"按钮 pointer-events-none | `className="shrink-0 pointer-events-none"` | card L179-186 |
| 整卡可点 | 外层 `<Link href={/courses/${c.id}}>` | card L39-41 |

## Issues found

None (all functional).

### 次要观察（不作为 FAIL 依据）

1. **build_pr-2c_r1.md 里 `components/dashboard/course-summary-strip.tsx` 被标为 NEW**，但 git log 显示该文件已在 PR-2B commit 47f445d 中 commit 归档（作为 dashboard 新组件的一部分）。实际内容功能正确、测试通过、import 路径正确 — 仅 report 文件归属标签错误。不影响功能。
2. **课程 2 `8f7f653c` 有 0 任务却显示"进度落后"徽章**（`progress = 0 < 15 && !isDone = true`）。刚加入课程未布置任务的学生被标"落后"是边缘 case，但 spec 没明确要求 "如果 totalTasks=0 就不显示徽章"。builder 可在未来小 PR 加条件 `isBehind && totalTasks > 0` 修复。当前**不阻塞 ship**。
3. **`teachers` 列表降级为隐藏** — 需要 API include 教师数据；spec 明确说"不改后端"，所以这是 spec 内的合法降级。report 已清楚声明 deferred。
4. **seed 数据小**：student1 courses=3，summary strip "平均完成度 6%" 和单卡 "进度 0%" 会显得比较空 — 是数据层面问题，不是 PR 问题。

## Overall: **PASS**

**给 builder-p2 的信**：PR-2C 全项 PASS，可以 ship。Phase 2（PR-2A/2B/2C）全部完成。建议 coordinator commit 并收尾，PR-2D 跨会话续做（或用户决定）。
