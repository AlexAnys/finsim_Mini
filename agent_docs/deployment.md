# Deployment Details

## Git Remote

- GitHub: `AlexAnys/finsim_Mini`（公开仓库）
- Remote: `origin` → `https://github.com/AlexAnys/finsim_Mini.git`
- main 受 branch protection 保护：必须 PR + `quality` + `staging-deploy` 两个 status check 全绿才能 merge；不关闭或绕过保护。

## CI/CD Pipeline（GitHub Actions）

四个 workflow，位于 `.github/workflows/`：

| Workflow | 触发条件 | 作用 |
|----------|---------|------|
| `ci.yml` | PR opened/synchronize/reopened 或手动dispatch | 先分类；纯文档轻量检查，其余类型检查 + lint + 测试；核心改动打标签 |
| `deploy-staging.yml` | PR 开/同步/重开/转 ready_for_review | 纯文档报告轻量检查成功；其余部署 staging、迁移、健康检查与 Playwright smoke |
| `deploy.yml` | push 到 main（PR merge 触发） | 纯文档只检查文档；其余 tarball→scp→build→docker compose up→prod SHA + schema-ready smoke |
| `cleanup-staging.yml` | PR closed | 纯文档不连接服务器；其余仅在 staging 属于这个 PR 时 down |

分类范围与本地命令见 [按变更范围验证](validation-routing.md)。只有完整路径占用共享 staging 锁；文档失败会明确报告失败，不把整个必需检查留在等待状态。

完整路径的部署架构（不走 ghcr.io）：runner 跑 quality → `git archive` 成 tarball → scp 到阿里云 → 服务器本地 `docker compose build + up`。规避国际带宽问题。

## 干净版本发布与运行身份

完整路径由 `scripts/ops/deploy-release.sh` 统一执行：tarball 解到全新的 `releases/<完整SHA>/`，构建 `finsim-app:<SHA>`（staging为 `finsim-staging-app:<SHA>`），等待 PostgreSQL ready → 私有备份 → migrate → 切换 current/根 compose → 启动 → 校验 `/api/health/ready` 中实际 SHA 与必要数据库列/表 → 安装定时任务 → 写 last-deployed。不会覆盖解包旧源码，不 reseed、不删卷、不自动回滚数据库迁移。

根 `.env` 保留原位置。Compose 顶层 name 固定；根 compose 指向 current 中同名文件，`.env` 的 FINSIM_BUILD_CONTEXT 指向 current，兼容既有 health-guard 的 `/opt/finsim/docker-compose.yml` 入口。运维命令仍应显式传 `--project-directory /opt/finsim --env-file /opt/finsim/.env -f /opt/finsim/docker-compose.yml -p finsim`，staging替换对应目录/项目名。

应用返回 `/api/version`（app、gitSha、environment、非密钥模型路由配置的configHash）和 `/api/health/ready`（数据库及必要schema契约可读才200）。本地未冻结代码标记development；正式QA使用实际候选commit的APP_GIT_SHA。Playwright CI在整套测试前后检查PLAYWRIGHT_EXPECTED_SHA。共享URL的人工作测也要先后看version，不能把旧PR评论当永久版本地址。

运行依赖全部来自package-lock，Prisma CLI来自同一个production依赖树，不再在runner中无锁npm install。Next固定16.3.4、React/ReactDOM19.2.8；Next关闭agentRules自动改写AGENTS。安全依据：[8月官方安全更新](https://nextjs.org/blog/august-2026-security-release)、[16.3.4修补版](https://github.com/vercel/next.js/releases/tag/v16.3.4)。Node镜像/CI使用22 LTS。

## 业务调度、备份与恢复边界

- 两个环境部署都要求CRON_TOKEN。GitHub Secrets注入CRON_TOKEN及已配置的provider密钥；GitHub Variables可显式配置AI_PROVIDER/AI_FALLBACK_PROVIDER及各AI_*_PROVIDER/MODEL。空值保留服务器现值，部署不再强改mimo或擅自切deepseek。Compose显式传入全部已声明feature配置。
- Host `/etc/cron.d/finsim-production` 每2分钟运行公布扫描、job/AI-run补偿；每周一03:30生成周报。staging只跑补偿，不自动消耗周报模型。时点采用服务器本地时区。Python ops兼容当前服务器3.6，依赖现有cron、flock、Docker Compose；没有新增云防火墙规则。
- PR 关闭时，只有归属匹配的 staging 才移除自己的 cron/logrotate，等待在途补偿退出后停栈；停栈失败保留归属记录并报错。生产调度不受影响。
- 每次迁移前及每天03:15，`backup.sh`保存DB custom dump、uploads压缩包、runtime.env、SHA256校验到`ROOT/backups/<UTC时间>/`；目录700/文件600，不在public/uploads或Web目录。先验证pg_restore目录和gzip结构再标成功。DB和文件分步快照不等价于跨存储事务快照，需实际恢复演练。
- `ROOT/deployment-history/<时间>/`留前一env/compose与本次backup路径。部署失败恢复旧应用配置，保留已做的迁移和所有数据；不执行破坏性数据库回滚。新schema变更应保持旧版本至少可读，不能用应用回滚代替schema恢复计划。
- 不自动删除备份/旧release；达到容量阈值时应转移和核验后再明确清理。**服务器本地备份不等于异地灾备**：把已校验备份另存到独立受限存储；凭据、目标和保留时长由部署负责人配置。本流程不会擅自上传学生资料。
- 正式投用前，在隔离PostgreSQL库恢复database.dump（pg_restore --exit-on-error），解压uploads到隔离目录，校验记录数/附件读回/代表性成绩。只检查dump目录不能声称恢复成功。生产或共享staging重置需要单独明确意图。

检查最近调度可读ROOT/last-cron-frequent.json及last-cron-weekly.json；失败细节写私有cron.log/backup.log，按周轮转，不输出token或学生答案。生产/主机故障通知不由这些脚本自动发送，仍使用现有运维通知渠道。

生产发布会备份并更新现有宿主 health-guard：探测 `/api/health/ready`，保留连续失败阈值、冷却和磁盘观察；恢复命令显式绑定 production 的目录、env 和 compose project，并以 `--no-recreate` 拉起缺失服务。不会把数据库故障时仍可用的登录页当作健康，也不会主动重建正在运行的容器。自定义未知探测 URL 会报错，保留原脚本。

## 生产服务器（finsim.anlanai.cn）

- IP：**`8.153.77.17`**（公司账号阿里云 ECS，cn-shanghai，2 核 4G）
- OS：Alibaba Cloud Linux 8
- SSH：`ssh -i ~/.ssh/finsim_gha root@finsim.anlanai.cn`（公钥指纹 `SHA256:Z18m8t+DJraKpOrlY5HavAFI8JHXvzRqmv8usNCuI8A`）
- 入口：`https://finsim.anlanai.cn` (caddy 反代 → `127.0.0.1:3000`)

旧 IP `47.100.98.69` 是个人账号 1 核 2G，已闲置，不再使用。

### Caddy 反代

容器 `finsim-caddy`（caddy:2-alpine），**host network 模式**，配置文件 `/opt/finsim-caddy/Caddyfile`：

```
finsim.anlanai.cn          → 127.0.0.1:3000   生产
staging.finsim.anlanai.cn  → 127.0.0.1:3001   staging（本流程改造引入）
anlanai.cn                 → 静态 file_server
www.anlanai.cn             → redir anlanai.cn
```

Reload 命令：`docker exec finsim-caddy caddy reload --config /etc/caddy/Caddyfile`

### 生产 stack

- 部署目录：`/opt/finsim/`
- `.env`：`/opt/finsim/.env`，不进 git，由 `scripts/ops/sync-env.py` 创建私有候选文件，部署成功切换时原子更新；未提供的设置保留
- Compose project：默认 `finsim`
- 容器：`finsim-app:3000` + `finsim-postgres:5432`
- Volumes：`pgdata` + `uploads`
- PostgreSQL 宿主端口仅绑定 `127.0.0.1:5432`（staging 为 `127.0.0.1:5433`）；容器内继续使用服务名连接，远程维护使用 SSH 隧道或 `docker exec`。

## Staging stack（本轮新增）

- 部署目录：`/opt/finsim-staging/`
- `.env`：`/opt/finsim-staging/.env`（一次性 `cp /opt/finsim/.env` + 改 `NEXTAUTH_URL=https://staging.finsim.anlanai.cn`，**不进 git**）
- Compose project：`finsim-staging`（命令：`docker compose -f docker-compose.staging.yml -p finsim-staging`）
- 容器：`finsim-staging-app:3001` + `finsim-staging-postgres:5433`
- Volumes：`staging-pgdata` + `staging-uploads`（独立于生产）
- DNS：`staging.finsim.anlanai.cn` A → `8.153.77.17` TTL 600（阿里云 alidns）
- 数据：首次从生产 `pg_dump | psql` 灌入，之后 PR 部署只跑 `prisma migrate deploy`（增量），不 reseed。共享单一栈，不同 PR 之间通过 `concurrency: staging-shared` 串行排队。

### Staging 重置（数据偏离生产太远时）

```bash
ssh -i ~/.ssh/finsim_gha root@finsim.anlanai.cn
docker exec finsim-postgres pg_dump -U finsim -d finsim --clean --if-exists --no-owner --no-acl > /tmp/dump.sql
docker stop finsim-staging-app
docker exec finsim-staging-postgres psql -U finsim -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='finsim' AND pid <> pg_backend_pid();"
docker exec -i finsim-staging-postgres psql -U finsim -d finsim < /tmp/dump.sql
docker start finsim-staging-app
rm /tmp/dump.sql
```

## 日常开发部署流程

先分类。纯说明文档只运行轻量检查，并确认新增媒体的实际展示；两个必需检查成功后正常合并，不部署 staging 或生产。以下为完整验证路径：

```
feat 分支开发 → push → 自动开 PR
    ↓
GitHub Actions 并行跑：
  - ci.yml#quality        类型/lint/test
  - ci.yml#core-change-label  打 core-change 标签（如改 auth/grading/schema/deploy infra）
  - deploy-staging.yml#staging-deploy  部到 staging.finsim.anlanai.cn
    ↓
PR 评论自动出现 staging URL
    ↓
人工在 staging 实测 → 确认无问题
    ↓
点 Squash and merge（branch protection 强制 squash + 合并后删分支）
    ↓
deploy.yml 触发 → tarball → scp → docker compose up → 生产 SHA + schema-ready smoke
    ↓
finsim.anlanai.cn 上线（约 4 分钟）
    ↓
cleanup-staging.yml 同时跑：仅当 staging 当前装的就是这个 PR 时才 down
```

## 关键命令

```bash
# 开新 feat 分支
git fetch origin && git checkout -b <agent>-<topic> origin/main

# 推送（已有 PR 的 synchronize 触发 CI；不开重复 push CI）
git push -u origin <branch>

# 开 PR（先分类，完整路径才起 staging）
gh pr create --base main --fill

# 看 PR 状态
gh pr checks

# 看自己的 staging URL（PR 评论也会自动贴）
echo https://staging.finsim.anlanai.cn

# 回滚生产：在 GitHub UI revert 那个 PR → 自动产生新 PR → merge 后部署回滚
gh pr view <revert-pr-number>
```

## GitHub Secrets（已配置）

- `SERVER_HOST` — `finsim.anlanai.cn`
- `SERVER_USER` — `root`
- `SERVER_SSH_KEY` — SSH 私钥（finsim_gha）
- `MIMO_API_KEY` / `MIMO_BASE_URL` — AI provider key（生产 + staging 共用）
- `GITHUB_TOKEN` — workflow 自动注入，用于 gh pr comment / gh pr edit / gh label create

## 紧急 hotfix 流程

如果 staging 暂时不可用，仍保留 PR 和两个必需检查，不关闭保护或伪造成功。纯文档走正常轻量路径，不受 staging 服务影响；应用变更先定位并修复实际阻塞，再按对应范围验证。紧急发布需要人工决定时，说明具体失败、影响与已验证范围。

## Branch protection 配置

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["quality", "staging-deploy"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

### 本地旧上传目录

未显式配置FILE_STORAGE_PATH时默认使用私有`./data/uploads`。以前未显式配置的本地环境若需旧文件，请暂设`FILE_STORAGE_PATH=./public/uploads`，或显式把文件迁移到私有目录；本次不会移动或删除旧文件。生产/staging Compose一直显式挂载`/data/uploads`，不受这个默认值调整影响。

CI不再同时监听push与pull_request，避免同一候选重复跑完整E2E；strict protection仍要求追平最新base，update-branch生成新head并触发synchronize。手动workflow_dispatch明确走完整路径。标题/正文修改不触发重验。

## DeepSeek文本迁移（用户已授权）

文字交互与常规任务默认V4 Flash，复杂评价/主观批改/生成/洞察用V4 Pro，单源为lib/ai/text-model-policy.json。本次迁移MiMo/空文本默认，不改语音/OCR端点或媒体密钥，其他明确自定义provider/model保留。DEEPSEEK_MODEL默认留空，避免遮盖feature策略。

部署先对官方HTTPS api.deepseek.com的Flash/Pro各做一次真实generation，不能用mock、/models、标签或过期记录通过。私有证明绑定key摘要、端点、两模型与时间；构建/备份过久会有界刷新。有效证明后才迁移DB设置和切配置。settings迁移由新镜像的一次性root进程运行，挂载700权限的deployment-history，不要求宿主Node。迁移前备份映射，事务内落盘固定receipt；后续发布失败先CAS恢复仅本次未被用户改过的provider/model，再恢复旧应用env/image，不逆schema/学生数据。

CI使用同DeepSeek调用路径、loopback协议fixture，正式业务的真实模型验证单独记录。协议E2E不能替代官方模型/密钥成功及教学效果评估。
