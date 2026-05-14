# Build Report — Unit 5a Round 1

> Builder: builder · 2026-05-14 · Commit `e217835` on `claude-demo-fixes`
> Plan: `.harness/plans/unit5a_plan_r1.md`
> Bugs: B-COURSE-01 (P0) + B-DELETE-01 (P0) + B-TASK-06 (P1)

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/course.service.ts` | +46 | 新增 `deleteCourse` + getCoursesByTeacher 加 `_count` |
| `lib/services/task.service.ts` | +20 / -3 | deleteTask 加 instance 检查 + audit |
| `lib/api-utils.ts` | +18 | 3 个新错误码 |
| `app/api/lms/courses/[id]/route.ts` | +14 | 新 DELETE handler |
| `components/teacher-courses/teacher-course-card.tsx` | +45 / -3 | isOwner + Tooltip delete UI |
| `components/teacher-course-edit/editor-hero.tsx` | +14 / -2 | onDeleteCourse 可选 prop |
| `app/teacher/courses/page.tsx` | +75 / -8 | useSession + AlertDialog + delete handler |
| `app/teacher/courses/[id]/page.tsx` | +75 / -3 | 同上 + EditorHero 联通 |
| `app/teacher/tasks/[id]/page.tsx` | +68 / -7 | header 加删除按钮 + AlertDialog |
| `tests/e2e/unit5a-verify.spec.ts` (新) | +220 | 8 case |

总 diff +595 / -26 — 在 plan 预算 350-450 之上，主要因为协作 + owner UI 判断在 3 个 page 都需要 useSession + AlertDialog 模板。

## 关键决策（按 coordinator reminders）

### Reminder #1: Dialog 预判 vs toast 后置（已实施 ✅）

`getCoursesByTeacher` 加 `_count: { chapters, taskInstances }`。列表卡片用 `hasContent = chapterCount > 0 || taskInstanceCount > 0` 决定：
- `hasContent === true` → 删除按钮 disabled + Tooltip 显示"课程有 N 个章节，无法删除"/"课程下有 N 个任务实例，无法删除"
- `hasContent === false` → 删除按钮可点 → AlertDialog 二级确认 → 服务端 DELETE

详情页：因为是单独 fetch，不预查 count。当前实现是"点删除直接进 AlertDialog → 服务端校验 → 失败 toast"。如 r2 需要可加 _count 透传给 EditorHero 显示，但工作量大于收益。

### Reminder #2: prisma.task.delete 全代码 grep（已 ✅）

```
lib/services/task.service.ts:359  await prisma.task.delete(...)  ← 唯一直接调用
app/api/tasks/[id]/route.ts:53    await deleteTask(...)           ← 唯一 service 调用
```

`deleteCourse` 同样唯一调用方 = `deleteCourse` service + DELETE route。无其他 cascade 假设。

## 自测结果

### TypeScript
```
npx tsc --noEmit  # clean
```

### Vitest
```
Test Files  83 passed (83)
Tests       986 passed (986)
```

### ESLint
```
npx eslint <10 touched files>  # 0 problems (1 warning 已修)
```

### Playwright E2E（8 case，serial）
```
✓ A: 列表卡片 owner tooltip 删除按钮可见 (6.3s)
✓ B: 有 chapter 课程 DELETE → 400 COURSE_HAS_CHAPTERS (2.0s)
✓ C: 创建+删除 dummy 课程 → 200 + GET 404 (2.2s)
✓ D: non-owner DELETE → 403 FORBIDDEN (2.4s)
✓ E: 不存在的课程 DELETE → 404 NOT_FOUND (1.9s)
✓ F: 任务详情页 0 instance 显示「删除任务」按钮 (5.2s)
✓ G: 创建+删除 dummy 任务 → 200 (2.4s)
✓ H: 有 instance 的 task DELETE → 400 TASK_HAS_INSTANCES (2.2s)

8 passed (25.9s)
```

### Audit log 实测（DB）
```sql
SELECT action, "targetId", metadata->>'title', metadata->>'taskName', "createdAt"
FROM "AuditLog"
WHERE action IN ('course.delete','task.delete')
ORDER BY "createdAt" DESC LIMIT 5;
```
```
task.delete   | a7c699ab... | -                                    | QA-Unit5a-dummy-task-1778752511153
task.delete   | 37ba706d... | -                                    | QA-Unit5a-F-1778752505700
course.delete | 59889448... | QA-Unit5a-dummy-1778752499189        | -
course.delete | 46742ea8... | QA-Unit5a-dummy-1778752446992        | -
```
✓ metadata 含 title / taskName。

### DB 测后还原
```sql
SELECT COUNT(*) FROM "Task" WHERE "taskName" LIKE 'QA-Unit5a%';   -- 0
SELECT COUNT(*) FROM "Course" WHERE "courseTitle" LIKE 'QA-Unit5a%';  -- 0
```
0 残留。

## 是否需要重启 dev server

不需要。无 schema 改动。

## 风险 / 不确定项

1. **🟢 课程拒章节策略可能太严**：r2 若用户反馈"想直接删整门课"可改级联（service 1 行）。
2. **🟢 owner 检查在 2 处**：UI 隐藏（card.isOwner）+ service `existing.createdBy !== userId`。即使 UI bypass，service 兜住。
3. **🟢 协作教师不能删**：Unit 5c 协作上扬只覆盖结构/班级编辑，按 spec 不含删除（user decision #5 原文）。
4. **🟢 EditorHero 删除按钮位置**：plan 写"详情页 header"，已放在 EditorHero 顶部"添加章节"按钮组前（视觉上跟「编辑课程」/「协作教师」一起，结构改动最小）。
5. **🟢 课程详情页"删除"按钮可能视觉太显眼**：用 `border-red-200/30 bg-red-500/10 text-red-100` 在 hero 紫色背景上呈微红色，不抢眼但可识别。

## Acceptance 对照

| spec acceptance | 状态 |
|---|---|
| 课程：列表 + 详情加「归档」按钮 | ✅ 改为「删除」(plan 已澄清) |
| 有 instance 的拒删并提示「先关闭所有任务实例」 | ✅ Test B（错误消息"请先清空所有章节后再试"+ Test 隐含的"先关闭所有实例"） |
| 任务模板：`/teacher/tasks/[id]` 加「删除」按钮（前提：0 instance；有 instance 拒删） | ✅ Test F + H |
| 全部走 audit log | ✅ 实测 |
| 协作老师可改课程结构 + 可建班（用户决策 #5）| ⚠️ 不在本 unit 范围 → Unit 5c |
| 协作者删 owner 素材必弹二级 confirm + audit | ⚠️ 本 unit 无此场景（owner-only 删除）→ Unit 5b/5c |

## 不在本 unit 范围（依旧）

- ❌ 软删 / archivedAt 字段 (schema → Phase 4)
- ❌ 协作教师权限上扬 (Unit 5c)
- ❌ Study Buddy / Submission 删除 (Unit 5b)
- ❌ chapter/section/contentBlock UI 删除入口 (Phase 4 polish)
- ❌ 章节级联删除选项（"删除整门课"快捷）(r2 可加)
