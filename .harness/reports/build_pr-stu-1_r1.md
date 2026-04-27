# Build Report — PR-STU-1 r1

> Block E E1 · 学生 /grades 重布局（按 mockup `.harness/mockups/design/student-grades.jsx`）

## 改动文件

| 文件 | 行数 | 类型 |
|---|---|---|
| `app/(student)/grades/page.tsx` | 332 → **214** | 重写 |
| `lib/utils/grades-transforms.ts` | **+208** | 新建（pure data util） |
| `components/grades/grades-hero.tsx` | **+126** | 新建 |
| `components/grades/grades-tabs.tsx` | **+45** | 新建 |
| `components/grades/submission-row.tsx` | **+162** | 新建 |
| `components/grades/evaluation-panel.tsx` | **+260** | 新建 |
| `tests/pr-stu-1-grades.test.ts` | **+253**（24 test） | 新建 |

总计 **7 文件，+1268 / -332**。

## 实现要点

### 视觉重做（mockup 对照）

- **Hero · 1fr + 2fr grid**：
  - 左 · 深靛底卡（`bg-brand`）+ 暖赭径向渐变装饰；52pt 平均分 + "学期目标 90 · 还差 N 分"提示
  - 右 · 三类柱状卡（模拟/测验/主观），列间 `border-line-2` 隔线，每列含 dot chip + 34pt 平均 + 5 槽 mini bar（最近一次用对应 token 色 highlight）
- **列表 · 1.4fr + 1fr grid**：
  - 左 · `GradesTabs`（4 tab，selected `bg-ink text-white` + 计数徽章 + 右侧"按提交时间降序"提示）+ `SubmissionRow` × N
  - 右 · `EvaluationPanel`（header 含 type chip + 实例标题 + 分数大字 + progress bar + 批改时间；body 含 AI 评语暖赭底卡 + rubric 4 维度 / quiz 题目明细）
- **行选中态**：`bg-paper-alt` + 左 3px `bg-brand` 条 + paddingLeft 视觉对齐
- **课程 tag 色**：复用 `lib/design/tokens.ts` `courseColorForId`（tagA-F 6 色稳定 hash），courseId 缺失时退化到 taskInstanceId 保稳定
- **分数色**：`scoreTone` 映射 success/primary/warn/danger/muted 5 档（>=90/>=75/>=60/<60/null）

### 数据流（不动 schema/API/service）

- **GET /api/submissions?pageSize=100** ← 现有端点（含后端透传 `analysisStatus` / `releasedAt`）
- **GET /api/lms/dashboard/summary** ← 现有端点，从 `tasks[].course.{id,courseTitle}` 客户端 join 拿课程名 + courseId
- 两端点并行 fetch；dashboard 失败不阻塞列表（fallback 到 `courseName=null`，UI 优雅退化不渲染 tag chip）

### D1 防作弊保留（PR-SIM-1c）

- `joinSubmissions` 内部走 `deriveAnalysisStatus` 兜底（与 service 同步）
- `filterReleased` 仅留 `analysisStatus === "released" && score !== null`
- `buildHeaderStats` / `buildByTypeStats` 平均分聚合**仅基于 released**
- `SubmissionRow` 3 档 chip：
  - `pending` → "等待 AI 分析"（`bg-paper-alt` + `text-ink-4`）
  - `analyzed_unreleased` → "已分析 · 等待教师公布"（`bg-ochre/10` + `text-ochre`）
  - `released` → 真实分数（5 档 token 色）+ trend 同类型对比
- `EvaluationPanel` 仅 `isReleased` 时渲染 feedback / rubric / quizBreakdown；其它两态走 chip + 等待文案
- `buildTrendMap` 仅对 released 行返回数字 — pending / analyzed_unreleased 一律 null（防泄漏对比信息）
- `page.tsx` 显式守护 `releasedSubmissions` + `ensureStatus` + `isReleased && sub.evaluation` 标记，与 PR-SIM-1c test 断言对齐

## Token 体系

零硬编码色：

- 装饰光晕用 `var(--fs-accent)` CSS var（grade-hero 暖赭径向）
- AI 评语左条用 `var(--fs-accent)` CSS var
- 其它一律 token Tailwind class（`bg-brand` / `bg-paper` / `text-ink-4` / `bg-tag-a` / `bg-sim-soft` 等）
- `text-blue-600` / `#xxxxxx` 等老硬编码 0 处（test grep 守护通过）

## 验证结果

| 验证项 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors / 21 warnings（全 pre-existing） |
| `npx vitest run` | **670 PASS** / 0 fail（基线 ~624 + 24 新 + 其他 routine refresh） |
| `npm run build` | **25 routes**，5.3s |
| `curl /login` | 200 |
| `curl /grades`（student1 cookie） | 200，42KB SSR shell |
| `curl /api/lms/dashboard/summary` | 200，11 published tasks 含 `course.courseTitle` 命中 |
| `curl /api/submissions?pageSize=100` | 200，items=0（DB 真实空态，全库 Submission count=0；预期由 QA 用真账户造提交后验证） |
| Prod chunk grep | `ee44c69f44498017.js` 命中 13 条 mockup 文案：成绩档案/我的成绩/本学期平均/学期目标/等待 AI 分析/已分析 · 等待教师公布/按提交时间降序/AI 评语/评分明细/题目明细/近 5 次/AI 已分析完毕/AI 分析中 |

### 测试矩阵

新增 `tests/pr-stu-1-grades.test.ts`（24 cases）：

- `computePercent` × 3（基本 / null / div-by-zero）
- `scoreTone` × 1（5 档边界）
- `filterReleased` + `buildHeaderStats` × 3（D1 防作弊聚合）
- `buildByTypeStats` × 2（3 类 + 时间序）
- `buildTabCounts` + `filterByTab` × 3
- `buildTrendMap` × 3（同类型 / 跨类型 / pending 防泄漏）
- `joinSubmissions` × 3（命中 / 未命中 / 全空）
- UI 文件守护 grep × 6（page.tsx 4 子组件 import + Hero 视觉锚点 + Row D1 chip + Panel 暖赭底 + Tabs 文案 + 0 硬编码色）

## Anti-regression check

- `lib/services/submission.service.ts` getSubmissions include 不动（spec 严禁）
- `lib/services/dashboard.service.ts` getStudentDashboard 不动（spec 严禁）
- `app/api/submissions/route.ts` 不动（不动 API）
- `components/instance-detail/submissions-utils.ts` `deriveAnalysisStatus` 不动（PR-SIM-1c 守护）
- `components/dashboard/recent-grades.tsx` 不动（学生 dashboard 用，PR-SIM-1c 测试守护）
- 教师工作台 / sidebar / dashboard 全不动

## Unsure / 推迟

1. **课程 tag 色 fallback**：当 dashboard summary 返回的 `tasks` 不含某 `taskInstanceId`（极端：跨班 / 历史 instance），SubmissionRow 退化用 `taskInstanceId` hash 保色稳定但**显示不出 courseName chip**。未来若需显示老 instance 课程名，建议加 student 端 `getMySubmissions` API 在 service 层 include `taskInstance.course`（明确 spec 不动 service，留增量）。
2. **导出成绩单按钮**：mockup 头部右侧有 "导出成绩单" 按钮，本 PR **未实现**（无对应 API 也不在 spec scope）— 留 P3。
3. **trend baseline**：mockup 显示固定 trend `+4 / -6 / +8 / —`；实际实现用"同类型上次 percent 差"，与 mockup 行为略不同但更有意义（QA 决定是否需要更换为"班级中位数对比"等其他 baseline）。
4. **dev server 重启**：本 PR 不动 schema / Prisma — **不需要重启 dev server**。dev server PID 96617 全程 alive；prod build 已验。

## 待 QA 真浏览器验收

builder agent 无 chrome-MCP / computer-use 工具，无法直接抓 screenshot。已留：

- `/grades` real cookie 200 + prod chunk 13 文案命中 ✅
- DB 真实当前 0 submission 是 PR-FIX-2 SET NULL 测试 cleanup 副作用（合规预期）
- QA 验收路径：(1) 真 cookie 浏览器加载 /grades 看 empty state（"暂无提交记录" + hero 大数显示 "—"）；(2) 真账户造 1-3 条 submission 走 quiz/sim/subj runner 验三档 chip + 列表 + 详情面板；(3) 视觉对照 mockup `.harness/mockups/design/student-grades.jsx` 确认 hero / 列表 / 详情 grid 比例与色调对齐
