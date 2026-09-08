# 按变更范围验证

修改 README 的视频、文案或截图，只需确认内容、引用和实际展示。代码没有改变时，不安装应用依赖、不启动应用、不跑应用测试，也不重建服务器。

## 哪些变更走轻量路径

分类唯一来源：[change_policy.py](../.github/scripts/change_policy.py)。必须整个变更范围都在以下白名单内：

- 根目录的 `README.md`、`LICENSE`、`LICENSE.md`、`CHANGELOG.md`、`CONTRIBUTING.md`。
- `docs/` 和 `agent_docs/` 内的静态 Markdown 说明。
- `docs/assets/` 和 `agent_docs/assets/` 内的图片、视频素材。

`AGENTS.md`、`CLAUDE.md`、`SKILL.md`，以及任何 `prompts/`、`skills/`、`agents/`、`.agents/`、`.claude/`、`.codex/`、`.harness/`、`.github/` 路径都排除在外。代码、依赖、数据库、运行时配置、工作流、混合改动和未知路径保留完整验证。符号链接、可执行文件也不走轻量路径。

这些静态目录目前不作为应用运行时输入。将来如有代码读取其中的文件，必须在同一个 PR 中把相应路径移出白名单。不要仅凭扩展名、提交标题或文件数量决定跳过测试。

## 本地怎么做

```bash
git fetch origin
python3 .github/scripts/change_policy.py --base origin/main --working-tree
python3 .github/scripts/check_docs.py --base origin/main --working-tree
```

`--working-tree` 包含已提交、暂存、未暂存和未跟踪改动。默认比较分支与 `origin/main` 的共同起点；不能只看最后一次提交，因为前面可能有代码改动。重命名会同时检查旧路径与新路径。

| 改动 | 本地验证 | GitHub 验证 |
| --- | --- | --- |
| 纯说明文档、宣传素材 | 文档检查；新增媒体查看实际预览，确认新增外部链接可用 | 轻量检查；不安装应用依赖，不部署 |
| 应用代码、依赖、数据库、运行时指令或配置 | 类型检查、全套单元测试；按影响范围做实际页面或数据库验证 | 原有完整 CI、staging 与部署流程 |
| 工作流、分类规则 | 分类回归测试与工作流语法检查；不重复无关的本地应用检查 | 完整 CI 和 staging 验证一次 |
| 混合改动 | 按涉及的完整路径验证 | 完整路径 |

文档检查只使用 Python 标准库：检查 UTF-8、冲突标记、新增本地引用和删除文件影响的引用。外部 URL 只检查格式，CI 不全网爬取。已有无关失效链接不扩张本次任务范围；新增视频仍需在 GitHub 实际确认能播放。

纯文档任务不强制新建或更新 `.harness/`。验证结果写在提交或 PR 中即可；不要为了流程记录把文档任务变成混合改动。

## 自动流程如何报告

- `quality` 和 `staging-deploy` 两个必需检查名称不变，工作流也不使用路径过滤来跳过整个检查。
- 纯文档完成检查后，两者明确报告成功；依赖安装、应用测试、构建和 staging 步骤均跳过。
- 分类或文档检查失败，必需检查失败；不能把失败、缺失或未知结果当成文档成功。无法取得差异时保守选择完整路径。
- 只有真正部署的任务占用共享 staging 锁。纯文档不等待该锁，关闭 PR 也不连接服务器清理环境。
- 合并到 `main` 后，按这次 push 的前后版本判断。纯文档只完成轻量检查，生产部署 job 跳过。
- 分支保护保持不变；不关闭保护、不伪造成功状态、不绕过检查。

修改分类规则时运行：

```bash
python3 -m unittest discover -s .github/scripts/tests -v
actionlint
```

回归覆盖文档、代码、混合变更、工作流、运行时指令、重命名、文件模式、未知差异、本地未提交改动及文档引用。修改工作流后再检查实际 Actions 的执行步骤，不能只凭本地分类结果宣布线上生效。
