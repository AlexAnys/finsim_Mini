# 申报规划：2026 上海市教师 AI 应用案例 —— 创 AI · 智能信息系统

> 长期方向 spec。不是当下执行单元。具体"哪一批 unit 什么时候开工"由 `.harness/spec.md` 逐轮覆盖。
> 单一事实源：本文件。其他地方（HANDOFF、progress.tsv、commit message）都指回这里。

## 1. 背景 & 决策

- 征集单位：上海市教育系统数字化转型工作领导小组办公室 + 教育部中央电化教育馆（教技资[2026]10 号）
- 关键时间：**6/1 上海报送截止** → 6/30 省级推荐 → 8/30 国家级推荐 → 12 月电子证书
- 上海职高配额：用 AI 50 / 创 AI 50 / 护 AI 50
- 国产化硬门槛：必须基于国产大模型（DeepSeek / 豆包 / 智谱 / 文心 / 通义）或国产开发平台（Coze / Dify / Qwen-Agent）

**决策**：
- ✅ 主申报：**创 AI → 智能信息系统**（FinSim 核心身份 = 课堂教学平台 + 学情分析系统）
- ✅ 不拆双报（一人一份即可，集中火力）
- ✅ 创新点候选两项，AI 量规为**必做**，学业诊断为**选做**（视 5/20 前进度）
- ⏸️ 具体实施不立即开工，先做当下的功能优化；改造在 5 月初启动

## 2. 创 AI 评价标准对齐（当前差距）

| 指标 | 权重 | 现状 | 差距 / 行动 |
|---|---|---|---|
| 导向性·价值导向正确 | 10 | 金融教育，立德树人 | 开发报告中正面表述 |
| 导向性·AI 赋能开发 | 10 | `.harness/` coordinator+builder+qa 三角色 + Stop hook + progress.tsv | **最强证据**，开发报告重点展示 |
| 实用性·有效解决问题 | 20 | 三种任务类型闭环完整 | ✅ 已达 |
| 实用性·操作简单易用 | 20 | Docker Compose 一键起 | ✅ 已达 |
| 影响力·开源分享 | 10 | 私有仓库 | 🔴 必须公开（unit-07） |
| 影响力·真实落地 | 10 | 无真实一轮课 | 🟡 需 1 轮真实使用 + 反馈（unit-10） |
| 创新性·开发角度新颖 | 10 | 多 Provider、多班级、Tabs 工作台 | ⚠️ 再补 1–2 个创新点更稳（unit-05 / unit-06） |
| 完整性·资料完整 | 10 | README + deployment.md | 🟡 补使用手册+安装手册+开发记录（unit-08 / unit-09） |

## 3. 改造单元列表（unit 级拆分）

> 每个 unit 是一次 coordinator→builder→qa 可独立消化的 scope。优先级 P 表示落地顺序。

### A. 合规改造（护 AI 维度，影响"规范应用说明"分项）

- **unit-01 · student-ai-declaration**（P1）
  Subjective / Simulation / Quiz 提交时强制加 AI 使用声明字段（使用环节 / 生成内容 / 审核方式）。对齐规范"引导学生规范使用"。
  影响：提交表单 UI、Submission schema、批改 prompt 中展示给 AI 审核老师。

- **unit-02 · ai-content-badge**（P1）
  所有 AI 生成内容（批改评语、AI 生成题目、AI 建议量规）在 UI 中加 "AI 生成" 徽标 + DB 字段 `isAiGenerated`。对齐规范"践行技术智能向善"。
  影响：数据库加字段、Submission / QuizQuestion / feedback 渲染层。

- **unit-03 · teacher-ai-review-gate**（P1）
  AI 批改结果进入 `pending_review` 状态，教师显式 confirm 后才变 `finalized`；开放性作业禁止 AI 直接作为最终评价。对齐规范"坚持育人主体地位"+"加强内容审查把关"。
  影响：Submission 状态机、教师批改 UI、导出/报告读取口径。

- **unit-04 · privacy-consent-desensitize**（P2）
  首次登录弹知情同意书；学生名单导出 / 分析报告默认脱敏（姓名→学号后四位、邮箱→hash）。对齐规范"合规合法处理数据"。
  影响：auth 登录流、export/analytics 输出层。

### B. 创新点（拉创新性 10 分）

- **unit-05 · feature-rubric-ai**（P1，必做）
  Subjective 任务新增"AI 生成评分量规"入口：教师输入任务说明 + 学习目标 → AI 返回可操作量规表（维度 / 等级描述 / 分数段）→ 教师审核后应用到该任务的 grading prompt。体现"助力评价增效 - 量规设计"场景。
  影响：SubjectiveConfig 加字段、新增 rubric.service 子方法、教师编辑页新增 AI 入口。

- **unit-06 · feature-diagnosis-report**（P2，选做）
  `CourseAnalyticsTab` 新增"AI 班级诊断报告"：一次 LLM 调用（输入脱敏的分数分布 + 常见错题），返回班级共性/个性问题 + 教学改进建议。体现"学业诊断"场景。
  影响：新增 analytics.service 方法、CourseAnalyticsTab 新 section。

### C. 开源 & 物料

- **unit-07 · opensource-prep**（P0，前置）
  仓库公开前清理：scrub .env.example 敏感默认值、加 LICENSE（建议 MIT 或 Apache-2.0）、加 CONTRIBUTING.md、README.md 补上截图 + 快速启动 + 案例申报说明段。
  决定：**新建 public 镜像仓 `finsim-edu`** 还是把 `AlexAnys/finsim_Mini` 直接转 public？待用户最终确认。

- **unit-08 · docs-user-manual**（P1）
  写三视角使用手册：教师（课程/任务/批改/分析）、学生（作业/模拟/查分）、管理员（学校/班级/导入）。存 `agent_docs/user-manual/`。PDF 导出可选。

- **unit-09 · docs-install-manual**（P1）
  合并并扩展现有 `agent_docs/deployment.md`：本地开发模式、Docker Compose 模式、独立服务器部署（含反代/HTTPS）、常见故障。存 `agent_docs/install-manual.md`。

- **unit-10 · real-pilot**（P1）
  邀请 1 位真实教师 + 1 班 20+ 学生跑 2–3 周（~4 月底启动、~5 月下旬收数据）。留：使用日志、任务数、提交数、批改准确率、教师/学生访谈反馈截图。为"真实落地"10 分提供证据。

### D. 申报材料

- **unit-11 · case-deliverables**（P0，最终交付）
  - 创 AI 案例信息表（PDF 盖章 + Word）
  - 开发与应用报告（Word，≤3000 字，四段：开发背景 / 设计与开发 / 应用过程与效果 / 创新与反思）
  - 演示视频（MP4，≤8 分钟，1920×1080，25fps，≥8Mbps；三段：案例概述≤2min / 实现功能≤5min / 应用情况≤1min；**不出镜**，PPT + 录屏 + 解说，AI 生成片段须标注）
  - 配套资源 ZIP（完整代码 + 使用手册 + 安装手册 + 开发记录）

## 4. 时间线（倒排，距今约 5 周半）

```
Week 1  (4/23–4/29)  规划定稿 + 决定开源策略 + Ultrareview 收尾合入 main
Week 2  (4/30–5/06)  unit-07 开源准备 + 启动 unit-10 真实试点
Week 3  (5/07–5/13)  unit-01 / unit-02 / unit-03 合规改造（3 个小 PR）
Week 4  (5/14–5/20)  unit-04 隐私 + unit-05 AI 量规（必做创新点）
Week 5  (5/21–5/27)  unit-06 学业诊断（若时间允许）+ unit-08 / unit-09 文档 + 收集真实反馈
Week 6  (5/28–5/31)  unit-11 写报告 + 录视频 + 打包配套资源
6/1     提交 jiaoshi.eduyun.cn
```

灰度：如 5/20 时 unit-05 未稳，砍 unit-06；如 5/25 时 unit-04 未稳，砍 unit-04（护 AI 分项丢一小块，不致命）。

## 5. 依赖的前置工作

- **Ultrareview 3 PR 收尾**（HANDOFF 中有详细步骤）：用户侧 commit + push + 浏览器手测 3 场景 + merge 到 main。作为"基础平台稳定"前提。
- **当下的功能优化**（用户本轮将要做的，具体内容待澄清）：优先合入后再启动案例改造，避免和 unit-01~11 产生 diff 冲突。
- **决定开源仓策略**：`finsim_Mini` 转 public，还是新仓 `finsim-edu`。前者简单但历史 commit 有 .env 风险需审查；后者干净但失去 star/star history 背书。

## 6. Risks

- **时间风险**：5 周半实际可执行时间 < 4 周（4/23–4/29 还在做当下优化 + ultrareview 收尾；5/28 之后全是文档/视频）。若中途有重大 bug 发现，必须砍 unit-06 或 unit-04。
- **国产模型 E2E 验证**：当前默认 qwen3-max ✅，但 evaluation / simulation 等 feature-specific 是否全程 qwen / deepseek，需在演示前 grep 一遍 `process.env.AI_*_PROVIDER` 配置确认。
- **开源泄密**：仓库 public 前必须 `git log --all -p | grep -iE 'password|secret|api[_-]?key|token'` 全扫 + scrub history（可能需要 `git filter-repo`）。
- **真实试点人力**：找 1 位教师 + 1 班学生愿意配合 2–3 周使用 + 反馈访谈，是硬阻塞。越早锁定越好。
- **视频录制门槛**：1920×1080 / 25fps / ≥8Mbps / AAC 128Kbps / 不出镜 / PPT+录屏+解说 / AI 生成内容须标注 —— 工具（OBS / Keynote + QuickTime）需提前练习。
- **harness 本身是证据但不能抢戏**：开发报告的核心是"FinSim 平台解决教学问题"，harness 是"我借助 AI 开发了这个平台"的赋能证据，控制在报告的"设计与开发"段 ≤500 字。

## 7. 里程碑验收（填入 progress.tsv 的单元标识）

- `M1-roadmap-locked`（本次会话，本文件写入即完成）
- `M2-opensource-live`（unit-07 完成）
- `M3-compliance-shipped`（unit-01~04 全合入 main）
- `M4-innovation-shipped`（unit-05 合入；unit-06 可选）
- `M5-docs-complete`（unit-08/09 完成）
- `M6-pilot-data-ready`（unit-10 收集到真实使用数据）
- `M7-case-submitted`（unit-11 提交至 jiaoshi.eduyun.cn，保留回执）

## 8. 与 CLAUDE.md 的关系

- 所有 unit 必须遵守 anti-regression #6~#10（改服务接口前 grep 所有 caller、一次改到位）
- Prisma schema 改动（unit-01 / 02 / 03 / 05 都会动）严格三步（migrate / generate / 重启 dev server + 真浏览器验证）
- UI 中文（征集要求 + CLAUDE.md 双重要求）
- 每个 unit 以 `progress.tsv` 一行收尾（含 git_commit）
