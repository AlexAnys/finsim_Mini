# Spec — 全面审查（产品 + 工程）2026-07

> 状态：待用户确认。确认后 5 个 Opus 审查 agent 并行执行，coordinator 汇总。

## 用户诉求（原话摘要）

整体 review finsim_mini 的代码和功能：现有 bug + 大规模服务后可能的 bug；各功能的效果与呈现，是否冗余、哪些仓促上线需完善；交互逻辑（尤其数据洞察看板）是否有更优呈现方式；数据分析是否客观、基于多维度；数据库结构和治理现状。产品 + 工程双层面彻底审查，输出优化和革新方向。

## 审查基线

- 本地 main @ f45b94c（含 course-archive、feedback 等已合并功能；[ahead 9] 均为 harness docs）
- 规模现状：34 页面 / 97 API 端点 / 36 services / 38 模型 / schema 1098 行 / 28 migrations
- **只读审查，不改任何应用代码**。修复作为后续 unit，按用户挑选的优先级另开 spec

## 负载模型（待用户确认）

多校部署，课堂高峰 500–2000 学生同时在线作答/提交，AI 评分请求峰值排队；教师端课后集中看数据。

## 分工（5 个并行 Opus agent，各产一份报告到 `.harness/reports/audit-2026-07/`）

| Agent | 章程 | 产出 |
|---|---|---|
| **audit-arch** | 工程质量与现存 bug：97 端点逐一过 auth 守卫/Zod 校验/错误映射覆盖；三层架构违例；类型说谎（参考 :1141 `Course.class` 教训）；service 接口一致性；死代码/TODO 清单；测试覆盖地图 | `arch.md` |
| **audit-scale** | 规模化隐患："1000 并发学生时什么先崩"排序。N+1、列表无分页、索引与查询错配、事务与竞态（并发提交/评分幂等/cron 与在线路径冲突）、AI provider 限流/超时/fallback/成本、连接池、JSON 大字段进列表查询、缓存缺失 | `scale.md` |
| **audit-db** | 数据库结构与治理：38 模型逐个评审（范式/JSON blob 滥用/nullable 谎言/枚举）、级联规则、索引覆盖、软删除一致性（deletedAt 仅 Course 有——其他模型删除语义是否统一）、migration 卫生、孤儿数据实查、备份与数据保留缺口 | `db.md` |
| **audit-product** | 产品功能走查（真浏览器 :3000，三角色）：全部 34 页面逐页体验，每功能给判级（成熟/可用但粗糙/半成品/冗余候选）；重点核查疑似冗余对：analytics vs analytics-v2、4 个 AI 教师页、study-buddy 双端；交互逻辑问题；文案/空态/加载态/错误态；375px 抽查 | `product.md` |
| **audit-insights** | 数据洞察专项（代码 + 浏览器）：全部分析面——analytics、analytics-v2（diagnosis/drilldown/scope-insights/recompute）、instance insights、objective-stats、weekly-insight、study-buddy analytics、ai-usage。指标公式逐个审计客观性（聚合方式、小样本、AI 评分方差被当真值、维度缺失如作答时长/尝试模式/题目区分度）；"教师看完能做什么决策"检验；重设计提案（维度 × 呈现矩阵） | `insights.md` |

## 汇总（coordinator）

`AUDIT.md`：执行摘要 + 全部发现去重后按 P0（数据错误/安全/必崩）/ P1（规模化必炸/核心体验硬伤）/ P2（打磨）分级 + quick-win 清单 + 结构性改造路线图（每项可直接转为后续 unit spec）。

## 验收标准

1. 每条发现必须有证据：`path:line` 或浏览器复现步骤，禁止"感觉不好"式结论
2. 每条发现含：严重级、影响面、修复方向（不写实现细节）
3. product/insights 两份基于真浏览器走查（curl 200 ≠ 没崩，见 MEMORY）
4. scale 报告按"先崩顺序"排序而非平铺罗列
5. insights 报告必须回答用户三问：呈现是否有更优方式（给方案）/ 分析是否客观（逐指标裁定）/ 维度是否充分（列缺失维度）
6. AUDIT.md 中文，发现去重（多 agent 撞同一问题合并计一条）

## 纪律

- 共享 dev DB(5432)：**严禁 reset/seed/drop**（见 HANDOFF）
- 走查需造数据时用 `ZZAUDIT` 前缀，结束 purge 到 0 leftover（沿用 qa fixture 纪律）
- 不改应用代码、不 commit 应用文件；只写 `.harness/reports/audit-2026-07/`

## 悬而未决（用户裁定）

1. 负载模型数字是否符合真实预期
2. 修复不在本次范围、报告后按优先级另开 unit——是否同意
3. 审查含刚合并的 course-archive 和 feedback，不含未开工的 miniapp/PWA 计划——是否同意

## 决策记录（2026-07-12 执行中追加）

1. **环境阻塞**：:3000 实为 Multica 非 FinSim；本目录无 .env 从未跑过；本地 5432 finsim 库为陈旧残留（5/28 migrations，与文件夹不匹配）。
2. **用户决策**：选 A 本地重建（最新 main 基础）；明确同意 `prisma migrate reset --force`（Prisma AI 闸二次确认通过）；Mimo key 从已部署环境取用。
3. **执行**：.env = .env.example + 容器真实 DB 密码 + :3001 + 随机 secret + 生产 MIMO 4 变量；reset + 28 迁移重放 + seed 9 账号；dev :3001 已验证"灵析"内容渲染。
4. **新发现（将入 AUDIT，独立于五份报告）**：生产 .env 的 MIMO sk- key 已 402 Insufficient balance，且该 key 在订阅端点（token-plan-cn）401 无效 → 用户续费的订阅需 tp- key；**生产线上 AI 功能疑似正在故障**，待用户确认/提供 tp- key。
5. **调整**：product 走查先跑非 AI 部分 + quiz 客观题 e2e（不依赖 AI）；AI e2e 等 key 到位补测；ZZAUDIT 数据不再 purge（一次性库，成绩数据留给 insights 对账复用）。
