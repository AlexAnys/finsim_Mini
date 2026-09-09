# 试点应用可靠性 · builder r1

2026-09-09；分支 `codex/pilot-reliability`，基线 `origin/main 5dd4f43`。应用 builder 在共享 worktree 完成代码与定向回归，未提交、推送、部署或写生产/staging。隔离 DB 的创建、迁移生成/应用和浏览器 E2E 由 coordinator 执行。本报告不是最终验收。

## 已实现

- APP-01：学生 Task/Instance/课程/列表/dashboard 的统一递归 DTO，裁剪正确答案、解析、参考答案与教师系统配置。`toJSON` 字符串不能绕过。固定测验不能调用即时 check；check 必须持有本人的服务端 QuizAttempt，并且题目已发出。Submission 的详情/列表 task 也裁剪。额外发现并补了 dashboard `latestScore/recentSubmissions` 与异步任务 GET/retry/提交结果中的未公布分数泄露。
- APP-02：Submission 提交时冻结完整 taskSnapshot，grader 与阅卷详情优先使用它；老师之后修改模板不改变本次评分题目 ID/标准。实例内容版本递增，普通 runner 提交旧版本时明确 409。snapshot 编辑保留原 ID，新题/标准生成新 ID。模拟 chat/preview evaluate 的已发布场景也从快照读取。
- APP-03：新增 QuizAttempt 记录服务端已发题、不可反悔的已判作答与完成状态；下一题不信任客户端 history.correct，最终提交不信任客户端答案/掌握报告。成绩满分按实际已发题集合。简答在逐题阶段调用真实判分并保存结果，正式批改复用该结果，不以“非空即对”判断。
- AI-01/03：简答上游失败使整份进入 failed，而非正式 0 分；主观题使用 AI builder 的完整唯一 rubric schema。整份 grading 包在 90 秒 AI deadline 中。配合 AI builder 的 Job lease 上下文，在落分事务内锁 job/submission，阻止旧尝试写分或覆盖教师已完成的评分；删除/撤销取消活动 job。
- APP-04/09/10：上传新增 FileUpload 独立归属；提交验证 uploadId/路径属于本人且扩展名符合任务配置，服务端派生附件元数据。支持 Excel/text MIME。主观附件通过现有安全文档提取/OCR实际进入评分 prompt，提取失败或截断不能默默判分；提取文本持久化可供核对。允许“仅附件”作答，尊重 allowTextAnswer=false。默认存储改私有 `./data/uploads`，不移动/删旧文件。
- APP-05：外部提交 requestId 必填；runner 持久化 UUID，成功确认才清除。实例事务锁覆盖次数校验、Submission 与队列创建；同 requestId 复用已有记录。重批在锁内复用活动 job，避免重复入队。
- APP-06：主动撤回写 releaseSuppressedAt，cron 扫描及写入 CAS 都尊重；autoReleaseAt=null 也有即时发布语义；cron 报告实际 update count。
- APP-07：成绩删除改 tombstone，保留原作答/评分，事务内审计并取消后台任务；新增 restore API，教师实例“提交”tab 有已删除列表/恢复按钮；恢复未完成的批改进入可重试 failed。默认成绩列表/统计/关联计数排除 deletedAt，AI builder 的缓存失效 helper 在评分/删除/恢复/撤销调用。实例/模板删除仍把保留记录视为有关联数据，避免破坏恢复证据；课程 purge 仍为独立确认的永久清理。
- APP-08/11：教师按 studentId 查询始终叠加可见任务/实例/课程范围；学生显式 courseId 也执行归档/班级守卫；已删除、已归档课程的 submission 直链不可读。
- seed 增加生产拒绝守卫，两门课程写 CourseClass；不为已部署库重复执行非幂等 seed。

## 数据模型与接口

coordinator 已用 Prisma migrate dev 生成 `20260909113836_pilot_reliability`；builder 未手写迁移。schema 纯对齐噪音已去除。

- Submission：requestId（studentId+requestId 唯一）、taskSnapshot、quizAttemptId、deletedAt/deletedBy、releaseSuppressedAt。
- TaskInstance：contentVersion；QuizAttempt/FileUpload 为新表，所有者/实例外键明确。
- POST `/api/submissions`：必须 requestId；可带 taskVersion，adaptive 必须 attemptId；附件新增 uploadId。返回 gradingJob，学生 result 裁剪。
- adaptive next：返回 attemptId；后续 next/check/final submit 传它。客户端 history 仍会被 schema 忽略而不会成为权威。
- DELETE `/api/submissions/[id]`、batch：软删；POST `/api/submissions/[id]/restore`；GET submissions `deleted=true` 仅 staff 可用且仍受权限过滤。

调用点全查：当前 SimulationRunner 两个提交分支、QuizRunner、QuizAdaptiveRunner、SubjectiveRunner 均已带 requestId；API auth 三角 fixtures 已更新并新增缺 requestId 400。默认 smoke-02/03 由 coordinator 更新。历史非默认 E2E 仍有直接调用（`bug-probe-student-6-misc`、`phase3-m4b-fix`、`phase3-m4-student-submissions`），再次运行前需要补新字段，不能声称它们已验证。

## 验证证据

- `tests/pilot-grading-contract.test.ts` 7：嵌套答案、冻结题 ID、选题分母、简答失败、完整 rubric、附件入 prompt、教师评分/删除保护。
- `tests/pilot-submission-safety.test.ts` 9：同键去重、旧版本拒绝、事务次数检查、外来上传拒绝、原子入队、旧 lease/手改保护、教师 student scope、软删/恢复审计。
- `tests/pilot-release-contract.test.ts` 2：撤回抑制与 cron 条件写、实际影响数量。
- `tests/pilot-quiz-attempt.test.ts` 4：发题丢响应重试、未发题禁止取答案、反馈后不能改第一次答案、他人/固定测验拒绝。
- 相关 14 文件 161/161 通过（20:00 前运行的选集）；最后 QuizAttempt/公布 6/6 通过。
- coordinator 全套 R1 指出的应用侧 7 个旧 mock/fixture 失败已修；三个文件 `anl-28-42-access`、`course-archive-guards`、`api/other-mutations` 38/38 通过，保持原 200/401/403 权限断言，软删验证不再硬删。未把 500 改成“预期通过”。
- 本轮 TypeScript 无错误；应用 lint 选集无 error，发现的草稿 scope dependencies/新 unused warning 已修。
- 上述均是无 DB/AI 副作用定向测试。**实际并发数据库锁、真实 PDF/图片/Excel提取、完整浏览器流程与真实模型质量由 coordinator 下一步验证，不用 mock PASS 代替。**

## 验收重点与边界

1. 独立 QA 应对固定/自适应成绩逐题对账；发布后编辑模板；同键并发 20 次仍一份/一 job；不同键超次数拒绝。
2. 确认失效/撤回/删除再恢复的三态数据与洞察缓存一致；教师手改分同时 AI 返回不能覆盖。
3. 主观图像 OCR 依赖真实配置，缺失时应 failed 并可重试，不能显示已批改零分。
4. QuizAttempt 当前浏览器持久化 sitting ID；固定/主观/模拟 request ID 保留到成功。旧浏览器未部署最新 runner 会被 requestId 校验明确拒绝，应刷新。
5. 服务端不把客户端自述掌握报告作为成绩证据；模拟对话全文真实性仍依赖客户端 transcript，服务端可信对话日志不是本轮模型范围，不能称已防住所有作弊。
