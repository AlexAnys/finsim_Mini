# Unit 1 Plan — KPI Hydration + 一周洞察 Dialog A11y

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 1
> Bugs: B-INSIGHT-01 (P0) + B-DASH-02 dialog 部分 (P1)

## 改动文件清单

| 文件 | 改/不改 | 原因 |
|---|---|---|
| `components/analytics-v2/kpi-row.tsx` | **改** | B-INSIGHT-01 嵌套 `<button>` 根因 |
| `components/teacher-dashboard/weekly-insight-modal.tsx` | **不改**，仅 verify | 当前文件已经有 `aria-describedby="weekly-insight-desc"` + 对应 `<DialogDescription id="...">`，判断 bug-inventory 证据是 batch1/2 修复前的 |

注：spec 写的路径 `components/teacher/analytics-v2/kpi-row.tsx` 和 `components/dashboard/weekly-insight-modal.tsx` 与代码实际路径不一致；实际路径以代码为准。

## 关键改动思路

### Bug 1 — B-INSIGHT-01：嵌套 `<button>`

**根因**（`components/analytics-v2/kpi-row.tsx`）：
- `KpiCard` 当 `onClick` 存在时（L190-199），把整张卡片用 `<button onClick={...}>` 包裹。
- 卡片内部有两类违反"`<button>` 不能嵌套交互元素"的子节点：
  1. L143-150：Info tooltip trigger 是另一个 `<button>`（嵌 `<button>` 违法）
  2. L267-273：「去发布」是 `<Link href>`，渲染 `<a>`（嵌 `<a>` 在 `<button>` 内也违法）

**修法**：把外层 `<button>` 换成可点的 `<div>`：
- `role="button"`、`tabIndex={0}`
- `onClick={onClick}`、`onKeyDown` 监听 Enter/Space 触发 `onClick`（保 a11y 等价键盘体验）
- 样式保留：`cursor-pointer`、`w-full`、`text-left`、`rounded-lg`、`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`

不动内层 Info button + Link（它们都已有 `e.stopPropagation()`，不会冒泡到外层 div）。

### Bug 2 — B-DASH-02：dialog A11y

**当前状态**：weekly-insight-modal.tsx 已经合规
- DialogContent 显式传 `aria-describedby="weekly-insight-desc"`（L86）
- DialogDescription 显式 `id="weekly-insight-desc"`（L92），且无条件渲染（不在 `loading/error/data` 分支内）

**策略**：不改代码，浏览器实测确认 console 已经 0 条 a11y warning。若意外仍报，再 `/investigate` 追根因（可能是其他 modal 干扰，但 dashboard 当前仅此一处 Dialog）。

## 风险点

1. **键盘语义变化**（极低）：原 `<button>` 默认监听 Enter/Space；改 `<div role="button">` 后需手动加 `onKeyDown` 处理，已计划。
2. **`type="button"` 不再适用**：`<div>` 没有提交副作用，反而更安全（原 `<button>` 在某些表单上下文有 submit 风险，本组件不在表单内）。
3. **screen reader 体验**：`<div role="button" tabIndex={0}>` 与 `<button>` 在 SR 上等价，KPI 卡可读 label + value。
4. **CSS 兼容**：现有 `text-left focus-visible:* w-full` 在 `<div>` 上一样生效（之前 `<button>` 的 `text-align` 是浏览器默认 center，已显式 `text-left` 覆盖；`<div>` 默认 `text-align: start` 等于 `left`，行为不变）。

## 自测计划

1. `npx tsc --noEmit`（全项目 type check）
2. `npx vitest run`（全套单测）
3. 浏览器实测（molly@qq.com / 123456）：
   - 登录 → `/teacher/analytics-v2` → F12 console 应 0 条 `<button> cannot be a descendant of <button>` warning
   - 登录 → `/teacher/dashboard` → 点"一周洞察" → console 应 0 条 `Missing Description or aria-describedby` warning
   - 4 张 KPI 卡逐个点击 → 进 drilldown 抽屉/页（功能不变）
   - 4 张 KPI 卡逐个 Tab focus → Enter / Space 也触发同样跳转（键盘等价）
4. dev server 不重启（未改 schema）

## diff 预算

单 commit，预计 ≤ 30 行 diff（仅改 `KpiCard` 渲染层）。
