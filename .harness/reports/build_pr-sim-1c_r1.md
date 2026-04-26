# Build Report — PR-SIM-1c r1

Unit: PR-SIM-1c · D1 防作弊 · 学生侧 UI 适配（D1 最后一片）
Round: r1
Builder: builder
Base commit: 接 PR-SIM-1a（后端） + PR-SIM-1b（教师 UI）
Date: 2026-04-27

## Spec 摘要

接续 1a/1b，只在 student 视图渲染 analysisStatus chip，不重做布局：
1. `/grades` 表格成绩列：根据 analysisStatus 切换"等待 AI 分析" / "已分析 · 等待教师公布" / 正常分数
2. dashboard 的 RecentGrades：未公布显 chip 不显分数
3. simulation runner 提交后展示"已提交·分析中"静态视图（user 5.3.1 反馈"结束对话不应让人等待"）
4. 不动 quiz/subjective runner（已有"已提交"页面）

## 改动文件清单

### 新增

- `tests/pr-sim-1c-student-ui.test.ts` (+8 cases)
  - 4 派生函数边界（与 service 同步）
  - 4 UI 文案守护（grades / recent-grades / dashboard wiring / simulation submitted view）

### 修改

- `app/(student)/grades/page.tsx` (+34 / -6)
  - import `deriveAnalysisStatus` + `SubmissionAnalysisStatus`（从 `@/components/instance-detail/submissions-utils` 复用，类型纯函数零风险）
  - `Submission` 接口加 `releasedAt?` + `analysisStatus?` 字段
  - 加 `getAnalysisStatus(s)` 客户端 fallback 派生
  - "已批改"卡片 → "已公布"，平均分仅基于 released 子集（避免未公布的 score=null 拉低均分）
  - 表格成绩列：3 档渲染（pending chip / analyzed_unreleased chip / 正常分数）
  - 详情按钮：仅 `isReleased` 时渲染（未公布的连 evaluation 详情都不开）

- `components/dashboard/recent-grades.tsx` (+25 / -7)
  - import `SubmissionAnalysisStatus` 类型
  - `RecentGradeItem` 加 `analysisStatus?` 字段
  - 渲染分支：`isReleased ?` 分数 progress bar : chip（pending → 灰；analyzed_unreleased → 暖赭）

- `app/(student)/dashboard/page.tsx` (+15 / -8)
  - import `deriveAnalysisStatus` + `SubmissionAnalysisStatus`
  - recentGrades useMemo：从 `s.status === "graded" && s.score != null` 改为含 `submitted/grading/graded`，让 pending 也参与渲染（卡片用 chip 替代 score）；每条携带 analysisStatus
  - kpi useMemo：`recentGradedSubs` → `releasedSubs`，仅用 released 子集算 avgScore + graded count
  - 文案"基于 X 次批改" → "基于 X 次公布成绩"以反映防作弊语义

- `components/simulation/simulation-runner.tsx` (+45 / -2)
  - student mode `handleFinishConversation`：删 `router.back()`，改 `setSubmitted(true)` + toast "提交成功，AI 分析中"
  - 在 `if (evaluation)` 之前加 `if (submitted && !isPreview && !evaluation)` → 渲染新 `SimulationSubmittedView`
  - 新增 `SimulationSubmittedView` 子组件（taskName + 静态文案 "已提交，AI 分析中" / "你将在教师公布后看到详细评估" + 返回按钮）

## 决策

### 1. 复用 `submissions-utils.ts` 的 `deriveAnalysisStatus + SubmissionAnalysisStatus`

虽然在 instance-detail（教师视角）目录下，但其本质是纯类型 + 纯函数，无任何教师特有逻辑。
学生页面 import `@/components/instance-detail/submissions-utils` 没有语义/循环依赖问题。
避免复制实现 → 派生规则与 service 单一来源同步（spec L74-76 强调"与 lib/services/submission.service.ts deriveAnalysisStatus 同步"）。

### 2. simulation runner 不做 polling

spec L97 简化指示："只显示 '已提交，AI 分析中（你将在教师公布后看到详细评估）' 类静态文案"。
做 polling 需要新 API 调用 + setInterval cleanup + 状态机 → 增加风险。
学生关页面后到 `/grades` 看后续状态变更，符合 spec "不重做布局" 原则。

### 3. dashboard recentGrades 含 pending 的提交

之前 filter 是 `s.status === "graded" && s.score != null` —— 后端剥离后 score=null 时这些已 graded 但未公布的会从列表里消失，学生甚至不知道自己提交过。
改为含 submitted/grading/graded 三状态，让 RecentGrades 卡片渲染 chip 反映状态。
与 PriorityTasks（待办）形成左右补全：待办 → 进行中状态 chip → 公布后 score。

### 4. avgScore KPI 仅基于 released

未公布的 score 后端剥离为 null，`Number(null)` = 0，原代码 `s.score != null` 在剥离后 fail false → 不会被算入。
但 *dashboard.service 没经过 strip*（见下"不确定"3.1）—— 后端仍透传原始 score 字段。
所以前端再加一道防御：filter analysisStatus === "released"，确保未公布的 score 即使从后端漏出来也不被算入 avgScore。
文案"基于 X 次公布成绩"明确语义。

### 5. simulation submitted view 不调用 EvaluationView

EvaluationView 是为 preview mode 教师看自己设计任务的评估而生（含 score / rubric / feedback）。学生 student mode 不应看这些（评估在后台进行 + 教师未公布）。
新增独立 SimulationSubmittedView，仅含状态文案 + 返回按钮，与 quiz/subjective runner 的"已提交"风格一致（CheckCircle + 中文提示）。

### 6. 不动 dashboard.service.ts（scope 控制）

发现 dashboard API 返回的 recentSubmissions **未经过 strip**，仍含 score / maxScore / evaluation 等敏感字段（见"不确定"3.1）。
但 spec 严禁列表 + scope 章节明确限本 PR = "学生侧 UI 适配，不重做布局"。
前端 UI 已经基于 analysisStatus 屏蔽显示 → **学生肉眼看不到 score**。
真正的后端 strip 留给独立 PR（见"建议增量"）。

## 验证

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors / 21 warnings（全 pre-existing） |
| `npx vitest run` | **597 passed**（baseline 589 + 8 新） |
| `npm run build` | 51 routes / Compiled successfully in 4.0s |
| Dev server | PID 96617 仍 alive |
| 真 cookie student1 | /grades 200 + /dashboard 200 |
| 真 cookie teacher1 | login 302 + session ok |

### 真 E2E 矩阵（teacher1 + student1 真登录 cookie）

| Case | 场景 | 验证点 | 结果 |
|---|---|---|---|
| 1 | student1 POST quiz submission（taskInstance ca3b34d3 manual mode） | 201 + status=submitted | ✅ |
| 2 | 等 AI auto-grading 完成 | DB status=graded, score=0/maxScore=70, releasedAt=NULL | ✅ |
| 3 | student1 GET /api/submissions（list） | score=null + maxScore=null + quizSubmission.evaluation=null + analysisStatus=analyzed_unreleased | ✅ 后端剥离生效 |
| 4 | student1 GET /api/submissions/[id]（单条） | 同上：score=null + evaluation=null + analysisStatus=analyzed_unreleased | ✅ |
| 5 | teacher1 POST /release { released:true } | 200 + DB releasedAt 非 NULL | ✅ |
| 6 | student1 GET /api/submissions/[id] post-release | score=0 + maxScore=70 + evaluation 完整（4 keys: feedback/maxScore/totalScore/quizBreakdown）+ analysisStatus=released | ✅ 公布后完整可见 |
| 7 | DB cleanup | submission 全删（COUNT=0） | ✅ |

### Chunk grep 真验证

- `.next/static/chunks/41344b2434011ef4.js` 含 `已提交，AI 分析中` ✓
- `.next/static/chunks/35639fa09c12566f.js` 含 `已分析 · 等待教师公布` + `等待 AI 分析` ✓
- `.next/static/chunks/318e54c13c2a9892.js` 含 `已分析 · 等待教师公布` + `等待 AI 分析` + `次公布成绩` ✓

## 不需要 dev server 重启

零 schema / 零 service / 纯前端组件 + 一个 test 文件。Next.js HMR pickup 验证（curl /grades 和 /dashboard 都 200）。
PID 96617 全程 alive 跨整轮 build + E2E。

## 不确定 / 风险点

1. **Dashboard API 数据泄漏（pre-existing，建议留独立 PR）**：
   - `lib/services/dashboard.service.ts` 的 `getStudentDashboard` 返回 `recentSubmissions` **未经过 strip**，原始 score/maxScore/evaluation 字段仍透传到前端 JSON。
   - spec 严禁列表只列了 `prisma/schema.prisma` / `submission.service.ts` / `app/api/submissions/**`，dashboard.service 不在严禁。
   - 但 spec scope = "学生侧 UI 适配，不重做布局"，加 strip 属于后端职责蔓延。
   - **当前防御**：前端基于 analysisStatus 派生 → UI 不渲染 score。学生肉眼看不见，但 React DevTools / 网络 panel 可见。
   - **建议增量 PR-SIM-1d**：dashboard.service.getStudentDashboard 内对 recentSubmissions 调 stripSubmissionForStudent → 与 /api/submissions 完全对齐。

2. **getAnalysisStatus 在 grades/page.tsx 是 inline 函数**：
   - 每次 render 重建，性能 OK（数据集小），但能提到组件外避免闭包。
   - 决定保留 inline，符合"代码就近"原则；可读性 > 微优化。

3. **dashboard recentGrades 排序**：
   - 当前逻辑 `slice(0, 3)` 取前 3 条（API 已按 `submittedAt desc` 排序），不区分 status。
   - 学生最近 3 条提交可能全是 pending → 不显示分数 → 视觉单调。
   - spec 没要求"已公布优先"，留默认行为。如需混合排序留 PR-STU-1（学生 grades 重布局时再）。

4. **simulation runner submitted view 没 polling**：
   - 用户停留在 sim runner 页面时，AI 评估完成 / 教师公布都不会自动反映。
   - 用户必须手动点"返回任务"或刷新去 /grades 才能看到状态变更。
   - 这是 spec L99 简化指示，不是 bug；增量优化属 P3。

5. **保留教师视角 utility 给学生用的 import**：
   - `@/components/instance-detail/submissions-utils` 是教师 instance-detail 目录，但学生页面 import 它。
   - 如果未来重构 instance-detail 删除 utility 或重命名，学生页面会破。
   - 替代方案：把 `deriveAnalysisStatus + SubmissionAnalysisStatus` 提到 `lib/utils/submission-status.ts` 单独文件。
   - 决策保留：scope 控制 + spec 明确"不动 grading-drawer / 教师页面"暗示 utility 已稳定。

## 留增量 / Open observations

1. **PR-SIM-1d 后端 strip**（最高价值留增量）：
   - dashboard.service.getStudentDashboard 内调 stripSubmissionForStudent → recentSubmissions 真正剥离 score/evaluation
   - tasks/[id] page 学生 fetch 也是同样逻辑（学生看自己的提交记录）

2. **Polling**：当前 simulation submitted view 静态 — 可加 periodical fetch /api/submissions/{id} 自动从 pending → analyzed_unreleased → released 切换状态文案。但增加 setInterval 复杂度，留 PR-SIM-2 教师自动公布场景一起做。

3. **测试**：
   - 4 派生函数边界（已覆盖）
   - 4 UI 文案 grep 守护（已覆盖）
   - 缺：组件级渲染测试（vitest + @testing-library/react render `<RecentGrades items={...analysisStatus pending} />` 验证 chip 真出现）。
   - 留增量；当前 chunk grep 已覆盖编译产物含文案这一关键验证点。

## 是否需要 coordinator commit

是。Builder 不 commit，coordinator 来打包。

变动 5 个文件：
- `app/(student)/grades/page.tsx` （M）
- `app/(student)/dashboard/page.tsx` （M）
- `components/dashboard/recent-grades.tsx` （M）
- `components/simulation/simulation-runner.tsx` （M）
- `tests/pr-sim-1c-student-ui.test.ts` （A）

---

**Builder 自评**：
- 597/597 vitest PASS（+8 新）
- tsc 0 / lint 0 errors / build 51 routes
- 真 cookie 7-case E2E 全 PASS（含教师公布前/公布后双向切换 score 可见性验证）
- 0 schema / 0 service / 0 dev server 重启 / DB 0 残留
- 严禁文件清单零触碰

PR-SIM-1c 完结后，**D1 整链路（schema → service → 教师 UI → 学生 UI）全闭环**，分两步公布机制 ready for production。
