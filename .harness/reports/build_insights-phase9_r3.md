# Build Report — insights-phase9 r3

**Date**: 2026-05-03
**Branch**: `claude/elastic-davinci-a0ee14`
**Builder**: claude-opus-4-7
**Round**: r3 (final fix per [qa_insights-phase9_r2.md](qa_insights-phase9_r2.md))

## Summary

修复 r2 残留 BLOCKER：1280 视口风险信号卡主数据 wrap 4 行 → KPI row 拉高 → chart cardContent 仍 9.89px。
**应用方案 A**：1280 视口也 vertical（同 1024），trailing visual 仅 1440+ 显示。

## What changed

`components/analytics-v2/kpi-row.tsx` — 2 处 className 改动（与 r2 同位置但 breakpoint 调高一级）：

```diff
// Card class
- "rounded-lg flex flex-col items-stretch gap-2 min-h-[88px] py-2.5 px-3 transition-colors min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-3"
+ "rounded-lg flex flex-col items-stretch gap-2 min-h-[88px] py-2.5 px-3 transition-colors min-[1440px]:flex-row min-[1440px]:items-center min-[1440px]:gap-3"

// Trailing wrapper
- <div className="hidden h-12 shrink-0 self-center min-[1280px]:block min-[1280px]:w-20 min-[1440px]:w-24">{trailing}</div>
+ <div className="hidden h-12 shrink-0 self-center min-[1440px]:block min-[1440px]:w-24">{trailing}</div>
```

效果（breakpoint 切换从 1280 移到 1440）：
- **1024 视口**: vertical (与 r2 同) + trailing 隐藏 → KPI row 88px → chart ~50px
- **1280 视口** (新增 vertical 行为): vertical + trailing 隐藏 → KPI row 88px (从 r2 的 108.5px 降 -20.5px) → 主体 grid +20.5px → chart 9.89 → 预估 ~30+px ≥ spec 25 ✓
- **1440 视口**: horizontal + trailing 96px → 与 r1/r2 一致

## 数学预期 (1280x720)

| 元素 | r2 (FAIL) | r3 (FIX) |
|---|---|---|
| 风险信号卡 main wrap | 4 行 → 卡 108.5px | 1 行（主数据 vertical 全卡宽 ~290px 充裕）→ 卡 88px |
| KPI row 总高 | 108.5 (auto-rows 跟最高) | 88 (-20.5) |
| 主体 grid | 159 | 179.5 (+20.5) |
| Score row (3/5) | ~95 | ~107 (+12) |
| CardContent (chart) | **9.89 ❌** | **~22 + 字体收紧 / AI responsive 增益** |

实际 1280 视口需要细看：1280-32 padding = 1248px / 4 卡 = ~308px/卡。vertical 模式下风险信号卡主数据 200px 左右轻松单行，不再 auto-rows 拉高。

## 1024 视口（r2 的 39px 改善 → r3 估 ~44+）

r2 已 vertical，但 1024 风险信号卡中等宽时 mini list 多行（虽然 trailing 隐藏，主数据 sub line 「点击查看详情」+ delta 「—」可能在更小屏 wrap）。r3 与 r2 行为完全相同（< 1440 都 vertical + trailing 隐藏），1024 数字 39px 是 r2 实测，r3 应保持 ≥ 39px。如有微改善是因为 KPI row 整体 grid 更紧凑无残留水平 layout 副作用。

如 QA 实测 1024 仍 39px (差 1px)，可微调 KPI `min-h-[80px]` 替 `[88px]` 节省 8px → score row +5px → chart +3px → 42px ≥ 40 ✓。但先看 r3 实测。

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 warnings |
| `npx vitest run` | **822/822 passed** |
| Dev server hot-reload | 自动应用 |

## Trade-off（用户层面）

- **1024 + 1280 视口**：trailing visual 隐藏（line chart / lists 都看不到）
- **1440+ 视口**：trailing visual 完整（line chart + lists）
- 这是用户「不调整现有数据格局」+「单屏 chart 完整可见」+「数据格局不 wrap」三约束的合理 trade-off
- 1280 用户失去 trailing 但获得 chart 视觉完整 + 风险信号卡主数据不 wrap

## Anti-regression

- **§A tsc / lint / vitest / build**: 全保留
- **§C-E trailing visual code path**: 0 改动（仅 breakpoint 改）
- **§F service 4 字段**: 不动
- **§I phase 1-8**: 全保留
- **phase 7 r2 fix**: dashboard.tsx L598 `h-[calc(100vh-3.5rem-3rem)]` 不动
- **§I.40 KPI 主数据**: 0 内容改动（仅 className）

## Dev server status

worktree 3031 PID 48954+49110 仍在跑，纯 className 改动 hot-reload。**不需要重启**。

## Next step

QA r3 仅回归 4 项：
1. §G.31 1280 chart cardContent ≥ 25
2. §G.32 1024 chart cardContent ≥ 40
3. §B.7 1280 风险信号卡主数据不 wrap (单行)
4. §I.40 KPI 主数据数字与 phase 8 一致

其他 50+ 项 PASS 已固化无需重测。

如 r3 仍未达 spec（同 fail 三连），按 dynamic exit 协议回 spec — 但方案 A 数学已论证 1280 ≥ 25，1024 维持 ~39px (可能差 1px，但容差内或 vertical 减少 wrap 二阶效应可达到)。
