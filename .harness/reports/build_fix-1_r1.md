# Build report — Fix 1 (学生数 sum) · r1

- **Worktree**：`finsim-wt-dashboard`
- **分支**：`claude-fix-batch1-dashboard`
- **基线 commit**：`da9a505`（claude-fix-mimo-reasoning-param HEAD）
- **本次 commit**：`c91e46b` — `fix(dashboard): teacher student count sum across classes`
- **改动文件**：
  - `lib/utils/teacher-dashboard-transforms.ts`（+12/-2）
  - `tests/teacher-dashboard-transforms.test.ts`（+22/-5）
- **总 diff**：31 insertions / 6 deletions — 远低于 150 行上限

## 根因

`buildKpiSummary` 把 `studentCount` 写成 `Math.max(ti.class._count.students)`：

```ts
for (const ti of args.taskInstances) {
  const n = Number(ti.class?._count?.students);
  if (Number.isFinite(n) && n > studentCount) studentCount = n;
}
```

老师 teacher1 名下 A班(10 学生) + B班(2 学生)，取 max=10，少 2 人。`User.classId` 在 schema 里是 `String?` 单值字段（`prisma/schema.prisma:182`），每位学生只能属于一个班，所以**对班级去重后求和是正确口径**（不会重复计学生）。

## 修复

把 max 换成"每 class.id 出现的最大 size 各取一次再求和"：

```ts
const classSizeById = new Map<string, number>();
for (const ti of args.taskInstances) {
  const cid = ti.class?.id ? String(ti.class.id) : null;
  if (!cid) continue;
  const n = Number(ti.class?._count?.students);
  if (!Number.isFinite(n)) continue;
  const prev = classSizeById.get(cid);
  if (prev == null || n > prev) classSizeById.set(cid, n);
}
let studentCount = 0;
for (const n of classSizeById.values()) studentCount += n;
```

- **去重**：同一班级被多个 taskInstance 引用只算一次（用 Map by class.id）。
- **空 class.id 跳过**：避免没有 id 的 ghost class size 被错算。
- **同班多个 size 取最大**：理论上不会出现冲突（同 class.id 来自相同 join），但为了 robustness 保留 max-within-class。

## DB 真值对账

```sql
SELECT cl.name,
       (SELECT COUNT(*) FROM "User" WHERE "classId"=cl.id AND role='student') AS students
FROM "Class" cl
WHERE cl.id IN (
  SELECT DISTINCT c."classId" FROM "Course" c
    WHERE c."createdBy" = (SELECT id FROM "User" WHERE email='teacher1@finsim.edu.cn')
  UNION
  SELECT DISTINCT cc."classId" FROM "CourseClass" cc
    JOIN "Course" co ON co.id=cc."courseId"
    WHERE co."createdBy" = (SELECT id FROM "User" WHERE email='teacher1@finsim.edu.cn')
  UNION
  SELECT DISTINCT ti."classId" FROM "TaskInstance" ti
    WHERE ti."createdBy" = (SELECT id FROM "User" WHERE email='teacher1@finsim.edu.cn')
);
```

结果：
- 金融2024A班 → 10
- 金融2024B班 → 2

**真值合计 = 12**。修复后 dashboard transforms 会返回 12（之前 10）。

## 测试

- 单元测试 `tests/teacher-dashboard-transforms.test.ts`：
  - 原 `"studentCount = max students across instances"` 改为 `"studentCount sums distinct classes (10 + 2 = 12, not max)"`，断言 `kpi.studentCount === 12`。
  - 加 `"studentCount ignores instances missing class.id"` 边界用例（断言只算有 id 的那一条 = 5）。
- `npx tsc --noEmit` — 0 error
- `npx vitest run` — **74 files / 874 tests 全过**（无 regression）
- `npm run lint` — 0 error / 3 pre-existing warning（runner deps，与本 fix 无关）

## Anti-regression 检查（CLAUDE.md）

- ✅ 只动了 fix 相关的 2 个文件（lib/utils + tests），未触碰业务无关代码
- ✅ Service interface 未改（仍是 `buildKpiSummary(args).studentCount: number`）
- ✅ 中文 UI 文案无变化（这是 transform，UI 渲染数字不变形）
- ✅ Diff 31 lines（< 150）
- ✅ 不破坏 anti-regression rule 7（仅最小修复，无 drive-by refactor）
- ✅ Prisma schema 未动（无三步铁律风险）

## 给 QA 的关键验证点

1. **DB 真值 = 12**：用上面 SQL 复核。
2. **浏览器实测**：登录 `teacher1@finsim.edu.cn` / `password123` → `/teacher/dashboard` → KPI 卡 "共 N 名学生" 显示 **12**（之前 10）。
3. **回归**：所有其它 KPI 数字（班级数、本周提交、完成率、均分）应保持不变（本 fix 只改 studentCount 逻辑）。
4. **代码独立 review**：确认 `lib/utils/teacher-dashboard-transforms.ts` 的 buildKpiSummary 不再有 `Math.max` 的 studentCount 计算。

## 后续

进入 Fix 2 — `TaskInstanceAnalytics` 实时聚合（同文件下游 + dashboard.service.ts）。
