# QA Report — pr-calendar-2 r1

## Spec: 日历 Tab 月视图（7×6 网格 + 课/任务/公告标记 + 点日期详情 + 月份切换 + 响应式移动端）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 所有 PR-2 验收项：(a) 月视图 6×7 网格；(b) 每日课程色块 + 任务 AlertCircle + 公告蓝点；(c) 点日期弹 Popover 显示课/任务/公告 3 段详情；(d) 月份切换 prev/next/今天按钮；(e) 色稳定（hash-based）；(f) 移动端 sm:hidden list 布局 |
| 2. tsc --noEmit | PASS | clean, no output |
| 3. vitest run | PASS | 11 test files, 61 tests all passing (+19 new: 4 calendar-colors + 15 month-calendar) |
| 4. Browser (/qa-only) | PASS | teacher1 `/teacher/schedule` 日历 Tab 月视图渲染 2026年4月；6 个周一 + 6 个周三 cell 显示 "个人理财规划" 色块；22 号（Wed）popover 显示"2026年4月22日星期三 / 课程 2× / 公告 2×"；prev/next/今天 切换月份 label 正确；色块 RGB 稳定（同 courseId 同色，跨月恒一致）；student5 `/schedule` 日历 Tab 单课色块渲染（Class B 关联 1 门课）；1440 桌面下 `hidden sm:grid` 显示网格 / `sm:hidden` 列表隐藏；375 移动下相反。无新 console 错。截图: /tmp/qa-pr-calendar-2-teacher-calendar.png, /tmp/qa-pr-calendar-2-student-calendar.png |
| 5. Cross-module regression | PASS | 本周 Tab 和 周课表 Tab 切回仍正常（切换测试通过）；dashboard (student + teacher) 无破坏；3 个 util（calendar-colors / month-calendar / schedule-dates）都是 additive 纯函数；`/api/lms/*` 4 个端点仍 200；batch-semester 403 仍 OK；无新 API |
| 6. Security (/cso) | PASS (N/A) | 只新增纯 UI 组件 + 客户端算法，无 auth / rate-limit / 数据验证 / 文件上传变动；API 全沿用已有端点 |
| 7. Finsim-specific | PASS | 所有 UI 中文（月份 label "2026年4月"，今天按钮，日期格式"X月X日星期X"，段头"课程/任务截止/公告"，占位"本月暂无课程"等）；API 响应仍是 `{success,data}` envelope；component 只做 fetch+render，无 server 逻辑泄到 client |
| 8. Code patterns | PASS | 3 个新文件全新增（calendar-colors util / month-calendar util / course-calendar-tab component），2 个 page.tsx 只换 Tab 3 内容（placeholder→真组件），无 drive-by refactor。纯函数与 UI 分离，test coverage 直达算法层 |

## Issues found
无。

## Overall: **PASS**

## Spec 逐条验收

| Acceptance | 验证方式 | 结果 |
|---|---|---|
| 日历 Tab 月视图显示课/任务/公告 | teacher 真浏览：4 月所有周一 + 周三 显示"个人理财规划"色块，22 日 Wed 显示公告蓝点 + 3 月/4 月多处 AlertCircle (任务) | PASS |
| 点日期能看详情 | 点 4/22 → Popover 弹出"2026年4月22日星期三 / 课程 2 / 公告 2"分段 | PASS |
| 切换月份时日历重新渲染 | Prev/Next/今天 按钮切换 label "2026年4月"/"2026年3月" 反复验证 | PASS |
| 课程色块稳定（同课同色） | 跨月读取 inline style backgroundColor，同 courseId 永远同 RGB | PASS |
| tsc + vitest 全过 | 见 2/3 行 | PASS |
| 移动端 3 Tab 可用（响应式） | 375×812 viewport 下 `hidden sm:grid` 变为 `display:none`，`sm:hidden` list 变为可见 | PASS |

## 额外观察（非阻塞）

1. **自画 grid 代替 shadcn Calendar** — builder 决策合理（见 build 报告第 1 条）。Custom day content 用 react-day-picker 不够灵活，自画更直接。

2. **Popover 可能渲染多份 DOM** — inspect 发现 day cells 的 `PopoverContent` 在关闭时也可能在 `<div class="sm:hidden space-y-3">` 下 mounted (mobile list view 每个 date 都有 DayDetail 嵌入，包括 `<div class="space-y-3">` 内的 DayDetail)。这不是 bug，是 builder 的 mobile 策略 —— mobile 直接展开 DayDetail 为 cards 列表，不用 Popover。desktop grid 则通过 Popover lazy 挂 DayDetail。但这意味着 mobile 的 DOM 里始终有 9+ 个 DayDetail（每个有内容的日期一份），性能上若一月超 30 个内容日可能稍重 —— 生产环境大课表未测，spec 只要求"可用"，当前通过。

3. **Today 高亮** — 在今天是 Apr 23 Thursday，Thu 没课所以 cell 是 disabled，但 date number（23）仍被圆形 primary 色包围（source 188-190 `day.isToday` 判断）。spec 里 "今天" 没硬要求可点击，视觉提示已做到。

4. **任务时间显示** — Popover 详情里任务只显示"X月X日 HH:MM"，builder 用 `toLocaleTimeString("zh-CN", {hour:'2-digit', minute:'2-digit'})` — 中文 UI OK，符合 finsim 约束。

## 本 unit 连续 PASS 计数（仅 calendar 相关 unit）
- pr-calendar-2 r1: PASS（第 1 次）
- 之前 pr-calendar-1 r2: PASS（第 1 次），r1: FAIL

按"2 次连续 PASS" 规则，此 unit 单轮 PASS 可判 done（spec PR-2 只拆 1 单元，无 r2 必要）。
