# QA — pilot final r1

**Overall: FAIL。** 冻结commit `0db0953d6221575997db5987a1a24163b01ee4e3`；6个真实Chromium/API/PostgreSQL用例5过1失败。未改应用源码，未把失败重试成通过。

- qa-start已核source_hash `4cc8490881bfe44e85a5e53bf39de3667afccd6548244d79289f214bb8df5be1`；spec_hash `c89c5103a6ed1a99a44114a5aa017ce944bb243cb3b81b6ac086d2f8ec581ff8`。
- 环境：127.0.0.1:3107，同SHA；databaseHash `209bb5703b5dab904df402e6b7003c6f65cb60beb2cf16a415c981c7254674a7`；configHash `fbb5527a6042455666ae7ceb8dbe425e9cc29c71b38ea201bc236972a691735d`。
- 上游是DeepSeek调用分支+127.0.0.1:3189协议fixture；不是此轮真实模型效果验证。coordinator另有真实DeepSeek三类型验证报告。
- 命令：`PILOT_DATABASE_URL=<isolated local URL> PLAYWRIGHT_EXPECTED_SHA=0db0953d6221575997db5987a1a24163b01ee4e3 npx playwright test --config=playwright.pilot.config.ts`；实际退出1，总约2.4分钟。

| 用例 | 结果 |
|---|---|
| 教师UI发布/学生DOCX/公布撤回恢复 | FAIL：卡在fixture登录阶段，尚未创建本用例课程 |
| fixed答案隐藏/冻结题面/幂等重放 | PASS，5.1s |
| adaptive 2题/5题库，4/4 | PASS，3.8s |
| simulation真实SSE回合与评分 | PASS，2.7s |
| 503不公布零分、retry恢复 | PASS，4.4s |
| 首次20并发同requestId，1submission+1job | PASS，2.5s |

失败证据：student context的 `/api/auth/callback/credentials` 请求已发出，HTTP200但响应JSON callback URL包含`error=MissingCSRF`，后续session仍null；同批两个teacher成功。每个context冷启动有多次匿名session请求。不是“没有发请求”的hydration假设，也不是证实密码错误；CSRF cookie响应覆盖/启动竞态仍在独立定位。已交app builder，不能靠sleep或无条件retry掩盖。

原始trace、截图与用例结果已私有保存在 `/Users/yangsenan/Documents/Codex/reviews/finsim-2026-09-09/implementation/final-qa-r1/`（目录700/文件600）；避免下一轮覆盖，也不将session trace提交公开仓库。测试只写自身隔离fixture，未碰生产/staging。
