# AGENTS.md — finsim_Mini 多 agent 协作约定

> 这份文件是给 AI agent（Claude Code / Codex CLI / 其他）看的，约定本仓库的工作流。

## 一、仓库基本信息

- 主分支：`main`（受 GitHub branch protection 保护）
- 部署：push 到 `main` → 自动部 https://finsim.anlanai.cn（约 4 分钟）
- Staging：每个 PR 自动部 https://staging.finsim.anlanai.cn（共享栈，不同 PR 串行）
- 文档：`agent_docs/deployment.md` 是单一来源；`CLAUDE.md` 含项目架构

## 二、铁律

1. **绝对不直 push main**：被 branch protection 拒绝，浪费时间。一律走 PR。
2. **每个任务一个 feature 分支**：命名 `<agent>-<topic>`，例：`claude-quiz-fix`、`codex-deploy-env`。
3. **commit 前必跑**：`npx tsc --noEmit && npx vitest run`，全绿才能 commit。
4. **每个 PR 必有 staging 自验**：CI + staging-deploy 两个 status check 必须通过才能 merge。
5. **squash merge 强制**：repo 设置只允许 squash，merge 后自动删 feature 分支。
6. **分支/worktree 必须从最新 `origin/main` 出生**：创建前**先 `git fetch origin`**，再基于 `origin/main` 建，**绝不从本地 `main` 切**。原因：PR 的 squash 合并发生在 GitHub 服务器端，本地 `main` 不主动 `pull` 就会滞后，从它切出的分支一出生就缺最新 commit、卡在「This branch is out of date with the base branch」。本仓库已配自带 `fetch` 的快捷别名：`git nb <topic>`（建分支）、`git nw <topic> <path>`（建 worktree）、`git syncmain`（拉平本地 main）。

## 三、标准任务流（每个 agent 必走）

```bash
# 1. 从最新 origin/main 出生（必须先 fetch，避免 born-behind / out-of-date）
git fetch origin
git switch -c <agent>-<topic> origin/main
# 用 worktree 时：
git worktree add -b <agent>-<topic> <path> origin/main
# 快捷：git nb <topic>   或   git nw <topic> <path>（已自带 fetch）

# 2. 写代码 → commit（小步、原子、消息说清楚 why）
git add <files>
git commit -m "feat/fix/refactor/chore(<scope>): <what>"

# 3. 跑本地检查
npx tsc --noEmit
npx vitest run

# 4. 推 + 开 PR
git push -u origin <branch>
gh pr create --base main --fill

# 5. 等 CI + staging-deploy 全绿，PR 评论会出现 staging URL
gh pr checks
gh pr view --web

# 6. 用户在 staging 实测，提反馈或直接 squash merge
# 7. merge 后生产自动部署，feature 分支自动删
```

## 四、core-change 标签（核心功能防火墙）

PR 改到下面任一路径会自动打 `core-change` 红色标签（**提醒，不阻塞**）：

- `lib/auth/**`、`app/api/auth/**` — 认证 / 权限
- `lib/services/grading.service.ts` — AI 批改主路径
- `prisma/schema.prisma`、`prisma/migrations/**` — DB schema
- `.github/workflows/**`、`Dockerfile`、`docker-compose*.yml` — 部署基础设施

带这个标签的 PR 用户应该花更多时间在 staging 实测。

## 五、撞车处理（多 agent 同时改）

```bash
# 你 push 时被拒（someone else 抢先 merge 了 main）
git fetch origin
git rebase origin/main          # rebase 你的 commit 到最新 main 之上
# 解冲突 → git add → git rebase --continue
git push --force-with-lease     # 你自己的 feature 分支安全 force-push
```

**永远不要 force push main**（也被 protection 禁了）。

## 六、紧急 hotfix

如果 staging 临时坏了急需上线，admin 可短暂关 protection 直 push，**事后必须立刻重启**保护。流程见 `agent_docs/deployment.md` 「紧急 hotfix 流程」章节。

## 七、staging 数据 reset

staging 数据共享单一栈。如果某个 agent 在 staging 留了脏数据影响他人，admin 可走 `agent_docs/deployment.md` 「Staging 重置」章节命令重灌生产快照。

## 八、典型 commit 消息

```
feat(insights): redesign analytics-v2 dashboard layout 1/3+2/3
fix(student-quiz): options shape mismatch — DB uses {label,content}
chore(ci): add core-change firewall to PR review
refactor(ai): extract balanced-paren JSON parser
docs: update agent_docs/deployment.md with staging stack
```

scope 用小写、`-` 连接；消息英文中文都行（团队偏中文）。
