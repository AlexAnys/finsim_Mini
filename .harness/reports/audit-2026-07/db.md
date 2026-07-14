# 数据库结构与治理审查 · db.md

> 审查员：audit-db（数据库结构与治理）
> 基线：main @ f45b94c，`prisma/schema.prisma` 1098 行 / 38 模型 / 28 migrations
> 方法：schema 逐模型静态评审 + 真 DB 只读 SELECT（`finsim-postgres` 容器，仅 SELECT/元数据，零写入）+ 代码层删除/审计/校验路径核查
> 纪律遵守：全程只读，未执行任何 reset/seed/drop/UPDATE/DELETE/TRUNCATE，未改任何应用代码/schema/migration。

---

## 执行摘要

**总体判定**：schema 的关系建模与级联防护本身是**合格偏好**的——成绩（Submission）被 Task 的 RESTRICT 和代码层守卫双重保护，Course 的软删/硬删双路径（archive vs purgeCourse）设计成熟，migration 文件夹是一条自洽、可从零重放的 PascalCase 血统。真正的问题集中在**治理层（备份/审计/保留/环境隔离）**与**分析型数据被 JSON blob 锁死**两大类，外加一个**必须立刻查清的运维事故**：当前共享 dev DB 容器里的 `finsim` 库已漂移三代、缺失全部 4 月后新增的表。

**四个最该先动的点**：
1. **零备份**——全库仅存活于单个 Docker named volume `pgdata`，无 pg_dump/WAL/retention/任何自动备份。多校生产下这是最大的单点数据丢失敞口（P0）。
2. **成绩可被永久删除且无审计无恢复**——`DELETE /api/submissions/[id]` 教师即可调用，`prisma.submission.delete` 裸删，不写 AuditLog、无软删、不可恢复（P0）。
3. **共享 dev DB 已废弃漂移**——容器内 `finsim` 库无 `AsyncJob`/`AiRun`/`Feedback`/`CourseKnowledgeSource` 等表，`_prisma_migrations` 只有 5 条与当前 28 条 migration 完全不匹配的旧记录；任何指向它的 app 会立即 500（P1，需查清谁在用）。
4. **分析维度被 JSON blob 锁死**——逐题作答（`QuizSubmission.answers`）、逐项评分（各 `*Submission.evaluation`）、知识点标签（无字典表的 `String[]`）全部无法在 DB 层聚合，直接卡死 audit-insights 关心的题目区分度/错误率/概念掌握度分析（P1）。

**分级计数**：P0 = 2  · P1 = 8 · P2 = 11（共 21 条）。

---

## 38 模型健康度总表

| # | 模型 | 主要问题 | 级别 |
|---|---|---|---|
| 1 | User | PII（name/email/avatar）明文、无字段级加密；Restrict 墙致用户永不可删=无离职/毕业匿名化能力；子表 Cascade-vs-Restrict 不一致 | P1/P2 |
| 2 | Class | `code`/`academicYear` 半死字段（读取存在 UI 未渲染），`code` 非 unique | P2 |
| 3 | Course | 全库唯一有 `deletedAt` 软删（好）；`classId` nullable 遗留（已标 deprecated 待清） | P2 |
| 4 | Chapter | `createdBy` 无索引 | P2 |
| 5 | Section | `courseId`、`createdBy` 无索引 | P2 |
| 6 | ContentBlock | `courseId`、`chapterId` 无索引（且 chapterId 是 Cascade，删章走 seq scan）；`data` Json | P2 |
| 7 | Task | 硬删（被 Submission RESTRICT 保护），健康 | ✅ |
| 8 | SimulationConfig | 健康 | ✅ |
| 9 | QuizConfig | 健康 | ✅ |
| 10 | SubjectiveConfig | 健康 | ✅ |
| 11 | ScoringCriterion | 健康 | ✅ |
| 12 | AllocationSection | 健康 | ✅ |
| 13 | AllocationItem | 健康 | ✅ |
| 14 | QuizQuestion | `options` Json + `correctOptionIds`/`knowledgeTagIds` 均为无字典表的 `String[]` | P1 |
| 15 | TaskInstance | `groupIds String[]` 伪外键（analytics 在用，删组留悬空）；`chapterId`/`createdBy` 无索引；`taskSnapshot` Json | P1 |
| 16 | Submission | 硬删永久销毁成绩记录、无审计、无软删、不可恢复 | **P0** |
| 17 | SimulationSubmission | `transcript`/`evaluation` Json（评分锁死）；`conceptTags` 无字典 | P1 |
| 18 | QuizSubmission | `answers`/`evaluation` Json（逐题锁死，无法 DB 层做题目分析） | P1 |
| 19 | SubjectiveSubmission | `evaluation` Json；`conceptTags` 无字典 | P1 |
| 20 | Attachment | 健康（Cascade 正确） | ✅ |
| 21 | StudyBuddyPost | `hiddenAt`/`hiddenBy` 软删（第 2 套软删机制）；`messages` Json | P2 |
| 22 | StudyBuddySummary | Json cache，健康 | ✅ |
| 23 | Announcement | `status=archived`（第 3 套软删机制）；`createdBy` 无索引；Cascade 硬删无软删 | P2 |
| 24 | TaskPost | `authorId` 无索引；自引用 Cascade 正确 | P2 |
| 25 | ScheduleSlot | `weekType String` 该用 enum；`createdBy` 无索引；硬删 | P2 |
| 26 | StudentGroup | 硬删致 `TaskInstance.groupIds` 悬空（见 F-DB-09） | P1 |
| 27 | StudentGroupMember | 健康 | ✅ |
| 28 | AnalysisReport | Json cache（合理）；`taskInstanceId @unique` 正确 | ✅ |
| 29 | ImportJob | `taskId` 无索引 | P2 |
| 30 | CourseKnowledgeSource | `sourceType String` 该用 enum；`extractedText` 大字段进行；`conceptTags` 无字典 | P2 |
| 31 | AsyncJob | 无超时/心跳字段→卡 `running` 无 reaper；`entityType`/`entityId` 多态 String 无完整性 | P1 |
| 32 | TaskBuildDraft | `asyncJobId` 松散 String 引用 `AsyncJob.id` 非真 FK；3×payload Json | P2 |
| 33 | AiRun | `provider`/`feature`/`toolKey` String 该 enum；成本账本随 user 删被 Cascade；无超时 | P1 |
| 34 | AiToolSetting | `strictness String` 但项目里明明有 `StrictnessLevel` enum（不一致） | P2 |
| 35 | AuditLog | 覆盖缺口：认证/角色变更/提交删除均无审计；`actor` SetNull 正确 | P1 |
| 36 | CourseTeacher | 健康 | ✅ |
| 37 | CourseClass | 与 `Course.classId` 迁移期双轨（可接受，待收敛） | P2 |
| 38 | Feedback | `screenshot` base64 存 Text 列（行膨胀 + 截图可能含 PII 入库） | P2 |

---

## P0 · 数据错误 / 丢失风险

## F-DB-01 · 全库零备份策略，单 Docker volume 单点丢失
- 严重级: **P0**
- 证据: `docker-compose.yml` 仅定义 `volumes: pgdata / uploads`，postgres 服务无任何备份 sidecar/cron；全仓 `grep -rniE 'pg_dump|pgbackrest|backup|wal-g|barman' docker-compose*.yml .github/ scripts/` = 0 命中；`.env.example` 无 backup/retention/TTL 键。DB 数据仅存活于 named volume `pgdata`。
- 影响: 多校生产部署下，全部学生成绩/审计/AI 记录只有一份、无历史快照。一次 `docker compose down -v`、磁盘故障、或坏 migration 即造成**不可恢复的全量丢失**。这是当前最大的单点数据丢失敞口。
- 修复方向: 引入定时 `pg_dump` 逻辑备份（异地保留 + 保留窗口）；生产启用 WAL 归档/PITR；备份可恢复性需实测演练，不能只配不验。

## F-DB-02 · 成绩记录（Submission）可被永久硬删除，无审计、无软删、不可恢复
- 严重级: **P0**
- 证据: `lib/services/submission.service.ts:402` `deleteSubmission` = 裸 `prisma.submission.delete`；`:406` `batchDeleteSubmissions` 批量裸删。路由 `app/api/submissions/[id]/route.ts:43-59` 与 `app/api/submissions/batch/route.ts` 均 `requireRole(["teacher","admin"])` 即可调用。全库 `logAuditEvent` 的 action 清单（37 个）**无 `submission.delete`**——删除不写审计。Submission 无 `deletedAt`/软删字段。
- 影响: 一次教师例行操作即可永久销毁系统最有价值的记录（成绩），无任何痕迹、无恢复路径。学术申诉/成绩纠纷/合规审计场景下这是硬伤——被删成绩既查不到"谁删的、何时删的"，也无法还原。对比同文件 `submission.ungrade`（:388 写了审计）反衬出删除路径的审计缺失是遗漏而非有意。
- 修复方向: 成绩记录改为软删（`deletedAt` + 保留），或至少在 delete/batchDelete 路径强制写 `submission.delete` 审计（含 studentId/taskInstanceId/score 快照）；评估是否应禁止硬删、仅允许软删 + admin 专属彻底清除。

---

## P1 · 规模化必炸 / 治理硬伤

## F-DB-03 · 共享 dev DB 容器已漂移三代，缺失全部 4 月后新增表
- 严重级: P1
- 证据: `finsim-postgres` 容器 `finsim` 库同时存在三代表：① snake_case v1（`users`=12 行、`courses`、`file_uploads`、`course_collaborators`、`task_instance_analytics`）② PascalCase v2（`User`=3 行、`TaskInstanceAnalytics` 仍在——本应被 `20260516064500_drop_dead_schema_pr1` DROP）③ **缺失** `AsyncJob`/`AiRun`/`AiToolSetting`/`Feedback`/`CourseKnowledgeSource`/`TaskBuildDraft`/`CourseClass`(Pascal)/`CourseTeacher`(Pascal)。`SELECT ... FROM "AsyncJob"` → `relation "AsyncJob" does not exist`。`_prisma_migrations` 仅 5 条记录（`20260220110013_init`…`20260223032255_add_pending_collaborator_role`），与 `prisma/migrations/` 里 28 条（起始 `20260221084930_init`）**完全不匹配**。
- 影响: 任何指向此库的 app 进程在触到 AsyncJob/AiRun/Feedback 等表时立即运行时 500（正是 CLAUDE.md L-001 家族的坑）。`prisma migrate deploy` 对此库会失败（血统对不上）。此库对任何连上来 debug 的人是**误导性证据源**——看到的表结构与代码不符。注：migration 文件夹本身是干净的（`init` 建 PascalCase `User`/`Class`/`Course`，AsyncJob/Feedback/AiRun 均由后续 migration 显式 CREATE，共 39 张 distinct 表 = 38 现存 + TaskInstanceAnalytics 已删，可从零重放）——**问题在这个容器的库状态，不在 migration**。
- 修复方向: 查清当前 dev/staging 到底连哪个库（本 checkout 无 `.env`，仅 `.env.example`）；若此容器是团队共享 dev DB，需 drop + 从 28 条 migration 重建 + reseed；确立"dev DB 由 CI/脚本从 migration 重放"的纪律，杜绝手动 `db push` 造成的漂移。

## F-DB-04 · Seed 脚本无环境守卫 → 误跑即在生产植入公开密码管理员后门
- 严重级: P1
- 证据: `prisma/seed.ts` 无任何 `NODE_ENV`/production 守卫（`grep -nE 'NODE_ENV|production|throw'` = 0 命中）；`main()` 直接 `prisma.user.upsert` 创建 `admin@finsim.edu.cn` 等账号，`bcrypt.hash("password123", 12)`。CLAUDE.md 将 `npm run db:seed` 列为标准命令，且测试账号密码 `password123` 公开在文档里。
- 影响: 任何人误对 staging/prod 跑 `npm run db:seed`，即注入一个**公开已知密码的 admin 账号**（upsert 在账号不存在时必建）——等于一键后门。
- 修复方向: seed 顶部加 `if (process.env.NODE_ENV === "production") throw`；测试账号密码改为从 env 注入而非硬编码；prod 首个 admin 走独立的一次性引导脚本而非 seed。

## F-DB-05 · 无标签字典表，知识点/概念标签是无源真的 String[] 数组
- 严重级: P1
- 证据: `schema.prisma:498` `QuizQuestion.knowledgeTagIds String[]`、`:595/:613/:629` 三个 `*Submission.conceptTags String[]`、`:878` `CourseKnowledgeSource.conceptTags String[]`——全库**无 `KnowledgeTag`/`ConceptTag` 字典表**（grep 确认只有这 5 处数组，无对应 model）。
- 影响: adaptive quiz 的"按知识点诊断"（注释标 Unit 8）和概念掌握度分析没有真源表：无法列出全部标签、无法重命名、无法保证两道题用同一个 id 指同一概念、无法做"某知识点全班掌握度"的可靠聚合（id 拼写漂移即分裂统计）。直接削弱 audit-insights 关心的概念维度分析可信度。
- 修复方向: 建 `KnowledgeTag` 字典表（id/name/parentId 支持层级），标签引用改真外键或至少受字典约束；离线打标写入字典而非裸字符串。

## F-DB-06 · 逐题作答与逐项评分锁在 JSON blob，无法在 DB 层做题目/维度分析
- 严重级: P1
- 证据: `QuizSubmission.answers Json?`(:608)、各 `*Submission.evaluation Json?`(:592/:612/:630) 存逐题答案与逐评分项 rubric 分数。这些是 blob，PostgreSQL 侧无法 `GROUP BY 题目 / 评分项` 聚合，只能全量拉出 app 内 JSON 解析。
- 影响: "第 3 题全班错误率""某评分项得分分布""题目区分度"这类 audit-insights 核心指标，在 DB 层完全做不了；规模化后（千级提交）app 内解析聚合既慢又占内存。分析客观性受限于"只能整卷/整提交粒度"，无法下钻到题目/维度。
- 修复方向: 抽出 `QuizAnswer`(submissionId, questionId, chosen, correct, score) 与 `EvaluationScore`(submissionId, criterionId, score) 明细表，与 JSON blob 并存（blob 留原始、明细表供聚合）；或至少为高频分析路径物化明细。

## F-DB-07 · AuditLog 覆盖缺口：认证、角色变更、成绩删除均无审计
- 严重级: P1
- 证据: 全库 37 个 `logAuditEvent` action（见附录）覆盖 course/task/instance/submission 的增改，但**缺**：`auth.login`/`auth.logout`/`auth.failed_login`/`auth.register`（无任何认证审计）、`user.create`/`user.role_change`/`user.password_reset`（角色 student↔teacher↔admin 变更不留痕）、`submission.delete`（见 F-DB-02）。
- 影响: 教育系统最需审计的三类敏感操作（谁登录、谁改了权限、谁删了成绩）恰好都不在审计里。安全事件溯源、越权排查、成绩纠纷无据可查。
- 修复方向: 补认证事件（含失败登录，供暴力破解检测）、角色/权限变更、成绩删除三类审计；`AuditLog.action`/`targetType` 建议收敛为受控取值（见 F-DB-11）。

## F-DB-08 · 软删除三套机制并存且不统一，历史记录删除语义混乱
- 严重级: P1
- 证据: 全库存在 4 种"删除"语义：① `deletedAt` 时间戳（仅 `Course`）② `hiddenAt`/`hiddenBy` 时间戳（仅 `StudyBuddyPost`）③ `status = archived` 枚举（`TaskInstance`、`Announcement`）④ 纯硬删（`Task`/`Submission`/`TaskInstance`(draft/closed)/`Chapter`/`Section`/`ContentBlock`/`StudentGroup`/`CourseKnowledgeSource`/`TaskBuildDraft`/`ScheduleSlot`）。同类"历史价值高"的记录用不同策略：Course 能归档恢复，但 Submission/Announcement 一删即毁。
- 影响: 无统一"哪些模型该软删"的裁定，导致成绩（F-DB-02）、公告等历史记录走硬删无恢复；跨表 list 过滤逻辑各写各的（`deletedAt: null` vs `hiddenAt: null` vs `status != archived`），易漏过滤造成"已删仍显示"或"误删不可回"。
- 影响裁定（哪些该软删）: **必须软删** = Submission（学术记录）、Announcement（历史通告）、TaskInstance（已有 status 归档，统一到软删语义）；**可硬删** = 草稿态/未产出记录（TaskBuildDraft、draft 态 instance、无提交的配置）、纯结构块（重建成本低的 ContentBlock）。
- 修复方向: 统一软删约定（推荐全局 `deletedAt` + 全局 list scope 过滤），废弃 `hiddenAt`/`status=archived` 的分裂表达或明确其为业务态而非删除态。

## F-DB-09 · TaskInstance.groupIds 是 analytics 在用的伪外键，删组即静默悬空
- 严重级: P1
- 证据: `schema.prisma:518` `TaskInstance.groupIds String[]`；analytics 主动按其聚合——`lib/services/analytics-v2.service.ts:915/926` `StudentGroup.findMany({ where: { id: { in: groupIds } } })`、`scope-drilldown.service.ts:100/111` 同款。而 `group.service.ts:143` `prisma.studentGroup.delete` 硬删组时**不清理**任何 TaskInstance.groupIds 数组。
- 影响: 删除一个学生分组后，所有"曾指派给该组"的 TaskInstance 的 groupIds 里留下死 id；analytics 的 `where id in groupIds` 静默少匹配——即"该实例分组定向数据被无声破坏"，且无法反向高效查询"哪些实例定向了组 X"（数组 contains 无索引）。
- 修复方向: `TaskInstance`↔`StudentGroup` 改真多对多 join 表（含真外键 + 反向索引）；或在删组时事务内 scrub 相关 groupIds。

## F-DB-10 · AsyncJob/AiRun 无超时/心跳字段，worker 死亡即卡 running 无 reaper
- 严重级: P1
- 证据: `AsyncJob`(:902) 有 `attempts`/`maxAttempts`/`startedAt`/`completedAt` 但无 `heartbeatAt`/`timeoutAt`/lease 字段；`AiRun`(:968) `status` 默认 `running` 亦无超时。状态机 `running`/`queued` 靠 worker 正常收尾翻转，无兜底。（注：此库 AsyncJob 表不存在，无法实查卡死计数，仅 schema 设计层判定。）
- 影响: 规模化下 worker 崩溃/OOM/部署重启会留下永远停在 `running` 的 AsyncJob 与 `AiRun`——占用"进行中"名额、误导用量/成本统计、可能阻塞去重逻辑。AI 评分峰值排队场景（负载模型明确提到）尤其易触发。
- 修复方向: 加 `heartbeatAt`/lease TTL，配 reaper（超时未心跳→标 failed 可重试）；`AiRun` 加超时兜底把僵尸 running 归为 failed。

---

## P2 · 打磨

## F-DB-11 · 大量 status/type 类 String 未用 enum，取值约束漂在应用层
- 严重级: P2
- 证据: `AiToolSetting.strictness String?`(:1010) —— 项目里**明明有 `StrictnessLevel` enum**（`SimulationConfig.strictnessLevel` 在用），此处却退化成 String，同义不同型；`ScheduleSlot.weekType String @default("all")`(:762)（all/odd/even 明确枚举）；`AiRun.provider/feature/toolKey`(:973/972/971) 有已知取值集却 String；`CourseKnowledgeSource.sourceType String`(:870)（还带 `@@index`，说明被过滤查询）；`AuditLog.targetType String`(:1029)（就是模型名固定集）。
- 影响: 取值靠代码自觉，无 DB 约束，拼写漂移/脏值无阻拦；过滤查询（如按 sourceType）易因大小写/别名分裂。
- 修复方向: 有对应 enum 的（strictness）直接改用 enum；取值稳定的（weekType/provider/targetType）建 enum；确属开放集的（AuditLog.action）保留 String 但文档化取值表。

## F-DB-12 · 外键列缺索引（含一条 Cascade 走 seq scan）
- 严重级: P2
- 证据: 以下 FK 列无索引也无覆盖它的复合唯一：`Section.courseId`、`Section.createdBy`、`ContentBlock.courseId`、`ContentBlock.chapterId`(且为 `onDelete: Cascade`)、`Chapter.createdBy`、`TaskInstance.chapterId`、`TaskInstance.createdBy`、`Announcement.createdBy`、`TaskPost.authorId`、`ScheduleSlot.createdBy`、`ImportJob.taskId`。
- 影响: `ContentBlock.chapterId` 是级联删——删章时 PG 对 ContentBlock 按 chapterId 做 seq scan；`purgeCourse` 对 `Section`/`ContentBlock` 按 `courseId` 的 deleteMany（`course.service.ts:652-654`）同样无索引；`ImportJob.taskId` 列任务导入历史时全表扫。规模化后课程树删除/清查变慢。（`*.createdBy`/`authorId` 属低频，可缓办。）
- 修复方向: 至少补 `ContentBlock(courseId)`、`ContentBlock(chapterId)`、`Section(courseId)`、`ImportJob(taskId)` 索引；与 audit-scale 的查询性能条目合并去重。

## F-DB-13 · TaskBuildDraft.asyncJobId 松散 String 引用 AsyncJob.id，非真外键
- 严重级: P2
- 证据: `schema.prisma:942` `TaskBuildDraft.asyncJobId String? @db.VarChar(120)` + `@@index([asyncJobId])`，指向 `AsyncJob.id`（uuid String）但无 relation/FK 约束。
- 影响: 删除或清理 AsyncJob 后，TaskBuildDraft.asyncJobId 留悬空引用，无完整性保证；join 需手动。
- 修复方向: 改为真 relation（`AsyncJob?` + FK），或明确文档化为"仅审计引用、允许悬空"。

## F-DB-14 · User 子表 Cascade-vs-Restrict 不一致，成本账本随用户删被级联
- 严重级: P2
- 证据: `User` 的子关系里 `AsyncJob`/`AiRun`/`AiToolSetting`/`TaskBuildDraft`/`Feedback` 均 `onDelete: Cascade`（:920/990/1015/957/1093），而 `Submission`/`Course`/`Task`/`StudentGroup` 等无显式 onDelete = Prisma 默认 **Restrict**。
- 影响: 语义混乱——一旦 User 硬删，Restrict 子表先挡住整个删除，Cascade 子表的意图形同虚设；更关键的是 `AiRun` 是**成本/用量账本**，用 Cascade 意味着"删用户即销毁其 AI 消费审计"，与财务留痕诉求相悖。（当前代码无 `user.delete` 路径，故仅潜在。）
- 修复方向: 统一 User 子表删除策略；`AiRun`/`AuditLog` 类账本改 SetNull（保留记录、置空 actor）而非 Cascade。

## F-DB-15 · purgeCourse 手写十步级联，与 schema 无同步保障（维护风险）
- 严重级: P2
- 证据: `lib/services/course.service.ts:560-663` 手工按承重次序 deleteMany 11 类后代（含解 SET NULL 与 RESTRICT 的显式删）。逻辑正确且有 title 强确认 + audit（设计成熟），但完全依赖开发者记忆保持与 schema 同步。
- 影响: 未来新增 Course 后代表（如又一个挂 courseId 的表）若漏加进此函数，purge 时要么留孤儿（SET NULL 关系）要么被 RESTRICT 直接抛错——回归风险高，且无测试断言"所有 courseId 后代都被覆盖"。
- 修复方向: 加一条元数据驱动或测试断言（枚举所有引用 courseId 的表，校验 purge 覆盖完整）；或尽量把可 Cascade 的关系交给 DB 级联、只手删 SET NULL/RESTRICT 少数。

## F-DB-16 · Feedback.screenshot 以 base64 存 Text 列（行膨胀 + PII 入库）
- 严重级: P2
- 证据: `schema.prisma:1084` `screenshot String? @db.Text // base64 dataURL`。
- 影响: 每条反馈可能塞入数十~数百 KB base64，撑大行、拖慢 Feedback list 查询、膨胀备份体积；截图可能捕获学生 PII/成绩进入 DB 明文存储。
- 修复方向: 截图落对象/文件存储（复用 `FILE_STORAGE`），DB 只存路径；或对 screenshot 限尺寸 + 明确保留期。

## F-DB-17 · Class.code / academicYear 半死字段，且 code 非 unique
- 严重级: P2
- 证据: `schema.prisma:227-229` `code String?` + 注释 TODO "读取存在但 UI 未渲染"，`academicYear String?`；`code` 无 `@unique`。`class.service.ts` 未见 code 作为 join key 使用。
- 影响: 字段写而少读，属未完成特性残留；若未来 code 用作班级加入码，非 unique 会致加入歧义。
- 修复方向: 明确 code/academicYear 去留；若启用班级码则加 unique。

## F-DB-18 · Course.classId nullable 遗留（迁移期双轨，待清）
- 严重级: P2
- 证据: `schema.prisma:252-254` `classId String?` 标注 `@deprecated 待迁移期结束后删除`，新代码走 `CourseClass`。`20260516064500_drop_dead_schema_pr1` 已把它改 nullable + relation 改 SET NULL。
- 影响: 双轨字段增加读者认知负担；这正是 CLAUDE.md 反复告诫的"nullable 谎言"温床（历史教训 `Course.class`），需按计划收尾。
- 修复方向: 确认所有 reader/writer 已迁到 CourseClass 后，drop 该列与 relation。

## F-DB-19 · 缺失若干 unique 约束（多次提交、内容块顺序）
- 严重级: P2
- 证据: `Submission` 无 `(studentId, taskInstanceId)` 或含 attempt 序号的 unique（多次作答由 `TaskInstance.attemptsAllowed` 支持，但 Submission 无 `attemptNo` 字段，"第几次"只能靠 `submittedAt` 推断）；`ContentBlock` 有 `@@index([sectionId, slot, order])` 但无对应 `@@unique`，同槽 order 可重复。
- 影响: 多次提交场景缺显式尝试标识，"取最新/取最高"逻辑分散且脆；ContentBlock 顺序可撞导致渲染顺序不定。
- 修复方向: Submission 加 `attemptNo` 并视业务加 `(studentId, taskInstanceId, attemptNo)` unique；ContentBlock 视需要把 index 升为 unique。

## F-DB-20 · 学生 PII 无字段级加密/最小化，无匿名化/导出治理
- 严重级: P2
- 证据: `User.name`/`email`/`avatarUrl` 明文存储（`passwordHash` 用 bcryptjs cost 12 正确加盐哈希——密码这块没问题）；无字段级加密、无 PII 最小化、无删除/匿名化路径（User 被 Restrict 墙锁死永不可删，见总表 #1）。
- 影响: 毕业/离职学生 PII 永久留存无清理机制；合规（如个人信息保护）语境下缺"被遗忘"能力与导出能力。
- 修复方向: 制定 PII 保留策略 + 匿名化流程（毕业 N 年后脱敏）；评估 email/name 是否需加密或最小化；提供合规导出。

## F-DB-21 · 无数据保留策略，AI 对话/用量/旧提交无限增长
- 严重级: P2
- 证据: 全仓无 retention/TTL 配置（`.env.example` 无相关键）；`AiRun`（每次 AI 调用一行）、`StudyBuddyPost.messages`（对话 JSON）、`AsyncJob`、历年 `Submission` 均无清理/归档策略。
- 影响: 高频写入表（AiRun 尤甚，负载模型下每次评分/助手调用一行）无限增长，拖慢查询与备份、抬高存储；多年 AI 对话记录留存无期限也是隐私面。
- 修复方向: 定义分表保留窗口（AiRun/AsyncJob 冷数据归档或 TTL、旧 Submission 归档只读）；与 F-DB-01 备份策略统筹。

---

## 附录

### A. 真 DB 只读核查记录（`finsim-postgres` 容器 `finsim` 库）
- 表清单与精确行数：见正文 F-DB-03。三代表并存，最大 `users`(snake) 12 行、`User`(Pascal) 3 行，均为陈旧测试残留，无生产级数据。
- `_prisma_migrations`：5 条旧记录，全 `finished_at` 非空无 rolled_back，但 migration_name 与文件夹 28 条完全不同。
- 因当前表集不含 AsyncJob/AiRun/ImportJob 有效数据，**"卡死 job / 悬空外键 / 过期无提交 instance"等孤儿数据实查无法产出生产级结论**——该库不是活跃业务库。孤儿风险改由 schema+代码路径推断（F-DB-02/09/13）。

### B. Migration 卫生结论
- 文件夹 28 条为自洽 PascalCase 血统，`init` 建 `User`/`Class`/`Course`，后续 migration 显式 CREATE 全部新表（AsyncJob/Feedback/AiRun 均在），共 39 张 distinct 表（38 现存 + 已 DROP 的 TaskInstanceAnalytics）——**可从零 `migrate deploy` 重放**。
- 含 DML 的 migration 多为 Prisma 加 NOT NULL 列时的默认回填或有意 backfill（`20260422041600_backfill_course_class`、`drop_dead_pr1` 内幂等 INSERT），非手改 smell。
- 一处历史手改违规（直接改已 applied 的 backfill migration）已被 `20260426010000_add_pgcrypto_extension` 记录并补偿修正——治理响应得当。

### C. 现有 AuditLog action 覆盖清单（37）
ai_grading.complete/failed · auto_release_batch · chapter.create/update/delete · contentBlock.create/update/delete · course.archive/purge/restore/update · course_class.add/remove · course_knowledge_source.delete · graded · import · instance_release_mode_changed · section.create/update/delete · study_buddy_post.hide · submission.grade/ungrade · submission_released/unreleased · task.delete/update · task_draft.approve · task_instance.close/create_with_task.publish/delete/publish/reopen/snapshot_update/update
（缺：认证类、user/role 类、submission.delete —— 见 F-DB-07）
