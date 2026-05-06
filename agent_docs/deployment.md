# Deployment Details

## Git Remote

- GitHub: `AlexAnys/finsim_Mini`（私有仓库）
- Remote: `origin` → `https://github.com/AlexAnys/finsim_Mini.git`
- main 受 branch protection 保护：必须 PR + `quality` + `staging-deploy` 两个 status check 全绿才能 merge；admin 可紧急 bypass。

## CI/CD Pipeline（GitHub Actions）

四个 workflow，位于 `.github/workflows/`：

| Workflow | 触发条件 | 作用 |
|----------|---------|------|
| `ci.yml` | PR + push 到非 main 分支 | 类型检查 + lint + 测试；触摸核心模块的 PR 自动打 `core-change` 标签 |
| `deploy-staging.yml` | PR 开/同步/重开/转 ready_for_review | tarball→scp→`docker compose -p finsim-staging up`→migrate→curl smoke→PR 评论 staging URL |
| `deploy.yml` | push 到 main（PR merge 触发） | tarball→scp→服务器本地 build→docker compose up→prod /login smoke |
| `cleanup-staging.yml` | PR closed | 仅当 staging 当前装的就是这个 PR 时才 down（owner check 用 `last-deployed-pr` 文件） |

部署架构（不走 ghcr.io）：runner 跑 quality → `git archive` 成 tarball → scp 到阿里云 → 服务器本地 `docker compose build + up`。规避国际带宽问题。

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
- `.env`：`/opt/finsim/.env`，不进 git，由 deploy.yml 在服务器上 `set_env_value` 维护
- Compose project：默认 `finsim`
- 容器：`finsim-app:3000` + `finsim-postgres:5432`
- Volumes：`pgdata` + `uploads`

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
deploy.yml 触发 → tarball → scp → docker compose up → 生产 /login smoke
    ↓
finsim.anlanai.cn 上线（约 4 分钟）
    ↓
cleanup-staging.yml 同时跑：仅当 staging 当前装的就是这个 PR 时才 down
```

## 关键命令

```bash
# 开新 feat 分支
git fetch origin && git checkout -b <agent>-<topic> origin/main

# 推送（push 到非 main 分支触发 ci.yml）
git push -u origin <branch>

# 开 PR（自动起 staging）
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

如果 staging 暂时坏了不能验证，**仍然必须走 PR**（admin 可临时绕过 protection）：

```bash
# 临时关 protection
gh api -X DELETE repos/AlexAnys/finsim_Mini/branches/main/protection
# 直 push hotfix
git push origin main
# 立刻重启 protection（用 deployment.md 里同一份 JSON）
gh api -X PUT repos/AlexAnys/finsim_Mini/branches/main/protection --input <protection.json>
```

事后必须发 ops note 给团队说明绕过原因。

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
