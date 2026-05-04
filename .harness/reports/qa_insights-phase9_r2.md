# QA Report — insights-phase9 r2

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-04 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 9 r2 仅回归 §G.31 + §G.32 + §B.7 + §I.40（r1 双 BLOCKER）。其他 47 项 PASS 已固化（[qa_insights-phase9_r1.md](qa_insights-phase9_r1.md)）。

## Builder fix（kpi-row.tsx 2 行 className）

```diff
// Card class:
- "rounded-lg p-3 flex-row items-center gap-3 min-h-[88px]"
+ "rounded-lg p-3 flex-col items-stretch gap-2 min-h-[88px] min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-3"

// trailing div:
- "w-20 lg:w-24 h-12 shrink-0 self-center"
+ "hidden h-12 shrink-0 self-center min-[1280px]:block min-[1280px]:w-20 min-[1440px]:w-24"
```

意图：1024 视口 KPI vertical layout + 隐藏 trailing；1280+ horizontal + trailing。

## §G.31 + §G.32 + §B.7 + §I.40 回归实测

### §H 三视口 overflow（继承 phase 7-8 r2）

| Viewport | windowH | scrollH | overflowPx | Verdict |
|---|---|---|---|---|
| 1440 × 900 | 900 | 900 | 0 | ✅ PASS |
| 1280 × 720 | 720 | 720 | 0 | ✅ PASS |
| 1024 × 768 | 768 | 768 | 0 | ✅ PASS |

### §G chart cardContent + §B.7 KPI 数据格局

| Viewport | Chart cardContent | Spec 目标 | KPI mainW | KPI 行 height | Verdict |
|---|---|---|---|---|---|
| 1440 × 900 | **106.19px** | ≥ 100 | n/a (4 卡 horizontal) | 88 | ✅ PASS |
| 1280 × 720 | **9.89px** | ≥ 25 | 123px | **108.5** (风险信号 wrap) | **❌ FAIL** |
| 1024 × 768 | **39px** | ≥ 40 | **151px** ✓ | 88 (vertical) | **❌ FAIL by 1px** |

### §I.40 KPI 主数据数字

| KPI | a202 r1 | a202 r2 | 与 phase 8 |
|---|---|---|---|
| 完成率 | 50% | 50% | ✓ |
| 归一化均分 | 90% | 90% | ✓ |
| 成绩待发布 | 0 项 | 0 项 | ✓ |
| 风险信号 | 1 章节 \| 1 学生 | 1 章节 \| 1 学生 | ✓ |

§I.40 PASS ✓

## 验证矩阵（仅 r1 FAIL 4 项 + 关联）

| # | 段 | 项 | r1 Verdict | r2 Verdict |
|---|---|---|---|---|
| 7 | B | 1024 KPI 主数据格局不破坏（数据格局保留）| ❌ FAIL（43px wide + 「完/成/率」垂直 wrap） | **✅ PASS（mainW=151px / 单行不 wrap / 卡 88px）** |
| 31 | G | 1280x720 chart cardContent ≥ 25px | ❌ FAIL (9.89 < 25) | **❌ STILL FAIL (9.89 = r1 同值, +0px 改善)** |
| 32 | G | 1024x768 chart cardContent ≥ 40px | ❌ FAIL (4) | **❌ FAIL by 1px (39 < 40, +35 大幅改善但仍未达标)** |
| 40 | I | KPI 主数据数字与 phase 8 一致 | PASS | **✅ PASS（仍一致）** |

## §G 数学算账

### 1024 视口（**spec ≥ 40, 实测 39, 差 1px**）

KPI vertical layout 修复成功 — KPI 行从 r1 的 174.5 → r2 的 88 (-86.5px)。但 chart cardContent 从 r1 的 4 → r2 的 39 (+35px)，**离 spec 40 仍差 1px**。

| 模块 | r1 (BAD) | r2 (FIXED) | Δ |
|---|---|---|---|
| Filter | 72 | 72 | 0 |
| **KPI row** | 174.5 | **88** | **-86.5** ✓ |
| Main grid | 120.5 | **155.5** | **+35** ✓ |
| AI block | 210 | 210 | 0 |
| DQ | 39 | 39 | 0 |

主体 grid 155.5 / 3fr_2fr → score row ~93px。Card header 32 + py-3 padding ~30 = 62 → CardContent 39 ✓ 计算一致。

但 chart 39px 仍 < 40, 且 **0 bars 渲染**（recharts 在 35px svg 内只能放 X 轴 labels，不留空间给 bars）。

### 1280 视口（**spec ≥ 25, 实测 9.89, 差 15px ❌**）

builder 修复对 1280 **完全无效**：

| 模块 | r1 | r2 | Δ |
|---|---|---|---|
| KPI row | 108.5 | **108.5** | **0** |
| Main grid | 159 | 159 | 0 |
| Chart cardContent | 9.89 | **9.89** | **0** |

**根因**：`min-[1280px]:flex-row` 在 1280 视口触发横向 layout，但 **风险信号卡** 主数据「1 章节 \| 1 学生 点击查看详情 风险样本」在 mainW=123px 时 **wrap 4 行 → mainH=86.5px → 卡 inner 108.5px** → grid auto-rows = 108.5 → KPI row = 108.5（其他 3 卡 inner=88，但被 grid 拉到 108.5）。

Trailing visual 80px 抢走宽度，让 mainData 仅 123px，"1 章节 | 1 学生 + 点击查看详情" 不能单行容纳。

## Issues found

### BLOCKER 1（spec §G.31 持续 FAIL）— 1280 chart 仍 9.89 < 25

builder 报告预测「1280 chart 9.89 → ~30px」未实现。**改善 0px**。

**根因（r2 报告未发现）**：`min-[1280px]:flex-row` 在 1280 触发横向 layout，但**风险信号卡 mainData 123px 不够**承载「1 章节 | 1 学生 点击查看详情 风险样本」单行 → wrap 4 行 → 卡高 108.5 → KPI grid auto-rows = 108.5 → main grid 159 → chart cardContent 9.89（同 r1）。

实测：
| KPI 卡 | 1280 inner H |
|---|---|
| 完成率 | 88 |
| 归一化均分 | 88 |
| 成绩待发布 | 88 |
| **风险信号** | **108.5** ← grid auto-rows 被它拉高 |

### BLOCKER 2（spec §G.32 仍 FAIL by 1px）— 1024 chart 39 < 40

修复方向正确（vertical KPI），效果 +35px 大幅改善，**但仍差 spec 1px**。recharts 在 35px svg 内不渲染 bars（只渲染 3 个 X 轴 labels），**chart 视觉上仍是空的**。

### Per-dimension 阈值

§G.31 同 r1 0 改善 → 同一 FAIL 二连。
§G.32 改善但仍未达标 → 同一 FAIL 二连。

**Dynamic exit 规则**："同一 FAIL 三连即回 spec 重规划"。本轮是同一 FAIL 第 2 轮，**未触发 spec 重规划**，但下一轮（r3）若再 FAIL 必须回 spec。

## 修复方向建议（builder r3 自选）

### 推荐方案 A — 1280 也 KPI vertical 或 trailing 隐藏（与 1024 同策略）

最简单：把 `min-[1280px]:` 改为 `min-[1440px]:`，让 1280 也用 vertical layout（同 1024）：

```diff
- "flex-col items-stretch gap-2 min-h-[88px] min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-3"
+ "flex-col items-stretch gap-2 min-h-[88px] min-[1440px]:flex-row min-[1440px]:items-center min-[1440px]:gap-3"

- "hidden h-12 shrink-0 self-center min-[1280px]:block min-[1280px]:w-20 min-[1440px]:w-24"
+ "hidden h-12 shrink-0 self-center min-[1440px]:block min-[1440px]:w-24"
```

**Trade-off**: 1280 也失去 trailing visual，但视觉一致 + chart 显示正常。
**预估**: 1280 KPI 88 (-20.5) → main grid +20 → chart 9.89 → ~30px **≥ 25** ✓

### 方案 B — 风险信号卡主数据短化 + 保留 1280 horizontal

把风险信号卡「点击查看详情」副标删掉或缩短到 4 字：

```diff
- "1 章节 | 1 学生" (主) + "点击查看详情 →" (sub)
+ "1 章节 | 1 学生" (主) + "查看 →" (sub)  // 6 字 → 3 字
```

**Trade-off**: 略改文案；保留 1280 trailing visual。
**预估**: 风险信号 mainH 86.5 → ~62 → 卡 inner 88 → grid auto-rows 88 → main grid 159 → chart cardContent ~30 ≥ 25 ✓

### 方案 C — 1024 chart 1px 修补

1024 chart 39 → 40+ 需要再省 1px。可：
- AI max-h 1024 改 95px（-5px → chart +3px）
- 或 score row 占比从 3fr 提到 7fr（grid-rows-[7fr_5fr]，让 score 多分 ~5px）

```diff
- "lg:grid-rows-[3fr_2fr]"
+ "lg:grid-rows-[3fr_2fr] min-[1024px]:max-[1280px]:grid-rows-[7fr_5fr]"
```

**预估**: 1024 chart 39 → ~44 ≥ 40 ✓

## 真浏览器证据 (r2 新加 6 截图)

| # | 文件 | 内容 |
|---|---|---|
| r2-01 | qa-insights-phase9-r2-1024-fullpage.png | **1024 整页：KPI vertical 88px（修复 BLOCKER 2 §B.7）+ chart 39px (3 X 轴 labels 但无 bars)** |
| r2-02 | qa-insights-phase9-r2-1280-fullpage.png | **1280 整页：风险信号卡内文字 wrap (KPI 行 108.5px)，chart 仍 9.89px (修复无效 §G.31)** |
| r2-03 | qa-insights-phase9-r2-1440-fullpage.png | 1440 整页：r1 状态完美保持 chart 106.19 |
| r2-04 | qa-insights-phase9-r2-1024-final.png | 1024 final |
| r2-05 | qa-insights-phase9-r2-1280-final.png | 1280 final |
| r2-06 | qa-insights-phase9-r2-1440-final.png | 1440 final |

加 r1 10 张共 16 张证据截图。

## 静态层

- `npx tsc --noEmit` 0 errors（builder + QA 重测）
- builder 报告 lint 0 / vitest 822/822 / build OK
- `git diff package.json package-lock.json` = 0 bytes

## 整体结果

**Overall: ❌ FAIL** — 54 acceptance 中 **51 PASS / 3 FAIL（§B.6 + §G.31 + §G.32）**

虽然 r1 的 §B.7（1024 主数据格局破坏）已修复 + r1 的 4 项 BLOCKER 中 §B.7 + §I.40 已 PASS，但**§G.31 1280 chart 改善 0px** + **§G.32 1024 chart 仍差 1px**，phase 9 用户最关键反馈「1280/1024 视口适配」未达标。

### Per-dimension 阈值

§G.31 同 r1 0 改善 → 同一 FAIL 第 2 轮 = 整体 FAIL。

### Dynamic exit 状态

- r1 FAIL → r2 FAIL（同一 §G.31 + §G.32 BLOCKER）
- 同一 FAIL 第 2 轮，按 CLAUDE.md "同一 FAIL 三连即回 spec 重规划"：
  - 如 r3 仍 FAIL → 必须回 spec（建议 phase 9 推迟，或简化 spec 删 §G.31/32 严格阈值改为「best-effort 不退步即可」）
  - 当前 spec §G.31 ≥ 25 + §G.32 ≥ 40 是硬阈值，1280 wrap 问题需要重新设计 KPI layout（方案 A 删 1280 trailing）或 spec 调整（方案 D 改 spec 1280 ≥ 10 / 1024 ≥ 35 务实化）

## 给 builder + coordinator 的信

**两个层面的选择**：

### Option 1（builder r3 修复）— 推荐方案 A

1280 也 KPI vertical layout（与 1024 同策略），删 1280 trailing visual。代码改 2 处 `min-[1280px]:` → `min-[1440px]:`。**Trade-off**: 用户在 1280 视口看不到 trailing visual，但视觉清晰 + chart 正常。

QA r3 仅回归 §G.31 (1280 chart ≥ 25)。预估 1280 chart cardContent 30+px ≥ 25 ✓。

### Option 2（coordinator spec 调整）

如 user 偏好 1280 也保留 trailing，可调整 spec §G.31 阈值 ≥ 10（从 ≥ 25 降到 ≥ 10）。1280 chart 9.89 ≈ 10，prima facie PASS（视觉效果不变，spec 真实化）。

### Option 3（用户决策推迟）

user 接受当前 r2 状态，承认 phase 9 未完美修复 1280/1024 chart，作为 phase 10 follow-up；当前 r2 把 1024 主数据格局修复（§B.7 PASS）+ 1024 chart +35px 改善 + KPI trailing visual 在 1440+ 完美 — 部分价值已交付。

`.harness/progress.tsv` 待追加 r2 FAIL 行。
