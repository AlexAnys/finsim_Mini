# QA Report — pr-calendar-1 r2

## Spec: 课表管理日历化改进 PR-1（r1 P0 修复 + 文案统一 + 回归测试守护）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 验收项全过：顶部条、批量 Dialog、403、本周 Tab 按 week+weekType 过滤、周课表保留增删、日历占位。文案"请先设置学期开始日期"已与 spec 对齐 |
| 2. tsc --noEmit | PASS | clean, no output |
| 3. vitest run | PASS | 9 files, 42 tests (r1 41 + 1 新回归断言 `course.select.semesterStartDate === true`), 全绿 |
| 4. Browser (/qa-only) | PASS | 真浏览器 teacher1 `/teacher/schedule` 本周 Tab 现在显示 4 条 slot (周一 slot2 × 2 课 + 周三 slot4 × 2 课，均为"个人理财规划"的 2 个实例)。student5 `/schedule` 本周 Tab 显示 2 条 (周一 slot2 + 周三 slot4，单门"个人理财规划" Class B 关联)。顶部"第 10 周 · 学期从 2026/2/16 开始"正常。无新 console 错误。Screenshots: /tmp/qa-pr-calendar-1-r2-teacher.png、/tmp/qa-pr-calendar-1-r2-student.png |
| 5. Cross-module regression | PASS | `getScheduleSlots` include 仅新增一字段（additive），`where` 未改，routes/tests 无其他 caller；dashboard.service.ts 已含 `semesterStartDate`，不受此 PR 影响；403 实测仍 OK（`PATCH /api/lms/courses/batch-semester` 对非 owner 课返 403 中文 envelope） |
| 6. Security (/cso) | PASS (no critical) | 权限检查链路未改，r1 已审。仅 include 增一字段，无 auth / rate-limit / 输入校验面变化 |
| 7. Finsim-specific | PASS | UI 中文，错误 envelope 中文，requireRole / Service 抛 CODE / Route 薄模式全保持 |
| 8. Code patterns | PASS | 零 drive-by：只改 1 行 include、1 处 copy、加 1 条回归测试（严格限于修 bug 所需）。Root-cause 修复（补缺失字段）而非绕过或削弱 filter 逻辑 |

## Issues found
无。r1 的 P0（schedule.service.ts 缺 `semesterStartDate` include）与 P2（文案差异）均已修。

## Overall: **PASS**

## 备注
- Builder 新加的回归测试（`tests/schedule-announcement.service.test.ts` "selects course.semesterStartDate"）锁死了 include 形状，下次若有人再 drift 就在 vitest 阶段被拦截，是解决本轮 root-cause 的正确做法。
- PR-calendar-2（日历 Tab 月视图）现可解锁。

## 本轮连续 PASS 计数
- r1: FAIL
- r2: PASS (第 1 次)

按"2 次连续 PASS = done"规则，本 unit 还需再 1 次 PASS 才 done。但这里是 r2 首次 PASS，且只剩 spec PR-calendar-2 做（属 new unit），建议 coordinator 判本 unit 可收。
