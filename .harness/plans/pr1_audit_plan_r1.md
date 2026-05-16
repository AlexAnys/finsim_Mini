# Plan — PR-1 Candidate D · 审计 default-on + actorRole + 补漏 (r1)

> Builder: builder-audit · Branch: `claude-codequality-pr1` · Base: main `f2365b7`
> Scope 边界: 不动 A 的 tests/ 配置 / E 的 lib/ai/prompts/ / I+J 的 prisma schema 字段

## 目标（来自 spec.md "D 专属 acceptance"）

1. 删 `ENABLE_AUDIT_LOGS` env gate（audit.service.ts + .env.example）
2. 删 `logAudit` 函数 / rename `logAuditForced` → `logAuditEvent`，所有 caller 重命名
3. 补 `updateTaskInstance` + `updateTaskInstanceSnapshot` 缺失的 audit
4. 补 grading auto-grade (gradeSimulation/gradeQuiz/gradeSubjective) 的 audit（含 model + tokens metadata）
5. `logAuditEvent` 接口加 `actorRole` field（wrapper 内 fall back 用 `getCourseActorRole` 自动推导，若 caller 已传则不查）
6. vitest 覆盖：assert publish / ai-grade / snapshot-update 在 `ENABLE_AUDIT_LOGS` 任意值都写 AuditLog
7. 真浏览器：molly 改 instance title → /admin/audit 看到 audit 行 + actorRole=owner

## 三个决策点（plan 阶段先 ask coordinator）

### Q1 — `logAudit` rename 到 `logAuditEvent` 是否保留 deprecated alias？

**Builder 建议**：**hard rename，不保留 alias**。

理由：
- finsim 是单仓库 monorepo，没有外部 caller
- 全 codebase 25 个文件 ~50 处 call site，单 commit 同步改名工作量可控（脚本批量 sed + 手工校核）
- 保留 alias 会让 review-arch F-5 "audit 二态语义" 的债务半残留
- D 候选的 spec 写得很明确："删 logAudit 函数 + rename logAuditForced → logAuditEvent，所有 caller 同步"

风险：与 E 候选 / I+J 候选 worktree 撞车 — E 不动 audit.service 内部接口；I+J 主要动 prisma schema 不涉及 audit signature。冲突面 = 0。

### Q2 — grading auto-grade audit 写在 grading.service 还是 ai.service？

**Builder 建议**：**写在 grading.service**（不在 ai.service）。

理由：
- ai.service 是低层调用 LLM 的 plumbing（generateText / aiGenerateJSON），不知道是"批改"还是"教师 AI 助手"还是"学伴回答"。让它写 audit = 把"评分"语义往下漏到错误层级。
- grading.service 是业务编排层，已经在 try/catch 里调 `logAudit({ action: "submission.grade", ... })`（grading.service.ts:216）。改 action 名为 `ai_grading.complete` + 加 model/tokens metadata = 1 处改动。
- model/tokens 怎么拿：让 `aiService.evaluateSimulation` / `aiService.aiGenerateJSON` 返回包装对象 `{ data, provider, model, inputTokens, outputTokens }` —— 但这会破坏 evaluateSimulation 现在直接 return data 的接口（caller 在 grading 里直接读 `evaluation.totalScore`）。
- **更省的方案**：grading.service 调 AI 前后拿到 model/tokens 的方式 = **不改 AI service 接口**，而是 grading 调完后立刻 query `prisma.aiRun.findFirst({ where: { userId, feature: "evaluation", createdAt: { gte: startedAt } }, orderBy: { createdAt: "desc" } })` 拿到 last AiRun（注：finishAiRun 已经写 inputTokens/outputTokens/model 到 AiRun 表）。
- **最稳妥**：直接在 evaluateSimulation / aiGenerateJSON 调用前后用 `startedAt = Date.now()`，AI service 返回 data；audit metadata 里写 `{ taskType, feature, settingsUserId, durationMs }`，model/tokens 不放 audit 而放 AiRun（已经有了），audit 行通过 metadata.submissionId join 到 AiRun。这样 audit 表保持薄。**但 spec 明确要求 audit metadata 带 model + tokens**，那只能改 AI service 接口让它返回 model/usage。

**最终建议方案**：
1. 改 `aiService.evaluateSimulation` 返回 `{ evaluation: ..., model: string, inputTokens: number|null, outputTokens: number|null }`（向下兼容：grading.service 调整一处解构）。
2. 改 `aiService.aiGenerateJSON` 同样返回 `{ data: T, model, inputTokens, outputTokens }` — 但这条会影响 ~10 个 caller，重构面太大。
3. **替代**：在 ai.service 加 `getLastAiRunMetadata(userId, feature, since)` helper；grading 在 await 完 AI 后调它拿 model/tokens 写入 audit。**这是 builder 推荐方案**：不破 AI service 接口，audit 多一次 DB select 但只在 grade 时（低频）。

需要 coord 拍板：方案 1（破 evaluateSimulation 接口 + 改 grading 一处）vs 方案 3（加 helper 不破接口 + 多 1 DB select per grade）。

### Q3 — `actorRole` 字段在 AuditLog schema 加 column 还是塞 metadata Json？

**Builder 建议**：**塞 metadata Json，不加 column**。

理由：
- spec 文本说 "logAuditEvent 接口加 `actorRole` field" — 指的是函数 **参数接口** 加 field，不是 DB schema 加 column
- 当前 AuditLog 表已有 `metadata Json?` —— actorRole 进 metadata 既符合 review-security F-8 "audit metadata 加 actorRole 字段" 的描述，也避免 Prisma 三步重启 dev server 的成本
- 已经有 30+ caller 把 `actorRole` 塞 metadata 里（如 `chapters/route.ts:42 metadata.actorRole`），保持一致性
- 加 column 的成本 ≥ benefit：column 查询性能只有"按 actorRole 筛选 audit 列表"时受益（admin/audit 页 list 不按 actorRole 筛），现在 metadata Json 也可 `where: { metadata: { path: ["actorRole"], equals: "admin" } }`
- I+J 候选已经在动 schema，避免 Prisma migration 撞车

**如果 coord 偏好 column 级**：另开 plan r2 + 走 Prisma 三步严格流程 + 加 metadata→column 数据迁移脚本。但这是 nice-to-have，非 blocking。

## 实现方案（待 Q1/Q2/Q3 拍板）

### Step 1 — audit.service.ts 重构

```typescript
// 删 logAudit + ENABLE_AUDIT_LOGS env check
// rename logAuditForced → logAuditEvent
// 加 actorRole 参数（optional），wrapper 内有 courseId 则 fallback 用 getCourseActorRole

export async function logAuditEvent(data: {
  action: string;
  actorId?: string;
  actorRole?: CourseActorRole;  // 新增
  targetId?: string;
  targetType?: string;
  courseId?: string;             // 新增（用于 fallback 推导 actorRole）
  actorRoleHint?: string;        // 新增（caller 已知 user.role，比如 "admin" 直接传，省一次 DB 查）
  metadata?: Record<string, unknown>;
}) {
  let actorRole = data.actorRole;
  if (!actorRole && data.courseId && data.actorId) {
    actorRole = await getCourseActorRole(data.courseId, data.actorId, data.actorRoleHint || "teacher");
  }
  const mergedMetadata = {
    ...(data.metadata || {}),
    ...(actorRole && { actorRole }),
  };
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        actorId: data.actorId,
        targetId: data.targetId,
        targetType: data.targetType,
        metadata: mergedMetadata,
      },
    });
  } catch (error) {
    console.error("审计日志写入失败:", error);
  }
}
```

### Step 2 — 重命名所有 caller (sed + 手工)

**Routes（10 文件，13 处 call site）**：
- `app/api/lms/sections/route.ts` (1)
- `app/api/lms/sections/[id]/route.ts` (2)
- `app/api/lms/chapters/route.ts` (1)
- `app/api/lms/chapters/[id]/route.ts` (2)
- `app/api/lms/content-blocks/route.ts` (1)
- `app/api/lms/content-blocks/[id]/route.ts` (2)
- `app/api/lms/courses/[id]/route.ts` (1)
- `app/api/lms/courses/[id]/classes/route.ts` (2)
- `app/api/lms/task-instances/with-task/route.ts` (1, `logAudit` → `logAuditEvent`)
- `app/api/lms/task-instances/[id]/publish/route.ts` (1, `logAudit` → `logAuditEvent`)
- `app/api/lms/course-knowledge-sources/[id]/route.ts` (1)
- `app/api/submissions/[id]/grade/route.ts` (1)

**Services（9 文件，13 处 call site）**：
- `lib/services/audit.service.ts` (自身定义)
- `lib/services/release.service.ts` (6)
- `lib/services/study-buddy.service.ts` (1)
- `lib/services/course.service.ts` (1)
- `lib/services/course-knowledge-source.service.ts` (1)
- `lib/services/grading.service.ts` (2, `logAudit` → `logAuditEvent`)
- `lib/services/task-build-draft.service.ts` (1, `logAudit` → `logAuditEvent`)
- `lib/services/task.service.ts` (2)
- `lib/services/submission.service.ts` (1)
- `lib/services/task-instance.service.ts` (3)

**Tests（4 文件）**：
- `tests/pr-fix-1-batch-a.test.ts` — 删 "logAudit env-gated" 测试段（不再适用），替换为 "logAuditEvent 在 ENABLE_AUDIT_LOGS 任意值都写"
- `tests/grading-late-penalty.test.ts` — mock 改 `logAuditEvent`
- `tests/task-build-draft-approve.test.ts` — mock 改 `logAuditEvent`
- `tests/fix-6-grading-fail-feedback.test.ts` — mock 改 `logAuditEvent`

### Step 3 — 补漏 audit

**updateTaskInstance（task-instance.service.ts:252）— 加 audit**：
```typescript
await logAuditEvent({
  action: "task_instance.update",
  actorId: createdBy,
  targetId: instanceId,
  targetType: "TaskInstance",
  courseId: existing.courseId ?? undefined,
  metadata: { changedFields: Object.keys(input) },
});
```

**updateTaskInstanceSnapshot（task-instance.service.ts:367）— 加 audit**：
```typescript
await logAuditEvent({
  action: "task_instance.snapshot_update",
  actorId: createdBy,
  targetId: instanceId,
  targetType: "TaskInstance",
  courseId: existing.courseId ?? undefined,
  metadata: { taskType: patch.taskType, gradedCount, ...(gradedCount > 0 && { force: true }) },
});
```

**grading.service.ts:216 — 改 action 名 + 加 model/tokens metadata**：
- 当前 action `submission.grade`（手批 / AI 批 不分），改用 `ai_grading.complete`（auto-grade 专用）
- 加 metadata `{ taskType, model, inputTokens, outputTokens, settingsUserId, durationMs }`
- model/tokens 来源依 Q2 决策（方案 3：调 `getLastAiRunMetadata`）

**submission.service.ts:367** 已有手批 audit（`submission.grade`），保留不动；区分 manual vs ai by action 名（manual = `submission.grade`，ai = `ai_grading.complete`）。

### Step 4 — vitest 测试覆盖

新文件 `tests/audit-default-on.test.ts`：
- it("logAuditEvent writes when ENABLE_AUDIT_LOGS=false") ← 替换原 forced 测试
- it("logAuditEvent writes when ENABLE_AUDIT_LOGS unset")
- it("logAuditEvent 自动推导 actorRole 当 courseId 提供")
- it("logAuditEvent 不查 DB 当 actorRole 已传")
- it("publishTaskInstance → AuditLog row 写入 with actorRole")（service-level smoke，mock prisma）
- it("updateTaskInstanceSnapshot → AuditLog row 含 gradedCount + force")
- it("gradeSubmission ai path → action 'ai_grading.complete' + model/tokens metadata")

### Step 5 — .env.example 删 ENABLE_AUDIT_LOGS

```diff
-ENABLE_AUDIT_LOGS=true
 ENABLE_STUDY_BUDDY=true
```

注：`.env.production.example` 不存在（spec 里写的是假设性的；实际只有 `.env.example`）。

### Step 6 — 真浏览器验证

1. 启 dev server
2. molly@qq.com 登录 → /teacher/instances → 改一个 instance title
3. admin@finsim.edu.cn 登录 → /admin/audit → 看到 `task_instance.update` 行 + metadata.actorRole === "owner"

## 风险

- **Q2 待 coord 拍板**：如果走方案 1（破 AI service 接口），影响 ~10 callers；方案 3（加 helper）影响只在 grading.service。Builder 强烈倾向方案 3。
- **撞车 E 候选**：E 改 ai.service prompt 段；D 若走方案 1 也改 ai.service。先做 D 的 audit 加 helper 完全不撞 E。
- **撞车 I+J 候选**：I+J 改 prisma schema；D 不改 schema（actorRole 进 metadata Json）= 零撞车。
- **测试可能误删**：tests/pr-fix-1-batch-a.test.ts 的 forced/regular 双测试是 UX5 留下的 regression guard，删它意味着丢一份"防 logAudit 回归"的保护 — 但 logAudit 函数本身被删，guard 自然失效，是合理删除。
- **review-pr13 F-1 提到 PATCH /[id] 与 PATCH /[id]/snapshot 应该合并**：那是 architectural debt（P1），不在 D 候选 scope；我只补 audit 不动 route 结构。

## 文件清单（最终）

**修改**：
- `lib/services/audit.service.ts` — rewrite
- `lib/services/grading.service.ts` — action 名 + metadata + 可能加 helper 调用
- `lib/services/task-instance.service.ts` — 补 updateTaskInstance + updateTaskInstanceSnapshot audit
- `lib/services/ai.service.ts` — 加 `getLastAiRunMetadata` helper（方案 3）
- 12+ routes + 9+ services — 重命名 import + call
- 4 个 tests — mock 名更新
- `.env.example` — 删 ENABLE_AUDIT_LOGS

**新增**：
- `tests/audit-default-on.test.ts`

**删除**：无（audit.service.ts 内的 logAudit 函数体被删但文件保留）

## 执行顺序

1. 等 coord 回答 Q1/Q2/Q3
2. Step 5 (`.env.example`) + Step 1 (audit.service rewrite, 含 logAudit 删除)
3. Step 2 全 codebase rename（同 commit，保证 tsc 不挂）
4. Step 3 补漏 audit
5. Step 4 写新测试 + 改老测试 mock
6. 跑 `npx tsc --noEmit && npx vitest run`
7. Step 6 真浏览器验证 + 写 build report
