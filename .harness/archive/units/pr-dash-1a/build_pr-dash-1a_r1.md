# Build · PR-DASH-1a · 教师工作台简单文案/删除 r1

> 最小 PR：B1 + B8 + B9 三项纯前端改动（spec.md Block B 拆出的第 1 个）。零 schema、零 API、零 service 改动。

## 改了什么

| # | 文件 | 改动 |
|---|---|---|
| 1 | `components/teacher-dashboard/greeting-header.tsx` | **B1**：删右上 2 个 `Button`（"AI 生成任务" + "新建任务"）；清理 `next/link` / `lucide-react` (Sparkles, Plus) / `@/components/ui/button` 三个 imports（仅 button 用到）；保留 `dateLine` / `todayClassCount` / `pendingGradeCount` / `publishedThisWeek` 四个 props 与 paragraph 渲染（caller 仍传，不破签名） |
| 2 | `components/teacher-dashboard/weak-instances.tsx` | **B8**：L19 `<h2>` 文案 "待分析实例" → "典型实例"。其余样式/数据/排序逻辑零改 |
| 3 | `components/teacher-dashboard/kpi-strip.tsx` | **B9**：grid `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` → `grid-cols-2 md:grid-cols-4`（4 列）；删 "班级均分" `KpiCell`（avgScore/avgScoreDelta 字段保留在 `KpiStripData` interface — 见决策注释）；改 "待批改" → "需审核"，sub 文案 "已全部批改" → "暂无待审核"；改 "待分析实例" → "典型实例" |
| 4 | `tests/pr-dash-1a-text.test.ts` | **新增** 16 个防回归 test：B1（greeting 不再含两按钮 + 不导入 Link/Button/lucide）；B8（weak-instances 改名）；B9（KPI 4 列 + 三处文案 + KpiStripData interface 仍保留 avgScore 字段守护 PerformanceChart 兼容） |

**diff 行数**：~95 行（`-49` greeting / `-1+1` weak / `-23+11` kpi / `+108` 新测试） — 控制在 spec 估算 100-150 内。

## 关键决策

### 为什么 `KpiStripData.avgScore` / `avgScoreDelta` 字段保留？

`buildKpiSummary` 在 `lib/utils/teacher-dashboard-transforms.ts` 仍计算 `avgScore` / `avgScoreDelta`，**dashboard page 把整个 kpi 对象传给 `<PerformanceChart overallAvg={kpi.avgScore} overallDelta={kpi.avgScoreDelta} />`**（`app/teacher/dashboard/page.tsx:226-228`）。

如果删 `KpiStripData.avgScore` 字段会让 page.tsx 的 useMemo return type 与 KpiStrip 不兼容（avgScore 用作 PerformanceChart 输入但又必须从 kpi 中取） — 改全套需要 page.tsx + transforms + PerformanceChart 三方联动，超出"最小 PR"边界（spec 严禁改 transforms.ts 之外的 service 文件）。

**最小修复策略**：KPI **不渲染** avgScore（视觉删了），但 type 字段保留 → PerformanceChart 仍正常显示总均分。这与 spec 用户原话"班级均分跨班级没有意义"完全一致 —— 删的是 KPI 顶部那张大数字卡，**不删**班级表现 widget 内的"平均得分趋势"标题（那是按周展示的 trend，不是跨班级聚合，没有"无意义"问题）。

### 为什么 "需审核" 暂用 `pendingCount` 数据？

spec 原文："当前 schema 可能没有这个状态机，如果没有就**先保留 pendingCount 数据但标签改为'需审核'**，状态机改造作为 D1 防作弊 PR 的一部分"。

`Submission.status` 当前枚举（grep `lib/db.ts` + schema）：`draft | submitted | graded`，**没有** `ai_graded` 中间状态。所以本 PR 仅改 label，不动 service 层 `pendingCount` 计算逻辑（dashboard.service `getDashboardStats` 仍返回 `submitted` 状态计数）。D1 在引入 `releaseMode/releasedAt/status=ai_graded` 时再切换数据源。

注：`buildKpiSummary` 中 `weakInstanceCount` 命名维持（domain 层 "weak" 是 < 60 分实例的语义），**只有 UI label 改名**为"典型实例" — 数据语义不变。

## 严禁改动验证（grep diff）

```
git diff --stat:
 components/teacher-dashboard/greeting-header.tsx | 36 +++--------
 components/teacher-dashboard/kpi-strip.tsx       | 24 ++------
 components/teacher-dashboard/weak-instances.tsx  |  2 +-
 tests/pr-dash-1a-text.test.ts                    | +new
```

- ❌ `app/api/` — 0 改动 ✓
- ❌ `lib/services/` — 0 改动 ✓
- ❌ `prisma/schema.prisma` — 0 改动 ✓
- ❌ runner 组件 — 0 改动 ✓
- ❌ teacher-dashboard 其他子组件（attention-list / performance-chart / today-schedule / activity-feed / ai-suggest-callout）— 0 改动 ✓
- ❌ `lib/utils/teacher-dashboard-transforms.ts` — 0 改动（spec 允许改 buildKpiSummary 但本 PR 没必要）✓

## 验证

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run` | **466 PASS / 0 FAIL**（450 → 466，+16 新增 pr-dash-1a-text）|
| `npm run lint` | **0 errors / 20 warnings**（全部 pre-existing，本 PR 0 引入）|

### 浏览器实测（dev server PID 97364）

| 步骤 | 结果 |
|---|---|
| `POST /api/auth/csrf` → 取 token | ✓ |
| `POST /api/auth/callback/credentials` (teacher1@finsim.edu.cn) | 302 + `authjs.session-token` cookie 落地 |
| `GET /teacher/dashboard` w/ session | **HTTP 200** · 42931 bytes |
| dev chunk grep `.next/dev/static/chunks/_ac3226af._.js` | ✓ 命中：在教班级 / 本周提交 / 需审核 / 典型实例 / 教学工作台<br>✗ 0 命中：AI 生成任务 / 新建任务（greeting 上下文） |
| dev SSR chunk `.next/dev/server/chunks/ssr/_fd26e0af._.js` | ✓ 同上命中集 |

注：`.next/static/chunks/27c382c23cfe0348.js` 仍含老文案（AI 生成任务 / 新建任务 / 待分析任务）— 那是 **prod `npm run build` 历史产物 chunk**（没刷新），dev 加载时不会被使用，dev chunks 已是新版。下次运行 `npm run build` 会自然清理。

### "班级均分" / "待批改" 残留检查

grep 显示这两词在以下文件**仍存在**，但**不在本 PR scope**：
- `components/teacher-dashboard/performance-chart.tsx:61,161` — chart legend "班级均分"（按周趋势，不是跨班级 KPI）
- `components/instance-detail/submissions-tab.tsx:26,34` — submission status badge "待批改"（实例详情页，与 KPI 无关）
- `app/teacher/courses/page.tsx:154` + `components/teacher-courses/teacher-course-card.tsx:166` — 课程卡指标"待批改"（课程列表）
- `app/teacher/instances/[id]/page.tsx:93,336` — instance 详情 "待批改" status label

**B9 spec 限定改 KPI 顶栏**，这些独立组件的"待批改"badge / 课程指标 label 不归本 PR。后续 PR-DASH-2/COURSE-* 可按需统一术语，本 PR 不动以遵守"最小 diff"。

## 不需 dev server 重启

零 schema 改动、零服务端 import 改动，只动 client component。dev server 自动 hot-reload，**无需杀进程重启**。

## 留给 QA 的提示

1. 真浏览器（puppeteer / chrome MCP）打开 `/teacher/dashboard`：
   - 顶部右上**应无**"AI 生成任务" / "新建任务"按钮
   - KPI 区**应是 4 列**（lg 不再 5 列）
   - 第 3 列 label = "需审核"
   - 第 4 列 label = "典型实例"
   - 应**不存在** label "班级均分"
2. 滚动到下方 `<WeakInstances>` section（左栏底部），h2 应是 "典型实例"
3. 老 5KPI 用户用过的浏览器可能还有 SW/cache，做 hard refresh

## Git status（未 commit，按 spec 留给 coordinator）

```
modified:   components/teacher-dashboard/greeting-header.tsx
modified:   components/teacher-dashboard/kpi-strip.tsx
modified:   components/teacher-dashboard/weak-instances.tsx
new file:   tests/pr-dash-1a-text.test.ts
```

## 通知 QA

build 完成 unit `pr-dash-1a` r1，等 QA 真浏览器验证 + 视觉对齐。
