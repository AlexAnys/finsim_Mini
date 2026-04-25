# Build Report — PR-5D · 实例详情 Analytics tab · r1

**Unit**: `pr-5d`
**Round**: `r1`
**Date**: 2026-04-25

## Scope

Phase 5 最后一个 PR · 纯前端 SVG · 不新增 API/schema/AI。

按 spec PR-5D 节：
- 4 KPI 卡：均分 / 中位数 / 及格率 / 平均用时
- 得分分布直方图（6 档，SVG 自画）
- 耗时 vs 得分散点图（SVG）
- Quiz 类型独有：答题正误热图
- 数据源：现有 `submissions` 数组（page 已加载，与 SubmissionsTab 共享）

## Files changed

### 新文件
- `components/instance-detail/analytics-utils.ts`（112 行）— 纯函数 utils（computeKPIs / buildHistogram / buildScatter / formatters）
- `components/instance-detail/analytics-tab.tsx`（363 行）— 4 KPI cards + Histogram SVG + Scatter SVG + QuizHeatmap SVG + empty state
- `tests/instance-detail-analytics.test.ts`（19 tests）

### 修改
- `app/teacher/instances/[id]/page.tsx`：
  - import `AnalyticsTab`
  - analytics tab 占位换成 `<AnalyticsTab rows={normalizedRows} taskType={instance.task.taskType} />`
  - 移除 unused `BarChart3` lucide import

## Non-obvious decisions

1. **Spec 优先于 mockup**
   Mockup `teacher-instance-detail-tabs.jsx` 的 Analytics 段含 5 KPI（到交率/平均用时/平均对话轮数/申诉比例/AI 一致率）+ 散点 + 小组对比 + 雷达图。**Spec 只要 4 KPI（均分/中位数/及格率/平均用时）+ 直方图 + 散点 + Quiz 热图**。Spec 是更新过的需求基线，所以照 spec 落，不抢做 mockup 的额外内容。后续 PR 如果产品要回来加雷达 / 小组对比，可以追加。

2. **直方图归一化到 0–100 而非 raw score**
   不同任务的 maxScore 不同（quiz 50 分 vs simulation 100 分）。直方图需要可比较的桶。我把每份提交按 `score / maxScore * 100` 归一化后落桶。6 个桶 `<40 / 40-55 / 55-70 / 70-80 / 80-90 / 90+`，前两个染 danger 色、中段 warn/brand、后两个 success。设计稿的 5 桶在数据量很小时（dev 现状）会过于稀疏，6 桶更适合大班。

3. **散点图依赖 `durationSeconds`，目前只有 quiz 有**
   Schema：`SimulationSubmission` 没有 duration，`SubjectiveSubmission` 也没有，`QuizSubmission.durationSeconds` 才有。所以 simulation/subjective 类型的散点会显示 "此任务类型无用时数据" empty state。这是真实的数据现状，不是 bug。**Open**：未来要让所有类型有用时，就得 `Submission` 表本身加 `durationSeconds` 或 `(submittedAt - startedAt)` 计算 — 不在 PR-5D scope，记到 HANDOFF。

4. **Quiz 热图数据源 = `evaluation.quizBreakdown`**
   之前 PR-5C 已经在 grading.service.ts 给 quiz 写 `evaluation = { totalScore, maxScore, feedback, quizBreakdown }`，每题 `{questionId, score, maxScore, correct, comment}`。热图只用 `quizBreakdown[].correct`（或 score>=maxScore 当 fallback）。**学生未答的题在 breakdown 里仍以 `correct=false` 出现，热图显示红色** — 想区分"未答 vs 错答"需要 grading service 输出 `answered: boolean` 单独字段，本 PR 不动 service。

5. **SVG 全用 token-based fill / stroke class**
   `fill-brand`、`fill-success`、`fill-danger`、`stroke-line-2` 等。这些是 PR-0 落地的 Tailwind v4 token classes，自动适配 dark mode。没 hardcode 任何 hex。

6. **Tooltip 用原生 `<title>`**
   散点和热图每个 `<circle>`/`<rect>` 都嵌 `<title>` 元素，浏览器原生 hover 会显示文字（学生名 + 用时 + 分数 / Q 编号 + 正误）。无需 tooltip 库，零 JS 开销，可访问性达标。

7. **Empty state 兜底**
   - 整 tab：`gradedCount === 0` → 大 empty card "暂无可分析数据"
   - 散点：`scatter.length === 0` → 子 empty "此任务类型无用时数据"
   - 热图（quiz only）：`studentRows.length === 0 || orderedIds.length === 0` → 子 empty "暂无 quiz 提交可绘制热图"
   - 各级降级独立判断，避免一个 chart 没数据导致整 tab 哑火

## Verification

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **366 passed**（347 → 366，+19 new for analytics-utils） |
| `npm run build` | 0 errors / 0 warnings / 26 routes |
| dev server cold restart | 旧 PID 79990 → kill → fresh PID **6084** "Ready in 696ms" |
| dev real curl `/teacher/instances/[real-id]` | HTTP 200（teacher1 真登录） |
| 9 回归路由 | 全 200 |

### 单元测试覆盖（19 new）

- **computeKPIs (6)**：empty / avg+median over graded only / 偶数中位数 / 60% passRate 阈值 / avgDurationSeconds 过滤 null / avgScore 1 位小数舍入
- **buildHistogram (6)**：6 桶布局 + 标签 / 归一化 / 90+ 边界 / <40 边界 / 忽略非 graded / maxScore=0 防御
- **buildScatter (4)**：基础点位 / 归一化 / 过滤无 duration / 过滤非 graded
- **formatters (3)**：formatMinutes / formatRate / formatScore null 处理 + 边界

## Open concerns / QA hints

1. **数据为空是常态**：seed DB 仍 0 行 Submission，所以真浏览器进 analytics tab 的金字路径会全是 empty state（4 KPI 显示 "—"，下面显示 "暂无可分析数据"）。**这就是空态的正确呈现**。如果 QA 想看 chart 真画出，按 PR-5C 的方式造一份真 submission（subjective 无 duration → 散点 empty + 直方图有 1 个桶亮）

2. **SVG 不可用 vitest 直接断言**：DOM/SVG 渲染需要 jsdom + React testing library。本 PR 不引入新依赖、不写 e2e UI 截图测试。覆盖路径：纯函数 utils 被 19 个单元测试锁死；SVG 只是数据 → 节点的展示层，受 utils 保护

3. **小屏（375px）SVG 缩放**：所有 SVG 都用 `viewBox` + `className="w-full"`，浏览器自动缩放到容器宽度。Quiz 热图列数多时改用 `overflow-x-auto` 水平滚动避免列被压扁

4. **未做的 mockup 元素**（不在 spec）：
   - 雷达图 / 班级 × 上届 评分维度对比
   - 各小组表现 horizontal range bar
   - 5 KPI（spec 只要 4）
   建议产品决策后开下一个 PR 加，不抢做

5. **Phase 5 全收工状态**：本 PR 通过即 Phase 5 完成全部 4 PR + 1 SEC PR + 0 schema 二轮，spec 全部 acceptance 闭环。下一步 Phase 6 / Phase 7

## 状态

Ready for QA。Task #59 待 PASS 后标 completed = Phase 5 完整收工。
