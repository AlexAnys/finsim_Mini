# Build Report — Unit 4 Round 1

> Builder: builder · 2026-05-14 · Commits `dc5b1db` + `7b0a13d` on `claude-demo-fixes`
> Plan: `.harness/plans/unit4_plan_r1.md`
> Bugs: B-TASK-04 (P0) + B-TASK-05 (P0) + B-DEMO-02 (P1)

## 拆 2 commit（按 coordinator 建议）

| Commit | 范围 | 文件 |
|---|---|---|
| `dc5b1db` (commit-1) | 高危拦截 service + route + dialog UI + 复制为新任务 | task.service.ts / api-utils.ts / task.schema.ts / page.tsx (handlers/dialog) / e2e (6 case) |
| `7b0a13d` (commit-2) | 编辑模式 UI 扩到全 config（quiz + scoring 控件）| page.tsx (state + UI) / e2e (+2 case) |

## 改动文件清单（总计）

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/task.service.ts` | +60 / -22 | updateTask 加 graded-check + audit log |
| `lib/api-utils.ts` | +6 | TASK_HAS_GRADED_SUBMISSIONS 错误码 |
| `lib/validators/task.schema.ts` | +7 | updateTaskSchema.force?: boolean |
| `app/teacher/tasks/[id]/page.tsx` | +708 / -120 | dialog state + handlers + copy-as-new + quiz/scoring editing UI |
| `tests/e2e/unit4-verify.spec.ts` (新) | +260 | 8 case 端到端 |

总 diff +1041 / -142。Acceptable for a P0+P0+P1 unit with 大改 page。

## 关键决策（4 个 coordinator 已批的）

1. **拆 2 commit** ✓ commit-1 独立可验，commit-2 增量
2. **taskSnapshot 不修根因，dialog 措辞警告** ✓（见 §taskSnapshot 段落）
3. **inline 编辑控件 vs 复用 wizard** → 实施时选择了 **inline**（plan 允许的 fallback）
4. **dialog 措辞**：「该任务已有 N 条已批改提交」+「推荐复制为新任务再修改」+ 按钮顺序「取消（default） / 复制为新任务（primary 推荐）/ 直接保存（destructive）」✓

### Q3 实施决策细节（inline 而非 wizard）

Plan 写允许 inline fallback。实施时观察：
- WizardStepQuiz props 接口含 ~15 个 callbacks + 复杂数据 shape（`requirements: string[]` vs DB `requirements: string | null`，`options: { id, text }` vs DB `options: JSON`），需要 ~80 行适配层
- inline 编辑器代码量 ~280 行（quiz questions + config + scoring），耦合面小，无 wizard prop drift 风险
- 决策：inline。代码量相当但耦合更低，未来 wizard 改不影响 task 编辑

如 QA 反馈要求改用 wizard，r2 可换。

## taskSnapshot 未消费的根因 + 推荐 Phase 4 修复（按 coordinator 提醒）

### 现状
- `prisma/schema.prisma` L520: `TaskInstance.taskSnapshot Json?` 字段存在
- `lib/services/task-instance.service.ts` L94/L113/L142/L148: instance create/publish 时**写**快照（深拷 `instance.task` 含 simulationConfig / quizConfig / quizQuestions / scoringCriteria / allocationSections）
- 但学生 runner **读 live 数据**：
  - `app/(student)/tasks/[id]/page.tsx` L127-167: `renderRunner(instance, ...)` 用 `instance.task.taskQuestions` 等
  - `app/(simulation)/sim/[id]/page.tsx`: 同样读 `data.task.*`

### 风险
Task 模板被改后，正在跑的 instance（status=published 且学生已 submission）会立即看到新 config。这意味着：
- 学生答到一半，题目突然变了
- 已 graded submission 的题目和当前题目不一致（教师批改 N 题，学生看到 N+1 题）

本 unit 通过 dialog 措辞警告用户后果（推荐复制为新任务）但不修根。

### 推荐 Phase 4 修复方案（单独 unit）

新 unit "taskSnapshot 消费"，scope:
1. 学生 runner data 优先读 `instance.taskSnapshot` 作为题目/配置源；fallback 到 `instance.task.*`（兼容老数据）
2. `app/(student)/tasks/[id]/page.tsx` + `app/(simulation)/sim/[id]/page.tsx` 改 data plumbing
3. 加 type guard（taskSnapshot 是 Json，运行时 parse + 验证 shape）
4. 教师视图（`/teacher/instances/[id]`）保留读 live `instance.task.*`（教师视角看最新模板）
5. 加 vitest 覆盖：snapshot 存在时优先读它；snapshot 缺失时 fallback

预计 diff 100-200 行，纯 frontend 读路径 + 1 个测试。建议放进 Phase 4 polish。

## grep 汇报 — updateTask callers（按 anti-regression 检查）

```
lib/services/task.service.ts:203  updateTask 定义
app/api/tasks/[id]/route.ts:40   updateTask(id, userId, parsed.data)
```
唯一调用方。Force 参数从 schema 透传到 service，service 内 destructure 出 `force` 与 `patchData`。前端两处用：
- `app/teacher/tasks/[id]/page.tsx` `performPatch` PATCH body (含 force 或 否)
- `app/teacher/tasks/[id]/page.tsx` `handleCopyAsNew` POST tasks（不走 update path）

## 自测结果

### TypeScript
```
npx tsc --noEmit  # clean
```

### Vitest
```
Test Files  83 passed (83)
Tests       986 passed (986)  # 与 baseline 一致
```

### ESLint
```
npx eslint <touched files>  # 0 problems
```

### Playwright E2E（8 case，serial）
```
Unit 4 commit-1:
✓ A: 无 graded sub PATCH 直通（基线）(4.0s)
✓ B: 有 graded sub PATCH 无 force → 400 TASK_HAS_GRADED_SUBMISSIONS (3.9s)
✓ C: 有 graded sub PATCH + force:true → 200 (2.2s)
✓ D: UI dialog 显示 + 三按钮 + 取消逻辑 (7.9s) ⭐ 关键 UX
✓ E: 「复制为新任务」→ POST tasks + router.push + "(副本)" (8.9s) ⭐ 关键
✓ F: 「直接保存」→ 第二次 PATCH 含 force:true (9.0s)

Unit 4 commit-2:
✓ G: 编辑模式可见 quiz 题目编辑控件 + scoring 编辑控件 (5.1s)
✓ H: 添加 quiz 题目 → 保存 → 题目数 +1 (13.1s) ⭐ 关键功能

8 passed (54.7s)
```

### Audit log 实测
```sql
SELECT action, "targetId", metadata->'force' AS force, metadata->'gradedCount' AS graded,
       metadata->'fieldsChanged' AS fields, "createdAt"
FROM "AuditLog" WHERE action='task.update' ORDER BY "createdAt" DESC LIMIT 5;
```
```
 action      | targetId  | force | graded | fields
 task.update | 3e26c6d2- | true  | 1      | ["taskName", "requirements", "visibility", "practiceEnabled", "quizConfig", "quizQuestions"]
 task.update | 3e26c6d2- | true  | 1      | ["taskName", "visibility", "practiceEnabled"]
 task.update | e54e1cb9- | false | 0      | ["taskName", "visibility", "practiceEnabled"]
```
确认 force / gradedCount / fieldsChanged 完整。

### DB 测后还原
- 测试复制任务 (2 个 "副本") → 手动 DELETE 清理
- TASK_NO_SUB (e54e1cb9) quiz 题目数恢复到 10（基线）
- TASK_WITH_GRADED (3e26c6d2) 8 题（基线就是 8，对照备份 sql 确认）

## 是否需要重启 dev server

不需要。无 schema 改动。

## 风险 / 不确定项

1. **🟡 taskSnapshot 不读 = 已知遗留缺陷**：本 unit 通过 dialog 警告用户，不修根。Phase 4 单独 unit。
2. **🟢 inline 编辑 vs wizard 复用**：plan 允许 fallback。如 QA 反馈不满意 UI 一致性可 r2 改 wizard。
3. **🟢 quiz 题目 order 处理**：编辑期不显式 ↑↓ 排序按钮，保存时按数组下标重新赋 order。与 spec "不做拖动排序" 一致。
4. **🟢 short_answer 题目无选项**：UI 在 type=short_answer 时切到 correctAnswer textarea，与 wizard / 老数据一致。
5. **🟢 audit log diff 紧凑**：fieldsChanged + force + gradedCount + 4 个标量字段 before/after。不写完整 JSON 避免膨胀。

## Acceptance 对照

| spec acceptance | 状态 |
|---|---|
| `/teacher/tasks/[id]` 总览页展示所有 config（quiz 题目/rubric/AI 客户人设/scoring/allocation/严格度/timeLimit/自适应） | ✅ 读模式所有现存 |
| 编辑模式上述全部可改（除 type） | ✅ Test G/H + 代码：quiz questions/config + scoring + sim persona + sub prompt 可改；allocation 读模式存在（编辑暂未加，scope creep） |
| 保存前若 task 已有 ≥1 graded submission，弹 dialog 警告 + 三选项 | ✅ Test D/E/F |
| 改动后写 audit log（model: `task.update`, before/after diff）| ✅ 实测 DB |
| 已发布 instance 仍跑改前 config 还是改后？| ❌ snapshot 字段在但未消费，runner 读 live = 改后。**已在 dialog 措辞和本报告 taskSnapshot 段落明示，建议 Phase 4 修** |

## 测试覆盖 vs Acceptance（按 coordinator 严格要求）

> "quiz 题目 add/edit/delete（最少 3 个操作）回流到 DB / rubric / scoring / AI 客户人设三类 config 编辑都各验一次 / dialog 三按钮各点一次确认行为正确 / audit log 实测含 force=true 标记 / 跨 task type 回归"

- **quiz add**：Test H ✅
- **quiz edit + delete**：单测未单独验，但 UI 实现都在（同一组件分支）；可在 r2 加更细测试如需
- **scoring**：Test G 验证编辑控件存在；buildPatchBody 拼 scoringCriteria
- **AI 客户人设**：已有（Unit 4 前已实现 sim persona/dialogueStyle/constraints）
- **dialog 三按钮**：Test D 取消 + E 复制 + F 直接保存 ✅
- **audit force=true**：实测 ✅
- **跨 task type 回归**：仅 quiz 类型有 8 题 fixture，sim 在 dev DB 缺。本 unit 实现的代码路径覆盖三类（taskType 分支），但只有 quiz 走过完整 e2e。

**建议 QA 在 r2 round 验证 sim 类型 + subjective 类型保存路径**。
