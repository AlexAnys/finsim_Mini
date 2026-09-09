# Build — pilot infra r2 · 已授权DeepSeek文字迁移

用户已明确授权文本/批改迁到DeepSeek，保留语音/OCR。此轮只修改repo，不执行生产迁移；真实业务probe由coordinator负责。

- 环境模型策略来自lib/ai/text-model-policy.json；默认Flash，复杂评价/主观批改/生成/洞察Pro。sync-env迁旧MiMo/空文本默认，保留明确非MiMo自定义pair；DEEPSEEK_MODEL留空，不遮盖各feature模型。MiMo/Qwen媒体密钥、端点、OCR配置保留服务器现值。
- prod/staging Compose及.env.example同步策略，CI显式DeepSeek默认+loopback3189协议mock，覆盖真正DeepSeek调用分支；不是实际模型效果测试。
- probe-deepseek.py只允许官方HTTPS api.deepseek.com、不跟随重定向，Flash/Pro各一次实际非流式generation，非/models或label判断。私有JSON绑定keySha256/baseURL/at/models；stdout不输出keyHash、key、headers、content。invalid endpoint/key/HTTP失败不能通过gate。构建及备份耗时后按300s阈值有界刷新，供10min校验使用。
- Docker明确COPY迁移mjs与policyJSON，迁移在新镜像一次性root进程中执行，HISTORY700目录bind到/private-migration；常驻应用仍nextjs。schema迁移后、活跃env切换前执行幂等settings迁移。
- rollback先依据固定receipt做CAS设置恢复，再恢复旧env/image；只还原本次迁移且未被别人改过的provider/model，不逆schema/学生数据。即使commit后CLI输出前崩溃，也按receipt文件存在处理；事务未提交时CAS自然不会覆盖旧值。
- 独立API/UI发现的缺rubric发布已由app builder修；pilot teacher用例加真实400与0Task/0Instance残留断言并跑通。此前6链均已WIP通过，正式freeze后由QA整套验证。

定向检查：Python fixtures加入真实probe合同/官方域名强制/401不重试与不误PASS/旧媒体配置保留；workflow YAML与shell解析；后续统一tsc/build、正式6链由coordinator安排。官方请求依据：https://api-docs.deepseek.com/api/create-chat-completion/ ，https://api-docs.deepseek.com/guides/thinking_mode/ 。
