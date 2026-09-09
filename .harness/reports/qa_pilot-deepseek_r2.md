# DeepSeek 迁移 · 独立 QA r2 闭环

2026-09-09。仅复核 r1 提出的三处小改动、对应回归代码与已有结果文件；未改实现、重跑测试、连接数据库或执行线上写入。本页更新 r1 的问题状态。

| r1 项目 | 本轮确认 | 状态 |
|---|---|---|
| 隐式 custom 模型归属丢失 | `sync-env.py` 在覆盖默认值前记录旧全局 provider；feature 只有自定义 model 时补回原来的非 MiMo provider。新 Python 回归覆盖原复现组合，同时保留文本默认迁移和媒体字段不变。 | 已闭环 |
| apply proof 缺提交绑定 | `verifyProbe` 在 APP_GIT_SHA 非空时要求 proof.gitSha 完全相同；实际部署会设置候选完整 SHA。新增测试先拒绝错 SHA，再验证匹配时可迁移。无候选 SHA 的独立手动调用保留旧行为，不宣称它具备提交绑定。 | 部署路径已闭环 |
| receipt 新文件名未同步 | `privateJson` 完成文件 sync 后再打开父目录并 sync；异常继续抛出，迁移事务不能提交。新增测试专门让第二次目录 sync（receipt，而非备份）失败，验证两条设置保持原值。Python proof 改为 0600 临时文件、文件 sync、原子 replace，并能从损坏缓存恢复为重新探测。 | 已闭环；仅保证所声明的 OS 同步，不承诺硬件断电零风险 |

证据读取：`implementation/deepseek-r2-final-migration-tests.json` 为 **9/9**；最新 `implementation/vitest-candidate.json` 为 **1367/1367**，其中也包含上述两个迁移新用例。Python 38/38 为 infra 本轮执行结果，本 QA 核对了新增 custom 继承与 proof 原子替换测试源码，没有另行重跑或将旧 `infra-tests-final.log` 的 33 条误记为 38 条。

未发现这三处修正引入新的阻断。原有范围限制、私有备份、字段保留与 CAS 回滚逻辑仍在；r1 关于“真实容器提交后失败恢复”和硬件断电保证的证据边界继续保留，不把本次只读复核写成故障注入完成。停止扩展审查，交 coordinator 冻结提交、正式 E2E 与 PR。
