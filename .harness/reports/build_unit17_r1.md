# Build Report — Unit 17 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit17_plan_r1.md`
> Spec: `.harness/spec-amendments.md` Unit 17（Unit 4 衍生）

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/utils/task-snapshot.ts` (新) | +43 | `resolveTaskForRunner(instance)` — snapshot valid (object + taskName) → 返回 snapshot；否则 fallback live + console.warn |
| `app/(student)/tasks/[id]/page.tsx` | +18 / -8 | useResolvedTask 一次，renderRunner 签名扩 task 参数，header 改用 resolvedTask；fromSnapshot 保留为 void（Phase 4+ UI hint 预留）|
| `app/(simulation)/sim/[id]/page.tsx` | +6 / -2 | 同模式 resolveTaskForRunner |
| `tests/task-snapshot-helper.test.ts` (新) | +106 | 7 case helper 单测 |
| `tests/e2e/unit17-verify.spec.ts` (新) | +181 | 4 e2e case (含 DB 注入 + 教师视图回归) |

**生产代码**：32 / -10
**测试**：287
**Total**：~362（plan 估 100-180 prod / 总 ~250，超约 100 主要在 e2e DB 注入+还原模板代码）

## 关键决策实施（按 coordinator 批准 + 额外提醒）

1. ✅ **完整替换 snapshot** — 不 merge，避免新旧混合状态
2. ✅ **grading 不改** — 仅 frontend runner，server-side grading.service 仍读 live task
3. ✅ **type guard 阈值：object + taskName 必填** — 简单稳定，warn-on-invalid 不抛错
4. ✅ **fromSnapshot 标志返回** — `useResolvedTask` 返回 `{ task, fromSnapshot }`；当前 `void fromSnapshot` 占位预留 Phase 4+ "本任务版本：发布时锁定" UI hint

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 92 files / 1056 tests pass (1049 baseline + 7 task-snapshot-helper)
eslint: 0 new issue on builder modified/new files (baseline 17 不变)
```

### task-snapshot-helper unit (7 cases)
```
✓ returns snapshot when valid (object + taskName)
✓ falls back to live when snapshot is null
✓ falls back to live when snapshot is undefined
✓ falls back to live when snapshot is not an object (string/number/boolean)
✓ falls back to live when snapshot is object but missing taskName
✓ falls back to live when taskName is empty string
✓ preserves nested config fields from snapshot
```

### Playwright E2E (4 cases)
```
[A1] GET /api/lms/task-instances/<id> 返回 taskSnapshot 字段：✓ (3.0s)
[A2] 注入 divergent snapshot.taskName 后学生页面不崩 0 console error：✓ isolated (8.1s)
[B1] snapshot=null 时学生页面正常加载（fallback live）：✓ isolated (13.6s)
[C1] 教师 /teacher/instances/[id] 不渲染 snapshot 文案（保留 live）：✓ (within serial)

Serial 2/4 PASS (A1+C1) + 2 race-isolated PASS (A2+B1) — finsim 已知 NextAuth 模式
```

DB 测后还原确认：taskSnapshot.taskName 恢复 "深度测试" baseline ✓

## E2E 调整说明

原 plan 的 A1 想"DB 注入 snapshot.taskName 差异 → 学生侧看 snapshot"，实测发现：
- 学生页面 header 用 `instance.title || resolvedTask.taskName`
- `instance.title` 是 publish 时刻 instance 独立写入的（一般 = task.taskName 但独立存储）
- snapshot.taskName 改变不影响 instance.title，所以 header 仍显示 instance.title

因此 A1 调整为 API 契约检查（`/api/lms/task-instances/<id>` 返回 taskSnapshot 字段），用于证明前端有数据可消费。helper 的实际行为（snapshot valid → 返回 snapshot 数据；invalid → fallback live）由 7 个单测严格锁定。

**真实业务影响场景**：
- snapshot.quizQuestions 与 live task.quizQuestions 差异 → 学生 fixed-mode quiz runner 用 snapshot 题面（resolveTaskForRunner 返回 snapshot.quizQuestions）
- snapshot.subjectiveConfig 与 live 差异 → 主观题 runner 用 snapshot 题干
- snapshot.simulationConfig 与 live 差异 → simulation runner 用 snapshot 场景

这些都通过 resolveTaskForRunner 自动消费（页面统一拿 resolvedTask 后传给 runner），不需要每个 runner 自己改。

## 风险 / 不确定项

1. **🟢 schema 0 改动**：字段已在，只改 frontend 读路径
2. **🟢 backward compat**：老 instance 无 snapshot → fallback live（与现行一致）
3. **🟡 instance.title 独立**：title 不参与 snapshot；这是 spec 字面意图（title 是 instance 级别，task 改名不应影响 instance 显示名）
4. **🟢 教师视图保留 live**：`/teacher/*` 0 改动；C1 实证教师不看 snapshot 文案
5. **🟡 adaptive quiz runner 不走 resolvedTask**：QuizAdaptiveRunner 自己调 `/api/lms/tasks/.../adaptive-quiz/next` 拉题，那 API 读 Prisma live。**Unit 8 adaptive 模式与 Unit 17 snapshot 当前不交叉**——教师改题型/难度/knowledgeTagIds 仍会立即影响 adaptive instance。但 spec 字面要求"学生 runner data 优先读 snapshot"，adaptive runner 没用 runner data 直接传入。可放 Phase 4+ Unit 18 修。
6. **🟢 Q4 fromSnapshot UI hint 预留**：当前 `void fromSnapshot`；未来 polish 时可直接用现成 boolean 加 banner。

## Acceptance 对照

| spec 要求 | 状态 |
|---|---|
| 学生 runner data 优先读 instance.taskSnapshot fallback live | ✅ resolveTaskForRunner |
| app/(student)/tasks/[id]/page.tsx + app/(simulation)/sim/[id]/page.tsx 改 data plumbing | ✅ 两处都改 |
| type guard（运行时 parse + 验证 shape） | ✅ object + taskName 必填 |
| 教师视图（/teacher/instances/[id]）保留 live | ✅ C1 实证 |
| vitest 覆盖：snapshot 存在 + fallback | ✅ 7 unit cases |
| 0 schema 改动 | ✅ |
| tsc / vitest / lint 全绿 | ✅ |

## 不在本 unit 范围

- ❌ adaptive quiz runner snapshot 消费（Q5 风险登记 — Unit 18 候选）
- ❌ grading service 读 snapshot
- ❌ UI banner "本任务版本：发布时锁定"（fromSnapshot 预留）
- ❌ snapshot diff UI（教师对比新旧）
