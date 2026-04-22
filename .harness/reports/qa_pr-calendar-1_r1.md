# QA Report — pr-calendar-1 r1

## Spec: 课表管理日历化改进 PR-1（SemesterHeader + 批量 API + ThisWeek Tab + ScheduleGrid Tab 抽出 + 3-Tab shell；Calendar Tab 为占位）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | **FAIL** | "本周 Tab" 永远空（见 Issues #1）。其他部分符合：3-Tab shell、顶部条、批量 Dialog、权限 403、日历占位、周课表保留增删均 OK |
| 2. tsc --noEmit | PASS | clean, no output |
| 3. vitest run | PASS | 9 test files, 41 tests all passing (29 existing + 12 this-week-schedule + 9 batch-semester = new 21) |
| 4. Browser (/qa-only) | **FAIL** | 浏览器真跑 `/teacher/schedule` 本周 Tab 显示"本周无课"，实际当前为第 10 周（semester=2026-02-16），有 4 个 slot 在 Mon/Wed 全周类型 all、startWeek=1 endWeek=16，本应全部命中。Screenshot: /tmp/qa-pr-calendar-1-teacher-this-week.png |
| 5. Cross-module regression | PASS | getCurrentWeekNumber 的 3 个 caller（两 dashboard + semester-header）全部 1-arg 调用，新加可选 `now` 向后兼容无破坏；dashboard.service.ts 自行 include semesterStartDate 不受影响；/api/lms/courses/[id] single-PATCH 未改；teacher 课程详情 badge 未受影响；/api/lms/{announcements,task-instances,schedule-slots,courses} 全 200 |
| 6. Security (/cso) | PASS (no critical) | PATCH /api/lms/courses/batch-semester 经 requireRole(["teacher","admin"])；Zod 校验 courseIds（非空 UUID 数组）+ datetime；assertCourseAccessBulk 事务前检查所有课程权限，全有或全回滚（`prisma.$transaction`）；非 owner/非 CourseTeacher 返回 403 envelope；mixed-ownership 批量不会偷改 owner 课（通过 curl 验证）；empty array/bad UUID 都返 400 VALIDATION_ERROR |
| 7. Finsim-specific | PASS | 所有新 UI 中文（Tabs label、Dialog title/buttons、toast、error）；Service 抛 `new Error("CODE")` → handleServiceError 映射（EMPTY_COURSE_LIST/FORBIDDEN/COURSE_NOT_FOUND）；Route handler 薄（parse→service→return）；响应 envelope `{success, data|error}`；requireRole 使用正确 |
| 8. Code patterns | PASS | 无 drive-by；reloadKey 和 getCurrentWeekNumber 加可选 `now` 均 builder 已 disclose；assertCourseAccessBulk 放 service 而非 lib/auth/guards 也已 disclose（与单课 assertCourseAccess 对称可后续统一）；两 page.tsx 瘦身合理（从 508 / 223 行降至 98 / 86 行） |

## Issues found

### Issue #1 (P0 — Blocker)
**lib/services/schedule.service.ts:29-37** — `getScheduleSlots` 的 `include.course.select` 只含 `{ courseTitle, classId, class: { select: { name } } }`，缺 `semesterStartDate`。

后果：
- `/api/lms/schedule-slots` 返回的 slots 中 `course.semesterStartDate` 恒为 `undefined`
- `lib/utils/this-week-schedule.ts:26-28`：`if (!start) return false` → 本周 Tab 把所有 slot 全部过滤掉
- 真浏览器验证：teacher1 已通过批量 Dialog 成功把 2 门"个人理财规划"的 semesterStartDate 设为 2026-02-16（DB 直查确认），顶部条正确显示"第 10 周 · 学期从 2026/2/16 开始"，但"本周课程"区仍显示"本周无课"。student5 (Class B) 同样现象（/schedule 显示"本周没有课程"）
- 直接违反 spec 验收项："'本周' Tab 按 getCurrentWeekNumber + weekType + startWeek/endWeek 正确过滤"

Fix：在 `lib/services/schedule.service.ts:29-36` 的 course select 里加一个字段：
```ts
include: {
  course: {
    select: {
      courseTitle: true,
      classId: true,
      semesterStartDate: true,   // ← 新增
      class: { select: { name: true } },
    },
  },
},
```
同时注意 `components/schedule/this-week-tab.tsx` 的 `ThisWeekSlot` 接口和 `components/schedule/schedule-grid-tab.tsx` 的 `ScheduleSlot.course` 接口声明，为一致性考虑可同时补上字段（前者已在 `lib/utils/this-week-schedule.ts:13` 声明，后者如果用不到可不改）。

此为 CLAUDE.md 列为 P0 高频失败模式"Prisma runtime 缺 include"的典型案例：`tsc --noEmit` 通过（前端类型声明了 optional 可 undefined），vitest 通过（pure-function 单测绕过 API），但真跑 UI 即挂。

### Issue #2 (P2 — 文案小差异，非阻塞)
`components/schedule/semester-header.tsx:112` — spec 建议文案"请先设置学期开始日期"，代码用"尚未设置学期开始日期"。语义一致，均为中文，按钮显示"设置"。建议统一但不阻塞。

## Overall: **FAIL**

原因：Issue #1 直接打脸 spec 验收项"本周 Tab 正确过滤"。builder 的 this-week-tab 组件 + filterThisWeekSlots 逻辑本身没错，vitest 覆盖了纯函数；但在运行时 API 数据里 `semesterStartDate` 字段缺失，整链条失效。这正是 finsim CLAUDE.md calibration 里标的 P0 高频坑 — pure function 测得再绿，没真浏览器跑过就漏。修完后需要 builder 再 browser 验证"本周"Tab 至少显示一门课才能 r2 过。

## 需求建议（给 coordinator）
- Issue #1 必修 → r2
- Issue #2 可不修（coordinator 裁量）
