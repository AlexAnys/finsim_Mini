# AI 剩余项复核与实现记录

2026-09-12，builder 自测记录；不是独立 QA 结论。基线 `d8c3f6bb5b2128a84935cc04149d585fa5e44280`，共享分支 `codex-remaining-audit`。无生产写入、无真实收费模型调用。

| 原 33 项编号 | 本轮开始时状态 | 当前代码证据与本轮处理 |
|---|---|---|
| 12 AI 总等待时间 | 已完成 | `ai.service.ts` 的 `aiActionDeadline` / `boundedGenerate` 关闭 SDK 内层重试，用 abort + race 限制总时间；`withAiDeadline` 共享多题预算，追加 hint 接收同一 deadline。现有定向测试重新通过，不将 20ms 替身验证写成真实上游延迟指标。 |
| 13 恢复与定时公布 | 应用机制已完成，宿主调度由 coordinator 复核 | `async-job.service.ts` 按 attempts 原子认领及完成；`async-job-context.ts` 传递执行租约，批改落库检查租约。重新运行 7 项 queued/running/失败/旧 worker 定向检查通过。 |
| 14 测试连接配置错位 | 已完成 | test-connection route 使用未保存的 `runtimeSetting`、关闭 fallback、15 秒预算并返回 `onResolved` 的实际 provider/model。通用 AI 服务的对应正反测试重新通过。 |
| 15 无效 AI 控件 | 已完成 | 模型目录按 provider 过滤，切换 provider 重设模型；不兼容模型保存报错；未接入的搜索/风格不再展示可操作控件，推理按工具能力显示。保留文字/OCR/语音现有分工。 |
| 16 概念覆盖误称薄弱点 | 已完成 | 实例 UI 明确叫“涉及概念”；周洞察标为相关任务低分学生占比，不把全卷低分推断成特定概念答错。满分学生正向对照通过。 |
| 17 统计范围/重复人数/实体 ID | 部分，本轮补齐已确认残留 | 基线已全量读取、每人每任务取最新、确定性百分制班均分与分群、合法课表 ID 校验；剩余最近 80 条文本样本可完全漏掉较早班级。本轮改按课程/班级轮询并明确样本与组覆盖数；>80 组仍有明确范围上限。另修 AI 失败时清空已算成绩且引导教师重新公布的问题：保留统计，单独显示 AI 文字不可用。 |
| 18 AI 评价伪装学生原话 | 已完成 | 实例服务逐字核对 feedback 摘录并从 submission 读取真实姓名，UI 显示“提交点评节选”“对某学生提交的 AI 点评”。 |
| 33 token/恢复统计 | 部分，本轮补齐已确认残留 | 基线已合计 JSON repair tokens，sweep 按实际 job 状态计成功；仍有同用户同 feature 并发最后 AiRun 串账、一次 usage 缺失仍显示部分合计。本轮使用调用范围隔离的 AiRun 收据，AiRun 写入 submissionId，批改审计输出本提交全部 aiRunIds，周洞察费用按本次全部调用累计。任一尝试 usage、账目或价目未知即保持未知，避免部分合计装成全额。 |

## 本轮触发与结果

1. 同一学生 A/B 两份并发调用，A 第一轮 JSON 失败，B 先完成，A 修复后再做标签：A 收据为 run-1/run-3、300 input / 150 output；B 为 run-2、100/50。各数据库 AiRun.metadata.submissionId 正确归属。通过实际 ai.service，外部 AI 传输与数据库为替身。
2. JSON 修复的第一次响应缺 input usage：最终 input/cost 保持 null，已知 output 合计 100；不误显示后一次 input 为全部消费。
3. fallback 初次网络失败或某次审计写入失败：保留已知 run ID，整体不输出假低总量。
4. 208 条输入包含一个旧 attempt，三个同名班/课程、混用 10/100 满分：207 条有效最新提交，80 条文本样本覆盖 3/3 组，较早两个小班均进入；班均分准确为 100/20/80，207 名学生只计一次，伪造课程/班级/课表 ID 不进入确定性结果。
5. 周洞察超时：班级均分/分群保留，aiUnavailable=true；真实空数据仍返回 emptyState，不调用 AI。

## builder 本次验证

`npx vitest run tests/weekly-insight-empty-error.test.ts tests/remaining-ai-receipts.test.ts tests/pilot-ai-reliability.test.ts tests/ai-prompts/insights-prompts.snapshot.test.ts tests/fix-10-async-job-sweep.test.ts tests/ai-tool-settings.test.ts tests/insights-service.test.ts tests/scope-insights.service.test.ts tests/pilot-grading-contract.test.ts tests/ai-run-tokens.test.ts`

结果 10 文件 / 76 测试通过。相关 8 个源码/测试文件 ESLint 无输出、退出 0；`git diff --check` 通过。根 coordinator 负责最终全套、候选 commit/环境冻结；独立 QA 已收到真实 route 与数据库验收建议。

## 独立端到端验收入口

- `GET /api/lms/weekly-insight?force=true`，隔离 DB 建多个班级、重复尝试及超过 80 条已公布数据；loopback AI `/_requests` 检查实际 prompt 样本、班级覆盖与全量统计，对账 UI/JSON。
- AI loopback `_control` 注入失败，周洞察 modal 应保留班级数字，只提示文字建议暂不可用，不能叫教师重新公布已有数据。
- 同学生两份主观题/简答批改并发：由真实 route 调度完成后，对账 `AuditLog.metadata.aiRunIds` 与 `AiRun.metadata.submissionId`，所有收据必须属于该 AuditLog.targetId；多轮 repair tokens 合计正确。

## 尚无证据的部分

没有新增教师标注的金融专业准确率/评分稳定性/教学效果评价；不能把机制测试或少量模型连通称为教学有效。DeepSeek V4 不在既有费用价目表时继续显示未知成本，不推测价格。宿主 cron、生产版本、PR 和上线状态由 coordinator 汇总本次真实证据。

## DeepSeek 精确费用边界（本轮核对官方原文）

- 2026-09-12 实时打开[英文官方价目](https://api-docs.deepseek.com/quick_start/pricing/)和[中文官方价目](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)：输入区分缓存命中/未命中，另有工作日峰谷时段，不能把 inputTokens 乘一个静态价格当准确账单。旧搜索摘要仍可返回过时价目，本报告以本次打开的原文为准。
- 官方当前说明：旧 `deepseek-v4-flash` 名称仍接受，实际已由 V4.1-Flash 提供服务；V4 Pro 会在 2026-09-14 后继续提供。当前代码未擅自改模型策略，但报告不可把请求别名当独立模型版本证据。
- [官方 Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)提供 cache hit/miss、响应 model、created 字段；本地 SDK 可读取标准 `prompt_tokens_details.cached_tokens`。然而 FinSim 当前只持久化 input/output 合计，JSON 修复后的单行又不含每次响应的缓存分项/时点/价格版本。已有数据无法准确补算。
- 结论：本轮继续 `costEstUSD=null` 合理。下一步可在独立成本任务中保留每次 attempt 的原始计费分项与计费版本；未获得分项或跨价目边界无法确定时仍保留未知。不能只在表里补两个 DeepSeek 模型名并使用旧静态价格。

独立 QA 准备阶段另发现 UI “缓存（7天）”与现行 15 分钟缓存不符，已改为“缓存”，等待真实页面验收。
