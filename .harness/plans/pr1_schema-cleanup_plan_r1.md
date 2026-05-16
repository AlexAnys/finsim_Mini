# PR-1 Candidate I+J — Schema 清理 plan (r1)

> Builder: builder-schema-cleanup · Branch: `claude-codequality-pr1` (worktree) · Base: main `56b49e8`
> 范围：F-2 死表 + F-7 denormalized 字段 + F-8 死 enum + F-9 双源 OR pattern
> 风险：destructive schema 改动 — 严格 Prisma 三步 + dev DB 备份

## 0. 当前 dev DB 现状

- Docker postgres：alive (`acc4fef29d82_finsim-postgres`，up 4 days)
- 最近备份：`.harness/dev-db-backup-2026-05-14.sql` (717KB) — 2 天前
- backfill migration 已就位：`20260422041600_backfill_course_class` (INSERT INTO CourseClass FROM Course WHERE classId IS NOT NULL ON CONFLICT DO NOTHING)
- migration 链 23 条都 applied (从 `20260221084930_init` 到 `20260514142850_add_quiz_question_knowledge_tags`)

## 1. Grep verify 报告 — 真死 vs 真活字段

| 字段 | reader 真存在？| 处理 |
|---|---|---|
| `TaskInstanceAnalytics` 表 | **prisma.taskInstanceAnalytics**：0 (全仓 grep 无任何 read/write) | **DROP TABLE CASCADE** |
| `Task.analytics` relation (back-ref) | schema 里有，**业务代码 0 使用** | 随表 drop |
| `TaskInstance.analytics` relation (forward) | schema 里有，include 0 使用（dashboard.service 已注释"死表"）| 随表 drop |
| `ti.analytics?.avgScore` reads (transforms + components) | **存在 ~10 处**（但读的是 service 注入的 in-memory `analytics: liveAnalytics.get(ti.id)`，**不是** Prisma relation） | **保留**，工作原理不变 |
| `Task.visibility` column | task.service.ts:78,258 写；page.tsx [id]:109+444 (interface 声明 + copy-as-new payload)；tasks/page.tsx:45 (interface 声明，无 JSX 渲染) | **DROP** + 同步删 service/validator/page interface 引用 |
| `Visibility` enum | schema 1 处 enum + 1 处 column 引用；validator 1 处 zod enum；**无任何 `where: { visibility }` 读** | **DROP TYPE** |
| `Task.courseName` / `chapterName` columns | task.service.ts:81-82, 260-261 (writer)；**0 reader**（page 里的 courseName/chapterName 是 input payload field，与 column 同名但是 form input → service → column 一次性传递；question-bank/from-context 的 courseName 是从 `course.courseTitle` runtime 派生不是 column 读）| **DROP** + 同步删 validator + service write |
| `Class.code` | register page line 295 渲染 `(${cls.code})` — **真活字段** | **保留**（spec 允许） |
| `Class.academicYear` | register page interface line 23 声明，**JSX 未渲染**；class.service.ts:10 select 但未消费 | **保留**（spec："发现还有 reader 就保留"；这里 service select 了，宁可保留） |
| `Class.departmentName` | **仅 seed.ts 写**，0 reader | **DROP** column |
| `Course.classId` (双源问题) | course.service:71 写；course.service:179 ALREADY_PRIMARY guard；dashboard.service:185, 224, 237 用 `OR: [{ classId }, { classes: { some } }]`；course.service:200 同 OR；study-buddy.service:83-84 同 OR；getStudentDashboard 需要 fallback | **保留 column，标 deprecated 注释**；不动 Prisma column nullability（避免 backfill 漏数据致 NULL）；改 5 处 OR pattern 收敛到 CourseClass-only |

> **关键判断**：`Course.classId` 不能 drop — review-data 自己也说"标 deprecated 留迁移期"。理由：① register page / class.service.ts 等地方读 `class.code/academicYear`、删字段牵连面广 ② 即便已 backfill，drop 是单向操作，留 column 给一个 PR 周期观察 NULL 兼容更稳。但**收敛 OR pattern**是安全的：先用 CourseClass-only 查询，再过若干 PR 后删 column。

## 2. CASCADE 影响面 grep

`DROP TABLE TaskInstanceAnalytics CASCADE`：
- TaskInstanceAnalytics 自身有 2 个 FK constraint（`taskInstanceId → TaskInstance ON DELETE CASCADE`，`taskId → Task ON DELETE RESTRICT`）— 这些是被它 own 的入向 FK
- 无任何其他表 reference TaskInstanceAnalytics（grep `REFERENCES "TaskInstanceAnalytics"` in migrations = 0 命中）
- CASCADE 只会 drop 表自身 + 它的 2 个 outgoing FK constraint，不会波及 TaskInstance / Task 表数据

`DROP TYPE Visibility`：仅 Task.visibility column 使用；必须先 drop column 再 drop type，或一条 ALTER TABLE 内联

## 3. Backfill 完整性 SQL verify（plan 阶段先跑）

```sql
SELECT count(*) AS missing_backfill
FROM "Course" c
WHERE c."classId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "CourseClass" cc
    WHERE cc."courseId" = c.id AND cc."classId" = c."classId"
  );
```

期望 = 0。**若 > 0**：plan 阶段先补 backfill；不然 OR pattern 收敛后这些 course 在学生 dashboard 会消失。

## 4. 执行计划

### Step 1 — dev DB 备份（命名）
```bash
docker exec acc4fef29d82_finsim-postgres pg_dump -U postgres -d finsim > .harness/dev-db-backup-2026-05-16.sql
```

### Step 2 — backfill verify
跑上面 SQL；若 > 0 写一条补 backfill migration（不在主 migration 内）。

### Step 3 — 改 `prisma/schema.prisma`

```prisma
// 删 enum Visibility（lines 91-96）— 整段删

// model Task 字段调整（line 343）：
// - 删 `visibility       Visibility  @default(private)` (line 348)
// - 删 `courseName       String?     @db.VarChar(200)` (line 351)
// - 删 `chapterName      String?     @db.VarChar(200)` (line 352)
// - 删 `analytics            TaskInstanceAnalytics[] @relation("TaskAnalytics")` (line 368)

// model TaskInstance（line 508）：
// - 删 `analytics       TaskInstanceAnalytics?` (line 539)

// model Class（line 220）：
// - 删 `departmentName String?  @db.VarChar(200)` (line 225)

// model TaskInstanceAnalytics（lines 808-824）— 整 model 删

// model Course（line 243）— 保留 classId，但加注释：
//   classId     String   // @deprecated 待迁移期结束后删除，使用 CourseClass 关联代替（PR-1 已收敛 OR pattern）
```

### Step 4 — Prisma 三步严格走

```bash
npx prisma migrate dev --name drop_dead_schema_pr1
npx prisma generate
# 杀掉运行中的 dev server，重启，验证 /teacher/dashboard / /teacher/courses / /teacher/instances 三页加载成功
```

期望 migration SQL（auto-gen 后人工 review）：
```sql
-- 删 FK 后再删 column 顺序由 Prisma 自动处理
ALTER TABLE "Task" DROP COLUMN "visibility";
ALTER TABLE "Task" DROP COLUMN "courseName";
ALTER TABLE "Task" DROP COLUMN "chapterName";
ALTER TABLE "Class" DROP COLUMN "departmentName";
DROP TABLE "TaskInstanceAnalytics" CASCADE;  -- 实际 Prisma 会先 DROP CONSTRAINT 再 DROP TABLE
DROP TYPE "Visibility";
```

### Step 5 — 代码同步删 dead reader

**`lib/validators/task.schema.ts`**:
- 删 `visibilityEnum` (line 6)
- 删 `visibility` field 从 `createTaskSchema` (line 86)
- 删 `courseName` / `chapterName` field 从 `createTaskSchema` (lines 88-89)

**`lib/services/task.service.ts`**:
- createTaskInTransaction line 78：删 `visibility: input.visibility`
- createTaskInTransaction lines 81-82：删 `courseName: input.courseName, chapterName: input.chapterName`
- updateTask line 258：删 `visibility: patchData.visibility`
- updateTask lines 260-261：删 `courseName: patchData.courseName, chapterName: patchData.chapterName`

**`app/teacher/tasks/page.tsx`**:
- line 45：删 interface `visibility: string` field

**`app/teacher/tasks/[id]/page.tsx`**:
- line 109：删 interface `visibility: string` field
- line 444：删 copy-as-new body 里的 `visibility: task.visibility`

**`lib/services/dashboard.service.ts`**:
- 清理 line 17,101,129,140 的 "TaskInstanceAnalytics 死表" 注释（改写成"live 实时聚合"简短注释或全删）

**`tests/teacher-dashboard.test.ts`**:
- line 54-58：删 `does not include the dead TaskInstanceAnalytics relation` 测试（关系已不存在，测试无意义；保留 line 60+ 的 live analytics 测试）

### Step 6 — 5 处 OR pattern 收敛

策略：保留 `courseClassFilter(classId)` (course.service.ts:16)，但内部从 `OR: [{ classId }, { classes: { some: { classId } } }]` 改为 `{ classes: { some: { classId } } }`。

**前提**：Step 3 的 backfill verify SQL 必须 = 0；否则收敛后会 hide 那些只有 Course.classId 没有 CourseClass 行的 course。

5 处使用：
- `dashboard.service.ts:185` — getStudentDashboard course where (OR inline，改用 courseClassFilter 或同步替换)
- `dashboard.service.ts:224` — getStudentDashboard announcement (OR inline)
- `dashboard.service.ts:237` — getStudentDashboard scheduleSlot (OR inline)
- `course.service.ts:200` — getCoursesByClass (OR inline)
- `course.service.ts:16` — courseClassFilter 定义本身

**注意**：另外两个间接使用点也要 verify：
- `study-buddy.service.ts:83-84` — `OR: [{ classId: userClassId }, { classes: { some: { classId: userClassId } } }]` 在 course where 里 — 同样收敛
- `announcement.service.ts:47` / `schedule.service.ts:32` — 已用 `courseClassFilter`，自动跟改

实际只需改 `courseClassFilter` 本身 + inline 4 处。

### Step 7 — 完整验证

```bash
npx tsc --noEmit                          # 期望: 0 new error (维持 baseline 6)
npx vitest run                            # 期望: 全过
npm run lint                              # 期望: 0 error
```

**真浏览器验证**：
- molly 登录 → /teacher/dashboard 加载（含 analytics 卡片 + 课程列表 + 任务实例统计）
- /teacher/courses 加载（课程卡片含 _count）
- /teacher/instances 加载（实例列表 + 排序）
- /dashboard（学生端，alex/student 账号）加载（含课程 + 任务列表 + 公告 + 课表）
- /register 加载（class.code 仍正确显示）

## 5. 备份策略 & 回滚预案

**备份**：
- `.harness/dev-db-backup-2026-05-16.sql` (本 plan Step 1)
- prod 备份责任：在 PR description 显式提醒"merge 前 prod DB 必须备份"（spec 风险登记已要求）

**回滚预案**：
- Migration 失败：`npx prisma migrate resolve --rolled-back drop_dead_schema_pr1` + 从备份恢复 dev DB
- Migration 成功但页面 500：先 git revert commit，重新生成 prisma + 重启 server；DB schema 留旧 column 不掉（Prisma 容忍 column 在 DB 多于 schema，运行 OK）
- 收敛 OR pattern 后学生 dashboard 课程消失：补一条 SQL backfill `INSERT INTO CourseClass ... ON CONFLICT DO NOTHING`，**不需要** schema 回滚

## 6. 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Backfill 漏数据 → OR 收敛后课程消失 | 低 (已有 idempotent migration) | 高 | Step 3 SQL verify = 0 才进 Step 6 |
| Prisma generate 后 dev server 不重启 → 运行时 500 | 中 (历史多次发生) | 高 | Step 4 必须重启 + 浏览器加载 3 页验证 |
| DROP TYPE Visibility 顺序问题 | 低 (Prisma auto-gen 处理) | 中 | review 生成的 migration SQL 确认 DROP COLUMN 在 DROP TYPE 前 |
| tests/teacher-dashboard.test.ts 中 `analytics` 注入断言失败 | 低 | 中 | 保留 live analytics 注入测试，仅删 "no analytics relation" 测试 |
| dev DB 备份失败 / 磁盘满 | 低 | 高 | Step 1 验证 .sql 文件 > 100KB 才进 Step 2 |
| 其他 builder（D 写 audit）改 task.service 撞车 | 中 | 低 | I+J 改 schema column 字段 + visibility/courseName 写入；D 加 audit 写入。**不同行不同函数**：updateTask line 258 vs 末尾 audit call — 物理可共存。等 D commit 后我 rebase 或反之。 |

## 7. Diff 预算

- schema.prisma: -30 行 (enum + table + 3 column + 2 relation)
- migration.sql: +15 行 (auto-gen)
- task.service.ts: -6 行 (write field)
- task.schema.ts: -6 行 (validator field)
- dashboard.service.ts: ~-15 行（注释清理 + OR pattern 收敛）
- course.service.ts: -2 / +2 行（OR collapse）
- study-buddy.service.ts: -2 / +1 行
- teacher/tasks pages: -3 行
- teacher-dashboard.test.ts: -6 行（删 1 个测试 case）

总计 < 150 行 diff，符合 spec 单 PR 总和 ≤ 1500 行。

## 8. 三个 ask（plan 阶段先问 coord）

1. **`Course.classId` 处理**：plan 推荐**保留 column + schema 注释 `@deprecated`** + 收敛 OR pattern 到 CourseClass-only。理由：(a) 单向 drop 风险高；(b) review-data 自己也建议留迁移期；(c) 收敛 OR 已能消除"双源 OR 重复"的核心痛点（5+ 处 → 1 处 filter 收口）。同意吗？还是想直接 drop（数据已 backfill）？

2. **`Class.academicYear` 处理**：grep 显示 class.service.ts:10 select 了，register page interface 声明，但 JSX **没有渲染**。属于"select 了但 UI 没用"的中间态。建议**保留**（spec 说"有 reader 就保留"，select 算 reader）。同意？还是删（dead-code 清理彻底）？

3. **dev DB 备份**：plan 是 `.harness/dev-db-backup-2026-05-16.sql` (沿用 5-14 命名规约)。直接 pg_dump 整库，覆盖 staging/prod 不影响。同意？

回答后即开干。
