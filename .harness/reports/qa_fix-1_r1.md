# QA report — Fix 1 (学生数 sum) · r1

- **Verdict**: **PASS**
- **Worktree**: `finsim-wt-dashboard`
- **Branch**: `claude-fix-batch1-dashboard`
- **HEAD**: `c91e46b` — `fix(dashboard): teacher student count sum across classes`
- **QA agent**: qa-dashboard（independent of builder-dashboard）

## 1. 独立读 git diff（不只信 builder 自报）

`git show c91e46b --stat`：
```
 lib/utils/teacher-dashboard-transforms.ts  | 12 ++++++++++--
 tests/teacher-dashboard-transforms.test.ts | 25 +++++++++++++++++++++----
 2 files changed, 31 insertions(+), 6 deletions(-)
```

Diff 内容（`lib/utils/teacher-dashboard-transforms.ts`）：
- 删除 `let studentCount = 0` + `for (ti) { ...n > studentCount ... }` 的 Math.max 写法
- 新增 `classSizeById = new Map<string, number>()`，遍历 taskInstances 按 `class.id` 去重存最大 size，最后 `Σ values`
- 跳过 `class.id` 缺失的实例（防御 ghost class size）

逻辑正确，符合 spec：`User.classId` schema 单值 → 各班学生集合不相交 → sum 是正确口径，去重保证同班被多个 instance 引用不重复计。

## 2. DB 真值对账（独立 SQL）

```sql
WITH ti_classes AS (
  SELECT DISTINCT ti."classId" AS cid
  FROM "TaskInstance" ti
  LEFT JOIN "Course" co ON co.id = ti."courseId"
  LEFT JOIN "CourseTeacher" ct ON ct."courseId" = co.id
  WHERE (ti."createdBy" = '4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5'
         OR ct."teacherId" = '4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5')
    AND ti."classId" IS NOT NULL
)
SELECT cls.id, cls.name, COUNT(u.id) AS students
FROM ti_classes tc
INNER JOIN "Class" cls ON cls.id = tc."classId"
LEFT JOIN "User" u ON u."classId" = cls.id AND u.role = 'student'
GROUP BY cls.id, cls.name
ORDER BY cls.name;
```

结果：
- 金融2024A班 (`deedd844-…`) → **10 学生**
- 金融2024B班 (`1dbdc794-…`) → **2 学生**

**真值 sum = 12**（vs max = 10）。

聚合复核：
```sql
SELECT COUNT(DISTINCT u.id) FROM "User" u
  INNER JOIN ti_classes tc ON tc.cid = u."classId"
  WHERE u.role = 'student';
```
→ **12**。

## 3. Playwright 真浏览器实测（不复用 builder e2e）

- 启动 dev server：`PORT=3001 npx next dev --webpack`（Next 16 Turbopack 不支持跨 worktree symlink node_modules，已切 webpack；不影响业务代码）
- 登录 `teacher1@finsim.edu.cn` / `password123` → `/teacher/dashboard`
- 测试脚本：`tests/e2e/qa-fix-1.spec.ts`（独立写，**未复用 builder e2e**）
- 截图：`.harness/screenshots/qa-fix-1-r1/01-dashboard-full.png`
- 控制台输出：
  ```
  match: 12 名学生 → n = 12
  class match: 8 班
  ```
- 断言 `studentCounts.toContain(12)` **PASS**（6.9 秒）

DOM 中精确找到 `12 名学生`。与 DB 真值 12 完全匹配。

## 4. 自动化质量门

| 门 | 命令 | 结果 |
|---|---|---|
| typecheck | `npx tsc --noEmit` | **0 error** |
| unit tests | `npx vitest run` | **874 / 874 pass**（74 文件，4.35s） |
| 改动文件单测 | `npx vitest run tests/teacher-dashboard-transforms.test.ts` | **36 / 36 pass** |
| lint | `npm run lint` | **0 error / 3 warning**（pre-existing runner deps，与本 fix 无关） |
| e2e (Playwright) | 自写 `qa-fix-1.spec.ts` | **1 / 1 pass**（6.9s） |

3 个 lint warning 在 `components/quiz/quiz-runner.tsx`、`components/simulation/simulation-runner.tsx`、`components/subjective/subjective-runner.tsx` — 这些是 hooks deps warning，是 **review review_summary_r1.md 的 🟡 24 号已记录的旧问题**，本 fix 没碰它们，不算回归。

## 5. CLAUDE.md anti-regression 检查

| 规则 | 检查 | 结论 |
|---|---|---|
| Bug fix 最小化（rule 7） | diff 31 行，2 文件，仅 buildKpiSummary 内部逻辑 | ✅ |
| Service interface 不破坏（rule 8） | `buildKpiSummary().studentCount: number` 签名不变 | ✅ |
| 业务无关文件不动（rule 9） | 没动 services / app / components / 配置 | ✅ |
| Prisma 三步铁律 | schema.prisma 未触碰，无须 migrate/generate | ✅ |
| 中文 UI | 这是 pure transform，不改 UI 文案；DOM 中 `12 名学生` 渲染保留中文 | ✅ |
| Commit message 规范 | `fix(dashboard): teacher student count sum across classes` ✓ feat/fix 前缀 + 描述清晰 | ✅ |
| 不破坏 mimo reasoning param (da9a505) | 本 fix 没碰 ai.service.ts | ✅ |
| 全 callers 同步 | `buildKpiSummary` 在 `app/teacher/dashboard/page.tsx` 等使用，返回类型不变，无 caller 同步需要 | ✅ |

## 6. Acceptance 表

| # | spec 要求 | 实测结果 |
|---|---|---|
| 1 | Playwright 实测「共 N 名学生」N === DB 真值 | 12 (浏览器) === 12 (DB) ✅ |
| 2 | 单测 case：2 班 [10, 2] → 12（不是 10） | 测试 `studentCount sums distinct classes (10 + 2 = 12, not max)` 通过 ✅ |
| 3 | `npx tsc --noEmit` 0 error；`npx vitest run` 全过 | 0 error / 874 pass ✅ |
| 4 | Commit message：`fix(dashboard): teacher student count sum across classes` | 完全匹配 ✅ |

全部 4 条 PASS。

## 7. 证据归档

- 截图：`.harness/screenshots/qa-fix-1-r1/01-dashboard-full.png`（保存在 worktree path）
- e2e 脚本：`tests/e2e/qa-fix-1.spec.ts`
- Playwright config：`playwright.qa.config.ts`（worktree 内，端口 3001）
- DB 对账 SQL：见上方第 2 段

## 8. 结论

**Fix 1 PASS**。可以进 Fix 2。
