# Build Report — U4 回收站 + 归档按钮 (r2，修 RecycleBinDialog 500 crash)

worktree: `finsim-course-archive` / branch `claude-course-archive`

## QA 报的问题（r1 后）
`/teacher/courses` 真浏览器 500：`ReferenceError: RecycleBinDialog is not defined`（page.tsx:577，组件用在前定义在后）。

## 根因（结构化排查，含 gstack /investigate 思路 + 真浏览器复现）
- r1 把 `RecycleBinDialog` 定义在 `TeacherCoursesPage` **之后**（用在 417、定义在 540），靠 JS 函数声明 hoisting 工作。tsc 通过、结构合法（同文件 `CreateCourseDialog` 也是同样的"用在前定义在后"且一直正常）。
- 我此前用 `curl` 认证态拿到 HTTP 200 误判为"没事"——**错**：`"use client"` 页面即便客户端组件崩，SSR 仍回 200 + error boundary 在浏览器端触发，curl 不跑客户端 JS 看不到。QA 真浏览器才命中。
- **真根因 = Fast Refresh（HMR）陈旧模块态**：我增量编辑时，"页面引用 RecycleBinDialog"先于"append 该函数定义"被 HMR 编译进 bundle，HMR 对"用在前定义在后"的新增组件模块边界追踪失败 → 运行时该绑定 undefined。**全新 server 编译时不复现**（已用 Playwright headless 在 fresh server 证实：无 console/page error、回收站正常渲染）。但 QA 的 dev server 持有陈旧 HMR 态 → 真崩。
- 复现/验证手段：Playwright headless（chromium 已装）认证态加载 + 驱动流程，是唯一能看到客户端崩的方式（curl 不行）。

## 修复（根因，非 workaround）
把 `RecycleBinDialog` + `interface ArchivedCourse` + `formatArchivedAt` **整体移到 `TeacherCoursesPage` 之前**（纯移动，零逻辑改动）。消除 forward-reference → HMR 模块边界不再依赖 hoisting → 该类崩溃在 HMR 或任何编译态都不再发生。这正是 team-lead 诊断的"用在前定义在后"。
- 新顺序：interface ArchivedCourse(75) → RecycleBinDialog(83) → formatArchivedAt(262) → export default TeacherCoursesPage(268)；usage 在 610。
- 注：`CreateCourseDialog` 仍在 page 之后（它一直正常，不在崩溃范围）；只移动了新增的回收站相关块以彻底规避增量-HMR 陷阱。

## 验证
- `npx tsc --noEmit`：通过
- `npx vitest run`：117 文件 / 1202 测试全绿
- **clean-restart dev server（webpack/3003）+ Playwright headless 认证态**：
  - `/teacher/courses` 加载 **console/page error = (none)**，课程网格 + 「回收站」按钮正常渲染（无 error boundary）
  - 建 throwaway 课程 → 卡片出现 → 点「回收站」→ 弹窗"已删除课程"标题 + 归档行（恢复/彻底删除按钮）渲染，**全程 error = (none)**
  - 流程后 purge 清理，throwaway leftover=0；dev log 本次 0 个 RecycleBinDialog/ReferenceError/error-boundary

## 交接 QA（按 team-lead 流程，未自标 completed）
- **请 QA 用 clean-restart 的 `next dev --webpack`（:3003，我已重启跑着）做真浏览器 U4 验**：归档→列表消失→回收站可见→恢复回归→彻底删除（输课程名）永久消失。我的 headless 已确认无 console 错 + 回收站可渲染，但 QA 真浏览器 PASS 是收 U4 的硬门槛。
- ⚠️ QA 若仍用**旧的、编辑期间一直开着的** dev server，可能仍命中陈旧 HMR 态——**务必 kill 重启**再验（这正是本次根因）。
- 避开无关预存 crash：详情页 /teacher/courses/[id] 的 classId=null 崩（page.tsx 现 ~line 引用 `course.class.id`）仍待 team-lead 裁决，验 U4 用 classId 非空课程、操作在列表卡片+回收站完成，不进详情页。

## 不确定 / 延后
- 这是结构防御性修复；若 QA clean-restart 后仍复现（不预期），我再走 gstack /investigate 深挖 bundler。
- U5 已暂停（P2，team-lead 指示），待 U4 QA PASS 后再议。

## 追加：详情页删除按钮文案修正（team-lead 裁决 #2，scope 内 correctness 修复）
U2 把 `DELETE /courses/[id]` 从硬删改为归档（可恢复）后，详情页 `/teacher/courses/[id]` 的删除确认弹窗文案仍是旧硬删语义（"此操作不可恢复" + "如果课程下有章节或任务实例，将被服务端拒绝"）——这是我们改语义后未同步 UI 的 correctness bug。已修正为与课程卡一致的归档/可恢复语义：
- `app/teacher/courses/[id]/page.tsx`（+4/-4，纯文案）：
  - 标题 "删除课程" → "删除课程（移入回收站）"
  - 描述 → "课程及其章节内容、已发布任务将从所有页面消失，但不会被销毁——可在课程管理页的'回收站'中恢复或彻底删除"
  - 确认按钮 "确认删除" → "删除（移入回收站）"
  - success toast "课程已删除" → "课程已移入回收站，可在回收站恢复"
  - EditorHero 触发按钮 "删除课程" 保持不变（中性，打开确认弹窗，可逆语义在弹窗解释）
- 验证：tsc 过；vitest 117文件/1202全绿；**Playwright headless 认证态**（用 classId 非空课程"个人理财规划"，避开无关 :1141 崩）：详情页加载 error=(none)，点"删除课程"→弹窗显示新文案（标题/描述/按钮全为归档语义），全程 error=(none)。
