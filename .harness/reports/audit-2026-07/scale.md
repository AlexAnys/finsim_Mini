# 规模化隐患审查报告 · audit-scale

> 审查基线：main @ f45b94c ｜ 负载模型：多校部署、课堂高峰 **500–2000 学生同时在线作答/提交**、AI 评分峰值排队、教师课后集中看板
> 纪律：只读审查，无代码/DB 写。以下每条含数字论证。
> 结论一句话：**当前是"单容器 + 单 Node 进程 + 单 Postgres + 默认 Prisma 连接池 + 无并发上限的 setTimeout 任务队列"的单机架构，能扛的并发量级约在几十到一二百，离 2000 差一个数量级。第一个崩的一定是数据库连接池，紧接着是无上限的 AI 评分风暴，且因为没有 cron 调度器，崩了之后无法自愈。**

---

## 先崩顺序 Top 5（执行摘要）

| 排序 | 先崩点 | 触发阈值（粗估） | 崩相 |
|---|---|---|---|
| **#1** | **DB 连接池耗尽**（单个默认 Prisma 池 ~5–9 连接，被 Web 请求 + 评分任务共享） | 约 **50–150 并发**即开始排队；≥300 并发稳定 P2024/P2028 超时 | 全站 500，连登录都挂——不只是评分 |
| **#2** | **AI 评分无上限扇出**（2000 提交 → 2000+ 并发 AI 调用，无全局并发闸、评分调用无超时） | 峰值提交即触发 | Provider 429 风暴 / 连接耗尽；评分调用挂起，任务卡在 grading |
| **#3** | **无 cron 调度器 → 卡死任务永不回收**（三个 sweep/release 端点无人触发） | 一旦 #2 发生即永久化 | 学生永久停在"批改中"；auto 公布永不发生；无自愈 |
| **#4** | **并发提交去重缺失**（无唯一约束 + count-then-create 竞态） | 学生双击/双标签页即触发 | 重复 submission → 重复 AI 评分（成本 ×2）+ attemptsAllowed 形同虚设（数据错误） |
| **#5** | **学生仪表盘无界查询 + taskSnapshot 大 JSON 进列表** | 每个学生 dashboard = 5 查询、2 条无 take，且拉全部实例的完整任务快照 | 放大 #1（每连接占用时间更长、payload 膨胀） |

> #1 与 #2 共用同一个 Prisma 连接池与同一个 Node 进程，会**同时**爆炸、互相放大。#3 决定"崩了能不能自己起来"——目前答案是不能。

---

## 架构底盘（决定一切上限的三个事实）

1. **单容器长驻进程**：`docker-compose.yml` 只有 1 个 `app` 服务跑 `node server.js`（Next standalone），`restart: unless-stopped`，无副本、无水平扩展。`Dockerfile:66`。
2. **单个全局 Prisma Client，无 connection_limit**：`lib/db/prisma.ts:9` `new PrismaClient()` 未设 `connection_limit`；`DATABASE_URL`（compose:14 / .env.example:4）无 `?connection_limit=` 参数。Prisma 长驻默认池 = `物理核数 × 2 + 1` → 典型 2–4 vCPU 云主机 = **5–9 个连接**。Postgres（`postgres:16-alpine`，compose 无调优）`max_connections` 默认 100。
3. **无任何缓存/队列基础设施**：全仓 grep 无 `redis`/`p-limit`/`p-queue`/`bullmq`/`Semaphore`（唯一命中是注释）。HTTP 层无 `Cache-Control` 缓存（仅 2 处：AI chat `no-store`、files `max-age=300`）。任务队列是进程内 `setTimeout`。

**核心算术**：单池 5–9 连接被 Web 请求路径与评分任务路径**共享**。课堂铃响 60s 内 2000 学生提交：
- 2000 × POST /submissions ≈ 每请求 6–8 查询（守卫 + findUnique + createSubmission 事务 + enqueue）= **~14,000 查询**
- 2000 × 评分任务 ≈ 每任务 8–10 查询（deep findUnique + 2 次 updateGrade 事务 + AiRun 2 写 + audit + metadata）= **~18,000 查询**
- 合计 **~32,000 查询**争抢 5–9 连接。即便 10ms/查询、完美流水线：9 连接 ≈ 900 q/s → 排空需 **~35s**，远超默认 `pool_timeout` 10s；写路径用交互事务（默认 `maxWait` 2s）**更早在 2s 内抛错**。→ 峰值一到，全站 P2024/P2028 级联 500。

---

## F-SCALE-01 · DB 连接池耗尽（单池被 Web + 任务共享，未配 connection_limit）
- 严重级: **P0**（必崩）
- 先崩排序: **#1**
- 证据: `lib/db/prisma.ts:7-11`（单例 PrismaClient，无 connection_limit / datasource pool 配置）；`docker-compose.yml:14`（DATABASE_URL 无 pool 参数）；`.env.example:4` 同。全部 36 个 service + 97 端点 + async-job 评分任务共用这一个 `prisma` 实例。
- 数字论证: 默认池 5–9 连接 vs 峰值 ~32,000 查询/分钟（见上）。写入走交互事务 `prisma.$transaction`（`submission.service.ts:110`、`:278`、`:327`；`task-instance.service.ts:495`），交互事务持连接跨整个回调、默认 `maxWait=2s`——峰值下 2s 内拿不到连接即抛 P2028。Web 与任务共享池意味着评分风暴会把**登录、看板、提交**全部拖垮，不是局部降级。
- 影响: 约 50–150 并发起排队，≥300 并发稳定超时。课堂 500–2000 场景下这是**确定性全站不可用**，且是第一个崩的。
- 修复方向: 提高并显式设 `connection_limit` + 上 PgBouncer/连接池代理（transaction 模式）；Postgres `max_connections` 与内存同步调优；Web 请求路径与后台任务路径**分离连接池**（或把评分任务移出 Web 进程）；给交互事务设合理 `maxWait/timeout` 并尽量改非交互批量写。根因是"单机单池扛全部"，需容量规划而非单点补丁。

## F-SCALE-02 · AI 评分无上限扇出 + 评分调用无超时 + fallback 失效
- 严重级: **P0**（必崩）
- 先崩排序: **#2**
- 证据:
  - 无全局并发闸：`async-job.service.ts:34-43` `scheduleAsyncJob` = `setTimeout(()=>runAsyncJob, 0)`；`scheduledJobs` Set 只对**同一 jobId** 去重，不限制不同 job 的并发。提交入口 `app/api/submissions/route.ts:55` 每次提交即 enqueue+autoStart。→ 2000 提交 = 2000 个 `gradeSubmission` 在**同一进程内同时起跑**。
  - 评分 AI 调用**无超时/无 AbortController**：`ai.service.ts:860`（`aiGenerateText`）、`:929`（`aiGenerateJSON` 的 `generateText`）均无 `abortSignal`。只有流式聊天 `chatReplyStream` 有 30s abort（`:1212, :1271`）。评分走的是无超时路径 → 上游卡顿时任务无限期挂起。
  - 限流形同虚设：`ai.service.ts:584 checkRateLimit` 是**进程内 Map、按 user×feature 每小时计数**，且默认 `AI_RATE_LIMIT_ENABLED !== "true"` 直接放行。2000 个不同学生各调 1 次，永远撞不到 per-user 上限——**它不是全局并发/吞吐限制器**。
  - fallback 无效：`ai.service.ts:169-211 getProviderForFeature` 只在**主 provider 缺 key** 时切 fallback，对 429/超时/网络错误**不切**；且 `docker-compose.yml:21-22` `AI_FALLBACK_PROVIDER` 默认 = 主 provider `mimo`（同一家），即便切也切到同一个正在被打爆的上游。
- 数字论证: 2000 并发提交 ≈ 2000 并发 AI 请求打向单一 provider。simulation 评分 prompt（对话 transcript + rubric）约 2–6K input + ~1K output → 单次 ~5K token，峰值 **~10M token 瞬时**。主流 provider（qwen/deepseek/mimo token-plan）RPM/TPM 配额通常在数百–数千级 → 峰值必然 429 批量返回。加上 quiz 的 N+1（见 F-SCALE-11），实际 AI 调用数 > 提交数。
- 影响: Provider 429 风暴 + 本地 socket 耗尽；无超时的评分调用挂起累积；无 fallback → 直接失败或悬挂。学生端表现为长时间"批改中"。
- 修复方向: 引入**全局 AI 并发上限**（信号量/队列，按 provider 配额设并发数 + 排队）；评分 AI 调用加超时 + 重试退避；把"缺 key 才 fallback"改为"错误/超时也 fallback"，且 fallback 配到**不同**上游；峰值成本需按并发×token×单价预估并对账（`COST_PER_1K_TOKENS` 表缺 mimo/qwen3 条目，成本估算会落 null）。

## F-SCALE-03 · 无 cron 调度器 → 卡死任务永不回收、auto 公布永不触发（无自愈）
- 严重级: **P1**（规模化必炸，且让 P0 永久化）
- 先崩排序: **#3**
- 证据: 全仓无 `vercel.json` / crontab / `node-cron` / `setInterval` / GitHub Actions 定时（grep 全空）。`Dockerfile`/`docker-compose.yml` 无 cron sidecar。三个端点 `app/api/cron/{release-submissions,sweep-stuck-ai-runs,sweep-stuck-jobs}/route.ts` 只能被**外部**手动/定时触发（token 或 admin），仓库内无任何自动触发源。
- 数字论证: `sweep-stuck-jobs` 本可把 running>10min 的评分任务重置重跑、`sweep-stuck-ai-runs` 本可把 running>5min 的 AiRun 标失败——但两者**从不运行**。于是 F-SCALE-02 造成的挂起任务（学生停在 grading）**永久卡死**，无自愈。`autoReleaseSubmissions` 同理永不触发 → 所有 `releaseMode=auto` 的成绩**永远不会自动公布**给学生（除非有人手动打端点）。
- 影响: 把 #1/#2 的临时故障变成永久故障——这是"崩了起不来"的根因。也是一个功能正确性缺口（auto 公布语义在无 cron 部署下失效）。
- 修复方向: 部署侧接入真实调度（系统 cron / 平台 cron / 单独 worker 容器周期打端点）；或把 sweep 逻辑改为进程内 `setInterval` 兜底（注意多副本时的重复执行，`runAsyncJob` 的 `updateMany` 原子认领已具备幂等前提）。属部署形态问题，需 audit-arch/coordinator 联动确认线上是否已有外部 cron。

## F-SCALE-04 · 并发提交去重缺失：无唯一约束 + count-then-create 竞态
- 严重级: **P0**（数据错误 + 放大 AI 成本）
- 先崩排序: **#4**
- 证据: `prisma/schema.prisma:557-584` Submission 只有 `@@index([taskInstanceId, studentId])`（非唯一），**无 `@@unique`**。`submission.service.ts:99-108` 尝试次数校验 `count()` 在**事务外**先查，再 `:110` 事务内 create——典型 check-then-act 竞态；即便放进事务，ReadCommitted 隔离下无唯一约束/行锁也拦不住并发。
- 数字论证: 学生双击提交或双标签页 = 两请求并发，`count` 都读到 N<allowed，都进 create → **两条 submission，两个评分任务，两次 AI 评分**。2000 名紧张学生中双击概率不低；每例把该学生的 AI 成本翻倍并污染 analytics 均分/提交数（`dashboard.service.ts computeLiveAnalytics` 按 submission 逐条平均）。`attemptsAllowed=1` 在并发下**不成立**。
- 影响: 数据层重复记录 + 评分成本放大 + 尝试次数上限失守（潜在作弊面）。直接加剧 F-SCALE-02 的扇出规模。
- 修复方向: 加 DB 唯一约束（如 `(taskInstanceId, studentId, attemptIndex)` 或按业务的幂等键），用 upsert / `ON CONFLICT` 幂等化；提交入口做幂等 token；attempts 检查改为依赖唯一约束而非先 count。

## F-SCALE-05 · 学生仪表盘无界查询 + `include` 连带拉 taskSnapshot 大 JSON
- 严重级: **P1**
- 先崩排序: **#5**
- 证据: `dashboard.service.ts:189-305 getStudentDashboard`：
  - `mySubmissions` findMany（`:216`）**无 take**——拉该生**全学期全部**提交（虽 `select` 了标量、无大 JSON，但单调增长）。
  - `taskInstances` findMany（`:200`）**无 take**——本班全部 published+closed 实例。
  - 用 `include`（`:207`）而非 `select`：Prisma `include` 会**默认返回全部标量字段**，含 `TaskInstance.taskSnapshot Json?`（`schema.prisma:528`，一份完整任务快照：configs + 全部 quizQuestions + scoringCriteria）与 `groupIds`。→ 列表把每个实例的完整快照都捞出。
- 数字论证: 一门课一学期上百个实例，若含 50 题 quiz，其 `taskSnapshot` 可达 50–200KB/条；100 条 = **5–20MB** 从 DB 拉出并序列化进每个学生的 dashboard 响应。× 2000 学生并发 = 巨量 DB 读 + 网络 payload + JSON 序列化 CPU，且每次都占住稀缺连接更久（放大 F-SCALE-01）。教师端 `getTeacherDashboard` taskInstances（take 50，`:17-35`）同样 `include` 连带 taskSnapshot。
- 影响: 单个 dashboard 请求慢 + 重，峰值下显著延长连接占用时间，是把 #1 从"排队"推向"超时"的放大器。
- 修复方向: 列表查询一律用 `select` 白名单排除 `taskSnapshot`/`groupIds`（仅详情页按需取快照）；`mySubmissions`/`taskInstances` 加分页或时间窗（如仅近学期/近 N 条）；仪表盘状态派生所需字段最小化。

## F-SCALE-06 · 教师仪表盘 liveAnalytics 每次全量重算、无缓存
- 严重级: **P1**
- 先崩排序: 教师课后集中看板峰值的 #1
- 证据: `dashboard.service.ts:112-184`：`getTeacherDashboard` 每次加载都 `computeLiveAnalytics(最多 50 个 instanceId)` → `:157` findMany 拉这些实例**全部 graded submission** 的 score/maxScore，在 JS 里逐条归一化求均分。无缓存、无预聚合。另有 `:95-105` 三个 `count` 用嵌套关系过滤（`taskInstance:{course:{...}}`）生成关联子查询。
- 数字论证: 50 实例 × 每实例 500 提交 = **25,000 行**在每次教师 dashboard 加载时被拉出并在内存聚合。"课后集中看数据"= 多教师同时刷新 → 每刷一次一次 25k 行扫描 + 8 个并行大查询，叠加 F-SCALE-01 的连接争抢。
- 影响: 教师看板峰值下高延迟；与学生峰值错峰（课后 vs 课中）稍缓解，但同样吃同一个池。
- 修复方向: 均分/提交数用 SQL 聚合（`groupBy` + `AVG`）替代"拉全量到 JS"；引入短 TTL 缓存或复用已有的 `AnalysisReport` 物化（AI 洞察已缓存，见下）；dashboard 的多 `count` 合并/加索引支撑。
- 备注: AI 生成的洞察**已有缓存**（`scope-insights.service.ts:162` 按 `scopeHash`+时间窗、`insights.service.ts:122` 按 `commonIssues`/`aggregatedAt`），这部分不重复烧 AI——但底层**统计聚合**仍每次重算。

## F-SCALE-07 · 索引错配：高频 where/orderBy 缺索引
- 严重级: **P1**
- 先崩排序: 放大 #1（慢查询占住连接更久）
- 证据（对照 `prisma/schema.prisma` 与实际查询）:
  - `Submission.releasedAt` 无索引，但 `release.service.ts:260 autoReleaseSubmissions` 与学生剥离逻辑高频按 `releasedAt: null` 过滤。
  - `TaskInstance.autoReleaseAt` / `releaseMode` 无索引，`autoReleaseSubmissions` 的嵌套过滤 `taskInstance:{releaseMode:"auto", autoReleaseAt:{lte}}` 走全表 + 未索引列。
  - `Submission.submittedAt` 无索引，但 `orderBy:{submittedAt:"desc"}` 是 getSubmissions/dashboard 的默认排序（`submission.service.ts:225`）——大表排序无索引 = filesort。
  - 缺组合索引 `Submission (taskInstanceId, status)` / `(taskInstanceId, status, releasedAt)`：`computeLiveAnalytics`、批量公布、成绩列表都按实例+状态过滤。
  - 缺 `TaskInstance (classId, status)`：学生 dashboard 按 `classId + status in(published,closed)` 查（`dashboard.service.ts:201-206`），现只有单列 `classId`/`status` 索引。
- 数字论证: 无索引列上的 filter/sort 随表增长线性劣化。一学期 2000 生 × 数十任务 = Submission 表数十万行；`orderBy submittedAt` filesort 与 `releasedAt IS NULL` 全扫在峰值把单查询从 ms 级推到数百 ms，直接吃满连接占用预算。
- 影响: 与 audit-db 分工：此处只判"查询会不会慢"——上述模式在规模下必然慢。
- 修复方向: 按真实 where/orderBy 补组合索引（至少 `Submission(submittedAt)`、`Submission(taskInstanceId,status,releasedAt)`、`TaskInstance(classId,status)`、`TaskInstance(releaseMode,autoReleaseAt)`）；用 `EXPLAIN ANALYZE` 验证计划。

## F-SCALE-08 · 单进程 / 单容器 / 本地磁盘存储 → 无法水平扩展
- 严重级: **P1**
- 先崩排序: 决定"能不能靠加机器逃生"——目前不能
- 证据: `storage.service.ts:12 LocalStorageProvider` 写 `FILE_STORAGE_PATH=/data/uploads`（compose:41-43 本地 volume）；`docker-compose.yml` 单 app 服务。`Dockerfile:66` 单 `node server.js`。
- 数字论证: 文件只存在于该单容器磁盘，`/api/files/[...path]` 从本地读盘经 Node 返回——一旦加第 2 个 app 副本，副本读不到对方写的文件，上传/下载即坏。于是"水平扩展"这条常规逃生路被本地存储 + 进程内任务队列（F-SCALE-02/03）+ 进程内限流 Map（F-SCALE-02）共同焊死：**当前架构只能纵向加大单机**。所有 CPU 密集（JSON repair `ai.service.ts:683`、OCR poppler、20MB 文件缓冲）都挤在同一事件循环。
- 影响: 2000 并发的唯一出路（多副本）当前不可用；单机纵向扩展有物理上限。
- 修复方向: 存储切对象存储（S3/OSS）+ CDN；任务队列切外部（Redis/BullMQ 独立 worker）；限流/节流状态切共享存储；使这些无状态化后方可多副本 + 前置负载均衡。

## F-SCALE-09 · 文件上传/下载整文件进内存、无流式
- 严重级: **P1**
- 先崩排序: 内存峰值路径，叠加 #3 单进程
- 证据: 上传 `app/api/files/upload/route.ts` `Buffer.from(await file.arrayBuffer())` 整文件入内存再落盘；下载 `app/api/files/[...path]/route.ts:52` `readFile(fullPath)` 整文件读入 Buffer 再返回（非流式）。上限 20MB（`storage.service.ts:80`）。
- 数字论证: 100 并发 20MB 上传 = 瞬时 **~2GB** 仅缓冲区；主观题作业峰值（2000 生交带附件）叠加 OCR（poppler 子进程，CPU 密集）全在单进程 → 内存尖峰 + 事件循环阻塞 → OOM 风险 / 单进程无响应。
- 影响: 主观题 + 附件的课堂峰值可直接把单进程打到 OOM 或长阻塞。
- 修复方向: 上传/下载改流式（stream pipe 到磁盘/对象存储、`Content-Range` 支持）；OCR 移出请求进程到 worker；上传大小/并发做背压。

## F-SCALE-10 · quiz 评分 N+1 AI 调用（每简答题一次 + conceptTags 额外一次，串行 ×重试）
- 严重级: **P1**
- 先崩排序: 放大 #2 的 AI 调用总数
- 证据: `grading.service.ts:370-428 gradeQuiz` 对每个 `short_answer` 题串行 `await gradeShortAnswer`（`:405`），每次 `aiGenerateJSON` 默认最多 3 次尝试（`ai.service.ts:922 maxRetries=2`）；再加 `:460 extractQuizConceptTags` 一次 AI。
- 数字论证: 一份含 k 简答题的 quiz = **k+1 次 AI 调用**（最坏 (k+1)×3 = 3k+3 次上游请求），且串行 → 单份评分墙钟时间 = k 次调用延迟之和。400 份含 3 简答的 quiz = 1600 次基础调用（最坏 4800），叠加 simulation/subjective 各 1 次。实际 AI 调用数**远超**提交数，进一步压爆 F-SCALE-02。
- 影响: quiz 密集课堂的 AI 调用与延迟被 N+1 放大；单份评分墙钟时间长，任务在池里排更久。
- 修复方向: 简答批改合并为**单次多题** prompt（一次调用评 k 题）；conceptTags 复用同次输出或离线打标；受全局并发闸约束。

## F-SCALE-11 · autoReleaseSubmissions 无界 findMany + 嵌套未索引过滤
- 严重级: **P2**（当前因无 cron 不触发；一旦接入 cron 且规模大则慢）
- 先崩排序: 潜伏项
- 证据: `release.service.ts:260-270` findMany **无 take**，`where` 含嵌套 `taskInstance:{releaseMode,autoReleaseAt}` + `releasedAt:null`（三列均无索引，见 F-SCALE-07），随后一把 `updateMany(id in [...])`。
- 数字论证: 若某截止时刻 2000 人的 auto 实例集中到期，一次拉 2000+ 行 ID 再大 `IN` 更新；配合未索引列全扫。当前无 cron → 不触发（=功能未生效，见 F-SCALE-03）；接入 cron 后成为周期性重扫。
- 影响: 接入调度后的周期尖峰；当前是隐性功能缺口。
- 修复方向: 加 `take` 分批 + 游标；补 F-SCALE-07 索引；配合 F-SCALE-03 的调度方案。

## F-SCALE-12 · AiRun 写放大 + 无界增长（审计/成本聚合）
- 严重级: **P2**
- 先崩排序: 慢性膨胀
- 证据: 每次 AI 调用 `ai.service.ts:426 createAiRun`（1 写）+ `:509 finishAiRun`（1 更新）= **2 写/调用**，且 `getLastAiRunMetadata:555` 每次评分后再 1 读。AiRun 无保留策略/归档。`ai-usage.service.ts` 对该表做聚合看板。
- 数字论证: 结合 F-SCALE-10，峰值 AI 调用数 > 提交数 → AiRun 写入量 = 2× 调用数，叠在已耗尽的连接池上（每次评分额外 3 次 DB 往返只为留痕）。一学期累积数十万–数百万行，`ai-usage` 聚合与 `[createdAt]` 扫描渐慢。
- 影响: 峰值时留痕写入与主流程争连接；长期表膨胀拖慢用量看板。
- 修复方向: 留痕写入降级为异步/批量/采样；AiRun 加保留期与归档；用量看板改预聚合。

---

## 与其它审查员的分工说明
- **索引完整性 / schema 规范**（nullable、级联、范式）归 audit-db；本报告只判"高频查询会不会慢"（F-SCALE-07）。
- **基线可跑性（tsc/vitest）** 归 audit-arch，未在此运行。
- **端点 auth/Zod 覆盖** 归 audit-arch；本报告只在涉及负载路径时顺带引用。

## 统计
- 发现总数: **12**
- **P0: 3** — F-SCALE-01 连接池耗尽 / F-SCALE-02 AI 无上限扇出 / F-SCALE-04 并发提交去重缺失
- **P1: 7** — F-SCALE-03 无 cron 自愈 / -05 学生看板无界+大 JSON / -06 教师看板全量重算 / -07 索引错配 / -08 无法水平扩展 / -09 文件全内存 / -10 quiz N+1
- **P2: 2** — F-SCALE-11 autoRelease 无界扫描 / F-SCALE-12 AiRun 写放大
</content>
</invoke>
