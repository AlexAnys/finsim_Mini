# Plan — PR-15 builder-teacher-fixes r1

> Builder: builder-teacher-fixes (claude-bugfix-pr15)
> Branch: `claude-bugfix-pr15` (base = main `41f2564`)
> Scope: bug 1/2/3/4 from `.harness/spec.md`
> 估时: 3-5h

## Root-cause 分析

### bug 1 — TaskBuildDraft 状态机

**真因**（深挖代码后定位）：`components/teacher-course-edit/task-wizard-modal.tsx:1083-1086`：

```
...(editingDraftId && editingDraftStatus === "approved"
  ? { taskBuildDraftId: editingDraftId }
  : {}),
```

只有 status === "approved" 才传 `taskBuildDraftId` 到 with-task。结果：

- 用户从 inline-section-row 点开 status="ready" / "draft" 的 draft（最常见路径，因为 row 上的"审核"链接才走 approve 流程；点 draft 卡片正文走 wizard）→ 走 wizard 改完 → 点"创建并发布" → with-task 不传 draftId → **published task 创建成功但 draft 没标记 published → draft 还在 inline 列表**（filter 没排除 ready/draft）。

- 还有路径：手工创建任务（无 draft）— 不受影响。

**辅证**：`lib/services/course.service.ts:233` 当前 filter `["draft","queued","processing","ready","failed"]`。published 和 approved 已经被排除。问题是 draft 没"自然"过渡到 published。

**修法**：

1. wizard 中，无论 draft.status 是 draft/ready/approved，只要 editingDraftId 存在就传 taskBuildDraftId 给 with-task（route 已经会做 status flip + 验证）。
2. 但 with-task route 的 `markTaskBuildDraftPublished` 要求 status === "approved"。需要放宽：从 wizard 直接发布的 draft 不强制 approved。
   - 方案：新增一个 `forcePublish` 路径或者修改 `markTaskBuildDraftPublished` 接受 `status IN ('draft','ready','approved')`。
   - **更安全**：只放宽 `ready` + `approved`（不放宽 draft，draft 通常代表 missing fields）。
3. 同时 Service interface 反向：原 `markTaskBuildDraftPublished` 抛 `TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH` 是关键 invariant（PR #12 Unit 10 的原子性 guard）。**保留原 helper 不动**，新增 `markTaskBuildDraftPublishedFromWizard`（用 `status IN ('draft','ready','approved')`）。仅 wizard 路径使用。

**关于"直转任务"按钮**：spec 决策点 #1。**我的建议**：不加新按钮。理由：
- 当前 "approved" 状态在 inline 列表已经被过滤掉了，user 接下来的 "publish" 必经 wizard（无 approved 的 button entry point）。
- 加 "直转" 按钮会让 UX 多分支（已有 wizard 的"创建并发布"），增加用户记忆负担。
- 真正的 bug 是 wizard 发布后 draft 没消失（上面的 root cause），修了就够。
- 如果 coord 仍坚持 "直转" 入口，建议加在 inline-row 中 status="ready" 的 draft 卡上加一个"直接发布"快捷键，跳过 wizard 改字段 — 但需要 wizard 已经把 draftPayload.form 完整序列化为 with-task 的 `task` + `instance` payload。这块比较脏，r1 不做，r2 再说。

### bug 2 — 草稿编辑退出 UI

**当前状态**：
- wizard modal 右上角已经有 `<X /> 取消` 按钮（task-wizard-modal.tsx:1176-1185），Esc/点遮罩也会触发 handleClose（onOpenChange）。
- draft 审核页 `/teacher/tasks/drafts/[id]` 已经有 `<ArrowLeft /> 返回课程` 按钮（顶部）。

**用户痛点猜测**：modal 中长内容滚动后取消按钮被顶到屏幕外（顶部固定但 body 滚动了它会跟着滚）；或 modal 内嵌的 step content 没有 sticky footer。

**修法**（保守）：
- task-wizard-modal.tsx：把"取消"按钮在 modal 顶部 header 改成 sticky（已经是 dialog flex 布局了，header 不会滚出，验证 DOM 实际滚动行为后再决定要不要加 sticky class）。
- task-wizard-modal.tsx：在 modal 底部 footer（已有 prev/next 按钮）追加显式"取消并退出"按钮（关闭+丢弃未保存改动；如果有未保存改动加 confirm dialog）。
- draft 审核页：在底部"批准全部"卡片下面加"返回课程"次按钮（重复顶部入口，防止滚很多 field 后用户找不到）。

### bug 3 — SB 统计页重设计 (scope 最大)

**现状**：components/course/course-study-buddy-analytics-tab.tsx 是 task 分组卡（一张大卡列出多个问题片段），不符合"问题卡片网格"。filter 也没有。

**重设计**：
- 顶部 3 个 metric 卡保留（学生提问 / 未回复 / 参与学生）。
- AI 总结卡保留。
- **新主区**：高频问题卡片网格 (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3，前 N=12 张)。每张卡显示：
  - 问题摘要（title 截断 2 行）
  - 章节/小节 chip
  - 提问次数 + 创建时间
  - 点击 → Dialog 显示完整 thread：
    - 原 post（学生提问 + 是否匿名）
    - AI 回复（aiReply 字段）
    - 学生 follow-up（post.messages JSON 数组）
- **filter 区**：顶部 filter bar（章节 single-select dropdown + 小节 single-select dropdown，"全部" 选项）。Single-select 简单，符合用户"按章/节"诉求。
- 旧的"按 task 分组" 列表移到次要位置（折叠卡，默认展开），不删；底部"未答疑列表"保留。

**数据**：
- 主区需要 raw post list（含 messages）→ 复用 `/api/teacher/study-buddy/posts?courseId=X&scope=all` 已存在，include `messages` 默认拿到，但当前 endpoint 没返回 messages 字段。需要：
  - **小改 endpoint**：在 select / include 中加 messages（schema 已有 `messages Json?`）。
  - 排序：count desc — 但 raw list 是 per-post，要前端按 (question 字段) 聚合，再排序。先简单按"按 question 文本归一化作为 key"分组（保留原 post.id 数组），再排序。
- chapter/section filter：前端基于 post.taskInstance.chapter / section 做。
- 自由问（无 task）：归"自由问"伪 section。

### bug 4 — 任务详情 SB mini 模块

**位置决策**（spec 决策点 #3）：
- **加到 overview tab**（不开新 tab）。理由：用户期望"任务详情打开就看到这个任务的提问情况"，新增 tab 多一次点击。Overview tab 已有 OverviewTab + TaskConfigSummary 卡片，挂在 OverviewTab 下方或同级 Card。
- **显示前 3 条**：和 spec.md 一致（"显示: count + 前 3 条 (或 '本任务暂无提问')"）。
- 点击单个 post → 复用 bug 3 的 thread dialog 组件。

**数据**：复用 `/api/teacher/study-buddy/posts?taskInstanceId=X`。但当前 endpoint 不支持 taskInstanceId filter，需要加 query param。

## 文件清单

### bug 1（最小 diff）

| 文件 | 改动 |
|---|---|
| `lib/services/task-build-draft.service.ts` | 加 `markTaskBuildDraftPublishedFromWizard(draftId, client)` 函数：`where: { id, status: { in: ['draft', 'ready', 'approved'] } }`。失败抛 `TASK_BUILD_DRAFT_NOT_FOUND_OR_PUBLISHED` |
| `app/api/lms/task-instances/with-task/route.ts` | 改 `markTaskBuildDraftPublished` 调用为 `markTaskBuildDraftPublishedFromWizard`（保留原 helper 供其他路径用，但 with-task 是当前唯一调用方，所以等价于改 with-task） |
| `components/teacher-course-edit/task-wizard-modal.tsx` | 去掉 `editingDraftStatus === "approved"` 守，改为只要 `editingDraftId` 就传 `taskBuildDraftId` |
| `lib/api-utils.ts` | 加 `TASK_BUILD_DRAFT_NOT_FOUND_OR_PUBLISHED` 错误映射（中文消息） |
| `tests/task-build-draft-approve.test.ts` | 加测试覆盖新 helper：ready→published OK，draft→published OK，已 published 抛 |

### bug 2

| 文件 | 改动 |
|---|---|
| `components/teacher-course-edit/task-wizard-modal.tsx` | 在底部 footer 加显式"取消并退出"次按钮；如果 dirty 加 confirm 弹窗 |
| `app/teacher/tasks/drafts/[id]/page.tsx` | 在 CardContent 底部加"返回课程"按钮（重复顶部入口，便于滚动后看到） |

### bug 3

| 文件 | 改动 |
|---|---|
| `components/course/course-study-buddy-analytics-tab.tsx` | **大改**：加 filter bar (chapter/section dropdowns)、高频问题卡片网格（前 12）、点击 Dialog 显示完整 thread |
| `app/api/teacher/study-buddy/posts/route.ts` | select/include 加 `messages` 字段 |
| 新建 `components/course/study-buddy-thread-dialog.tsx` | 抽出 thread 渲染 Dialog（bug 4 复用） |

### bug 4

| 文件 | 改动 |
|---|---|
| `app/api/teacher/study-buddy/posts/route.ts` | 加 `taskInstanceId` filter param |
| `components/instance-detail/overview-tab.tsx` | 加 SB mini 模块卡（count + 前 3 + 0-state + "查看全部"链接） |
| 复用 `components/course/study-buddy-thread-dialog.tsx` | bug 3 的 dialog |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| wizard 改 publish flow 破坏其他 draft 状态机用例 | r1 只放宽 (draft/ready/approved)；保留原 helper + tests 不动 |
| messages JSON 字段历史可能不一致（旧数据） | 防御性：messages 不存在或非 array 时降级显示"无后续讨论" |
| SB analytics 重设计 ≥ 300 行 | 抽 thread dialog 子组件，主文件 < 400 行 |
| chapter/section filter 与自由问的兼容 | "全部章节"选项即不 filter；自由问归"自由问"伪 chapter；filter 选具体章节时排除自由问 |
| 移动端 SB 卡片网格 < md 视口 | grid-cols-1 base, sm:grid-cols-2, lg:grid-cols-3 — 单列垂直 |
| with-task route 改 publish 时其他场景（手工创建无 draft）回归 | 改动只在 `if (data.taskBuildDraftId)` 分支内；手工路径不动 |
| Anti-Regression: `markTaskBuildDraftPublished` 仍是 PR #12 Unit 10 race guard 接口 | 新增 helper 不删旧的；旧的 callers grep 结果只有 with-task route，PR-15 改 with-task 调用为新 helper，但旧 helper 留着便于其他业务复用 |

## 决策点（plan 阶段先问 coord）

1. **bug 1 "直转任务" 按钮**：建议 **不加**（root cause 是 wizard 不传 draftId 而不是 UX 缺入口；修了 root cause 后"自动直转"了）。**待 coord 确认**。
2. **bug 3 卡片数 N**：建议 **N=12**（前端可见，不分页；超过 12 后展示 "+剩余 N 条" 链接到老师 SB 管理页 `/teacher/study-buddy`）。filter：single-select 章节 + single-select 小节（先简单，user 反馈再升级）。**待 coord 确认**。
3. **bug 4 模块位置**：建议加到 **overview tab** 下方而非新 tab，显示 **前 3 条**。**待 coord 确认**。

## 时间估

| 阶段 | 时长 |
|---|---|
| bug 1 (service helper + tests + wizard guard) | 30 min |
| bug 2 (sticky cancel + drafts page footer button) | 20 min |
| bug 3 (大改 SB 统计页 + thread dialog) | 90-120 min |
| bug 4 (overview SB mini + endpoint filter) | 30-40 min |
| 本地 e2e 真测 (4 bug 各一遍) | 40 min |
| tsc/vitest + report 写 | 20 min |
| **总计** | **3.5-4 h** |
