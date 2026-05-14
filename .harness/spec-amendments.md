# Spec Amendments — 实施过程中追加的 unit / 决策

## Unit 17（Unit 4 衍生）— taskSnapshot 字段消费

**触发**：Unit 4 r1 实施期间 builder 发现 `TaskInstance.taskSnapshot Json?` schema 字段已存在 + service create/publish 时已写快照，但学生 runner 直接读 `instance.task.*` live 数据，导致教师改 task 模板后正在跑的 instance 会立即看到新题。

**风险**：
- 学生答到一半题目突然变了
- 已 graded submission 的题目和当前题目不一致（教师批改 N 题，学生看到 N+1 题）

**Unit 4 临时缓解**：高危改动 dialog 措辞警告"推荐复制为新任务"，但不修根。

**Unit 17 修法**（放在 Phase 4 polish，单独 unit）：
1. 学生 runner data 优先读 `instance.taskSnapshot`，fallback 到 `instance.task.*`（兼容老数据）
2. `app/(student)/tasks/[id]/page.tsx` + `app/(simulation)/sim/[id]/page.tsx` 改 data plumbing
3. 加 type guard（taskSnapshot 是 Json，运行时 parse + 验证 shape）
4. 教师视图（`/teacher/instances/[id]`）保留读 live `instance.task.*`（教师看最新模板）
5. vitest 覆盖：snapshot 存在时优先读它；snapshot 缺失时 fallback

**预计**：100-200 行，纯 frontend 读路径 + 1 个 vitest。

**Acceptance**：
- 教师改 task 模板后，已发布有 submission 的 instance 学生侧仍看到改前题目（与 submission 一致）
- 新发布的 instance 仍看到最新题目（因为 publish 时 snapshot = 当时的 task）
- 教师视图始终看 live task（编辑入口）

---

## Decisions log（实施过程中的产品/技术决策记录）

### 2026-05-14 Unit 4 r1
- Q4 (taskSnapshot 修不修根) → 选 A：本 unit 不修根，dialog 警告，Unit 17 单独修
- Q3 (复用 wizard vs inline) → 选 inline：耦合面小 + 无 wizard prop drift 风险
- Dialog 三按钮配色：取消（default）/ 复制为新任务（primary 推荐）/ 直接保存（destructive）

### 2026-05-14 Unit 2 r1
- spec 字面 "closedAt 清空" → 实际 schema 无该字段，决定走 AuditLog 时间戳替代（符合 Phase 1 不动 schema 硬约束）

### 2026-05-14 Unit 1 r1
- spec 路径写错（`components/teacher/analytics-v2/` vs 实际 `components/analytics-v2/`）— 以代码为准
- B-DASH-02 dialog a11y 看起来已合规但实测仍报 warning，根因是手写 `aria-describedby` 覆盖了 Radix auto-id 导致 `getElementById` 找不到 → 修法删手写让 Radix 全自动联通
