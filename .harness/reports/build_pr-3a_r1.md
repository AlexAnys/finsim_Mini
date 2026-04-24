# Build Report — PR-3A r1

**Unit**: `pr-3a` / `/teacher/dashboard` 重设计
**Round**: r1 (first build)
**Builder**: builder-p3
**Date**: 2026-04-24

## Scope

按 `.harness/mockups/design/teacher-dashboard.jsx` 完整落地教师 dashboard，对齐 Phase 2 学生端的设计语言（token、组件样式、卡片比例）。零 schema / API / auth 改动，严格走降级策略。

## Files changed

### 新建

- `lib/utils/teacher-dashboard-transforms.ts` — 纯函数工具层：`buildKpiSummary / buildAttentionItems / buildWeakInstances / buildTodaySchedule / buildActivityFeed / buildClassPerformance / buildWeeklyTrend / startOfWeek / buildDateLine`
- `tests/teacher-dashboard-transforms.test.ts` — 17 个单元测试
- `components/teacher-dashboard/greeting-header.tsx` — 顶部问候 + 2 action（AI 生成任务 / 新建任务）
- `components/teacher-dashboard/kpi-strip.tsx` — 5 KPI 卡（在教班级 / 本周提交 / 待批改 / 班级均分 / 待分析实例）
- `components/teacher-dashboard/attention-list.tsx` — "需要你关注" 清单（4 项，首项 urgent 时 3px 琥珀左边框）
- `components/teacher-dashboard/performance-chart.tsx` — 班级均分列表 + 8 周 SVG 折线+柱状图
- `components/teacher-dashboard/weak-instances.tsx` — 待分析实例 top 3（降级文案）
- `components/teacher-dashboard/today-schedule.tsx` — 今日课表卡
- `components/teacher-dashboard/activity-feed.tsx` — 动态流
- `components/teacher-dashboard/ai-suggest-callout.tsx` — 深色 ink-2 AI 建议卡（Risk A 方案）

### 改写

- `app/teacher/dashboard/page.tsx` — 全量 JSX 重写；旧版 timeline/filter-tabs 完全替换；数据从 `/api/lms/dashboard/summary` 不变，所有聚合在前端。

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS（0 errors） |
| `npx vitest run` | PASS 136/136（原 119 + 17 新增 transforms 测试） |
| `npm run build` | PASS（25 routes emit；dashboard 是 ƒ 动态路由） |
| `curl http://localhost:3000/teacher/dashboard` | HTTP 200 · 38 414 bytes SSR shell |
| `GET /api/lms/dashboard/summary` with teacher1 session | 200 JSON 真数据（courses / taskInstances / stats / scheduleSlots 等字段齐全） |
| 旧文件删除 | `仪表盘` 字样仅存于侧边栏导航（未改），新 header `教学工作台` client-render 命中 |

## Risk decisions taken

**AI 建议卡（spec Risks A vs B）**：选 A（深色 ink-2 卡仍在，但降级为入口占位）。理由：保留设计师视觉张力，且"打开 AI 助手"按钮跳 `/teacher/ai-assistant`（已存在路由）+ "查看洞察"按钮跳 `/teacher/analytics`（已存在路由），两个入口都是真可用，不是死链。

**薄弱概念降级（设计师 C2 决策）**：完全采纳，"学生薄弱概念" → "待分析实例"，按钮文案从"生成讲解"改为"查看洞察"（跳 `/teacher/instances/{id}/insights`，该路由确认存在）。错误率用 `100 - analytics.avgScore` 近似，错答人数用 `submissionCount × errorRate / 100` 估算，排除 `submissionCount = 0` 的实例。

**KPI "薄弱概念"**：沿用降级思路，显示为"待分析实例"数量（avgScore < 60 的实例计数），tone 仍是 danger 红。

**8 周趋势**：完全前端聚合 `recentSubmissions`（API 最多返回 10 条，这是 spec 里提到的已知限制——如果 QA 发现图表太稀疏，可在 r2 补 fetch 一次 `?pageSize=100`，但当前 r1 先走现有数据不打扰 API）。

**多教师 / 多班级**：沿用 Phase 1 PR-1B 的 `assertCourseAccess`；`KpiStrip` 的 classCount 从 `courses[i].class.id` 和 `courses[i].classes[].class.id` 聚合去重；`studentCount` 用 `max(class._count.students)` 作为指示值（不是严格总数，避免多班场景虚高）。

## Component / data flow

```
app/teacher/dashboard/page.tsx
├─ fetch /api/lms/dashboard/summary  (不变)
├─ useMemo buildKpiSummary ──┐
├─ useMemo buildAttentionItems ──┐
├─ useMemo buildWeakInstances ──┤
├─ useMemo buildClassPerformance ──┼─→ 渲染
├─ useMemo buildWeeklyTrend ──┤
├─ useMemo buildTodaySchedule ──┤
└─ useMemo buildActivityFeed ──┘
```

所有 transforms 是纯函数，有 17 个单测覆盖 core edge cases（空数组 / null 分数 / 过期实例 / 多班级 / 多课程 / inProgress 判定等）。

## Dev server

**无需重启**。只改 frontend（`app/teacher/dashboard` + `components/teacher-dashboard/*` + `lib/utils/teacher-dashboard-transforms.ts`），无 schema 变更 / 无 Prisma client 变更 / 无 API route 变更。已 live probe HTTP 200。

## Deferred / uncertain

1. **KPI `submittedDelta`**（"+12" 的周环比数字）：当前传 `null`，`/api/lms/dashboard/summary` 只返回最近 10 条 submissions，不足以做同比差计算。如果 QA 觉得必须有这个数字，下一轮需要 fetch 第二次 API（带 `?pageSize=200&last=14days`）。暂定 r1 隐藏。
2. **时间 Tab "本周/本月/学期"**：当前 UI 渲染但未接交互（只"本周"态亮着）。spec 没有要求 interactive；设计稿也没写行为。如需实现，r2 补一个小 state + re-compute（都是纯前端）。
3. **Today 课表里的 "班级" 字段**：当前从 `course.classes[0].name` 取，多班级只显第一个。多教师/多班级场景下更完整的展示留在 PR-3B（课程列表页）做统一。
4. **NaN防御**：transforms 里 `Number.isFinite` 全程守护，但若后端某天返回非法字符串（破坏性 schema 变更），UI 会 graceful 显示 "—"。

## Notes for QA

- 关键路径：`teacher1` / `teacher2` 分别登录 `/teacher/dashboard`，对比真数据能否命中 KPI / 清单 / 图表 / 课表。
- 多教师场景：teacher2 应只看到自己的课程（PR-1B 的 `assertCourseAccess` 依然守护 `/api/lms/dashboard/summary` 返回）。
- 视觉：375px mobile KPI 2 列堆叠、"需要你关注" 的进度条在 sm: 以下隐藏（保留 "查看" 按钮）、动态流 + 今日课表正确顺序。
- 无硬编码 Tailwind 色：全部 token 化（`bg-brand / text-warn / bg-sim-soft / bg-ochre / bg-ink-2` 等）。
- 链接目标：AI 助手 `/teacher/ai-assistant`、新建任务 `/teacher/tasks/new`、全部任务 `/teacher/tasks`、待分析实例 `/teacher/instances/{id}/insights`、AI 建议查看洞察 `/teacher/analytics` — 全部是已存在路由。

## Summary

PR-3A 按 spec 完整落地，零 schema / API / auth 改动。9 个新组件 + 1 transforms util + 17 新 tests（119 → 136）。tsc / vitest / build 三绿。设计稿对齐到 header + 5 KPI + 左栏 3 块 + 右栏 3 块 的完整结构。
