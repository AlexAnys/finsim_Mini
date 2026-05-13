# Spec: 全项目功能与代码 Review（read-only）

## 用户原话

> 仔细 review 这个项目中涉及的所有功能，尤其是 AI 功能，还有一些其他自动化功能，比如课程大纲上传后自动识别和编辑，页面之间的逻辑依赖和关联，数据统计的准确性，以及按照当下的功能和模块，这个项目本身构建和开发的代码是否有可以优化和提升的地方。
>
> 用我理解的语言来简洁汇报（我不做技术决策 只关注实际效果），然后给出你的建议。

## 范围（5 条 review 流，并行执行）

| # | 流 | 核心问题 | 主要文件 |
|---|---|---|---|
| A | AI 功能链路 | AI 是否真的有用、是否会失败、给学生/老师的回复质量、provider 切换是否健壮、有没有"AI 失败用户看不见就当成功了" | `lib/services/ai.service.ts` (1023L)、`grading.service.ts` (569L)、`study-buddy.service.ts`、`ai-work-assistant.service.ts`、`app/api/ai/*` |
| B | 自动化输入流 | 老师上传大纲/教材后，AI 提取章节是否准确、能否人工修正、错了怎么救、任务草稿质量 | `document-ingestion.service.ts` (491L)、`course-knowledge-source.service.ts` (649L)、`task-build-draft.service.ts`、`question-bank-regex.service.ts` |
| C | 数据统计准确性 | 仪表盘/数据洞察的数字算得对不对、口径是否一致、缓存会不会让老师看到过期数据、空态/部分数据是否会误导 | `analytics-v2.service.ts` (2433L)、`scope-insights.service.ts` (1161L)、`dashboard.service.ts`、`scope-drilldown.service.ts`、`weekly-insight.service.ts` |
| D | 页面之间的依赖与关联 | 老师建任务 → 学生做 → AI 评 → 老师看分析，这一整圈是否顺畅、跳转/权限/loading/错误页是否健壮、客户端缓存有没有跨账号串号 | `app/(student)/*`、`app/teacher/*`、`app/(simulation)/sim/*`、各 `page.tsx` + `layout.tsx` |
| E | 代码工程质量 | 三层架构守得住吗、Prisma 三步铁律是否还有漏网之鱼、超大 service 是否要拆、重复代码、未删的死代码、测试覆盖盲区 | 全项目 grep + 文件尺寸排序 + tsc/lint/vitest 跑一遍 |

## 团队配置

- **team 名**：`project-review`
- **5 个 sub-agent 并发**（全部 read-only）：
  - `reviewer-ai`（A）
  - `reviewer-automation`（B）
  - `reviewer-data`（C）
  - `reviewer-pages`（D）
  - `reviewer-quality`（E）
- 每个 agent 写一份报告到 `.harness/reports/review_{stream}_r1.md`，最长 1200 字以内、面向用户的语言、按"功能 / 问题 / 影响 / 建议"四段式
- 最后由 coordinator 汇总成一份**面向你的总览**

## Acceptance（怎么算 review 完成）

1. 5 份子报告齐全，每份都覆盖三件事：**这块功能在干嘛 / 用户能感知到的问题 / 优先级建议**
2. 每个问题都标"用户实际感受到的影响"
3. 每个建议都标优先级：🔴 应该尽快做 / 🟡 可以排期做 / 🟢 锦上添花
4. 汇总报告里：
   - 不超过 30 条结论
   - 不掉术语（必须用术语就加一句解释）
   - 明确说哪些问题"用户已经在踩坑"vs "潜在风险"

## 不做的事（避免范围爆炸）

- 不改代码、不补测试、不跑 build/dev server
- 不评审 UI 视觉细节（已经 phase 1-9 改过了）
- 不评审部署/CI（agent_docs/deployment.md 已有）
- 不深入数据库 schema 的范式问题（除非确实影响数据准确性）

## 风险

- read-only review，不触发 CLAUDE.md 的任何 anti-regression 规则
- 5 个 agent 并发不会冲突
- 唯一风险：每个 reviewer 可能漏掉跨模块的联系 — coordinator 在汇总时补这层视角
