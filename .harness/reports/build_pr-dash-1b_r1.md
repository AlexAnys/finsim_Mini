# Build Report — PR-DASH-1b r1

**Date**: 2026-04-26
**Scope**: Phase 8 教师工作台 Block B 第 2 个 PR — B2（AI 助手挪到右上）+ B4（今日课表→近期课表）
**Branch base**: main HEAD = 2462abf（PR-DASH-1a 已落 + PR-SIM-4 codex 已落）

## 改动总览

5 个文件改动 + 1 新增 + 1 测试新增 + 1 测试增量。约 320 行 diff。

| 文件 | 类型 | 行变化 |
|---|---|---|
| `lib/services/dashboard.service.ts` | 修改（additive include） | +9 / -1 |
| `lib/utils/teacher-dashboard-transforms.ts` | 修改（B4 新函数 + B4 兼容） | +130 / -1 |
| `components/teacher-dashboard/ai-suggest-callout.tsx` | 修改（B2 加 variant） | +27 / -2 |
| `components/teacher-dashboard/greeting-header.tsx` | 修改（B2 渲染 chip） | +6 / -0 |
| `components/teacher-dashboard/today-schedule.tsx` | 重写（B4 改名 + 适配 upcoming 类型） | +50 / -32 |
| `app/teacher/dashboard/page.tsx` | 修改（B2 删大卡 + B4 调用换函数） | +6 / -22 |
| `tests/teacher-dashboard-transforms.test.ts` | 增量（+6 cases for buildUpcomingSchedule） | +156 / -1 |
| `tests/pr-dash-1b-text.test.ts` | 新增 | +119 / -0 |

## 改动细节

### B2 · AiSuggestCallout 挪到右上（GreetingHeader 内）

**实现路径**：

1. `ai-suggest-callout.tsx` 加 `variant?: "callout" | "header-chip"` prop（默认 `"callout"` 保持向后兼容）。
   - `header-chip` 变体：圆角 pill（rounded-full）+ 紧凑布局：bg-paper-alt + 左侧 brand-soft 背景小圆 Sparkles 图标 + "AI 助手 · 本周建议" 文字 + 右侧 brand 背景的"一周洞察"按钮（含 ArrowRight 箭头）。
   - 文案：`查看洞察` → `一周洞察`（两个 variant 都改）。
   - 大卡 variant 保留所有原有行为（本 PR 不删，未来其他 caller 可能复用）。

2. `greeting-header.tsx` 内 import + 渲染 `<AiSuggestCallout variant="header-chip" />`，放在 `md:flex-row md:items-end md:justify-between` 容器右侧 shrink-0 区域。
   - 不动 props 接口（仍是 4 个 prop）。
   - PR-DASH-1a 删的两按钮位置正好被 chip 占位。

3. `dashboard/page.tsx` 删 `import AiSuggestCallout` + 删右下渲染。原右下空位由 ActivityFeed 自然下沉填充。

**视觉适配**：chip 高度约 36px，颜色克制（paper-alt + 小图标 + 单按钮），不抢 GreetingHeader 视觉焦点。

### B4 · 今日课表 → 近期课表

**新增 `buildUpcomingSchedule(slots, count, now)`**（`teacher-dashboard-transforms.ts` 第 304-477 行）：

- 算法：每条 slot 在未来 14 天 horizon 内查找下一次发生（基于 `dayOfWeek` 匹配 + `weekType` 约束 + 学期 `[startWeek, endWeek]` 范围 + `semesterStartDate` 计算具体周）。
- 候选条目 (date asc, startTime asc) 排序，取前 `count` 条。
- 今天的时段如果 `endTime` 已过（即课已结束），跳过这条 slot 当天的发生（防显示已结束课）。
- 返回类型 `TeacherUpcomingSlot`：包含 `date / dateLabel / weekdayLabel / startTime / className / classroom / isToday / inProgress / courseTitle`。
- **保留** `buildTodaySchedule` 不动（spec 提到"如有 dependency 在其他地方用，请保留旧函数"），但 `dashboard/page.tsx` 不再调用它。

**`today-schedule.tsx` 重写**：

- h2 文案：`今日课表` → `近期课表`。
- props：去 `dayLabel`，仅保留 `slots`（类型 `TeacherUpcomingSlot[]`）。
- 卡片每行：左侧 58px 列显示 `dateLabel`（4/26）+ `weekdayLabel`（周日），右侧显示 `courseTitle` + `startTime · className · classroom` 一行。
- Badge 增量：`isToday && !inProgress` 显示"今天"badge（brand-soft 配色），`inProgress` 仍显示"进行中"。

**`dashboard/page.tsx` 改动**：

- 删 `WEEKDAY_LABELS` 常量（不再需要算 todayLabel）。
- 删 `isSlotActiveForWeek` import（buildUpcomingSchedule 内部自己处理 weekType 约束）。
- `useMemo todaySlots` → `useMemo upcomingSlots`（4 条），调用 `buildUpcomingSchedule(scheduleSlots, 4)`。
- `todayClassCount = upcomingSlots.filter(s => s.isToday).length` 用于 GreetingHeader meta line（保持原行为：今日 N 节课）。

### Service 层 1 行 additive（justified）

`dashboard.service.ts` ScheduleSlot include 加 `course.class.name`：

```ts
include: {
  course: {
    select: {
      id: true,                 // 新加：作为 courseId 显式
      courseTitle: true,
      classId: true,
      semesterStartDate: true,
      class: { select: { name: true } },  // 新加：班级名（B4 spec 必需）
    },
  },
}
```

**理由**：B4 spec 明确要求班级名显示（"班级（金融2024A）"）。学生端 dashboard.service.ts 已用相同 pattern（line 117）；schedule.service.ts 也用相同 pattern。本改动是 100% additive include，无 caller 签名变化。

**验证**：真 curl `/api/lms/dashboard/summary`（teacher1 cookie）拿到的 first slot 携带 `course.class.name = "金融2024A班"`，PR-DASH-1b 的 buildUpcomingSchedule 通过 `slot.course?.class?.name` 拿到（fallback 到老 `slot.course?.classes?.[0]?.name` 路径以防其他场景兼容）。

### 不在 scope 内的"查看洞察"

`weak-instances.tsx` 第 65 行还有"查看洞察"按钮（典型实例卡片右侧 link → /teacher/instances/{id}/insights）。本 PR **不动**，因为：
- spec B2 明确针对 AiSuggestCallout 文案，不涉及 weak-instances
- weak-instances 改动属于 B6 卡片重做（下一个 PR）
- 测试已限定为 `aiCallout` 文件级别（不会误判）

## 验证

### 静态检查

```
✅ npx tsc --noEmit       — 0 errors
✅ npm run lint            — 0 errors / 20 pre-existing warnings（同 PR-DASH-1a 一致）
✅ npm run build           — 25 routes 全过
✅ npx vitest run          — 490 PASS（466→490，+24 新测试）
```

新测试细分：
- `tests/pr-dash-1b-text.test.ts` — 18 cases（B2/B4 文案 + 布局守护）
- `tests/teacher-dashboard-transforms.test.ts` — +6 cases（buildUpcomingSchedule 行为）

### 真数据 API E2E

```bash
# Login teacher1 → cookie
curl -c .cookie -X POST http://localhost:3000/api/auth/callback/credentials \
  -d "csrfToken=...&email=teacher1@finsim.edu.cn&password=password123&redirect=false&json=true"
# → HTTP 302（成功登录）

# Dashboard SSR
curl -b .cookie http://localhost:3000/teacher/dashboard
# → HTTP 200

# Dashboard API（验证 class.name 增量 include）
curl -b .cookie http://localhost:3000/api/lms/dashboard/summary
# → HTTP 200, scheduleSlots[0].course.class.name = "金融2024A班"
```

### 真 chunk 验证（dev mode）

```
✅ '近期课表'         = 1 hits（在 dashboard chunk _7c86d856._.js）
✅ '一周洞察'         = 4 hits（chip + callout 两 variant 各落到 chunk）
✅ '本周建议'         = 4 hits（chip + callout 两 variant）
✅ '教学工作台'       = 2 hits（greeting-header）
✅ 'header-chip'      = 3 hits（变体字符串 + Tailwind class 名 + 实际 jsx 渲染）
⚠ '今日课表'          = 1 hit（**stale chunk** _ac3226af._.js — 不被 dashboard 引用，dashboard 只引用 _7c86d856._.js）
⚠ '查看洞察'          = 2 hits（属 weak-instances 范围，本 PR 不动）
```

`/tmp/dash-final.html` HTML 中：
- 引用 `_7c86d856._.js`（新 chunk，含"近期课表"）= 1 hits
- 引用 `_ac3226af._.js`（stale chunk，含"今日课表"）= 0 hits ✅

→ 实际渲染时浏览器只加载新 chunk，stale chunk 是 turbopack incremental dev 副产物，不影响用户视觉。

### Anti-Regression

- ✅ `buildTodaySchedule` 函数保留 + 现有测试全过（teacher-dashboard-transforms.test.ts 23 cases，原 17 + 新 6）。
- ✅ `KpiStrip` / `AttentionList` / `PerformanceChart` / `WeakInstances` / `ActivityFeed` 零改动（PR-DASH-1a 守护链路保留）。
- ✅ `pr-dash-1a-text.test.ts` 16 cases 全过（B1/B8/B9 守护无破坏）。
- ✅ Service 层只动 `dashboard.service.ts` ScheduleSlot include（additive，无签名变化），**仅 1 caller**（teacher dashboard）受影响 + 学生 dashboard 同 pattern 已存在。
- ✅ Prisma schema 零改动 → 不需要 Prisma 三步 / dev server 重启。

## 不确定 / 留给 QA 检验

1. **真浏览器视觉**：dev chunk grep + API SSR 已确认结构正确，但 Phase 8 视觉细节（chip 与 GreetingHeader 视觉对齐 / 在 md 视口下不挤压 / mobile 下 stack 是否合理）建议 QA 用 `/qa-only` 真浏览器截图验收。
2. **mobile 视口**：GreetingHeader 在 `md:flex-row` 下右侧渲染 chip，sm 视口（< md）会 stack 到下方。chip 在 sm 视口的视觉是否合适未真机验证。
3. **实际数据**：种子库 4 条 slots 全是周一/周三，今天周日（4/26）→ buildUpcomingSchedule 应输出 4 条（未来 4/27 周一 ×2 + 4/29 周三 ×2 — 实际由于 slot 重复，dedupe 后可能 ≤4，按当前算法每条 slot 仅取最近 1 occurrence，因此实际 4 条）。
4. **stale chunk**：dev mode 副产物，不影响功能。生产 build 已验证 25 routes 编译通过。

## 不需要重启 dev server

本 PR 零 Prisma schema 改动；`lib/services/dashboard.service.ts` include 增量 turbopack HMR 自动 reload。

## 下一步

- coordinator 通知 qa：`Build done for unit pr-dash-1b r1, report at .harness/reports/build_pr-dash-1b_r1.md`
- 不 commit / push（coordinator 来做）
