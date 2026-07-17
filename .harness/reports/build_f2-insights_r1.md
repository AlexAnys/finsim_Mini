# Build Report — F2 数据洞察交互/布局修复 r1

- 日期：2026-07-17
- 分支：`codex-insights-ux-fix`
- Builder：Codex
- 代码提交：`b03354a fix: 修复数据洞察下钻与响应式交互`
- 依据：`.harness/spec-f2-insights.md` 与只读根因报告 `insights-ux.md`

## 结论

已按 spec 完成 F-IUX-01～06 的最小修复。成绩柱与抽屉改为消费同一份前端当前分箱数据；响应式页面改为自然纵向滚动并为各面板保留稳定最小高度；风险学生通过抽屉 Tab 可达；“详情”合并全部分箱；证据按钮改为完整中文。

未修改 `analytics-v2.service.ts` 的任何指标公式，也未修改 drilldown route/service 的既有口径。完成率、均分、待发布、风险章节等原 API 下钻，以及 tooltip、班级 toggle、任务表现下拉等正常交互路径均保留。

## 根因与改动

### F-IUX-01 · 柱状图与下钻分箱/口径不同步

- 根因：图表会把 diagnosis 的 5 段按用户偏好重分为 10 段，而旧点击路径把 label 发给服务端，用默认 5 段重新计算并按字符串匹配；scorePolicy/range 也可能不同。
- 修复：新增 `score-distribution-drilldown.ts`，把图表**当前实际渲染的** `view.bins[].classes[].students` 一对一映射为抽屉行；点柱不再请求 score_bin API，不再二次计算。
- 多班对比：点击事件下沉到每个 Recharts `<Bar>`，用该系列闭包中的 classId 精确过滤，避免误取 activePayload 的第一班。
- 保证：不去重、不截断，故“柱中 bucket.students.length = 抽屉 items.length”；5/10 段、latest/best/first、7d/30d/term 都直接沿用当前 diagnosis/view。

### F-IUX-02 / F-IUX-03 · 响应式裁切与标题截断

- 根因：dashboard 固定视口高度且 `overflow-hidden`；主体 grid/wrapper 允许压到 0；成绩卡头 auto 控件列挤压带 `truncate` 的标题。
- 修复：
  - 根容器 `h[...] + overflow-hidden` 改为 `min-h[...]`，由 teacher layout/body 自然滚动。
  - lg 两行改为 `minmax(350px, 1fr)`；四个面板 wrapper 分别提供 350/350/300/350px 最小高度并移除外层裁切。
  - 成绩卡头改为单列自适应布局，控件允许换行，标题移除 `truncate`；图表既有 `min-h-[240px]` 保留。

### F-IUX-04 · 风险学生不可达

- 根因：风险卡整卡点击固定打开 `risk_chapter`，虽然 API 已支持 `risk_student`，但无 UI 入口。
- 修复：风险抽屉在风险类 kind 下显示“风险章节 / 风险学生”两个受控 Tab；切换继续复用当前 scope 调用既有 API。
- 防竞态：加载期间禁用两个 Tab，避免章节/学生请求乱序覆盖；其他 KPI/成绩抽屉不显示这组 Tab。

### F-IUX-05 · “详情”固定打开最低空箱

- 根因：旧代码固定取 diagnosis `bins[0]`。
- 修复：ScoreDistributionChart 把当前 `view.bins` 全部传给 dashboard；“详情”合并全部分箱并显示“全部成绩学生”标题，不再依赖最低箱。

### F-IUX-06 · 证据按钮仅显示“据/收”

- 修复：文案改为“证据 / 收起”，并补 `aria-expanded`；未修改 evidence 内容或生成口径。

## 下钻回归测试

新增 `tests/score-distribution-drilldown.test.ts`，3 项：

1. 以服务端 5 段 fixture 重分为 10 段，验证 75 分进入 `70-80`，该柱人数与抽屉人数相等，65 分不混入，100 分进入末箱。
2. 同一分箱含 A/B 两班时，点击 B 班 series 只返回 B 班学生，人数等于该 series 柱人数。
3. 最低箱为空、后续多个箱非空时，“详情”合并全部学生，而非只返回首箱。

## DB 只读对账

通过 Prisma `findUnique/findMany`（日志仅有 SELECT）复核课程 `c43370cc-f80c-473c-a001-d4bf4daefccd`：

| 课程 | 学生 | 类型 | 原始分数 | 归一化 |
|---|---|---|---:|---:|
| ZZAUDIT 走查测试课程 | 张三 | simulation | 85/100 | 85 |
| ZZAUDIT 走查测试课程 | 张三 | quiz | 2/5 | 40 |
| ZZAUDIT 走查测试课程 | 张三 | subjective | 100/100 | 100 |

多任务均分 `(85 + 40 + 100) / 3 = 75`，应落 5 段 `60-80`、10 段 `70-80`，与回归 fixture 和原报告对账一致。未执行任何 INSERT/UPDATE/DELETE。

## 多视口自测

### 代码级布局预检

| 视口 | 断点/预期 | 静态检查结果 | 真浏览器截图 |
|---|---|---|---|
| 1920×1080 | lg 三列×两行 | 两行各至少 350px；成绩卡两行头 + 240px 图区可完整容纳；标题无 truncate | 未执行，待 Opus QA |
| 1366×768 | lg 三列×两行，可纵向滚动 | 根为 min-h 且无外层 overflow-hidden；track 不低于 350px，x 轴/矮柱不再被压缩 | 未执行，待 Opus QA |
| 1280×800 | lg 三列×两行，窄首列 | 成绩标题独占首行，控件 flex-wrap；标题不再显示“学...” | 未执行，待 Opus QA |
| 1000×800 | <lg 单列，可纵向滚动 | 四卡均有明确 min-height，grid/wrapper 不再把主体压成 0 | 未执行，待 Opus QA |

### 真浏览器限制（如实记录）

Builder 按 browser skill 尝试连接本 worktree：

- `npm run dev -- --port 3101` 因隔离 worktree 的外部 `node_modules` symlink 被 Turbopack 拒绝；
- 改用 `npm run dev -- --webpack --port 3101` 后 315ms 正常 Ready；
- 当前会话浏览器运行时 `agent.browsers.list()` 返回空列表，in-app Browser/Chrome 均不可用，故无法执行真实截图和 SVG 点击；
- 未复用 localhost:3000 的无关项目或 localhost:3001 的旧根 worktree 截图冒充本分支结果；临时 3101 服务已 Ctrl-C 正常关闭，无长驻进程。

因此本节只标记“代码级静态预检通过”，**不声称四视口真浏览器 PASS**。真浏览器视觉与点击由 Opus QA 按下节执行。

## 验证结果

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | PASS，0 errors |
| `QWEN_MODEL= npx vitest run tests/score-distribution-drilldown.test.ts tests/scope-drilldown.service.test.ts tests/analytics-v2.service.test.ts tests/analytics-v2.api.test.ts` | PASS，4 files / 42 tests |
| `npx tsc --noEmit && QWEN_MODEL= npx vitest run` | PASS，125 files / 1268 tests |
| 变更文件 ESLint | PASS，0 warnings/errors |
| `npm run build -- --webpack` | PASS，生产构建及 `/teacher/analytics-v2` 路由编译成功 |
| `git diff --check` | PASS |

全量测试中的 stderr/stdout 均为既有负向用例刻意触发的日志，最终退出码为 0。

## Opus QA 真浏览器清单

1. 使用 teacher1 登录，打开 `/teacher/analytics-v2?courseId=c43370cc-f80c-473c-a001-d4bf4daefccd`。
2. 在 1920×1080 / 1366×768 / 1280×800 / 1000×800 逐一确认“学生成绩分布”完整标题、柱图主体、x 轴和页面纵向滚动；检查无横向溢出。
3. 切 10 段，点张三所在 `70-80` 非空柱：柱标 1 人，抽屉 1 人；再切 5 段点 `60-80`，仍为 1=1。
4. 切换 scorePolicy/range 后再点非空柱，确认抽屉人数仍等于柱标。
5. 点“详情”，确认标题“全部成绩学生”，人数等于当前 distribution.totalStudents，而非最低空箱。
6. 点风险信号卡，再切“风险学生”Tab，确认名单可达；切回“风险章节”正常。
7. 展开/收起教学建议，确认按钮显示“证据 / 收起”。
8. 回归完成率、均分、待发布下钻、tooltip、单/多班 toggle、任务表现下拉与详情、证据抽屉、重新生成失败 toast。

## 范围与纪律

- 业务改动仅 `components/analytics-v2/*`；测试仅新增指定下钻回归文件。
- 未改 `.env`、Prisma schema、migration、指标公式、drilldown route/service。
- DB 仅 SELECT；未 seed；未触发“重新生成”等写请求。
- 未 push。
- `.harness/spec-f2-insights.md` 为任务预置未跟踪文件，未纳入代码提交。
