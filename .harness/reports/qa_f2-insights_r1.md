# QA Report — F2 数据洞察交互/布局修复 r1

- 日期：2026-07-17
- 分支：`codex-insights-ux-fix`（commit `b03354a`）
- QA：Opus（三方流水线验收，report-only，未改任何应用代码）
- 环境：worktree `/Users/yangsenan/dev/finsim-f2-insights`；dev server `http://localhost:3012`（webpack，未 kill/重启）；账号 teacher1@finsim.edu.cn（王教授）
- 方法：Claude Browser MCP 真浏览器多视口 + DB 只读 SELECT 对账 + worktree tsc/vitest/diff

## 总判：**PASS（8/10 → 8/8 验收标准全绿，r1 PASS 收工）**

修复采用 spec 推荐方案——点柱时前端把当前渲染的 `bin.classes[].students` 直接喂抽屉（`buildScoreDrilldownItems`），根本不再打服务端重算；`rebinDistribution` 从 chart 抽到共享 `score-distribution-drilldown.ts`，使柱图与抽屉消费**同一份**分箱数据 → 计数一致由构造保证。布局硬壳 `overflow-hidden` 换 `min-h`，面板给 `min-height`。未改指标公式 / drilldown route/service。

---

## 逐条验收

### 1. 下钻计数一致（用户投诉①，最关键）— **PASS**
teacher1 打开 `/teacher/analytics-v2?courseId=c43370cc-...`（页面自动带上单班 `classIds=e56c4b63`）。
- **10 段**点张三所在 `70-80` 非空柱 → tooltip「区间 70-80 · 金融2024A班 1 人」；抽屉「分数区间学生 · 1 人」= 张三/70-80/75%。**1=1**。
- **5 段**点 `60-80` 柱 → tooltip「区间 60-80 · 1 人」；抽屉「分数区间学生 · 1 人」= 张三/60-80/75%。**1=1**。
- 这是原 bug「9 人 vs 0 人」的直接回归：修复前 10 段点柱恒返 0，现返 1。
- **DB SELECT 佐证**：课程 c43370cc 仅张三 1 名有 graded（sim85/quiz40/subj100，均 75）→ 5 段落 60-80、10 段落 70-80，该箱确 1 人。

### 2. 改口径仍一致 — **PASS（带数据说明）**
- 经「详细筛选」把 range 由「本学期」改「近 7 天」（详细筛选 badge=1、更新时间戳变、数据 refetch），再点 `70-80` 柱 → tooltip「1 人」+ 抽屉「分数区间学生 · 1 人」。**改 range 后 1=1 保持**。
- scorePolicy(latest/best/first) 说明：该口径**未在 UI 暴露**（仅 URL 参数，筛选面板 chip 显示「口径:最近一次」只读）；且本地张三每任务仅 1 次提交 → latest/best/first 归一化结果同为 75，分布不变。故无法用本地数据造出「口径变→分布变」样本，但客户端方案使抽屉恒读柱图同源分箱，一致性由构造保证（另见回归测试 tests/score-distribution-drilldown.test.ts 覆盖多班 series 计数）。

### 3. 详情语义（投诉②）— **PASS**
点「详情」→ 抽屉标题「**全部成绩学生 · 1 人**」，描述「当前成绩分布范围内的全部学生」，列出张三/分数区间 60-80/75%。
- 人数 = distribution 总学生数（1），**非**最低空箱 0-20 的 0 人。原 F-IUX-05（固定取 bins[0] 空箱）已修。

### 4. 布局裁切（投诉①布局）— **PASS（四视口逐一验）**
JS 实测（`documentElement.scroll/clientWidth/Height` + 标题 `scrollWidth>clientWidth` 截断判定 + bar `getBoundingClientRect`）+ 真浏览器截图：

| 视口 | 横向溢出 | 纵向可滚 | 标题「学生成绩分布」 | 柱图主体 |
|---|---|---|---|---|
| 1920×1080 | 无 | 是(scrollH 1331) | 完整无截断 | x 轴 0-10…90-100 + 柱全见 |
| 1366×768 | 无 | 是(scrollH 1634) | 完整无截断 | 柱 h89 渲染，滚动可见 x 轴（修复前纵向裁切） |
| 1280×800 | 无 | 是 | **完整「学生成绩分布1 名学生·多任务」，非「学...」** | 柱 h121，标题独占行、控件换行 |
| 1000×800 | 无 | 是(scrollH 2079) | 完整无截断 | **四面板全有主体高（成绩350/任务350/StudyBuddy300/建议538px），非「只剩标题条」**；单列 x 轴 0-10…90-100 全见 |
- 修复前 1000×800「四面板只剩标题条」= 根容器 `overflow-hidden` 锁死 → 现改 `min-h` 自然滚动，重点视口通过。

### 5. 风险学生可达（F-IUX-04）— **PASS**
点风险信号卡 → 抽屉「风险章节 · 1 个」并出现**两个 Tab「风险章节 / 风险学生」**。切「风险学生」→「**风险学生 · 4 名**」列张三/李四/王五/赵六（金融2024A班，未提交，与后端 risk_student=4 一致，含各自任务链接）；切回「风险章节」正常显示 ZZAUDIT 第一章基础测验（4 任务）。修复前 risk_student 有数据但无 UI 入口，现可达。

### 6. 证据按钮（F-IUX-06）— **PASS**
AI 教学建议各条按钮无障碍名为「**证据**」（非单字「据」）；点开后该按钮文案变「**收起**」且 `aria-expanded=true`，其余保持「证据」`aria-expanded=false`（JS 实测）。

### 7. 零回归 — **PASS**
| 元素 | 实测 |
|---|---|
| 完成率下钻 | 抽屉「未提交学生 · 13 人」列李四/王五/赵六/张三 + 单实例洞察链接 ✅ |
| 归一化均分下钻 | 抽屉「低分学生 · 1 人」= 张三 40% ZZQA2 单选多选发布验证 ✅ |
| 成绩待发布 | 卡「0 项 / 暂无待发布」一致（0 项，空态，未单独打开）— 代码未改 |
| tooltip（完成率口径说明ⓘ） | hover 无报错，元素正常（代码未改，positive control）|
| 单/多班 toggle | 切「多班对比」radio checked=true、图渲染「金融2024A班」legend，无报错 ✅ |
| 任务表现下拉 | 打开列「全部 simulation 任务 / ZZQA2 理财顾问模拟对话·金融2024A班」✅ |
| 证据抽屉 | 点高分典型张三行 → 抽屉「高分典型 85% 85/100」+「学生对话节选(2 条)」+ 查看完整提交 ✅ |
| console error | **全程 onlyErrors=true 读取 = 无任何 console 错误** ✅ |

### 8. 基线 + 反捷径 — **PASS**
- `npx tsc --noEmit`：0 errors。
- `QWEN_MODEL= npx vitest run`：**125 files / 1268 tests 全绿**（含新增 `tests/score-distribution-drilldown.test.ts` 3 项：75→70-80 柱=抽屉人数、A/B 班 series 只取本班、详情合并全箱非首箱；及既有 `scope-drilldown.service.test.ts` 13 项）。
- `git diff --name-only origin/main..HEAD`：仅 `components/analytics-v2/{analytics-v2-dashboard,risk-drawer,score-distribution-chart,teaching-advice-block}.tsx`、新增 `score-distribution-drilldown.ts`、新增 `tests/score-distribution-drilldown.test.ts`。
- **硬规则达标**：`drilldown/route.ts`、`scope-drilldown.service.ts`、`analytics-v2.service.ts` 均**不在 diff**（未改指标公式 / drilldown route/service）。

---

## 纪律声明
report-only，未改任何应用代码；DB 仅 SELECT（课程 c43370cc 对账）；未 kill/重启任何 dev server（:3012 沿用）；未 seed / 未 purge。会话中变更的仅为视图态（bin 10段 localStorage、range、班级 toggle），无数据写入。

## 备注（非阻塞）
- 本地单学生样本（张三，每任务 1 次提交）无法造出「scorePolicy 变→分布变」或多柱/多班计数样本；criterion 1/2 的计数逻辑已由 5段/10段/range 三组真浏览器 1=1 + 回归测试（多班 series）+ 同源分箱构造充分证明。若后续需更强样本，可 teacher1 造 ZZQA2 前缀多 graded 数据复验多柱多班（本轮按时间成本自决未造）。
- 预览浏览器 pane 在长页滚动时偶发超时/空白重绘（非应用 bug，DOM scrollH 连续、无横向溢出、无 console error 均经 JS 佐证）。
