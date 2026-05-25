# Build Report — U5 写路径守卫（P2 加固，r1）

worktree: `finsim-course-archive` / branch `claude-course-archive`

## 目标（spec §3 F4 / §6 U5）
向已归档课程**新建实例 / 发布任务 / AI 起草**应被拒（应先在回收站恢复）。P2，不阻塞核心。

## 改了什么（文件）
- `lib/auth/course-access.ts`：新增 `assertCourseNotArchived(courseId)` —— 课程不存在 → COURSE_NOT_FOUND；`deletedAt` 非空 → COURSE_ARCHIVED。与角色无关（即便 admin 也应先恢复再写）
- `lib/api-utils.ts`：加 `COURSE_ARCHIVED` → 409 中文（"该课程已删除（在回收站中），请先恢复后再操作"）
- 3 个写路径（spec 点名的"新建实例/发布任务/AI 起草"）在已有 `assertCourseAccess` 之后追加 `assertCourseNotArchived`：
  - `app/api/lms/task-instances/route.ts` POST（新建实例，`if (data.courseId)` 块内）
  - `app/api/lms/task-instances/with-task/route.ts` POST（原子 publish 任务+实例）
  - `app/api/lms/task-build-drafts/route.ts` POST（AI 起草 createTaskBuildDraft；GET 列表路径不加，owner 恢复语境下只读列草稿可接受）
- `tests/course-archive-guards.test.ts`（+3 F4 测试）：归档→COURSE_ARCHIVED / 正常→通过 / 不存在→COURSE_NOT_FOUND
- `tests/api/tasks.api.test.ts` + `tests/api/task-build-drafts.api.test.ts`：course-access mock 补 `assertCourseNotArchived: vi.fn()`（路由新增依赖该 export，mock 必须同步——否则 undefined() → 500）
- `scripts/verify-f4-guard.ts`（新）：F4 真 DB 集成证明

## TDD / 测试
- F4 守卫：先写 3 个失败测试（归档/正常/不存在）→ 实现 assertCourseNotArchived → GREEN
- 路由 mock 同步：加 export 后 2 个既有 API happy-path 测试因 mock 缺 export 报 500（undefined 调用），补 mock export 后恢复——这是"加 export 须同步 mock"的正确修复，非迁就实现

## 验证结果
- `npx tsc --noEmit`：通过
- `npx vitest run`：**117 文件 / 1202 测试全绿**（无回归）
- **F4 真 DB 集成证明**（`scripts/verify-f4-guard.ts`，PASS）：归档前 assertCourseNotArchived 不抛、归档后抛 COURSE_ARCHIVED；throwaway 自清（leftover=0）
- **真浏览器认证态端到端**（webpack/3003，teacher1 登录）：
  - 建 throwaway 课程 → 归档（DELETE /courses/[id] → 200）→ POST 实例到该归档课程 → **409 `COURSE_ARCHIVED`**（中文 message 正确）→ 整条链路 route→guard→handleServiceError→409 验证
  - 顺带验证了 purge 路由：`DELETE /courses/[id]/purge` + confirmTitle → `{purged:true,...}` 200，课程消失（U2 端到端 bonus）
  - 3 个守卫路由未登录探测均 401（编译通过、不 500）

## 需要 QA 注意 / 怎么验
dev server 用 `--webpack`；我在 3003 跑着。以 teacher：归档一门课 → 尝试给它新建任务实例 / 原子发布任务 / 发起 AI 起草 → 应全部被拒（409 COURSE_ARCHIVED，中文提示"请先恢复"）。恢复后这些操作恢复正常。

## 不确定 / 延后 / flag
- **范围克制（anti-regression rule 9）**：F4 只加在 spec 点名的 3 个写路径。其他触 courseId 的写端（chapters/sections/content-blocks/announcements 创建等）**未加**归档闸——它们都靠 `assertCourseAccess`（owner 守卫）保护，且归档课程已从所有列表移除、owner 正常导航进不去（只能从回收站，回收站不提供这些写操作入口）。若 QA 认为某写端仍能对已归档课程写入（如直链 API），告诉我再补 assertCourseNotArchived（一行）。
- AI 生成端 `app/api/ai/task-draft` 不直接收 courseId（操作既有 draftId），未加闸；"AI 起草"的课程入口在 task-build-drafts POST（已加）。
- 这是最后一个 unit（U5，P2）。U1-U5 全部完成、自测全绿。等 QA 验证 + team-lead 汇总。

## Prisma 三步 / dev server 重启
- 本 unit 无 schema 改动。dev server（webpack/3003）已热加载 3 个守卫路由并认证态端到端验证 409。
