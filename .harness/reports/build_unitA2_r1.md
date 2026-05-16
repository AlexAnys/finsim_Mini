# Build Report · Unit A2 · Round 1

> builder@instance-workbench · 2026-05-15
> Plan: `.harness/plans/unitA2_plan_r1.md`

## 改动文件

| 文件 | 改/新 | 净行 |
|---|---|---|
| `components/instance-detail/instance-header.tsx` | 改 | +143 / -3 |
| `app/teacher/instances/[id]/page.tsx` | 改 | +20 / 0 |
| `tests/instance-header-editable-title.test.ts` | 新 | +46 |

合计 ~209 净增（其中 46 是测试；产线代码 +160 / -3）。单 commit。

## 实现要点

1. **`EditableTitle` 子组件**（`instance-header.tsx`）：
   - 局部 state：`isEditing` / `draft` / `saving` / `error` + `composingRef`（IME guard）+ `inputRef`（autofocus）
   - 校验：trim → 空（"标题不能为空"）/ >200（"标题不能超过 200 字"，与 Zod `min(1).max(200)` 一致）
   - 与原值相同 → 自动 cancel，不发请求
   - Enter 保存（composition 中忽略）、Esc 取消
   - 父抛 error 时保留 edit mode 让用户重试

2. **`InstanceHeaderProps.onTitleSave` 可选**：缺省回退到原 readonly `<h1>`，保持向后兼容（向其他可能引用的页面）

3. **父页 `handleTitleSave`**（`page.tsx:236`）：
   - `PATCH /api/lms/task-instances/{id}` body `{ title }`（route + Zod schema + service 全已就绪，probe A 已证）
   - 成功 → 乐观更新 `setInstance(prev => ({...prev, title: nextTitle}))` + toast「标题已更新」
   - 失败 → toast + `throw` 让子组件保持编辑态

4. **breadcrumb 同步**：`page.tsx:129` 仍读 `{instance.title}`，乐观更新后立即同步刷新

5. **5 个全局显示位**：dashboard / `/teacher/tasks` / `/teacher/instances` / `/grades` / sidebar 均从 DB 读 `instance.title`，下次加载即同步（plan 已确认）

## 自测结果

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit`（A2 文件） | 0 error |
| `npx tsc --noEmit`（全项目） | 6 pre-existing error in `study-buddy/analytics/route.ts` + `study-buddy.service.ts`，**与 A2 无关**（git blame 显示来自 `e311571` `feat: harden course context and ai settings`，先于本 worktree） |
| `npx vitest run tests/instance-header-editable-title.test.ts` | 7 / 7 PASS |
| `npx vitest run`（全 suite） | 84 files / 988 tests PASS / 0 fail / 0 regression |
| `npx eslint <touched files>` | 0 error / 0 warn |

## 关键决策与权衡

- **不抽独立 `editable-title.tsx`**：仅 ~80 行，与 header 强耦合（共用 lucide / Button 风格）。plan 也明示就改 `instance-header.tsx` 这一个文件。
- **vitest 用 Zod schema 测试 而非 React 组件渲染测试**：项目 `vitest.config.ts` 是 `node` 环境且不含 `@testing-library/react`；引入需 `npm install`（禁止）。Zod 测试覆盖了 EditableTitle 的核心契约（空/超长/中文/类型/optional）。
- **`onTitleSave` 设为 optional**：保留 readonly 回退路径，不强迫所有引用方接 callback（虽然目前仅 1 个 caller）。
- **乐观更新而非重 fetch**：避免不必要的 GET round trip；失败回滚由 toast + throw 触发，state 保持 edit mode 用户可重试。

## 不确定 / 暂留

- **E2E 真浏览器实测推迟**：plan 明示 A2 的 5 处全局同步实测「待 Unit 17 进 main 后再跑」；目前 qa 在本 worktree 内是静态 probe + 单元测试覆盖。
- **dev server 不需要重启**：本 commit 0 schema 改动 / 0 Prisma include 改动。

## Anti-regression 检查

- `InstanceHeader` 引用：仅 `app/teacher/instances/[id]/page.tsx:622`（grep 全 repo），已同步加 `onTitleSave` prop（optional，readonly 回退仍工作）
- `updateTaskInstanceSchema` 字段（含 title）已被 schema 索引；本 commit 不动 schema 文件
- `PATCH /api/lms/task-instances/[id]` route：0 改动；service `updateTaskInstance(id, userId, data)` 0 改动
- 不动 Prisma schema / 不动 `lib/services/async-job.service.ts` / 不动学生 runner

## 下一步

待 coordinator/qa 验收。
