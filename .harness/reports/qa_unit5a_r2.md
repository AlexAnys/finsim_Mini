# QA Report — Unit 5a r2

> QA: qa · 2026-05-14 · 验 r2 commit `a1a9c2e`（建立在 r1 commit `e217835`）on `claude-demo-fixes`
> r2 任务：修 r1 Finding A — `/teacher/tasks/[id]` 对有 instance 的 task 从 hidden → disabled + Tooltip
> Test spec: `tests/e2e/qa-unit5a-r2-spotcheck.spec.ts` (4 case，独立于 builder unit5a-verify.spec.ts I)
> 截图: `.harness/screenshots/qa-unit5a-r2/`

## r2 Acceptance 对照

| QA Finding A 期望 | 验法 | 实测 | Verdict |
|---|---|---|---|
| 按钮可见但 disabled（不再 hidden）| molly login → `/teacher/tasks/${has-instance}` → 抓「删除任务」按钮 + check `isDisabled()` | button count = 1 (可见 ✓)；`isDisabled()` = true ✓ | PASS |
| Tooltip 文案显示具体原因 + 实例数 | hover `span[data-slot="tooltip-trigger"]` (Radix 标准模式) → 抓 `[role="tooltip"]` 文本 | tooltip text = **"该任务已发布 1 个实例，请先删除实例再删任务"** 精确匹配 | PASS |
| UI 与 Unit 2 / Unit 5a 列表 disabled+Tooltip 模式一致 | 检查 DOM 结构 `<span data-slot="tooltip-trigger"><Button disabled>...</Button></span>` | tooltip-trigger wrapper count = 1，与 Unit 2 `instance-header.tsx` + Unit 5a 列表 `teacher-course-card.tsx` 同款 Radix 模式 | PASS |

## R1 spot-check（按 coordinator 范围，不重跑整套）

| 检查项 | 验法 | 实测 | Verdict |
|---|---|---|---|
| 0 instance task 删除按钮仍可点 + dialog 正常 (regression) | POST dummy 0-instance task → 进 page → 抓 button + click → dialog | button count = 1, disabled = false；dialog text = "删除任务模板·确认删除「QA-r5a-r2-B-...」？此操作不可恢复。如果任务已发布过实例，将被服务端拒绝。·取消·确认删除"；cleanup DELETE 200 | PASS |
| API DELETE has-instance task 仍 400 + 中文错误 (regression) | molly DELETE `3e26c6d2` | 400 + `TASK_HAS_INSTANCES` + "该任务已发布过实例，无法删除。请先到「任务实例」中删除所有实例后再试。" — 与 r1 一致 | PASS |
| 课程详情页删除 dialog 仍正常 (regression) | molly 进 `/teacher/courses/${has-chapters}` → 删除 → dialog 文案 | dialog text = "删除课程·确认删除「个人规划」？此操作不可恢复。如果课程下有章节或任务实例，将被服务端拒绝并提示原因。·取消·确认删除" — 与 r1 一致 | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 83 files / 986 tests pass (与 baseline 一致) |
| `npx eslint <2 builder files + QA spec>` | 0 problem |
| `git show --stat a1a9c2e` | 2 files +55/-1 (page.tsx +24/-1 + e2e +31) — 与 build 报告一致 |
| cross-module | r2 仅触及 page.tsx UI 层 + e2e — service/route/schema 0 改动 |
| DB 状态测前测后 | molly 3 tasks × 1 instance 维持 baseline，dummy task B 已 cleanup |

## DOM 结构对比 (一致性证据)

| 文件 | Pattern |
|---|---|
| `components/instance-detail/instance-header.tsx` (Unit 2) | `<Tooltip><TooltipTrigger asChild><span class="inline-flex"><Button disabled>...</Button></span></TooltipTrigger><TooltipContent>...</TooltipContent></Tooltip>` |
| `components/teacher-courses/teacher-course-card.tsx` (Unit 5a 列表) | 同款 |
| `app/teacher/tasks/[id]/page.tsx` (Unit 5a r2) | 同款 ✓ |

UI 一致性问题已完整修复。

## 是否引入新 bug

无。r2 是纯 UI 条件分支重构 (hidden → disabled+Tooltip)，service/API/schema 0 改动。既有 vitest 986 全过，r1 acceptance 全 spot-check 通过。

## Issues found

无。

## Overall: **PASS**

**判断标准对照 (r1 即收三条件)**：
1. ✅ QA 4 case (Finding A 修复 + 0 instance 回归 + r1 API spot-check + r1 course dialog spot-check) vs builder 1 case (I) — 独立证据链
2. ✅ tooltip text / disabled state / button count / dialog text / error code 全 deterministic
3. ✅ DB cleanup 干净 (dummy task B DELETE'd + molly baseline 维持)

**建议**：r2 标 PASS，Unit 5a 整体 completed。下一步 Unit 5b（Study Buddy 删除 + Submission 撤销批改）。
