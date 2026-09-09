# Pilot E2E · 探索轮（尚未冻结）

对象：共享worktree codex/pilot-reliability 的WIP；Next16.3.4/next-auth beta32，127.0.0.1:3107；隔离PostgreSQL 127.0.0.1:55439/finsim_pilot；上游为127.0.0.1:3189协议fixture。未调用真实模型、未写生产/共享staging。

**状态：六条主线分别通过，正式候选验收仍待冻结commit后整套运行。** 测試流程是实际Chromium→应用API→PostgreSQL→AI协议边界；不证明真实密钥可用或教学评分准确率。

| 路径 | 本轮证据 |
|---|---|
| 教师UI创建/发布主观题、学生DOCX上传作答 | 向导真实点击/填写/发布；附件marker经mammoth提取写extractedText，实际mock请求含同一marker；成绩完成但未公布时学生score=null |
| 公布→撤回→软删除→恢复 | 公布后学生API分数等于DB，学生grades页显示任务；撤回score隐藏且releaseSuppressedAt非空；删除保留DB原始成绩，学生403；教师UI点击恢复后deletedAt=null且原分数一致 |
| 固定测验与冻结题面 | student GET task/instance均无答案字段/解析；固定模式无法调用adaptive check偷答案；教师修改模板重建题后学生仍看旧快照并得2/2；重复POST同requestId仍为原记录 |
| 自适应真实UI | 5题题库实际仅发2题，UI答对并完成；QuizAttempt存2个issued IDs且completedAt非空，最终4/4 |
| 模拟对话真实UI/SSE | 输入风险建议、展示流式客户回复、结束对话并提交；DB transcript含学生原文，受控rubric评分80/100 |
| 上游故障/重试 | 503时简答状态failed且releasedAt=null、学生score=null；恢复上游后教师retry转graded并3/3 |
| 首次20并发幂等（第6个test） | 20个首次同requestId POST全部200/201且同submissionId，真实DB只有1Submission+1submission_grade job；不是mock并发或已提交后的重放 |

永久入口：`playwright.pilot.config.ts`，`tests/e2e/pilot/core-flows.spec.ts`，fixture拥有自己的唯一课程/任务。before-write比对app数据库指纹；只清理自己创建的数据库记录。CI使用随机拥有的数据库容器和进程组，失败保存trace/screenshot/日志。共享staging仍用原smoke与实际SHA检查。

发现和修正：初始测试的按钮名/单题10分违反当前UI/validator，按实际合同改为“提交”/3分；教师按studentId查列表的正确行为是scope-filter后的200，改为断言无本任务记录并独立断言by-id403；删除后403或404都代表不可读，不把状态风格当缺陷。

**真实新缺陷已退回builder**：主观题UI把评分标准标为可选，空标准仍可发布；DB rubric=[]让评分不可定义。已要求app builder添加可解释的默认或发布守卫，并补验，未通过修改mock来掩盖。

组合证据：coordinator另外完成了本次隔离DB/附件的真实恢复演练（`implementation/restore-rehearsal-20260909203206/result.json`）；这不是生产ops脚本已执行的证明。infra的故障注入独立复核见`implementation/infra-qa-probe-results-r2.json`。正式验收会记录真正commit、configHash/databaseHash和六条同版本结果；当前development不冒充旧base SHA。
