# 独立 QA：剩余审查候选 r1

结论：本地冻结候选 PASS。生产/staging 发布尚未完成；staging 的真实 DeepSeek 门槛因官方返回 Flash 新别名被旧探针拒绝，属待修部署问题，不记为上线。

候选 `34b83a5928562484231573d2f3a3daf1a01a7e90`；分支 `codex-remaining-audit`；worktree `/Users/yangsenan/.codex/worktrees/4ac4/Finsim-Mini`；URL `http://127.0.0.1:3107`。DB hash `209bb5703b5dab904df402e6b7003c6f65cb60beb2cf16a415c981c7254674a7`；配置 hash `be6f90df3291fcafa606c982d8e2c20238ea3c2308764fc11887699997370278`；APP_ENV=test。QA 未修改被测源码或运行配置。

| 检查 | 结果 | 实际证据 |
|---|---|---|
| Chromium→API→PostgreSQL 原核心链 | 7/7 PASS，37.0 秒，Playwright retries=0 | 报告目录 qa-pilot.log、playwright-report/pilot；冷登录、教师发布、DOCX附件、快照测验、自适应4/4、模拟流式对话、上游503/老师重试、20并发仅1提交1job |
| 新增实际业务边界 | 12组 PASS | qa-independent-result.json；2会话改密失效/新旧密码、角色和换班即时权限、归档/closed边界、82学生80样本跨班与100/50百分制均分、AI失败保留全量统计、并发两提交audit精确映射AiRun、xlsx0.20.3实际提取入评分、坏ZIP拒绝正式成绩、缺rubric不公布、删除用户旧cookie401 |
| Desktop / 390px | PASS | qa-screenshots；登录、改密实际操作、周洞察成功/错误结果和关闭按钮；稳定390px dialog x16,width358,right374，clientWidth=scrollWidth356，无横向越界。截图已独立目视检查 |
| 实际宿主guard/cleanup shell | 5组 PASS | qa-ops-independent-result.json、qa-guard-calls.txt；现网guard副本经候选updater后执行200/503阈值4/冷却180，健康Docker不重启；cleanup owner成功/其它owner跳过/down失败/锁超时四种真实shell分支 |
| 候选DB绑定规则 | 2组 PASS | qa-ops-independent-result.json；从两个compose渲染host_ip127.0.0.1规则，实际本地Docker临时端口运行postgres并inspect回环绑定、SELECT1通过 |
| DB故障与恢复 | PASS | qa-db-recovery.json；仅pause本任务容器finsim-audit-20260912-db，ready 200→503→200；暂停期间login仍200，证实登录探测会漏DB故障；finally unpause已恢复 |
| 整合验证复用 | tsc通过、Vitest1402/1402、Python50、lint无error | coordinator同一冻结候选的typecheck/vitest/python/lint日志；本QA另跑了真实独立链，无重复冒认实现者单测为独立验收 |

主证据目录：`/Users/yangsenan/Documents/Codex/reviews/finsim-2026-09-12/`。执行：`npx playwright test --config=playwright.pilot.config.ts`（加载合成.env，设PILOT_DATABASE_URL、PLAYWRIGHT_EXPECTED_SHA）；`node .../qa-independent.mjs <SHA>` 与明确分段 `qa-continue.mjs`/`qa-last-two.mjs`；`python3 .../qa-ops-independent.py <SHA>`；隔离DB故障注入结果见JSON。

QA自身断言修正未隐去：初始单题10分fixture被现有<=3校验正确拒绝；视口切换瞬间测量改为等待有限动画和两帧布局后一次读取；原始raw score=null断言强于正式成绩语义。三份原失败JSON保留。坏附件实际为内部score0 + failed + unreleased，独立以学生route score=null、analysisStatus=pending、老师公布被拒绝、AiRun0、新协作教师无缓存全量统计仍82及100/50确认它不是正式零分。未重试业务操作来掩盖产品失败；续跑未改应用源码。

数据为隔离finsim_pilot内独立前缀合成用户/课程/任务/附件；本轮未在生产制造业务数据。外部AI传输是loopback协议fixture；不声称教师评分准确率、真实模型效果或本轮真实provider完成。实际生产数据库监听、宿主部署和真实staging链路仍需发布后证据。
