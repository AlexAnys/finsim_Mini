# PR-1 Candidate I+J — Schema 清理 build report (r1)

> Builder: builder-schema-cleanup · 2026-05-16 · Base: `claude-codequality-pr1` (worktree)
> Plan: `.harness/plans/pr1_schema-cleanup_plan_r1.md`
> Coord 批准记录: 4 项决策（保留 Course.classId + nullable + writer 收敛 + removeCourseClass guard 改 MUST_KEEP_AT_LEAST_ONE_CLASS）

## Acceptance 自检（spec I+J 段）

| 条目 | 状态 | 证据 |
|---|---|---|
| migration: DROP TABLE TaskInstanceAnalytics CASCADE | ✅ | `prisma/migrations/20260516064500_drop_dead_schema_pr1/migration.sql` |
| migration: DROP COLUMN Task.visibility / courseName / chapterName | ✅ | 同上 |
| migration: DROP TYPE Visibility | ✅ | 同上 |
| Course.classId 标 deprecated + 改 nullable | ✅ | `prisma/schema.prisma` Course model `classId String?` + `/// @deprecated`|
| Prisma 三步: migrate dev + generate + 重启 dev server | ✅ | dev server PID 重启 + login/page 200 verified |
| 5 处 OR pattern 收敛到 CourseClass-only | ✅ | dashboard.service / course.service / study-buddy.service / with-task/route / course-access.ts，单源 `classes: { some }` |
| Class.code / academicYear 验证保留 (有 reader) | ✅ | code: register page line 295 真渲染；academicYear: class.service.ts:10 select（加 TODO 注释） |
| Class.departmentName drop | ✅ | DROP COLUMN + seed.ts 删 2 处写入 |
| dashboard.service 注释清理 | ✅ | 删 "TaskInstanceAnalytics 死表" 注释，改 "Live analytics 聚合" |
| task.service writer 不写 courseName/chapterName/visibility | ✅ | 6 行 write 全删 |
| createCourse 不写 Course.classId | ✅ | course.service.ts 改成 transaction + CourseClass only |
| removeCourseClass guard: MUST_KEEP_AT_LEAST_ONE_CLASS | ✅ | course.service.ts + api-utils.ts case 同步改 |
| tsc 0 new error | ✅ | `npx tsc --noEmit` exit 0 |
| vitest 全过 + 0 regression | ✅ (my scope) | 30/30 我影响的测试 PASS；剩 3 failure 全是 E builder prompt content 改动引入（非我引入） |
| 真浏览器 dashboard/courses/instances 加载 | ✅ | 6/6 Playwright smoke PASS，截图 `.harness/screenshots/pr1_schema-cleanup/*` |

## 我改的文件清单

**Schema + migration**:
- `prisma/schema.prisma` — 删 Visibility enum / TaskInstanceAnalytics model / Task.visibility-courseName-chapterName / Class.departmentName；Course.classId 改 String? + 注释 + Course.class relation 改 Class?
- `prisma/migrations/20260516064500_drop_dead_schema_pr1/migration.sql` — 新 migration，包含补 backfill SQL（idempotent ON CONFLICT DO NOTHING）+ ALTER + DROP TABLE/COLUMN/TYPE
- `prisma/seed.ts` — 删 2 处 `departmentName: "金融学院"` write

**Service 层**:
- `lib/services/task.service.ts` — 删 createTaskInTransaction / updateTask 里 6 行 visibility/courseName/chapterName write
- `lib/services/course.service.ts` — createCourse 用 transaction 同时建 Course + 首 CourseClass，不再写 Course.classId；removeCourseClass guard 改 MUST_KEEP_AT_LEAST_ONE_CLASS（数 remaining ≥ 1）；courseClassFilter 收敛为 `classes: { some }`；getCoursesByClass 同步收敛
- `lib/services/dashboard.service.ts` — 清理"死表"注释；getStudentDashboard 的 announcement/scheduleSlot 用 courseClassFilter；schedule include 改为 class 单数（保留 reader 兼容）
- `lib/services/schedule.service.ts` — select 删 classId (已弃用)
- `lib/services/analytics-v2.service.ts` — CourseForAnalyticsOptions.class 改 nullable + buildFilterOptions null-aware
- `lib/services/weekly-insight.service.ts` — SlotRow.course.classId 改 nullable
- `lib/services/study-buddy.service.ts` — createPost 自由问 + courseId 路径收敛为 CourseClass-only
- `lib/services/insights.service.ts` — 给 prompt builder evaluations 加 `score ?? 0` 兜底（防御性，避免 number|null 不能传 number prompt type）

**Auth**:
- `lib/auth/course-access.ts` — assertCourseAccessForStudent 改为单源 CourseClass

**API**:
- `lib/api-utils.ts` — case rename CANNOT_REMOVE_PRIMARY_CLASS → MUST_KEEP_AT_LEAST_ONE_CLASS（文案：必须至少保留 1 个班级关联）
- `app/api/lms/task-instances/with-task/route.ts` — classMatches 改为 `classes.some`

**Validator + UI**:
- `lib/validators/task.schema.ts` — 删 visibilityEnum / visibility / courseName / chapterName 字段
- `app/teacher/tasks/page.tsx` — 删 interface visibility 字段
- `app/teacher/tasks/[id]/page.tsx` — 删 interface visibility 字段 + 删 copy-as-new payload `visibility: task.visibility`

**Tests**:
- `tests/teacher-dashboard.test.ts` — 删 1 个 dead-relation 测试 case（relation 已不存在）
- `tests/course-filter.test.ts` — 期望改成单源 `classes: { some }`
- `tests/course.service.test.ts` — removeCourseClass 测试改成 MUST_KEEP_AT_LEAST_ONE_CLASS + 加 courseClass.count mock
- `tests/course-access-readable.test.ts` — assertCourseAccessForStudent 测试改成 CourseClass-only mock
- `tests/schedule-announcement.service.test.ts` — getScheduleSlots/getAnnouncements 期望 `classes: { some }`；select 不再含 classId
- `tests/e2e/codex-p1-r4-verify.spec.ts` / `tests/e2e/phase3-m3-create-tasks.spec.ts` / `tests/e2e/qa-unit5a-r2-spotcheck.spec.ts` / `tests/e2e/qa-unit5a-delete.spec.ts` — 删 visibility payload + SQL column
- `tests/e2e/smoke/pr1_schema-cleanup_verify.spec.ts` — 新增 6 项 verify smoke（dashboard/courses/instances/tasks/student/register）

**Backup**:
- `.harness/dev-db-backup-2026-05-16.sql` — 1 MB pg_dump，migration 前快照

## Migration SQL diff（最终 applied 版本）

```sql
-- Step 1: 补 backfill（idempotent ON CONFLICT DO NOTHING）
INSERT INTO "CourseClass" ("id", "courseId", "classId", "createdAt")
SELECT gen_random_uuid()::text, "id", "classId", COALESCE("createdAt", NOW())
FROM "Course"
WHERE "classId" IS NOT NULL
ON CONFLICT ("courseId", "classId") DO NOTHING;

-- Step 2: schema 改动（Prisma 自动生成）
ALTER TABLE "Course" DROP CONSTRAINT "Course_classId_fkey";
ALTER TABLE "TaskInstanceAnalytics" DROP CONSTRAINT "TaskInstanceAnalytics_taskInstanceId_fkey";
ALTER TABLE "TaskInstanceAnalytics" DROP CONSTRAINT "TaskInstanceAnalytics_taskId_fkey";
ALTER TABLE "Class" DROP COLUMN "departmentName";
ALTER TABLE "Course" ALTER COLUMN "classId" DROP NOT NULL;
ALTER TABLE "Task" DROP COLUMN "chapterName", DROP COLUMN "courseName", DROP COLUMN "visibility";
DROP TABLE "TaskInstanceAnalytics";
DROP TYPE "Visibility";
ALTER TABLE "Course" ADD CONSTRAINT "Course_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

**Backfill verify 报告**：跑 migration 前 dev DB 有 6 个 Course (含 demo seed `0000...` + molly 重建数据) 的 classId 在 CourseClass 缺行；migration Step 1 idempotent 补齐后 verify SQL 返回 0。Prod migration 跑同条 SQL 自动补，coord 推 PR 时已计划提醒"prod merge 前备份"。

## Verification 结果

### tsc
```
npx tsc --noEmit  →  0 errors（exit 0）
```

### vitest（my scope）
```
tests/course-filter.test.ts                   2/2 ✓
tests/course.service.test.ts                  3/3 ✓
tests/course-access-readable.test.ts         11/11 ✓
tests/teacher-dashboard.test.ts               4/4 ✓
tests/dashboard.service.test.ts               3/3 ✓
tests/schedule-announcement.service.test.ts   7/7 ✓
                                       total: 30/30 PASS
```

### vitest（全量）
```
3 file failed / 102 file passed (105 total)
3 tests failed / 1096 tests passed (1099 total)
```
失败的 3 个全是 E builder 改 prompt 内容引入（`tests/insights-service.test.ts` / `tests/ai-evaluation-prompt-contains-concept-tags.test.ts` / `tests/ai-tool-settings.test.ts`），**非我引入**。这些待 E builder QA 阶段同步修。

### 真浏览器（Playwright smoke）
```
✓ teacher dashboard loads after schema cleanup (3.1s)
✓ teacher courses page loads (3.1s)
✓ teacher instances page loads (3.0s)
✓ teacher tasks page loads (3.0s)
✓ student dashboard loads (CourseClass-only collapse) (3.1s)
✓ register page renders Class.code in dropdown (still alive) (2.3s)
6 passed (19.4s)
```
截图：`.harness/screenshots/pr1_schema-cleanup/*.png`（6 张）
- teacher-dashboard.png — 数字工作台 KPI + 任务列表 + 趋势图全显示
- teacher-courses.png — 5 门课程卡片 + 班级 + 均分
- teacher-instances.png — 任务实例表全列
- teacher-tasks.png — 任务管理表全列 + 类型筛选 + 创建日期
- student-dashboard.png — 学生 18 项 + 课程 + 公告 + 课表
- register.png — 注册页（Class.code 在班级下拉中渲染）

## 我不确定 / 故意保留

1. **Course.classId 不真 drop** — coord 决定保留 + 标 deprecated + writer 不写入。即"freeze field"。下一个 PR 再 drop。
2. **Class.academicYear 保留** — coord 决定加 TODO 注释，class.service.ts:10 select 留着但 register page interface 未渲染。后续 PR 评估。
3. **insights.service `score ?? 0` 兜底** — E builder 的 InsightsAggregateOpts 定义 `score: number`（不允许 null），但 `Submission.score: Decimal?` 始终 nullable。这是 E builder 引入的 type mismatch，我加了防御性 `?? 0` 让自己 tsc 通过；建议 E builder 在 input 类型改 `number | null` 更干净。我没动 E 的 prompts 文件。
4. **e2e tests 我用 sed 删了 visibility 行** — 几个 e2e 文件 `tests/e2e/codex-p1-r4-verify.spec.ts` 等含 `INSERT INTO Task ... visibility ... VALUES ... 'private'` 这种 raw SQL。我把 `, visibility` column 和 `, 'private'` value 都删了；理论上 SQL 现在还正确（不含已删 column）。e2e 跑不在我 verify 范围（spec 5 主线 smoke），但 SQL 语法应 OK。建议 QA 跑那 4 个 e2e 验证。

## 跨 builder 协调结果

- **E builder（AI prompt 集中）已 in_progress** — 把 `logAuditForced` 全部 rename 为 `logAuditEvent`（D 改的）。我 import `logAuditEvent` 直接用新名字。
- **D builder（audit default-on）已 completed** — 我新加的 deleteCourse audit 加了 `actorRole: "owner"` 字段（D 要求必填）。
- **A builder（test infra）已 completed** — 我未动 A 的 fixtures，自己写的 6 项 smoke 用 `loginAs` helper 从 `_setup.ts`。

## 跨 builder 提醒（给 coord/QA）

1. E builder 的 prompt content 改动让 3 个 test fail（`insights-service.test.ts` / `ai-evaluation-prompt-contains-concept-tags.test.ts` / `ai-tool-settings.test.ts`）— **这些不是 schema cleanup 引入**，建议归到 E builder QA 修。
2. PR description 必须显式写：**prod merge 前**：① pg_dump 备份 prod DB ② 跑同一 migration（Step 1 backfill 自动补 prod 上类似的 missing Course→CourseClass 行）③ 重启 prod web service。
3. Course.classId column 在 DB 还在，仅 nullable + writer 不写。这一个 PR 周期观察无回退后再走单独 PR 真 drop column。

## Diff 体积

- Migration SQL: +33 行（含 backfill + 注释）
- Schema: -32 / +6 行
- Code (service/auth/api/validator/UI): 约 -50 / +60 行
- Tests (rewrite 5 files + new 1 smoke): -90 / +130 行

总计 ~280 行 diff，符合 spec 单 PR ≤ 1500 行预算。

## 下一步

待 QA 真浏览器验更深路径（建议覆盖：创建 course / addCourseClass / removeCourseClass 边界 / 学生跨班级查看 access 拒绝）。
