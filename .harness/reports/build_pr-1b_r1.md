# Build Report — PR-1B · 历史 latent bug 清理（r1）

**日期**：2026-04-23  
**Builder**：builder-p1  
**Spec**：`.harness/spec.md` § PR-1B

## 改动文件（10 个）

### 实现
1. `lib/auth/course-access.ts`（新建）— `assertCourseAccess` 单一实现
2. `lib/auth/guards.ts` — re-export `assertCourseAccess`
3. `app/api/lms/courses/[id]/route.ts` — 删本地 impl，import from guards
4. `app/api/lms/courses/[id]/classes/route.ts` — 删本地 impl，import from guards；同时删除未使用的 `prisma` import
5. `lib/services/schedule.service.ts` — 重写 where 组装，classId/teacherId 独立分支，合并用 AND 而非 spread 覆盖
6. `lib/services/announcement.service.ts` — 同上，并新增 `teacherId` filter 参数
7. `app/api/lms/announcements/route.ts` — 教师角色 + 无 `courseId` 时注入 `teacherId = user.id`（admin 不注入，保留全局视角）
8. `components/course/course-analytics-tab.tsx` — `Promise.all` → `Promise.allSettled`；新增 `partitionSettledSubs` 导出（纯函数方便单测）；失败 instance 以红色卡片显示"数据加载失败，稍后重试"

### 测试（+3 文件）
9. `tests/assert-course-access.test.ts`（新，5 tests）— admin 直通 / owner / CourseTeacher / 非成员 FORBIDDEN / 不存在 COURSE_NOT_FOUND
10. `tests/course-analytics-partition.test.ts`（新，4 tests）— fulfilled-rejected 混合 / 全 reject / 全 fulfilled / 空输入
11. `tests/schedule-announcement.service.test.ts` — 增补 4 tests：classId+teacherId 合并 / courseId only / teacherId 单独分支 / 无 filter 不限制 course
12. `tests/courses-patch.api.test.ts` — 更新 `vi.mock("@/lib/auth/guards")` 以包含真的 `assertCourseAccess`（通过 `vi.importActual("@/lib/auth/course-access")`）

## 关键实现决定

### `assertCourseAccess` 两份差异

两份 impl（`app/api/lms/courses/[id]/route.ts` 和 `app/api/lms/courses/[id]/classes/route.ts`）**语义完全一致**，只有注释微差。合并无风险，直接拿同一份代码提到 `lib/auth/course-access.ts`。

### 为什么单独 `course-access.ts` 而不是直接放 `guards.ts`

vitest 单测 `tests/assert-course-access.test.ts` 如果 import from `@/lib/auth/guards`，会连带 import `auth.config.ts` → NextAuth → `next/server`。vitest ESM resolver 对 `next/server` 识别不了。  
解决：`assertCourseAccess` 独立文件只依赖 `prisma`；`guards.ts` re-export 给生产路由用。生产 route import 路径不变（仍 `@/lib/auth/guards`），单测走独立路径避开 NextAuth。

### schedule / announcement 的 where 重写

原实现：
```ts
where: {
  ...(filters.courseId && { courseId: filters.courseId }),
  ...(filters.classId && { course: courseClassFilter(filters.classId) }),
  ...(filters.teacherId && { course: teacherCourseFilter(filters.teacherId) }),
}
```
两个 `course` key 同名，后一个 spread 吃掉前一个。当前所有 caller mutex 不触发，但显式隐患。

新实现：收集 course 子条件到数组，1 个时直接用，≥2 个用 `AND` 合并。对 `courseId` 保持顶级 key。行为在"单 filter"场景下完全一致（测试验证）；新增了 classId+teacherId 同时传时的正确行为。

### 老师侧公告范围

`/api/lms/announcements` GET：
- `student + classId`：保持原行为（`classId=xxx + status=published`）
- `teacher + 无 courseId`：**新增** 注入 `teacherId = user.id`，只看自己 creator 或 CourseTeacher 的课公告
- `teacher + courseId`：保持原行为（看指定课，由 `courseId` filter）
- `admin`：不注入 `teacherId`，保留全局视角

**行为变更点**：老师 GET `/api/lms/announcements` 无参时，之前看到全系统公告，现在只看自己课。这是 spec 明示的"预期行为变化"，不是 regression。

### CourseAnalyticsTab allSettled

`fetchSummary` 里的 `Promise.all` → `Promise.allSettled`。subsResults 只保留 fulfilled。失败 instance 的 id + title 存入 state，在主 tab 列表末尾渲染红色卡片 "数据加载失败，稍后重试"。其他分析卡片（均分、排名）用 fulfilled 数据正常渲染。

Edge case：instance 列表本身拉不下来（第一个 fetch 失败）— 保持原行为，`toast.error` + 早 return。  
Empty state 逻辑微调：`instanceStats.length === 0 && failedInstanceIds.size === 0` 才判定"没任务"；只要有失败，就进入主视图（虽然 stats 可能是空，但至少渲染失败卡片让用户知道）。

## 验证

### `npx tsc --noEmit`
通过，无输出。

### `npx vitest run`
```
Test Files  13 passed (13)
     Tests  74 passed (74)  — 原 61 + 新增 13
```

新增/修改的 13 个测试细分：
- `assert-course-access.test.ts`: 5（新）
- `course-analytics-partition.test.ts`: 4（新）
- `schedule-announcement.service.test.ts`: 3→7（+4：classId+teacherId 合并、courseId only、teacherId 单分支、无 filter）

### `npm run build`
通过。

### Acceptance 对齐

- [x] `assertCourseAccess` 全仓 grep 只在 `lib/auth/course-access.ts` 有实现，其他地方 import（`guards.ts` re-export + 2 route 文件 import）
- [x] `schedule.service` 两分支独立（不同 where clause，AND 合并；代码 diff 可读）
- [x] 老师 GET `/api/lms/announcements` 无 courseId 时走 `teacherCourseFilter`（测试覆盖）
- [x] CourseAnalyticsTab 子 fetch 隔离失败（`allSettled` + 红色卡片）
- [x] tsc + vitest + build 全过
- [x] 新增 13 测试，≥3 的要求达成

## 不确定 / 待确认

### 行为变化给 QA 提示
- 老师公告范围变窄：admin 不受影响；老师侧 `/teacher/announcements` 页面在没给 courseId 时返回列表变小（只自己课）。这是 spec 明示的预期。QA 真登录 teacher1 验证时，应对照 seed 里 teacher1 的课（而不是系统全部课）。

### Prisma WhereInput 类型
`schedule.service.ts` 和 `announcement.service.ts` 新增了 `Prisma.CourseWhereInput[]` 和 `Prisma.ScheduleSlotWhereInput` / `Prisma.AnnouncementWhereInput` 的 type annotation。tsc 通过说明 Prisma client 已 generate 到位（此 Phase 没动 schema，本应如此）。

### CourseAnalyticsTab 视觉
失败卡片用 `border-destructive/30 bg-destructive/5` — 走 shadcn destructive token，不引入新颜色。QA 若真浏览器能触发一次失败（需要 dev server + 人为 403/500 某个 submission），应能看到红边 + AlertCircle icon。否则测试覆盖足够。

## Dev server 重启

本 Phase 不改 schema，Prisma 三步不涉及。纯 TS/TSX 改动，dev server HMR 可以吃下。

## 文件 diff 规模

- `lib/auth/course-access.ts`（新）: +22 行
- `lib/auth/guards.ts`: +1 行（re-export）
- `app/api/lms/courses/[id]/route.ts`: -11 / +1（净-10）
- `app/api/lms/courses/[id]/classes/route.ts`: -14 / +1（净-13）
- `lib/services/schedule.service.ts`: -15 / +28（净+13）
- `lib/services/announcement.service.ts`: -9 / +28（净+19）
- `app/api/lms/announcements/route.ts`: -4 / +12（净+8）
- `components/course/course-analytics-tab.tsx`: -8 / +50（净+42）
- tests: +~200 行

代码 diff（非测试）合计约 90 行净增，测试 ~200 行。spec 预算 ~300 行，合理范围内。
