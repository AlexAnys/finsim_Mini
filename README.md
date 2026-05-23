<div align="center">
  <img src="public/brand/lingxi-logo.png" alt="灵析 finsim" width="96" height="96" />

  <h1>finsim · 灵析</h1>

  <p><strong>面向中国高校金融教育的 AI 教学平台</strong></p>

  <p>
    教师建任务 · 学生在 AI 客户对话 / 测验 / 主观题中作答 · AI 批改 · 教师公布 · 数据洞察反哺备课
  </p>

  <p>
    <a href="https://finsim.anlanai.cn">生产</a>
    ·
    <a href="https://staging.finsim.anlanai.cn">Staging</a>
    ·
    <a href="agent_docs/deployment.md">部署架构</a>
    ·
    <a href="AGENTS.md">协作流程</a>
  </p>
</div>

---

## 这是什么

`finsim_Mini` 是金融个人理财方向的教学闭环平台。核心使用场景：

- **老师**：上传课程大纲与题库 → AI 出题 / 题库结构化导入 → 发布到班级 → 看每节课的弱点聚合与教学建议
- **学生**：在「模拟对话」里扮演理财顾问与 AI 客户多轮对话；在测验里作答；在主观题里写报告
- **AI**：扮演真实客户、批改答卷、聚合班级数据、给老师生成下周教学建议

技术形态：单体 Next.js 14 应用 + Postgres，所有 AI 经统一 provider 抽象层调用，部署在阿里云单台 ECS（Caddy 反代 + Docker Compose）。约 8 万行 TypeScript / 37 个 Prisma 模型 / 34 个 Service / 105 个 vitest 文件 1110 个测试 + 5 条 Playwright 主线 smoke 进 CI。

## 快速开始

```bash
git clone https://github.com/AlexAnys/finsim_Mini.git
cd finsim_Mini
cp .env.example .env       # 至少填 DATABASE_URL / NEXTAUTH_SECRET / MIMO_API_KEY
docker compose up postgres -d
npm ci
npx prisma migrate dev
npm run db:seed
npm run dev                # http://localhost:3000
```

测试账号（seed 完成后）：

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 管理员 | `admin@finsim.edu.cn` | `password123` |
| 老师 | `teacher1@finsim.edu.cn` | `password123` |
| 学生 | `student1@finsim.edu.cn` | `password123`（A 班） |

## 架构概览

### 三层服务（强约定）

```
Route Handler (app/api/)  →  Service (lib/services/)  →  Prisma (lib/db/)
   ├─ Zod safeParse              ├─ 业务逻辑唯一住所         ├─ 类型安全 ORM
   ├─ requireAuth/Role           ├─ throw new Error("CODE")  └─ 显式 include
   └─ 仅做 parse → call → resp   └─ 由 handleServiceError 映射 HTTP
```

Route Handler **不允许**含业务逻辑；Service **不允许**直接返回 NextResponse。所有错误用错误码字符串抛出，`lib/api-utils.ts:handleServiceError` 统一翻译为中文 + HTTP 状态。

### 三种任务、一套 Runner 框架

| 类型 | 用途 | 配置 model | Runner | 批改方式 |
|---|---|---|---|---|
| `simulation` | 多轮 AI 对话角色扮演 | `SimulationConfig` + `ScoringCriterion[]` + `AllocationSection[]` | `SimulationRunner` | AI 评分对话 + rubric + 资产配置表 |
| `quiz` | 单/多选 / 判断 / 简答 | `QuizConfig` + `QuizQuestion[]` | `QuizRunner` | 客观题自动判 + 简答 AI 评 |
| `subjective` | 报告 / 论述 / 附件 | `SubjectiveConfig` | `SubjectiveRunner` | AI 评分 + rubric |

### AI Provider 抽象 + Prompt Registry

所有 AI 调用走 `lib/services/ai.service.ts`：

- 默认 provider = MiMo（小米 OpenAI 兼容）；fallback = MiMo；OCR 路径独立可选 qwen-vl-ocr / mimo-v2-omni
- **Prompt registry**：`lib/ai/prompts/` 集中 23 个 feature builder 文件（simulation-chat / evaluate / quiz-grade / study-buddy / weekly-insight 等），每个 export `{ buildSystemPrompt, buildUserPrompt, version }`。教师 UI `/teacher/ai-settings` preview 从 builder **派生单源**，避免文案与运行时漂移
- `aiGenerateJSON` 的 retry loop：第二轮失败时自动追加「请只输出严格 JSON」提示；JSON-required feature 强制关闭 reasoning mode
- `extractJSON` 用平衡括号扫描，避开 thinking 模型 reasoning 文本污染
- 所有调用记 `AiRun` 表（feature / provider / model / promptVersion / 输入输出 / tokens / 耗时 / 状态），便于追溯准确度

### 审计 (default-on)

所有破坏性写操作（create / update / publish / delete / grade）经 `logAuditEvent` 写入 `AuditLog`（含 `actorRole` 自动推导 owner / collaborator / admin）。**默认开启**，不再受 env gate 控制。

### 数据流：一份学生提交的生命周期

```
1. 学生在 Runner 提交         → POST /api/lms/submissions
2. Service 写入 Submission     → enqueue AsyncJob(submission_grade)
3. AsyncJob worker 调 AI       → grading.service.ts 评分 + 给反馈
4. Submission.status=graded    → 默认隐藏，等老师 release
5. 老师在 Instance 详情公布    → Submission.releasedAt = now
6. 学生在 /grades 看到分数     → 旁路：weekly-insight cron 聚合到老师 dashboard
7. 数据洞察 (analytics-v2)     → KPI / 班级差异 / 弱点 / AI 教学建议（24h scope cache）
```

## 关键目录

```
app/
  (student)/           学生端：dashboard / tasks / grades / schedule（route group，无前缀）
  (simulation)/sim/    模拟全屏运行器（无 sidebar，支持 ?preview=true）
  teacher/             教师端：dashboard / courses / analytics-v2 / instances / ai-settings
  api/                 Route Handlers，分 ai / lms / cron / files 子树
components/
  simulation/          AI 客户对话 + 资产配置 + mood 计 + 评估视图
  quiz/                测验 runner + 题目导航
  subjective/          报告/论述 runner + 富文本 + 附件
  analytics-v2/        数据洞察看板（KPI / 成绩分布 / 任务表现 / Study Buddy / AI 教学建议）
  study-buddy/         共享 PostThreadDialog（统计页 + 任务详情 SB mini 复用）
  task-wizard/         教师建任务 4 步向导
  teacher-course-edit/ 课程编辑器（章节小节 / 题库 / 大纲）
lib/
  ai/prompts/          23 个 prompt builder 文件（feature 级单源，AiRun.promptVersion 写真版本）
  services/            34 个 Service：所有业务逻辑
  auth/                requireAuth / requireRole / course-access / actor-role
  db/                  Prisma client + 共享 includes
  validators/          Zod schema
prisma/
  schema.prisma        37 个 model
  migrations/          24 个线性增量迁移
tests/
  *.test.ts            105 vitest 文件 / 1110 测试
  _fixtures/           共享 mock helper (prisma / users / requests)
  api/                 30 个 mutation route × 200/401/403 三角测试
  ai-prompts/          每 prompt builder 的 snapshot test
  e2e/smoke/           5 条核心主线（teacher publish / student submit / AI grade / SB / 一周洞察）进 CI
agent_docs/            部署、运维、专题文档
.github/workflows/     CI / Deploy / Deploy-staging / Cleanup-staging
```

## 技术栈

- **框架**：Next.js 14 (App Router) + React 19 + TypeScript
- **样式**：Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **数据**：PostgreSQL 16 + Prisma 6 ORM
- **认证**：next-auth (Auth.js) v5，邮箱密码 + 角色 (admin / teacher / student)
- **AI**：Vercel AI SDK + OpenAI 兼容 provider（主：MiMo / 备：Qwen / OCR：Qwen-VL）
- **图表**：Recharts（班级成绩分布 / 趋势 / KPI sparkline）
- **测试**：vitest（105 文件 / 1110 测试）+ Playwright 真浏览器 e2e（5 主线 smoke 进 CI fail-on-error）
- **部署**：Docker Compose + Caddy + 阿里云 ECS（cn-shanghai）

## 开发与发布工作流

> 详见 [`AGENTS.md`](AGENTS.md)（多 agent 协作约定）和 [`agent_docs/deployment.md`](agent_docs/deployment.md)（部署细节）。

```
feat 分支 → push → 自动开 PR
  ↓
GitHub Actions 并行：
  · ci.yml#quality           typecheck / lint / vitest
  · ci.yml#core-change-label 触摸 auth/grading/schema/deploy 时打红色 label
  · deploy-staging.yml       部到 https://staging.finsim.anlanai.cn + 5 主线 Playwright smoke
  ↓
PR 评论自动出现 staging URL
  ↓
人工在 staging 实测 → 点 Squash and merge
  ↓
deploy.yml 触发 → 生产 ~4 分钟上线
  ↓
cleanup-staging.yml 关 staging（仅当当前 staging 是这个 PR 时）
```

`main` 受 GitHub branch protection 保护：必须 PR + `quality` + `staging-deploy` 双绿才能 merge。强制 squash merge + 自动删 feature 分支。

## 常用命令

```bash
# 开发
npm run dev                  # localhost:3000
npx tsc --noEmit             # 类型检查
npm run lint                 # ESLint
npx vitest run               # 全套测试 (105 文件 / 1110)
BASE_URL=http://localhost:3000 npx playwright test tests/e2e/smoke/   # 本地真浏览器 5 主线

# 数据库
npx prisma migrate dev       # 新 migration（开发）
npx prisma migrate deploy    # 生产 / staging 增量
npm run db:seed              # 重灌测试数据
docker compose up postgres -d

# 部署 / PR
git checkout -b <agent>-<topic> origin/main
git push -u origin <branch>
gh pr create --base main --fill
gh pr checks                 # 看 CI 状态
```

## 项目状态

| 维度 | 状态 |
|---|---|
| 教师端核心闭环（建任务 / 发布 / 批改 / 数据洞察） | ✅ 已上线，使用中 |
| 学生端三 runner（quiz / subjective / simulation） | ✅ 已上线 |
| AI 批改与一周洞察 | ✅ 上线 |
| 题库 PDF 导入 | ✅ Regex 主路径覆盖 80% 中文格式 + AI fallback |
| 手机端适配 | ✅ runner + grades + dashboard 全 md 断点适配 |
| Staging 兜底环境 | ✅ 每个 PR 自动起 + 5 主线 Playwright smoke 自跑 |
| 测试自动护栏 | ✅ CI 跑 vitest + 5 主线 smoke fail-on-error；30 mutation route 三角测试 |
| 审计完整性 | ✅ default-on + actorRole 字段；ai_grading.complete/failed 留痕 |
| AI prompt 治理 | ✅ 23 文件 registry；basePromptPreview 派生单源；AiRun.promptVersion |
| Schema 减负 | ✅ TaskInstanceAnalytics 死表 + Visibility 死 enum + Task 冗余字段已清；Course.classId 标 deprecated 留迁移期 |
| 多 agent 并发开发 | ✅ feature 分支 + PR 流程隔离 |

### 近期重大更新（2026-05）

- **PR #14**（代码质量整治）：7 路并行 review → 4 candidates 落地 — 测试基础设施进 CI / 审计 default-on / AI prompt registry / schema 死字段清理。净 +6767/-4472。
- **PR #15**（6 UX bug 修复）：用户 staging 反馈的老师草稿状态机 + Study Buddy 卡片网格 + 任务详情 SB mini + 学生评分 P0（维度 CUID → 真实中文名 + transcript 时间轴 + 移动端响应式）+ dashboard 滚动。
- **PR #13**（任务实例编辑）：A2 inline 标题编辑 + C1-B AI 助手 localStorage 持久化 + A1 instance snapshot 编辑（Zod discriminated union）。
- **PR #12**（演示视频全模块兑现）：12 unit + molly 真实演示数据建设（chapter slot / structuredData / IRT adaptive quiz / SB excerpt / TaskBuildDraft approved 状态机 / AiRun 留痕 / hiddenAt 删除盘点）。

### 现存工程债（公开记录）

- **PR-2 已规划 4 候选**（来自 PR #14 review 综合）：
  - **B JSON 边界**：6 个 Json 字段加 zod schema + read 处 parse + versioned snapshot
  - **F AI 安全**：prompt injection boundary + rate-limit 改用 AiRun 表数据源 + 6 处 catch 统一 classifier
  - **G 权限合并**：`assertTaskInstanceWritable` 合 `isAuthorizedForInstance` + `assertScopeHierarchy` 抽象 + JWT 改密码不轮转修复
  - **H PR #13 followup**：双 endpoint 合并（`PATCH /[id]` + `/[id]/snapshot`）+ 4 个 `*-result.tsx` 收 config 表 + 清空字段语义
- **长期 backlog 候选 C（route 业务下沉 service）**：26 个 route 仍直接 `await prisma`，拆 5-10 个小 PR 分月推进（每 ≤200 行）
- **Study Buddy 数据**：需更多真实使用样本才能聚合
- **服务器内存** 3.5G，build 高峰需依赖 swap，未来可能升配

## 文档导航

| 看哪一份 | 何时 |
|---|---|
| `README.md`（你正在看） | 第一次接触项目 / 给外部人介绍 |
| [`AGENTS.md`](AGENTS.md) | 你是 agent / 多人协作开发 / 想 push 代码 |
| [`agent_docs/deployment.md`](agent_docs/deployment.md) | 服务器、Docker、Caddy、CI/CD 细节 |
| [`CLAUDE.md`](CLAUDE.md) | Claude Code 在本仓库的工作守则（架构 + Prisma 规则 + 反退化条款） |
| `agent_docs/*.md` | 历史专题文档（一周洞察 / 部署历程 / 学校反馈） |
| `.harness/spec-codereview-archive.md` | 7 路 codebase review 综合 + 10 numbered candidates（PR #14 起点） |

## 贡献

仓库目前对外不开放贡献。如有合作 / 问题，请联系仓库 admin。

## 协议

私有仓库，所有权利保留。
