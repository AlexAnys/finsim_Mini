# 全项目 Review 总览（2026-05-13）

用户原话："review 项目所有功能，尤其 AI、自动化、页面依赖、数据准确性、代码质量。用我理解的语言，我不做技术决策，只关注实际效果。"

**做法**：5 个 reviewer 并发，全部 Playwright 真浏览器实测 + 直连 Postgres 对账 + 全量 typecheck/lint/vitest。30+ 截图、9+ e2e 用例、5 份子报告归档于 `.harness/reports/review_*_r1.md`。

---

## 🔴 已经在踩坑（用户/老师/学生现在就能感受到的问题）

| # | 现象 | 用户实际感受 | 出处 |
|---|---|---|---|
| 1 | 学生跟 AI 对话每句等 18–26 秒，全程页面转圈 | 学生会以为页面卡死、放弃 | A·实测 chat-bench 18051/24101/26044 ms |
| 2 | AI Provider 配置面板是装样子（只能选 MiMo） | `.env.example` 列了 Qwen/DeepSeek/Gemini/OpenAI 但代码强制改写 mimo，配 key 不生效 — 误导部署 | A·实测 + `ai.service.ts:151` |
| 3 | AI 评分失败默默给 0 分（simulation / subjective） | 学生看到 0 分以为自己烂；只有 quiz 简答有"AI 批改失败"提示 | A·`grading.service.ts:164` |
| 4 | 大纲识别错了老师改不了 | 老师改章节名点"安全合并"只会再加一条，原错章节还在 | B·实测 + `outline-apply/route.ts:106-145` |
| 5 | 大纲编辑没保存按钮，刷新就丢 | 老师编辑半天的章节标题，刷新页面全没 | B·实测 |
| 6 | 老师 dashboard"学生总数"显示错 | A 班 10+B 班 2 = 实际 12，dashboard 显示 10 | C·DB 对照 + `teacher-dashboard-transforms.ts:51-54` 取 max 不取 sum |
| 7 | 老师 dashboard 分析卡片实际是死的 | "薄弱任务""班级表现"依赖一张空表 `TaskInstanceAnalytics`，全项目没人在写它；DB 里其实有 4 个均分<60 的实例 | C·实测 + DB SELECT |
| 8 | dashboard 完成率 11% vs 数据洞察完成率 50% | 同一老师从一页跳到另一页，数字差 40 个百分点，没解释 | C·实测 |
| 9 | 老师传题库被当大纲处理 | UI 唯一入口"上传大纲"，后端不管你传什么都走 syllabus 解析（多 1 次 AI 调用 + 30s 等待 + 失败状态） | B·实测 + `outline-import/route.ts:46` |
| 10 | 错误页陷死路 | 学生贴错任务 ID，只看到红色感叹号 + 提示词，没"返回"按钮；simulation 全屏页更糟（连侧边栏都没有） | D·实测 09a/08b 截图 |
| 11 | 8 个错误提示没翻译成中文 | 用户实际触发的路径（批改时数据缺失、Study Buddy 无帖子可汇总等）会看到"服务器内部错误"而不是中文 | E·grep `handleServiceError` |

---

## 🟡 潜在风险（现在没炸，但容易爆）

| # | 风险 | 触发场景 | 出处 |
|---|---|---|---|
| 12 | AI Chat 不验输入 | 发空 transcript 也 200 返回伪造客户开场白，烧 token，攻击/客户端 bug 都能触发 | A·实测 AI-06-empty |
| 13 | 批改任务重启就丢 | 异步评分是进程内 setTimeout，Node 重启时"批改中"的作业永远没人捡 | A·`async-job.service.ts:37` |
| 14 | AI 调用没超时上限 | 上游 MiMo 卡住会让 Next worker 占满，可能整服务被几个慢请求挤爆 | A·`ai.service.ts` |
| 15 | 大纲处理 75-95 秒、无进度条 | 两次 AI 调用串行（其实可并行省一半时间） | B·实测 AUTO-02/05 |
| 16 | 大纲 AI 解析失败不能重试 | 状态变 `ai_summary_failed` 后只能删掉重传 | B·`course-knowledge-source.service.ts:447` |
| 17 | 每周洞察缓存 7 天默认看上周快照 | 周一生成后本周新作业不反映；有手动 refresh 但默认体验差 | C·`weekly-insight.service.ts:85` |
| 18 | simulation 全屏页未登录先白屏 | 其他 layout 都加了服务端登录守卫，这里漏了 | D·`(simulation)/layout.tsx` |
| 19 | 24 个 route handler 绕开三层架构直连 DB | 包括"注册""改密码""改课程"这种关键写入路径，没单测覆盖 | E·grep `import prisma` |
| 20 | 2433 行的 analytics-v2 service 没分区注释 | 每改一行要 grep 全文，反复迭代后边界模糊，下次大改成本高 | E·实测 |
| 21 | 9 个 service 测试覆盖为 0 | async-job / audit / class / task-instance 等，出 bug 没单测兜底 | E·grep tests/ |
| 22 | 数据洞察默认班选了样本最小的班 | B 班只有 2 学生，KPI 50%/90% 大字显示，老师当全局指标 | C·实测 |
| 23 | 教师列表页加载 2.2 秒 | dashboard 0.8s，但 tasks/instances 列表 2.2s+，疑似 N+1 query | D·实测计时 |
| 24 | 3 个任务 runner 有 hooks 漏 deps warning | 同型 warning 会掩盖未来真问题 | E·`npm run lint` |

---

## 🟢 做得不错（防止过度悲观）

| # | 项 | 出处 |
|---|---|---|
| 25 | 数据洞察核心 KPI 数字算对了（DB 对照通过），drilldown 1:1 严守，scope-insights 24h 缓存只缓存 LLM 文本不影响数字 | C·实测 |
| 26 | 跨账号串号 bug（PR 9a761d1）修得很干净，切账号后 localStorage / sessionStorage 全清 | D·实测 test 07 |
| 27 | 权限三层校验扎实（requireAuth/requireRole 用了 174 次，无手写 session 检查），学生闯老师页被 ForbiddenState 接住 | D+E |
| 28 | 整齐大纲识别 100% 准确；题库 regex 直抽 confidence=1.0、零 AI 调用、887ms；乱大纲也救回大半 | B·实测 AUTO-02/04/05 |
| 29 | AI 评分三态（pending/analyzed_unreleased/released）chip 设计成熟，学生看得清自己卡哪 | D·实测 |
| 30 | typecheck 0 error / 868 单元测试全过 / lint 仅 3 同型 warning / 0 死代码并存 | E·实测 |

---

## 📌 我给你的建议（按"先修哪个"排）

### 🔴 这周就该修（修了立竿见影）

1. **学生 AI Chat 改流式输出**（一句话改 `generateText → streamText`）— 学生不再以为页面卡死。**这一条是用户体感最差的问题**。
2. **AI Provider 死代码二选一处理** — 要么删掉 UI 下拉/env 多 provider 配置，要么真打开多 provider。**不能继续装样子**。
3. **大纲编辑能改/删/重排**（`outline-apply` 加 update/delete mode）— 老师才能真用起来这个功能。
4. **dashboard 学生数取 sum** — 一行代码改对，错数字直接消失。
5. **决定 TaskInstanceAnalytics 走向** — 要么补 producer，要么删掉改成实时 SELECT（参考 instance insights 已经在用的路径）。

### 🟡 排进本月迭代

6. **AI 评分失败给学生看得见的提示**（而不是默默 0 分）— 套 try/catch + status="grading_failed"。
7. **错误页加"返回"按钮**（特别是 simulation 全屏）。
8. **大纲/题库拆入口**（题库走独立 POST）+ 大纲上传加进度条 + 失败重试按钮。
9. **8 个错误码补中文映射**（4 行 case 解决，前端立即拿到中文）。
10. **异步批改加 cron 扫 stuck job**（避免重启丢任务）。
11. **dashboard vs 数据洞察完成率口径统一**或加 tooltip 说明。

### 🟢 有空再做

12. 9 个 service 补单测（特别是 async-job、audit）。
13. analytics-v2 加 6-8 个分区注释（不是重构，是加航标）。
14. 教师列表页性能 profile（找 N+1）。
15. 24 个 route handler 慢慢收回 service 层（趁 PR 体量还小堵上 architecture decay）。

---

## ⚠️ 用户/手册需要修正的小事

- spec 里写的 `/teacher/analytics-v2/dashboard` 是 404，正确路径是 `/teacher/analytics-v2`（不带 `/dashboard` 后缀）。

---

## 📂 证据归档（便于追溯）

- 5 份子报告：`.harness/reports/review_{ai,automation,data,pages,quality}_r1.md`
- Playwright 测试脚本（新增 e2e 测试脚手架）：`tests/e2e/review-*.spec.ts` + `playwright.review.config.ts`
- 30+ 截图：`.harness/screenshots/review-2026-05-13/{ai,automation,data,pages}/`
- 测试用大纲/题库 mock 文件：`/tmp/finsim-test-{syllabus,syllabus-bad,questions}.md`
- 本次 review **未改任何业务代码**，只新增 e2e 测试脚手架（项目原本只有 vitest 单测，没 e2e）

---

**一句话总结给你听**：

数据准确性的核心 KPI 是对的、权限边界很扎实、跨账号串号修干净了、单测 868 个全过——基本盘没问题。但有 5 件事老师/学生现在就能直接踩到坑：AI 对话太慢、Provider 配置装样子、大纲改不了、dashboard 学生数和"薄弱任务"显示错。这 5 件加起来不超过 3 天的工作量，修了立竿见影。
