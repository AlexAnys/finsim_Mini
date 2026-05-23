# Build Report — analytics-cooldown r1 (含 r2 增量)

> Unit: `analytics-cooldown` · Round: r1 + r2 增量（同一 commit，amend） · Branch: `claude-analytics-cooldown` · Plan: 方案A (user-confirmed)
> Builder · 2026-05-23

## 概要

实现 spec 的两个耦合修复：
- **Bug A** — AI「重新生成」60s 冷却 scope-unaware → scope-aware（换范围不再被拦，同范围 60s 内仍拦）。
- **Bug B** — 「已有数据时的瞬时操作失败」触发顶层 `error` → 整页白屏 → 改为非阻塞 `toast.error`，保留已加载内容。覆盖 `refreshScopeInsights`（r1）+ `startRecompute`（r2，用户 2026-05-23 确认扩入）。

零签名改动、零 schema 改动、无 Prisma include 变化（运行时 500 风险低）。

## Files changed (git numstat)

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/scope-insights.service.ts` | +2 / -2 | 两处调用点把 `scopeHash` 拼进 feature 字符串 |
| `components/analytics-v2/analytics-v2-dashboard.tsx` | +5 / -3 | 引入 `toast`(sonner) + `refreshScopeInsights`(2) + `startRecompute`(2) 失败分支 `setError`→`toast.error` + 注释 ×2；startRecompute 多删 1 行无用 `setError(null)` |
| `tests/scope-insights.service.test.ts` | +38 / -0 | 新增 scope-aware 冷却 describe（RED→GREEN）+ import `__clearAiThrottleState` + beforeEach 清理 |

**净 diff = 45 insertions / 5 deletions = 50 行（< 150 ✅）**

## Bug A — 改动细节

`scope-insights.service.ts` 两处（`scopeHash` 已在各自函数顶部 line 153 / 832 计算，作用域内可取，无需重算）：

```
:158  assertAiFeatureCooldown(options.teacherId, "scopeInsights")           → `scopeInsights:${scopeHash}`
:837  assertAiFeatureCooldown(options.teacherId, "scopeTeachingAdvice")     → `scopeTeachingAdvice:${scopeHash}`
```

冷却 key 变为 `${userId}:scopeInsights:${scopeHash}` → 换范围(不同 hash)永不撞冷却；同范围 60s 内连点仍撞 1 次 = 用户要的「限制相同内容」。`assertAiFeatureCooldown` 函数签名 0 改动。

## Bug B — 改动细节

`analytics-v2-dashboard.tsx`：
- 新增 `import { toast } from "sonner";`（与项目既有 idiom 一致；`<Toaster/>` 已在 `app/layout.tsx` 全局挂载，本页 toast 会渲染）。
- `refreshScopeInsights()` 两个失败分支：`setError(...)` → `toast.error(...)`（非 success 分支 + catch 分支）。**r1**
- `startRecompute()` 两个失败分支(523/526)：`setError(...)` → `toast.error(...)`；并删除函数开头的 `setError(null)`（line ~513）——此函数不再写顶层 error，删之与 `refreshScopeInsights` 对称且无害（顶层 error 现由 courses/diagnosis fetch 各自管理）。**r2，用户确认**
- 顶层 `error` state + `<CenteredState>`(line ~637) **保留不动**，仅服务于「初次加载彻底失败」：courses fetch 失败(264/267)、diagnosis fetch 失败(349/354，伴随 `setDiagnosis(null)` 无数据可显示)。改后顶层 `setError` 仅余这 3 处 + 1 处 reload-clear(338)。
- `refreshScopeInsights` 是 `TaskPerformanceBlock.onRefresh`(663) 与 `TeachingAdviceBlock.onRefresh`(684) 共用的唯一重新生成 handler——两块的「重新生成」均已非阻塞，无独立 sibling handler。`startRecompute` 由 `InsightsFilterBar.onStartRecompute` 触发。

## TDD：RED → GREEN

新测试位置：`tests/scope-insights.service.test.ts` → `describe("getScopeSimulationInsights — scope-aware force cooldown")`。
经由真实调用点 `scope-insights.service.ts:158` 走 `ai-throttle.service` 真实 in-memory map（ai-throttle 未 mock）；`beforeEach` 调 `__clearAiThrottleState()` 防跨用例污染；`taskInstance.findMany` mock 为空 → fresh 路径提前返回，无需 mock AI。

### RED（修复前，call site 仍用 "scopeInsights" 无 scope）
```
 × does NOT throw cooldown when the SAME teacher forces a refresh on a DIFFERENT scope  6ms
 ✓ STILL throws cooldown when the SAME teacher forces a refresh on the SAME scope within 60s  1ms

 FAIL  tests/scope-insights.service.test.ts > ... > does NOT throw cooldown ... DIFFERENT scope
 AssertionError: promise rejected "Error: AI_FEATURE_COOLDOWN" instead of resolving
  ❯ tests/scope-insights.service.test.ts:188:5
 Caused by: Error: AI_FEATURE_COOLDOWN
  ❯ assertAiFeatureCooldown lib/services/ai-throttle.service.ts:29:11
  ❯ Module.getScopeSimulationInsights lib/services/scope-insights.service.ts:158:5
```
"DIFFERENT scope" 用例 RED 失败（=证明 scope-unaware bug）；"SAME scope" 用例已绿（=anti-spam 本就生效，须保留）。

### GREEN（call site 折入 scopeHash 后）
```
 ✓ tests/scope-insights.service.test.ts (12 tests | 10 skipped) 5ms
   Tests  2 passed | 10 skipped (12)
```

## Verify（worktree 内全量，r2 后重跑）

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run`（全量） | **109 files / 1132 tests passed, 0 fail**（baseline 1130 + 2 新增；`tests/ai-throttle.test.ts` 6 测试仍绿） |
| `npm run lint` | **0 errors**, 34 warnings（全部 pre-existing，位于 `tests/e2e/*.spec.ts`；我改的 3 个文件 0 warning） |

## Anti-regression grep

- `assertAiFeatureCooldown` 共 3 caller：`weekly-insight.service.ts:274`（`weeklyInsight`，**未触碰**，e2e unit11 429 行为不变）+ scope-insights 两处（本次改）。签名未改，无 caller 编译/行为破坏。
- `refreshScopeInsights` 仅 2 处引用（onRefresh×2），均已覆盖。
- `startRecompute` 仅 1 处引用（`InsightsFilterBar.onStartRecompute`），已覆盖；删 `setError(null)` 不影响其它路径（顶层 error 由 courses/diagnosis fetch 管理）。

## startRecompute 扩入说明（用户已批准）

r1 提交时将 `startRecompute()` 同款白屏隐患升级给 coordinator（未擅自改）。用户 2026-05-23 确认一并修：它属同一白屏 bug 类、同一筛选工具栏、用户高频操作。r2 已折入同款 `toast.error` 处理，并删除其无用的 `setError(null)`。spec 已由 coordinator 更新记录此次 scope 扩入。

## Dev server restart

**不需要**。无 `schema.prisma` 改动、无新 Prisma `include`/`select`、纯 service 逻辑 + 前端 React。运行时 500 风险低；权威验收为 QA `/qa-only` 真浏览器。

## 交接 QA 验证点

1. 改任务表现统计范围 → 点「重新生成」→ 不再出现「请稍后再试 60 秒」。
2. 同范围 60s 内连点「重新生成」→ 仍提示冷却，但以 toast 形式，**已加载内容保留，绝不白屏**。
3. 教学建议块换范围「重新生成」同样不被拦（共用同一 handler + 837 已修）。
4. 「后台重算」(startRecompute) 失败 → 同样 toast 提示，**已加载内容保留，绝不白屏**。
5. `weeklyInsight` 冷却回归：e2e unit11 仍应 429。
6. 若 QA 真实触发 AI 生成产生 `AnalysisReport` 测试行，按 spec #8 评估清理。
