# Probe M4 r1 — 数据洞察 + 教师主导 / AI 留痕

路由：`app/teacher/analytics-v2/`（旧 `analytics/` 已 redirect）。证据：`.harness/screenshots/probe-m4/01-default-scope.png`、`05-instances.png`。

---

## 一、数据洞察

### P0-DI-1 任务表现 / Study Buddy 默认空，演示翻车风险高
- 症状：默认 scope 下 simulation `highlights=0, commonIssues=0`，Study Buddy `bySection=0`，仅 KPI + 教学建议有内容。
- 证据：`tests/e2e/probe-m4.spec.ts::M4-3`；当前课 `submC=1`，多数 instance 未批改完。
- 根因：`scope-insights.service.ts:347` 要求 simulation `status='graded'`，`getScopeStudyBuddySummary:217` 依赖 `StudyBuddySummary` 缓存（无 cron 写入）。
- 优化：seed 演示数据 ≥3 simulation graded + 5 study-buddy post；空态文案改"切到 X 课"+ 跳转；空缓存时 lazy build。

### P0-DI-2 KPI 卡片 `<button>` 嵌套 → React hydration error
- 症状：`/teacher/analytics-v2` 控制台 2 条 `<button> cannot be a descendant of <button>` 错误（M4-1 / M4-4 复现）。
- 根因：`kpi-row.tsx:192` 外层 `<button>` 包整卡，而 line 143 卡内 info tooltip 也是 `<button>`。
- 优化：外层改 `<div role="button" tabIndex={0}>`；或 info 改 `<span>`。

### P1-DI-3 4 维度建议实为 5 块，话术与代码不一致
- 症状：逐字稿"知识 / 技能 / 群体 / 教学策略 4 维"。代码 5 类：`knowledgeGoals` / `skillGoals` / `pedagogyAdvice` / `focusGroups` / `nextSteps`（前端 3 列 5 卡）。
- 证据：`scope-insights.service.ts:933-945` Zod schema。
- 优化：话术改"4 维 + 1 行动项"，或把 `nextSteps` 并入 `pedagogyAdvice` 子项。

### P1-DI-4 cache TTL 24h，"重新生成"按钮可能命中 cache
- 症状：测试结果 `source=cache, generatedAt=05/13 18:57`（昨天）。
- 证据：`scope-insights.service.ts:150` cacheCutoff = now-24h；POST endpoint 是否传 `forceFresh=true` 需确认。
- 优化：POST 强制 `forceFresh=true`；UI 标注 cache 龄期。

### P1-DI-5 filter bar 信息密度低，scope tags 默认隐藏
- 症状：主筛选区仅"课程 / 班级 / 章节 / 详细筛选"4 控件；任务类型 / 实例 / 计分口径 / 时间 全藏在 popover。
- 证据：`insights-filter-bar.tsx:518-533` scopeTags 仅在 popover 内。
- 优化：主条加"任务类型"chips；scope tags 改常驻面包屑。

### P2-DI-6 recompute 入口隐蔽 + 无完成通知
- 优化：toast 提示；header 显示进度条。

---

## 二、教师主导 / AI 留痕

### P0-PR-1 "AI 默认待审核" 在多入口不一致
- 符合：① 批改流程完整（`releasedAt=null` → 教师手动 release + `logAuditForced` at release.service.ts:67）；② TaskInstance `status=draft→published` + `taskInstance.publish` audit。
- 违背：① **TaskBuildDraft** 状态机有 `draft/queued/processing/ready/failed/published` 但**无 approved 中间态**，无 AI 原始 vs 教师编辑 diff，PATCH 直接发布无 audit（`task-build-drafts/[id]/route.ts:23`）；② **Study Buddy AI 回帖**（feature=`studyBuddyReply`，DB 已 5 条 succeeded）**直接对学生可见**，schema 中 `StudyBuddyPost` 无 `releasedAt / approvedBy`。
- 优化：TaskBuildDraft 加 `aiPayload`/`editedPayload` 双字段 + `approve` 端点；Study Buddy AI 回帖落库默认 `visibility=pending`。

### P1-PR-2 AI 留痕字段缺 tokens / 摘要，状态卡死
- 符合：`AiRun`(schema.prisma:966) 记录 provider/model/status/latencyMs/inputSize/outputSize/promptHash/metadata/error。`ai.service.ts:722/772/1189` 三大入口全 instrumented，DB 实际 26 类 feature×provider×model 组合写入。
- 违背：① 缺 `inputTokens/outputTokens/costEst`，没法成本分析；② 无 `summary`，只 `promptHash` 无法回溯；③ DB 有 1 条 `evaluation status=running` 卡住未结束（finishAiRun 漏调）。
- 优化：补 token 字段（Vercel AI SDK 返回 usage）；`metadata.summary` 强制存 prompt 前 200 字；cron 兜底超时 running → failed。

### P1-PR-3 无教师 / admin 可视化 AI 调用 / audit 历史 UI
- 症状：M4-7 / M4-8 测试访问 `/api/lms/ai-runs`、`/api/admin/ai-runs`、`/api/admin/audit-logs`、`/admin`、`/admin/audit` 全部 **404**。`grep -rln "prisma.aiRun"` 仅 1 处（ai.service.ts），**AiRun 只写不读**。
- 证据：`find app -type d -name admin` 空。
- 优化：① `/teacher/ai-usage` 教师自助列表；② `/admin/audit` 管理员视角；③ 教学建议 / Study Buddy 答复行内 ⓘ "查看 AI 调用详情" 弹窗。

### P2-PR-4 `ENABLE_AUDIT_LOGS` env 可让普通 audit 失活
- 症状：`audit.service.ts:10` `logAudit` 受 env gate，仅 `logAuditForced` 不受控。prod 误配则 publish/delete/update 不写。
- 优化：`logAudit` 也强制写入，env 改控制采样率。

---

## 总结
数据洞察可演示但需修 hydration error + seed 默认非空数据；4 维度话术与代码不一致。"教师主导" 在作业批改 + 任务发布两条链路完整，但 TaskBuildDraft / Study Buddy AI 回帖缺审核闭环；AI 留痕 schema 已落地但无 UI 暴露、token / 摘要字段缺。
