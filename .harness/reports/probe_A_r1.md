# Probe A · 实例编辑 — Round 1

> qa@instance-workbench · 2026-05-15 静态代码 probe（Read + grep only）

## 1. 现状矩阵

`/teacher/instances/[id]` overview 显示字段：

| 字段 | 可改？ | 证据 |
|---|---|---|
| `releaseMode` / `autoReleaseAt` | ✅ | `app/teacher/instances/[id]/page.tsx:213-247` 调 `PATCH /release-config` |
| `status` 草稿/已发布/已关闭 | ✅ | 同页 + `/close` / `/reopen` 子路由 |
| `title` / `description` / `dueAt` / `attemptsAllowed` / `groupIds` | ⚠️ 后端 PATCH 已支持，前端零入口 | `lib/validators/task.schema.ts:137-145` 含 title; service `updateTaskInstance` L239-261; UI 端 0 入口 |
| simulation/quiz/subjective config | ❌ 后端 API 不存在 | 子路径仅 `close` / `insights` / `publish` / `release-config` / `reopen`，无 snapshot |
| `quizQuestions[]` / `allocationSections` | ❌ | service 层无 patch snapshot 函数；snapshot 仅在 createPublishedTaskWithInstance L94 + publishTaskInstance L169 一次性写入 |

## 2. title 字段 — Prisma schema 完备

`prisma/schema.prisma:510`：
```
model TaskInstance {
  title         String  @db.VarChar(200)  ← 已存在
  taskSnapshot  Json?   ← L525 已存在
}
```

5 个展示位都从 instance row 取（API 返回 instance.title）— A2 改一处全局同步。

## 3. updateTaskInstanceSchema — A2 后端已就绪

`lib/validators/task.schema.ts:137-145`：
```typescript
export const updateTaskInstanceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  publishAt: z.string().datetime().optional(),
  attemptsAllowed: z.number().int().min(1).optional(),
  groupIds: z.array(z.string().uuid()).optional(),
  status: z.enum(["draft","published","closed","archived"]).optional(),
});
```

Service `updateTaskInstance` (L239-261) 已 patch 这些字段。Route handler `app/api/lms/task-instances/[id]/route.ts:34-51` 已串接。

**A2 零后端改动**。

## 4. 衍生 Bug 清单

- **A-PROBE-1 · 标题"冻结"**（→ A2）：UI plumbing 缺 pen icon + inline editor
- **A-PROBE-2 · 配置全部 readonly**（→ A1）：缺 PATCH /snapshot endpoint + service + Zod + Sheet UI
- **A-PROBE-3 · UX：readonly 不明显**：overview 没标"实例已锁，需重建"
- **A-PROBE-4 · "编辑配置"按钮缺**：overview-tab.tsx:108-115 只有"预览学生视角"
- **A-PROBE-5 · 已批改防御缺**：当前 0 提示，A1 service 层须 count graded + dialog

## 5. 修复粒度估算

### A1 ~340 行（接近 150 上限 → 可拆 r1a service+API、r1b UI+test）

| 文件 | 改动 | 行 |
|---|---|---|
| `lib/services/task-instance.service.ts` | append `updateTaskInstanceSnapshot` + auth + count graded + deep-merge | +50 |
| `lib/validators/task.schema.ts` | append `updateTaskInstanceSnapshotSchema` discriminated union | +60 |
| `app/api/lms/task-instances/[id]/snapshot/route.ts` | new PATCH | +30 |
| `components/instance-detail/overview-tab.tsx` | 加 Sheet + 编辑配置按钮 + warning dialog | +80 |
| `tests/instance-detail-snapshot.test.ts` | vitest ≥3 | +120 |

### A2 ~70 行

| 文件 | 改动 | 行 |
|---|---|---|
| `components/instance-detail/instance-header.tsx` | 加 EditableTitle inline 组件 | +40 |
| `tests/instance-header-editable-title.test.ts` | vitest ≥1 | +30 |

## 6. 风险

1. **A1 task-wizard 子组件耦合 wizard context** — builder 先 spike SimulationConfigStep 是否能 standalone
2. **A1 snapshot deep-merge 守 task.id/taskType 不变** — service 层 explicit 拒绝
3. **A2 五处标题显示位** — 已 grep 6 个文件含 `instance.title`，dashboard/`/teacher/tasks`/`/grades` 列表页源码需 builder 二次确认

## 7. 端到端就绪

Unit 17 的 `lib/utils/task-snapshot.ts::resolveTaskForRunner` 已合入主仓库 working tree（claude-demo-fixes 分支）— A1 一写入 snapshot，学生 runner 立刻看到新配置。**Final QA E2E 需待 Unit 17 进 main**。
