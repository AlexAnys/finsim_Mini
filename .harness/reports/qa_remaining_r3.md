# 独立 QA：认证生产构建修复 r3

结论：本地最终候选 PASS。正式staging真实模型/生产上线须另有运行证据。

候选 `f1c37788f8fbd9577df5bcd00f58c4da86787b22`，分支 `codex-remaining-audit`；worktree `/Users/yangsenan/.codex/worktrees/4ac4/Finsim-Mini`；URL `http://127.0.0.1:3107`。数据库hash `209bb5703b5dab904df402e6b7003c6f65cb60beb2cf16a415c981c7254674a7`；配置hash `be6f90df3291fcafa606c982d8e2c20238ea3c2308764fc11887699997370278`；qa-start与qa-finish绑定本次源码/spec/分支/实际环境。

| 范围 | 本轮实测 | 证据 |
|---|---|---|
| 核心Chromium→route→独立DB | 7/7 PASS，48.2秒，retries=0 | `/Users/yangsenan/Documents/Codex/reviews/finsim-2026-09-12/qa-pilot-r3.log`；重新执行冷登录、三类任务、DOCX、快照/自适应、失败/重试、撤回/恢复、权限、20并发幂等 |
| 认证实际边界 | 6组 PASS | `r3-auth/qa-independent-result.json`；改密使两会话失效，新旧密码验证，同cookie降权换班、归档/closed本人回看；本地合成签名JWT的对象userId/对象credentialVersion/旧无指纹cookie均真实route401且session=null |
| 受影响认证界面 | Desktop/390px可操作 | `r3-auth/qa-screenshots/`；实际登录/改密/返回登录，未见横向溢出 |
| 其它应用语义证据复用 | 合理复用r1、r2记录，不计作本轮重复执行 | 独立git比较r2→r3的app/lib/components/prisma/package/pilot范围只变auth.config.ts、next-auth.d.ts；其认证影响已用上述全核心+6边界重新验证。原82人/80样本统计、跨班均分、AI失败保留统计、并发AiRun归属、xlsx/坏附件、缺rubric证据见qa_remaining_r1.md；probe精确别名与smoke-helper失败传播见r2报告 |
| Docker产物抽查 | 实际镜像包版本一致 | 独立network-none运行 `finsim-audit-validation:local` 读取磁盘package：Node22.23.2、Next16.3.4、Auth beta32、xmldom0.8.15、xlsx0.20.3。该验证镜像APP_GIT_SHA=development，仅证明生产构建和依赖路径，不将其冒认为最终SHA部署镜像 |
| 当前合成数据恢复 | 独立41表/171提交/28迁移/3附件核对PASS | `restore-current/independent-qa.json`；全表计数、全部成绩/公布/撤回/删除字段与主观原文/evaluation内容hash相同，源文件/tar/恢复文件逐字节一致，恢复容器network-none。是本日单独恢复环境证据，未改原DB路由 |

命令：加载合成.env，设PILOT_DATABASE_URL/PLAYWRIGHT_EXPECTED_SHA后执行 `npx playwright test --config=playwright.pilot.config.ts`；`node .../qa-independent.mjs <r3 SHA> --auth-only`。完整1405项Vitest、tsc、实际无tests的生产编译回归使用coordinator同源码结果；不把该自测重标成独立QA。

QA没有改应用源码、重启候选或替换配置。原QA fixture/瞬时布局/raw-score断言修正记录保留于r1证据。本轮新增7+6全部首次通过，无自动业务重试。真实模型教学准确率、异地灾备及已上线状态均不由这些结果推出。
