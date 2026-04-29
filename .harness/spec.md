# Spec: 部署路径切换 + Dockerfile 优化

## 用户原话
> "无法正常推送到阿里云服务器......你先来研究下最近构建失败的原因......先改了 A+E，改完我们走服务器直接构建吧，后续服务器出问题再切 A+E"

## 诊断（已确认）

最近 deploy 失败 = 阿里云从 ghcr.io 拉镜像超时（120m timeout），不是构建问题。

**核心根因**：每次部署服务器要拉 ~400MB 的"应用层"，按 13KB/s 国际带宽算需要 8h+。

**为什么"增量传输"没生效**：
- Next.js standalone build 每次生成新 `BUILD_ID` → standalone 层 content hash 必变
- `COPY . .` 在 builder 阶段宽松，任何项目文件改动都让后续层 invalidate
- runner 阶段 `RUN npm install prisma@6.19.2`（50MB）每次也重做
- `.dockerignore` 太单薄，`.harness/`/`agent_docs/`/`public/uploads/` 都进 build context

## 目标 / 验收标准

**主路径**：服务器直接构建（git push → quality 检查 → scp 源码 → 服务器 docker compose build + up）

1. ✅ `git push origin main` 触发 deploy workflow
2. ✅ quality job（typecheck + lint + test）跑通
3. ✅ 源码 tarball scp 到阿里云服务器（应小于 50MB，因 git archive 不含 .git）
4. ✅ 服务器 docker compose build app 成功（首次约 5-10 分钟，后续因 docker layer cache 应小于 5 分钟）
5. ✅ `docker compose up -d app` 成功，新 container 健康
6. ✅ http://47.100.98.69:3000 正常响应（页面能访问、登录能跑通）
7. ✅ postgres container 不被影响（pgdata 卷数据保留）
8. ✅ 整个 deploy job 端到端 < 30 分钟

**保留备用路径（A + E）**：
- Dockerfile 优化（分层 + .dockerignore 加固）保留 → 即使主路径切到服务器构建，未来切回 ghcr.io 路径时也是优化版本
- docker-compose.yml 保留 `image: ghcr.io/...` + `build:` 双模式 → 切回 ghcr.io 路径只需改 workflow

## 改动范围

| 文件 | 改动 |
|---|---|
| [.dockerignore](.dockerignore) | 加固：排除 `.harness/`、`agent_docs/`、`public/uploads/`、`__tests__/`、`*.test.*`、`mockups/`、`screenshots/`、`.claude/` |
| [Dockerfile](Dockerfile) | runner stage 拆分 standalone 为独立 COPY 层（node_modules / .next / server.js+package.json），让大层稳定缓存 |
| [.github/workflows/deploy.yml](.github/workflows/deploy.yml) | 删除 `build-push` job；`deploy` job 改为：git archive 源码 → scp 到服务器 → SSH 跑 docker compose build + up |
| [docker-compose.yml](docker-compose.yml) | **不改**（保留双模式） |

## 实施顺序

1. 写 spec.md（本文件）
2. 改 [.dockerignore](.dockerignore)
3. 改 [Dockerfile](Dockerfile)
4. 改 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
5. `npx tsc --noEmit` 验证项目本地没破
6. commit + push 到 main → 真实部署作为最终验证
7. 监控 deploy run 完整跑过去
8. 验证 http://47.100.98.69:3000 正常
9. 更新 [HANDOFF.md](.harness/HANDOFF.md) 记录新部署架构

## 风险 / 已知问题

- **首次服务器构建会慢**：服务器上还没有 docker layer cache，第一次会从 0 build（npm ci + next build），约 5-10 分钟
- **服务器需要的 secrets 不变**：仍只用 `SERVER_HOST` / `SERVER_USER` / `SERVER_SSH_KEY`（已有）。`GHCR_TOKEN` 不再需要但保留 secret 不会有问题
- **postgres 不变**：deploy 只动 app container，pgdata 卷保留，数据无丢失风险
- **回退路径**：如果新 deploy.yml 失败，`git revert` 即可回到 ghcr.io 推路径（且因为 Dockerfile 优化保留，回去后也是 A+E 优化版本）
- **私有仓库认证**：服务器构建不需要从 GitHub 拉代码（runner 直接 scp 源码上去），不涉及服务器侧的 GitHub 凭据

## 不做的事

- ❌ 不注册阿里云 ACR（用户决定不付费，且服务器构建已能解决问题）
- ❌ 不重写 docker-compose.yml（保留双模式备用）
- ❌ 不删除 ghcr.io 上历史镜像（占空间但不影响新部署）
