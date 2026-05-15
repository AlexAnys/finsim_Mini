# QA Report — Unit 5a r1

> QA: qa · 2026-05-14 · 验 commit `e217835` on `claude-demo-fixes`
> Bugs: B-COURSE-01 (P0) + B-DELETE-01 (P0) + B-TASK-06 (P1) · spec.md L101-104
> Test spec: `tests/e2e/qa-unit5a-delete.spec.ts` (11 case，独立于 builder unit5a-verify.spec.ts)
> 截图: `.harness/screenshots/qa-unit5a/`

## 路径决策（builder 选 hard-delete + 拒删条件）

spec L101 提到「归档」按钮 + archivedAt 字段，但 Prisma schema 中 **Course 和 Task 都没有 archivedAt 字段**（Phase 1 不动 schema 硬约束）。builder 选 **hard-delete + 拒删条件** 路径：
- 课程：有 chapter 或 task instance 时拒删
- 任务：有 task instance 时拒删
- 全部走 audit log

这与 spec L101 字面"归档"不符，但符合 Phase 1 硬约束 + 用户决策。

## 测试数据
- **MOLLY_COURSE_HAS_CHAPTERS** `8f7f653c` (个人规划) — 1 chap / 0 inst → COURSE_HAS_CHAPTERS 拒
- **TEACHER1_COURSE** `e6fc049c` (个人理财规划) — molly 非 owner → FORBIDDEN
- **MOLLY_TASK_HAS_INSTANCE** `3e26c6d2` (个人理财基础概念测验) — 1 instance → TASK_HAS_INSTANCES 拒

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| 课程：列表 + 详情加「归档」按钮（建议改"删除"，与 builder 决策一致）| 1) `/teacher/courses` 列表卡片 检查 owner 的删除 icon button + tooltip<br/>2) `/teacher/courses/[id]` 详情页 EditorHero 检查删除按钮 | 1) molly owner card 有 disabled icon button + tooltip "课程有 1 个章节，无法删除" ✓<br/>2) 详情页有 2 处删除按钮（hero + 编辑流），click 弹 AlertDialog "删除课程·确认删除「个人规划」？此操作不可恢复。如果课程下有章节或任务实例，将被服务端拒绝并提示原因。"<br/>+ 取消/确认删除 按钮 | PASS |
| 有 instance 的拒删并提示「先关闭所有任务实例」 | DELETE molly 自己 1-chap/0-inst 课程 + DELETE 有 instance 任务 | course: 400 + `COURSE_HAS_CHAPTERS` / "该课程下仍有章节内容，无法删除。请先清空所有章节后再试。"<br/>task: 400 + `TASK_HAS_INSTANCES` / "该任务已发布过实例，无法删除。请先到「任务实例」中删除所有实例后再试。" | PASS |
| 任务模板：`/teacher/tasks/[id]` 加「删除」按钮（前提：0 instance；有 instance 拒删）| 1) molly task `3e26c6d2` (有 inst) 进 page 抓删除按钮<br/>2) 创建 dummy 0-inst task 进 page 抓删除按钮 | **case 1: 0 个删除按钮**（与 Unit 2 disabled+tooltip 模式**不一致**，**finding A**）<br/>case 2: 1 个「删除任务」按钮可见 | **PASS with caveat** |
| 全部走 audit log | DB SELECT WHERE action IN ('course.delete', 'task.delete') | 9 fresh audit entries (course.delete × 4 含 metadata.title / task.delete × 5 含 metadata.taskName)，timestamps 匹配 QA 测试时间 | PASS |
| 协作教师权限（spec L99 +「协作教师可改课程结构」）| spec 写"Unit 5c"——本 unit 不在范围 | N/A | N/A → Unit 5c |
| 协作者删 owner 素材必弹二级 confirm + audit | spec 写 CourseKnowledgeSource — 本 unit 不在范围 | N/A | N/A → Unit 5b/5c |

## 额外 acceptance（spec 隐含 + 用户决策）

| 额外项 | 验法 | 实测 | Verdict |
|---|---|---|---|
| non-owner DELETE → 403 FORBIDDEN | molly DELETE teacher1 课程 / 任务 | course: 403 / `FORBIDDEN` / "权限不足"; task: 403 / `FORBIDDEN` / "权限不足" — 不暴露 owner 信息 | PASS |
| 不存在的 resource → 404 NOT_FOUND | DELETE `00000000-...` | 404 + `NOT_FOUND` + "课程不存在" 中文 | PASS |
| 完整 create + delete round-trip 200 → GET 404 | POST dummy course → DELETE → GET | course: 201 → 200 → 404 ✓; task: 201 → 200 → 404 ✓ | PASS |
| AlertDialog 中文 + 二级确认 | 详情页点删除 → 抓 dialog 文案 + 按钮 | "删除课程·确认删除「个人规划」？此操作不可恢复。如果课程下有章节或任务实例，将被服务端拒绝并提示原因。·取消·确认删除" 三按钮各 1 个 | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 83 files / 986 tests pass (与 baseline 一致，无新 vitest) |
| `npx eslint <10 builder files + QA spec>` | 0 problem |
| `git show --stat e217835` | 10 files +604/-15，与 build 报告一致 |
| cross-module grep `deleteCourse / deleteTask` | 唯一 caller 各 1 个；prisma.task.delete 唯一调用在 service line 367; prisma.course.delete 唯一调用在 service line 452 |
| DB 状态测前测后 | 测后所有 QA dummies 已 DELETE，molly's 3 tasks 维持 1 instance / 1 course 维持 1 chap，与 baseline 完全一致 |

## ⚠️ Finding A: UI 模式不一致（中等优先级，需 coordinator 决断）

**事实**：`/teacher/tasks/[id]` 任务详情页对**有 instance 的 task**——`task.taskInstances.length > 0`——**直接隐藏「删除任务」按钮**（page.tsx L696 条件渲染）。

**与既有模式不一致**：
- **Unit 2 (任务实例)**: 关闭/重开按钮一直可见；有 submission 时删除按钮 **disabled + Tooltip "已有学生提交，无法删除"**
- **Unit 5a (课程)**: course list card 有 disabled + Tooltip "课程有 1 个章节，无法删除" ✓
- **Unit 5a (任务)**: **直接 hidden（用户看不到"原来有删除选项"，可能在演示时认为缺功能）**

**用户感知差异**：
- 有 instance 时进 task page，**完全看不到"这个任务能删除"的提示** → 用户会困惑"任务模板能不能删除？"
- 与 spec L104 字面 "有 instance 拒删" 兼容（删除被拒只是隐藏 vs disabled+tooltip 差异），但与全产品一致性差

**严重度**: 中。**不阻塞 acceptance（spec L104 字面 "拒删" 满足）**，但建议 r2 改为 disabled + Tooltip "该任务已发布 N 个实例，无法删除"。

**修复建议**（1 行改动）：
```tsx
// Before (page.tsx L696):
{task.taskInstances.length === 0 && (<Button ...>删除任务</Button>)}

// After (与 Unit 2 一致):
{task.taskInstances.length === 0 ? (
  <Button onClick={...}>删除任务</Button>
) : (
  <Tooltip>
    <TooltipTrigger asChild>
      <span><Button disabled>删除任务</Button></span>
    </TooltipTrigger>
    <TooltipContent>该任务已发布 {task.taskInstances.length} 个实例，无法删除</TooltipContent>
  </Tooltip>
)}
```

## Audit log 实测样本

```
2026-05-14 10:01:44 | task.delete   | 3e408a29-... | taskName: QA-r5a-J2-1778752901814
2026-05-14 10:01:19 | task.delete   | 532fc967-... | taskName: QA-r5a-task-1778752879090
2026-05-14 10:01:14 | course.delete | cd8700f0-... | title: QA-r5a-dummy-1778752874081
2026-05-14 09:59:47 | task.delete   | 05ad025a-... | taskName: QA-r5a-task-1778752787520
2026-05-14 09:59:42 | course.delete | f18174ca-... | title: QA-r5a-dummy-1778752782332
```
✅ metadata 含 title (course) / taskName (task) — 与 build 报告声明一致

## Cross-module regression

- `deleteCourse` / `deleteTask` service interface 是新增方法，无既有 caller 改动
- `getCoursesByTeacher` 加 `_count: { chapters, taskInstances }` — 用作 UI 判断 hasContent，不影响 GET 返回结构（被 `app/teacher/courses/page.tsx` 消费）
- prisma 级联：`prisma.task.delete` / `prisma.course.delete` 走 schema 已配的 ON DELETE CASCADE（builder 不在本 unit 改动 schema）
- 既有 vitest 986 全过 = 无回归

## Finsim-specific 检查

- ✅ UI 文案全中文（按钮 + dialog + tooltip + error message）
- ✅ Service throw "ERROR_CODE" + handleServiceError 中文映射 (3 新错误码)
- ✅ Route Handler 仅 auth + 调 service
- ✅ API response 格式 `{ success, data }` / `{ success: false, error: { code, message } }`
- ✅ Prisma schema 0 改动（Phase 1 硬约束）

## 风险 / 不确定项

1. **🟡 Finding A**: UI 模式不一致（hide vs disabled+tooltip），建议 r2 修
2. **🟢 spec L101 "归档"vs builder "删除"路径分歧**：builder 选 hard-delete 符合 Phase 1，dialog 措辞已说明"此操作不可恢复"——可接受
3. **🟢 协作教师当前完全不能删除**：spec L99 字面"协作可改课程结构"但本 unit owner-only 严控——按 spec L113 Unit 5c 范围

## 是否引入新 bug

无代码 bug。Finding A 是 UX 一致性问题，不阻塞 spec 字面 acceptance。

## Issues found

- **Finding A** (UX 不一致): /teacher/tasks/[id] 对有 instance 的 task 隐藏删除按钮 — 与 Unit 2 disabled+tooltip 模式不一致。建议 r2 修。

## Overall: **PASS** (with Finding A flagged for coordinator decision)

**判断标准对照** (r1 即收三条件)：
1. ✅ QA 11 case (含 dummy create+delete round-trip + UI tooltip + API 错误码 + non-owner FORBIDDEN + 404 + audit log) vs builder 8 case — 独立证据链
2. ✅ HTTP / error code / dialog text / tooltip / audit metadata / DB state 全 deterministic
3. ✅ DB cleanup 干净: 4 dummy courses + 5 dummy tasks 全 DELETE + 3 molly tasks / 1 course 维持 baseline

**建议**：
- (a) **r1 PASS 收工** + Finding A 加 Phase 4 polish backlog（不阻塞演示，UX 一致性问题）
- (b) **r2 兜底**让 builder 用 1 行改动统一 UI 模式

我倾向 **(a)**：spec L104 字面 acceptance 满足；Finding A 是模式一致性问题，单独修 5 min 的改动，但不阻塞演示。等 coordinator 拍板。
