# HANDOFF

> 会话结束前由 coordinator 更新本文件。SessionStart hook 自动显示。

## 当前状态（2026-05-15）

🚀 **PR #12 已 squash merge 到 main** (`f2365b7`)

整个演示视频项目交付完成。无未完成工作。

## 项目交付总览

| 维度 | 数据 |
|---|---|
| Phase 1 | 演示稳定化（8 unit） |
| Phase 2 | 演示承诺兑现（4 unit，全 r1 即收） |
| Phase 3 | molly 真实演示数据建设（6 M-step） |
| Phase 4 | Polish 完整收尾（8 unit，全 r1 即收） |
| 用户反馈修复 | Unit-FB1 instance 详情页融合任务配置 + 闭环 redirect |
| Codex review 4 轮 | 10 P1 + 1 P2 全修（authorization gaps / cross-course over-match / atomic publish）|
| Ultrareview | `[]` 0 findings |
| commits（merge 前 27 个） | squash 为 main 的 `f2365b7` 单 commit |
| Schema migrations | 5 新（hiddenAt / SB courseId+taskId nullable / AiRun tokens / TaskBuildDraft approved / QuizQuestion knowledgeTagIds） |
| 单测 | 981 → 1094 (+113) |
| TypeScript / Lint | 0 错 / 0 errors |
| Final FAIL | 0 |

## 已兑现的演示视频核心承诺

1. ✅ 课程目录课前/课中/课后组织（chapter slot）
2. ✅ AI 自动识别文件结构提取章节知识点（XLS+DOCX → structuredData）
3. ✅ AI 扮演金融客户按评分量规打分（李志华人设 + evidence quote 学生原话）
4. ✅ 测验自适应模式少答题获得诊断（IRT 引擎 + 雷达图 + masteryReport）
5. ✅ Study Buddy 章节上下文有据可查（自由问 + excerpt 持久化 + emptyState 友好）
6. ✅ 数据洞察 4 维度建议（analytics-v2 真生成）
7. ✅ AI 调用全程留痕（/teacher/ai-usage + /admin/audit + tokens/cost/summary）
8. ✅ 教师主导 AI 默认待审（TaskBuildDraft approved 状态机 + 原子 publish）
9. ✅ 实例可重开 + 任务总览全 config 可改 + 协作教师权限上扬
10. ✅ task 模板改动不影响 in-flight instance（Unit 17 taskSnapshot）
11. ✅ 任务管理 IA 改造（instance 页融合任务配置 + 闭环 redirect）

## 演示数据建设（生产 DB 持久）

- molly@qq.com / 123456 (teacher)
- alex / belle / charlie / dexter @qq.com / 11 (students)
- 课程"个人理财规划"（id `8f7f653c-...`） + 5 章节
- 2 份真实材料（XLS + DOCX）AI 解析完成
- 3 类任务（sim + adaptive quiz + sub）发布到金融2024A班
- 6 学生 submission（含真实 AI 3 轮对话 + adaptive 8 题诊断）
- 6 graded + released

## Phase 4+ Backlog（独立 PR 后续做，不阻塞）

- **Unit-FB2**：任务创建 wizard "从已有任务起点"复用功能（用户提到）
- 主观题 wordLimit + 拍照按钮（移动端 polish）
- /admin/audit 跨教师视图丰富化（Unit 11 基础已有，UI 可扩）
- /teacher/tasks 列表页 row actions 增强（Unit 14 学生侧做了，老师侧未做）
- Codex r5 review（自动 trigger，merge 后回看）— 若有新 finding 进 backlog

## 持续保留的知识（git log 找不到）

- **Migration drift 处理**：SQL UPDATE checksum / cherry-pick 跨 worktree migration / Prisma 三步严格走
- **NextAuth 多 context race**：newContext per student + retry
- **AI mood 字段**：runner moodKeyFromLabel 中文→英文 mapping（submission schema 限 8-enum）
- **Worktree 并行节奏**：不同表 schema 改 + 时间戳错开
- **r1 即收 4 条件**（schema 版）：独立证据链 + deterministic acceptance + DB cleanup + Prisma 三步合规
- **行为底线**（CLAUDE.md 顶部，Unit 17 期间加）：不走捷径，<100% acceptance 必须先 ask
- **Plan approval 边界**（builder 两次越界后强调）：coordinator 批准的方案 = 那个方案，备选 ≠ 备选被批准
- **Codex review 多轮规律**：incremental review 必然多轮，每轮焦点不同 + 修一个会暴露相邻 bug

## 历史归档

| 文件 | 内容 |
|---|---|
| `HANDOFF-2026-05-pre-cleanup-archive.md` | 旧 HANDOFF |
| `spec.md` + `spec-amendments.md` | 当前 spec |
| `reports/phase3_molly_seed_r1.md` | Phase 3 完整记录 |
| `reports/probe_summary_r1.md` | 5 模块 probe r1 |
| `reports/bug_inventory_*_r1.md` | molly/alex 视角 65 bugs |
| `reports/build_unit{N}_r{M}.md` × 多 | 每 unit builder 报告 |
| `reports/qa_unit{N}_r{M}.md` × 多 | 每 unit QA 报告 |
| `plans/unit{N}_plan_r1.md` × 多 | 每 unit plan |

## 下次开干怎么开始

1. SessionStart hook 自动显示：最近 commits + 本文件
2. `gh pr view 12` 看 PR #12 完整描述 + 用户视角
3. 想造更多演示数据 / 加 Unit-FB2 → 用 phase3 模式（coordinator 亲自操作或开新 builder/qa pair）
4. 如果 codex r5+ 抓到新 issue → 开新 hot-fix PR

整个项目从 5 路 probe agent + 65 bugs 调研到 19 unit + 4 codex round + molly 真实数据建设 + PR merge，全 closed。
