# Unit 14 Plan — 学生 dashboard 折叠 + AI callout 视口

## 改动

| 文件 | 改动 |
|---|---|
| `components/dashboard/priority-tasks.tsx:158` | `max-h-[520px] overflow-y-auto` 改为 `slice(0,5)` 截断 + 底部加 "查看全部 N 项 →" Link → `/tasks` |
| `components/dashboard/ai-buddy-callout.tsx:27` | compact 模式 className 去 `hidden ... xl:flex`，改为 `flex` (所有视口可见) |
| `tests/e2e/unit14-verify.spec.ts` 新 | (A) student dashboard 学习任务卡只渲染 ≤5 项 + "查看全部" 按钮；(B) compact callout 在 360px / 1280px 都 visible |

## 决策

- 5 项上限按 spec 字面（与 Unit 7 dedup `count=4` 类似的"卡牌列表"模式）
- "查看全部"按钮 Link 到 Unit 3 加的 `/tasks` 页（任务中心，4 tab）
- 视口检查：playwright `setViewportSize({width: 360, height: 800})` + `({width: 1280, height: 800})`
- 不动 callout 的 non-compact 渲染（hero 之外路径不变）

## 风险

- 🟢 schema 0 改动
- 🟢 priority-tasks `filter` UI 保留，只在 filtered 数组之上 slice(0,5)；filter 切换仍正常
- 🟢 callout hidden xl:flex 一行 className 改动，无逻辑变动

预计 ~30 行 prod + ~80 e2e / r1 即收概率高。
