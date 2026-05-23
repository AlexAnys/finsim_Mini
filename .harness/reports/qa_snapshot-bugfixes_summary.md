# QA 汇总报告 — snapshot-bugfixes hot-fix PR 整体收官

**Branch**: `claude-snapshot-bugfixes`
**Base**: `2da121f` (origin/main 之前的 PR-15 hot-fix)
**Verdict**: **整 PR 5 slice 全部 PASS — 可 push**

## 5 Slice 收官矩阵

| Slice | Task | Commit | 范围 | RED 证明 | GREEN 验证 | QA verdict |
|---|---|---|---|---|---|---|
| 1 | #9 — B1 service null=clear 语义 | `8b4b9e5` | service + schema (validator) | 7/8 FAIL (vitest) | 8/8 PASS, 1118 全套 PASS | **PASS** [报告](./qa_snapshot-bugfix-slice-1.md) |
| 2 | #10 — B1 UI buildPatchBody 发 null | `4e1fc13` | components/instance-detail/snapshot-edit-sheet.tsx | 双层 RED: 5/5 FAIL (未 export) + 3/5 FAIL (有 export 但旧逻辑) | 5/5 PASS, 1123 全套 PASS | **PASS** [报告](./qa_snapshot-bugfix-slice-2.md) |
| 3 | #11 — B2 audit log for snapshot update | **跳过** | — | TDD 纪律：bug 已被 PR #14 (L477-488) 修过 — RED 不能 FAIL，跳过 | — | **N/A**（pre-fixed） |
| 4 | #12 — B3 admin 路径 | `de59ced` | service + 5 route handlers | 双层 RED: 1/4 vitest FAIL + 4 TS arity errors | 4/4 PASS, 1127 全套 PASS | **PASS** [报告](./qa_snapshot-bugfix-slice-4.md) |
| 5 | #13 — B4 删假占位按钮 | `57aebaa` | components/instance-detail/snapshot-edit-sheet.tsx + 2 tests | 3/4 FAIL (negative assertions) | 4/4 PASS, 1130 全套 PASS | **PASS** [报告](./qa_snapshot-bugfix-slice-5.md) |

## Review findings 闭环情况

| Source | Finding | 状态 |
|---|---|---|
| review-pr13 F-3 | 教师清空"限时 30 分钟"后未生效 | ✅ **Slice 1 + 2 协同修复**（B1） |
| review-pr13 F-7 | AlertDialog 假占位「复制为新任务」disabled + tooltip | ✅ **Slice 5 删除假按钮**（B4） |
| review-arch F-4 | `isAuthorizedForInstance` admin 被错误拒绝 | ✅ **Slice 4 admin short-circuit + caller wiring**（B3） |
| review-pr13 F-?? | snapshot_update audit log 缺失 | ✅ **PR #14 已修**（B2，本 PR 跳过 Slice 3） |

review-pr13 / review-arch 3 个独立 finding 全部闭环。

## 关键闭环：B1 = Slice 1 + Slice 2 双向协同

```
[UI 教师清空"限时分钟" input]
     ↓ state.timeLimitMinutes = undefined
[Slice 2: buildPatchBody UI] q.timeLimitMinutes ?? null → null
[JSON.stringify(body)] null 不被 drop（undefined 会被 drop）→ '{"quizConfig":{"timeLimitMinutes":null,...}}'
[fetch PATCH /api/lms/task-instances/[id]/snapshot] req body 含 timeLimitMinutes: null
[Slice 1: validators/task.schema.ts]
     ↓ quizConfigPatchSchema.timeLimitMinutes: z.number().int().min(1).nullable().optional() → 接受
[Slice 1: services/task-instance.service.ts updateTaskInstanceSnapshot]
     ↓ 浅 merge: nextQuiz = { ...currentQuiz, timeLimitMinutes: null }
     ↓ applyClearSemantics(nextQuiz, patch.quizConfig) → delete nextQuiz.timeLimitMinutes
[DB taskSnapshot.quizConfig 不再含 timeLimitMinutes key]
[学生加载任务 SubmissionRunner 看不到 timeLimit 字段 → 不限时]
```

**两 slice 缺一不可**：
- 缺 Slice 1 → UI 发 null 但 schema reject / service 直接 set null（不删）→ key 还在
- 缺 Slice 2 → UI 仍发 undefined → JSON drop → service 收不到 patch → 浅 merge 完全保留旧值

## 最终 sanity check（整 PR 状态）

| 检查 | 结果 |
|---|---|
| `git log 2da121f..HEAD` | 4 个 commits 顺序清晰：8b4b9e5 → 4e1fc13 → de59ced → 57aebaa（slice 1/2/4/5 编号呼应；slice 3 跳过无 commit） |
| `npx vitest run` 全套 | ✅ **109 files / 1130 tests PASS, 0 fail** |
| `npx tsc --noEmit` | ✅ **0 errors** |
| `npm run lint` | ✅ **0 errors / 34 warnings**（全部 pre-existing，与 Slice 1 QA 时同样数字） |
| Working tree clean | ✅ 除 5 个 QA 报告外干净 |
| Anti-regression rule（CLAUDE.md #6-#9）|✅ 所有 interface 变更 caller 同步、source-grep 测试同步、无 drive-by refactor |
| finsim-specific | ✅ 中文 UI / Service 层职责分离 / Route Handler 薄包装 / API 响应格式不变 |
| Prisma | ✅ **未触 schema**（Slice 1 仅改 Zod validator，未改 schema.prisma；无需 migrate / generate / 重启 dev server） |
| 安全敏感（auth） | ✅ Slice 4 改 `isAuthorizedForInstance` 是**扩大** admin 权限（CLAUDE.md 允许，符合预期产品语义），不是降低或绕过权限。3 个 teacher baseline 测试矩阵证明无回归。 |

## TDD 纪律亮点

1. **Slice 3 跳过**：本来 plan 含 B2 修复，但 builder + QA 发现 PR #14 已修。**未硬写无意义测试**，coordinator 接受跳过决策 → 符合"RED 不能 FAIL 即 bug 不存在 → 跳过"原则。
2. **每个 slice RED 真验证 FAIL 来源**：
   - Slice 1: 7/8 FAIL（service 不删 + schema reject）
   - Slice 2: 双层 RED（5/5 + 3/5）证明 export + 逻辑都必要
   - Slice 4: 双层 RED（1 admin runtime FAIL + 4 TS arity）证明 short-circuit + 扩签名都必要
   - Slice 5: 3 negative-assertion FAIL + 1 baseline PASS（baseline PASS 证明描述断言不靠 slice 5 通过 — 即测试质量保证）

## 整 PR 影响范围

**改动文件**（不含 harness docs）：
- `lib/services/task-instance.service.ts`（Slice 1 + 4 — null=clear + admin）
- `lib/validators/task.schema.ts`（Slice 1 — 3 patch schemas with .nullable()）
- `components/instance-detail/snapshot-edit-sheet.tsx`（Slice 2 + 5 — buildPatchBody + 删假按钮）
- `app/api/lms/task-instances/[id]/route.ts`（Slice 4 — PATCH/DELETE 透传 user.role）
- `app/api/lms/task-instances/[id]/publish/route.ts`（Slice 4）
- `app/api/lms/task-instances/[id]/reopen/route.ts`（Slice 4）
- `app/api/lms/task-instances/[id]/close/route.ts`（Slice 4）
- `app/api/lms/task-instances/[id]/snapshot/route.ts`（Slice 4）

**测试文件**：
- `tests/instance-snapshot-clear-semantics.test.ts`（Slice 1 新建，8 tests）
- `tests/snapshot-edit-form-clear.test.ts`（Slice 2 新建，5 tests）
- `tests/instance-snapshot-admin-role.test.ts`（Slice 4 新建，4 tests）
- `tests/snapshot-edit-sheet-buttons.test.ts`（Slice 5 新建，4 tests）
- `tests/instance-snapshot-update.test.ts`（Slice 4 grep 同步，1 行）
- `tests/instance-snapshot-edit-sheet.test.ts`（Slice 5 锁定正确行为，3 it → 2 it）

**净增 test**: 21 个新 tests (8+5+4+4)，-1 stale it。Baseline 1110 → 1130 = +20 = +21 -1 ✓ 数字完美对上。

## 未触 / 不动（验证）

- `prisma/schema.prisma`（无 migrate 风险）
- `lib/auth/resource-access.ts`（独立 admin 路径已 5 处处理 admin — 本 PR 不 drive-by）
- `app/teacher/tasks/[id]/page.tsx`（task 编辑页真按钮 + 真复制为新任务 handler 保留）
- `lib/services/audit.service.ts`（Slice 3 跳过 = PR #14 已修）
- 其他 service / 其他 UI / 任何 e2e spec（除 builder slice 1 / 2 / 4 / 5 的源测试外，0 stale 引用）

## 风险评估

- **零回归风险**：1130/1130 PASS，所有 interface 变更 caller 同步。Slice 4 `userRole?: string` 全 optional → backward compat。
- **零安全风险**：admin short-circuit 是**扩大**预期权限（admin 本就应该能管理），非降低安全或绕过权限。teacher 3 case 矩阵证明非 admin 路径不变。
- **零 UI 风险**：Slice 2 仅改 buildPatchBody 纯函数；Slice 5 仅删 disabled 假按钮（用户从来不能点 — 删它不影响任何已有 UX 流）。
- **零 db 风险**：未触 schema.prisma，无 migrate 需求。null=clear 语义在 service 层处理（delete from Json field），DB 不会出现 `null` 值（key 直接消失）。
- **零 dev server 风险**：未改 schema，dev server 不需要重启。

## Overall: **整 PR 5 slice 全 PASS — 准备 push**

5 个 slice 的 QA 报告全部 PASS：
- [Slice 1](./qa_snapshot-bugfix-slice-1.md) PASS
- [Slice 2](./qa_snapshot-bugfix-slice-2.md) PASS
- Slice 3 跳过（PR #14 pre-fixed）
- [Slice 4](./qa_snapshot-bugfix-slice-4.md) PASS
- [Slice 5](./qa_snapshot-bugfix-slice-5.md) PASS

整 PR 闭环 review-pr13 F-3 + F-7 + review-arch F-4 三个独立 finding。Anti-regression 矩阵完整覆盖，TDD 纪律严格（含 1 个合理跳过决策）。

可以 push 整 PR。
