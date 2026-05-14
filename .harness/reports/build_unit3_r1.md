# Build Report — Unit 3 Round 1

> Builder: builder · 2026-05-14 · Commit `046b711` on `claude-demo-fixes`
> Plan: `.harness/plans/unit3_plan_r1.md`
> Bugs: B-STU-TASKS-1 (P0) + B-STU-AUTH-2 (P0) + 意外 #3 (dashboard 跳转)

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/auth/resource-access.ts` | +21 / -3 | `assertTaskInstanceReadable` 加 opts + 学生路径错误码细分 |
| `lib/api-utils.ts` | +4 | 2 个新中文错误映射 |
| `app/api/lms/task-instances/[id]/route.ts` | +9 / -4 | GET 传 `allowClosedWithOwnSubmission: true`（仅学生角色）|
| `lib/services/dashboard.service.ts` | +14 / -3 | `status: in [published, closed]` + closed 仅保留 has-own-sub + latestSubmissionId |
| `components/dashboard/priority-tasks.tsx` | +12 | interface +2 字段 + taskHref 分支 |
| `app/(student)/dashboard/page.tsx` | +8 | 透传 instanceStatus + latestSubmissionId |
| `components/sidebar.tsx` | +2 | 加「任务中心」nav 项 |
| `app/(student)/tasks/[id]/page.tsx` | +43 / -2 | 3 个 Forbidden case 文案 + closed 只读 banner |
| `app/(student)/grades/page.tsx` | +30 / -15 | `useSearchParams("focus")` + 纯派生 effectiveSelectedId + scrollIntoView |
| `app/(student)/tasks/page.tsx` (新) | +332 | 4 tab + 课程/类型筛选页 |
| `tests/resource-access.test.ts` | +63 / -1 | 4 个新 case + 1 个旧 case 改为新错误码 |
| `tests/dashboard.service.test.ts` | +25 / -1 | 1 旧改 + 1 新 case |
| `tests/e2e/unit3-verify.spec.ts` (新) | +250 | 8 case 端到端 |

总 diff +813 / -29。

## 关键决策

### 1. opts 默认 false + 仅 1 处 opt-in（按 coordinator 提醒重点）

`assertTaskInstanceReadable` 7 处调用方：
| 调用方 | 路径 | opt-in 否？ |
|---|---|---|
| `GET /api/lms/task-instances/[id]` | route.ts:18-26 | ✅ opt-in（仅学生角色）|
| `POST /api/ai/chat` | ai/chat/route.ts:275 | ❌ strict（不让 closed 学生聊天）|
| `POST /api/ai/evaluate` | ai/evaluate/route.ts:69 | ❌ strict（不让 closed 学生重交评分）|
| `POST /api/submissions` (line 38) | submissions/route.ts:38 | ❌ strict（不让 closed 学生提交）|
| `GET /api/submissions` (line 95) | submissions/route.ts:95 | ❌ strict（仅老师走该分支；学生通过 effectiveStudentId 过滤）|
| `study-buddy.service.ts:37,212` | createPost / list by taskInstance | ❌ strict |
| `task-post.service.ts:14,50` | create / list 讨论帖 | ❌ strict |

仅 1 处显式 opt-in，6 处保持 strict → strict 路径完整保留。

### 2. dashboard stats grep 结果（按 coordinator 提醒 #1）

`app/(student)/dashboard/page.tsx` 中 task 相关 transforms：
- L366 `kpi.pending = data.tasks.filter(isTaskPending).length`：`isTaskPending` 检查 `studentStatus === "todo" | "overdue"`。closed-with-sub 实例必有 latestSub → studentStatus 必为 graded/submitted/grading/failed，不会被算成 pending。✅ 无影响
- L389-394 `avgScore`：基于 `recentSubmissions`，不看 tasks。✅ 无影响
- L384-387 `completedThisWeek`：基于 `recentSubmissions`。✅ 无影响
- L457-465 `suffix` "今晚截止"：`t.studentStatus !== "todo"` 过滤，closed-with-sub 不命中。✅ 无影响

结论：dashboard stats 完全不需改 transformer 逻辑。

### 3. /grades?focus=<id> 纯派生（按 coordinator 提醒 #2）

避免 `setSelectedId(focusId)` 在 useEffect 中（lint 报错 `react-hooks/set-state-in-effect`），改纯派生：
```typescript
const effectiveSelectedId =
  selectedId ?? (focusId && rows.some(r => r.id === focusId) ? focusId : null);
```
- 初始：selectedId null → effective = focusId
- 用户点其他行：selectedId 设值 → effective = selectedId（focus 自然被覆盖）
- 满足 coordinator "focus 后不要 selected 状态被 client-side mutate"

scrollIntoView 用 useEffect 监听 (focusId, selectedId, rows)，仅当用户未点击时（selectedId === null）滚动到 focus 行，避免反复 scroll。

### 4. 错误码细分 vs 复用 FORBIDDEN

新加 2 个错误码：
- `TASK_INSTANCE_DRAFT_NOT_VISIBLE` 403 "任务尚未开放"
- `TASK_INSTANCE_CLOSED_NO_SUBMISSION` 403 "任务已结束，且未提交过作答"

前端 (student)/tasks/[id]/page.tsx 按 error.code 分支选 ForbiddenState 文案：
- DRAFT_NOT_VISIBLE → "任务尚未开放"
- CLOSED_NO_SUBMISSION → "任务已结束"
- FORBIDDEN → "你不在该任务班级"（跨班默认）

### 5. closed 实例只读 banner

(student)/tasks/[id]/page.tsx 接收 status='closed' 实例后，breadcrumb 下方插入 amber-50 banner："任务已结束 · 只读模式 · 这个任务已关闭，不能再提交新的作答。... 「我的成绩」查看你之前的提交"。学生进 closed 任务有清晰的"为什么进得来 + 该去哪"指引。

### 6. 跨班泄漏防护

`assertTaskInstanceReadable` 中跨班检查（`inst.classId !== user.classId`）在 status 判断之前，跨班学生无论 closed 还是 published 都拿到 generic FORBIDDEN，不暴露任务状态。e2e Test G + vitest 测试都覆盖了这一序。

## 自测结果

### TypeScript
```
npx tsc --noEmit  # clean
```

### Vitest
```
Test Files  83 passed (83)
Tests       986 passed (986)   # 原 981 + 4 resource-access + 1 dashboard
```

### ESLint
```
npx eslint <13 touched files>  # 0 problems
```

### Playwright E2E（`tests/e2e/unit3-verify.spec.ts` × 8 case，serial）
```
✓ A: alex sidebar 「任务中心」可见 + /tasks 列表加载（非 404） (6.4s)
✓ B: /tasks 4 tab 切换 + 课程/类型筛选 不崩 (5.7s)
✓ C: alex 访问 closed-with-own-sub 任务 → 200 + 只读 banner (4.8s)
✓ D: alex 跨班 published instance → 仍 403（回归测） (4.4s) ⭐ 关键回归
✓ E: alex 访问不存在的 instance → 404，不是 403 (4.4s)
✓ F: dashboard graded closed [结果] href = /grades?focus=<sid> (7.2s) ⭐ 关键
✓ G: belle 对 closed-no-sub → TASK_INSTANCE_CLOSED_NO_SUBMISSION (2.0s) ⭐ 关键错误码
✓ H: alex closed-with-sub GET → 200（API opt-in 验证） (1.9s)

8 passed (38.0s)
```

实测样例（Test G 输出）：
```
belle on closed (no own sub):
{"success":false,"error":{"code":"TASK_INSTANCE_CLOSED_NO_SUBMISSION","message":"任务已结束，且未提交过作答"}}
```

## 是否需要重启 dev server

不需要。无 schema 改动。

## 风险 / 不确定项

1. **scrollIntoView 在 SSR 时机**：`useEffect` 监听 focusId + selectedId + rows，rows 异步加载完才触发 effect → useEffect 执行后 row ref 已挂载 → safe。
2. **学生 sidebar 顺序**：按 plan 接受了「仪表盘 / 任务中心 / 我的课程 / 我的成绩 / 课表」。QA 反馈如不喜欢再调。
3. **类型筛选 select 简化用原生 `<select>`**：与 page 设计语言一致（其他 select 用 shadcn 但本场景纯文本筛选无需复杂控件）。

## Acceptance 对照

| spec acceptance | 状态 |
|---|---|
| 新建 `app/(student)/tasks/page.tsx` 4 tab + 课程/类型筛选 | ✅ Test A/B |
| 学生 sidebar 加「任务中心」 | ✅ Test A |
| closed 状态对有自己 submission 的学生放行只读 | ✅ Test C/H |
| ForbiddenState 文案区分三种 case | ✅ Test G + 代码 L273-303 |
| dashboard closed 任务 [结果] 跳 `/grades?focus=<submissionId>` | ✅ Test F |
| 跨班 / 未发布的 403 不被破坏 | ✅ Test D + vitest 4 个新 case |

## grep 汇报（按 coordinator 提醒 #2）

`updateTaskInstance` callers（信息汇报）：
- `app/api/lms/task-instances/[id]/route.ts:41` PATCH 通用入口
- 前端：`app/teacher/instances/[id]/page.tsx` + `components/course/course-instances-tab.tsx` 两处 `handleStatusChange`

Unit 3 不动这条路径，与 Unit 2 状态一致（publish→draft 仍走 PATCH，暂无 audit）。
