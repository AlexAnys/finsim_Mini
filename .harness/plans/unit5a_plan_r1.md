# Unit 5a Plan — 课程删除 + 任务删除（含拒删条件 + audit）

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 5
> Bugs: B-COURSE-01 (P0) + B-DELETE-01 (P0) + B-COURSE-04/05 (P1 协作权限) + B-TASK-06 (P1 复制 — 已 Unit 4 处理)

## 重要发现（schema + 既有代码）

### Course 模型无软删字段
`prisma/schema.prisma` L241-268 `Course` 模型无 `archivedAt` 或 `status` 字段，也无任何 enum 状态字段。**Phase 1 硬约束不动 schema**。

**决策**（coordinator 已批）：本 unit 改为**硬删 + 拒删条件**，不引入软归档。spec 文字写"归档（软删）"——我会按 coordinator 指令的最小可行方案做"硬删 + 拒删 + 二级 confirm"，按钮文案用「删除课程」而非「归档」（不误导用户）。归档作为 Phase 4 单独 unit 时再加 schema。

### Task 模板删除 — 半成品
- ✅ `lib/services/task.service.ts:351` `deleteTask` 已存在（无 instance/sub 检查）
- ✅ `app/api/tasks/[id]/route.ts` 已有 DELETE route
- ✅ `app/teacher/tasks/page.tsx` 列表页已有 Trash 按钮 + AlertDialog 确认
- ❌ 没有 0-instance 检查（直接 cascade）
- ❌ 没写 audit log
- ❌ `/teacher/tasks/[id]` 详情页**无删除按钮**

### 课程删除 — 全新建
- ❌ `course.service.ts` 无 `deleteCourse`
- ❌ `app/api/lms/courses/[id]/route.ts` 无 DELETE handler
- ❌ `app/teacher/courses/page.tsx` + `[id]/page.tsx` 无删除按钮

### 协作教师权限上扬 — 拒做（Unit 5c）
spec 写"协作教师权限上扬"是 Unit 5c。本 unit 仅做 owner 删除，**仅 createdBy === user.id 才允许删除**。owner 权限模型与现状一致（用 `assertCourseAccess` 不变）。

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `lib/services/course.service.ts` | 改 | 新加 `deleteCourse(courseId, userId)` — owner-only + 0 instance/0 chapter 拒删（保守）+ audit log |
| `lib/services/task.service.ts` | 改 | `deleteTask` 加 0-instance 检查 + audit log + 错误码 `TASK_HAS_INSTANCES` |
| `app/api/lms/courses/[id]/route.ts` | 改 | 加 DELETE handler |
| `app/api/tasks/[id]/route.ts` | 改 | 无功能改动（service 内变；route 透传错误码） |
| `lib/api-utils.ts` | 改 | 加 `TASK_HAS_INSTANCES` + `COURSE_HAS_INSTANCES` + `COURSE_HAS_CHAPTERS` 错误码（中文）|
| `app/teacher/courses/page.tsx` | 改 | 列表卡片 hover 加「删除」按钮 + AlertDialog 二级确认 |
| `app/teacher/courses/[id]/page.tsx` | 改 | 详情页头部加「删除课程」按钮（owner-only 显示）+ AlertDialog 二级确认 |
| `app/teacher/tasks/[id]/page.tsx` | 改 | 详情页头部加「删除任务」按钮 + AlertDialog 二级确认（与 Unit 4 复制 dialog 区分；按 owner-only 显示）|
| `app/teacher/tasks/page.tsx` | 改 | 删除失败显示 `TASK_HAS_INSTANCES` 中文消息 → "该任务已发布过实例，请先删除实例再删任务" |
| `tests/e2e/unit5a-verify.spec.ts` (新) | 新 | 6-8 case |

## 关键改动思路

### 1. `deleteCourse` service

```typescript
export async function deleteCourse(courseId: string, userId: string) {
  const existing = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, courseTitle: true, createdBy: true },
  });
  if (!existing) throw new Error("COURSE_NOT_FOUND");
  // owner-only — spec Unit 5c 才上扬协作；本 unit 严格 owner
  if (existing.createdBy !== userId) throw new Error("FORBIDDEN");

  const instanceCount = await prisma.taskInstance.count({ where: { courseId } });
  if (instanceCount > 0) throw new Error("COURSE_HAS_INSTANCES");

  const chapterCount = await prisma.chapter.count({ where: { courseId } });
  if (chapterCount > 0) throw new Error("COURSE_HAS_CHAPTERS");

  await prisma.course.delete({ where: { id: courseId } });
  await logAuditForced({
    action: "course.delete",
    actorId: userId,
    targetId: courseId,
    targetType: "Course",
    metadata: { title: existing.courseTitle, instanceCount: 0, chapterCount: 0 },
  });
}
```

**为何严格 owner 而非协作**：演示场景"删课程"是高风险动作；协作老师能改内容但不应删整门课。Unit 5c "权限上扬"原文限定**结构/班级编辑**，不含删除。

**为何拒 chapter > 0**：课程有章节意味着内容投入；拒删避免误操作。用户可先逐章节删（已有 deleteChapter），再删课程。这条规则可在 r2 软化（如果用户反馈太严，改为级联）。

### 2. `deleteTask` 改造

```typescript
export async function deleteTask(taskId: string, creatorId: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, creatorId: true, taskName: true },
  });
  if (!existing) throw new Error("TASK_NOT_FOUND");
  if (existing.creatorId !== creatorId) throw new Error("FORBIDDEN");

  const instanceCount = await prisma.taskInstance.count({ where: { taskId } });
  if (instanceCount > 0) throw new Error("TASK_HAS_INSTANCES");

  await prisma.task.delete({ where: { id: taskId } });
  await logAuditForced({
    action: "task.delete",
    actorId: creatorId,
    targetId: taskId,
    targetType: "Task",
    metadata: { taskName: existing.taskName },
  });
}
```

### 3. UI patterns

- 列表卡片：右上角 menu / hover trash icon → AlertDialog
- 详情页 header 右侧：与「编辑」按钮组放在一起 → 「删除课程」/「删除任务」outline + text-destructive
- AlertDialog 文案：
  - **课程**：title「删除课程」+ body「删除后无法恢复，且课程下的所有数据都会被清除。**该课程还有 N 个章节 / M 个任务实例，无法删除。** 请先清空后再试。」
  - **任务**：title「删除任务模板」+ body「删除后无法恢复。**该任务已发布过 N 个实例，无法删除。** 请先删除所有实例。」
- 实际拒删的错误从服务端返回，前端 toast 显示中文消息

### 4. audit log

3 个 actions：`course.delete` / `task.delete` / `task_instance.delete` (Unit 2 已建)。复用 `logAuditForced`。

## 风险点

1. **🟡 课程硬删 + 拒章节**：用户反馈"我已有章节但要重建课程"→ 需先逐章节删（不方便）。Mitigation：错误消息明确告知"请先清空章节"。如 r2 用户反馈需级联，service 改 1 行即可。
2. **🟢 task 删除已有列表 UI**：列表页 trash 按钮已存在，无需新建；只需让 service 加 instance 检查 + UI 显示新错误码。
3. **🟢 协作教师权限**：本 unit owner-only；spec 协作权限上扬 Unit 5c 单独处理。UI 上协作课程不显示删除按钮（用 `task.creatorId === user.id` / `course.createdBy === user.id` 判断）。
4. **🟡 删除按钮位置统一**：列表页用 hover-trash + AlertDialog（与 Unit 2 实例列表/Unit 4 任务列表一致），详情页 header 右上角（与 Unit 2/4 详情页一致）。一致性高。
5. **🟢 Cascade 删除**：当前 schema 上 `TaskInstance.taskId` → `Task` 关系是非 cascade（关系定义未 onDelete: Cascade），所以原 prisma 删 task 也会因 FK 失败。Service 加 instance 检查正好兜住。

## 自测计划

### 自动化
1. tsc + vitest + eslint
2. e2e 6-8 case

### e2e 计划
- **A**: molly 列表卡片 hover 显示「删除」 + 点击弹 AlertDialog
- **B**: API DELETE 一个无 instance/无章节的 dummy 课程（需测试中先创建）→ 200 + audit
- **C**: API DELETE 一个有 instance 的课程 → 400 + `COURSE_HAS_INSTANCES`
- **D**: API DELETE 一个有 chapter 但无 instance 的课程 → 400 + `COURSE_HAS_CHAPTERS`
- **E**: 任务列表 trash 点击 → 弹 dialog → 确认删除（用没 instance 的 task）→ 200 + audit
- **F**: API DELETE 一个有 instance 的 task → 400 + `TASK_HAS_INSTANCES`
- **G**: 详情页 `/teacher/tasks/[id]` 删除按钮显示 + 点击弹 dialog

### 手动验证
- 浏览器流程：molly 列表点删（应被拒 — 课程有章节）
- 详情页删（应弹 dialog）

## diff 预算

预计 350-450 行：
- service ~80（2 个方法 + audit）
- routes ~30
- api-utils ~10
- UI 改 4 个 page ~150
- e2e ~120

## 不做的范围（防 scope creep）

- ❌ 软删 / archived 字段（schema 改动 → Phase 4）
- ❌ 协作教师权限上扬（Unit 5c）
- ❌ Study Buddy / Submission 删除（Unit 5b）
- ❌ chapter/section/contentBlock 删除（已有 service 但 UI 改是 polish，不在本 unit）

## 待 coordinator 确认的设计决策

1. **课程删除策略**：硬删 + 拒章节/实例 → 同意？或宽松到"有章节也允许（级联）"？
2. **删除按钮位置**：列表页右上 hover-trash + 详情页 header → 同意？或仅放详情页（避免列表上误点）？
3. **owner-only 限制**：本 unit 严格 owner；协作者看不见删除按钮 → 同意？
