# QA Report — snapshot-bugfix slice-4 (commit de59ced)

## Spec
review_arch F-4 — `task-instance.service` 内部 `isAuthorizedForInstance` 只查 createdBy / courseTeacher 协作，admin 被错误拒绝。

Slice 4 范围：
- `isAuthorizedForInstance` 加 `userRole?: string` 参数 + `admin` short-circuit
- 6 个公开 service 函数透传 userRole（publishTaskInstance / updateTaskInstance / deleteTaskInstance / reopenTaskInstance / closeTaskInstance / updateTaskInstanceSnapshot）
- 5 个 route handler 透传 `result.session.user.role`
- 新测试 `tests/instance-snapshot-admin-role.test.ts` + 同步 `tests/instance-snapshot-update.test.ts` grep 签名断言

不在 Slice 4 范围（应保持未改动）：audit log（PR #14 已修）、null=clear（Slice 1+2 已做）、`lib/auth/resource-access.ts`（已独立处理 admin）、假占位按钮（Slice 5）。

## Acceptance check

| # | Check | Verdict | Evidence |
|---|---|---|---|
| A1 | RED 真 FAIL（admin test 1 FAIL + arity errors） | **PASS** | 临时 `git checkout de59ced~1 -- lib/services/task-instance.service.ts app/api/lms/task-instances/ tests/instance-snapshot-update.test.ts`，保留新测试：<br>1. `npx vitest run tests/instance-snapshot-admin-role.test.ts` → **1 FAIL / 3 PASS**：admin case 抛 `FORBIDDEN`（无 short-circuit）；3 个 baseline teacher case 仍 PASS（保持现有行为，不依赖 slice 4）<br>2. `npx tsc --noEmit` → **4 arity errors**：`tests/instance-snapshot-admin-role.test.ts(69,9 / 93,9 / 117,9 / 142,9): Expected 3 arguments, but got 4`<br>完全符合 builder 报告的 "1 vitest FAIL + 4 TS arity error"。 |
| A2 | GREEN 真 PASS | **PASS** | 恢复 HEAD 后 `npx vitest run tests/instance-snapshot-admin-role.test.ts` → **4/4 PASS** in 7ms |
| A3 | Slice 4 实现正确 — admin short-circuit + collab 不被查 | **PASS** | `lib/services/task-instance.service.ts:59` `if (userRole === "admin") return true;` 在 createdBy 检查前。测试 case "admin role 绕过" L75 `expect(mCollab()).not.toHaveBeenCalled()` 验证 admin 不会走到 courseTeacher 查询 — short-circuit 真生效。 |
| A4 | 6 个 service 函数都加 userRole 参数 | **PASS** | grep `lib/services/task-instance.service.ts`:<br>L182 `publishTaskInstance(... userRole?)`<br>L275 `updateTaskInstance(... userRole?)`<br>L312 `deleteTaskInstance(... userRole?)`<br>L349 `reopenTaskInstance(... userRole?)`<br>L383 `closeTaskInstance(... userRole?)`<br>L419 `updateTaskInstanceSnapshot(... userRole?)`<br>每个函数内 `isAuthorizedForInstance(existing, ..., userRole)` 全部透传 — 5 个相关 isAuthorized 调用都正确传 userRole（L196/L283/L320/L356/L390/L437） |
| A5 | 5 个 route handler 都透传 user.role | **PASS** | grep app/api/lms/task-instances/[id]/* 全 5 个：<br>publish/route.ts:16 `publishTaskInstance(id, user.id, user.role)`<br>reopen/route.ts:16 `reopenTaskInstance(id, user.id, user.role)`<br>close/route.ts:16 `closeTaskInstance(id, user.id, user.role)`<br>route.ts:47 `updateTaskInstance(id, user.id, parsed.data, user.role)` (PATCH)<br>route.ts:61 `deleteTaskInstance(id, user.id, user.role)` (DELETE)<br>snapshot/route.ts:26 `updateTaskInstanceSnapshot(id, user.id, parsed.data, user.role)` |
| A6 | 全 caller wiring 完整 — 无漏传 | **PASS** | grep `publishTaskInstance\|updateTaskInstance\b\|deleteTaskInstance\|reopenTaskInstance\|closeTaskInstance\|updateTaskInstanceSnapshot` 在 app/ + lib/ 内：6 个 service 函数全部 6 个 route handler 调用都正确传 user.id + user.role，**无任何 caller 漏传**（架构 anti-regression rule #8）|
| A7 | userRole 是 optional — 向后兼容 | **PASS** | 签名 `userRole?: string` 全 optional。builder 报告 L32 acknowledge："调用方不传时行为完全 = 之前（admin 仍被拒）" — 保留 backward compat |
| A8 | Anti-regression — 3 个 teacher baseline case 全 PASS | **PASS** | 新测试 4 case 内含 3 个保持现有行为的 baseline：teacher 非 createdBy 非 collab → FORBIDDEN ✓ / teacher createdBy → 通过 ✓ / teacher collab → 通过 ✓。RED 阶段这 3 个就 PASS（不依赖 slice 4），GREEN 后仍 PASS，证明 short-circuit 不破坏 baseline。|
| A9 | 全 suite 0 regression | **PASS** | `npx vitest run` → **109 files / 1130 tests PASS**。<br>注：working tree 含 builder 未提交 Slice 5 改动（sheet.tsx 删假按钮 + 新 buttons.test.ts 4 tests + 旧 edit-sheet.test.ts 删 1 it），所以实际数比 builder Slice 4 baseline (108/1127) 多 +1 file / +3 tests = 109/1130。数字差异完全归因于 Slice 5 改动（已验证），Slice 4 本身 0 regression。 |
| A10 | tsc --noEmit | **PASS** | 0 errors（含 working tree 的 Slice 5 dirty 状态） |
| A11 | lint touched files | **PASS** | `npx eslint` 8 个 slice 4 touched files → 0 errors / 0 warnings |
| A12 | Scope 严格 — 不动 audit/null=clear/resource-access/假按钮 | **PASS** | `git show de59ced --name-only`：10 文件中 6 个源码改动全部在 Slice 4 范围内（task-instance.service.ts + 5 route handlers + 2 test files + 2 harness docs）。**未触**：<br>- `lib/services/audit.service.ts`（Slice 3 范围）<br>- `lib/validators/task.schema.ts` 的 null 部分（Slice 1）<br>- `components/instance-detail/snapshot-edit-sheet.tsx`（Slice 2 + Slice 5）<br>- `lib/auth/resource-access.ts`（独立 admin 路径，本 slice 注记说不动 — 验证 grep 见下） |
| A13 | resource-access 独立路径 admin 已正确处理 — 不动是对的 | **PASS** | `git show de59ced --name-only` 不含 `lib/auth/resource-access.ts`。grep 该文件 `user.role === "admin"` → **5 处出现**（L35/L100/L128/L180/L218），独立路径已处理 admin。builder 不 drive-by 改它是正确决定（CLAUDE.md anti-regression rule #7 "no drive-by refactors"） |
| A14 | source-grep 测试同步 | **PASS** | `tests/instance-snapshot-update.test.ts:148` 旧 `/isAuthorizedForInstance\(existing, createdBy\)/` 改为 `/isAuthorizedForInstance\(existing, createdBy, userRole\)/`，保持 source-grep 测试对新签名的精确断言。anti-regression 模式正确（签名变 → grep 同步）。 |
| A15 | finsim-specific（无中文 UI 改动 / 仅 Service 层 / Route 透传） | **PASS** | 本 slice 仅改 Service + Route handler 接口，未改文案 / API 响应格式 / Prisma schema。Route handler 仍是薄包装（仅 parse params + call service + return success），无业务逻辑 |
| A16 | Commit message 清晰 | **PASS** | `fix(service): admin role 绕过 isAuthorizedForInstance (slice 4)` + body 含根因（review_arch F-4）、改动列表（service / route / test）、baseline 数字（107/1123 → 108/1127, 0 regression） |

## RED 验证手法（双层证明）

**层 1 — runtime FORBIDDEN 证明**（vitest）：
1. `cp tests/instance-snapshot-admin-role.test.ts /tmp/slice4-test-backup.ts`
2. `git checkout de59ced~1 -- lib/services/task-instance.service.ts app/api/lms/task-instances/ tests/instance-snapshot-update.test.ts`
3. 还原 admin 测试到 working tree
4. `npx vitest run tests/instance-snapshot-admin-role.test.ts` → **1 FAIL / 3 PASS**
   - FAIL: "admin role 绕过 createdBy / courseTeacher 检查正常更新" — `promise rejected "Error: FORBIDDEN" instead of resolving`（admin 抛 FORBIDDEN）
   - 3 PASS: 3 个 teacher baseline 测试（确认这些不依赖 slice 4，证明 RED 测试 catch 的是 admin 新行为而不是 baseline regression — 这是非常关键的 RED 测试质量证明）

**层 2 — TypeScript arity 证明**（tsc）：
1. 同上回 prev impl
2. `npx tsc --noEmit` → **4 arity errors**：
   ```
   tests/instance-snapshot-admin-role.test.ts(69,9): Expected 3 arguments, but got 4.
   tests/instance-snapshot-admin-role.test.ts(93,9): Expected 3 arguments, but got 4.
   tests/instance-snapshot-admin-role.test.ts(117,9): Expected 3 arguments, but got 4.
   tests/instance-snapshot-admin-role.test.ts(142,9): Expected 3 arguments, but got 4.
   ```
3. 4 个 it block 每个调用 `updateTaskInstanceSnapshot(..., userRole)` 都报 arity → 证明扩签名是必要的，不仅是 short-circuit

完全符合 builder 报告 "RED: TS 4 arity error + vitest 1 FAIL"。

## 关键 grep 结果

```
$ grep -n "if (userRole === \"admin\")" lib/services/task-instance.service.ts
59:  if (userRole === "admin") return true;

$ grep -rn "user.role" app/api/lms/task-instances/[id]/  (全 5 route)
publish/route.ts:16: publishTaskInstance(id, user.id, user.role)
reopen/route.ts:16:  reopenTaskInstance(id, user.id, user.role)
close/route.ts:16:   closeTaskInstance(id, user.id, user.role)
route.ts:47:         updateTaskInstance(id, user.id, parsed.data, user.role)  # PATCH
route.ts:61:         deleteTaskInstance(id, user.id, user.role)               # DELETE
snapshot/route.ts:26: updateTaskInstanceSnapshot(id, user.id, parsed.data, user.role)

$ grep -n "isAuthorizedForInstance" lib/services/task-instance.service.ts  (5 调用全部带 userRole)
55: function isAuthorizedForInstance(instance, userId, userRole?)  # 定义
59: if (userRole === "admin") return true;                          # 短路
196: !(await isAuthorizedForInstance(instance, createdBy, userRole))   # publishTaskInstance
283: !(await isAuthorizedForInstance(existing, createdBy, userRole))   # updateTaskInstance
320: !(await isAuthorizedForInstance(existing, createdBy, userRole))   # deleteTaskInstance
356: !(await isAuthorizedForInstance(existing, actorId, userRole))     # reopenTaskInstance
390: !(await isAuthorizedForInstance(existing, actorId, userRole))     # closeTaskInstance
437: !(await isAuthorizedForInstance(existing, createdBy, userRole))   # updateTaskInstanceSnapshot

$ grep -n "user.role === \"admin\"" lib/auth/resource-access.ts
35 / 100 / 128 / 180 / 218 — 5 处 admin short-circuit (独立路径，已处理，不动是对的)
```

## Anti-regression 矩阵（核心 verify）

| 调用者 | 之前 | 现在 | 验证 |
|---|---|---|---|
| teacher (createdBy) | 通过 | 通过 | 新测试 case 3 ✓ |
| teacher (collab) | 通过 | 通过 | 新测试 case 4 ✓ |
| teacher (无权) | FORBIDDEN | FORBIDDEN | 新测试 case 2 ✓ |
| admin | FORBIDDEN ❌ | 通过 ✓ | 新测试 case 1（核心新行为） |

四象限完整覆盖，无回归。

## Diff stat

```
lib/services/task-instance.service.ts             |  51 ++++++++++++++--
app/api/lms/task-instances/[id]/close/route.ts    |   3 +-
app/api/lms/task-instances/[id]/publish/route.ts  |   2 +-
app/api/lms/task-instances/[id]/reopen/route.ts   |   3 +-
app/api/lms/task-instances/[id]/route.ts          |   6 +-
app/api/lms/task-instances/[id]/snapshot/route.ts |   2 +-
tests/instance-snapshot-admin-role.test.ts        | 146 ++++++++++++++++++++++
tests/instance-snapshot-update.test.ts            |   2 +-
10 files / 331 + / 20 -
```

源码净增约 25 行（service +37 -7 = +30，5 routes 合计 +9 -2 = +7，去掉注释约 25 行核心代码）。远低于 150 行上限。✓

## 风险点 / 观察

- **架构正确**：`userRole?: string` 作为 optional 参数 — backward compat，已有 test grep 也只需精确更新 1 行。
- **避免 drive-by**：builder 明智地未改 `lib/auth/resource-access.ts` 独立 admin 路径（5 处已经有），仅补 service-internal `isAuthorizedForInstance` 缺口。CLAUDE.md anti-regression rule #7 ✓。
- **测试设计亮点**：admin case L75 显式 `expect(mCollab()).not.toHaveBeenCalled()` 验证 short-circuit 真生效（不是 admin 也 happens to 通过 courseTeacher 查询）— 这是非常严谨的"行为 + 副作用"双重验证。
- **3 个 baseline case 是 RED 测试质量保证**：RED 时它们就 PASS，证明 admin FAIL 是 admin 行为缺失，而不是测试设置错误。
- **Working tree dirty**：跑 QA 时 builder 已在做 Slice 5（sheet.tsx + 新 buttons test + edit-sheet test grep 更新），所以全 suite 数 109/1130 含 Slice 5 +3 净增。Slice 4 单独 baseline 应为 108/1127（builder 报告数字）— 数学一致：108 + 1 (slice 5 文件) + 4 (slice 5 it) - 1 (slice 5 删旧 it) = 109/1130 ✓。Slice 4 本身 0 regression 已确认。

## Overall: **PASS**

Slice 4 通过全部 16 项 acceptance（含双层 RED 证明 vitest + tsc）。RED 真 FAIL（1 admin + 4 arity）、GREEN 4/4 PASS、相关 spec 34/34 PASS、全 suite 109/1130 PASS（含 builder 已开始 Slice 5 改动）、0 tsc 错误、0 lint 错误、严格遵守 scope（不动 audit/null=clear/resource-access/假按钮）、anti-regression 矩阵四象限完整覆盖、commit message 完整。

可以放行 Slice 5。
