# Spec — 课表管理日历化改进（方案 C，2026-04-23）

## What the user asked for

> 课表问题：
> 1. 老师/管理员可以设置每学期起始日（让系统知道第一周是哪周，这样单双周对应的具体日期正确）
> 2. 是否增加日历部分，显示当前周数 + 本周课程安排
> 不确定怎么整合呈现比较好

## 决议方案：C — Tab 整合，Schema 零改

### 现状（已有基础）
- `Course.semesterStartDate` 字段已在 schema
- `ScheduleSlot` 有 startWeek/endWeek + weekType(all/odd/even)
- `getCurrentWeekNumber()` + `isSlotActiveForWeek()` 算法已在老师/学生 dashboard 使用
- 老师在"课程详情页"已可设学期开始日期

### 新做
`/teacher/schedule` 和 `/schedule`（学生）顶部加 3 Tab：

| Tab | 内容 | 痛点 |
|---|---|---|
| 本周 | 今日/本周课程卡片（课表项按 weekType + 当前周过滤）+ 本周任务截止 + 本周公告时间线 | #2 |
| 周课表 | 保留现有 7×N 网格 | — |
| 日历 | 月视图；每日格子标记课（色块 by 课名）/任务截止（图标）/公告（点）；点日期弹窗看详情 | #2 |

顶部固定条：`第 X 周 · 学期从 yyyy-mm-dd 开始 [编辑]`
- "编辑"打开 dialog，批量设置（勾选多课 → 一键同步 semesterStartDate）
- 不新建 Semester 表（沿用 Course.semesterStartDate，零迁移）

## Scope (拆 2 PR)

### PR-calendar-1 (P0 — 核心，~350 行)
- **后端**：
  - `lib/services/course.service.ts` 加 `batchUpdateSemesterStart(courseIds, startDate, userId, role)` — 每个 course 走 assertCourseAccess（非 admin 必须是 creator 或 CourseTeacher）
  - `app/api/lms/courses/batch-semester/route.ts` 新端点，PATCH 批量
- **前端组件**：
  - `components/schedule/semester-header.tsx` — 顶部固定条 + 编辑 dialog（多选课程 + DatePicker）
  - `components/schedule/this-week-tab.tsx` — 本周 Tab 内容（今日 + 本周课 + 任务 + 公告聚合）
  - `components/schedule/schedule-grid-tab.tsx` — 抽现有周课表网格为组件
- **页面改造**：
  - `app/teacher/schedule/page.tsx` 改为 3 Tab shell（保留老师新增/删除 slot 功能放在"周课表" Tab 内）
  - `app/(student)/schedule/page.tsx` 改为 3 Tab shell（学生无管理权限，只看）
- **测试**：
  - `tests/batch-semester.service.test.ts` — 批量更新权限检查
  - `tests/this-week-tab.test.tsx` — 本周 Tab 过滤逻辑

### PR-calendar-2 (P1 — 日历视图，~200 行)
- `components/schedule/course-calendar-tab.tsx` — 月视图（shadcn Calendar 或自画 7×6 网格）
  - 每日格子：课程色块（by 课程唯一色）、任务 due 图标（AlertCircle）、公告小点
  - 点日期打开 Popover/Dialog，显示当日详情
  - 月份切换 prev/next
- 路由不变（新 Tab 内嵌）

## Acceptance criteria

- [ ] `/teacher/schedule` 和 `/schedule` 页顶部显示 `第 X 周 · 学期从 yyyy-mm-dd 开始`（若从未设过学期日 → 显示"请先设置学期开始日期 [设置]"按钮）
- [ ] 点"编辑"打开批量设置 dialog，多选课程 + 选日期 + 保存，所有选中课的 `semesterStartDate` 同步到该日期
- [ ] 非 owner/非 CourseTeacher 的老师试图批量改他人课 → 403
- [ ] "本周" Tab 按 getCurrentWeekNumber + weekType + startWeek/endWeek 正确过滤，本周无课时显示空状态
- [ ] "周课表" Tab 功能等价于旧 `/teacher/schedule` 和 `/schedule`，老师侧保留新增/删除 slot
- [ ] "日历" Tab 月视图显示课/任务/公告；点日期能看详情
- [ ] 切换月份时日历重新渲染，课程色块稳定（同课同色）
- [ ] `tsc --noEmit` + `vitest run` 全过
- [ ] 移动端（375×812）3 Tab 可用（响应式）

## Risks

- **周数计算边界**：跨年度学期（如秋季学期从 9 月到次年 1 月）时 `getCurrentWeekNumber` 需要 robust；builder 需检查现有算法
- **课程色块冲突**：教师可能有 10+ 课，色盘需 ≥ 10 色 distinct，建议 hash(courseId) → HSL 色相均分
- **批量更新 API**：部分失败时的返回语义（全成功 / 部分成功 / 全失败），推荐 all-or-nothing 事务
- **性能**：月视图需查当月所有 slots + 任务 + 公告；走一个 aggregation endpoint 比 3 个 endpoint 好；若现有 endpoint 够用先拼装客户端，超 500ms 再上专用端点
- **老师 schedule 保留增删**：不要把老师侧 slot CRUD 挪位置或简化；用户没要求改这部分
- **Anti-regression**：`ScheduleSlot` 和 `Course.semesterStartDate` 的所有 caller 不被破坏（dashboard 依赖）

## 关联历史
- 本 session 早期刚完成 ultrareview 8 findings 修复（commit 6c35629 + f101c17）
- 本次是 feature work，不改 ultrareview 修过的文件的核心逻辑
