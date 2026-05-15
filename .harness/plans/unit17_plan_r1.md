# Unit 17 Plan — taskSnapshot 字段消费

> Builder: builder · Round 1 · 2026-05-15
> Spec: `.harness/spec-amendments.md` Unit 17（Unit 4 衍生）
> Bug: 教师改 task 模板 → 正在跑的 instance 立即看到新题

## 调研发现

### A. Schema 现状

- `TaskInstance.taskSnapshot Json?` 字段已存在（schema:525）
- `task-instance.service.ts`:
  - `createPublishedTaskWithInstance` (line 81-121) — 创建+发布同步时写 snapshot
  - `publishTaskInstance` (line 123-152) — draft → published 时写 snapshot
  - snapshot 内容：full task + simulationConfig/quizConfig/subjectiveConfig/scoringCriteria/allocationSections/quizQuestions（通过 `taskSnapshotInclude`）

### B. 学生 runner 读取路径

| 文件 | 当前读取 | 问题 |
|---|---|---|
| `app/(student)/tasks/[id]/page.tsx` | `instance.task.*` (live) | 教师改 → 学生立即看到新题 |
| `app/(simulation)/sim/[id]/page.tsx` | `instance.task.*` (live) | 同上 |

两个文件的 TaskInstanceDetail interface 都有 `taskSnapshot: unknown` 字段，但**完全未消费**。

### C. 教师视图（保留 live）

- `/teacher/instances/[id]/page.tsx` → 仍读 `instance.task.*`（编辑入口需要最新模板）
- `/teacher/tasks/[id]/page.tsx` → 读 task 模板本身，不动

### D. taskSnapshot 结构

写入时序 `taskSnapshotInclude`：
```ts
{
  simulationConfig, quizConfig, subjectiveConfig,
  scoringCriteria, allocationSections, quizQuestions
}
```
JSON 化后保留 task 的其他字段（id/taskName/taskType/requirements 等）。**与 instance.task 形状基本一致**。

## 改动方案

### 1. 提取 type guard helper

新文件 `lib/utils/task-snapshot.ts`:

```ts
// 运行时校验 taskSnapshot 是合法 shape
// 失败 → 返回 null（fallback 到 live task）
export function resolveTaskForRunner<T extends { taskSnapshot: unknown; task: ... }>(
  instance: T,
): T["task"];
```

策略：
- snapshot 是 object 且有 `taskName` 字段 + `taskType` 字段 → 视为有效，merge 进 task shape
- 否则 fallback 到 instance.task

### 2. 改两个学生 runner 入口

```tsx
// app/(student)/tasks/[id]/page.tsx
const task = useMemo(() => resolveTaskForRunner(instance), [instance]);
// 把所有 instance.task.* 改为 task.*

// app/(simulation)/sim/[id]/page.tsx 同款
```

### 3. 教师视图不动

`/teacher/instances/[id]` 已直接读 task — 保留。

### 4. vitest 覆盖

新 `tests/task-snapshot-helper.test.ts`:
- snapshot 存在 + valid shape → 返回 snapshot 数据
- snapshot null/undefined → fallback live
- snapshot 缺关键字段（taskName/taskType）→ fallback live
- snapshot 类型不是 object → fallback live

## 关键决策

1. **snapshot 完整替换 instance.task 还是部分 merge？**
   → 完整替换。snapshot 是 publish 时刻的完整 task 快照（含全部嵌套 config + questions + criteria）。merge 会产生新旧混合状态，可能更脆弱。

2. **遇到 invalid snapshot 怎么办？**
   → fallback 到 live task + console.warn。不抛错（学生不能因为内部 schema 异常无法答题）。

3. **学生 grading 路径同步改？**
   → 不在本 unit 范围。grading.service 由 server-side 读取，本 unit 仅 frontend runner 读取路径。grading 用 live task 仍是符合 Unit 4 当前行为（教师改后已批改的分继续保留，新批改用 live）。如要 grading 也用 snapshot 是单独 unit。

4. **新 instance 仍看最新题目**：
   → 是的。publish 时刻 snapshot = 当时的 task；之后教师改 task 不影响该 instance（snapshot 已冻结）。新 instance 用新 task = publish 时新 snapshot。

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `lib/utils/task-snapshot.ts` (新) | 新 | resolveTaskForRunner + type guard |
| `app/(student)/tasks/[id]/page.tsx` | 改 | 用 resolveTaskForRunner；renderRunner 改用 resolved task |
| `app/(simulation)/sim/[id]/page.tsx` | 改 | 用 resolveTaskForRunner |
| `tests/task-snapshot-helper.test.ts` (新) | 新 | 4-5 case |
| `tests/e2e/unit17-verify.spec.ts` (新) | 新 | 2-3 case |

预计 100-180 行（含 tests）。

## 风险点

1. **🟢 schema 0 改动**：字段已在；service 已写；只改 frontend 读路径
2. **🟢 backward compat**：老 instance 无 snapshot → fallback live（与现行行为一致）
3. **🟡 type guard 严格度**：太松会让 invalid JSON 进 runner 渲染崩；太严会让正常 snapshot 误 fallback。先做"object + taskName 必填"最小检查。
4. **🟡 instance.task vs taskSnapshot 字段名差异**：snapshot 通过 `JSON.parse(JSON.stringify(...))` 序列化，Date 会变 string。runner 通常不消费 task 上的 Date 字段（dueAt 等在 instance 上），但需 spot-check。
5. **🟢 教师视图保留 live**：不动 `/teacher/*` 路径

## 自测计划

### Unit tests (vitest)
- snapshot valid → return snapshot
- snapshot null → return live
- snapshot 不是 object → return live
- snapshot 缺 taskName → return live (treat as invalid)
- nested config 字段保留

### E2E
- 新发布 instance 学生进入正常显示题目
- 老 instance (snapshot=null) fallback 不崩
- 教师 `/teacher/instances/[id]` 仍渲染（保留 live）

## 不在本 unit 范围

- ❌ grading.service 改读 snapshot（独立 unit 决定）
- ❌ snapshot diff UI（教师看老 vs 新）
- ❌ 已批改 submission backfill snapshot（schema 已存在 snapshot 字段，写入时机已对）

## 待 coordinator 确认

1. **完整替换 vs merge**：选完整替换（plan 推荐）
2. **grading 路径不改**：本 unit 范围限定 frontend runner
3. **type guard 阈值**：object + taskName 即视为有效
