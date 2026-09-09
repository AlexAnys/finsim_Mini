# Pilot AI r2 — DeepSeek 文本迁移

用户已明确授权文本及批改迁移 DeepSeek，语音/OCR 保持原 provider/model。AI builder 未执行生产或本地数据库迁移；由 coordinator 与部署流程执行有界真实验证后应用。

## 单源策略

`lib/ai/text-model-policy.json` 同时供运行时、教师工具定义和数据库迁移使用。

| 模型 | 用途 |
|---|---|
| deepseek-v4-flash | 模拟对话、学习伙伴与总结、文档识别后的文本解析、测验简答/概念标签、题目解析 |
| deepseek-v4-pro | 模拟对话批改、主观题批改、素材任务草稿、Quiz/主观题生成、实例/周洞察、教案完善、思政挖掘、试卷检查 |

选择优先级：教师显式设置 → feature 环境模型 → provider 全局模型（若非空）→ 单源 feature 策略。部署不能把 DEEPSEEK_MODEL 强制默认 Flash，否则会覆盖 Pro 分工；infra 已协调按各 feature 注入或留空全局模型。

默认 provider/fallback provider 均为 DeepSeek；Pro 的运行请求失败可 fallback 到 Flash，同 Flash 不重复 fallback。不自动回到 MiMo。保留教师主动选择其它 provider 的兼容能力。

`app/api/ai/speech-to-text/route.ts`、`lib/services/document-ingestion.service.ts` 的语音/OCR 选择未改；迁移白名单不包含 ocr、speechToText 等键。文档 OCR 完成后的结构化文本解析属于文本迁移范围。

## 幂等设置迁移

脚本：`scripts/ops/migrate-text-ai-settings.mjs`。

本机使用 Node 22 的 `--env-file=.env` 读取私有环境；镜像内直接使用注入的环境。默认 dry-run 不写数据库；加 `--backup-dir` 可以只生成私有审阅备份。

```sh
node --env-file=.env scripts/ops/migrate-text-ai-settings.mjs --backup-dir /absolute/private-backup
node scripts/ops/migrate-text-ai-settings.mjs --apply --backup-dir /private-migration --probe-result /private-migration/deepseek-probe.json --receipt-path /private-migration/settings-migration-receipt.json
node scripts/ops/migrate-text-ai-settings.mjs --restore-receipt /private-migration/settings-migration-receipt.json
```

- 仅选当前 provider=mimo 且 toolKey 位于文本白名单的记录，包括 legacy simulation；其它 provider、自定义未识别工具、语音/OCR 记录跳过。
- 仅改 provider/model；保留教师 prompt、thinking、temperature 等其余字段。
- apply 前校验 infra 真实 probe：Flash+Pro 成功、10 分钟内、keyHash 与活动 key 一致、规范化 endpoint 与实际配置一致且为官方 HTTPS；APP_GIT_SHA 非空时还要求 probe.gitSha 相同。
- 原映射先以 0600 写到 0700 私有目录并 fsync，再事务逐行 CAS（id/provider/model/updatedAt）；若教师修改过则整笔回滚。
- 迁后 receipt 的文件和父目录在事务提交前执行 fsync，绑定数据库指纹与迁后 updatedAt；这里只声明系统同步调用已完成，不作底层存储断电保证。部署后续失败时，即使进程在 commit 后 stdout 前终止，也能通过固定 receipt 路径恢复；只恢复本次未被再次修改的 provider/model，其它行跳过。
- 重跑已迁移数据库时 planned=0/changed=0。stdout 仅数量和私有文件路径，不含用户 ID、prompt 或 API key。
- CLI 异常仅说明未正常结束，要求检查 receipt 和数据库；不保证提交确认丢失时“绝未改库”。

infra 已接手 Docker COPY、probe/env/compose 与部署调用；真实 key 刚由 coordinator 验证，迁移脚本不会因只读 /models 成功而跳过真实模型检查。

## 验证

- 7 个定向文件 **64 / 64 测试通过**；原始结果 `/Users/yangsenan/Documents/Codex/reviews/finsim-2026-09-09/implementation/deepseek-r2-vitest.json`。
- 新增迁移/策略 7 项：所有 feature 与 UI 单源默认一致、白名单、私有 dry-run 备份、保留字段、幂等、probe/endpoint 校验、CAS 并发拒绝及仅恢复自身未更改映射。
- 变更代码/CLI/测试 ESLint 与 diff 空白检查通过。
- 尚需 coordinator 统一 typecheck/全套测试与真实 DeepSeek UI/三类批改验证；不把受控 fixture 通过当作真实模型效果证明。

## 最后两项独立 QA 修正

- apply proof 额外绑定非空 APP_GIT_SHA，避免直接 CLI 重用另一候选提交的证明。
- privateJson 同步文件后同步父目录；父目录同步失败会使迁移事务失败，不提交设置更新。
- 只修改以上两项及测试：迁移测试 **9 / 9** 通过，包含错误 SHA 拒绝/匹配 SHA 接受、receipt 目录同步失败回滚；ESLint 与 diff 检查通过。原始结果在 implementation/deepseek-r2-final-migration-tests.json。
- 最终源码冻结；后续由 coordinator 完成统一验证和发布。
