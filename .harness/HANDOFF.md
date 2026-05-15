# HANDOFF

> 会话结束前由 coordinator 更新本文件。SessionStart hook 自动显示。

## 当前状态（2026-05-15）

- ✅ **Phase 1 完整收官**（8 unit 11 commits，演示稳定化）
- ✅ **Phase 2 完整收官**（4 unit 全 r1 即收，演示承诺兑现）
- ✅ **Phase 3 完整收官**（molly 真实演示数据建设，6 M-step 全 PASS）
- ✅ **Phase 4 完整收官**（8 unit 全 r1 即收，0 r2 兜底）
- 🚀 **PR #12 已开 + CI quality + staging deploy 全 pass**，等用户 staging 实测 → squash merge

## Phase 1+2+3+4 总成果

| 维度 | 数据 |
|---|---|
| commits（含 docs） | 27 |
| schema migrations | 5 新（hiddenAt + SB courseId/taskId nullable + AiRun tokens + TaskBuildDraft approved + QuizQuestion knowledgeTagIds） |
| 单测增量 | 981 → **1094**（+113 新单测） |
| TypeScript | 0 错 |
| Lint | 0 errors |
| Final FAIL | 0 |
| r1 即收率 | Phase 2 + 4 全 r1 即收；Phase 1 仅 2 个 r2 兜底（Unit 4 acceptance gap + Unit 6 critical regression caught）|

## Phase 4 unit 列表

| Unit | 修什么 | Commit |
|---|---|---|
| Unit 17 | taskSnapshot 字段消费（学生 runner 优先读 snapshot） | 2e69163 |
| Phase3-A | quiz-question-tagger 3 root cause + defense (publishTask + updateTask + byIdx) | 38a8d34 |
| Unit 12 | 主观题 allowedAttachmentTypes 实接 + capture 拍照 | 1cd477a |
| Unit 15 | 一周洞察空数据 emptyState + AI 错误文案分级 | 905ef4b |
| Unit 13 | 协作 dialog 显示现有协作者 + AlertDialog 二次 confirm + 学生占位 tab 隐藏 | f94750d |
| Unit 14 | 学生 dashboard 学习任务卡折叠 + AI callout 所有视口可见 | 0b9d564 |
| Phase3-B | .doc OLE2 上传 LEGACY_DOC_UNSUPPORTED 友好提示 | edf730b |
| Unit 16 | P2 收尾（modal 移动端 + 按钮字号 + KS AlertDialog + redirect 验证）| 4acbd18 |

## 已兑现的演示视频核心承诺

| 演示视频原话 | 兑现 |
|---|---|
| 课程目录课前/课中/课后组织 | ✅ chapter slot |
| AI 自动识别文件结构提取章节知识点 | ✅ XLS+DOCX 真 structuredData |
| AI 扮演金融客户按评分量规打分 | ✅ molly 真 simulation（李志华人设，evidence 引用） |
| 测验自适应模式少答题获得诊断 | ✅ IRT 引擎 8 题诊断 + 雷达图 + tagger root-cause 修 |
| Study Buddy 章节上下文有据可查 | ✅ 自由问 + excerpt 持久化 + emptyState 友好 |
| 数据洞察 4 维度建议 | ✅ analytics-v2 真生成 |
| AI 调用全程留痕 | ✅ /teacher/ai-usage + /admin/audit + tokens/cost/summary |
| 教师主导 AI 默认待审 | ✅ TaskBuildDraft approved 状态机 |
| 实例可重开 + 任务总览全 config 可改 | ✅ Unit 2 + Unit 4 |
| 协作教师可改课程结构 + 建班 | ✅ Unit 5c 权限上扬 |
| **task 模板改动不影响 in-flight instance** | ✅ Unit 17 taskSnapshot 消费 |
| **.doc 友好提示**（旧文件兼容）| ✅ Phase3-B |

## 持续保留的知识（git log 找不到）

- Migration drift 处理：SQL UPDATE checksum / cherry-pick 跨 worktree migration / Prisma 三步严格
- NextAuth 多 context race：newContext per student + retry
- AI mood 字段：runner moodKeyFromLabel 中文→英文 mapping，submission schema 限 8-enum
- Worktree 并行节奏：不同表 schema 改 + 时间戳错开
- r1 即收 4 条件：独立证据链 + deterministic acceptance + DB cleanup + Prisma 三步合规
- **行为底线（CLAUDE.md 顶部）**：不走捷径，<100% acceptance 必须先 ask 用户
- Phase 4+ backlog 已全部清空，无遗留 polish

## 历史归档

| 文件 | 内容 |
|---|---|
| `HANDOFF-2026-05-pre-cleanup-archive.md` | 旧 HANDOFF |
| `spec-batch{1,2}-archive.md` / `spec-review-archive.md` | 上一轮 batch |
| `reports/phase3_molly_seed_r1.md` | Phase 3 完整记录 |
| `reports/probe_summary_r1.md` | 5 模块 probe r1 |
| `reports/bug_inventory_*_r1.md` | molly/alex 视角 65 bugs |
| `reports/build_unit{N}_r{M}.md` × 19 | 每 unit builder 报告 |
| `reports/qa_unit{N}_r{M}.md` × 19 | 每 unit QA 报告 |
| `plans/unit{N}_plan_r1.md` × 17 | 每 unit plan |
| `spec.md` + `spec-amendments.md` | 当前 spec |
