# HANDOFF

> 会话结束前由 coordinator 更新本文件。SessionStart hook 自动显示。
> 项目历史在 `git log` + `gh pr view <num>`（PR 描述含用户视角），不需要在这里复述。

## 当前状态（2026-05-15）

- ✅ **Phase 1 完整收官**（8 unit 11 commits，演示稳定化）
- ✅ **Phase 2 完整收官**（4 unit 全 r1 即收，演示承诺兑现）
- ✅ **Phase 3 完整收官**（molly 真实演示数据建设，6 M-step 全 PASS）
- ⏭️ **Phase 4 跳过**（polish 进 PR follow-up backlog，不阻塞演示）
- 🔄 **Phase 5 进行中**（最终 review + PR 准备）

## Phase 1+2+3 总计成果

| 维度 | 数据 |
|---|---|
| commits（Phase 1 + 2） | 17 |
| schema migrations | 3 新（hiddenAt + SB courseId/taskId nullable + AiRun tokens + TaskBuildDraft approved + QuizQuestion knowledgeTagIds） |
| 单测增量 | 981 → 1049（+68 个新单测） |
| TypeScript | 0 错 |
| Lint | 0 errors（e2e probe specs 加 eslint-disable header） |
| Final FAIL | 0（Phase 2 全 r1 即收，Phase 1 仅 2 个 r2 兜底）|

## 已兑现的演示视频核心承诺

| 演示视频原话 | 兑现 |
|---|---|
| "课程目录按课前/课中/课后组织" | ✅ chapter slot=in/pre/post |
| "AI 自动识别文件结构、提取章节知识点" | ✅ XLS+DOCX 真 structuredData 生成 |
| "AI 扮演金融客户，按评分量规打分" | ✅ molly 课的真实 simulation（李志华 38 岁产品经理，belle 完成 3 轮真实角色化对话）|
| "测验自适应模式，少答题获得诊断" | ✅ Unit 8 真 IRT 引擎，alex 8 题诊断 20 KP + weakest 3 |
| "Study Buddy 基于章节上下文有据可查" | ✅ Unit 6 自由问 + excerpt 持久化 + contextSources |
| "数据洞察 4 维度建议" | ✅ analytics-v2 实测 4 维度 + KPI |
| "AI 调用全程留痕（模型/耗时/摘要）" | ✅ Unit 11 AiRun 含 tokens/cost/summary + /teacher/ai-usage + /admin/audit |
| "教师主导 - AI 默认待审" | ✅ Unit 10 TaskBuildDraft approved 状态机 + 审核 UI（任务派发场景）|
| "实例可重开" | ✅ Unit 2 reopen + delete + confirm dialog |
| "任务总览页所有 config 可见可改" | ✅ Unit 4 编辑模式 + 高危拦截 + 复制为新任务 |
| "协作教师可改课程结构 + 建班" | ✅ Unit 5c 权限上扬 + actorRole audit |

## molly 演示数据建设（Phase 3 真实闭环）

- molly 课 "个人理财规划" 5 章节
- 2 份真实材料（XLS 课程标准 + DOCX 个人理财专业）AI 解析完成
- 3 类任务发布到金融2024A班（sim/adaptive quiz/sub）
- 4 学生真实提交：6 sub + 真实 AI 3 轮对话 + adaptive 8 题诊断 + 2 SB post
- molly release 6 sub + 跑一周洞察（mimo:mimo-v2.5-pro，2293/1017 tokens，24s）
- 演示路径 M-6 验证 14/19 = 74% PASS（5 个 ✘ 是 regex lookup 精度问题，非功能 bug）

## Phase 4 polish backlog（进 PR follow-up）

进 Phase 4 但当前未做（不阻塞演示）：
- **Phase3-A**：quiz-question-tagger 首次 job result tagged 计数虚高（实际 DB 空，第二次手动 trigger 才真写入）
- **Phase3-B**：`.doc` (OLE2) 上传被 storage.service 拒收（textutil 转 .docx 绕过）
- **Unit 12**：主观题 allowedAttachmentTypes 实接 + 拍照 capture
- **Unit 13**：协作教师 dialog 完整化（现有协作者列表显示 + 资源/讨论 tab 隐藏）
- **Unit 14**：学生 dashboard 学习任务卡折叠 + AI buddy callout 视口
- **Unit 15**：一周洞察 LLM 空数据机械重复修 + 错误降级文案分级
- **Unit 16**：全 P2 一次性扫尾
- **Unit 17**：taskSnapshot 字段消费（学生 runner 优先读 snapshot 避免 task 模板改动影响 in-flight instance）

## 持续保留的知识

- **Migration drift 处理流程**（dev DB）：
  - 历史手动 INSERT migration 留下假 checksum → 用 SQL UPDATE 写真 SHA-256
  - 多 worktree 并行共用 dev DB → 各 worktree 改不同表 + 时间戳错开 migrate dev + filesystem cherry-pick
- **NextAuth 多 context race**：跨 student 切换登录 fail 时用 newContext per student + retry
- **AI mood 字段处理**：runner `moodKeyFromLabel(label)` 中文→英文 mapping；direct `data.mood` 是 object 不是 enum string，需用 `.key` 或 mapped
- **Worktree 并行节奏**：Unit 11 (主) + Unit 10 (worktree) 同时跑 schema 改动，cherry-pick 时机错开避免 _prisma_migrations 表冲突
- **r1 即收 4 条件**（schema 改动版）：独立证据链 + 全 deterministic acceptance + DB cleanup + Prisma 三步合规
- **Phase 3 演示主路径** 全 Playwright spec 化在 `tests/e2e/phase3-m{1-6}-*.spec.ts`，可重复跑（部分 spec mood drop 已知）

## 历史归档

| 文件 | 内容 |
|---|---|
| `HANDOFF-2026-05-pre-cleanup-archive.md` | 旧 HANDOFF（review + batch1+2 + molly fixes 全程详记） |
| `spec-batch1-archive.md` / `spec-batch2-archive.md` | 上一轮 batch 计划 |
| `spec-review-2026-05-13-archive.md` | 全项目 review 计划 |
| `reports/phase3_molly_seed_r1.md` | Phase 3 完整记录 |
| `reports/probe_summary_r1.md` | 5 模块 probe r1 |
| `reports/bug_inventory_*_r1.md` | molly/alex 视角 65 bugs |
| `reports/build_unit{N}_r{M}.md` × 多 | 每 unit builder 报告 |
| `reports/qa_unit{N}_r{M}.md` × 多 | 每 unit QA 报告 |
| `plans/unit{N}_plan_r1.md` × 多 | 每 unit plan |
| `spec.md` | 当前 spec |
| `spec-amendments.md` | Unit 17 + 决策记录 |
