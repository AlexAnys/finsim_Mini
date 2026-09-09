# Build — pilot infra r1

基线origin/main 5dd4f43；共享worktree codex/pilot-reliability。仅实现/定向验证，未commit/push、未执行生产写入或发送外部消息。

## 改动

- `.harness/scripts/task_state.py`、WORKFLOW、三角色定义、CLAUDE/AGENTS：当前任务→spec/分支/代码指纹/实际环境/独立QA绑定；含untracked和已提交代码。Stop改确定性轻检查，无任务/讨论不阻断，过期PASS拒绝，重复Stop不无限续跑。Skill白名单可调用。新ledger带锁/原子写，旧TSV/报告不改；archive仅复制完成证据、拒绝覆盖、不删除原件。
- Next/eslint-config-next固定16.3.4，React/ReactDOM19.2.8；pilot node_modules原为symlink，仅unlink这个链接后npm ci安装独立依赖。原项目node_modules未修改。Next agentRules:false，防next dev自动改写AGENTS污染QA。
- Docker运行依赖从package-lock对应production树复制，Prisma CLI不再无锁安装；Node Docker/CI改22 LTS。两compose显式传CRON_TOKEN、各AI feature provider/model和构建SHA，不强制覆盖mimo/切换deepseek。
- `/api/version`返回真实APP_GIT_SHA（未冻结development）、APP_ENV和非密钥路由配置configHash（含provider BASE_URL，区分mock/real）；`/api/health/ready`做LIMIT0检查必要新表/字段，失败503且不输出DB错误。Playwright共享配置在suite前后断言待测SHA与ready。
- `scripts/ops`统一发布：SHA新目录干净解包，现有环境候选更新，等待DB就绪，迁移前数据库+uploads私有备份，迁移后切current/根compose，same-SHA ready后写部署状态。保留旧镜像/配置以便应用回退，绝不自动回滚数据库。根compose+固定project+根.env兼容既有health-guard入口。
- Host cron部署接release/job/AI-run补偿、生产周报及每日私有备份；保留原健康策略，无云防火墙改动、不reseed。GitHub Secrets注入CRON/provider key，Variables可显式设各feature选路；空值保留server当前值。server ops按宿主Python3.6语法/标准库可用API编写。

## 验证

- `.github/scripts/tests`：33 tests PASS（原路由文档检查+16个新行为fixture）。覆盖新增/已提交文件fingerprint、QA中修改、报告不改sourcehash、无任务Stop、过期Stop只阻一次、错误环境、并发写ledger、归档保留原件、干净release删除旧源码、archive路径穿越/同SHA异内容拒绝、env保留原模型/安全引用/缺CRON提前失败。
- `tests/health.test.ts`：5 tests PASS（真实SHA/no-store、development、mock/real端点configHash不同、DB失败503不泄密、DB成功ready）。
- 全workflow YAML以js-yaml解析通过；prod/staging `docker compose config`使用纯fixture env通过，确认project、按SHA镜像、CRON及feature选路实际传入。
- ops/harness shell通过bash -n；ops Python通过3.6语法解析（非宿主执行）。getenv和archive逻辑的fixture真实执行在本地Python。
- 后续由coordinator统一tsc/vitest/lint/build与真实staging验收；本报告不声称Docker生产构建/host cron/备份恢复已完成。

## 边界和剩余验收

- 完整部署前必须在GitHub/服务器配置CRON_TOKEN；模型密钥此前实查401，本实现保留默认与现值，不把mock成功当实际模型可用。
- 本地备份目录700/文件600，含DB、uploads、runtime.env和校验；不是异地灾备。pg_restore --list/gzip -t只验证结构；生产投用前仍需隔离恢复演练、异地受限目标与容量/保留策略。未自动删除旧数据/备份。
- 当前工作区仍WIP：源文件冻结commit后，设置实际APP_GIT_SHA并重启候选服务，再初始化task ledger并进行正式独立QA。开发期不把新代码假标旧base SHA。
- 官方安全依据：Next 8月25日公告最低16.3.3；8月31日16.3.4是安全更新后的修补版。https://nextjs.org/blog/august-2026-security-release ，https://github.com/vercel/next.js/releases/tag/v16.3.4 。

## 独立QA回修与E2E集成

- 独立QA指出并复现的3项已修：partial promotion在第一次配置写入前激活rollback；full QA要求HEAD=expected_sha且无非证据dirty/untracked文件；cron以业务failed/markedFailed/results[].ok判断，不能用HTTP200冒充成功。AI builder同时修weekly降级状态。独立r2复核通过，见implementation/infra-qa-probe-results-r2.json（外部审查目录）。
- 补next-auth精确5.0.0-beta.32安全更新，移除旧PostCSS override后实际8.5.23；上传默认改私有./data/uploads，旧文件不移动/删除。
- ready/version增加DB地址/端口/库名的非密钥hash，pilot fixtures先核对app和DB身份再写数据；suite前后比较configHash/databaseHash。
- 永久playwright.pilot.config.ts + tests/e2e/pilot + full-only pilot-ci.sh接入quality；PR-only与手动dispatch避免push重复跑，strict base update→新head的synchronize仍重验。纯文档不装浏览器/不起DB。CI owns进程组和随机容器，拒绝占用端口，清理只作用于自身资源。
- 6条真实UI/API/隔离PostgreSQL链WIP均已分别跑通：教师UI发布主观题+DOCX→提取/请求内容→公布撤回/软删恢复；fixed快照正确/答案不可见/重放幂等；adaptive2题从5题库4/4；simulation真实SSE回合并入库80/100；503不当零分公布+retry恢复；首次20并发同requestId→1submission+1job。上游是loopback协议fixture，非真实模型效果验证。正式冻结commit后需要整套6例再次通过。
- E2E另发现真实UI允许无评分标准的主观题发布，grader拿空rubric；已反馈app builder补发布守卫/明确默认，不将这点当单纯mock错误忽略。
