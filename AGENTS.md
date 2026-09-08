# AGENTS.md — finsim_Mini 多 agent 协作约定

> 这份文件是给 AI agent（Claude Code / Codex CLI / 其他）看的，约定本仓库的工作流。

## 一、仓库基本信息

- 主分支：`main`（受 GitHub branch protection 保护）
- 部署：应用或配置变更合并到 `main` 后自动部署；纯说明文档不重建生产。
- Staging：完整验证路径部署 https://staging.finsim.anlanai.cn（共享栈）；纯说明文档只完成同名轻量检查。
- 文档：`agent_docs/deployment.md` 是单一来源；`CLAUDE.md` 含项目架构

## 二、铁律

1. **绝对不直 push main**：被 branch protection 拒绝，浪费时间。一律走 PR。
2. **每个任务一个 feature 分支**：命名 `<agent>-<topic>`，例：`claude-quiz-fix`、`codex-deploy-env`。
3. **按影响范围验证**：先执行下方变更分类。纯说明文档只检查文档和实际展示；应用代码提交前跑 `npx tsc --noEmit && npx vitest run`。工作流修改本地检查路由与 YAML，由 CI 完成一次完整验证，避免重复无关检查。
4. **必需检查名称不变**：`quality` 与 `staging-deploy` 都必须成功。纯说明文档由这两个检查明确报告轻量验证成功，不安装应用依赖、不部署 staging、不跑应用测试；其它变更保留完整验证。
5. **squash merge 强制**：repo 设置只允许 squash，merge 后自动删 feature 分支。
6. **分支/worktree 必须从最新 `origin/main` 出生**：创建前**先 `git fetch origin`**，再基于 `origin/main` 建，**绝不从本地 `main` 切**。原因：PR 的 squash 合并发生在 GitHub 服务器端，本地 `main` 不主动 `pull` 就会滞后，从它切出的分支一出生就缺最新 commit、卡在「This branch is out of date with the base branch」。本仓库已配自带 `fetch` 的快捷别名：`git nb <topic>`（建分支）、`git nw <topic> <path>`（建 worktree）、`git syncmain`（拉平本地 main）。

## 变更分类与验证

分类唯一来源是 `.github/scripts/change_policy.py`，详见 [验证路径](agent_docs/validation-routing.md)。本地提交前包含暂存、未暂存及未跟踪文件：

```bash
python3 .github/scripts/change_policy.py --base origin/main --working-tree
python3 .github/scripts/check_docs.py --base origin/main --working-tree
```

- 只有明确的 README、静态说明目录及其宣传素材可以走纯文档路径。不要仅凭 `.md` 后缀或提交标题判断。
- `AGENTS.md`、`CLAUDE.md`、`.claude/`、`.harness/`、提示词/技能、代码、依赖、数据库、工作流和部署配置，以及任何混合或未知改动，都走完整路径。
- 纯文档不启动应用、不装完整依赖、不跑 tsc/vitest/Playwright，不重建生产。新增图片/视频要检查实际预览；外部链接不在 CI 全网爬取。
- 不为纯文档任务强制新增 `.harness` 记录，否则任务本身会变成混合变更；在提交或 PR 中记录文档验证即可。
- 对没有变化的代码复用已有验证结果；有新改动、失败或未解决疑点时才追加相应检查。

## 三、标准任务流（每个 agent 必走）

```bash
# 1. 从最新 origin/main 出生（必须先 fetch，避免 born-behind / out-of-date）
git fetch origin
git switch -c <agent>-<topic> origin/main
# 用 worktree 时：
git worktree add -b <agent>-<topic> <path> origin/main
# 快捷：git nb <topic>   或   git nw <topic> <path>（已自带 fetch）

# 2. 修改后先分类，按上表运行必要检查
python3 .github/scripts/change_policy.py --base origin/main --working-tree
# docs_only=true: check_docs + 新增媒体/链接的实际预览
# 应用代码: npx tsc --noEmit && npx vitest run
# 工作流: 路由测试 + 工作流语法检查，CI 完整验证一次

# 3. 检查通过后提交
git add <files>
git commit -m "feat/fix/refactor/chore/docs(<scope>): <what>"

# 4. 推 + 开 PR
git push -u origin <branch>
gh pr create --base main --fill

# 5. 等 quality + staging-deploy 成功；只有完整路径会产生 staging URL
gh pr checks
gh pr view --web

# 6. 文档查看实际排版/引用；应用变更完成 staging 自验后 squash merge
# 7. 应用/配置变更部署生产；纯文档不部署，feature 分支自动删
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

如果 staging 临时坏了急需上线，仍按保护要求处理；不要关闭保护或伪造检查结果。流程见 `agent_docs/deployment.md` 「紧急 hotfix 流程」章节。

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
