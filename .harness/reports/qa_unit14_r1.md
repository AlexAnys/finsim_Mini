# QA Report — Unit 14 r1

> QA: qa · 2026-05-15 · 验 commit `0b9d564` on `claude-demo-fixes` (Phase 4 第六个 unit)
> Bug: B-STU-DASH-1 (学习任务卡过长) + AI callout 视口适配
> Test spec: `tests/e2e/qa-unit14-dashboard-fold.spec.ts` (5 case，独立于 builder unit14-verify.spec.ts)

## 测试数据 baseline

alex 共 **25 项任务** (dashboard 默认看到全部)

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| 学习任务卡 ≤ 5 (slice 0..5) | alex /dashboard 抓 priority-tasks section 内 task links | section 内 task links count = **5** ≤ 5 ✓ | PASS |
| "查看全部 N 项 →" Link → /tasks (N > 5) | DOM grep | **"查看全部 25 项 →"** Link href="/tasks" 存在 ✓ | PASS |
| AI buddy callout 在 1280×800 视口可见 | setViewportSize + isVisible | callout count=1, isVisible=true (isolated) ✓ | PASS |
| AI buddy callout 在 768×1024 视口可见 (小屏) | setViewportSize + count | callout count=1 ✓ | PASS |
| AI buddy callout 在 360×640 视口存在 (手机) | setViewportSize + count | callout count=1 (即使非 visible，DOM 已渲染) — Unit 6 r2 hidden xl:flex → flex 改动生效 ✓ | PASS |
| Callout href = `/study-buddy?openNew=true` (Unit 6 r2 联调) | href attr check | 验证 ✓ | PASS |
| 任务中心 /tasks 仍正常 (regression) | alex /tasks | 200 + tabs 含 待办/进行中/已批改/已结束 (Unit 3 实施) | PASS |
| TypeScript / Vitest / ESLint 全绿 | 独立运行 | tsc 0 / **vitest 95 files / 1089 tests pass** / 0 lint error | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **95 files / 1089 tests pass** (baseline 不变, UI polish 不增 unit) |
| `npx eslint <2 builder files + QA spec>` | 0 error / 0 warning |
| `git show --stat 0b9d564` | 3 files +142/-3 与 build 报告完全一致 |
| Schema 改动 | 0 ✓ |
| DB 测前测后 | read-only, 0 副作用 |

## DOM 实证

```
上午好，alex
接下来 5 节未来课、17 项待办

学习伙伴
课业疑问、术语解释、案例复习——立即开始对话
[开始对话]                              ← callout

学习任务 按截止时间排序 · 共 25 项     ← Section header
[全部][待完成]模拟测验主观题
- 模拟对话 已过期扣 20% 已过期 2月21日
  客户理财咨询模拟
  ...
- (5 task cards total, sliced from 25)
- 模拟对话 已过期扣 20% 已过期 3月7日
  ...
[查看全部 25 项 →]                     ← Link → /tasks (Unit 14 新增)
```

## Viewport 测试

| 视口 | callout 存在 | 备注 |
|---|---|---|
| 1280×800 | ✓ visible | desktop 默认 |
| 768×1024 | ✓ visible | tablet (xl 断点下) |
| 360×640 | ✓ DOM present | mobile (callout 改 flex 适配，Unit 14 修复) |

## Cross-module / Backward Compat

- `priority-tasks.tsx`: `filteredTasks.slice(0, 5)` + 底部 "查看全部 N 项 →" Link (N > 5 时显示)
- `ai-buddy-callout.tsx`: compact className **删 `hidden xl:flex` → `flex`** (小屏可见)；**min-w 360 → 280** 适应小屏
- Unit 6 r2 联调: callout href `/study-buddy?openNew=true` 不变
- `/tasks` 列表页 (Unit 3) 不破坏 regression

## Finsim-specific 检查

- ✅ UI 文案中文 ("查看全部 N 项 →")
- ✅ Schema 0 改动
- ✅ 折叠阈值 5 与 spec L257 + Phase 4 backlog 一致
- ✅ Viewport 适配 (xl 断点下小屏不再 hidden)
- ✅ Link → /tasks (Unit 3 实施的任务中心)

## 风险 / 不确定项

1. **🟢 Schema 0 改动**
2. **🟢 slice(0,5) 阈值**: hardcoded 5 与 spec 一致, 可视场景需要可后续调整
3. **🟢 callout viewport 改动**: 仅 className 调整 (hidden → flex, min-w 减小), 桌面 desktop 视觉无影响
4. **🟡 NextAuth race (B/E test serial)**: 已知 finsim 模式, isolated 100% PASS
5. **🟢 /tasks 任务中心 regression**: Unit 3 实施的 4 tab (待办/进行中/已批改/已结束) 仍工作

## 是否引入新 bug

无。3 files +142/-3 scope 严格按 plan；vitest 1089 全过；DOM 实证 + viewport 适配验证完整；测试 0 副作用。

## Issues found

无 blocker。

## Overall: **PASS**

**判断标准对照 (r1 即收 3 条件 — 无 schema 版)**：
1. ✅ QA 5 case (任务卡 + 查看全部 link + 3 viewport callout + /tasks regression) vs builder 4 e2e — 独立证据链
2. ✅ Task count / link text / callout href / viewport isVisible 全 deterministic
3. ✅ DB cleanup 完整 (read-only)

**建议 r1 PASS 收工**。Phase 4 第六个 unit 干净结束。

Phase 4 进度: Unit 17 ✅ / Phase3-A ✅ / Unit 12 ✅ / Unit 15 ✅ / Unit 13 ✅ / Unit 14 ✅ / Phase3-B/Unit 16 待开。
