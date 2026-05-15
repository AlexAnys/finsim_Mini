# Build Report — Unit 1 Round 1

> Builder: builder · 2026-05-14 · Commit `ded6042` on `claude-demo-fixes`
> Plan: `.harness/plans/unit1_plan_r1.md`
> Bugs: B-INSIGHT-01 (P0) + B-DASH-02 dialog 部分 (P1)

## 改动文件

| 文件 | 变化行数 | 说明 |
|---|---|---|
| `components/analytics-v2/kpi-row.tsx` | +9 / -2 | `<button>` → `<div role="button" tabIndex={0}>` + `onKeyDown` Enter/Space |
| `components/teacher-dashboard/weekly-insight-modal.tsx` | +1 / -2 | 删手写 `aria-describedby` + `id`，让 Radix 自动联通 |
| `tests/e2e/unit1-verify.spec.ts` (新) | +175 | 4 断言：嵌套 button / a11y warning / 点击 drilldown / 键盘等价 |

## 关键决策

### Bug 1 — B-INSIGHT-01 嵌套 `<button>`

外层 `KpiCard` 当 `onClick` 存在时由 `<button>` 改 `<div role="button" tabIndex={0}>`：
- 配 `onKeyDown` 监听 Enter/Space（`preventDefault` + 触发 `onClick`），SR + 键盘体验与原 `<button>` 等价
- 内层 Info tooltip 按钮 + "去发布" Link 保持不变（已有 `e.stopPropagation`）
- CSS 不变（`text-left focus-visible:* w-full rounded-lg`）

### Bug 2 — B-DASH-02 dialog a11y warning（**意外的根因**）

**计划阶段判断错误**：plan 写"当前文件已合规，仅 verify"。e2e 实测才发现：尽管 weekly-insight-modal 同时显式传了 `aria-describedby="weekly-insight-desc"` 给 DialogContent + `id="weekly-insight-desc"` 给 DialogDescription，但 Radix Dialog 内部还是会触发 2 条 `Missing Description or aria-describedby` warning。

**真根因**（读了 `node_modules/@radix-ui/react-dialog/dist/index.js`）：
1. Radix DialogContent 在 L277 默认设 `aria-describedby={context.descriptionId}`（auto-generated，如 `radix-_r_5_`），但 spread 的 `...contentProps` 在后面，所以我们的手写 `aria-describedby="weekly-insight-desc"` 覆盖了它
2. Radix DialogDescription 在 L308 默认设 `id={context.descriptionId}`，但我们的手写 `id="weekly-insight-desc"` 也覆盖了
3. DescriptionWarning (L354-364) 拿 DOM 上的 `aria-describedby`（= "weekly-insight-desc"）但用 `context.descriptionId`（= "radix-_r_5_"，从未出现在 DOM）去 `getElementById`，找不到 → 误触发 warning

**修法**：删手写 `aria-describedby` + `id`，让 Radix 全自动联通（DialogDescription 自动注册到 context、DialogContent 自动指向同 id）。DOM 语义不变（仍然有 `<p data-slot="dialog-description">` + `aria-describedby` 链接），且无 warning。

## 自测结果

### TypeScript
```
npx tsc --noEmit
# (no output, clean)
```

### Vitest
```
Test Files  83 passed (83)
Tests       981 passed (981)
Duration    4.18s
```

### Playwright E2E（`tests/e2e/unit1-verify.spec.ts` × 4 case）
```
✓ Unit 1 A: /teacher/analytics-v2 应无 nested button hydration warning (6.8s)
  nested-button warnings: 0
  total error/warning/pageerror: 0
✓ Unit 1 B: 仪表盘打开一周洞察 modal 应无 a11y warning (8.2s)
  一周洞察 button count: 1
  dialog count after click: 1
  a11y warnings: 0
✓ Unit 1 C: KPI 卡片仍可点击进 drilldown (功能不变) (7.9s)
  KPI card[role=button] containing 完成率: 1
  drawer/dialog count after click: 2  # drilldown drawer 已打开
✓ Unit 1 D: KPI 卡片支持键盘 Enter 触发 (a11y 等价) (7.2s)

4 passed (31.5s)
```

截图保存 `.harness/screenshots/unit1-verify/`。

## 是否需要重启 dev server

不需要。无 schema 改动；纯前端组件改 + 一个新 e2e spec。

## 风险 / 不确定项

- 无。改动 scope 限于两个文件 + 一个 e2e spec。
- Radix Dialog 的 auto-link 是稳定 API（v1.x 几个版本一致），不依赖未文档化行为。
- 全套 vitest 981 个不受影响，无回归。

## Acceptance 对照

| spec acceptance | 状态 |
|---|---|
| 进 `/teacher/analytics-v2` 控制台 0 条 `<button> cannot be a descendant of <button>` warning | ✅ Unit 1 A 验证通过 |
| 一周洞察 modal 打开时 0 条 `Missing Description or aria-describedby for {DialogContent}` warning | ✅ Unit 1 B 验证通过 |
| KPI 卡仍可点击进 drilldown（功能不变） | ✅ Unit 1 C 验证通过 |
