# QA Report — pr-5c r1

**Unit**: `pr-5c`
**Round**: `r1`
**Date**: 2026-04-25
**QA agent**: qa-p5

## Spec

Phase 5 · PR-5C — 实例详情 AI 洞察 tab + aggregate API + schema 改动（spec L72-114）：

- Schema 改动（hybrid 方案）：
  - `SimulationSubmission/QuizSubmission/SubjectiveSubmission` + `conceptTags String[]`
  - `AnalysisReport` + `commonIssues Json?` + `aggregatedAt DateTime?`
- 新 endpoint `/api/lms/task-instances/[id]/insights/aggregate`：GET 缓存 + POST 触发 AI
- 新 service `aggregateInsights` (qwen-max) + `getCachedInsights`
- AI evaluation prompt 加 "3-5 个金融概念标签"指令（spec L138 隐性工作）
- 前端 `<InsightsTab>` 顶部生成卡 + 共性问题 / 亮点 / 薄弱概念 chips

## Verification matrix

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | Schema 4 表 5 字段 (3 conceptTags + commonIssues + aggregatedAt) 全在 DB；新 endpoint GET/POST 双 method；service empty-state 双守护 (NO_GRADED_SUBMISSIONS / NO_CONCEPT_TAGS) 防 token 浪费；conceptTags prompt 在 ai.service.ts L341-347 + grading.service.ts L319-321 双注入并 slice(0,5) 防越界（spec L138 隐性工作 confirmed）；3 卡 UI 全（共性问题 #1-N + 亮点 quote + 薄弱概念 chips with #tag count + onExplainConcept hook）；AI_INSIGHTS env mapping `AI_INSIGHTS_MODEL=qwen-max`（spec A6）。 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | **347 passed / 0 failed / 36 files**（328 → 347, +19 new：insights-service 9 + grading-concept-tags 5 + ai-evaluation-prompt-contains-concept-tags 5）。Prompt 文本断言保护未来重构不悄悄回滚。 |
| 4. Browser / 真 curl + AI E2E | PASS | **Prisma 三步证据链**：migration `20260425011913_add_analysis_aggregate_fields` 落地；DB 真有 5 字段 (information_schema 验证)；dev server PID 79990 重启后真页面 200 (40205 byte) + API GET 200 cached:false（如 Prisma client 缓存旧 schema 会触发 P2002，实际 200 → cold restart 生效）。**真 AI E2E 完整闭环**：student1 POST 创建 subjective 真提交 dd7e9299 → ~80s grading → status:graded score 57/100 + **conceptTags `["客户画像", "资产配置", "风险偏好", "应急准备金", "职业风险"]` 5 个真标签持久化**；POST aggregate 7.5s 真 qwen-max → studentCount=1 + 2 commonIssues + 1 highlight (张三 + 真 quote) + 5 weaknessConcepts；二次 GET 0.045s cached:true reportId 一致；upsert 路径再 POST 仍同 reportId 1c27808e（一对一关系保持）。 |
| 5. Cross-module regression | PASS | 9 路由 teacher1 全 200；student1 /dashboard /grades /courses 全 200；现有 `/insights` endpoint 200 不冲突（builder L163 担心闭环）；service interface 改动是 additive（updateSubmissionGrade conceptTags optional 向下兼容，旧 caller `/api/submissions/[id]/grade` byte-identical 不传 tags）。grep updateSubmissionGrade 8 处 caller 全检查：grading.service AI 路径 4 处传 tags + 教师手动 grade route 1 处不传 + 状态切换 (grading/failed) 3 处不传。 |
| 6. Security (/cso) | PASS | **OWASP A01 Broken Access Control**：teacher2 cross-tenant GET → 403 / POST → 403（不消耗 AI token）/ student GET → 403（teacher-only guard `assertTaskInstanceReadableTeacherOnly`，复用 SEC2 已落地 guard，无新代码）。**A03 Injection**：Zod aggregateSchema 严格校验 AI 返回 + Prisma where 参数化；唯一外部输入 instanceId 走 path param 不进 SQL 拼接。**A05 Security Misconfig**：成本守护 NO_GRADED_SUBMISSIONS 400 真验证（empty instance POST 实测）/ NO_CONCEPT_TAGS unit test 覆盖 / 缓存命中即不调 AI（cached:true 0.045s vs cached:false 7.5s）。**STRIDE T**：upsert by (instance, teacher) 一对一无 cross-user tampering 面。**I**：AI feedback / weaknessConcepts 仅 own scope，跨户 403。**D**：take(200) submissions 上限防 OOM + 缓存防雪崩。**E**：requireRole + assertTaskInstanceReadableTeacherOnly 双层防 student。无 High/Critical。 |
| 7. Finsim-specific | PASS | UI 全中文（AI 班级洞察 / 还没有 AI 洞察 / 等学生提交并完成 AI 批改后 / 生成洞察 / 重新生成 / 最近一次生成于 / 共性问题 / Top N / 暂未发现明显共性问题 / N 名学生 / 亮点片段 / 暂无亮点 / 薄弱概念 / 无标记数据 / 待办：生成 X 讲解卡片）。Prompt 中文（"金融教育课程顾问"）。Error code 中文 mapping："暂无已批改的提交，无法生成洞察" / "已批改的提交均未生成概念标签，请等待新批改完成" / "任务实例不存在"。Route Handler 仅调 service 无业务逻辑。Prisma 三步严格走完（migration + generate + cold restart 79990 + 真页面 200 验证）。 |
| 8. Code patterns | PASS | 0 硬编码色 + ARIA `role="tabpanel" aria-labelledby="tab-insights"`；service `aggregateInsights` 干净分层（fetch → tagCount deterministic → AI prompt → upsert）；`tagCounts: Map<tag, Set<studentId>>` 用 Set 去重防同学生多 tag 重复计数；`take: 200` + `feedback.slice(0, 400)` 双重防超大 corpus；upsert by `findFirst({taskInstanceId, createdBy})` (一对一)；Service signature additive（updateSubmissionGrade optional conceptTags + ai.service evaluateSimulation schema optional conceptTags）；新 endpoint 复用现有 SEC2 guard `assertTaskInstanceReadableTeacherOnly`（不重新发明）。 |

## Issues found

**无阻塞**。

### Builder 报告差异（澄清，非问题）

- Build report L86 给出真 5 个 conceptTags `["资产配置", "风险偏好", "投资目标", "风险管理", "职业风险"]`；QA 复现得到 `["客户画像", "资产配置", "风险偏好", "应急准备金", "职业风险"]` — **完全合理**：真 qwen-max 输出对相同 prompt 不可重现（builder L170 已声明），但 5 个 tag 的格式 / 数量 / 主题（资产配置/风险/职业）一致，本质相同。

### 观察（非 FAIL）

- **AnalysisReport 一对一**：当前 service 用 findFirst+update upsert，每 (instance, teacher) 一行。未来若需 "上次 vs 这次" 对比，改 always create + orderBy aggregatedAt desc 即可（builder L161 已说明）。
- **Quiz 不抽 conceptTags**：`gradeQuiz` 未注入 prompt（builder L41/L157），仅 simulation + subjective 落地。Spec 未硬要求 quiz 类型，符合预期。如果未来要做 quiz 章节薄弱聚合，需要在 gradeQuiz 加 batch 概念抽取。
- **Cost guard cascade**：当前 `NO_GRADED_SUBMISSIONS` 在拉 submissions 后判断（service L114），如果 instance 被高频 POST 触发，每次都跑一次 DB findMany — 不构成实际 DOS（teacher cookie + assertTaskInstanceReadableTeacherOnly 已限定攻击面），但极端场景下可加前置 count check。非阻塞。
- **404 vs 403 信息泄漏微细差异**：assertTaskInstanceReadableTeacherOnly 内部走 SEC2 路径，invalid uuid → INSTANCE_NOT_FOUND 404，valid teacher1 uuid → FORBIDDEN 403。同 SEC1/SEC2 已存在 pattern，非本 PR 引入。

## Phase 5 敏感点最终核验

- **Prisma 三步完整性**：✅ migration 文件存在 + DB 真字段验证 + dev server cold restart PID 79990 + 真页面 200
- **AI 聚合 write 端点 OWASP/STRIDE**：✅ teacher2 cross 403 + student 403 + 成本守护 400
- **conceptTags 隐性工作**：✅ 2 处 prompt（simulation + subjective）+ slice(0,5) + 真 AI 写入 5 个标签
- **未批改实例点生成洞察 → 拒绝**：✅ NO_GRADED_SUBMISSIONS 400 中文消息

## Overall: **PASS**

- 347/347 tests · tsc 0 · build 26 routes 0 warnings (+1 /insights/aggregate)
- **Prisma 三步严格走完** + DB schema 5 字段全验证
- **真 AI E2E 完整闭环**：subjective 提交 → AI grading 80s → 5 个真 conceptTags 持久化 → POST aggregate 7.5s → cached 0.045s → upsert reportId 一致
- 攻击矩阵 5/5 PASS（cross-tenant GET/POST + student + unauth + empty instance 成本守护）
- 9 回归路由 200 · SEC1/2/3/4 守护无回归 · /insights vs /insights/aggregate 不冲突
- OWASP A01/A03/A05 + STRIDE T/I/D/E 无 High/Critical
- 测试数据 cleanup 0 残留（Submission + SubjectiveSubmission + AnalysisReport）

**连 PASS 状态**：PR-5A → PR-5B → PR-SEC4 → PR-5C 四连绿。Phase 5 关键 PR（schema + AI + 安全）安全落地。Ship 建议：可 commit。下一 PR-5D（Analytics tab，纯前端 SVG，无 schema/API/AI）可启动。
