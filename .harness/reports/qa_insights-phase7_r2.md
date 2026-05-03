# QA Report — insights-phase7 r2

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec
[.harness/spec.md](.harness/spec.md) — Phase 7 r2 仅回归 §C.14-16 单屏 UX（r1 唯一 BLOCKER）。其他 62 项 PASS 已固化（见 [qa_insights-phase7_r1.md](qa_insights-phase7_r1.md)）。

## Builder fix（一行 diff）

[components/analytics-v2/analytics-v2-dashboard.tsx:598](components/analytics-v2/analytics-v2-dashboard.tsx#L598)：
```diff
-        "h-[calc(100vh-var(--header-h,4rem)-1rem)]",
+        "h-[calc(100vh-3.5rem-3rem)]",
```

按 r1 报告 §Issues found BLOCKER 1 给的方案 A 精确减 chrome 104px（sticky h-14 56px + wrapper p-6 上下 48px）。tsc 0 / lint 0 / 其他 r1 实现 0 改动。

## §C 三视口回归实测

| Viewport | windowH | scrollH | overflowPx | hasScroll | Verdict |
|---|---|---|---|---|---|
| **1440 × 900** | 900 | **900** | **0** | **false** | **PASS** ✓ |
| **1280 × 720** | 720 | **720** | **0** | **false** | **PASS** ✓ |
| **1024 × 768** | 768 | **768** | **0** | **false** | **PASS** ✓ |

三视口都精确 overflowPx=0，无页面级垂直滚动。修复完美匹配预期。

### Sanity check（确认无其他模块 regression）

| 项 | 实测 | Verdict |
|---|---|---|
| dashboard root class | `h-[calc(100vh-3.5rem-3rem)]` | ✓ 已更新 |
| dashboard rect (1440x900) | x=256 y=80 width=1160 height=796 top=80 bottom=876 | ✓ 完美贴合 (900-80-24=796) |
| H1 「数据洞察」 | `h1`.textContent = "数据洞察" | ✓ |
| KPI 4 卡 | kpiCount = 4 | ✓ |
| Filter row height | 32px (≪ 100px §B.11 目标) | ✓ |
| 主体 3 列 layout | colCount=3 / colsAllFit=true | ✓ |
| 数据质量底部 | y=838 / bottom ≤ 900 / dqVisible=true | ✓ |

## 验证矩阵（仅 r1 FAIL 三项）

| # | 段 | 项 | r1 Verdict | r2 Verdict |
|---|---|---|---|---|
| 14 | C | 1440x900 整页可见无页面滚动 | ❌ FAIL (24px) | **✅ PASS (0px)** |
| 15 | C | 1280x720 整页可见无页面滚动 | ❌ FAIL (24px) | **✅ PASS (0px)** |
| 16 | C | 1024x768 整页可见无页面滚动 | ❌ FAIL (24px) | **✅ PASS (0px)** |

其他 62 项 r1 PASS 已固化，r2 未改实现 → 本轮无需重测。

## 静态层

- `npx tsc --noEmit` 0 errors ✓
- builder 报告：lint 0 warnings + 其他 r1 实现 0 改动
- vitest 819/819 (r1 baseline 不变)
- build success (r1 baseline 不变)
- `git diff package.json package-lock.json` = 0 bytes (r1 baseline 不变)

## 真浏览器证据 (r2 新加 4 截图)

| # | 文件 | 内容 |
|---|---|---|
| r2-01 | qa-insights-phase7-r2-1280x720.png | 1280x720 整页可见 overflowPx=0 |
| r2-02 | qa-insights-phase7-r2-1024x768.png | 1024x768 整页可见 overflowPx=0 |
| r2-03 | qa-insights-phase7-r2-1440x900.png | 1440x900 整页可见 overflowPx=0（最终）|

加 r1 17 张共 20 张证据截图 ≥ 12 spec 目标。

## 整体结果

**Overall: ✅ PASS** — 65/65 acceptance criteria 全 PASS

- r1: 62 PASS / 3 FAIL (§C.14-16 三连)
- r2: 3 PASS（§C.14-16 一行 diff 修复完美）
- **累计**：**65/65 PASS**

### Dynamic exit 状态

- r1 FAIL → r2 PASS = **本 unit 收工**（不跑 r3 保险，CLAUDE.md 明确禁止 churn）
- 同 phase 1 r2 PASS 模式：单一 BLOCKER 一次精准修复，PR review 是更可靠的最终安全门

## 给 coordinator 的建议

1. **本轮 PASS**，可让 builder 按 [.harness/spec.md §提交策略](.harness/spec.md) 一次性 4 atomic commits：
   - C1: feat(insights): phase 7.1 — service 扩展 (weeklyHistory + previousWeek + pendingReleaseTaskCount + score_bin drilldown) + 单测 +8
   - C2: feat(insights): phase 7.2 — KPI 4 卡 + Sparkline + 周对比 delta + 风险信号合并 + ToggleGroup shadcn add
   - C3: feat(insights): phase 7.3 — Filter 紧凑 + 主体 3 列单屏 + 3 区块改造 + module scroll + localStorage（含 r2 单屏修复行）
   - C4: feat(insights): phase 7.4 — AI 建议底部 4 列 + 数据质量底部 collapsible + 删 InsightsGrid + 删 coming-soon
2. Coordinator 写 chore HANDOFF post phase 7 总结
3. 用户 review + push（PR #1 最终 12 commits = 7 phase + 2 chore + 4 phase 7 atomic）

### Phase 7 收官汇总

| 维度 | r1 → r2 |
|---|---|
| Acceptance | r1 62/65 → r2 65/65 PASS |
| BLOCKER | 1（§C 24px overflow）→ 0 |
| Diff size | r1 16 文件 / +2150/-1201 → r2 1 行 |
| Build round | 1 + 1 = 2 |
| QA round | r1 FAIL + r2 PASS |
| 真浏证据 | 20 张截图 |
| 静态层 | tsc 0 / lint 0 / vitest 819/819 / build OK / no new deps |

`.harness/progress.tsv` 待追加 r2 PASS 行。
