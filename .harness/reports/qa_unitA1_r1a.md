# QA Report · Unit A1 · Round 1a (service + API + validator)

> qa@instance-workbench · 2026-05-15
> Build: `917ec88 feat(unit-A1): 实例配置 PATCH /snapshot service + API + validator（r1a）`
> Plan: `.harness/plans/unitA1_plan_r1a.md`
> Build report: `.harness/reports/build_unitA1_r1a.md`

## Acceptance（r1a）

| # | Acceptance | Verdict | 证据 |
|---|---|---|---|
| 1 | `updateTaskInstanceSnapshotSchema` discriminated union by taskType | **PASS** | `lib/validators/task.schema.ts:161-165` `z.discriminatedUnion("taskType", [3 sub schemas])`；L167 export `UpdateTaskInstanceSnapshotInput` 类型 |
| 2 | 三 taskType 各自 partial schema 导出 | **PASS** | `task.schema.ts`：<br>① L141-146 `updateInstanceSnapshotSimulationSchema`（simulationConfig.partial + scoringCriteria + allocationSections）<br>② L148-153 `updateInstanceSnapshotQuizSchema`（quizConfig.partial + quizQuestions + scoringCriteria）<br>③ L155-159 `updateInstanceSnapshotSubjectiveSchema`（subjectiveConfig.partial + scoringCriteria）<br>所有 *Config 用 `.partial().optional()` 允许部分字段；数组字段全量替换 |
| 3 | `updateTaskInstanceSnapshot` service 实现 | **PASS** | `lib/services/task-instance.service.ts:249-324`：<br>① **auth**: L265-267 `isAuthorizedForInstance(existing, createdBy)` 失败抛 `FORBIDDEN`<br>② **taskType 校验**: L268-270 `existing.taskType !== patch.taskType` → `TASK_TYPE_MISMATCH`<br>③ **deep-merge**: L276-306 三态分支，每分支 `{...currentX, ...patch.xxx}` 顶层键合并；数组字段（scoringCriteria/allocationSections/quizQuestions）全量替换<br>④ **守 task.id / taskType / taskName 不变**: L309-311 强制 `mergedSnapshot.id = currentSnapshot.id` 等 3 行覆盖<br>⑤ **`$transaction` count graded**: L313-321 prisma.$transaction 含 update + submission.count where status='graded'<br>⑥ **返回**: L323 `{ instance: updated, gradedCount }` |
| 4 | snapshot route + requireRole teacher/admin | **PASS** | `app/api/lms/task-instances/[id]/snapshot/route.ts`：<br>① L11-13 `export async function PATCH`<br>② L15 `requireRole(["teacher", "admin"])`<br>③ L21-24 `updateTaskInstanceSnapshotSchema.safeParse` + `validationError` 中文消息<br>④ L25-27 调 service<br>⑤ L28-30 `handleServiceError` 统一错误映射 |
| 5 | `api-utils.ts` TASK_TYPE_MISMATCH 错误映射 400 中文 | **PASS** | `lib/api-utils.ts:86-87` `case "TASK_TYPE_MISMATCH": return error("TASK_TYPE_MISMATCH", "任务类型不匹配，无法修改", 400)`；L81-82 同时映射 `INSTANCE_NOT_FOUND` |
| 6 | vitest ≥3 | **PASS** | `tests/instance-snapshot-update.test.ts` **17 tests**（远超 ≥3）：<br>- 8 Zod schema 测试（3 taskType 合法 patch + 数组替换 + 非法 taskType + 跨类型字段忽略 + maxPoints>=1 + subjectiveConfig.prompt 不为空）<br>- 6 service 源结构测试（function exists / 守不变字段 3 + taskType 校验 + auth + deep-merge 三态 + 返回值）<br>- 2 route 测试（PATCH + requireRole + safeParse + 错误处理）<br>- 1 api-utils 错误映射测试（TASK_TYPE_MISMATCH 中文） |

## 自动化测试

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（全项目） | **0 new errors**；仅 6 pre-existing study-buddy（不变） |
| `npx vitest run tests/instance-snapshot-update.test.ts` | ✅ **17/17 PASS** (15ms) |
| `npx vitest run`（全 suite） | ✅ **1030/1030 PASS, 87/87 files, 0 regression**（C1-B baseline 1013 + r1a +17） |

## 重点 grep 证据

```bash
# 1. service 独立于 updateTaskInstance（A2 的 service 函数）
$ grep -n "updateTaskInstance\b" lib/services/task-instance.service.ts
212: export async function updateTaskInstance(           # A2 function, 不动
# updateTaskInstanceSnapshot 在 L249 独立 export，不调 A2

# 2. service 不调 updateTaskInstance（只动 instance.taskSnapshot 字段）
$ grep -n "updateTaskInstance\b" app/api/lms/task-instances/\[id\]/snapshot/route.ts
(empty)    # 仅 import updateTaskInstanceSnapshot

# 3. 守不变字段 3 行
$ grep -n "mergedSnapshot\.\(id\|taskType\|taskName\)\s*=" lib/services/task-instance.service.ts
309: if (currentSnapshot.id !== undefined) mergedSnapshot.id = currentSnapshot.id;
310: if (currentSnapshot.taskType !== undefined) mergedSnapshot.taskType = currentSnapshot.taskType;
311: if (currentSnapshot.taskName !== undefined) mergedSnapshot.taskName = currentSnapshot.taskName;

# 4. graded count
$ grep -n "prisma\.submission\.count\|status:.*graded" lib/services/task-instance.service.ts
318-319: prisma.submission.count({ where: { taskInstanceId, status: "graded" } })

# 5. discriminated union（不是 z.union）
$ grep -n "discriminatedUnion" lib/validators/task.schema.ts
161: export const updateTaskInstanceSnapshotSchema = z.discriminatedUnion("taskType", [...]);

# 6. requireRole 而非 requireAuth
$ grep -n "requireRole\|requireAuth" app/api/lms/task-instances/\[id\]/snapshot/route.ts
15: const result = await requireRole(["teacher", "admin"]);

# 7. 错误码中文消息
$ grep "TASK_TYPE_MISMATCH" lib/api-utils.ts
case "TASK_TYPE_MISMATCH":
  return error("TASK_TYPE_MISMATCH", "任务类型不匹配，无法修改", 400);
```

## 改动范围

`git show 917ec88 --stat`：
```
.harness/plans/unitA1_plan_r1a.md                       |  65 ++
.harness/reports/build_unitA1_r1a.md                    |  97 ++
lib/validators/task.schema.ts                            | +30
lib/services/task-instance.service.ts                    | +83
lib/api-utils.ts                                         |  +2
app/api/lms/task-instances/[id]/snapshot/route.ts        | +32 (new)
tests/instance-snapshot-update.test.ts                   | +180 (new)
```
- 产线代码净增 **+147 行**（plan 估 +145，几乎完全吻合）
- 测试 +180
- 单 commit；无 Prisma schema 改动 → dev server 不需重启

## Finsim-specific 检查

| 维度 | 结果 |
|---|---|
| UI 中文文案 | ✅ "请求参数错误" / "任务类型不匹配，无法修改" 全中文 |
| Route Handler 无业务逻辑 | ✅ route 仅做 parse + 调 service + 返回；业务在 service 层 |
| Auth | ✅ `requireRole(["teacher", "admin"])` 标准模式（与 release-config/route.ts 一致） |
| Zod safeParse | ✅ `updateTaskInstanceSnapshotSchema.safeParse(body)` |
| 响应格式 `{success, data}` | ✅ `success(data)` / `validationError(...)` / `handleServiceError(err)` 三 helper |
| Service throw "CODE" 模式 | ✅ `throw new Error("INSTANCE_NOT_FOUND" / "FORBIDDEN" / "TASK_TYPE_MISMATCH")` 三错误码 |
| Prisma 字段验证 | ✅ `taskSnapshot` 已在 schema.prisma:525（probe A 已确认存在）；select 仅 5 字段（id/createdBy/courseId/taskType/taskSnapshot），无多余字段 |
| Prisma 三步执行 | ✅ **0 schema 改动 → 不需要 migrate/generate/restart**（无影响） |

## 实现稳健性 / 风险

### 🟢 良好设计

1. **discriminated union by taskType** —— 强制客户端指定 taskType，避免 "我以为是 simulation patch 但其实落到 quiz" 的歧义
2. **双层防御 taskType 校验**：① Zod schema 三态 union 拒绝非法 taskType；② service 层显式 check `existing.taskType !== patch.taskType`（即便 schema 通过也防住）
3. **deep-merge 而非全量替换**：simulationConfig/quizConfig/subjectiveConfig 子字段级别合并；scoringCriteria/allocationSections/quizQuestions 整数组替换（保数组顺序与索引一致性）
4. **守 task.id / taskType / taskName 三字段**：service 层 explicit 覆盖回 currentSnapshot 原值（防止 patch 通过子字段缝隙篡改）
5. **`$transaction` 原子性**：update 和 count 在同一事务，避免 race
6. **graded != 0 不阻拦**：service 仅统计，阻拦决策推 UI 层 r1b（教师明确知道在做什么）
7. **service 完全独立于 A2 的 `updateTaskInstance`**：两个函数各管各事，零冲突

### 🟡 不阻塞观察

1. **测试是 Zod runtime 校验 + 源结构 grep**（无 Prisma DB integration test）
   - Zod 测试：runtime 真跑 8 个 schema test，覆盖各 taskType 合法/非法/边界
   - service 源 grep：覆盖关键 invariant（守不变字段、taskType 校验、auth、deep-merge 三态、$transaction）
   - **未覆盖**：runtime DB 操作（实际 prisma.update 行为、$transaction race 等）— 项目模式（参考 pr-sim-bug-fix-leak.test.ts）保持一致，Final QA staging 阶段需补
2. **service 行 273 `(existing.taskSnapshot ?? {})`**：如果 taskSnapshot 是 null（理论上 publish 时刻已写入但防御性 fallback），merge 仍工作；守不变字段三行检查 `!== undefined` 即正确处理
3. **当前 service 不阻挡 cross-course 协作教师 patch**：`isAuthorizedForInstance` 允许 `CourseTeacher` 表里的协作者改 — plan 接受此设计（与 A2 `updateTaskInstance` 同 auth 模型）

### 🟢 Anti-regression

- `updateTaskInstance` (L212) + `updateTaskInstanceSchema` (L137) 0 改动（A2 共享路径独立）
- 学生 runner / `(student)/tasks/[id]/page.tsx` 0 改动
- Prisma schema 0 改动
- `instance-header.tsx` + `instances/[id]/page.tsx`（A2 改的）0 改动
- A2 + C1-B touched files 完全不交集
- 6 pre-existing study-buddy tsc errors 数量不变

## Overall: **PASS**（r1a part of A1）

6/6 acceptance 全 PASS，tsc 0 new error，vitest 1030/1030 全过 + 0 regression，service 设计稳健（discriminated union + 双层防御 + deep-merge + 守不变字段 + $transaction）。

## 建议 coordinator

- 标 Task #4 备注 `r1a PASS`，**不**标 completed（A1 还有 r1b UI Sheet）
- builder 推进 r1b（overview-tab Sheet UI + 已批改 dialog 警告 + 三 taskType 表单分支）
- 风险登记：r1b 阶段 builder 需先 spike `components/task-wizard/SimulationConfigStep` 是否能 standalone 渲染（不依赖 wizard context）；若耦合严重则需抽离副本
- Final QA staging 阶段补 5 项真浏览器验证（推 r1b 完成后一次性验）：
  1. PATCH `/snapshot` 真请求 + 200 response shape
  2. 跨 taskType patch 返回 400 + 中文消息
  3. 已批改 instance 返回 gradedCount > 0
  4. 教师 A 改 instance taskSnapshot → 学生 runner 看到新配置（**需 Unit 17 在 main**）
  5. 协作教师 patch 允许

## Dynamic exit 进度

A2 + C1-B r1a/r1b/r1c + A1 r1a = **连续 5 PASS** — dynamic exit 持续保持。

我现在 idle 等下一任务（A1 r1b / B1 / B2 任一）。
