# Spec — Phase 8 · 用户反馈消化（教师工作台 + 课程编辑器 + 模拟核心 + 学生端 + 产品定位）

> 用户反馈日期：2026-04-26
> 老 spec 已归档到 `.harness/spec-codex-27-finding-archive.md`
> 本 spec 是个**计划阶段文档** —— 写下来给用户拍板，不是直接执行清单。

## Coordinator 评估

用户给的反馈量大（5 大块、20+ 项）+ 跨产品方向（命名/定位/首页文案）。
**不能一锅做完**。我把它拆成 5 个 Block，每 Block 内部再拆 PR，整体 4-6 周。

判定：
- **22 项纯工程**（直接执行，已有方向）
- **5 项需用户决策**（产品命名/定位/异步语义/审核流/Codex 边界）
- **3 项 Codex 友好**（标记出来你可决定外包）

---

## 现状摸底（5 分钟前刚做）

| 模块 | 文件 | 行数 | 关键点 |
|---|---|---|---|
| 教师工作台 | [app/teacher/dashboard/page.tsx](app/teacher/dashboard/page.tsx) | 242 | 8 子组件已模块化，重做工作量集中在子组件 |
| 课程编辑器 | [app/teacher/courses/[id]/page.tsx](app/teacher/courses/[id]/page.tsx) | **2787** | 单文件巨型，需要先拆 |
| 任务向导 | [app/teacher/tasks/new/page.tsx](app/teacher/tasks/new/page.tsx) | 739 | 4 步壳，可整合到课程页 |
| Sim Runner | [components/simulation/simulation-runner.tsx](components/simulation/simulation-runner.tsx) | 1445 | 已有"评估在后台完成"toast，需 UI 显化 |
| Study Buddy | [components/simulation/study-buddy-panel.tsx](components/simulation/study-buddy-panel.tsx) | 436 | 现为右侧固定，需改可拖拽 |
| 学生 3 页 | [app/(student)/grades/page.tsx](app/(student)/grades/page.tsx) / [study-buddy/page.tsx](app/(student)/study-buddy/page.tsx) / [schedule/page.tsx](app/(student)/schedule/page.tsx) | 332 / 474 / 82 | 3 页骨架仅 token 化 |
| PDF 导入 | [lib/services/import-job.service.ts](lib/services/import-job.service.ts) + [api/import-jobs](app/api/import-jobs) | 160 + 67 | **后端 worker 已实现** (pdf-parse + status 状态机)，UI 没显示进度 |
| Schema | `ImportJob` 已有 `status / totalQuestions / processedQuestions` | - | 进度条所需字段已就位 |

**关键发现**：
- D1（提交后台异步）— 后端**已实现**（[simulation-runner.tsx:490](components/simulation/simulation-runner.tsx) toast `评估将在后台完成`）。问题在 UI 反馈不显化 + 学生看不到提交记录 + 没有"防答案泄漏"机制。
- C3（PDF 导入进度）— 后端 worker **已存在**，schema 字段就位，**纯 UI 缺失** + 可能 worker 在 dev server 重启时丢任务。
- D5（mood label 简化）— 当前 UI 已是 8 档，简化只是 UI 改动。

---

## Block 划分

### Block A · 产品定位 + 首页文案重塑【需用户决策】

**用户反馈 §2**：FinSim 命名都可以变，主页这些字太没品味（"练上 100 次"等），围绕"AI 解决老师面对学生个性化教学的痛点"重新思考。

**问题**：
- A1 · **产品命名**：FinSim → 新名字？保留？
- A2 · **一句话定位**：以"AI 解决老师个性化教学痛点"为锚，写产品 slogan
- A3 · **登录/注册页 hero 文案**：当前 [login/page.tsx](app/(auth)/login/page.tsx) 文案需要重写
- A4 · **首页（学生 dashboard / 教师 dashboard）greeting 文案**：去俗气数字（"练上 100 次"），换为指向 AI 价值

**给用户的推荐方向**（你决定）：
- 命名候选：保留 FinSim / 改名（如：金课 AI、学情通、TutorMind、智财课、慧教 AI）
- 定位候选 3 选 1：
  1. **【教师视角】"用 AI 把每节课的隐性问题变成可视行动"** —— 强调老师的痛点（不知道学生哪儿没学懂）
  2. **【学生视角】"用 AI 给每个学生一个有耐心的金融教练"** —— 强调个性化
  3. **【双视角】"师生协同的 AI 金融教学系统"** —— 中性，平台向

**我倾向 1**（贴申报方向：上海创 AI · 智能信息系统的"学业诊断"维度）。

### Block B · 教师工作台重做（5.1，8 项）

| ID | 反馈 | 改动 | 涉及组件 |
|---|---|---|---|
| B1 | 删右上"AI 生成任务"+"新建任务"按钮 | 删 [greeting-header.tsx](components/teacher-dashboard/greeting-header.tsx) 两按钮 | greeting-header |
| B2 | "AI 助手 - 本周建议"块挪到右上 | 重新布局 grid，AiSuggestCallout 移位 | dashboard/page.tsx + ai-suggest-callout |
| B3 | "查看洞察" → "一周洞察"，按一下生成跨课堂/班级/任务汇总 | **新 API + 新 prompt 管道**（qwen3.5-plus）；按钮触发 + cache | 新 `/api/ai/weekly-insight` + service |
| B4 | "今日课表" → "近期课表"（未来 4 堂课，加日期/周几/班级/位置） | [today-schedule.tsx](components/teacher-dashboard/today-schedule.tsx) 改名 + 数据源换"未来 4 节" | today-schedule |
| B5 | "需要关注" → "任务列表"（时间线排列 + filter：课程/当天/类型） | [attention-list.tsx](components/teacher-dashboard/attention-list.tsx) 重做：滚动列表 + 顶部 filter bar | attention-list |
| B6 | 任务卡片：去线条，加完成度/平均分/"测试"（模拟学生）按钮/"管理"（替"查看"）；可点卡片进入；班级名后加"相关章节·课前/中/后" | 卡片样式重做 + 数据补充 | attention-list 内部卡片 |
| B7 | 班级表现：filter 课堂（不 filter 班级），同课不同班级对比图（2 折线 + 2 柱状） | [performance-chart.tsx](components/teacher-dashboard/performance-chart.tsx) 重做：filter UI + 多线对比 | performance-chart |
| B8 | "待分析实例" → "典型实例" | 文案改 | weak-instances |
| B9 | KPI 删"待批改"+"班级均分"；"待批改" → "需审核"（仅人工审核） | [kpi-strip.tsx](components/teacher-dashboard/kpi-strip.tsx) 数据源改 + 逻辑筛"AI 待人工审核"的 | kpi-strip + 数据 |

**预估**：3 PR
- PR-DASH-1 · B1+B2+B4+B5+B8 + B9 文案/布局/重排（~400 行）
- PR-DASH-2 · B6 卡片重做 + B7 班级表现重做（~300 行）
- PR-DASH-3 · **B3 一周洞察**（最复杂，新 API/service/AI prompt + UI 触发；与 Block A 命名拍板后做）

### Block C · 我的课程页面重做（5.2，3 项）

| ID | 反馈 | 改动 | 风险 |
|---|---|---|---|
| C1 | 块编辑面板左移/不占整列；考虑：放章节上 / 课程路径下 / 直接结构内编辑（点小节名编辑） | [block-edit-panel.tsx](components/teacher-course-edit/block-edit-panel.tsx) + [toc-sidebar.tsx](components/teacher-course-edit/toc-sidebar.tsx) 重新布局 | **2787 行单文件 page** 需先拆 |
| C2 | "添加任务"整合"新建任务"页（删仪表盘入口已含 B1） | [tasks/new/page.tsx](app/teacher/tasks/new/page.tsx) 739 行整合到课程编辑器 | 高 — 涉及向导 4 步拆迁 |
| C3 | PDF 导入：进度条 + 拆题反馈 + 适配 finsim 风格 | UI 加 polling job status + 进度阶段（上传/分析/拆题/完成）+ 拆题预览 | 中 — 后端已有，纯 UI |

**预估**：3-4 PR
- PR-COURSE-1 · C1 块编辑器交互重做（~400 行）
- PR-COURSE-2 · C2 "添加任务"整合（~600 行 + 删除 tasks/new 路由）
- PR-COURSE-3 · C3 PDF 导入 UI 进度条（~200 行 + 可能修 worker 在 dev mode 丢失任务的小 bug）

### Block D · 模拟类任务核心交互重做（5.3，5 项）

| ID | 反馈 | 改动 | 决策点 |
|---|---|---|---|
| D1 | 结束对话不等待 + 学生端能看提交记录 + **学生端不实时显示评估结果**（防作弊） | UI：结束→即时跳转"已提交，分析中"+ 我的提交列表加分析状态 + 评估完成后**不自动显示分数**给学生 | **【需决策】**：是否引入"教师手动公布"按钮？还是 dueAt 过后自动公布？ |
| D2 | 客户 prompt 钻牛角尖，无法适应性协作 | 改 [ai.service.ts](lib/services/ai.service.ts) chatReply 系统提示词，加"客户在适当时候应配合学生推进对话" | **Codex 友好**：给清晰反例 + 期望行为，让 Codex 调 prompt |
| D3 | "记录当前配置" → "提交给客户" | UI 文案 + 语义改：当前是 snapshot 历史，改为"把这版提交给客户征求反馈"，触发客户 AI 对该配置评论 | 需新 AI 调用：客户对配置的反馈 |
| D4 | study buddy panel 可拖拽 | [study-buddy-panel.tsx](components/simulation/study-buddy-panel.tsx) 加 dragable position state（localStorage 持久化） | 中 — 纯 UI |
| D5 | 客户每句话 mood label 简化（去前缀，仅显示"犹豫"等） | 找到 mood chip 渲染处简化文案 | **Codex 友好**：纯 UI 改 |

**预估**：4 PR
- PR-SIM-1 · D1 提交语义 + 学生端提交记录 + 防作弊（~400 行 + schema？）
- PR-SIM-2 · D2 客户 prompt 调优（**Codex 候选**，~50 行 prompt + tests）
- PR-SIM-3 · D3 "提交给客户"语义 + 客户反馈 AI 调用（~250 行 + 新 API endpoint）
- PR-SIM-4 · D4 study buddy 拖拽 + D5 mood label 简化（**Codex 候选**，~100 行）

### Block E · 学生端 3 页重布局（用户反馈 §1）

| ID | 页面 | 现状 | 设计稿 |
|---|---|---|---|
| E1 | [/grades](app/(student)/grades/page.tsx) | 332 行，仅 token 化 | `.harness/mockups/design/student-grades.jsx` |
| E2 | [/study-buddy](app/(student)/study-buddy/page.tsx) | 474 行，仅 token 化 | `.harness/mockups/design/student-buddy.jsx` |
| E3 | [/schedule](app/(student)/schedule/page.tsx) | 82 行，**已有 3-Tab 现状**（保留） | `.harness/mockups/design/student-schedule.jsx` |

**预估**：3 PR
- PR-STU-1 · E1 grades 重布局（~400 行）
- PR-STU-2 · E2 study-buddy 重布局（~400 行）
- PR-STU-3 · E3 schedule 重布局（保留 3-Tab，仅视觉对齐）（~200 行）

---

## 关键决策点（按等级排序）

### 🔴 P0 · 阻塞所有工作的产品方向

1. **Block A 命名 + 定位**：FinSim 改不改？slogan 怎么定？
   - 推荐：保留 FinSim 名字（已积累）+ 重写 slogan（教师视角痛点向）
2. **Block A 主页文案重写方向**：俗气数字 → 价值锚
   - 推荐：教师 dashboard greeting "今天你能帮 X 个学生看清自己的盲区" 类
3. **Block D1 防作弊机制**：评估完成 vs 公布答案是否分两步？
   - 推荐：分两步。`Submission.status` 加 `analyzed` vs `released`；teacher 在 instance 详情页有"批量公布"按钮 + 可设 dueAt 后自动公布

### 🟡 P1 · 影响实施细节

4. **Block B3 一周洞察 prompt 管道**：是否真用 qwen3.5-plus？数据源是？
   - 推荐：是（中文 + 长 context 优势）。数据源：过去 7 天所有 graded submissions + 跨 instance 的 conceptTags 聚合 + scheduleSlots 关联到下次课
5. **Block C2 "添加任务"整合**：删除 [/teacher/tasks/new](app/teacher/tasks/new/page.tsx) 整个路由 vs 保留作为入口冗余？
   - 推荐：删除（用户明确说不要这个入口，留着造成认知噪音）

### 🟢 P2 · 可在执行时决定

6. **Block D3 客户配置反馈 AI 调用**：用 chatReply 复用还是新 endpoint？
   - 推荐：复用 chatReply，加 `mode: "config-feedback"` 参数
7. **Codex 协作边界**：哪些 PR 真用 Codex？
   - 推荐：D2（prompt 调优）+ D5（mood label UI）+ E3（schedule 视觉对齐）—— scope 小、判断少、可验证

---

## Codex 协作边界（用户反馈 §3）

**Codex 适合做**（明确 scope + 可机械验证）：
- ✅ **PR-SIM-2 · D2 客户 prompt 调优**：给 5 组反例（钻牛角尖对话）+ 期望对话样本，Codex 改 prompt + 写测试验证
- ✅ **PR-SIM-4 · D5 mood label UI 简化**：纯文案/UI 改动，给清晰 before/after
- ✅ **PR-STU-3 · E3 schedule 视觉对齐**：保留功能，仅 token 化对齐设计稿

**Codex 不适合**（需产品判断 / 跨页面一致性 / 架构决策）：
- ❌ Block A 命名定位（产品判断）
- ❌ Block B 工作台重做（跨组件一致性）
- ❌ Block C2 任务向导整合（涉及路由 + 数据流改动）
- ❌ Block D1 防作弊机制（架构决策 + 多面影响）

**给 Codex 的任务包格式**（每个 PR 都包含）：
1. 单页清晰任务描述
2. before/after 对比
3. 测试用例（输入/输出对）
4. **不要改的文件清单**（防止瞎扩 scope）
5. acceptance：tsc 0 / vitest +N / lint 0

---

## 整体执行顺序（推荐）

```
Week 1（决策 + 启动）
  ├── Day 1-2: 用户拍 Block A（命名 + 定位 + slogan）
  ├── Day 3-4: PR-DASH-1（B1/B2/B4/B5/B8/B9 文案 + 布局重排）
  └── Day 5: PR-COURSE-3（PDF 导入进度条，独立小 PR 不阻塞）

Week 2（教师工作台 + 学生 3 页）
  ├── PR-DASH-2（B6/B7 卡片 + 班级图）
  ├── PR-STU-1（grades 重布局）
  └── PR-SIM-2（**Codex** D2 客户 prompt 调优）

Week 3（一周洞察 + 课程编辑器）
  ├── PR-DASH-3（B3 一周洞察 AI 管道，最重）
  ├── PR-COURSE-1（C1 块编辑器交互）
  └── PR-SIM-4（**Codex** D4+D5）

Week 4（任务向导 + 模拟核心）
  ├── PR-COURSE-2（C2 任务向导整合）
  ├── PR-SIM-1（D1 提交语义 + 防作弊）
  └── PR-SIM-3（D3 提交给客户）

Week 5（学生端剩余 + 申报准备）
  ├── PR-STU-2（study-buddy）
  ├── PR-STU-3（**Codex** schedule 对齐）
  └── 启动上海 AI 案例申报准备（unit-01 student-ai-declaration 等）
```

---

## Acceptance（每 PR 通用）

- tsc 0 / 全 vitest 绿（新 tests 覆盖每条 fix）
- lint 0 errors（注：CI 修复后 0 errors 标准已立）
- build 25 routes 过
- /qa-only 真浏览器加载验收（关键 UX 改动）
- 真 curl E2E（涉及 API 改动）
- 多角色路由 200 无回归（学生 + 教师 + admin）
- 不引入新硬编码色（必须用 design tokens）
- 中文 UI 100%

## Risks（按 CLAUDE.md 反规则查）

1. **2787 行 [courses/[id]/page.tsx](app/teacher/courses/[id]/page.tsx) 巨型文件** — 改前必须拆，否则 diff 失控
2. **Schema 改动**（D1 可能加 `Submission.releasedAt`）— Prisma 三步：migrate dev / generate / kill restart dev server
3. **Service interface 改动**（B3 weekly insight + D3 config feedback）— 同 commit 改全部 caller
4. **删除 [/teacher/tasks/new](app/teacher/tasks/new/page.tsx) 路由**（C2）— 全代码 grep "/teacher/tasks/new" + sidebar 链接 + 测试
5. **Worker dev-mode 丢任务**（C3 排查）— pdf-parse 在 fire-and-forget 模式下重启会丢，需要文件持久化或重启时扫 uploaded 状态恢复

## 用户决策记录（2026-04-26）

- ✅ **A2 定位方向 = ① 教师视角**："AI 把每节课的隐性问题变成可视行动"
- ✅ **D1 防作弊 = ① 分两步** + **教师在任务界面设置/管理**
- 🟡 **A1 命名** — 待用户从候选中选

### D1 详细方案（教师可控的"分两步"公布）

**Schema 改动**（Prisma 三步）：
- `TaskInstance` 加 `releaseMode: "auto" | "manual"`（默认 `manual`）
- `TaskInstance` 加 `autoReleaseAt: DateTime?`（默认 = `dueAt`）
- `Submission` 加 `releasedAt: DateTime?`（NULL = 未公布；非 NULL = 已公布）

**学生端行为**：
- Submission 提交后立刻显示"已提交，分析中..."
- AI 分析完成（status=graded）但 `releasedAt IS NULL` 时：
  - 仅显示"已分析，等待教师公布"
  - **不显示分数 / feedback / rubric**
- `releasedAt` 非 NULL 时：显示完整结果

**教师端行为**（instance 详情页新区块）：
- 切换"自动公布 / 手动公布"toggle
- 选 auto 时设 `autoReleaseAt`（默认 dueAt）
- 单份 submission "公布"按钮 + 列表"批量公布"按钮
- "撤回公布"按钮（设 `releasedAt = NULL`，紧急撤回错放）

**Cron / 自动公布机制**：
- 加 `/api/cron/release-submissions` endpoint
- Vercel cron 或服务器 cron 调用，每 5 分钟扫一次：
  - `releaseMode = auto AND autoReleaseAt <= NOW() AND releasedAt IS NULL AND status = graded` → 批量 update releasedAt
- 默认 cron 不需要装，**有 cron 跑得 cron，没 cron 教师手动**（fallback 优雅）

**审计**：
- 每次公布 / 撤回 写 AuditLog（who/when/which submissions）

---

## 用户拍板待回项（命名候选见下）
