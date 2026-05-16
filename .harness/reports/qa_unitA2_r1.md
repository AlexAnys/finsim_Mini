# QA Report · Unit A2 · Round 1

> qa@instance-workbench · 2026-05-15
> Build: `97ed850 feat(unit-A2): 实例标题 inline 编辑 + 全局同步`
> Plan: `.harness/plans/unitA2_plan_r1.md`
> Build report: `.harness/reports/build_unitA2_r1.md`

## Acceptance 检查

| # | Acceptance | Verdict | Evidence |
|---|---|---|---|
| 1 | overview 标题右侧 inline rename（pen icon） | **PASS** | `components/instance-detail/instance-header.tsx:77-206` `EditableTitle` 子组件含 `Pencil` icon (L149)；非编辑态渲染 h1 + pen button；点击 startEdit → 切到 Input+保存/取消 |
| 2 | 保存写入 `instance.title`（调 PATCH /api/lms/task-instances/[id]） | **PASS** | `app/teacher/instances/[id]/page.tsx:236-252` `handleTitleSave` 调 `fetch(.../{id}, PATCH, body={title})`；服务端复用现成 `updateTaskInstanceSchema` (`task.schema.ts:138`) + `updateTaskInstance` service (L252)，零后端改动 |
| 3 | 5 个展示位显示新标题（dashboard/tasks/instances/grades/sidebar） | **PASS** | 全部从 `instance.title` 读：<br>① dashboard 薄弱任务 `weak-instances.tsx:46` `{w.title}` ← `teacher-dashboard-transforms.ts:198` `ti.title ?? task.taskName`<br>② `/teacher/tasks` 详情 `tasks/[id]/page.tsx:804` `{ti.title}`<br>③ `/teacher/instances` 列表 `course-instances-tab.tsx:197` `{inst.title}`<br>④ `/grades` `(student)/grades/page.tsx:83` `t.title` from `/api/lms/dashboard/summary`<br>⑤ breadcrumb `instance-header.tsx:265` `{instance.title}` |
| 4 | vitest 新增 ≥1 | **PASS** | `tests/instance-header-editable-title.test.ts` 7 个测试（valid/empty/200/201/Chinese/non-string/optional）覆盖 `updateTaskInstanceSchema` title 契约 |

## 自动化测试

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（全项目） | 6 errors **全部 pre-existing**，与 A2 无关 |
| `npx vitest run tests/instance-header-editable-title.test.ts` | ✅ 7/7 PASS (9ms) |
| `npx vitest run`（全 suite） | ✅ **988/988 PASS, 84/84 files**, 0 regression |

### Pre-existing tsc errors 验证

6 errors 全部在 `app/api/lms/study-buddy/analytics/route.ts` + `lib/services/study-buddy.service.ts`。git blame line 80 显示 `e3115712 AlexAnys 2026-05-02 22:51:51` — **比 A2 commit (`97ed850`, 2026-05-15) 早 13 天**，确认为 pre-existing baseline error，非 A2 引入。

`git diff 98017c8 -- app/api/lms/study-buddy/analytics/route.ts` 返回**空**——A2 commit 完全没动这些文件。

## 改动范围验证

`git show 97ed850 --stat`：
```
.harness/plans/unitA2_plan_r1.md               |  26 +++++
.harness/reports/build_unitA2_r1.md            |  67 ++++++++++++
app/teacher/instances/[id]/page.tsx            |  20 ++++
components/instance-detail/instance-header.tsx | 146 ++++++++++++++++++++++++-
tests/instance-header-editable-title.test.ts   |  46 ++++++++
```
- 产线代码净增 +160 / -3（plan 估 ~145，**接近 plan 但略超**）
- 单 commit，符合 plan
- 0 schema 改动、0 service 改动、0 API 路由改动 — 纯前端 plumbing 符合 A2 设计

## Finsim-specific 检查

| 维度 | 结果 |
|---|---|
| UI 中文文案 | ✅ "标题不能为空" / "标题不能超过 200 字" / "标题已更新" / aria-label "编辑标题"/"保存标题"/"取消编辑" 全中文 |
| Route Handler 无业务逻辑 | ✅ 不动 route handlers |
| Auth | ✅ 复用现成 PATCH（require teacher/admin） |
| Zod safeParse | ✅ 复用现成 `updateTaskInstanceSchema.safeParse` (route.ts:41) |
| 响应格式 `{success, data}` | ✅ `handleTitleSave` 检查 `json.success`/`json.error?.message` |
| Prisma include / schema 改动 | ✅ 零 |

## 代码模式检查

- ✅ 不引入"drive-by"重构（InstanceHeader 仅添加 onTitleSave optional prop 不破坏现有 props）
- ✅ IME composition guard 防中文输入 Enter 提交（L162-176）
- ✅ Optional callback 模式让组件向后兼容（onTitleSave 缺省时回退 readonly h1，L288-294）
- ✅ 乐观更新 + 失败保留 edit mode（commit 函数 L111-135）
- ✅ trim + 长度校验（前端 L113-120）与 Zod min(1).max(200) 一致

## 风险 / 建议

### 小风险（不阻塞 PASS）

1. **乐观更新无 rollback**：成功后 `setInstance(prev => ({...prev, title: nextTitle}))` 立即更新本地 state；如果服务端实际写入失败而 `json.success === true` 的边缘场景（极不可能）将与 DB 不一致。建议无须改动，因为：当前实现 401/403/400 都会 `json.success === false` 触发 toast，且页面刷新即 fetch 真实值。
2. **breadcrumb sidebar 区分**：本 worktree 的 sidebar 不显示 instance.title（plan 第 6 条原文"sidebar 面包屑"，但 sidebar.tsx grep 仅"登出 title"——无 instance.title 渲染）。**实际"sidebar 面包屑"指 page 内 `instance-header.tsx` 的 breadcrumb nav (L245-266)**，从同一 `instance.title` 读，已 PASS。
3. **vitest 用 Zod schema 测试而非 React 组件渲染测试**：项目无 `@testing-library/react`，禁止 `npm install`。Zod 测试覆盖核心契约（boundary + Chinese + type），实际 UI 交互（点击 pen icon、Esc cancel、IME guard）**未自动化测试**——final QA 阶段 staging 真浏览器必验。

### Anti-regression 已验证

- 主 worktree 引用 `InstanceHeader` 仅 `app/teacher/instances/[id]/page.tsx:629`（grep）；已同步加 onTitleSave prop（optional 不强迫其他 caller 改）
- 不动 `lib/services/task-instance.service.ts`（A1 即将改的同文件，避免冲突）
- 不动 `lib/services/async-job.service.ts`（Phase3-A 可能并行改）

## Overall: **PASS**

A2 acceptance 4/4 全 PASS，tsc 0 new error，vitest 988/988 全过，5 处展示位证据链清晰，IME / 中文文案 / 乐观更新 / Optional callback 模式实现稳健。**可标 Task #5 completed**。

## 建议 coordinator

A2 可纳入合并 PR，不阻塞 builder 推进 C1-B。
Final QA 阶段需补充：
1. staging 真浏览器：点 pen icon → 改名 → 5 处展示位刷新同步
2. Esc 取消编辑路径
3. IME 中文输入回车不误触发保存
