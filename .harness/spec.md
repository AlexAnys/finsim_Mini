# Spec — Bug Fix PR-15 (2026-05-16)

> ⚠️ **行为底线**：不走捷径 — 任何跳过 / 接受 < 100% acceptance 必须先 ask 用户。

> Coordinator: claude · Team: probe-demo (复用) · Branch: `claude-bugfix-pr15` (base = main `41f2564`)
> 来源: 用户 staging 兜底测 PR #14 时发现 6 个 pre-existing bug
> User staging 兜底: 1 次 (PR-15 进 staging 后 5-10 min)
> 上一 PR archive: `.harness/spec-pr1-archive.md`

## 用户原话 + bug 分类

| # | bug | 性质 | 严重度 |
|---|---|---|---|
| 1 | 老师: 草稿发布任务后, 草稿仍在; 不能直接转任务 | TaskBuildDraft 状态机流程 | P1 |
| 2 | 老师: 点开草稿后没有"返回 / 退出任务设置"路径 | UI 流程缺 | P1 |
| 3 | 老师: Study Buddy 统计页不直观 — 想要"问题卡片"形式: 高频问题集中展示 + 点开看完整对话(AI 回 + 人后续) + filter 章/节 | UI 重设计 | P2 |
| 4 | 老师: 任务详情页加 Study Buddy 小模块 — 显示此任务有无学生提问 | 新 mini-feature | P2 |
| 5 | 学生: dashboard 任务区无滚动条, 折叠到前 5 — 希望可滚动 | 设计调整 (Phase 4 Unit 14 反向) | P2 |
| 6 | 学生: 评分页面**评价维度显示代码**, 没有显示模拟对话历史, 手机端**无法显示** | render 严重 bug | **P0** |

## 范围 — PR-15 (2 builder 并行 + 1 qa)

### builder-teacher-fixes (bug 1 / 2 / 3 / 4)

**bug 1 — TaskBuildDraft 状态机**:
- 触发点: 老师 publish task from draft (走 createPublishedTaskWithInstance with draftId) → draft 应该转 published 状态 (PR #12 Unit 10 已加 approved + atomic publish), 但 UI 还看到 draft 在列表
- 检查: `lib/services/task-build-draft.service.ts:markTaskBuildDraftPublished` 是否真改 status; UI 列表 query 是否 filter `status NOT IN ('published')`
- 修: 列表 query 加 filter; "直转任务" 按钮 — builder 评估方案 ask coord

**bug 2 — 草稿编辑退出**:
- 点草稿后用户期望"返回 / 退出" 按钮
- 检查: 草稿编辑 dialog/sheet/page close handler + redirect path
- 修: 加 "取消" 按钮 / 顶部 X / 浏览器返回 OK

**bug 3 — SB 统计页 UI 重设计** (scope 最大):
- 当前: `components/course/course-study-buddy-analytics-tab.tsx` 显示混乱
- 改: 高频问题排序 → 卡片网格 → 点开看完整 thread (原问题 + AI reply + 学生 follow-up) + filter chapter/section

**bug 4 — 任务详情 SB 小模块**:
- 任务详情页加 mini 卡片: 此 task 关联的 SB post (count + 列表前 3)
- 数据源: `studyBuddyPost` where `taskId / taskInstanceId` 关联

### builder-student-fixes (bug 5 / 6)

**bug 5 — 学生 dashboard 任务区可滚动**:
- 当前: Phase 4 Unit 14 设计"折叠到 5 + 查看全部按钮"
- 改: 改成内部滚动 (max-height ~ 400-500px + overflow-y-auto)
- 文件: `components/dashboard/priority-tasks.tsx` 或 `app/(student)/dashboard/page.tsx`

**bug 6 — 学生评分页面 P0**:
- 现象 (a): 维度 (rubricBreakdown 各 criterion) 显示**原始 JSON 代码** 不是评语
- 现象 (b): 无模拟对话历史 (simulationSubmission.transcript)
- 现象 (c): 手机端 < md 视口**无法显示**
- 文件: `app/(student)/grades/[id]/page.tsx` 或 `components/grade/*` (builder 自查)
- 修 (a): 正确 parse rubricBreakdown JSON (criterion.name / score / maxPoints / rationale) 卡片渲染
- 修 (b): 加 transcript section (类似教师查对话, 只读) — 时间轴 / 气泡
- 修 (c): responsive (md:grid-cols-2, base flex-col)

## Acceptance criteria

### 通用 (所有 bug)
1. ✅ tsc --noEmit 0 new error
2. ✅ vitest run 0 regression
3. ✅ npm run lint 0 error
4. ✅ 改动 ≤ 1500 行 (单 PR 总和)
5. ✅ 无 schema 改动 (本 PR 纯 UI/service)

### bug 1
- ✅ 老师建 draft → publish → draft 列表不再显示 (filter status='published')
- ✅ 或 提供 "草稿直转已发布任务" 按钮 (builder 决定方案 ask coord)
- ✅ vitest: list query 测试加断言
- ✅ 真浏览器: molly 发布 draft → 草稿列表只剩 ready/in-progress

### bug 2
- ✅ 草稿编辑界面有清晰 "取消 / 返回" 按钮
- ✅ 点击 / Esc / 浏览器返回 回上一页 无 stuck
- ✅ 真浏览器: molly 点草稿 → 编辑界面 → 取消 → 回列表

### bug 3
- ✅ SB 统计页改成卡片网格 (高频问题排序 count desc, 前 N 张卡)
- ✅ 每卡显示: 问题摘要 + 提问次数 + 创建时间
- ✅ 点卡片 → dialog/sheet 显示完整 thread (原 post + AI reply + follow-up)
- ✅ filter 下拉: chapter / section
- ✅ vitest: 卡片 + filter 工作
- ✅ 真浏览器: molly 课程 SB 统计页

### bug 4
- ✅ 任务详情页加 SB mini 模块
- ✅ 显示: count + 前 3 条 (或 '本任务暂无提问')
- ✅ vitest: 模块 render + 0-state
- ✅ 真浏览器: molly 进任务详情看 SB 模块

### bug 5
- ✅ 学生 dashboard 任务区可纵向滚动
- ✅ 滚动顺滑, 适配 < md
- ✅ 不破坏 Phase 4 Unit 14 AiBuddyCallout 显示
- ✅ 真浏览器: student1 dashboard ≥ 6 task → 滚动条
- ✅ 移动端 375px 滚动正常

### bug 6 (P0)
- ✅ 评价维度**真渲染** (criterion.name / score / maxPoints / rationale 中文) — 不是原 JSON
- ✅ 模拟对话历史: 时间轴 / 气泡显示 transcript
- ✅ 响应式: < md 视口完整加载 + 滚动 + 无横向溢出
- ✅ vitest: rubricBreakdown 各 criterion + transcript turn 渲染
- ✅ 真浏览器: 桌面端 + 移动端 (375px) student1 grades/[id] (alex 评过的) 完整 + 维度 + 对话 + 截图

## Workflow

1. 写 plan `.harness/plans/pr15_{name}_plan_r1.md` (实现方案 + 文件清单 + 风险)
2. SendMessage team-lead 等 approval
3. 实现 (单 / 多 commit, 每 commit tsc + vitest)
4. **本地真跑 e2e** (CLAUDE.md 行为底线 — PR-1 A r1 走捷径教训): `BASE_URL=http://localhost:3000 npx playwright test ...`
5. 完成报告 `.harness/reports/build_pr15_{name}_r1.md`
6. SendMessage team-lead "build done"
7. TaskUpdate task → completed

## QA

qa-pr15-bugs: 在 staging 真浏览器跑 6 bug case + 桌面 + 移动端 (bug 5/6 特别) + 截图. DB cleanup hard-delete 副作用.

## 不在范围

- 候选 B/F/G/H (PR-2 4 候选) — PR-15 merge 后做
- 候选 C route 搬 service — 长期 backlog

## 风险登记

- bug 1: vitest 应已覆盖 publish marks draft published, 但 UI 仍显示 = list filter missing 概率高
- bug 3: SB 统计重设计 ≥ 300 行 diff, scope 最大
- bug 6: 移动端 — PR-12 commit b2d3738 "feat(mobile): adapt student runner" 只覆盖 runner, grades 没覆盖. responsive 必须真浏览器 375px viewport 真测
- builder 必须本地真跑 e2e 才能交 (CLAUDE.md 行为底线)
