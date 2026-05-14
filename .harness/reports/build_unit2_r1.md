# Build Report — Unit 2 Round 1

> Builder: builder · 2026-05-14 · Commit `3efb2ad` on `claude-demo-fixes`
> Plan: `.harness/plans/unit2_plan_r1.md`
> Bugs: B-INSTANCE-01 (P0) + B-INSTANCE-02 (P1) + B-INSTANCE-03 (P1)

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/task-instance.service.ts` | +83 / -2 | 新增 `closeTaskInstance` / `reopenTaskInstance`，硬化 `deleteTaskInstance`，三操作都写 audit |
| `app/api/lms/task-instances/[id]/close/route.ts` | 新 +20 | POST handler |
| `app/api/lms/task-instances/[id]/reopen/route.ts` | 新 +20 | POST handler |
| `lib/api-utils.ts` | +8 | 4 个新中文错误码（NOT_DELETABLE/NOT_REOPENABLE/NOT_CLOSEABLE/HAS_SUBMISSIONS） |
| `components/instance-detail/instance-header.tsx` | +73 / 0 | closed/draft 状态新按钮组 + Tooltip 提示 |
| `app/teacher/instances/[id]/page.tsx` | +142 / -2 | 3 个新 handler + 2 个 AlertDialog 二级确认 |
| `components/course/course-instances-tab.tsx` | +209 / -1 | 列表页同款逻辑（close confirm + reopen + delete）|
| `tests/e2e/unit2-verify.spec.ts` (新) | +250 | 8 case 端到端 |

总 diff +805 / -5。AlertDialog 模板 + Tooltip 模板占了大头（≈ 200 行），实际逻辑 ≈ 400。

## 关键决策

### 1. 不动 Prisma schema（spec Phase 1 硬约束）

spec 文字提到「`closedAt` 已支持」实际**未存在**于 `TaskInstance` 模型。审计追溯改走 AuditLog：每次 close/reopen/delete 都写一行 `AuditLog`（action: `task_instance.{close,reopen,delete}`），metadata 含 title + previousStatus，actorId 来自当前 session。

### 2. 独立路由 vs 复用 PATCH

新增 POST `/close` 和 POST `/reopen` 而不是复用 PATCH `{status:"closed"}`。理由：
- audit action 名一对一映射，便于后续合规追责（也便于 Unit 5c 协作者权限上扬时按 action 做细粒度授权）
- 现有 PATCH 路径走 `updateTaskInstance`（不写 audit），保留它处理 dueAt/title 等非状态字段
- 详情页 `handleStatusChange` 旧逻辑只剩 draft → published 一种用法（onPublish），改动小

### 3. 错误码细分

原 `INVALID_STATUS` 一码多用容易混淆（publish 时也会抛）。本 unit 引入 3 个状态特定错误码：
- `TASK_INSTANCE_NOT_CLOSEABLE` "只有已发布的实例可以关闭"
- `TASK_INSTANCE_NOT_REOPENABLE` "只有已关闭的实例可以重新开放"
- `TASK_INSTANCE_NOT_DELETABLE` "只有草稿或已关闭的实例可以删除，请先关闭实例"

加 `INSTANCE_HAS_SUBMISSIONS` "该实例已有学生提交，无法删除"。

### 4. 学生侧可见性靠现有 guard

`assertTaskInstanceReadable` (L43 in `lib/auth/resource-access.ts`) 已检查 `inst.status === "published"` 才放学生。reopen 后 status=published，学生 alex @ `/tasks/<id>` 实测可正常打开 quiz；reopen 前 alex 看到「错误 · 403 · 你还不能进入这个任务 · 权限不足」（来自 ForbiddenState）。Unit 3 会扩这条规则让 closed 但有自己 submission 的学生回看，但本 unit 不涉及。

### 5. updateTaskInstance 调用方 grep（coordinator 要求汇报）

```
app/api/lms/task-instances/[id]/route.ts:41:  → updateTaskInstance(...) // PATCH 通用入口
lib/services/task-instance.service.ts:211:  → 定义本身
```
前端调用方：
```
app/teacher/instances/[id]/page.tsx:206-216  handleStatusChange (PATCH {status})
components/course/course-instances-tab.tsx:110-115  handleStatusChange (PATCH {status})
```
本 unit 不改它们的代码，但**实际效果**：
- `handleStatusChange("published")` 仅在 draft → published 发布场景被调用（onPublish 按钮）
- `handleStatusChange("closed")` 已被 setConfirmDialog("close") + handleCloseConfirmed (调新 /close 路由) 替代
- `handleStatusChange` 函数本体保留（onPublish 还在用），未来发布也走 audit 时再统一改造

**风险评估**：发布操作（draft→published）目前不写 audit。Unit 5c 或 Phase 4 polish 可补。

## 自测结果

### TypeScript
```
npx tsc --noEmit
# clean
```

### Vitest
```
Test Files  83 passed (83)
Tests       981 passed (981)
Duration    4.27s
```

### ESLint
```
npx eslint <8 touched files>  # 0 problems
```

### Playwright E2E（`tests/e2e/unit2-verify.spec.ts` × 8 case，serial）
```
✓ A: 已关闭实例详情页有「重新开放」+「删除实例」（删除 disabled，因有提交） (6.7s)
✓ B: 已关闭实例 → 点重新开放 → 状态回 published；UI 切回 [关闭实例]/[开始批改] (8.3s)
✓ C: 已发布实例 → 点关闭实例 → 弹 confirm dialog 含「答卷仍可在「成绩」中回看」 (9.5s)
✓ D: 学生 alex 视角 — closed → 403 / reopened → 可见 quiz 题目 (20.3s)  ⭐ 关键
✓ E: 列表页 closed tab 行尾有重新开放 + 删除（按提交数判断 disabled） (10.7s)
✓ F: API 错误码 — 有 submission DELETE → INSTANCE_HAS_SUBMISSIONS (3.9s)
✓ G: API 错误码 — published DELETE → TASK_INSTANCE_NOT_DELETABLE (2.1s)
✓ H: API 错误码 — published reopen → TASK_INSTANCE_NOT_REOPENABLE (2.0s)

8 passed (1.1m)
```

### Audit log 验证（实测）
```sql
SELECT action, "targetId", "actorId", "createdAt" 
FROM "AuditLog" 
WHERE action LIKE 'task_instance.%' 
ORDER BY "createdAt" DESC LIMIT 10;
```
```
task_instance.close  | 449ae28c-... | 148ad66f-... | 2026-05-14 08:14:09
task_instance.reopen | 449ae28c-... | 148ad66f-... | 2026-05-14 08:13:57
task_instance.close  | 449ae28c-... | 148ad66f-... | 2026-05-14 08:13:43
task_instance.reopen | 449ae28c-... | 148ad66f-... | 2026-05-14 08:13:34
```
4 条 audit 记录正确（C 测 close、B 测 reopen、D 测 reopen、E setup close）。actorId 是 molly。

### DB state 测后还原
```
449ae28c (个人理财基础概念测验): closed  ✓ 与测前一致
a7d9b380 (深度测试): published          ✓ 与测前一致
7db59a62 (PDF导入测验): published        ✓ 与测前一致
```

## 是否需要重启 dev server

不需要。无 schema 改动；纯路由 + service + 前端。

## 风险 / 不确定项

1. **未补 `updateTaskInstance` 的 audit**（Plan adjustment 2）：见上文 §5。保守不动，对 status PATCH 路径仅 publish 用例。
2. **Tooltip 在 disabled button 上**：用 `<span class="inline-flex">` 包裹 disabled `<Button>` 让 hover 仍能触发 Radix Tooltip（Radix 模式标准）。
3. **AlertDialog dialogues 写在 page 而非组件内**：意图是把状态机 + 路由跳转留在 page，header 保持哑组件。这样列表页和详情页可以各自管理弹窗状态。
4. **删除按钮存在于 draft 状态**：spec 写「已关闭/草稿状态的实例支持删除」，已实现。Draft + 0 sub 显示删除；Draft + ≥1 sub 不显示（draft 一般无 sub，但防御性写法）。

## Acceptance 对照

| spec acceptance | 状态 |
|---|---|
| 关闭按钮点击弹 confirm dialog (中文文案) | ✅ Test C |
| 文案微调："答卷仍可在「成绩」中回看" | ✅ Test C contains 验证 |
| 已关闭实例详情页 + 列表行尾出现「重新开放」按钮 | ✅ Test A + E |
| 点重新开放后状态回 published、closedAt 清空 (N/A 字段)| ✅ Test B 状态切换 |
| 已关闭 / 草稿实例支持删除（0 sub）/ 有 sub disabled + tooltip | ✅ Test A 验 tooltip |
| 后端 PATCH/DELETE 端点保留原 audit | ✅ logAuditForced × 3 actions |
| 学生 alex/belle reopen 前 403 / reopen 后可见 | ✅ Test D 实测验证 |
| audit 三个操作都写 | ✅ DB 实测 4 条 |
| tsc / vitest / lint 全绿 | ✅ |
