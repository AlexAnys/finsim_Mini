# Build Report — PR-STU-3 r1

**Spec**: Block E E3 · 学生 /schedule 视觉对齐 mockup hero（保留 3-Tab 现状）

**Branch base**: main HEAD = `86c99b0`

## What changed

| 文件 | 性质 | 行数（净） |
|---|---|---|
| `components/schedule/schedule-hero.tsx` | 新建 | +99 |
| `app/(student)/schedule/page.tsx` | 重构 hero 区 + 加载 slots | +35 / -11（净 +24） |
| `tests/pr-stu-3-schedule-hero.test.ts` | 新增测试 | +189 |

**Total**: 1 new component + 1 page rewrite (hero only) + 1 test file = ~+312 / -11

### Hero 实现要点

1. **新 `ScheduleHero` 组件**（client component）— 接收 `semesterLabel`, `courses`, `slots` props：
   - "本学期 · 2026 春" chip：`text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre`（design token `text-ochre` = `--fs-accent`）
   - H1 "课表"：`text-[26px] md:text-[28px] font-semibold tracking-[-0.02em] text-ink-2`
   - Meta 副标：`text-[13px] text-ink-4`，文案 = `第 X 周 · 单/双周 · 今天 N 节课`
   - 右上 2 按钮：`Button variant="outline" size="sm"`，"导出 iCal" + "切换月视图"（带 CalendarDays icon）

2. **2 个 pure 函数（导出 + 单测覆盖）**：
   - `deriveHeroMeta(courses, slots, now=new Date())` — 从最早 `course.semesterStartDate` 算 `weekNumber`（用现有 `getCurrentWeekNumber` util），从 `filterThisWeekSlots` 派生今日 slot 数（jsDay→ISO 1-7 转换 + Sunday=7）
   - `buildHeroSubtitle(meta)` — weekNumber=0 时降级 "学期未开始 · 今天 N 节课"，否则正常文案

3. **按钮交互**（spec 允许 toast 占位）：
   - 导出 iCal → `toast.info("导出 iCal 功能即将上线")`
   - 切换月视图 → `toast.info("月视图即将上线，目前请使用日历 Tab 查看月视图")`（点这个的用户已经在 3-Tab 页面，引导到日历 Tab）

### Page 改动（最小 surgical）

- 加 `slots` state 和并行 fetch `/api/lms/schedule-slots`（with `Promise.all` + cancelled flag, 与 ThisWeekTab 同模式）
- 用 `<ScheduleHero>` 替代旧 `<div class="flex items-center justify-between"><h1>我的课表</h1></div>`
- **保留**：`SemesterHeader`, `Tabs`, `ThisWeekTab` / `ScheduleGridTab` / `CourseCalendarTab` 全部不动
- 间距 `space-y-4` → `space-y-5`（hero 块更大需要稍宽间距）

## What I verified

- `npx tsc --noEmit` → **0 errors** ✅
- `npx vitest run` → **608/608 PASS**（597 → +11 新测试 全 deriveHeroMeta + buildHeroSubtitle 边界覆盖）✅
- `npm run lint` → **0 errors**（21 warnings 全 pre-existing）✅
- `npm run build` → **25 routes** ✅（编译 5.6s）
- 真 cookie student1 GET `/schedule` → **HTTP 200** ✅（SSR 显示 `加载中...` + `课表`，client 渲染 hero 后追加文案）
- API E2E 验证：
  - `/api/lms/courses` → 3 courses（earliest semStart = 2026-02-16）
  - `/api/lms/schedule-slots` → 7 slots（含 day=1 两条 + day=3 两条 + day=7 一条 semStart=null 应被过滤）
  - 算出 hero 副标应为：第 11 周 · 单周 · 今天 2 节课（2026-04-27 周一 today day=1 真实数据 2 slots 命中）
- 新字符串 build chunk 验证：`本学期`、`导出 iCal`、`切换月视图`、`今天`、`节课`、`学期未开始` 全部命中 `.next/server/chunks/ssr/_91447bee._.js`
- 学生 4 路由 regression（/dashboard /courses /grades /study-buddy）→ 全 200 ✅
- 教师 /teacher/schedule → 200（未触动）✅

## Test coverage（pr-stu-3-schedule-hero.test.ts · 11 cases）

| # | 用例 | 验证点 |
|---|---|---|
| 1 | 无任何 semesterStartDate | weekNumber=0 + todayCount=0 |
| 2 | 多 course 取最早 | earliest 2026-02-16 而非 2026-03-02 |
| 3 | 单/双周判断 | 2026-04-20 起第 2 周 = 双周 |
| 4 | 今日 slot 计数 | 2 个 day=1 + 1 个 day=2，Mon today→count=2 |
| 5 | 跳过无 semStart slot | 2 slot 中 1 个 null → count=1 |
| 6 | weekType odd/even 过滤 | 第 10 周双周，odd slot 排除，even+all 计入 |
| 7 | startWeek/endWeek 边界 | 第 10 周时 1-5 范围 slot 排除 |
| 8 | Sunday→ISO dayOfWeek=7 | jsDay=0 转换正确 |
| 9 | buildHeroSubtitle 标准文案 | "第 6 周 · 双周 · 今天 3 节课" |
| 10 | buildHeroSubtitle weekNumber=0 | "学期未开始 · 今天 0 节课" |
| 11 | buildHeroSubtitle 单周 | "第 5 周 · 单周 · 今天 2 节课" |

## Design tokens 对齐（0 硬编码色）

- `text-ochre` → 暖赭 chip（`--fs-accent` = #c48a3c light / #d9a257 dark）
- `text-ink-2` → 主标题（深墨）
- `text-ink-4` → 副标 muted
- `Button variant="outline"` → finsim 标准辅助按钮 token

## What I'm unsure about / deferred

1. **"切换月视图"按钮 toast 引导** — spec 写"按钮可暂时占位 toast"。我引导用户到现有"日历"Tab，避免双重月视图实现。如果 QA 觉得纯 toast 占位更干净（不引导）可以再调。
2. **导出 iCal 真实现** — 留 P3。后端无 endpoint，本 PR 仅占位（spec 明确允许）。
3. **mockup 设计稿的 week picker rail（mockup L48-85）+ grid 重做（L87-163）+ legend（L167-188）** — spec 明确说"仅视觉对齐 hero/顶部区，**保留 3 Tab 现状**"，所以这些 mockup 段我**没有实现**，因为它们属于"重做 grid 内容"范畴（已被 spec 严禁）。如果 QA 看 mockup 误以为要全做，请回看 spec L114 "**保留 3-Tab，仅视觉对齐**" 和 spec 严禁清单 "不动 3-Tab 实现"。
4. **SSR 闪烁** — 与原页面同样存在（client component 启动时显示 `加载中...`）。这是 pre-existing 行为，本 PR 未引入。

## Restart needed?

**No** — 零 schema / 零 service / 零 Prisma 改动。前端纯组件 + page 重构。dev server PID 96617 alive 整个 build 过程（curl 200 全程通）。

## Files changed (absolute paths)

- `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim/components/schedule/schedule-hero.tsx` (new)
- `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim/app/(student)/schedule/page.tsx` (rewrite hero only)
- `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim/tests/pr-stu-3-schedule-hero.test.ts` (new)

## Acceptance check

| 项 | 目标 | 实测 |
|---|---|---|
| tsc | 0 errors | ✅ 0 |
| lint | 0 errors | ✅ 0 (21 warnings 全 pre-existing) |
| vitest | 597+ PASS | ✅ 608 PASS |
| npm run build | 25 routes | ✅ 25 routes |
| GET /schedule student1 | 200 + screenshot 对照 mockup hero | ✅ 200（screenshot 留 QA `/qa-only` 真浏览器验证 chip+H1+meta+2 按钮位） |
| 不动 3-Tab 内部 | byte-EQ ThisWeekTab/ScheduleGridTab/CourseCalendarTab | ✅ 0 改动 |
| 不动 schema/API/service | git diff 应空 | ✅ 0 改动 |
| 不动其他 student 页面 | git diff 应空 | ✅ 0 改动 |

PR-STU-3 r1 完成，移交 QA。
