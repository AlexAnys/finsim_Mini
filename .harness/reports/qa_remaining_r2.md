# 独立 QA：部署门槛候选 r2

本地结论 PASS；staging / 生产发布状态须另行核实。

候选 `24d0c5ff41fbb180a5c6a2beba00ddba032be9e2`，分支 `codex-remaining-audit`，worktree `/Users/yangsenan/.codex/worktrees/4ac4/Finsim-Mini`，URL `http://127.0.0.1:3107`。DB hash `209bb5703b5dab904df402e6b7003c6f65cb60beb2cf16a415c981c7254674a7`，config hash `be6f90df3291fcafa606c982d8e2c20238ea3c2308764fc11887699997370278`；qa-start/qa-finish前后绑定。

| 检查 | 实际结果 | 证据 |
|---|---|---|
| 精确模型别名与门槛 | 7组 PASS | 报告目录 `qa-probe-alias-result.json`；Flash官方新别名/旧canonical均接受，未知后缀、错模型、不在允许名单的Pro别名拒绝，失败不继续调用，receipt实际模型/SHA/key改动拒绝，loopback官方门槛拒绝且无调用 |
| 修改后的真实 smoke loginAs | 3/3 PASS，5.3秒，retries=0 | `qa-smoke-helper.spec.ts`/`qa-smoke-helper-results`；实际教师、学生各仅一context一凭据POST；注入首个导航失败后错误向外抛出且关闭context，没有再试 |
| r1应用证据复用 | 内容一致，可复用 | 独立 `git diff --quiet 34b83a5 <r2> -- app lib components prisma package.json package-lock.json tests/e2e/pilot playwright.pilot.config.ts` 返回0；并重新确认实际运行 r2 SHA、同DB/config。r1 7条核心+12业务+ops7+DB恢复结论保留，未把r1次数记作r2重跑 |

命令：`python3 .../qa-probe-alias-independent.py 24d0c5ff41fbb180a5c6a2beba00ddba032be9e2`；`node node_modules/@playwright/test/cli.js test --config=.../qa-smoke-helper.config.mjs`。脚本和新证据在 `/Users/yangsenan/Documents/Codex/reviews/finsim-2026-09-12/`。精确别名测试使用注入协议响应，0付费请求；真实官方门槛留待staging部署实证，不能拿注入响应冒充真实DeepSeek成功。

独立QA只写报告与外部QA脚本，未修改源码。完整应用回归1402/1402、Python52和tsc使用coordinator同代码结果；本报告独立检验新门槛和实际登录helper，不代写builder的实现证据。
