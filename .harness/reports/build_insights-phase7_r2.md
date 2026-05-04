# Build Report — insights-phase7 r2

**Date**: 2026-05-03
**Branch**: `claude/elastic-davinci-a0ee14`
**Builder**: claude-opus-4-7
**Round**: r2 (fixing r1 §C BLOCKER per [qa_insights-phase7_r1.md](qa_insights-phase7_r1.md))

## Summary

修复 r1 唯一 BLOCKER：§C.14-16 单屏 UX 三视口 +24px 溢出。**单行 diff** — 修正 `h-[calc(...)]` 主容器高度，匹配 teacher layout chrome 实际尺寸。

## What changed (单行 diff)

`components/analytics-v2/analytics-v2-dashboard.tsx:598`：

```diff
- "h-[calc(100vh-var(--header-h,4rem)-1rem)]",
+ "h-[calc(100vh-3.5rem-3rem)]",
```

| 项 | r1 (FAIL) | r2 (FIX) |
|---|---|---|
| Header 减去 | `var(--header-h, 4rem)` = 64px (假设值) | `3.5rem` = 56px (实测 sticky header h-14) |
| Padding 减去 | `1rem` = 16px (估值) | `3rem` = 48px (p-6 上下 = 24+24) |
| 合计减去 | 80px | 104px ✓ 匹配实测 chrome |

QA 实测 r1 主容器算 `100vh - 80px` 而 chrome 占 104px → 差 24px = 实测 overflow。
r2 主容器算 `100vh - 104px` = chrome 实际值 → overflow = 0。

## Why hardcoded values vs CSS var

CSS var `--header-h` 定义未在 globals.css / teacher layout 提供（grep 全仓 0 命中），fallback `4rem`/64px 不匹配实际 56px sticky header。短期硬编码精确值更可靠；长期可在 layout.tsx 加 `--header-h` CSS var 给 dashboard 统一引用，但属于 chrome refactor，phase 7 范围外。

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 warnings |
| Dev server hot-reload | 自动应用（纯 tailwind class，无需重启） |

## Anti-regression

- 仅触动一行 className，**所有其他 r1 实现 0 改动**
- §B / §D-§J / §K Anti-regression 全部 r1 PASS 项继续保留
- vitest / build 不需重跑（无逻辑变化）

## Dev server status

不需重启（QA 已确认 hot-reload 即可，纯 className 改动）。worktree 3031 上的 PID 48954+49110 仍在跑。

## Next step

QA `/qa-only` 回归 3 项 §C.14-16 三视口（1440/1280/1024）overflow ≤ 5px。其他 62 项已固化无需重测。

PASS 后按 spec §提交策略 atomic 4 commits 一次性提交。
