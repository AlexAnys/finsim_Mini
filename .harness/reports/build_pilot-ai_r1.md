# Pilot AI 修复 r1

- 任务：`.harness/spec-pilot-reliability.md`
- 基线：origin/main `5dd4f43`；分支 `codex/pilot-reliability`
- 工作区：`/Users/yangsenan/dev/Finsim-Mini-pilot`
- 角色：AI builder；无提交、push、部署、真实 AI 调用或模型设置写入。
- 状态：实现完成，交 coordinator 集成类型检查、真实 UI/数据库 E2E 和独立 QA；本报告不是最终 QA PASS。

## 修复

1. AI 调用统一总 deadline：交互 30 秒，其它默认 90 秒；JSON 修复、请求错误 fallback、模拟对话补提示共享剩余时间。禁用 SDK 的额外嵌套重试；上游不返回也会主动 abort。流式首字前失败可 fallback，已显示文字后失败保持错误提示，避免混合两份回复。
2. 模拟/主观评分共用动态 rubric schema：标准 ID 完整唯一、分值合法、总分合计一致；模拟 evidence 数量 1–3，虚构引用重试仍不通过即拒绝评分。评分 JSON 不再接受截断修复后的部分结果。
3. 连接测试使用一次性设置 override，禁止 fallback，返回实际 provider/model；不保存用户配置。
4. 模型按 provider 分组，切 provider 同时切兼容模型；读设置考虑 feature 级环境变量；隐藏无执行路径的搜索/输出风格控件；推理只在可生效功能显示。
5. DeepSeek 增加 `deepseek-v4-flash/pro` 能力和真实 HTTP `thinking` 参数；未切全局默认，未覆盖已有教师设置。官方来源：[当前模型](https://api-docs.deepseek.com/quick_start/pricing)、[推理协议](https://api-docs.deepseek.com/guides/thinking_mode/)（2026-09-09 核验）。真实账号连通性由 coordinator 验证；无效 key 不能由源码修改解决。
6. 实例洞察每学生选最新提交，记录与展示 AI 样本量；人数从 evidenceSubmissionIds 与输入学生集合核算；“薄弱概念”改为“涉及概念”。点评引用必须是输入反馈原文，界面明确“对学生提交的 AI 点评”，不署为学生原话。
7. 周洞察班级均分、分组人数、相关任务低分学生比例由程序计算，统一百分制并按学生等权；prompt 提供真实 ID、明确 80 条文字样本；课表建议只保留真实 slot/date。没有知识点错因证据时不叫“出错率”。
8. AsyncJob 使用 `{jobId, attempt}` 租约上下文，progress/final/sweeper 重置均检查当前 attempt；人工 retry 原子重置并清旧结果。旧 worker 不能把新执行提前写成功。APP 在成绩事务中锁 job 检查租约，防结果写入的 TOCTOU。
9. AI 同模型多次 JSON 响应累计 tokens；fallback 按实际 provider 分开留痕。sweeper 按业务结果而不是 Promise fulfilled 计成功/失败。
10. 查询过滤软删除提交；提供 `invalidateSubmissionInsights(tx, {taskId,taskInstanceId})`，同事务清派生缓存并保留原报告文档。范围报告缺课程外键，目前保守失效所有 scope 缓存。
11. 修 `ai-provider` 环境变量污染；旧 `fix-4-provider-deadcode` 实际尝试数据库 upsert，现已 mock 隔离。发现时五次 FK 校验均拒绝，无成功写入。

## 跨 APP 接口

- `lib/services/ai-grade-validation.ts`：`createRubricEvaluationSchema(rubric, {requireEvidence?})`。
- `lib/services/ai-deadline-context.ts`：`withAiDeadline(timeoutMs, callback)`；APP 包整卷批改，共享预算。
- `lib/services/async-job-context.ts`：`getCurrentJobLease()`；APP 事务锁 AsyncJob 并核验 `running + attempts` 后写成绩。
- `lib/services/insight-invalidation.ts`：`invalidateSubmissionInsights(tx, {taskId, taskInstanceId})`。
- `/api/async-jobs/*` 学生结果裁剪、模拟场景快照接入由 APP builder 负责。

## 验证与测试迁移

- 相关 25 个文件 **248 / 248 测试通过**；原始结果在 `/Users/yangsenan/Documents/Codex/reviews/finsim-2026-09-09/implementation/pilot-ai-vitest.json`。
- 代码/新增测试定向 ESLint 无错误；曾有一个未用 import warning，已删除该 import。
- `git diff --check` 通过。
- coordinator 首轮 tsc 仅报 lease 测试三处 PrismaPromise mock 类型；已修，等待统一复查。
- `sim-evidence.test.ts` 从重复长 fixture 抽成 helper，现 13 项：有效原话保留、虚构重试拒绝/修正成功、客户话不能算学生话、截断评分拒绝、缺/空/超量 evidence 拒绝。旧“伪造仍接受”和“无 evidence 自动补空数组”是被修复的错误契约，相关断言改为拒绝，不是减少验证。
- `fix-10-async-job-sweep` 使用内存状态模拟 runner/sweeper，覆盖旧 worker 迟到、最大尝试次数、失败统计与租约传播。

## 本地 E2E 上游工具

`node tests/e2e/pilot/mock-ai-server.mjs` 仅监听 `127.0.0.1:3189`。

- 支持 OpenAI chat JSON 与 SSE，自动返回模拟回复、动态 rubric、简答评分、概念标签等受控 fixture。
- `POST /_control` 设置 `mode:auto/error/timeout`、`statusCode`、`delayMs`、`failNext`、`response` 或 `fixtures:[{contains,response}]`。
- `GET /_requests` 读取收到的 prompt；不记录鉴权头，供附件内容确实进入 AI 请求的断言。
- `--self-test` 四项 transport/control 断言通过。
- 工具只替换本地上游 URL，应用权限、数据库、评分、发布照真链路；源码无测试绕过入口。
- 受控 fixture 能验证应用端到端行为，**不能证明真实模型教学质量或账号可用**。

## 后续验证注意

- 真实 provider key、实际网络延迟与教师评阅一致性仍需有效账号/样例验证。
- 确定性周统计读取范围内全部记录，AI 文本仍只看有标明的样本；较大班量的查询性能应在扩量前压测。
- scope 报告保守失效可能增加重新生成成本；后续可加关系键精确失效。
- 主观题/模拟评分更严格会把模型结构失败显式暴露为待重试，应验教师恢复路径，而非把这类异常改成学生 0 分。

## 集成 QA 补充（2026-09-09 20:17）

- coordinator tsc R2 通过；原全套 1342 中 AI 搜索文案保护失配已修，保留“搜索未启用”说明并断言无假启用控件；该文件 6/6。
- APP 独立 QA 指出 analytics 仍读 live 模板、待公布计入 failed：已按每份提交快照映射题目和标准，仅在获得相同版本题的学生中计算分母，自适应未发题不计未答；pending release 限 graded。添加两个真实 service 反例后 analytics 24/24；scope 标准名称同样支持冻结快照。
- weekly cron 不再把 AI 失败空态当成功：有提交且 emptyState 标 failed；无数据标 skipped；相关 25 项通过。
- 缓存失效目前保证串行写→读场景；同时进行的 AI 聚合仍可能在删除/改分后回填旧输入形成的结果。周缓存是进程内缓存，不声明跨副本即时失效；后续可做源数据版本核验/共享缓存版本。
