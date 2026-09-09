# 试点应用可靠性 · builder r2：发布时必须有可执行评分标准

2026-09-09。触发来源是独立浏览器 E2E：教师主观题向导没有填评分项，也能创建并发布，造成评分输入零项。r2 只收口这个发布条件；不加默认零分，不扩大题分规则，不新增数据模型/迁移。

## 根因

`assertTaskReadyForPublish` 原先只检查三类配置存在、quiz 有题、subjective 有题干，未检查 AI 评分标准。向导的 `collectMissingFields` 虽标记空标准，`handleSubmit` 却只阻止无效 quiz 题目；Review 对空评分项直接不渲染。

## 修改

- 新增纯 helper `lib/utils/task-publish-readiness.ts::hasUsableRubric`：至少一项，所有已提交项都有非空名称、有限正分值、有限总分；如有 ID，不可重复。
- `task-instance.service.ts::assertTaskReadyForPublish` 对 simulation/subjective 采用该规则；quiz 继续按题目分值，不要求额外 rubric。现有 with-task 和 publish 都复用该函数。
- 非 draft 的实例 snapshot 编辑验证合并后的任务，不能清空已发布任务的 rubric；snapshot 缺失时用原任务补全。写入时带上先前 status 条件，防止读取为 draft 后并发发布使空 rubric 写入已发布实例；状态变化返回明确 409。
- 通用 PATCH 设置 published 及 closed reopen 也走同一 readiness，避免状态切换绕过；draft→published 的通用 PATCH 同步冻结快照。
- 普通任务/实例草稿保存与 draft snapshot 编辑继续允许空评分标准。
- API 新增 `TASK_RUBRIC_REQUIRED` 中文 400，明确补评分标准后发布或先存草稿。
- Review 显示缺项警告；向导点击发布先检查，失败回配置步骤，保留内容。草稿 missingFields 也共享相同规则，零分值不会被标为 ready。

## 验证

新增 `tests/pilot-publish-readiness.test.ts` 8 个业务用例：无效 rubric、三类差异、with-task 拒绝、publish 拒绝/补全成功、已发布 snapshot 不可清空、空草稿仍可保存、PATCH/reopen 不可绕过、中文 400。

相关 8 文件共 86/86 通过；最后运行 20:47:21。定向 ESLint 无输出（0 error/0 warning）。没有重跑整套；最终全套与浏览器验证由 coordinator/infra 执行。

旧 fixture 只改两类：`low-conflict-production-guards` 的“完整任务”补有效 rubric；原 snapshot auth/null-clear 测试的未指定状态明确为 draft，保留它们原本测试空/局部编辑的意图，未放宽权限断言。默认 smoke-01/02/03 本来就显式提供 scoringCriteria，兼容新条件。

待独立 E2E：API 无 rubric 返回 400 且不产生已发布实例；UI Review 缺项提示、草稿可保存；补 rubric 后相同路径可发布。builder 不将定向 mock PASS 写成真实浏览器完成。
