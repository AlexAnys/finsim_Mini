# Unit 3 Plan — 学生侧主路径阻塞（/tasks 404 + closed 403 + dashboard 跳转）

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 3
> Bugs: B-STU-TASKS-1 (P0) + B-STU-AUTH-2 (P0) + 意外 #3 (dashboard 跳转)

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `lib/auth/resource-access.ts` | 改 | `assertTaskInstanceReadable` 加可选第 3 参 `opts: { allowClosedWithOwnSubmission?: boolean }`。默认 false 保持现有所有调用方行为。学生路径新增：closed + 本人有 submission → 放行；同时改抛区分性错误码（TASK_INSTANCE_DRAFT_NOT_VISIBLE / TASK_INSTANCE_CLOSED_NO_SUBMISSION / FORBIDDEN 跨班）|
| `lib/api-utils.ts` | 改 | 加 2 个新错误码中文映射（FORBIDDEN 通用保留）|
| `app/api/lms/task-instances/[id]/route.ts` | 改 | GET 调用 assertTaskInstanceReadable 传 `{ allowClosedWithOwnSubmission: true }`（仅 GET 详情读，提交/聊天/eval 路径保持 strict）|
| `lib/services/dashboard.service.ts` | 改 | `getStudentDashboard` taskInstances where 改 `status: { in: ["published", "closed"] }`；only-include-closed-if-has-submission：在 taskWithStatus 步骤过滤；新加 `latestSubmissionId` 字段到任务 |
| `components/dashboard/priority-tasks.tsx` | 改 | `taskHref` 函数：graded + closed → `/grades?focus=<submissionId>`；其余路径不变 |
| `app/(student)/tasks/[id]/page.tsx` | 改 | error handling 区分 3 种 403 case：根据 `error.code` 选 ForbiddenState 文案；closed-with-own-submission 不走 forbidden 而是渲染只读详情 + 跳转按钮 |
| `app/(student)/tasks/page.tsx` | 新 | 4 tab（待办 / 进行中 / 已批改 / 已结束）+ 课程/类型筛选；复用 dashboard summary 数据；列表行复用 PriorityTasks 单行渲染或写简化版 |
| `components/sidebar.tsx` | 改 | studentNav 加 "任务中心" → `/tasks` |
| `tests/resource-access.test.ts` | 改 | 加 2 个新 case：closed + own submission 放行；closed + no submission 拒绝；保留所有现有 case |
| `tests/e2e/unit3-verify.spec.ts` | 新 | 7 case e2e |

## 关键改动思路

### B-STU-AUTH-2 — closed + 有 submission 放行

`assertTaskInstanceReadable` 加可选 opts：

```typescript
type Opts = { allowClosedWithOwnSubmission?: boolean };

if (user.role === "student") {
  if (!user.classId) throw new Error("FORBIDDEN");
  if (inst.classId !== user.classId) throw new Error("FORBIDDEN"); // 跨班
  if (inst.status === "published") return;
  if (inst.status === "closed" && opts?.allowClosedWithOwnSubmission) {
    const hasOwnSub = await prisma.submission.findFirst({
      where: { taskInstanceId: instanceId, studentId: user.id },
      select: { id: true },
    });
    if (hasOwnSub) return;
    throw new Error("TASK_INSTANCE_CLOSED_NO_SUBMISSION");
  }
  if (inst.status === "draft") throw new Error("TASK_INSTANCE_DRAFT_NOT_VISIBLE");
  throw new Error("FORBIDDEN"); // closed 但未提交 / archived / draft 未开 opts
}
```

**Anti-regression**：opts 默认 false，所有现有调用方（chat/evaluate/POST submissions/SB createPost/task-post create）行为不变 → closed 学生提交/聊天仍 403。

仅 `GET /api/lms/task-instances/[id]` route opt-in：学生回看任务详情（题目/对话/材料）只读。

### B-STU-TASKS-1 — /tasks 列表页 + sidebar

`app/(student)/tasks/page.tsx` 新建：fetch `/api/lms/dashboard/summary` 拿 tasks 数组，按 studentStatus 分到 4 个 tab：
- **待办**：studentStatus=todo
- **进行中**：submitted / grading
- **已批改**：graded
- **已结束**：closed + 有 own submission（前提：dashboard service 改造后会包含 closed-with-sub 实例）

筛选：课程 select + 类型 select（simulation/quiz/subjective）。

Sidebar 加 `{ label: "任务中心", href: "/tasks", icon: ListChecks }`（lucide 已有）。

### 意外 #3 — dashboard graded 跳转

`PriorityTasks.taskHref(task)`：当前对 simulation 跳 `/sim/<id>`，其他 `/tasks/<id>`。

需要新行为：graded + closed → `/grades?focus=<submissionId>`。因此：
- `PriorityTask` interface 加可选 `latestSubmissionId?: string | null`
- `dashboard.service.ts` 给每个 taskInstance 加 latestSubmissionId
- 学生 dashboard page mapping 透传该字段
- `taskHref` 优先 graded+closed 走 grades focus，否则原逻辑

`/grades?focus=<id>` 在 grades 页面需要 useSearchParams 读 focus → `setSelectedId(focus)` 默认选中。

### ForbiddenState 文案 3 case 区分（仅 (student)/tasks/[id]/page.tsx）

API 返回 error.code，前端基于 code 选文案：
- `TASK_INSTANCE_DRAFT_NOT_VISIBLE` → "任务尚未开放"
- `TASK_INSTANCE_CLOSED_NO_SUBMISSION` → "任务已结束 · 你未提交过作答"
- `FORBIDDEN` → "你不在该任务班级"（默认）

如果是 closed + own submission，根本不会到 forbidden 分支（API 200，渲染只读详情）。

### dashboard.service 改造 — 安全过滤

```typescript
const allInstances = await prisma.taskInstance.findMany({
  where: {
    classId,
    status: { in: ["published", "closed"] },
  },
  ...
});
// 已闭合的：仅当我有 submission 时保留
const myIds = new Set(mySubmissions.map(s => s.taskInstanceId).filter(Boolean));
const taskInstances = allInstances.filter(ti =>
  ti.status === "published" || (ti.status === "closed" && myIds.has(ti.id))
);
```

确保跨班 / 未发布 / 已结束未提交的 instance 不进 dashboard 列表（dashboard 是 listing 端点，自身就需做 visibility 过滤，因为 listing 不走 assertTaskInstanceReadable）。

### latestSubmissionId 字段

dashboard service taskWithStatus 块加：
```typescript
latestSubmissionId: latestSub?.id ?? null,
```

priority-tasks 取此字段，graded + closed 时走 `/grades?focus=<id>`。

## 风险点

1. **resource-access 改动是高敏感区**（spec 中 unit 3 风险中）。Mitigation：opts 默认 false 全保留旧行为；仅 1 个 route 显式 opt-in；vitest 加 2 个新 case，全套 981 测试不变。
2. **dashboard service 包含 closed 实例**：可能影响 stats 计算（completionRate 等）。需 grep 所有使用 dashboard tasks 的 transform。
3. **/grades?focus=<id> 不在 spec 强制写**：但 spec 写"dashboard 学习任务卡 closed 状态的 [结果] 按钮跳 /grades?focus=<submissionId>"。需要 grades 页支持 useSearchParams 读 focus。
4. **学生 sidebar 加 nav 项的视觉位置**：放在「我的成绩」之后还是之前？我倾向 "仪表盘 / 任务中心 / 我的课程 / 我的成绩 / 课表管理"（紧跟 dashboard，因为任务中心是日常入口）。如果用户偏好不同，QA 反馈时改。
5. **跨班 + 未发布 + closed 无 sub 的 403 不能被破坏**：用 vitest mock 校验三种路径 + e2e Test C/D。
6. **dashboard summary 字段类型变化**：tasks[].latestSubmissionId 新增字段。`(student)/dashboard/page.tsx` priorityTasks map 已经 spread `t.id`/`taskType` 等，加一行 `latestSubmissionId: t.latestSubmissionId ?? null` 透传即可，不需要改类型断言。

## 自测计划

### 自动化
1. `npx tsc --noEmit`
2. `npx vitest run` 全套（包括新加的 resource-access 两条 case）
3. `npx playwright test tests/e2e/unit3-verify.spec.ts --config playwright.review.config.ts`

### e2e 计划（7 case）
- **A**: alex 登录 → sidebar 「任务中心」可点 → /tasks 200（非 404）
- **B**: /tasks 4 tab 显示正确；切换 tab 行数变
- **C**: alex /tasks/449ae28c (closed + own sub) → 200，可看题目（不是 403）
- **D**: alex 跨班 task instance → 仍 403
- **E**: alex /tasks/<draft-instance> → "任务尚未开放" 文案
- **F**: alex /tasks/<closed-no-sub> → "任务已结束 · 你未提交过作答" 文案（如果造得出来 fixture，否则用 charlie/dexter 没提交的 closed）
- **G**: dashboard graded 任务卡 [结果] 按钮 href = `/grades?focus=<submissionId>`；点击后 grades 页面 selectedRow.id 等于该 submissionId

### 手动验证
- 浏览器 alex 登录看 sidebar：「任务中心」icon + 文案
- /tasks 列表交互：tab 切换 + 课程筛选 + 类型筛选

## 不做的范围（防 scope creep）

- 不改 SB 提问 dialog（B-STU-SB-3）→ Unit 6
- 不改 dashboard "学习任务" 卡折叠（B-STU-DASH-1）→ Phase 4 Unit 14
- 不改 grades 页的视觉布局（仅加 focus 参数支持）
- 不改 simulation runner 的预览路径（preview=true）
- 不为 closed-with-own-submission 学生提供 "重做" 能力（spec 写"只读"）

## diff 预算

预计 ≈ 350 行（新 /tasks/page.tsx ~180 + 测试 ~120 + 其他 ~50）。
单 commit。
