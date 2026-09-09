# DeepSeek 文本设置迁移 · 独立 QA r1

2026-09-09。QA 未编写被测迁移代码；只读检查指定脚本、Compose/Dockerfile，运行本地临时 env fixture 和 `tests/text-ai-migration.test.ts`，无线上写入、无真实 API 费用、无数据库连接。root 的 Flash/Pro 实际 200 和三类评分另有证据，本报告不重复认领。

结论：**未确认新的 P1 部署阻断；常规部署路径的预检、备份、CAS 迁移和失败回滚设计可保留。三个 P2 需要修正或明确边界，不应把 mock 通过写成完整容器失败恢复已实测。**

## 保留的证据

- `probe-deepseek.py::probe` 只接受官方 HTTPS 主机/443/根或 v1 路径，拒绝用户信息、查询参数、fragment 与重定向；Flash/Pro 各最多一次非流式生成，首个失败后停止。检查 200、响应 model 和非空内容，证明连通生成，不证明教学质量。
- Python probe 缓存绑定当前 key 指纹、baseURL、gitSha 与年龄；部署在 build/备份/数据库迁移后按 300 秒窗口重查。迁移 JS 额外要求 10 分钟内成功且匹配当前 key/endpoint。
- `migrationPlan` 仅处理显式 `provider=mimo` 且 toolKey 在文本策略内的行。OCR/语音等不在清单；其它 provider 保留。实际 UPDATE 只改 provider/model，提示词、temperature、thinking、strictness 等保留；updatedAt 自动变化用作并发比较。
- backup 以 0600 独占创建，目录 0700；保存计划中原始整行后才开始事务。任何源行 provider/model/updatedAt 变化使整个迁移失败；receipt 在事务提交前写入，正常提交后若进程/应用提升失败，shell trap 可根据 receipt 回退自己的写入。
- restore 核对数据库连接标识，按 after provider/model/updatedAt 条件恢复，仅写回旧 provider/model；教师后续更改会跳过而不覆盖。新/旧 env 分开保存；设置恢复用 candidate 连接，新应用失败再还原旧 env、current 与 Compose，不自动逆转 schema 或师生数据。
- Dockerfile 确实复制迁移 JS 与其相对路径引用的策略 JSON；脚本位于 `/app/scripts/ops`，策略在 `/app/lib/ai`。维护容器用 root，私有历史目录挂到 `/private-migration`，可读取 root-only probe/receipt；正式 app 仍以 nextjs 运行。运行路径没有把私有备份挂到 public。
- 定向测试 7/7 通过（21:15:11），包含字段保留、媒体/custom provider 跳过、备份权限、失败 proof 与 endpoint 校验、源行冲突事务回退、回滚跳过后续编辑。过期判断为代码检查，未单独注入过期 fixture。没有运行整套或实际 Docker promotion。

## P2-1：缺 feature provider 时，旧自定义模型的归属会丢失

`sync-env.py` 的 current/provider 分支只读 feature provider；缺省就按迁移默认设为 DeepSeek，没有考虑该模型原先继承的非 MiMo 全局 provider。

本地临时 fixture 复现：旧全局 provider=openai、quizGrade 仅配置自定义 GPT 模型、没有 feature provider → candidate 变成 DeepSeek provider，但保留原自定义模型字符串。应用的兼容检查会舍弃不匹配模型，改用 DeepSeek 默认。因此不是可利用漏洞，而是自定义配置被静默改变。

建议：解析旧全局 provider 以补全显式 feature model 的来源；保留完整非 MiMo 配置对，或明确本次授权确实覆盖这类隐式配置。实际旧 env 是否有该组合由 root 核验；不能据 fixture 说当前生产已发生。

## P2-2：JS apply 没绑定 probe 的 gitSha

`probe-deepseek.py::fresh` 比较 gitSha，但 `migrate-text-ai-settings.mjs::verifyProbe` 只比较成功标记、时效、模型、endpoint、key。相同 key/endpoint 的另一提交在 10 分钟内生成的 proof，也能供直接 apply 使用；现有单测 proof 甚至没有 gitSha。

建议：若要求“被测发布版本与迁移版本相同”，补 `probe.gitSha === APP_GIT_SHA`，并拒绝缺失身份；可同时记录策略指纹供事后对账。常规 `deploy-release.sh` 每个 SHA 生成自己的 proof，现有编排暂时降低风险；此项是脚本独立调用的证据绑定缺口，不代表 root 的真实探测失效。

## P2-3：文件 fsync 不等于完整跨故障原子性

`privateJson` 先以 wx/0600 写文件并 file.sync，随后提交数据库；但没有 fsync 父目录。正常异常路径的 receipt-before-commit/CAS 恢复有保障，主机突然断电时“新文件名已持久化”未被证明，不能称数据库与文件系统整体原子。

建议：对私有备份/receipt 创建后同步父目录；明确断电恢复先核对 receipt 与数据库状态。Python probe/candidate 使用 write_text 后 chmod，也不是临时文件原子替换；部署 umask077 保证当前私密性，建议临时文件+replace 以免崩溃留下损坏 JSON。当前 JS 已避免覆盖已有 receipt，这是正确的保护。

## 还需要的验收

在隔离容器链路注入“迁移提交成功、应用 readiness 失败”，确认旧 env/current/Compose 恢复、CAS 仅回退本次且未被教师编辑的行；保留备份、receipt 和失败状态供检查。再分别测试 key/endpoint/gitSha 改变、proof 过期、receipt 写入失败。此类测试不应通过在生产注入故障完成。
