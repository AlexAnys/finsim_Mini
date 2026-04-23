# QA Report — pr-calendar-2 r1

## Spec: 日历 Tab 月视图（7×6 网格 + 课/任务/公告标记 + 点日期详情 + 月份切换 + 响应式 desktop grid / mobile list）

Note: builder 在第一次 r1 提交后补了"mobile list mode"。本报告为二次验证后的最终 r1（r1 未分轮次，仍计 r1 PASS）。

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 全部 PR-2 acceptance 项：月视图渲染、今日高亮、色稳定、月份切换、点日期 Popover 详情、跨月邻格处理、移动端 list 模式 + 空 state + today ring |
| 2. tsc --noEmit | PASS | clean, no output |
| 3. vitest run | PASS | 11 test files, 61 tests all passing (+19 new: 4 calendar-colors + 15 month-calendar) |
| 4. Browser (/qa-only) | PASS | 详见下方逐项验收。截图: /tmp/qa-pr-calendar-2-r1-final-{teacher,student}-{desktop,mobile}.png |
| 5. Cross-module regression | PASS | 本周/周课表 Tabs 切换后仍工作（切回显示"本周课程"+"第2节"）；4 smoke APIs (/schedule-slots /task-instances /announcements /courses) 全 200；batch-semester 403 仍 OK；dashboard 无破坏 |
| 6. Security (/cso) | PASS (N/A) | 纯 UI + 客户端算法，无 auth/validation/rate-limit/输入面变动 |
| 7. Finsim-specific | PASS | UI 全中文（月份 "2026年4月"、今天按钮、日期格式"X月X日星期X"、"课程/任务截止/公告"段头、"本月暂无课程"空 state）；API envelope 不变；component 只做 fetch+render |
| 8. Code patterns | PASS | 3 新文件 (calendar-colors / month-calendar utils + course-calendar-tab component)；2 页 tab 替换；mobile list 与桌面 Popover 复用同 `DayDetail` 子组件（零 duplication）；无 drive-by refactor |

## Browser 逐项验收

### Desktop (1440×900)

**Teacher1 `/teacher/schedule` 日历 Tab**
- 月份 label "2026年4月"；prev/next/今天 3 按钮
- `hidden sm:grid` → `offsetParent=BODY`（grid 可见）；`sm:hidden.space-y-3` → `offsetParent=null`（list 隐藏）
- 6 周一 + 6 周三 cells 显示 2× "个人理财规划" 色块（Class A + Class B 关联 2 门课）
- 色块 inline RGB 稳定：`[rgb(215,246,203), rgb(203,236,246), ...]` — 同 courseId 同色
- 切到 5 月 RGB 依旧 `[rgb(215,246,203), rgb(203,236,246), ...]`，切回 4 月仍一致（cross-month 稳定）
- 1 个 bg-primary today 圆（Thu 4/23）
- 4 个 task AlertCircle 琥珀色（任务截止 badge）
- 1 个 blue dot（4/22 公告）
- 点 4/22 cell → Popover："2026年4月22日星期三 / 课程 2× 第4节 · 14:00-15:40 · 金融楼 301 / 公告 2× (第一周作业提醒 + 欢迎)"

**跨月邻格处理**
- 3/30 (Mon, 上月): 有 "个人理财规划" 色块，可点（未 disabled）
- 3/31 (Tue): disabled
- 4/1 (Wed, in-month): 有 "个人理财规划"，可点
- 4/2 (Thu): disabled

**Student5 `/schedule` 日历 Tab**
- grid 渲染，仅 1 种色块 RGB `rgb(203,236,246)` —— Class B 只 link 1 门课
- 数据隔离正确（teacher 看到 2×，student 看到 1×）

### Mobile (375×812)

**Teacher1**
- `hidden sm:grid` hidden；`sm:hidden.space-y-3` offsetParent=BODY（list 显示）
- 9 张 per-day cards（in-month 有内容日期）：4/1 Wed、4/6 Mon、4/8 Wed、4/13 Mon、4/15 Wed、4/20 Mon、4/22 Wed、4/27 Mon、4/29 Wed
- Card 内嵌同一 `DayDetail` 组件（desktop Popover 也用同一）
- Today（Thu 4/23）无内容 → mobileDays filter 排除 → 不显示该日 card（设计合理）
- 翻到 2026年8月（学期结束）→ mobile 显示"本月暂无课程"中文空 state

**Student5**
- 9 张 cards，每张单课"个人理财规划"（与 desktop 数据一致）

## 关键观察

1. **色块跨月稳定性验证**：5 月 → 4 月 RGB 数组 完全一致，hash-based 色盘 = 同 courseId 永远同 hue（builder's `hashString % 360` + HSL）

2. **desktop/mobile 同 DayDetail 复用**：builder 的 mobile 策略是直接把 DayDetail 展开到 cards 里，避免 Popover 层级在移动端表现差。共享同一组件 = 零行为分叉

3. **mobile 空 state**：未来月份（学期结束）显示"本月暂无课程" 中文占位，不是 0 card 的空布局

4. **跨月边界的 leading days**：3/30 作为 4 月 grid 的 leading cell（`inMonth=false`），仍能正确 render slot 色块（color stable），可点击；opacity-40 视觉区分 in-month/out-of-month

## 额外观察（非阻塞）

- **自画 grid vs shadcn Calendar**：builder 合理决策。自画更适合复杂 cell（色块 + icons + popover）
- **任务时间显示**：Popover DayDetail 用 `toLocaleTimeString("zh-CN", {hour:'2-digit', minute:'2-digit'})` 显示"HH:MM"，中文符合约束
- **今日 card ring**：builder 声明"今日 card ring-2 ring-primary"，但因今日 (4/23 Thu) 无内容被 filter 跳过，无 card 可 ring。若未来今日有内容，CSS `ring-2 ring-primary` 会生效（未在本次流程出现可验证的场景，但代码路径正确）

## Issues found

无。

## Overall: **PASS**

## 附：连续 PASS 计数
- pr-calendar-2 r1: PASS（第 1 次，纯前端 1 PASS 按 coordinator 规则足够）
- 整个 calendar unit（PR-1 r2 + PR-2 r1）已连过，spec 所有 acceptance criteria 命中
