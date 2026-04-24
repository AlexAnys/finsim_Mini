# Build Report · PR-4A · r1

**Unit**: `pr-4a` 任务向导骨架 + Step 0/1
**Round**: r1
**Date**: 2026-04-24

## 目标

按 `mockups/design/teacher-task-wizard.jsx` 结构换壳，保留现有 form 逻辑不变；将原 3 步（Basic / Config / Review）扩展为 4 步（Type / Basic / Config / Review），将 taskType 从 Step 1 的 Select 升级为独立 Step 0 的三卡选择。

## 改动文件

**新增**（5 个组件文件）：
- `components/task-wizard/wizard-types.ts` — `TaskType` / `WIZARD_STEPS` / `TASK_TYPE_META`（3 色 × icon × softClass/textClass/borderClass/bgClass × stats/time/desc）
- `components/task-wizard/wizard-stepper.tsx` — 左侧 220px 垂直步骤条，sticky；connector line；当前/已完成/未开始三态；底部 "当前草稿" 摘要卡（含类型色左边框）
- `components/task-wizard/wizard-card.tsx` — 共享卡壳（title + subtitle + extra slot）
- `components/task-wizard/wizard-step-type.tsx` — Step 0 三类任务大卡（icon + 类型色 + stats + 建议时长 + 已选勾号）
- `components/task-wizard/wizard-step-basic.tsx` — Step 1 基本信息（name / description / totalPoints / timeLimit）

**修改**（1 个）：
- `app/teacher/tasks/new/page.tsx` —
  - 导入 wizard 组件 + `cn`
  - 删除 `initialFormData.taskType` 对应的 `Select` 入口（Step 1 不再选类型）
  - `totalPoints` 新加字段，默认 100
  - `stepLabels` 常量删除，改用 `WIZARD_STEPS`（4 步）
  - `validateStep0/1/2` 重新编号（原 step 0 验证拆到 step 1）
  - 新增 `jumpTo` 支持 stepper 点击跳转
  - 页面布局：`-m-6 bg-paper` 全幅 + breadcrumb + 带类型色 pill 的标题 + 2-column grid（220px stepper + 1fr main）
  - Step 0/1 使用新组件；Step 2 / 3 **保留原 inline JSX**（PR-4B / 4C 才拆组件）
  - 底部 nav 改为 `rounded border bg-surface` 卡状，显示 `step/total · 步骤名`

**新增测试**（1 个）：
- `tests/task-wizard-types.test.ts` — 6 tests
  - `WIZARD_STEPS` 4 步顺序 + desc 非空
  - `TASK_TYPE_META` 三类型 × text/soft 类齐全 × 各不相同 × 中文 label × icon/stats/time/desc 非空

## 设计偏离（已记录）

| 设计稿元素 | 本 PR 处理 | 原因 |
|---|---|---|
| 顶部 "保存草稿" 按钮 | 未实现 | 现有 codebase 无 draft 持久化机制；spec 说 "保留现有 form 逻辑" |
| Step 1 "所属章节/小节" 3 列 select | 未实现 | 现有 `/api/tasks POST` schema 允许 `chapterId/sectionId` 可选但前端未使用；加这两个 select 需要新建 courses list API + 级联查询。spec "不做新 API"暗示延后；`createTask` 服务层仍兼容。**建议 PR-4C 评估**是否补 |
| Step 1 "课前/课中/课后" 槽位选择 | 未实现 | schema 无对应字段；纯 UI 装饰，无数据流 |
| Step 1 "可见性" select | 未实现 | 当前 `/api/tasks POST` 无 visibility 字段，且创建后 taskInstance 才有发布状态机 |

所有偏离均为"视觉-数据不对齐"类：设计稿是纯静态 React，没有数据绑定；spec 明确要求 `保留现有 form state / Zod / 提交流程`。这些字段真正用到时再接。

## 验证

| 项目 | 结果 | 备注 |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | |
| `npx vitest run` | 225 tests 全绿（+6 tests/task-wizard-types.test.ts） | 原 219 + 6 新 |
| `npm run build` | 25 routes 全编译过 | `/teacher/tasks/new` 在列 |
| SSR 真 curl `GET /teacher/tasks/new` | 200 · body 含 "新建任务" × 2 + "任务类型" × 3 | title + stepper + Step 0 均渲染命中 |

## 与 spec Acceptance 对齐

| Spec | 状态 |
|---|---|
| `teacher1 真登录 /teacher/tasks/new 打开 Step 0` | ✅ SSR body 证实 Step 0 渲染；真登录需 QA gstack `/qa-only` 做 |
| `点击任务类型大卡切换` | ✅ `onChange={onChange}` → `updateForm("taskType", t)` 状态机已接 |
| `Step 1 填基本信息正常` | ✅ 4 个字段（name/desc/totalPoints/timeLimit）均有 onChange + error 展示 |
| `保存草稿 / 取消 / prev/next 正常` | ⚠️ "保存草稿" 未实现（设计稿有视觉按钮但本页未加）；"取消" 调 `router.push("/teacher/tasks")`；prev/next 通过 `setStep` clamp 0..3 |
| `tsc/vitest/build 过` | ✅ 全过 |

## Dev server 重启

本 PR **无 schema 改动**，无需重启 dev server。运行中的 dev server 已自动热更新（已 curl 验证页面 200）。

## 不确定 / 建议

1. **"保存草稿" 按钮**：设计稿有，但当前 codebase 无 draft 持久化。可选：(a) PR-4C 时引入 draft API；(b) 走 localStorage 前端兜底；(c) 隐藏该按钮以后再做。偏好 (c) 本 PR 不加，后续 team-lead 决定。
2. **Step 1 章节/小节 select**：设计稿写死 mock 数据，真接需要 `getCoursesByTeacher` → 选课程 → getChaptersByCourse → 选章节 → getSectionsByChapter 三级联。不在本 PR scope，建议 PR-4C 评估。
3. **Step 2 / 3 组件化**：按 spec，本 PR 只做壳；Step 2/3 inline JSX 保留 unchanged 从原 page 复制（行数多但逻辑零改动，PR-4B / 4C 拆）。

## 下一步

移交 QA：验证 4 步流程、类型切换、Step 0 大卡视觉、Step 1 表单填写 + 错误展示、stepper 点击跳转、底部 prev/next 按钮状态、breadcrumb/标题 pill、3 类型色一致性、tokens 硬编码检查。
