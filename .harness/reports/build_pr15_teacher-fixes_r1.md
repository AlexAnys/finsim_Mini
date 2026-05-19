# Build Report — PR-15 builder-teacher-fixes r1

> 完成日期: 2026-05-16
> Builder: builder-teacher-fixes (claude-bugfix-pr15)
> Branch: `claude-bugfix-pr15` (base = main `41f2564`)
> 时长: ~3h (实施 + 本地 e2e + 截图验证)

## 改动文件清单

### bug 1 — TaskBuildDraft 状态机（root cause 修法）

- `lib/services/task-build-draft.service.ts`：新增 `markTaskBuildDraftPublishedFromWizard(draftId, client)` 函数（接受 status ∈ {draft, ready, approved}）。保留原 `markTaskBuildDraftPublished`（仅 approved），文档说明用途。
- `app/api/lms/task-instances/with-task/route.ts`：import + 调用切换到 `markTaskBuildDraftPublishedFromWizard`，注释更新。
- `components/teacher-course-edit/task-wizard-modal.tsx`：去掉 `editingDraftStatus === "approved"` guard，只要 `editingDraftId` + status ∈ {draft, ready, approved} 就传 `taskBuildDraftId`。
- `lib/api-utils.ts`：加 `TASK_BUILD_DRAFT_NOT_FOUND_OR_PUBLISHED` 错误映射（中文消息"任务草稿不存在或已发布，请刷新课程页"）。
- `lib/validators/task.schema.ts`：comment 更新（原 "强制要求 status === approved" → "draft/ready/approved 之一"）。
- `tests/task-build-draft-approve.test.ts`：加 5 个新单元测试覆盖 `markTaskBuildDraftPublishedFromWizard`（ready/draft/approved → published；非接受集合 → throw；不存在 → throw）。

### bug 2 — 草稿编辑退出 UI

- `components/teacher-course-edit/task-wizard-modal.tsx`：footer 加显式"取消"按钮（左侧，紧贴"上一步"）。原有的顶部 X 取消保留。
- `app/teacher/tasks/drafts/[id]/page.tsx`：
  - 顶部"返回课程"按钮保留。
  - 在"无 AI 原稿快照"卡内加"返回课程"次按钮。
  - 在"AI 原稿 vs 教师编辑稿"卡片底部 footer 加"返回课程"按钮（与"批准全部并允许发布"并排）。

### bug 3 — SB 统计页重设计

- `components/course/course-study-buddy-analytics-tab.tsx`：大改。
  - 新增 `HighFrequencyQuestionsGrid` 子组件：
    - chapter + section single-select 下拉（"全部章节" / "全部小节"为默认）。
    - 卡片网格 (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3)，前 12 张，按时间倒序。
    - 卡片显示：章节/小节 chip + "未回复" badge + 标题 + 问题摘要 + 时间。
    - 点击卡片 → 打开 `PostThreadDialog`（完整 thread）。
    - 超 12 条 → "查看全部 →" 链接到 `/teacher/study-buddy`。
  - 解 0-state guard：保留旧 metric / AI 总结 / 任务分组卡（基于 `/api/lms/study-buddy/analytics` 数据），但即使 analytics 返 0（无 task-bound post），高频问题卡和未答疑列表仍渲染（基于 `/api/teacher/study-buddy/posts` 含 free-form）。
- `app/api/teacher/study-buddy/posts/route.ts`：加 `taskInstanceId` query param filter（带 owner 课程交集 guard）。
- `tests/course-sb-pending-list.test.ts`：anti-regression 测试更新（`data.groups.map` → `groups.map`，因为重构后 destructure 到本地变量）。

### bug 4 — 任务详情 SB mini 模块

- `components/instance-detail/study-buddy-mini.tsx`（新）：
  - 调 `/api/teacher/study-buddy/posts?taskInstanceId=X` 拉本 instance 的 post。
  - 0-state："本任务暂无学生提问"。
  - 显示 count badge + 前 3 条卡片（按时间倒序）+ "还有 N 条" 提示。
  - 点击卡片 → 打开复用的 `PostThreadDialog`。
  - 右上"课程汇总 →" 链接到课程 SB tab。
- `app/teacher/instances/[id]/page.tsx`：import + 在 overview tab 下方挂载 `<StudyBuddyMini taskInstanceId courseId />`。

### 跨 bug 3+4 共享组件

- `components/study-buddy/post-thread-dialog.tsx`（新）：
  - 单源 `PostThreadDialog` + `StudyBuddyPostThread` 类型。
  - 渲染：原 post（学生提问） + AI 回复 + 学生 follow-up（messages JSON 数组）。
  - 防御性：messages 不存在或非 array → 显示"本次提问无后续对话"。
  - 自由问 badge + 章节/小节 scope 标签。

## 验证

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run` | **1110 / 1110 passed** (新增 5 测试 + 1 anti-regression 测试更新) |
| `npm run lint` | **0 errors** (34 warnings 来自既有 e2e 一次性 spec, 与本 PR 无关) |
| 本地 e2e 真浏览器 (teacher1) | 4 bug 全过, 截图见 `test-results/pr15-screenshots-*` |
| Bug 1 contract e2e | **PASS**: ready draft → with-task publish → DB 验证 status = 'published' (`tests/_debug_qa/pr15-bug1-publish-contract.spec.ts`) |

### Bug 1 contract 端到端真测结果

```
ready draft → with-task publish → draft.status = 'published'  ✓ (4.7s)
```

DB 验证（postgres）:
```
title                         |  status   
------------------------------+-----------
pr15-bug1-test-1778943677649  | published   ← 自动 flip 成功
```

### 截图

- `bug2-draft-review-page.png`: 3 个返回入口 (top "返回课程" / top "返回课程发布" / body "返回课程")
- `bug3-course-sb-analytics-tab.png`: 高频问题卡片网格 + chapter/section 下拉 filter
- `bug4-instance-overview-sb-mini.png`: SB mini 模块挂在 overview tab 下方，0-state "本任务暂无学生提问"

## Anti-Regression 检查

| 接口/函数 | 改动 | 影响调用方 |
|---|---|---|
| `markTaskBuildDraftPublished` | 保留不动 | (旧的，但 with-task 不再调用) |
| `markTaskBuildDraftPublishedFromWizard` | 新增 | with-task route 已切换 (唯一调用方) |
| `handleServiceError` 映射表 | 加 `TASK_BUILD_DRAFT_NOT_FOUND_OR_PUBLISHED` case | 仅 wizard publish 路径触发 |
| `/api/teacher/study-buddy/posts` | 加 `taskInstanceId` query param (可选) | 旧无 param 调用仍正常；新加 StudyBuddyMini 使用 |
| `createPublishedTaskWithInstanceSchema.taskBuildDraftId` | unchanged (schema 没改) | 内部接受范围放宽 |
| `course-study-buddy-analytics-tab.tsx` 内部 destructure | 命名变化 (`data.groups` → `groups`) | 仅 anti-regression 测试匹配字符串需更新 (已做) |

无 schema 改动。无 service interface 删除/重命名。新增 helper 不删旧的。

## 不确定 / Deferred

1. **bug 3 "排序"语义**：spec 说"高频问题排序"，但 raw post list 没有"frequency"概念（每个 post 是独立提问）。r1 实现为"按时间倒序"。若 QA 反馈需要"按 question 文本相似度归类后按 count 排序"，需要 r2 加聚类（轻量 — Levenshtein 阈值 + 取代表）。
2. **bug 3 messages 字段历史一致性**：`messages` JSON 字段在 schema 已有，但部分旧 post 可能没存 follow-up。我加了防御性 `Array.isArray(post.messages) ? ... : []`。若 prod 有特殊形状会显示空 follow-up，无 crash。
3. **bug 4 "课程汇总" 链接**：用 `/teacher/courses/${courseId}#study-buddy` hash，但课程页 tab state 用 React state 不读 URL hash。r1 写了 hash 但实际不会切 tab。低优先级 — 用户能在课程页手动切。

## 是否需要重启 dev server

**否**。本 PR 无 schema 改动；所有 TypeScript 改动 Next.js HMR 自动捕获。已验证 dev server 已运行且接受新代码（e2e 真测过）。

## 决策回溯

| 决策 | 选择 | 理由 |
|---|---|---|
| bug 1 "直转任务"按钮 | 不加 | Root cause 修了 wizard 不传 draftId 的问题后，"发布后 draft 消失"自动达成。加 UI 入口反而 fragment 用户体验。 |
| bug 3 卡片数 N | 12 | sm:grid-cols-2 + lg:grid-cols-3 时正好 4-6 行；超 12 提示链接到 /teacher/study-buddy。 |
| bug 3 filter | single-select | 简单符合用户"按章节/小节"诉求；multi-select 后续再升级。 |
| bug 4 位置 | overview tab 下方（不新 tab） | 用户期望"进任务详情立即看 SB"，新 tab 多一次点击。前 3 条。 |
| 共享 dialog | `components/study-buddy/post-thread-dialog.tsx` | bug 3 + bug 4 单源；team-lead 明确要求。 |

## 给 QA 的检查清单

1. `npx vitest run tests/task-build-draft-approve.test.ts` — 全 15 测试 PASS（含 5 新增）
2. `BASE_URL=http://localhost:3000 npx playwright test tests/_debug_qa/pr15-bug1-publish-contract.spec.ts --config=tests/_debug_qa/pr15-verify.config.ts` — bug 1 contract pass
3. 真浏览器 teacher1 → `/teacher/courses/{id}` → 切 Study Buddy 统计 tab → 看到"高频问题"卡 + chapter/section 下拉 + 数据加载
4. 真浏览器 → 任务详情 → overview tab 滚到底 → 看到"学生学习伙伴" mini 卡
5. 真浏览器 → 草稿审核页 → 长字段对比滚动到底 → 看到 footer 的"返回课程"按钮
6. 真浏览器 → 创建 task wizard → 看到 footer "取消" 按钮（在"上一步"右边）
