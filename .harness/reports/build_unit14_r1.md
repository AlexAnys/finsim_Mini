# Build Report — Unit 14 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit14_plan_r1.md`
> Bugs: B-STU-DASH-1 + B-STU-DASH-3

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `components/dashboard/priority-tasks.tsx` | +15 / -2 | `max-h-[520px] overflow-y-auto pr-1` 改为无 max-h；`filteredTasks.map` 加 `.slice(0,5)`；底部加 "查看全部 {N} 项 →" Link → `/tasks`（仅当 filteredTasks.length > 5 时显示） |
| `components/dashboard/ai-buddy-callout.tsx` | +2 / -1 | compact className 去 `hidden ... xl:flex` 改 `flex`；`min-w-[360px]` 改 `min-w-[280px]` 适应小屏 |
| `tests/e2e/unit14-verify.spec.ts` (新) | +124 | 4 case (A1 ≤5 卡 + 查看全部 / B1 1280px callout visible / B2 360px / B3 768px) |

**生产代码**：17 / -3
**测试**：124
**Total**：~141（plan 估 30 prod + 80 e2e = 110，命中）

## 关键决策实施（按 coordinator 批准）

1. ✅ **slice(0,5) + 查看全部 Link** — filter UI 保留，slice 在 filtered 之后
2. ✅ **查看全部 → /tasks** — Unit 3 加的任务中心 4 tab
3. ✅ **callout hidden xl:flex → flex** — 所有视口可见（移动 + 平板 + 桌面）

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 95 files / 1089 tests pass (baseline, UI polish 不增 unit)
eslint: 0 new issue
```

### Playwright E2E (4 cases)
```
[A1] student dashboard 学习任务卡 ≤5 项 + "查看全部 N 项 →" Link: ✓ isolated (11.4s) — total=17 项时显示 "查看全部 17 项 →"
[B1] callout compact 在 1280px (xl) visible: ✓ (within serial)
[B2] callout compact 在 360px (mobile) visible: ✓ (within serial)
[B3] callout compact 在 768px (tablet) visible: ✓ (within serial)

Serial 3/4 PASS + 1 race-isolated PASS (NextAuth)
```

### 截图
- `.harness/screenshots/unit14-verify/A1-priority-tasks.png` — alex dashboard 显示 5 个任务卡 + "查看全部 17 项 →" link + greeting 右上 callout 可见
- `.harness/screenshots/unit14-verify/B1-callout-1280.png` — 1280px 视口 callout 可见
- `.harness/screenshots/unit14-verify/B2-callout-360.png` — 360px 视口 callout 可见

## 风险 / 不确定项

1. **🟢 schema 0 改动**
2. **🟢 filter UI 保留** — slice 在 filtered 数组之上，切 filter 仍按当前 filter 显示前 5 项
3. **🟢 min-w-[280px]** — 适应小屏不溢出（原 360px 在 < 360 视口会触发 horizontal scroll）
4. **🟢 callout non-compact 路径不变** — hero accessory 之外渲染不受影响

## Acceptance 对照

| 要求 | 状态 |
|---|---|
| 学生 dashboard `priority-tasks` 仅显示前 5 项 | ✅ slice(0,5) |
| 底部 "查看全部 → /tasks" 按钮 | ✅ Link 显示在 N > 5 时 |
| AI buddy callout compact 在 < xl 可见 | ✅ hidden xl:flex → flex |
| 底部 fallback callout 不重复 | ✅ dashboard 只有 1 处 callout（greeting accessory），无 fallback 重复 |
| tsc / vitest / lint 全过 | ✅ |

## 不在本范围

- ❌ priority-tasks 加分页 / virtual scroll（5 项 + Link 已够 demo）
- ❌ callout non-compact 渲染调整
- ❌ /tasks 列表页 UI 改造（Unit 3 已建）

## 反思

- `min-w-[280px]` vs 360px 是隐藏风险 — 原 360 视口若卡 0px 子元素就会溢出。改 280 在 360px 视口 horizontal scroll 不触发
- callout 的 className 单行 fix + 跨 3 视口 e2e 验证是 polish 单元的标准模板
- 5 项截断 + "查看全部" 比"无折叠 scroll" 更 demo-friendly — 一屏看到 5 项 + 显式跳列表页 vs 滚动内嵌 22 项
