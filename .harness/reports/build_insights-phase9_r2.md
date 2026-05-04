# Build Report — insights-phase9 r2

**Date**: 2026-05-03
**Branch**: `claude/elastic-davinci-a0ee14`
**Builder**: claude-opus-4-7
**Round**: r2 (fixing r1 §G + §B BLOCKERs per [qa_insights-phase9_r1.md](qa_insights-phase9_r1.md))

## Summary

修 r1 双 BLOCKER：1024 视口 KPI 「完/成/率」垂直 wrap → 主体 grid 缩 → chart cardContent 退步至 4px。
**方案 A 应用**：1024 视口 KPI 卡 vertical layout + 隐藏 trailing；1280+ horizontal + 显示 trailing。

## What changed

`components/analytics-v2/kpi-row.tsx` — 2 处 className 改动：

```diff
// Card class
- "rounded-lg flex flex-row items-center gap-3 min-h-[88px] py-2.5 px-3 transition-colors"
+ "rounded-lg flex flex-col items-stretch gap-2 min-h-[88px] py-2.5 px-3 transition-colors min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-3"

// Trailing wrapper
- <div className="w-20 lg:w-24 h-12 shrink-0 self-center">{trailing}</div>
+ <div className="hidden h-12 shrink-0 self-center min-[1280px]:block min-[1280px]:w-20 min-[1440px]:w-24">{trailing}</div>
```

效果：
- **1024 视口**：KPI 卡 `flex-col` vertical layout（与 phase 8 等同），trailing 隐藏 (`hidden`)。主数据全卡宽显示，「完成率」三字单行。卡高度回到 phase 8 的 ~93px（不再 174.5px）。
- **1280 视口**：KPI 卡 `flex-row` horizontal layout，trailing 显示 (`min-[1280px]:block`) 宽 80px。完整 trailing visual。
- **1440 视口**：trailing 加宽到 96px (`min-[1440px]:w-24`)。

## 数学预期 (1024x768)

| 元素 | r1 (FAIL) | r2 (FIX) |
|---|---|---|
| KPI 卡高度 | 174.5px (wrap+horizontal) | ~93px (vertical, phase 8 同) |
| KPI row 总高 | 174.5 | ~93 (-81.5) |
| AI 教学建议 | ~100 (responsive 已生效) | ~100 (不变) |
| 主体 grid | 120.5 | ~202 (+81.5) |
| Score row (3/5) | ~72 | ~121 |
| CardContent (chart) | **4px ❌** | **~50px ✓** (≥ spec 40) |

## 数学预期 (1280x720)

| 元素 | r1 (FAIL) | r2 (FIX) |
|---|---|---|
| KPI 卡 | 88px horizontal | 88px horizontal (不变) |
| 主数据宽 | 145px (177-32) | ~145px (1280 视口宽 1280-32px gutters，4 卡每 ~308px，主数据 ~228px) |
| 主体 grid | ~163 | ~163 + AI 改善已包含 |
| chart cardContent | **9.89px ❌** | 预估 ~30px ✓ (≥ spec 25) |

注：1280 视口 KPI horizontal 已不 wrap（卡更宽，主数据 ~228px 充裕），方案 A 主要 fix 1024。1280 改善靠 AI max-h 已 responsive 触发（120px from 140 → -20px）。

## 1440 不退步保证

`min-[1440px]:w-24` 让 trailing 在 1440 仍 96px 宽（与 r1 一致）。Card flex-row + items-center + gap-3 在 1440 触发，与 r1 视觉等同。

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 warnings |
| `npx vitest run` | **822/822 passed**（不变）|
| Dev server hot-reload | 自动应用（纯 className）|

## Anti-regression

- **§A tsc / lint / vitest / build / no new deps**：全保留
- **§C-E trailing visual path**：「暂无趋势」/ pending list / risk list code 完整不动
- **§F service 4 新字段 + SQL**：不动
- **§I phase 1-8**：drawer 5 kinds / Filter / AI 4 cols / 主体 grid / LabelList / 老路由 / 隔离 全保留
- **phase 7 r2 fix**: dashboard.tsx L598 `h-[calc(100vh-3.5rem-3rem)]` 不动
- **§I.40 KPI 主数据数字**：仅 className 改动，主数据 / 主值 / sub / delta 内容 0 改动

## Things deferred / unsure

1. **1024 视口完全失去 trailing visual**：spec §B.7「数据格局不变」优先 — trailing visual 是新增功能，1024 视口隐藏不破坏现有数据格局，反而保护「完成率」单行不 wrap。如用户认为 1024 也应有 trailing，需要更激进的字体压缩 + grid-cols-2 fallback（远超本 phase 范围）。
2. **1280 视口 chart 改善估算保守**：r1 是 9.89px → r2 预估 ~30px。但 spec 要求 ≥ 25。如 QA 实测仍未达 25，可加 KPI `min-h-[80px]`（少 8px）或 grid-rows responsive (`min-[1280px]:grid-rows-[2fr_1fr]` 偏向 score row)。

## Dev server status

worktree 3031 PID 48954+49110 仍在跑，纯 Tailwind className 改动 hot-reload 无感。**不需要重启**。

## Next step

QA r2 仅回归 4 项：
1. §G.31 1280 chart cardContent ≥ 25
2. §G.32 1024 chart cardContent ≥ 40
3. §B.7 1024 KPI 主数据 width 足够「完成率」单行（≥ 100px）
4. §I.40 KPI 主数据数字与 phase 8 一致

其他 47 项 PASS 已固化无需重测。
