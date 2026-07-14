# FinSim 全面审查 · 汇总报告（AUDIT）

> 基线：main @ f45b94c ｜ 2026-07-12~14 ｜ 5 个维度并行审查（工程/规模化/数据库/产品/洞察）+ coordinator 汇总
> 子报告：[arch.md](arch.md) · [scale.md](scale.md) · [db.md](db.md) · [product.md](product.md) · [insights.md](insights.md)（发现细节一律看子报告，本文只做去重、分级、排序）
> 原始发现 72 条，去重合并后按 P0/P1/P2 重排。编号 F-XXX-NN 指向子报告原条目。

---

## 一页总评

| 维度 | 判定 | 一句话 |
|---|---|---|
| 工程质量 | **扎实** | 授权体系化（60+ 端点仅 3 真实缺口）、型别纪律好、tsc 0 错、1265 测试全绿 |
| 产品成熟度 | **高，但核心闭环有一个洞** | 34 页 28 页"成熟"、空态/降级/文案普遍到位；**quiz 从 UI 无法发布**（确定性 400） |
| 规模化 | **差一个数量级** | 单机单池单进程架构，实际上限约一二百并发，离 500–2000 目标差 10 倍，且崩了无自愈 |
| 数据库治理 | **结构合格，治理有 P0 洞** | schema/级联/migration 卫生好；但零备份、成绩可无痕硬删、分析维度被 JSON blob 锁死 |
| 数据洞察 | **框架好，客观性有硬伤** | 证据回绑、数据质量护栏等设计先进；但周报数值让 AI 算、三套均分口径、算好的图表扔着不渲染 |
| 冗余 | **基本不存在** | 疑虑的 3 组（analytics v1/v2、4 个 AI 页、study-buddy 双端）全部裁定"都留"——整合早已完成 |

**总判**：这不是一个"仓促上线一堆半成品"的项目——工程与产品基本面比预期好。真正的问题集中在四类：**①正在发生的生产事故（AI key 402）②核心闭环上的单点断裂（quiz 发布）③规模化底盘缺失 ④数据治理与洞察客观性欠账**。

---

## P0（10 条 · 数据错误 / 安全 / 必崩 / 核心闭环阻断）

| # | 发现 | 来源 | 要点 |
|---|---|---|---|
| P0-1 | **生产 AI 疑似全故障（进行中）** | coordinator 实测 | 生产 `.env` 的 MIMO `sk-` key 已 402 Insufficient balance（订阅需 `tp-` key）；线上评分/模拟对话/学伴全部 AI 调用应正在失败。**待用户确认 + 提供 tp- key** |
| P0-2 | **quiz「创建并发布」确定性 400** | F-PROD-06（+F-PROD-15 同源） | 向导发出 UI 从不暴露的空 `task` 字段，3/3 复现，`TaskInstance`=0 行；UI 唯一发布路径必败、无旁路 → quiz 类型整体不可用。由 P1 升 P0（"必崩"于核心闭环） |
| P0-3 | **全库零备份** | F-DB-01 | 全部成绩只活在单个 Docker volume；`down -v`/磁盘故障/坏迁移 = 不可恢复全量丢失 |
| P0-4 | **成绩可被无痕永久硬删** | F-DB-02（关联 F-DB-07、F-ARCH-06） | 教师即可 `DELETE /api/submissions/[id]`，裸删、无审计、无软删、无恢复；成绩纠纷/申诉无据 |
| P0-5 | **并发提交无唯一约束（竞态）** | F-SCALE-04 + F-DB-19 | 双击=两条 submission+两次 AI 评分；`attemptsAllowed` 失守；污染 analytics 均分 |
| P0-6 | **DB 连接池必崩** | F-SCALE-01 | 默认 ~5–9 连接被 Web+评分共用；峰值 60s ~32,000 查询 → ≥300 并发全站 500（连登录都挂） |
| P0-7 | **AI 评分无上限扇出、无超时、fallback 失效** | F-SCALE-02（放大项 F-SCALE-10） | 2000 提交=2000+ 并发 AI 调用（quiz 简答 N+1 更放大）；评分调用无 abortSignal 可无限挂起；fallback 只在"缺 key"时切且默认同上游 |
| P0-8 | **周报班级均分/错误率由 AI 算术** | F-INS-01 | LLM 在 200 行原始分上自己算 avgScore/errorRate，不可复现不可对账；教师据此做班级决策 |
| P0-9 | **同一任务"均分"三套口径零标注** | F-INS-02 + F-INS-09 | 算例：同任务首页 76.7% / 洞察板 85.0% / 实例页 7.7 分；同屏 KPI 与直方图也不吻合 → 信任崩塌 |
| P0-10 | **教师越权读任意学生全部提交**（多校即 P0，单校 P1） | F-ARCH-01 | `GET /api/submissions?studentId=X` 无资源校验；多校部署=跨校读成绩。按你的多校目标预置为 P0 |

---

## P1（主题簇 · 18 条合并后）

**A · 无自愈运维**（崩了起不来）
- 无任何 cron 调度器：三个 sweep/release 端点从不运行 → 卡死评分永不回收、`releaseMode=auto` 永不自动公布（F-SCALE-03）
- AsyncJob/AiRun 无心跳/超时字段，worker 死亡即永久 running（F-DB-10）

**B · 废弃 `Course.classId` 残留 reader 家族**（同根三处）
- schedule-grid 三处 `.class.name` 未守空 → 新课排课后课表必崩（F-ARCH-04，型别说谎复发）
- 课程卡"学生—未关联班级"stat 误读废弃列（F-PROD-11）
- 双轨字段本身待收敛 drop（F-DB-18）

**C · 规模化性能**（先崩顺序见 scale.md）
- 学生 dashboard 无界查询 + `taskSnapshot` 大 JSON 进列表（F-SCALE-05）
- 教师 dashboard 每次拉 25k 行 JS 聚合、无缓存（F-SCALE-06）
- 高频 where/orderBy 缺索引（F-SCALE-07 + F-DB-12 合并）
- 本地磁盘存储+进程内队列/限流 → 无法水平扩展（F-SCALE-08）
- 文件上传/下载整文件进内存（F-SCALE-09）

**D · 数据模型锁死分析维度**（洞察缺维度的根因）
- 逐题作答/逐项评分锁在 JSON blob，DB 层无法按题目/维度聚合（F-DB-06）
- 知识点标签无字典表，String[] 无源真（F-DB-05）
- `TaskInstance.groupIds` 伪外键，删组静默悬空且 analytics 在用（F-DB-09）
- 软删除三套机制并存：Course 可恢复而 Submission/Announcement 一删即毁（F-DB-08）

**E · 洞察客观性与呈现**
- 题目正确率/班级热力/趋势线**算好了但组件 typed 成 `Array<unknown>` 丢弃不渲染**，3/4 版面给 AI 叙事（F-INS-03，呈现失败之首）
- AI 单次评分被当 ground truth 聚合、无信度声明（F-INS-05）
- 率/均分普遍无样本量 n、小样本无弱化（F-INS-04）
- 聚合路径遍布 `take:200` 静默截断，大班失真（F-INS-08）
- 教学建议 evidence 为 AI 自由文本未回绑，与 commonIssues 的确定性回绑双标（F-INS-06）
- 数据质量护栏默认折叠，critical 警告被藏（F-INS-07）

**F · 安全与治理**
- seed 无环境守卫：误跑即在生产植入公开密码 admin 后门（F-DB-04）
- AuditLog 缺认证/角色变更/成绩删除三类最敏感审计（F-DB-07）
- 任意教师可见全校班级、可挂任意班到自己课程（F-ARCH-02，多校升级）

**G · 产品与工程**
- 教师端 quiz 选项渲染为空 bullet（学生端正常，纯教师侧映射 bug；伴随 key-prop console error）（F-PROD-07 + F-PROD-08）
- grading 核心链路零 happy-path 测试；question-bank/import-job 处理不可信输入零覆盖（F-ARCH-08）

*已在审查中顺手解决：F-DB-03（本地 dev DB 三代漂移）——已 reset + 28 迁移重放 + seed 重建。*

---

## P2（26 条 · 索引）

打磨项不在此展开，按主题指向子报告：
- **工程**：三层违例 6 个重灾 route（outline-apply 502 行为最，F-ARCH-07）、读守卫兜删除（F-ARCH-06）、tag-questions GET 泄露（F-ARCH-03）、TASK_NOT_QUIZ 未映射落 500（arch 补充段）、`as any` 1 处（F-ARCH-05）
- **DB**：String 该 enum 5 处（F-DB-11）、TaskBuildDraft 松散引用（F-DB-13）、User 子表级联不一致/成本账本随删（F-DB-14）、purgeCourse 手写级联无同步保障（F-DB-15）、Feedback 截图 base64 入库（F-DB-16）、Class.code 半死字段（F-DB-17）、PII 无保留/匿名化（F-DB-20）、无数据保留策略（F-DB-21）、autoRelease 无界扫描（F-SCALE-11）、AiRun 写放大（F-SCALE-12）
- **洞察**：SB 分析两套实现（F-INS-10）、配置关键词误分类（F-INS-11）、mood 猜值填充（F-INS-12）、"退步"无幅度阈值（F-INS-13）、quiz maxScore 退 100（F-INS-14）、ai-usage take:10000 低估（F-INS-15）、frequency 用 AI 值（F-INS-16）
- **产品**：满分"100"无后端支撑且两端不一致（F-PROD-09）、学生课程列表与任务中心 enrollment 口径不一（F-PROD-10）、面包屑 i18n 缺口（F-PROD-12）、375px course-detail 溢出（F-PROD-13）、侧栏 AI 双入口语义（F-PROD-02）、死搜索框（F-PROD-03)、任课教师通用标签（F-PROD-14）、login 死锚（F-PROD-16）、校验红字不清除（F-PROD-17）

---

## Quick wins（低成本高收益，多数 ≤半天）

| 项 | 修什么 | 来源 |
|---|---|---|
| 1 | seed 顶部加 production 守卫（3 行） | F-DB-04 |
| 2 | 周报 avgScore/errorRate 改代码聚合，AI 只写文字 | F-INS-01 |
| 3 | 数据质量面板默认展开 + critical 顶部横幅 | F-INS-07 |
| 4 | schedule-grid 三处 `.class` 改 `?.` + 空态 | F-ARCH-04 症状级 |
| 5 | 课程卡 stat 改读 CourseClass | F-PROD-11 |
| 6 | `DATABASE_URL` 加 `connection_limit` + 事务 maxWait 调参 | F-SCALE-01 第一步 |
| 7 | 评分 AI 调用加 abortSignal 超时 | F-SCALE-02 第一步 |
| 8 | tag-questions GET 补 assert；TASK_NOT_QUIZ 补映射 | F-ARCH-03 |
| 9 | 全部率/均分补 `n=`，小样本阈值 3→10 且 warning | F-INS-04 |
| 10 | 宿主 crontab 定时打三个 cron 端点（部署侧一行） | F-SCALE-03 止血 |
| 11 | 教师端 quiz 选项渲染 + key prop 一并修 | F-PROD-07/08 |
| 12 | 面包屑映射补 3 个路由；login 死锚；死搜索框摘除 | F-PROD-12/16/03 |

---

## 革新路线图（每包可直接转 unit spec）

**第一梯队 · 止血与核心闭环（本周）**
- **R0 生产止血**：tp- key 换装生产+staging → 手动打 sweep 清卡死 → cron 调度接入（宿主 crontab / worker 容器）。前置：用户提供 key。〔P0-1 + F-SCALE-03〕
- **R1 数据安全底座**：定时 pg_dump + 异地保留 + 恢复演练；Submission 删除改软删+审计；补认证/角色/删除三类审计；seed 守卫。〔P0-3/4 + F-DB-07/04〕
- **R2 核心闭环修复**：quiz 发布 400 根因（payload 组装）+ missingFields 校正 + 满分口径统一 + 教师端选项渲染；修复后补跑"学生提交→自动判分→成绩回流"e2e + AI e2e（等 key）。〔P0-2 + F-PROD-07/08/09/15〕

**第二梯队 · 部署就绪门槛（1–2 周）**
- **R3 并发正确性**：Submission 唯一约束/attemptNo + 幂等化提交 + 事务收紧。〔P0-5〕
- **R4 AI 链路加固**：全局并发闸（按 provider 配额）+ 超时重试退避 + fallback 改"错误也切"且配不同上游 + AsyncJob/AiRun 心跳与 reaper + quiz 简答合并单次调用。〔P0-7 + F-DB-10 + F-SCALE-10〕
- **R5 查询与 payload 减负**：连接池容量规划（PgBouncer）+ dashboard select 白名单/分页 + JS 聚合改 SQL groupBy + 索引补齐（scale/db 清单合并）。〔P0-6 + F-SCALE-05/06/07 + F-DB-12〕
- **R10 权限收口**：`?studentId` 加可见学生集过滤 + classes scope + 写守卫统一。多校化前必做。〔P0-10 + F-ARCH-02/06〕

**第三梯队 · 洞察革新（产品价值最高，2–3 周）**
- **R6 洞察客观性**：canonical 均分口径 + 全面板 `basisLabel`（学 sim-objective-stats）+ AI 评分信度声明 + take:200 治理。〔P0-8/9 + F-INS-05/08〕
- **R7 洞察呈现重构**：insights.md §6 提案一落地——题目正确率排行/区分度、班级×章节热力、周趋势线上主看板（**字段已算好，接线即可**），AI 叙事降可折叠副栏；实例级三视图（分析 tab/洞察 tab/insights 页）收敛为一页分区。〔F-INS-03 + 提案一〕
- **R8 数据模型演进**：QuizAnswer/EvaluationScore 明细表（与 blob 并存）+ KnowledgeTag 字典 + groupIds 真 M2M + 软删语义统一。〔F-DB-05/06/08/09〕
- **R9 洞察维度扩展**（依赖 R8）：题目区分度、提交时间分布（赶 DDL 画像）、知识点掌握热力、时长×成绩课程级。〔insights.md §3 清单〕

**第四梯队 · 规模化与卫生（规模化前置）**
- **R11 水平扩展底盘**：对象存储（OSS/S3）+ 外部队列独立 worker + 限流状态共享化 → 多副本+负载均衡。这是 2000 并发的唯一出路。〔F-SCALE-08/09〕
- **R12 工程卫生**：grading happy-path×3 类型 + question-bank/import-job 用例 + 6 个重灾 route 业务下沉 service + PII/保留策略。〔F-ARCH-07/08 + F-DB-20/21〕

---

## 未尽事项（本轮审查未覆盖）

1. AI 依赖全链路 e2e（等 tp- key）：模拟对话、主观题 AI 评分、学伴、AI 出题
2. 客观题自动判分尾巴（被 P0-2 阻断，修复后补）
3. simulation/subjective 两类型发布路径（是否共用坏 payload）
4. 洞察指标活数据数值对账（等有 graded 数据后抽 2 指标复算）
5. `/teacher/tasks/drafts/[id]` 孤儿路由确认、通知铃铛接线、375px 全量（本轮抽查 5 页）
