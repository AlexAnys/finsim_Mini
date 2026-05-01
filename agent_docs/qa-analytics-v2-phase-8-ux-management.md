# Phase 8 QA: Student UX And Class Management

Date: 2026-05-01

Branch: `codex/analytics-diagnosis-v2`

## Scope

- Confirmed current student dashboard refinements:
  - Compact Study Buddy entry in the top row.
  - Main list uses "学习任务" with filters.
  - Overdue tasks remain actionable and show a `扣 20%` penalty tag.
  - Announcements sit above future classes in the right column.
  - The old right-side "我的课程" block is not used as the primary entry.
- Added batch member selection and batch assignment controls to `/teacher/groups`.

## Automated Checks

- `npm run typecheck` passed.
- `npm run lint` passed.

## Real App QA

Student account: `alex@qq.com / 11`

Teacher account: `teacher1@finsim.edu.cn / password123`

### Student Dashboard

URL: `http://localhost:3030/dashboard`

Verified:

- `学习任务` section is present.
- Task filters are present: `待完成`, `模拟`, `测验`.
- `未来课程` section is present.
- `公告` section is present.
- `学习伙伴` compact entry is present.
- Overdue task penalty tag `扣 20%` is visible.

### Class And Group Management

URL: `http://localhost:3030/teacher/groups`

Verified:

- Three-area layout is present: `班级`, `分组情况`, `人员信息`.
- Member search and `未分组` filter are present.
- Batch controls are present: selected count, target group selector, `批量加入`, `清空`.
- Selecting current filtered students updates the selection state; `清空` resets it.

## Notes

- QA did not mutate group membership; it only verified the new batch selection controls.
- The existing edit dialog remains the detailed path for precise member add/remove operations.
