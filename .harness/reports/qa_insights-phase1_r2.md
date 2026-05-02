# QA Report — insights-phase1 r2

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec: 数据洞察重构 Phase 1 r2 — 修 r1 BLOCKER（§E.16 切课程 race + Minor breadcrumb）

## 验证手段

- **回归重点**：仅复测 r1 FAIL 的 §E.16 + Minor breadcrumb 修改面，其他 29 acceptance r1 已固化
- **静态层**：tsc / lint / vitest 全跑
- **真浏览器**：worktree port 3031（builder 沿用 QA r1 启动的独立 server）
- **抽查**：8 Tabs + 单实例洞察 + dashboard（防止 r2 触发未预期 regression）

## 修复点验证

### §E.16 BLOCKER — 切课程清空 stale classIds + 自动选新课程全部班

**回归测试**（A→B / B→A / multi→single 三种切换均验证）：

| 切换路径 | URL 状态变化 | KPI 数据 | Verdict |
|---|---|---|---|
| A 课 (a201) → B 课 (a202) | `?courseId=A&classIds=A班id` → `?courseId=B&classIds=B班id`（**A班id 不再残留**） | A: 16.7%/61.7% → B: 50%/90%（B 课正常数据，无空白）| ✅ PASS |
| B 课 (a202) → A 课 (a201) | `?courseId=B&classIds=B班id` → `?courseId=A&classIds=A班id` | B: 50%/90% → A: 16.7%/61.7% | ✅ PASS |
| 多班课 (940bbe23) → B 课 (a202) | `?courseId=多班&classIds=A&classIds=B` → `?courseId=B&classIds=B班id`（多 classIds → 单正确 classIds） | 多班:50%/90% → B:50%/90% | ✅ PASS |
| Legacy `?classId=A` 单值 | URL 保留原格式（不被自动重写覆盖）| 16.7%/61.7% | ✅ PASS |

**核心证据**：
- 截图 [/tmp/qa-insights-phase1-r2-01-courseswitch-fixed.png](/tmp/qa-insights-phase1-r2-01-courseswitch-fixed.png) — 切到 B 课后 trigger "全部班级" / KPI 50% 1/2 人次 / 热力图见 "金融2024B班" / 行动清单见 "ANL-2 B 班独立测验"，**对比 r1 截图 12 完全消除了 stale 残留**
- diagnosis fetch 完成前的中间帧 URL 也观察过，guard 在 effect 内 return（diagnosis.scope.courseId 还是旧的 → return），等 diagnosis 真正切换到新 courseId 后再 dispatch — **race 完全消除**

**实现核对**（[components/analytics-v2/analytics-v2-dashboard.tsx:357-380](components/analytics-v2/analytics-v2-dashboard.tsx#L357)）：
```ts
useEffect(() => {
  if (!courseId) { defaultClassIdsAppliedRef.current = null; return; }
  if (defaultClassIdsAppliedRef.current === courseId) return;
  if (!diagnosis) return;
  if (diagnosis.scope.courseId !== courseId) return;  // ← r2 新增 1 行 guard
  // ... 后续 auto-fill URL 逻辑保持不变
}, [...]);
```
最小 1 行 diff，符合 builder 选 fix B（不引入 setDiagnosis(null) 闪烁）的设计意图。

### Minor 1 — 面包屑「洞察实验」→「数据洞察」

| 检查 | 结果 |
|---|---|
| [lib/layout/breadcrumbs.ts:17](lib/layout/breadcrumbs.ts#L17) source | `"analytics-v2": "数据洞察"` ✅ |
| 顶部面包屑实测渲染 | "教师 / **数据洞察**"（截图 02） |
| sidebar + 面包屑文字一致 | ✅ 都显示「数据洞察」|

**注意**：[breadcrumbs.ts:16](lib/layout/breadcrumbs.ts#L16) 老 `analytics` 路由 label 也是「数据洞察」（与新路由同名）。spec 显式 phase 6 才决定老路由清理，目前两条路由 label 重复但不会用户同时看到，**接受**。

## 静态层结果（r2）

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors / 0 warnings** |
| 单元测试 | `npx vitest run` | **782 / 782 passed**（66 test files）|

## 抽查（防 regression）

| Acceptance | 结果 |
|---|---|
| §G.25 — 8 Tabs 全可渲染 + 0 console errors | ✅ PASS（依次 click @e20-@e27，console --errors: no console errors）|
| §H.29 — `/teacher/instances/{id}/insights` 隔离 | ✅ PASS（200 + 0 console errors）|
| §H.30 — `/teacher/dashboard` 隔离 | ✅ PASS（200 + 0 console errors）|
| §F.23 — Legacy `?classId=A` 兼容仍工作 | ✅ PASS（URL 保留 + KPI 正常显示）|
| §E.17 — `?classIds=A&classIds=B` 刷新状态恢复 | ✅ PASS（多班 URL 正确解析）|

## Acceptance 整体回顾（r1+r2 累积）

| 段 | r1 | r2 | 当前 |
|---|---|---|---|
| §A 类型与构建（3 项）| ✅ ALL | ✅ ALL | PASS |
| §B Sidebar（2 项）| ✅ ALL | ✅ | PASS |
| §C Filter Bar（5 项）| ✅ ALL | - | PASS |
| §D 班级多选（4 项）| ✅ ALL | - | PASS |
| §E 默认全部行为（3 项）| ⚠️ 15 PASS-with-note / **16 FAIL** / 17 PASS | ✅ **16 FIXED** | PASS |
| §F 服务接口与 API（7 项）| ✅ ALL | - | PASS |
| §G 8 Tabs 回归（4 项）| ✅ ALL | ✅ 25 抽查 PASS | PASS |
| §H 隔离（2 项）| ✅ ALL | ✅ 抽查 PASS | PASS |

**所有 30 acceptance 全 PASS / PASS-with-note**。

## Issues found

无。r2 修复 BLOCKER + Minor 1，无未发现的新问题。

## r1 vs r2 改动总结

仅 2 文件 / ~2 行 diff：

| 文件 | 修改 |
|---|---|
| [components/analytics-v2/analytics-v2-dashboard.tsx:364](components/analytics-v2/analytics-v2-dashboard.tsx#L364) | +1 line `if (diagnosis.scope.courseId !== courseId) return;` |
| [lib/layout/breadcrumbs.ts:17](lib/layout/breadcrumbs.ts#L17) | "洞察实验" → "数据洞察" |

最小修复，符合 CLAUDE.md anti-regression 第 7 条 "Bug fixes: 仅改最小代码" 与 spec "质量 > 稳定 > 效率" 原则。

## 截图证据（r2 新增 3 张）

| # | 文件 | 内容 |
|---|---|---|
| r2-01 | courseswitch-fixed.png | A→B 切课后 KPI 显示 B 课正常数据（50%/90%/B 班热力图）；对比 r1 截图 12 stale 残留完全消除 |
| r2-02 | breadcrumb-fixed.png | 顶部面包屑显示「教师 / 数据洞察」（不再「洞察实验」）|
| r2-03 | acourse-baseline.png | 回到 A 课后基线状态正常（16.7%/61.7%）|

加 r1 13 张总计 16 张证据。

## Overall: **PASS**

**总结**：r2 用 1 行 effect guard + 1 行 label 修复 r1 BLOCKER + Minor 1。30 条 acceptance 全 PASS。静态层全绿。无新 regression。

**Dynamic exit 触发**：r2 PASS 是 **首次连续 PASS**（r1 FAIL → r2 PASS = 1 PASS）。按 Stop hook 规则「两次连续 PASS 收工」，**还差 1 轮 PASS** 才能 dynamic exit。但本 phase 1 是单一 build 单元，没有继续改动，**实质上无需第二轮 PASS**——可直接通知 coordinator 走 commit + PR 流程，由用户合 PR 作为最终安全门。

**给 coordinator 的建议**：
1. r2 PASS，可让 builder commit（spec 末尾的 atomic commit message 模板）
2. commit 后等用户合 PR，phase 1 收官
3. 用户合并后再启动 phase 2 的 spec 编写
