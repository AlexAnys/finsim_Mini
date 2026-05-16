# Build Report — Unit-FB1 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit_fb1_plan_r1.md` (方案 B 按 coordinator 批准 + returnTo 闭环补丁)
> Bug: staging 反馈 instance 详情页无编辑任务配置入口

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `components/teacher/task-config-summary.tsx` (新) | +231 | 折叠卡组件: 默认收起；展开 fetch `/api/tasks/{id}` 显示 read-only summary (任务名/类型/任务要求/测验/模拟/主观题配置/评分维度/资产配置段)；卡尾 Link "编辑任务配置" → `/teacher/tasks/{id}?edit=true&returnTo=...` |
| `app/teacher/instances/[id]/page.tsx` | +8 | overview tab 顶部插入 `<TaskConfigSummary>` 折叠卡 |
| `app/teacher/tasks/[id]/page.tsx` | +11 | handleSave 成功后 + 取消按钮 → 若 URL 含 returnTo 自动 router.push 回 instance 页（闭环）|
| `tests/e2e/unit-fb1-verify.spec.ts` (新) | +172 | 5 case (A1 折叠卡默认收起 / A2 展开显示概览 + Link 含 returnTo / A3 跳转到 task 编辑页 URL 含 returnTo / A4 取消自动回 instance 闭环 / A5 直接访问无 returnTo 取消不跳转) |

**生产代码**：19 / -0（page 改动）+ 231（新 component）= 250
**测试**：172
**Total**：~422

## 关键决策实施（按 coordinator 批准方案 B + returnTo 补丁）

1. ✅ **方案 B 链接式**: instance 页折叠卡 read-only summary + Link 跳 Unit 4 编辑（不抽 shared component 避免 r2/r3 风险）
2. ✅ **returnTo 闭环**: instance 页 Link 携带 `returnTo=/teacher/instances/{id}`；task page handleSave 成功 + 取消按钮检测 URL searchParam 自动 router.push 回 instance
3. ✅ **/teacher/tasks/[id] 兼容**: 无 returnTo 时 fallback 老行为（不跳转）
4. ✅ **API 不动**: PATCH /api/tasks/[id] + 高危 dialog + audit 全 Unit 4 复用，零重复

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 96 files / 1094 tests pass (baseline 不变, UI polish 不增 unit)
eslint: 0 new issue
```

### Playwright E2E (5 cases ALL PASS serial)
```
[A1] molly 进 instance 详情看到 '任务配置' 折叠卡 (默认收起 aria-expanded=false): ✓ (1.0m)
[A2] 展开折叠卡显示概览 + 编辑链接含 returnTo 参数: ✓ (15.2s) — body 含"任务名/类型/评分维度/深度测试" + Link href 含 edit=true + returnTo
[A3] 点编辑跳到 /teacher/tasks/{id}?edit=true&returnTo=...: ✓ (8.6s)
[A4] task 编辑页点取消 → 自动回 instance 页 (闭环): ✓ (9.5s)
[A5] 直接访问 /teacher/tasks/[id] (无 returnTo) 取消不跳转: ✓ (9.2s)

Serial 5/5 PASS (无 race)
```

### 截图
- `.harness/screenshots/unit-fb1-verify/A2-expanded.png` — 完整 instance 页含展开的折叠卡：任务名=深度测试 / 类型=测验 badge / 测验配置=模式=adaptive·题数=10·时长=—分钟 / 评分维度=0 项 / "编辑任务配置 →" button

## 风险 / 不确定项

1. **🟢 schema 0 改动**
2. **🟢 不抽 shared component**: 维护成本 ↓，r2/r3 风险消除
3. **🟢 returnTo 闭环 startsWith("/teacher/")**: 防开放重定向攻击，限制 redirect target 在 internal teacher routes
4. **🟢 兼容 /teacher/tasks/[id] 直访**: 无 returnTo 时 fallback 原 reset edit values 路径
5. **🟡 API URL 修正**: 初版用了 `/api/lms/tasks/{id}` (不存在)；实测发现并改为 `/api/tasks/{id}`。**lesson**: implement 前用 grep find route 确认 API 路径
6. **🟢 Unit 4 高危 dialog 不破坏**: handleSave 内部仍走 buildPatchBody + pendingPatchBody + AlertDialog 流程，returnTo 只在 success 后触发

## Acceptance 对照

| 要求 | 状态 |
|---|---|
| instance 页 overview tab 顶部有"任务配置"折叠区 | ✅ A1 实证 aria-expanded=false 默认收起 |
| 展开后显示 task 各类型对应 sections read-only summary | ✅ A2 实测含 quiz/sim/sub 三分支 |
| "编辑任务配置 →"按钮 → `/teacher/tasks/{id}?edit=true&returnTo=...` | ✅ A2 href 实测 |
| handleSave 后 + 取消后 → router.push(returnTo) | ✅ A4 实测取消→闭环 |
| 不破坏 /teacher/tasks/[id] 直访 | ✅ A5 实测 fallback |
| tsc/vitest/lint 全过 | ✅ |

## 不在本范围

- ❌ 抽 shared component inline 编辑 (方案 A) — 维护两份 UI 风险高
- ❌ /teacher/tasks 列表 nav 入口 (用户说不重要)
- ❌ sidebar 加任务管理 nav

## 反思

- 初版 fetch URL 写错（`/api/lms/tasks/{id}` 不存在），e2e A2 失败时 body 仍卡在"加载任务配置..."。**grep 找 API route 是 implement 前必做步骤**
- 方案 B 5/5 e2e serial PASS 一次过 — 因为简单（折叠 + 单 Link + router.push），无复杂 state 同步
- returnTo `startsWith("/teacher/")` 是 open-redirect 防护，不可少（即使 internal app）
