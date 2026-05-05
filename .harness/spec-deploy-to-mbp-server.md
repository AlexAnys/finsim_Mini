# Spec: 部署 finsim_Mini v2 main → finsim.anlanai.cn

> 状态：Phase 0 决策已敲定（用户 2026-05-02），等另一个 agent 完成 xlsx feature 即可启动 Phase 1 builder。

## 用户决策（敲定）

| # | 问题 | 决策 |
|---|---|---|
| D1 | mbp 数据库怎么办？ | **A · 干净 reset**。用户原话"之前里面没什么数据"。pg_dump 仍跑（保险）→ drop → mini migrations from 0 → seed admin/teacher/student。 |
| D2 | 服务器 git 怎么切？ | **blue-green**：在 `/opt/finsim-v2/` 另 clone `finsim_Mini`，不动 `/opt/finsim/`（mbp 旧版）。验证后切 caddy + 删旧。 |
| D3 | 流量怎么切？ | **blue-green**（与 D2 一致）：mini 跑在 3001（避端口冲突）→ caddy upstream 改 → reload → 验证 → 停 mbp。零停机。 |
| 其他 | mbp 旧版处理 | 用户原话"之后 finsim mbp 不需要了, 这个服务器只给 mini 用" → mbp 镜像/容器/db 在 D3 切流量后全部清理。`finsim_mbp` GitHub repo 保留作为参考（不删）。 |

## 调研已确认的事实

### 服务器现状
| 项 | 值 |
|---|---|
| Host | finsim.anlanai.cn (8.153.77.17 / 内网 172.24.32.40) |
| SSH | root + `~/.ssh/finsim_gha`（在用户 mbp 上） |
| 部署目录 | `/opt/finsim/` (git remote = `git@github.com:AlexAnys/finsim_mbp.git`) |
| 现运行容器 | finsim-app / finsim-postgres / finsim-caddy（uptime 9d，全 healthy） |
| Caddy 反代 | 独立 compose `/opt/finsim-caddy/`（保留，仅改 upstream） |
| .env | `/opt/finsim/.env` 已存在 |
| 资源 | 79G 磁盘 16% 用 / 3.5GB RAM / 64G 空闲 → 双库够 |

### Schema diff（Mini vs mbp）
| 类别 | Mini (v2 main) | mbp (服务器追) |
|---|---|---|
| Model 数 | 40 | 31 |
| Mini 独有（11 个）| AllocationSection, AllocationItem, CourseKnowledgeSource, **AsyncJob**, **TaskBuildDraft**, **AiRun**, **AiToolSetting**, CourseTeacher | — |
| mbp 独有（2 个）| — | CourseCollaborator, FileUpload |
| 部分共享 model 内字段不同 | StudyBuddyPost / Submission 等扩展了字段 | 旧版本 |
| Migration 历史 | 9 个（最新 20260501 async-jobs/task-drafts/ai-runs）| 完全不同的一套 |

→ **prisma migrate deploy 不可用**（_prisma_migrations 表不一致）。必须 drop database。

### Env diff（mini 比 mbp 多哪些 var）
mini 比 mbp 新加：
- MIMO_API_KEY / MIMO_BASE_URL / MIMO_MODEL / MIMO_OCR_MODEL / MIMO_ANTHROPIC_BASE_URL（mini 默认 AI_PROVIDER=mimo）
- OCR_PROVIDER / QWEN_OCR_MODEL / OCR_MAX_PAGES / OCR_MIN_TEXT_CHARS
- CRON_TOKEN
- SEARCH_PROVIDER / SEARCH_API_KEY

mbp 现有（要保留）：
- AI_PROVIDER=qwen / AI_FALLBACK_PROVIDER=deepseek / QWEN_API_KEY / DEEPSEEK_API_KEY 等

策略：**mini 部署时 .env 沿用 mbp 现有 + 补 CRON_TOKEN（如果要用 cron）。MIMO 相关如果用户没付 mimo 账号可不设，自动 fallback qwen+deepseek。**

### 部署架构差异（mini deploy.yml vs mbp deploy.yml）
| 项 | Mini 当前 | mbp（服务器现追）|
|---|---|---|
| deploy 路径 | runner git archive → scp tarball → server build | server git fetch + reset --hard → docker compose up --build |
| 复杂度 | 高（runner + scp + server build）| 低（server 一条 git pull 链路）|
| Mini 这次切 mbp 后 | 切到 git pull 模式（复用 mbp deploy.yml 的成熟模式）|

## Phase 1 · Builder 任务（等另一个 agent 完成后启动）

> ⚠️ 当前 working tree 有另一个 agent 在做的 xlsx + StudyBuddy preview feature 改动。**等他们 commit 完，working tree 干净后**才能启动这一阶段。

### Builder 改动清单

| 文件 | 改动 |
|---|---|
| [.github/workflows/deploy.yml](.github/workflows/deploy.yml) | 删 quality job 的 `quality:` 不变（保留），`deploy:` job 改造为 SSH git pull 模式（参考 mbp `deploy.yml`：fetch + reset --hard origin/main + docker compose up --build + curl health check）|
| [docker-compose.yml](docker-compose.yml) | NEXTAUTH_URL 默认值从 `http://47.100.98.69:3000` 改 `https://finsim.anlanai.cn`；删 ghcr.io image 行（mbp 不走 ghcr.io）|
| [agent_docs/deployment.md](agent_docs/deployment.md) | 全文重写：服务器 finsim.anlanai.cn / SSH root / git pull 部署模式 / Caddy 反代角色 / 47.100.98.69 标记为废弃 |
| [.harness/HANDOFF.md](.harness/HANDOFF.md) | 追加部署目标变更 note |

### 不做的事
- ❌ 不动 schema/services/package（避免与另一个 agent 冲突）
- ❌ 不动 caddy 反代代码（独立 compose 不在仓库里）
- ❌ 不删除 47.100.98.69 GitHub Secret（旧凭据保留作为 fallback，但 deploy.yml 不再 reference 它）

### Acceptance（builder 完成时）
1. tsc --noEmit 0 errors
2. yamllint deploy.yml 通过
3. docker-compose config 验证通过
4. 不引入 schema/services 改动（git diff --stat 应该只显示 deploy.yml + docker-compose.yml + agent_docs/deployment.md + HANDOFF）

## Phase 2 · 用户在 mbp 上跑（高风险纯 ops）

### Step 2.1：诊断 + 备份（10 分钟）
```bash
ssh -i ~/.ssh/finsim_gha root@finsim.anlanai.cn
cd /opt/finsim
docker compose ps
docker compose exec -T postgres pg_dump -U finsim finsim | gzip > /opt/finsim-mbp-backup-$(date +%Y%m%d).sql.gz
ls -lh /opt/finsim-mbp-backup-*.sql.gz
df -h /opt
cat /opt/finsim/.env | grep -v -E '_KEY|_SECRET|_PASSWORD|_TOKEN' > /tmp/env-vars.txt
cat /tmp/env-vars.txt   # 把这个非敏感清单贴给 coordinator 验证 env 完整
```

### Step 2.2：更新 finsim_Mini 仓库 GitHub Secrets（5 分钟）
打开 https://github.com/AlexAnys/finsim_Mini/settings/secrets/actions

| Secret | 新值 | 怎么填 |
|---|---|---|
| SERVER_HOST | `finsim.anlanai.cn` | 直接字符串 |
| SERVER_USER | `root` | 直接字符串 |
| SERVER_SSH_KEY | `~/.ssh/finsim_gha` 私钥内容 | mbp 终端 `cat ~/.ssh/finsim_gha` 复制粘贴到 GitHub UI（不经聊天）|
| SERVER_SSH_PORT | （可不填，默认 22）| — |

## Phase 3 · 双方协作迁移（blue-green）

> Phase 1 + Phase 2 完成后启动。用户在 mbp 上 SSH 跑命令，coordinator 看输出诊断。

### 3.1 准备新部署目录（服务器）
```bash
ssh -i ~/.ssh/finsim_gha root@finsim.anlanai.cn

# 在 /opt/finsim-v2/ clone mini main
mkdir -p /opt/finsim-v2
cd /opt/finsim-v2
git clone git@github.com:AlexAnys/finsim_Mini.git .
git log --oneline -5  # 验证最新 commit

# 准备新 .env（基于 mbp 现有 + 补 mini 新增）
cp /opt/finsim/.env /opt/finsim-v2/.env
# 手动加 CRON_TOKEN（如果要用每周一次 weekly-insight cron）：
# echo "CRON_TOKEN=$(openssl rand -hex 32)" >> /opt/finsim-v2/.env

# 把 NEXTAUTH_URL 改 https
sed -i 's|NEXTAUTH_URL=http://47.100.98.69:3000|NEXTAUTH_URL=https://finsim.anlanai.cn|' /opt/finsim-v2/.env
sed -i 's|NEXTAUTH_URL=http://localhost:3000|NEXTAUTH_URL=https://finsim.anlanai.cn|' /opt/finsim-v2/.env
grep NEXTAUTH_URL /opt/finsim-v2/.env  # 验证
```

### 3.2 改 docker-compose 端口避冲突（蓝绿）
mini 的 docker-compose.yml 默认 finsim-app:3000 / postgres:5432。mbp 旧版正占着。临时把 mini 启在 3001：
```bash
cd /opt/finsim-v2
sed -i 's|"3000:3000"|"3001:3000"|' docker-compose.yml
sed -i 's|"5432:5432"|"5433:5432"|' docker-compose.yml  # postgres 也避冲突
sed -i 's|container_name: finsim-app|container_name: finsim-v2-app|' docker-compose.yml
sed -i 's|container_name: finsim-postgres|container_name: finsim-v2-postgres|' docker-compose.yml
```

### 3.3 启动 mini 新栈
```bash
cd /opt/finsim-v2
docker compose up -d postgres
sleep 5
docker compose up -d --build app
docker compose logs -f app  # 观察 startup（Ctrl+C 退出，但容器继续跑）
```

### 3.4 跑 mini migrations + seed
```bash
docker compose exec app npx prisma migrate deploy   # 9 个 migration 全部 apply
docker compose exec app npm run db:seed             # admin/teacher/student 测试账号
```

### 3.5 验证 mini 在 3001 端口能访问
```bash
curl -I http://localhost:3001/login   # 期望 200
docker compose ps                     # 全部 healthy
```

### 3.6 切 caddy upstream
> 这步动 `/opt/finsim-caddy/` 配置。具体改法看 caddy 现有 Caddyfile（用户得先 `cat /opt/finsim-caddy/Caddyfile` 看反代规则）。

骨架：
```bash
cd /opt/finsim-caddy
# 改 Caddyfile 把 upstream 从 finsim-app:3000 改 finsim-v2-app:3000
# （注意：caddy 容器跟 finsim-v2-app 必须在同一 docker network）
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
curl -I https://finsim.anlanai.cn/login  # 验证 https 入口指向 mini
```

⚠️ **如果 caddy 跟 finsim-v2-app 不在同一 network**：先 `docker network connect <caddy-network> finsim-v2-app`。

### 3.7 停旧 mbp + 清理
```bash
cd /opt/finsim
docker compose down                    # 停 mbp app + postgres
docker volume ls | grep finsim_        # 验证 mbp pgdata volume（不删，保留作 archive）
docker image prune -a -f               # 清理 mbp 旧 image
```

### 3.8 把 mini 切回标准端口（一致性）
mbp 容器停掉后，3000/5432 空出来。
```bash
cd /opt/finsim-v2
docker compose down                    # 停
sed -i 's|"3001:3000"|"3000:3000"|' docker-compose.yml
sed -i 's|"5433:5432"|"5432:5432"|' docker-compose.yml
sed -i 's|container_name: finsim-v2-app|container_name: finsim-app|' docker-compose.yml
sed -i 's|container_name: finsim-v2-postgres|container_name: finsim-postgres|' docker-compose.yml
docker compose up -d
# caddy 反代回 finsim-app:3000，跟最初 mbp 状态一致
docker compose exec -w /etc/caddy caddy caddy reload  # （如果改 Caddyfile 也要 reload）
```

### 3.9 把 git 主部署目录改名（lock-in）
```bash
mv /opt/finsim /opt/finsim-mbp-archive    # 旧 mbp 部署目录归档
mv /opt/finsim-v2 /opt/finsim             # mini 成为新 /opt/finsim
```

### 3.10 git push origin main 验证 CI/CD
```bash
# 在用户笔记本上（不是服务器上）
git push origin main --force-with-lease  # 因为 origin/main 还停在旧 main
# GitHub Actions 触发 deploy.yml → SSH 到 finsim.anlanai.cn → git pull + 重 build
gh run watch  # 看 deploy 进度
```

## Phase 4 · 端到端验证

按 v2-migration spec R1+R2 的核心点（不重跑全部）：
1. https://finsim.anlanai.cn/login 200 + V4 Aurora 渲染
2. teacher1 登录 → 仪表盘加载
3. AI 一周洞察 / sim chat 触发一次（确认 mbp env 的 qwen/deepseek key 工作）
4. caddy 日志看流量（`docker compose logs -f caddy`）

## 风险 + 回滚

| 风险 | 触发 | 回滚 |
|---|---|---|
| migrations fail | mini 9 个 migration 中某个 SQL 错 | 修 schema → 重 push → 自动 redeploy |
| caddy reload fail | Caddyfile 语法错 | `caddy validate` 先验，回滚 Caddyfile |
| .env 缺关键 var | NEXTAUTH_SECRET / DEEPSEEK_API_KEY 漏 | 加进 `/opt/finsim/.env` → restart app container |
| 旧 mbp 容器跟 mini 端口冲突 | sed 漏改 | 看 `docker ps` + `lsof -i:3000` |
| 服务器磁盘满 | docker image 累积 | `docker image prune -a -f` |

完整回退到 mbp：`cd /opt/finsim-mbp-archive && docker compose up -d`，caddy upstream 改回 `finsim-app:3000`。

## Acceptance Criteria（最终成功）

1. ✅ `git push origin main` 触发 deploy.yml 5-15 min 完成
2. ✅ https://finsim.anlanai.cn/login HTTP 200 + V4 Aurora
3. ✅ teacher1 登录成功
4. ✅ caddy https 工作
5. ✅ Postgres mini 数据库正常
6. ✅ mbp 旧容器已停 + 旧目录归档
7. ✅ origin/main = local main HEAD（diverged 解除）

## 不做的事

- ❌ 不接触 SSH 私钥（用户自己粘贴到 GitHub UI）
- ❌ 不动 caddy 容器本身（只改 upstream + reload）
- ❌ 不删 mbp git 历史（仓库另在 GitHub）
- ❌ 不删 mbp pgdata volume（保留作 archive，磁盘空间够）
