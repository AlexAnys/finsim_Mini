# AI 功能链路 Review（Stream A）

日期：2026-05-13 · 范围：`lib/services/ai.service.ts` + grading / study-buddy / work-assistant + `app/api/ai/*` + 教师 AI 设置 / 助手页面 · 实测：dev server + Playwright/Chromium，账号 student1 / teacher1。

## 这块功能在干嘛

学生在 simulation 任务里跟 AI "客户"对话练习财经咨询；提交后 AI 按 rubric 评分。学生还能用"学习伙伴"问问题；老师可在 AI 工作助手让 AI 帮忙完善教案、出题、批卷；老师可在 AI 设置选择哪个工具用哪个模型、写补充提示。整套都跑在"小米 MiMo"上，OCR 走阿里 Qwen。

## 实测发现

- 🔴 **学生每发一句对话要等 18–26 秒，全程页面 spinner，没有流式**。基准测试（`tests/e2e/chat-bench.spec.ts`，连续 3 轮）测得 26044 / 18051 / 24101 ms。`ai.service.ts:485` 用 `generateText`（非 `streamText`），整段 JSON 解析完才返回。命令 `npx playwright test ... chat-bench.spec.ts`。
- 🔴 **AI 设置页的"Provider"下拉只有 1 个选项"小米 MiMo"**。截图 `06-teacher-ai-settings.png`。`/api/ai/tool-settings` 返回 `providerOptions: [{value: "mimo", ...}]`（实测 JSON 已记录）。`.env.example` 里大段写着 Qwen / DeepSeek / Gemini / OpenAI 的配置（line 53-83），但 `ai.service.ts:151,168` 把任意请求强制改写成 `"mimo"`，`ai-tool-settings.service.ts:160` schema 也只允许 mimo —— **`.env` 里那些 key 是死配置，配了也不生效**。老师如果想切换 provider，按钮就在那但点了没用。
- 🔴 **`POST /api/ai/chat` 不验证最低输入**：实测发 `transcript=[], scenario=""`，仍 200 返回伪造的客户开场白"你好，我最近手头有些闲钱..."（log `AI-06-empty`）。学生点错按钮、客户端 bug、自动化攻击都会烧 token + 写一条 AiRun + 给学生展示"凭空"的对话。
- 🟡 **AI 评分失败兜底默认 0 分**：`grading.service.ts:311` quiz 简答题、`gradeSubjective` 在 schema parse 失败时给学生 0 分；只有 quiz 简答提示"AI 批改失败，请等待教师手动批改"，simulation 与 subjective 没有 fallback —— 一次 JSON 截断 = 学生直接挂科。`evaluateSimulation` (`ai.service.ts:993`) 没有 try/catch，最终调 `updateSubmissionGrade(status:"failed")`（`grading.service.ts:164`），需要老师/学生手动 retry。
- 🟡 **学生 dashboard 显示 18 个任务卡片，但 5 个被点开的任务里没有一个有"开始模拟"入口** —— 进入 `/sim/` 的路径在 Playwright 5 次尝试都失败（screenshots `03-task-*.png` 显示任务详情但无 simulation 按钮）。可能是种子数据没 simulation instance，也可能是 dashboard 显示了过期/未开放的任务。**老师看了未必知道学生那边按钮缺失**。
- 🟡 **Chat 用户 input 上限 50 条消息 × 2000 字符**（`/api/ai/chat/route.ts:10-13`），但 `MAX_OPENING_CHARS=2000`、`MAX_SCENARIO_CHARS=4000` 都没在前端显示；超过时返回 `"场景描述超长"` 中文错误，OK；但 `MAX_TRANSCRIPT_ENTRIES=50` 之后服务端会**静默裁剪到最近 30 轮**（`SERVER_TRIM_RECENT_TURNS=30`），学生看不出来对话历史已被砍。
- 🟢 **空消息边界**：直接 POST 空 transcript 不会 400，建议加 `min(1)`，并校验最后一条必须是 student。

## Code Review 发现

- 🔴 **`getProviderForFeature` 在 `ai.service.ts:151` 把所有 provider 强制改写为 "mimo"**：`const providerName = requestedProviderName === "mimo" ? requestedProviderName : "mimo";`。即便老师在 UI 选了别的（目前不可能），即便环境变量 `AI_SIMULATION_PROVIDER=qwen` 也不生效。**这是个"死代码 + 误导文档"组合 bug**：要么删掉非 mimo 的 case + 环境变量 + UI provider 选择（化繁为简），要么真的让它工作（恢复多 provider）。当前状态是"看起来支持但其实不支持"。
- 🟡 **chatReply 兜底返回写死分数**（`ai.service.ts:769-785`）：JSON 抛错时 `studentPerf=0.5, mood=犹豫`，但**学生那条消息会被算到训练记录里**，最终 `evaluateSimulation` 评总分时不知道这一轮其实是兜底产物。建议：在 transcript 里给这种 AI 消息打 `degraded=true` 标，评分时降权或剔除。
- 🟡 **`maxOutputTokens=8192` for JSON、`4096` for text**（`ai.service.ts:490,549`），但 `chatReply` 走 JSON 路径用了 8192 —— 模拟对话其实只要 ~150 字，硬上限被拉满会让首 token 延迟更久。建议按 feature 分级。
- 🟡 **Async grading 是进程内 `setTimeout(..., 0)`**（`async-job.service.ts:37`）：Node 进程重启时 `status="queued"` 的 job **永远不会再被拾起** —— 没有 cron 扫 stuck job。生产部署如果重启频繁，学生提交后会卡在"批改中"。
- 🟡 **AI 调用从不发起 AbortController/超时**：上游 MiMo 卡住会让 route handler 占满 Next 进程的 worker，没有超时上限。
- 🟢 **prompt 注入风险**：好消息是 `chat/route.ts:31` 已把 `role` 限定 `enum(["student","ai"])`，挡住了学生伪造 `role:"system"` 注入指令（实测返回 400）。**坏消息**：学生仍可在 `text` 字段里塞"忽略上述指令"之类内容，没做内容侧过滤 —— 但因为客户端 `systemPrompt` 已被服务端强制覆写（PR-9a761d1 修复），可控范围有限，🟢 即可。
- 🟢 **AiRun 日志非阻塞**（`finishAiRun` catch 空）：好做法，但失败时连日志都没了，DEBUG 时排查难。

## 建议

1. 🔴 **学生 chat 必须接流式输出（`streamText`）**。当前 18–26 秒等首 token 是"AI 失败用户已经在踩坑"级别的体验问题 —— 学生会以为页面卡死。一句话改 `generateText → streamText`，前端 runner 改 SSE/Reader 渲染。同时给 30 秒上限超时，避免 worker 占满。
2. 🔴 **二选一处理 provider 死代码**：要么删掉 `ai.service.ts` 里 qwen/deepseek/openai 三个 case 分支 + `.env.example` 的 80 行多 provider 配置 + UI 的 Provider 下拉（确认只跑 MiMo），要么真打开多 provider 让老师可切。**当前"看起来支持其实不支持"会误导部署者填一堆没用的 key**。
3. 🔴 **`/api/ai/chat` 加 transcript 必须非空 + 末条必须 student 的校验**。否则任意登录用户可无限刷"凭空开场白"，每条 18-26 秒 + 烧 MiMo 配额 + 写 AiRun 表（commit `da9a505` 的延迟优化白做）。
4. 🟡 **Async grading 加 cron 扫 stuck job**：现有 `runAsyncJob` 已经支持 `status="queued"` 拾起，缺一个每分钟扫表的入口（参考 `/api/cron/release-submissions` 已有的 pattern）。否则部署重启 = 一批学生卡在"批改中"。
5. 🟡 **AI 评分失败时给学生看得见的提示，而不是默默挂 0**：`gradeSimulation` / `gradeSubjective` 套 try/catch，失败时 `score=null, status="grading_failed"`，前端"成绩"页显示"AI 批改暂未完成，请联系老师手动批改"。当前 quiz 简答有这个 fallback（`grading.service.ts:311`），其它两个没有。

---

**实测产物**：
- 截图：`.harness/screenshots/review-2026-05-13/ai/01-08.png`（10 张，包括 student dashboard、5 个任务详情、teacher AI 设置 / 助手 / study buddy）
- Playwright 脚本：`tests/e2e/review-ai.spec.ts`（6 case 全过）、`tests/e2e/chat-bench.spec.ts`（3 轮延迟基准）
- 配置：`playwright.review.config.ts`
- 关键 log：`AI-02-task-links` count=18；`AI-03-api` providerOptions=[{mimo}]; `AI-06-empty` empty transcript 仍 200 + 伪造回复；chat-bench 18051/24101/26044 ms。
