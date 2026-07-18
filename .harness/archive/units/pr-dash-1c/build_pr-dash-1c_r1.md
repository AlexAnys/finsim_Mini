# Build Report — PR-DASH-1c r1

**Date**: 2026-04-26
**Scope**: Phase 8 教师工作台 Block B 第 3 个 PR — B5（任务列表 + filter + 时间线）+ B6（任务卡片重做）
**Branch base**: main HEAD = 72f9eb1（PR-DASH-1a / 1b / PR-SIM-4 已落）

## 改动总览

4 个文件改动 + 1 新增测试文件 + 1 测试增量。约 410 行 diff（净增）。

| 文件 | 类型 | 行变化（约） |
|---|---|---|
| `lib/utils/teacher-dashboard-transforms.ts` | 修改（新增 4 export + 2 const map） | +180 / -1 |
| `components/teacher-dashboard/attention-list.tsx` | 重写（B5 头部/filter/分组 + B6 卡片重做） | +280 / -120 |
| `app/teacher/dashboard/page.tsx` | 修改（state + 新 transform 调用 + AttentionList props） | +20 / -4 |
| `tests/teacher-dashboard-transforms.test.ts` | 增量（+12 cases for new transforms） | +200 / -2 |
| `tests/pr-dash-1c-text.test.ts` | 新增 | +148 / -0 |

## 改动细节

### B5 · "需要你关注" → "任务列表" + filter + 时间线滚动

**新增 transform 函数（`teacher-dashboard-transforms.ts`）**：

1. `buildTaskTimelineItems(taskInstances, filters, now)` — 任务时间线主转换：
   - 仅 `status === "published"` 的实例。
   - 过滤 `filters.courseId` / `filters.taskType`（任一空值表示不过滤）。
   - 按 `dueAt` 升序，加 `group: "overdue" | "today" | "thisWeek" | "nextWeek" | "later"`（基于本地时区今天 00:00 / 本周日 23:59:59 / 下周日 23:59:59 边界算）。
   - 排序：先按 group 顺序（overdue 最先），再 dueAt 升序。
   - **不再 cap 到 4 条**（B5 spec 要求滚动列表，全量返回 published）。

2. `buildCourseFilterOptions(taskInstances)` — 抽 published 实例上挂的 course 去重 + 按中文 locale 排序。

3. 类型导出：`TaskTimelineItem`（带 chapterTitle / sectionTitle / slot / completionRate / avgScore）/ `TaskTimelineFilters`（`courseId?` / `taskType?`）/ `CourseFilterOption`。

4. 标签 const map（避免组件硬编码）：
   - `TASK_TIMELINE_GROUP_LABEL`：5 档分组 → 中文（已过期 / 今天 / 本周 / 下周 / 之后）
   - `TASK_SLOT_POSITION_LABEL`：3 档 SlotType → 中文（课前 / 课中 / 课后）

5. `buildAttentionItems` 保留（向后兼容；现有 `tests/teacher-dashboard-transforms.test.ts` describe-block 仍跑）。它的 caller 只有 page.tsx，已切换；但 export 保留 — 删除属 surface 改动，本 PR 不动。

**`attention-list.tsx` 重写**（不改文件名，组件名仍 `AttentionList` — 保持 caller 文件级别引用稳定）：

- **新 Props**：`items: TaskTimelineItem[]` + `courseOptions: CourseFilterOption[]` + `filters: TaskTimelineFilters` + `onFiltersChange: (next) => void`（受控）。
- **header**：仅 h2 "任务列表" + 右侧 "回到当天" Button（CalendarDays icon），不再渲染右上 "全部任务" link 或 4 数字 Badge。
- **filter bar**：
  - 课程 Select（`@/components/ui/select`），`__all__` sentinel = "全部课程"。
  - 任务类型 chip 组（4 个 button 含 全部/测验/模拟/主观），`role="radiogroup"` + `role="radio"` + `aria-checked`，活跃状态用 `bg-brand-soft text-brand` 区分。
  - "回到当天" 按钮：disabled 当无 `today` 分组时；点击时 scrollTo today anchor + 短暂 brand 高亮 pulse。
- **滚动列表**：`max-h-[500px] overflow-y-auto`；按 group 内联分组渲染，分组 sticky header（`sticky top-0`）显示分组名 + 计数（如 "已过期 · 3"）。
- **空状态**：filter 后无结果 → "暂无符合条件的任务"。

### B6 · 任务卡片重做（`TaskCard` sub-component）

**保留**：左侧 9px×9px 类型 icon block + 类型 Badge + dueInfo Badge + 标题 + 课程·班级 line。

**新增**：
- 章节信息：班级名后续 "· {chapterTitle} · {sectionTitle}"（filter Boolean 拼接，单端缺失自动忽略）。
- Slot Badge："课前 / 课中 / 课后"（`TaskInstance.slot` 字段，paper-alt 浅底）。
- 完成度区块（卡片下半部）：`<progressbar>` + "完成度 N%" + "(已交/班级)"。tone 阶梯：≥80 success / ≥50 brand / 其他 warn。
- 平均分：右下显示 "均分 78.5"（fs-num font-semibold） / 没数据时 "暂无均分"（ink-5 dim）。
- 右侧动作按钮列（sm 视口起垂直 stack）：
  - **测试**（Sparkles icon, outline）：`toast.info("模拟学生功能即将上线") + console.log({instanceId, taskType})`，事件 `stopPropagation` 防触发卡片整体导航。P3 真实实现的占位。
  - **管理**（Settings icon, default）：导航到 `/teacher/instances/${id}`（同旧 "查看" 目标，仅文案 + 视觉变 — anti-regression：仍是 same href）。

**整张卡可点击**：
- `role="button" tabIndex={0}` + `onClick={navigate}` + `onKeyDown` 处理 Enter/Space。
- `cursor-pointer` + hover 状态：`hover:border-brand/40 hover:shadow-md`。
- focus-visible 蓝色环：`focus-visible:ring-2 focus-visible:ring-brand/40`。
- 内部按钮 (测试/管理) 都 `e.stopPropagation()` 阻止双触发。
- 已过期：保留 PR-DASH-1a 的 `border-l-warn` 强调（不删除该视觉提示）。

**移除**（按 spec "中间一条线 (用户说不需要)"）：
- 旧 desktop-only 中间装饰列 `<div className="hidden w-[150px] shrink-0 ...">`（含 progress bar + "0/5" 数字短行）— 全部删，组件不再有 `w-[150px]` 类名。
- 替为卡片底部完成度行（`grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]` 的 progress + 均分布局）。

### dashboard/page.tsx 集成

- 删 `import { buildAttentionItems }`。
- 新增 `import { buildTaskTimelineItems, buildCourseFilterOptions, type TaskTimelineFilters }`。
- 新增 `useState<TaskTimelineFilters>({ courseId: null, taskType: null })`。
- 新增 `useMemo(courseFilterOptions)` + `useMemo(taskTimelineItems)`。
- `<AttentionList />` 接 4 props（items / courseOptions / filters / onFiltersChange）。
- 不动其他 useMemo（kpi / weakInstances / classPerf / weeklyTrend / upcomingSlots / activityItems）。

## Service 层 / Schema

**零改动**。

`lib/services/dashboard.service.ts` 已经 include 了 `chapter / section / analytics`（PR-DASH-1b 之前的工作），并且 `TaskInstance.slot` 是直接顶层字段（model TaskInstance line 439 in schema）— 默认就出现在 `findMany` 返回里，不需要 select/include。所以本 PR **未改任何 Service 层 + 未改 Prisma schema**。

→ 不需要 Prisma 三步、不需要 dev server 重启。

## 验证

### 静态检查

- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors / 21 pre-existing warnings（与 main 完全一致，无新增）
- `npm run build` — Compiled successfully in 3.8s，25 routes 全过
- `npx vitest run` — 535 PASS（499 → 535，+36 新测试）

### 测试细分

- `tests/teacher-dashboard-transforms.test.ts` 23 → 35 cases（+12）：
  - `buildCourseFilterOptions` × 2（去重 + null-safe）
  - `buildTaskTimelineItems` × 8（5 group 分类 / courseId filter / taskType filter / draft 排除 / 字段计算 / avgScore null 边界 / slot 兜底 / 不 cap 到 4）
  - 标签 map × 2（5 group 中文 + 3 slot 中文）
- `tests/pr-dash-1c-text.test.ts` 24 cases（新文件）：
  - B5 头部 + filter bar 6 cases（任务列表 / no badge count / 全部课程 / chip 4 个 / 回到当天 / 滚动）
  - B6 卡片 8 cases（完成度 / 均分 / 测试 / 管理 / 整卡 click / w-[150px] 删除 / Sparkles+Settings icon / 章节 + slot label）
  - transforms 5 cases（4 export + buildAttentionItems 保留）
  - dashboard/page.tsx 3 cases（import 切换 + props 传递）

### 真数据 API E2E

```
# 登录 teacher1@finsim.edu.cn → cookie 拿到 authjs.session-token
curl -s -b /tmp/cookie.txt http://localhost:3000/api/lms/dashboard/summary
# → HTTP 200, taskInstances: 11
# → 第一个 instance: chapter={id, title:"理财基础概念"}, section={id, title:"什么是个人理财"}, slot:"pre"
# → 验证 dashboard.service include 已经出 chapter/section（PR-DASH-1b 已加）+ slot 是 TaskInstance 顶层字段自然返回
```

```
# SSR /teacher/dashboard
curl -b /tmp/cookie.txt http://localhost:3000/teacher/dashboard
# → HTTP 200（loading skeleton — page 是 client component，正常）
```

### chunks grep 真验

```
✅ '任务列表'        = 35 files（含 .next/static + .next/server）
✅ '回到当天'        = 5 files
✅ '完成度'          = 10 files
✅ '暂无均分'        = 5 files
✅ '模拟学生功能即将上线' = 5 files
✅ '管理'            = 118 files
✅ '课前 / 课中 / 课后' = 66/66/71 files
✅ TaskTimelineItem  = 4 files
✅ TASK_SLOT_POSITION_LABEL = 4 files
⚠ '需要你关注'       = 0 files（在 .next/static + .next/server）
                       4 stale dev HMR cache files（.next/dev/）— 不影响生产，turbopack incremental dev 副产物
```

### Anti-Regression

- ✅ `buildAttentionItems` 保留 + 现有 2 个 describe-block tests 全过（teacher-dashboard-transforms 35 cases，原 23 + 新 12）
- ✅ Phase 8 PR-DASH-1a/1b 守护 tests 全过：
  - `pr-dash-1a-text.test.ts` 16 cases（B1/B8/B9 文案/布局守护）— 全过
  - `pr-dash-1b-text.test.ts` 18 cases（B2 chip + B4 近期课表）— 全过
- ✅ KpiStrip / WeakInstances / TodaySchedule / PerformanceChart / ActivityFeed / GreetingHeader / AiSuggestCallout 零改动
- ✅ Service 层 / Prisma schema 零改动 → 不动 dev server
- ✅ 旧"管理"按钮 onClick 跳的 href（`/teacher/instances/${id}`）与旧 "查看" link 一致 — 路由零变化

## 我担心的点 / 留 QA 验

1. **真浏览器视觉**：当前 session 没有 Chrome MCP / preview MCP 工具，结构层 grep + curl + tsc + lint + build + 535 tests 都过，但 spec 要求 "preview screenshot 真验"。建议 QA 用 `/qa-only` 加载 `/teacher/dashboard`：
   - filter bar 视觉对齐（Select + chip + 回到当天 button）
   - 卡片 hover/focus 动画
   - "测试" 按钮点击触发 toast.info
   - filter 切换后列表实时刷新
   - 滚动 + 回到当天行为
   - sm 视口下右侧动作按钮列叠加（`hidden ... sm:flex`）
2. **种子数据 analytics 全 null**：seed 库里 11 条 published 实例中，`analytics.avgScore` 全是 null（`/api/lms/dashboard/summary` 返回首条 `analytics: None`），所以浏览器实测均分会全显示 "暂无均分" — 这是**数据状态**而非 bug。如果 QA 想看到均分渲染，需要先批改一份 submission（Phase 5 e2e flow 已存在）。
3. **过滤后空态文案**："暂无符合条件的任务" — 是合并的"完全无任务" + "filter 把所有过滤掉了"两情况。如果产品想区分（例如"清除筛选"按钮），可后续 PR 增量。本 PR 按 spec 不引入。
4. **stale dev chunk**：4 个 `.next/dev/` 缓存仍含 "需要你关注" — turbopack HMR 副产物。`npm run build` 出的 `.next/static + .next/server` 干净。
5. **草稿任务**：`buildTaskTimelineItems` 仍 filter 出 `status !== "published"` 的实例（与 `buildAttentionItems` 一致）。spec L65-66 "时间线排列上面加一些 filter" 没明确说要不要展示 draft，按现有 dashboard 语义（教师工作台展示已派发的任务）保持 published-only。如果产品要 draft 也显示，是单独需求。

## 不需要重启 dev server

零 Prisma schema 改动 + 零 service 改动；turbopack HMR 自动 reload UI。

## 下一步

- coordinator 通知 qa：`Build done for unit pr-dash-1c r1, report at .harness/reports/build_pr-dash-1c_r1.md`
- 不 commit / push（coordinator 决策）
