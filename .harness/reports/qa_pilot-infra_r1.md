# 独立 QA — pilot infra r1

**Overall：PASS（限本轮代码审查和隔离故障验证）。** 首轮发现的 3 个缺陷已由 infra builder 修正并重新复现确认。此结论不代表生产部署、备份恢复或整套产品 E2E 已通过。

- Reviewer：AI builder 切换为 infra 的独立 reviewer；没有修改被审的 ops、agent、workflow 源码。
- 基线 origin/main `5dd4f43`，worktree `/Users/yangsenan/dev/Finsim-Mini-pilot`；代码仍未提交。测试所用 infra 文件 SHA256 在外部证据目录 `implementation/infra-qa-source-sha256.json`。
- 当前 task ledger 返回 `no_active_task`；因此没有伪造正式 `qa-start/qa-finish` 或冻结版本 PASS。coordinator 应在提交并运行相同版本后完成正式验收绑定。
- 为核实宿主兼容性进行了只读 SSH：未上传文件、未执行部署/cron/备份/恢复命令。隔离故障 fixture 全在本机临时目录，Docker、网络、迁移与备份成功路径用替身；不会操作线上数据。

## 发现与复核

| Check | Verdict | Evidence |
|---|---|---|
| 部分 promotion 失败必须恢复旧环境 | 修复后 PASS | r1 在替换 `.env` 后制造 `.current-next` 已存在错误，退出 1 但留下新 env + 旧 current。builder 将 `PROMOTED=true` 移到首个变更前；r2 同一失败恢复 old env 和 old current |
| QA 的本地源码必须属于被测 SHA | 修复后 PASS | r1 两种反例都获 PASS：HEAD 相同但源码未提交；HEAD 已新提交但服务仍旧 SHA。r2 两种均在 qa-start 被拒绝，分别报未冻结/HEAD 不匹配 |
| 调度结果必须包含业务失败 | 修复后 PASS | r1 输入 `success:true,data.failed:1,markedFailed:2`，cron 仍记录所有 ok=true。r2 抛失败并写 ok=false，未把 HTTP 成功当业务成功 |
| 错误 SHA 不能通过 ready | PASS | 实际 `verify-ready.py` 对 ready=true 但旧 SHA 的响应拒绝 |
| 坏备份不能发布成功目录 | PASS | 实际 `backup.sh` 注入 pg_restore --list 失败和 uploads 非 gzip；均非 0 退出、零成功备份目录、pending 删除、原 env 保留 |
| 旧 health-guard 的根 compose 入口 | PASS | 本地构造 root compose→current symlink，从 cwd `/` 使用旧命令形态 `docker compose -f <root>/docker-compose.yml config`，正确得到项目 finsim、SHA 镜像和 current 构建路径 |
| 宿主 Python / cron / Compose 前提 | PASS | 生产只读查询：Python 3.6.8、Compose 2.27.0、flock 存在、crond active、logrotate 目录存在。四个 ops Python 模块在该解释器 stdin compile/import 成功，未调用写入函数；另 3.6 AST 解析通过 |
| 旧磁盘维护是否删除回退镜像 | PASS | 宿主脚本只执行 builder prune 限额 + dangling image prune -f，未用 -a，不删除有 SHA 标签的旧镜像 |
| GitHub 必需检查不变 | PASS | 实读 main protection：strict=true，required contexts 仍 quality + staging-deploy；工作流对应名称、文档路由、共享 staging 锁存在，未关闭保护 |
| 既有 30 个 infra fixture | 复用 | builder 已运行。独立审核读过断言后新增上述故障反例，没有再重复无关整套检查 |

### 修复位置

1. `scripts/ops/deploy-release.sh:74`：恢复保护在环境文件/current/compose 切换之前启动，避免只有完成全部切换才可 rollback。
2. `.harness/scripts/task_state.py:99`：full QA 额外要求当前 HEAD = expected_sha，且除证据输出外源码无 staged/unstaged/untracked 改动。
3. `scripts/ops/cron.py:11`：业务响应检查 `failed/markedFailed` 和 `results[].ok`。

另外发现调用方 `app/api/cron/weekly-insight/route.ts` 丢弃 AI 失败空态，返回错误 ok:true。该文件属于 AI builder，本 reviewer 切回 builder 身份修复并补了 `tests/pilot-weekly-cron.test.ts`，返回成功/无数据跳过/失败各自计数。**它不包含在本报告的独立源码 PASS 内**；由 coordinator/APP/infra 的独立 E2E继续验证。模型实际 provider/model 回传也同时修为 onResolved，不再猜 primary。

## 证据文件

目录：`/Users/yangsenan/Documents/Codex/reviews/finsim-2026-09-09/implementation/`

- `infra-qa-probes.py`、`infra-qa-probe-results-r1.json`：最初 3 个失败反例。
- `infra-qa-probes-r2.py`、`infra-qa-probe-results-r2.json`：修复后同场景结果。Mac 上只在临时 PATH 适配 GNU mv 与宿主前提；promotion/rollback 正文采用真实脚本，Docker/迁移不执行。
- `backup-fault-qa.json`：两类备份失败的退出码与文件状态。
- `legacy-guard-compose-qa.json`：旧入口加载新 symlink compose 的解析结果。
- `ops-python36-import-qa.txt`：实际宿主 Python 3.6.8 编译/导入结果。
- `infra-qa-source-sha256.json`：被审 infra 源码身份。

## 仍需正式验收的边界

- 真实 Docker image 构建、迁移前备份、切换后 ready、cron 安装后的实际一次任务和失败回退，应在同一冻结版本的 staging 验证。本轮没有执行线上写入。
- PostgreSQL dump 能列目录、压缩包结构正常，不等于数据恢复成功。需隔离恢复并核对代表性记录、附件、成绩；builder 已明确这点。
- 生产目前没有 current（仍是旧根源码布局），因此第一次迁移到 releases 结构必须覆盖失败回退测试；本次反例验证的是已有旧 current 的恢复。不要把它扩写成首次生产切换已验。
- 备份在本机且没有自动保留上限/异地副本，磁盘压力与灾备仍是明确后续项。
- 同 SHA release 重用依赖现存 release 未被人工改动；当前 `.release.json` 检查 archive 摘要，不重新核验整个已解压目录。暂不作为本次阻断；正式运维应保持 release 目录只读并保留归档。
- 原有 compose 的 AUTH_SECRET/NEXTAUTH_SECRET 嵌套必填插值，在只提供一个变量时本地 Compose 会报另一个缺失；origin/main 已存在。现有部署须保留二者，后续可集中规范。

没有发现关闭 branch protection、伪造必需检查、自动重灌共享数据库、删除历史报告或无限 Stop 续跑的新行为。
