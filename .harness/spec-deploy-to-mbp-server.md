# Spec 草案: 部署 finsim_Mini v2 main → finsim.anlanai.cn 服务器

> 草案状态：等用户拍板核心决策点（Phase 0）后切到 spec.md，再 spawn builder

## 用户原话

> "下面是 mbp SSH信息 这个你看下怎么更新到mini项目中, 后续把新版main分支推送到 finsim.anlanai.cn"

## 调研已确认的事实

### 服务器现状（用户卡片信息 + gh API）

| 项 | 值 |
|---|---|
| Host | `finsim.anlanai.cn` (8.153.77.17 / 内网 172.24.32.40) |
| SSH | `root` + `~/.ssh/finsim_gha`（在用户 mbp 上）|
| 部署目录 | `/opt/finsim/` (git remote = `git@github.com:AlexAnys/finsim_mbp.git`) |
| 现运行容器 | finsim-app / finsim-postgres / finsim-caddy（uptime 9d，全 healthy）|
| Caddy 反代 | 独立 compose `/opt/finsim-caddy/`（保留，不动） |
| .env | `/opt/finsim/.env` 已存在（CI/CD 不管）|
| 资源 | 79G 磁盘 16% 用 / 3.5GB RAM 2.5GB free |

### 仓库 schema diff（最大风险）

| 类别 | finsim_Mini (v2 main) | finsim_mbp (服务器追) |
|---|---|---|
| Model 数 | 40 | 31 |
| 新增（mini 独有）| AllocationSection, AllocationItem, CourseKnowledgeSource, **AsyncJob, TaskBuildDraft, AiRun, AiToolSetting**, CourseTeacher（8 个）| — |
| 不同（mini 没有）| — | CourseCollaborator, FileUpload（2 个）|
| Migration 历史 | 9 个（最新 20260501 async-jobs）| 完全不同的一套 migration 历史 |

**结论：mini 的 `prisma migrate deploy` 跑在 mbp 数据库上会失败**（_prisma_migrations 表记录不一致）。

## ⚠️ Phase 0 · 用户必须拍板的决策（destructive，需明确同意）

### D1：mbp 服务器现有数据库怎么处理？

| 选项 | 操作 | 风险 / 收益 |
|---|---|---|
| **A · 干净 reset**（推荐）| pg_dump backup → drop database → mini migrations from 0 → seed admin/teacher/student | 数据丢失但 schema 干净；后续可从 backup.sql 选择性手动 import 特定 model |
| **B · 渐进迁移** | 写 manual SQL bridge migration（mbp schema → mini schema） | 极复杂高风险，1-2 天工时；适合数据非常重要的场景 |
| **C · 双库并行** | 服务器上启第二个 postgres container 用新 db；旧 mbp db 冻结 | 资源占用 ×2；一定时间后清理 |

**问题**：mbp 服务器跑了 9 天，里面有多少真实测试数据？是否值得保留？  
→ 用户给我答案，我才能决定 D1。

### D2：是否完全替换 git remote？

服务器 `/opt/finsim/.git` 现在 remote 是 `finsim_mbp`。要切到 `finsim_Mini` 必须：

```bash
git remote set-url origin git@github.com:AlexAnys/finsim_Mini.git
git fetch origin
git reset --hard origin/main  # ← destructive：丢失 mbp 仓库 git 历史在该 worktree 的痕迹
```

替代方案：先在服务器另外 clone `finsim_Mini` 到 `/opt/finsim-v2/`，新旧并行 → 切流量后再删 mbp 那个。**资源够（64G 空闲），推荐这个**。

### D3：何时切流量？

mbp 服务器 caddy 反代当前指向 `finsim-app:3000`（mbp 容器）。新 finsim-app（mini）跑起来后必须切 caddy：

| 选项 | 操作 |
|---|---|
| **A · in-place** | 停 mbp finsim-app → 起 mini finsim-app（同 container name 同端口）→ caddy 自动指新；停机 ~30s |
| **B · blue-green** | 起 mini 在 3001 → 修 caddy 上游 → reload caddy → 验证 → 停 mbp；零停机但要改 caddy 配置 |

## Phase 1 · 我现在能做（不动服务器）

| # | 任务 | 谁做 |
|---|---|---|
| 1.1 | 写本 spec | coordinator ✅ |
| 1.2 | 改 [.github/workflows/deploy.yml](.github/workflows/deploy.yml) 切到 git pull 模式（替代当前 scp 模式，与 mbp deploy.yml 对齐）| builder |
| 1.3 | 改 [docker-compose.yml](docker-compose.yml) 默认 `NEXTAUTH_URL` 从 `http://47.100.98.69:3000` 改 `https://finsim.anlanai.cn`（不影响双模式）| builder |
| 1.4 | 改 [agent_docs/deployment.md](agent_docs/deployment.md) 更新服务器地址 + 备注 47.100.98.69 已废弃 | builder |
| 1.5 | 把服务器接入信息归档到 [.harness/server-finsim-mbp.md](.harness/server-finsim-mbp.md)（.harness/ 在 .gitignore 内不进 git 公开）| coordinator ✅ |

## Phase 2 · 用户在 mbp 上跑（高风险纯 ops，不能让 agent 替代）

⚠️ **私钥永远不能粘贴到聊天里**。涉及 `~/.ssh/finsim_gha` 和 `.env` 内容时，用户在 mbp 终端跑命令，输出非敏感部分给我即可。

### Step 2.1：诊断 + 备份

```bash
ssh -i ~/.ssh/finsim_gha root@finsim.anlanai.cn

# 在服务器上跑
cd /opt/finsim
docker compose ps                       # 容器健康
docker compose exec postgres psql -U finsim -d finsim -c "\dt"  # 看现有表
docker compose exec postgres pg_dump -U finsim finsim | gzip > /opt/finsim-mbp-backup-$(date +%Y%m%d).sql.gz
ls -lh /opt/finsim-mbp-backup-*.sql.gz  # 验证 backup 文件大小
df -h /opt                              # 确认有空间
cat /opt/finsim/.env | grep -v -E '_KEY|_SECRET|PASSWORD' > /tmp/env-vars.txt  # 把非敏感 var 名导出
cat /tmp/env-vars.txt                   # 这个可以贴给我看哪些 vars 有
```

### Step 2.2：更新 finsim_Mini 仓库的 GitHub Secrets

在浏览器打开 https://github.com/AlexAnys/finsim_Mini/settings/secrets/actions：

| Secret | 旧值（阿里云）| 新值 |
|---|---|---|
| `SERVER_HOST` | `47.100.98.69` | `finsim.anlanai.cn` |
| `SERVER_USER` | （旧用户）| `root` |
| `SERVER_SSH_KEY` | （旧 key）| **`~/.ssh/finsim_gha` 私钥内容**（用户在 mbp 终端 `cat` 后**直接粘贴到 GitHub UI**，不通过聊天）|
| `SERVER_SSH_PORT` | （未设）| `22`（可选，默认 22）|

## Phase 3 · 双方协作迁移（按 D1/D2/D3 决策走）

具体步骤待 D1/D2/D3 拍板后展开。骨架：

1. 备份 mbp db ✅（Phase 2 已做）
2. 在服务器 clone finsim_Mini 到独立目录（D2 选 blue-green）
3. 准备新的 .env（基于 /opt/finsim/.env + mini 新增 vars）
4. 跑 mini migrations + seed
5. docker compose build + up（新容器，不冲突端口）
6. 验证：登录 + 跑 R1+R2 部分手动闭环
7. 切 caddy upstream（D3）
8. 停旧 mbp 容器 + 清理
9. 触发 GitHub Actions deploy.yml 验证 CI/CD 链路

## Phase 4 · 验证

1. https://finsim.anlanai.cn/login 200 OK + V4 Aurora 渲染
2. 创建 admin → 测一个 task instance → 学生提交一次（Phase 4 要不要测，看用户优先级）
3. 阿里云 47.100.98.69 上 mini 旧版本可关（用户决定）

## Acceptance Criteria（最终成功）

1. ✅ `git push origin main` 触发 deploy.yml → 5-15 min 完成
2. ✅ https://finsim.anlanai.cn/login HTTP 200，V4 Aurora 渲染
3. ✅ teacher1@finsim.edu.cn / password123 登录成功（如选 D1.A 干净 reset 后 seed）
4. ✅ caddy 反代 + HTTPS 工作
5. ✅ Postgres 数据持久（pgdata volume 不变）
6. ✅ 阿里云 47.100.98.69 上 mini 旧版本可正常停机（zero traffic 后 docker compose down）

## 不做的事（保护现有 mbp 服务）

- ❌ 不动 caddy 反代配置（独立 compose 不碰）
- ❌ 不删 mbp git 历史（仓库另在，本地 .git 切 remote 即可）
- ❌ 不接触 SSH 私钥（用户自己粘贴到 GitHub Secrets）
- ❌ 不在 commit 前推 origin/main（用户已说"先别 commit"）
