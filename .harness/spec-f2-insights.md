# Spec — F2 数据洞察看板修复（Codex 单元）

> 流水线：Fable5 plan → Codex 执行 → Opus 真浏览器验收。根因详见只读报告（绝对路径）：
> `/Users/yangsenan/dev/Finsim-Mini/.harness/reports/staging-findings-2026-07/insights-ux.md`（含多视口截图、drilldown API 实测、DB SELECT 对账）

## 背景
用户 staging 实测数据洞察看板（/teacher/analytics-v2）两个核心投诉 + 巡检又发现 3 处坏交互，全部有确诊根因。

## 范围（IN）
文件集中在：`components/analytics-v2/*`（analytics-v2-dashboard.tsx、score-distribution-chart.tsx、teaching-advice-block.tsx、risk-drawer.tsx 等）、`app/api/lms/analytics-v2/drilldown/route.ts`、`lib/services/scope-drilldown.service.ts`。

### F-IUX-01（P0）· 直方图↔下钻口径/分箱不同步 → 点柱/详情恒 0 人
- 根因：直方图前端按用户「5/10 段」偏好客户端重分箱（score-distribution-chart.tsx:140-146,390），下钻接口恒用服务端默认 5 段 + 丢弃 scorePolicy/range，再按 label 字符串 `find`（drilldown/route.ts:34-52、scope-drilldown.service.ts:341-347）→ label/口径对不上返回空。
- 修复：**推荐**点柱时前端直接把已在手的 `bin.classes[].students` 传给抽屉，根本不再打服务端重算；**或**下钻改按数值区间 min/max 过滤（而非 label 字符串），且 route 透传 binCount/scorePolicy/range 与直方图对齐。二者择一，须使"柱标 N 人 = 抽屉 N 人"在 5 段/10 段/改口径下都成立。

### F-IUX-02（P0）/ F-IUX-03（P1）· 响应式布局裁切
- 根因：根容器 `h-[calc(100vh-3.5rem-3rem)] overflow-hidden`（analytics-v2-dashboard.tsx:601-607）锁死视口高不可滚；主体网格 <1024px 塌单列仍关在固定高里（:649）→ 面板主体压成 0 高裁切。短视口（1366×768）图表纵向裁切；1280 标题 `truncate` 成「学...」。
- 修复：去掉固定高 overflow-hidden 硬壳、允许纵向滚动（`min-h` 而非固定 `h-[calc]`）；<lg 单列时各面板给 `min-height` 且页面可滚；成绩分布卡头控件在窄宽换行/收起，别 truncate 掉标题。实测目标视口：1920×1080 / 1366×768 / 1280×800 / 1000×800 均图表主体+标题可见（可滚）。

### F-IUX-04（P1）· 风险学生 UI 不可达
- 根因：风险卡显示「N 章节 | M 学生」，但点击只 `openRiskDrawerByKind("risk_chapter")`（analytics-v2-dashboard.tsx:567-573），`risk_student`（API 实测返回真数据）无任何 UI 入口。
- 修复：风险卡拆「章节」「学生」两入口，或抽屉内加 Tab 切 risk_chapter/risk_student。

### F-IUX-05（P1）· 「详情」只下钻最低空箱
- 根因：handleViewAllScores 固定取 `bins[0].label`（最低箱 0-20，常空）（analytics-v2-dashboard.tsx:587-594）。
- 修复：「详情」下钻全部区间（不带 binLabel / 遍历所有 bin），语义=查看全部成绩学生。

### F-IUX-06（P2）· 证据按钮标签单字「据」
- 根因：teaching-advice-block.tsx:290 `{isExpanded ? "收" : "据"}`。
- 修复：改「证据」「收起」或 icon+tooltip。

## 范围（OUT）
- 审计已记的设计问题不在本单元：均分口径三套分裂（F-INS-02/09）、数据质量默认折叠（F-INS-07）、evidence 未回绑（F-INS-06）——属 R6/R7 洞察重构，别顺手改。
- 不碰 analytics-v2.service 的指标计算公式（除非 F-IUX-01 下钻对齐必需）。

## 硬规则
1. 只修交互/布局/下钻对齐，不改指标口径定义（避免撞审计 R6）。
2. 保住报告巡检表里所有 ✅ 正常交互（完成率/均分/待发布下钻、tooltip、班级 toggle、任务表现下拉等）不回归。
3. 最小改动；中文 UI；commit 前 `npx tsc --noEmit && QWEN_MODEL= npx vitest run` 全绿；下钻对齐逻辑补回归测试。
4. 纪律：不 push；不动 `.env`；DB 只 SELECT。dev server 由 QA 起，勿长驻本 worktree。

## 验收标准（Opus QA 真浏览器 + DB 对账）
1. 直方图 5 段与 10 段点任一非空柱 → 抽屉人数 = 柱标人数（DB 对账）；改 scorePolicy/range 后仍一致
2. 「详情」→ 列全部成绩学生（非最低空箱）
3. 风险卡可拿到风险学生名单（后端 risk_student 数据 UI 可达）
4. 1920/1366/1280/1000 宽下成绩分布图主体 + 标题可见（可滚动查看），无裁切、无「学...」截断
5. 证据按钮标签可读
6. tsc 0 错 + vitest 全绿；其余洞察交互无回归

## 产出
分支 `codex-insights-ux-fix`；commit `fix:` 中文；不 push。报告 `.harness/reports/build_f2-insights_r1.md`（每处根因+改动+测试+多视口自测）。
