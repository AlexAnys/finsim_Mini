# QA Report — PR-1B · 历史 latent bug 清理 r1

**日期**：2026-04-24
**QA**：qa
**Spec**：`.harness/spec.md` § PR-1B
**Build report**：`.harness/reports/build_pr-1b_r1.md`

## Spec 4 项验证

### 1. `assertCourseAccess` 提公共

- 唯一实现位置：`lib/auth/course-access.ts:9` ✅
- Re-export：`lib/auth/guards.ts:5` 通过 `export { assertCourseAccess } from "@/lib/auth/course-access"` ✅
- 消费路径：`app/api/lms/courses/[id]/route.ts:2` + `app/api/lms/courses/[id]/classes/route.ts:2` 都 `import ... from "@/lib/auth/guards"`，无本地重复 ✅
- `assertCourseAccessBulk`（在 `course.service.ts`）是 pre-existing 的 bulk 版本，不在 spec 所指范围
- 独立文件设计：spec 里未明示，但 builder 给了清晰 rationale — vitest ESM resolver 对 `next/server` 路径不友好，抽独立 pure 文件便于单测不连带 NextAuth。实际运行路径零改变。

### 2. `schedule.service` 两分支独立

- `lib/services/schedule.service.ts:19-36` 用 `courseConditions: Prisma.CourseWhereInput[]` 收集 classId/teacherId 子条件，1 个直接赋 `where.course`，≥2 个用 `{ AND: [...] }` ✅
- 无 spread 同名 key 覆盖
- `tests/schedule-announcement.service.test.ts:37-48` 断言 `classId + teacherId` 同时传时 where.course 为 `{ AND: [OR, OR] }` 形状 ✅

### 3. 老师侧公告范围 `teacherId` 注入

- `lib/services/announcement.service.ts:39-51` 同样 array+AND 合并；新增 `teacherId` filter 参数 ✅
- `app/api/lms/announcements/route.ts:54-57` 教师 + 无 `courseId` 时注入 `filters.teacherId = user.id` ✅
- Admin 不注入（L58 明示 "admin 不加 teacherId 过滤"），保留全局视角 ✅
- **真浏览器 DB 数据验证**（见 Evidence 下节）

### 4. `CourseAnalyticsTab` allSettled

- `components/course/course-analytics-tab.tsx:250` `Promise.allSettled` 替换 `Promise.all` ✅
- `partitionSettledSubs`（L189）纯函数 export 便于单测 ✅
- 第 271-282 行：失败 ids/titles 存入 state，toast 提示 "N 个任务数据加载失败，其余已显示"
- 第 738-749 行：失败卡片渲染 `<Card className="border-destructive/30 bg-destructive/5">` + AlertCircle + "数据加载失败，稍后重试" ✅
- 第 461 行 empty state 条件：`instanceStats.length === 0 && failedInstanceIds.size === 0`，保证有失败时不进 empty 分支 ✅

## 验证表

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 4 项全部命中（见上节） |
| 2. tsc --noEmit | PASS | 无输出，0 错误 |
| 3. vitest run | PASS | 13 files / 74 tests（原 61 + 新 13）全过，551ms |
| 4. Browser (curl + 真登录 × 4 角色 × 多 filter) | PASS | teacher1=5 / teacher2=0 / admin=5 / student1=5-classA-published；带 courseId 老师看指定课 2 个 — 全部符合 spec 预期 |
| 5. Cross-module regression | PASS | grep `assertCourseAccess` 全仓仅 1 处 impl；PATCH course 仍走 FORBIDDEN 路径；GET course 保持 pre-existing 行为（未在 spec 范围内加 guard）|
| 6. Security (/cso) | N/A | 老师公告缩紧是 **权限收窄**（不是放宽），不引入新攻击面；assertCourseAccess 语义未变（只是位置）；不触发 CSO 门槛 |
| 7. Finsim-specific | PASS | 错误消息 "数据加载失败，稍后重试" 中文；route 保持 Service 层调用，Route Handler 无业务逻辑；API 响应 shape 未变 |
| 8. Code patterns | PASS | 无 drive-by；删除未使用的 prisma import（builder 明示）；3 个新测试 > spec 阈值 |
| 9. npm run build | PASS | 编译过 |

## Evidence — 真浏览器 curl 验证

**4 个 session**（teacher1 / teacher2 / admin / student1）各自登录并保存独立 jar。

### Seed 数据基线

- seed.ts 里仅 2 条手工公告（都 teacher1 创建，属 course1）+ dev 环境里另有 3 条（共 5 条全部 teacher1 creator）
- seed 未建 `CourseTeacher` 协作关系 — teacher2 独立

### `/api/lms/announcements` 无 courseId

| 角色 | count | 内容 |
|---|---|---|
| teacher1 | **5** ✅ | 全部 `creator=4dbbe635`（teacher1 自己）分布在 2 门课 |
| teacher2 | **0** ✅ | seed 里没有 teacher2 creator 或 CourseTeacher 的公告 — 缩紧成功 |
| admin | **5** ✅ | 保留全局视角 |
| student1 | **5** ✅ | 走 `classId=classA + status=published`（原行为保留） |

**关键 behavior change 验证**：teacher2 从"可见全系统公告"→ "仅可见自己课"，正好符合 spec § PR-1B.3。Admin 不受影响。

### `/api/lms/announcements?courseId=<teacher1-course>`

| 角色 | count |
|---|---|
| teacher1 + courseId | **2** ✅（该课 2 条公告）|

### `assertCourseAccess` route 级回归

| 角色 × 动作 | 结果 | 预期 |
|---|---|---|
| teacher1 GET own course | 200 | ✅ own |
| teacher1 GET own course /classes | 200 | ✅ |
| admin GET course | 200 | ✅ admin 直通 |
| teacher2 PATCH teacher1's course | **403 FORBIDDEN "权限不足"** | ✅ `assertCourseAccess` 生效 |
| teacher2 GET teacher1's course | 200 (full data) | **pre-existing** — GET 本就没调 assertCourseAccess，本 PR 未新增 guard，非 regression |
| teacher2 GET teacher1's course /classes | 200 (data=[]) | **pre-existing** — GET classes 也没调 guard；过滤由 service 按身份返回空 |

**澄清**：spec 只要求"提取公共 impl"，**未要求给 GET route 加 guard**。本 PR 完全尊重 spec scope，未动行为。若后续要加强 GET 权限是另一 PR 范围。

## 测试覆盖度评审

| 新测试 | 用例数 | 覆盖场景 |
|---|---|---|
| `tests/assert-course-access.test.ts` | 5 | admin 直通 / owner 通过 / CourseTeacher 通过 / 非协作者 FORBIDDEN / 课不存在 COURSE_NOT_FOUND |
| `tests/course-analytics-partition.test.ts` | 4 | 混合 fulfilled/rejected / 全 rejected / 全 fulfilled / empty 输入 |
| `tests/schedule-announcement.service.test.ts` +4 | 3+4=7 | 保留原 classId filter；新增 classId+teacherId AND 合并 / courseId-only / teacherId-only / 无 filter 不限制 |

Spec Acceptance `至少 3 个新测试`：**+13 tests 远超阈值** ✅。
Spec Risk "老师侧公告可见性变窄 — 现有测试可能需要同步更新" — 查 pre-existing 测试套件：`courses-patch.api.test.ts` 只更新了 `vi.mock` import 方式（去适配 re-export），没有删除/修改任何断言。无"测试迁就实现"嫌疑 ✅。

## 改动规模 & Scope

```
 15 files (12 M + 3 untracked ??)
 +260 / -183
 schema.prisma: 0 改动（Phase 1 不触发 Prisma 三步）
```

Untracked 3：`lib/auth/course-access.ts` + 2 test 文件。

## Behavior change — 预期 vs regression 判断

Spec 明示 "老师公告可见性变窄是预期行为变化"。QA 核心 judgment：
- teacher2=0 不是 bug，是 spec 要求的结果 ✅
- 无任何 pre-existing 测试因此行为变化 break（vitest 74 全过）
- 若未来 admin 全局视角被意外收紧，应作为 regression — 本 PR 里 admin=5 保留 ✅

## Issues found

无。

## Overall: **PASS**

4 项 spec 要求全部落实，13 个新测试覆盖度充足，真浏览器 4 角色数据证据确认 "老师缩紧 / admin 全局 / student 原状 / courseId 覆写" 4 种 filter 行为全部符合预期；assertCourseAccess PATCH 路径真 403；tsc+vitest+build 三绿；schema 零改动；scope 严格未做 spec 范围外改动。
