# Deployment Details

## Git Remote

- GitHub: `AlexAnys/finsim_Mini`（私有仓库）
- Remote: `origin` → `https://github.com/AlexAnys/finsim_Mini.git`

## CI/CD Pipeline (GitHub Actions)

两个 workflow，位于 `.github/workflows/`：

| Workflow | 触发条件 | 作用 |
|----------|---------|------|
| `ci.yml` | PR + push 到非 main 分支 | 类型检查 + lint + 测试 + Docker 构建验证 |
| `deploy.yml` | push 到 main | 质量检查 → 构建镜像推送 ghcr.io → SSH 部署到服务器 |

## 镜像仓库

- `ghcr.io/alexanys/finsim_mini`
- 每次部署打两个 tag：`:latest` + `:<git-sha>`

## 生产服务器

- 地址：`47.100.98.69`，端口 3000
- 部署目录：`/opt/finsim/`
- `.env` 在服务器上 `/opt/finsim/.env`，不由 CI/CD 管理
- 部署方式：GitHub Actions SSH 到服务器 `docker compose pull app && docker compose up -d`

## 日常开发部署流程

```
feature 分支开发 → git push → CI 自动检查
    ↓ 通过后
创建 PR → merge 到 main → Deploy 自动触发
    ↓
GitHub runner 构建镜像 → push ghcr.io → SSH 部署到服务器
```

## 关键命令

```bash
# 推送代码（触发 CI）
git push origin <branch>

# 合并到 main（触发部署）
git checkout main && git merge <branch> && git push

# 回滚（在服务器上）
IMAGE_TAG=<旧sha> docker compose up -d

# 本地开发（不走 CI）
docker compose up --build
```

## docker-compose.yml 双模式

- `image` + `build` 同时存在
- 本地开发：`docker compose up --build`（使用 build 构建）
- 生产部署：设置 `IMAGE_TAG` 环境变量，`docker compose pull app`（拉取 ghcr.io 镜像）

## GitHub Secrets（已配置在仓库 Settings）

- `SERVER_HOST` — 服务器 IP
- `SERVER_USER` — SSH 用户
- `SERVER_SSH_KEY` — SSH 私钥
- `GITHUB_TOKEN` — ghcr.io 认证（自动提供）
