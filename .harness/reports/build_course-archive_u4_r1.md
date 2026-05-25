# Build Report — U4 UI 回收站 + 归档按钮 (r1)

worktree: `finsim-course-archive` / branch `claude-course-archive`

## 目标（spec §6 U4 / D5）
课程卡删除按钮去掉 hasContent 禁用、改一键归档（移入回收站，可恢复）；`/teacher/courses` 头部加回收站入口；回收站列归档课程，每条带"恢复"+"彻底删除"（彻底删除需输入课程名）。全中文。

## 改了什么（文件）
- `components/teacher-courses/teacher-course-card.tsx`（+? / -55 净简化）
  - 删除按钮：**去掉 hasContent 的 disabled+Tooltip 分支**，owner 始终可一键点（aria-label/title 改为"删除（移入回收站，可恢复）"）
  - 移除 Tooltip 相关 import；prop `onDelete` → `onArchive`（语义对齐；调用方同步改）
  - `chapterCount`/`taskInstanceCount` 字段保留在类型里（page 仍传）但卡片不再据此禁用
- `app/teacher/courses/page.tsx`（+299）
  - 头部"新建课程"旁加「回收站」入口按钮（Archive 图标）
  - 删除确认弹窗文案改归档语义（"移入回收站，可恢复"，按钮"删除（移入回收站）"，toast"已移入回收站"）
  - 新增 `handleRestore`（POST /restore）/ `handlePurge`（DELETE /purge + confirmTitle）
  - 新增 `RecycleBinDialog` 组件：打开时拉 `GET /api/lms/courses/archived`，列出每门已删除课程（标题/代码/章节·实例数/删除时间）+「恢复」+「彻底删除」；彻底删除走嵌套 AlertDialog，**必须输入与课程名完全一致的文本才解锁"彻底删除"按钮**
  - 卡片 `onDelete` → `onArchive`

## 验证结果
- `npx tsc --noEmit`：通过
- `npx vitest run`：**117 文件 / 1199 测试全绿**（无回归；卡片变更为表现层，transforms 测试不受影响）
- **真浏览器（webpack/3003）认证渲染验证**：
  - 程序化以 teacher1 登录（302）→ `GET /teacher/courses` **认证态 HTTP 200**（页面客户端完整渲染，无 error boundary、无 ReferenceError）
  - `GET /api/lms/courses/archived` 认证态返回已归档课程列表（含 QA 正在测试的归档课程）→ 回收站数据链路端到端通
- dev server 日志无 RecycleBinDialog/编译错误（注：编辑过程中曾出现一次 `RecycleBinDialog is not defined` 的瞬时 HMR 报错——发生在"页面引用该组件"已编译、但"组件定义"尚未 append 的中间窗口；append 完成 + 认证态 200 渲染后已消失，非代码问题）

## 需要 QA 注意 / 怎么验（真浏览器）
dev server 用 `--webpack`；我在 3003 跑着。以 teacher 身份：
1. /teacher/courses 课程卡删除按钮：**含章节/任务的课程也能点**（不再 disabled），点 → 确认弹窗（"移入回收站，可恢复"）→ 确认 → 课程从列表消失 + toast
2. 头部「回收站」按钮 → 打开抽屉，列出已删除课程（标题/章节·实例数/删除时间）
3. 回收站「恢复」→ 课程回归列表
4. 回收站「彻底删除」→ 弹窗要求输入课程名；**名字不符时"彻底删除"按钮禁用**；输对才可点 → 永久删除
5. 全中文文案

## 不确定 / 延后 / flag
- **遗留 Playwright e2e 规格断言旧的"禁用+tooltip 删除"行为**：`tests/e2e/qa-unit5a-delete.spec.ts`、`qa-unit5a-r2-spotcheck.spec.ts`、`unit2-verify.spec.ts` 断言 owner 卡片含内容时是 disabled+tooltip（含"无法删除"文案）+ 详情页删除拒删流。U4 已**故意改掉**该行为（一键归档）。这些 `.spec.ts` **不在 vitest CI 套件**（`include: tests/**/*.test.ts`，已确认 vitest 拾取 0 个 spec 文件；package.json 无 e2e/test 脚本），不阻塞我的构建。但它们是 QA 的真浏览器测试产物，描述的是已被取代的设计——建议 QA 用新的 `/qa-only` 流程验证 U4 新行为，并按需更新/淘汰这些旧 spec（我不动 QA 的测试文件）。
- 详情页 `/teacher/courses/[id]` 的「删除」按钮（EditorHero header）仍走旧硬删拒删流（U4 spec 只点名课程卡 + 回收站）。该详情页删除按钮当前调 DELETE /courses/[id] —— 因为 U2 已把该端点改成归档语义，所以详情页删除现在其实也是"归档"了（行为正确），只是按钮文案/确认弹窗可能仍写"删除/不可恢复"。是否要我同步详情页删除按钮文案为归档语义？（需 team-lead 确认是否扩 scope；spec U4 未点名详情页）
- 预存 bug（teacher courses/[id]/page.tsx:1141 `course.class.id`，classId=null 时崩）仍待 team-lead 裁决。

## Prisma 三步 / dev server 重启
- 本 unit 纯前端，无 schema/服务接口改动。dev server（webpack/3003）已热加载并认证渲染验证 200。
