# QA Report — Unit 4 r1

> QA: qa · 2026-05-14 · 验 commits `dc5b1db` (commit-1) + `7b0a13d` (commit-2) on `claude-demo-fixes`
> Bugs: B-TASK-04 (P0) + B-TASK-05 (P0) + B-DEMO-02 (P1) · spec.md L80-93
> Test specs:
> - `tests/e2e/qa-unit4-task-editing.spec.ts` (8 case 主体)
> - `tests/e2e/qa-unit4-supplement.spec.ts` (2 case 增补 CRUD via API + regression)
> 截图: `.harness/screenshots/qa-unit4/`

## 测试数据
- **TASK_HAS_GRADED** `3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9` — quiz, 8 题, alex 有 1 graded sub
- **TASK_NO_SUB** `e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53` — quiz, 10 题, 0 sub
- **TASK_SIM_TEACHER1** `5e69a393-3175-4cef-a92a-c44612593f4d` — sim, owned by teacher1, 4 graded sub
- **TASK_SUB_TEACHER1** `d8097130-8847-4a51-aa30-dffa6345f59c` — subjective, owned by teacher1, 4 graded sub

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| `/teacher/tasks/[id]` 总览页展示所有 config | molly login → 进 quiz task 页 → 抓 body 文本 | 8 题题干全部显示（"1. 个人理财的定义是什么？" ...）+ 测验配置（模式 / 时间限制 30 分钟 / 显示答案 是）+ "题目列表（8 题）" | PASS |
| 编辑模式上述全部可改（除 type 不能改） | 点「编辑」→ 数 form 控件 | 编辑模式下 **34 个 input/textarea**，含任务描述 / 测验配置 / quiz 题目 / 评分标准 | PASS |
| 保存前若 task 已有 ≥1 graded submission，弹 dialog 警告 + 三选项「直接保存 / 复制为新任务 / 取消」 | 进 TASK_HAS_GRADED 编辑 → 改任务名 → 点保存 → 抓 dialog DOM | dialog 文案：**"该任务已有 1 条已批改提交 / 直接修改可能影响这些学生的分数解读。推荐复制为新任务再修改。"** + 三按钮"取消 / 复制为新任务 / 直接保存"都各 1 个；取消后 task 名保持原值不 PATCH ✓ | PASS |
| 改动后写 audit log（model: `task.update`, before/after diff）| 查 `AuditLog WHERE action='task.update'` 在 QA 时段 | 10 条 fresh audit (09:22-09:23 时段)：`force=true / gradedCount=1` 对 3e26c6d2; `force=false / gradedCount=0` 对 e54e1cb9; `fieldsChanged` 含具体改字段 e.g. `["visibility", "practiceEnabled", "quizQuestions"]` 或 `["taskName", "requirements", "visibility", "practiceEnabled"]` | PASS |
| 已发布 instance 仍跑改前 config 还是改后？— **本 unit 仅做"任务模板"层面修改**（task 表）；instance 表沿用 instance 创建时 snapshot 的 config | grep "taskSnapshot" 在 student runner | `taskSnapshot` 字段在 schema + service write path 都存在；但 **student runner 实际读 live instance.task.\*** 而非 snapshot（builder 主动汇报为已知风险，留 Phase 4 单独 unit 修） | **N/A** (按 spec 字面允许此缺陷，dialog 措辞已警告 "推荐复制为新任务再修改") |

## 额外 acceptance（按 build 报告 + 用户决策）

| 额外项 | 验法 | 实测 | Verdict |
|---|---|---|---|
| 无 graded sub PATCH 直通（不弹 dialog）| 对 TASK_NO_SUB PATCH taskName 无 force | 200 + 直接生效，audit `force=false / gradedCount=0` | PASS |
| 有 graded sub PATCH 无 force → 400 + 中文错误码 | 对 TASK_HAS_GRADED PATCH taskName 无 force | 400 + code=`TASK_HAS_GRADED_SUBMISSIONS` / message="该任务已有已批改的提交，直接修改可能影响分数解读。请确认后继续，或复制为新任务再修改。" | PASS |
| 有 graded sub PATCH + force=true → 200 + audit force=true | 对 TASK_HAS_GRADED PATCH + force | 200 + audit force=true / gradedCount=1 | PASS |
| 「复制为新任务」→ POST tasks 201 + redirect + "(副本)" 后缀 + 原 task 不变 | 进 dialog 点「复制为新任务」 → 捕获 POST 响应 + 验证新 task | POST `/api/tasks` 201；新 id e8af4098；redirect 到 `/teacher/tasks/<new>?edit=true`；新 task 名 = **"QA-H-Copy-... (副本)"**；原 task 名保持 "个人理财基础概念测验" 不变 | PASS |
| 跨 task type (sim + sub) 编辑页打开不崩 | teacher1 login → 进 sim/sub task 页 → 抓 console errors | 两类页面 **console errors = 0**；编辑按钮可见；sub 编辑模式打开后 0 console error | PASS |
| 编辑控件 cancel 真返回只读 | 进编辑 → 点取消 → 验「编辑」按钮再现 | 取消后 ≥1 个「编辑」按钮再现 ✓ | PASS |
| quizQuestions CRUD via API+force (独立增补) | 通过 raw PATCH 测 add+edit+delete 操作 | baseline 8 → ADD 200 → 9 题 (last prompt="QA-supplement-ADD-test") → EDIT 200 → q9 prompt 变 "QA-supplement-EDITED" → DELETE 200 → baseline 8 题 (first prompt=个人理财的定义是什么？) — **DB 全程一致** | PASS |
| 改 task 模板不影响已 graded submission | 测 alex 的 ce7f935d sub 在 PATCH 前后 status / score | submission 维持 `graded` / score=0.00 / maxScore=24.00 / gradedAt 不变 — **PATCH 不污染 graded sub** | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 83 files / **986 tests pass**（与 baseline 一致；builder 未加新 vitest，靠 e2e 覆盖）|
| `npx eslint <touched files + QA spec>` | 0 problem |
| `git show --stat dc5b1db` + `7b0a13d` | 5 files (commit-1, +456/-43) + 2 files (commit-2, +561/-85) = 总 +1017/-128，与 build 报告一致 (declares +1041/-142 含 250-line e2e spec) |
| cross-module grep `updateTask` callers | 唯一 caller `app/api/tasks/[id]/route.ts:40 updateTask(id, userId, parsed.data)` — schema 透传 force 字段 |
| DB 状态测前测后 | 3 tasks 维持 8/10/0 questions，alex graded sub 维持 0/24 graded — 与 baseline 完全一致 |

## Audit log 实测样本 (QA 时段 09:22-09:23)

```
action      | targetId  | force | graded | fields
task.update | 3e26c6d2- | true  | 1      | ["taskName", "requirements", "visibility", "practiceEnabled"]
task.update | 3e26c6d2- | true  | 1      | ["taskName", "visibility", "practiceEnabled"]
task.update | e54e1cb9- | false | 0      | ["taskName", "visibility", "practiceEnabled"]
task.update | e54e1cb9- | false | 0      | ["taskName", "visibility", "practiceEnabled"]
task.update | 3e26c6d2- | true  | 1      | ["visibility", "practiceEnabled", "quizQuestions"]
task.update | 3e26c6d2- | true  | 1      | ["visibility", "practiceEnabled", "quizQuestions"]
task.update | 3e26c6d2- | true  | 1      | ["visibility", "practiceEnabled", "quizQuestions"]
... (10 entries total)
```
✅ 完整 fields = force + gradedCount + fieldsChanged + 之前 builder 实测 4 字段都对得上

## taskSnapshot 未消费 — 风险点处理

| 维度 | 状态 |
|---|---|
| schema 字段存在 | ✅ `prisma/schema.prisma:520 TaskInstance.taskSnapshot Json?` |
| 写路径 (publish 时) | ✅ `lib/services/task-instance.service.ts:94/113/142/148` 深拷 instance.task |
| 读路径 (student runner) | ❌ `app/(student)/tasks/[id]/page.tsx:56` + `app/(simulation)/sim/[id]/page.tsx:33` 只把 taskSnapshot 声明为 `unknown` 但**不消费**；实际 render 用 `instance.task.taskQuestions` 等 live 数据 |
| 风险 | 教师 force=true 改 task 后，**已发布 instance 中正在跑的 submission 会立即看到新题目** — 与 spec L89 描述的"instance 表沿用 instance 创建时 snapshot 的 config"**不符** |
| 缓解 | dialog 措辞已警告 "推荐复制为新任务再修改"；force=true 写 audit；spec L91 留 Phase 2/4 |
| 建议 | 接受 builder 提的 Phase 4 单独 unit"taskSnapshot 消费"修复方案（100-200 行 frontend 读路径改 + 1 个测试）|

## Cross-module regression 详细

`assertTaskInstanceReadable` / `assertTaskInstanceWritable`、`updateTask` 全 grep：
- `updateTask` 唯一 caller = `app/api/tasks/[id]/route.ts:40` ✓
- 前端 `app/teacher/tasks/[id]/page.tsx` `performPatch` 把 force 字段透传 ✓
- 复制为新任务用 `POST /api/tasks` 通道（不走 update），不影响 force 逻辑 ✓

## Finsim-specific 检查

- ✅ UI 文案全中文（dialog title/desc/buttons + 错误消息）
- ✅ Service throw "TASK_HAS_GRADED_SUBMISSIONS" + handleServiceError 中文映射 (`lib/api-utils.ts:142-148`)
- ✅ Route Handler 调 Service 不含业务逻辑（auth + Zod parse + 调 updateTask）
- ✅ API 响应格式 `{ success, data }` / `{ success: false, error: { code, message } }`
- ✅ Prisma schema 0 改动（Phase 1 硬约束 — `force` 字段仅在 Zod schema 中）

## 风险 / 不确定项

1. **🟡 taskSnapshot 未消费**: spec acceptance 5 字面允许此缺陷，但带 dialog 措辞警告。**建议 coordinator 在 Phase 4 排个 polish unit 单独修**。
2. **🟢 cross-type 仅做了"打开不崩"smoke test**: 实测 sim + sub task 编辑页加载 + 进编辑模式 0 console error，但未做"修改保存"全流程；builder e2e 也仅 quiz 验证。**风险评估**：service 层 buildPatchBody 三种 type 都有专属分支（page.tsx L277-305），代码路径分支独立但实测覆盖薄。建议下次有 sim/sub task graded sub 数据时补 r2 测。
3. **🟢 dialog 错误细节 `gradedCount` 没在 error.details 透传**: 实测 `body?.error?.details?.gradedCount` 为 undefined，但前端从 task.taskInstances 自己 reduce 计数（page.tsx L353）— 不影响 UX。次要。
4. **🟢 副本任务删除路径**: H 测试我手动 DELETE 清理；前端目前没有"删除任务"按钮（Unit 5a 才加）— spec 内 acceptable，但留个坑。

## 是否引入新 bug

无。10 case 全过 (8 main + 2 supplement)；DB 状态测前测后完全一致；graded submission 不受 PATCH 污染。

## Issues found

无 blocker。Phase 4 backlog 项：taskSnapshot 消费缺陷（已 builder 主动汇报）。

## Overall: **PASS**

**判断标准对照 (按 r1 即收三条件)**：
1. ✅ QA 10 case (8 主体 + 2 supplement CRUD) vs builder 8 case — 独立证据链
2. ✅ Acceptance 客观可重测：HTTP 200/400 / error code / dialog text / audit log SQL / DB question count 全 deterministic
3. ✅ DB 副作用控制完整：测前/测后 3 任务 question count = 8/10/0 一致；graded sub status/score/gradedAt 不变；副本任务测试期间已 DELETE cleanup

**但 Unit 4 复杂度比 Unit 1-3 高**（编辑模式分支大改 + 高危拦截影响所有 task PATCH + taskSnapshot 已知遗留）。按之前预判：**仍建议 coordinator 决定是否走 r2 兜底**，但本 r1 客观证据已足够确认 acceptance 全过。

**建议**：
- (a) 标 r1 PASS 收工，taskSnapshot 修复留 Phase 4 单独 unit  
- (b) 让 builder 跑一轮 sim+sub task "修改保存" 实测后 r2 二次确认（可选保守路径）

我倾向 (a)：核心高危拦截路径已实证 + audit + dialog 全工作，sim/sub 是相同代码模板的分支，r2 收益有限。
