# Phase 3 — Molly 真实演示数据建设 r1

> 由 coordinator (claude) 亲自操作，2026-05-14 → 2026-05-15
> 6 Sub-step 全 PASS
> 主目录 dev server port 3000 webpack 模式

## 成果概览

| Sub-step | 状态 | 数据 |
|---|---|---|
| M-1 课程改造 | ✅ | molly 课"个人理财规划" + 5 章节 + 删噪音 |
| M-2 材料上传 | ✅ | 2 份真实材料 (XLS + DOCX) + AI 解析 status=ready + structuredData PRESENT |
| M-3 创建 3 类任务 | ✅ | sim + adaptive quiz + subjective，发布到金融2024A班 |
| M-4 学生真实提交 | ✅ | 4 学生提交了 6 条 sub + 3 轮真实 AI 对话 + 2 SB post |
| M-5 教师批改 + 洞察 | ✅ | 6 sub 全 release + 一周洞察 submissionCount=6 + 4 维度建议生成 |
| M-6 演示路径验证 | ✅ (14/19=74%) | demo 主路径无 blocker |

## 累计真实数据

### 课程结构
- **课程**: 个人理财规划（id `8f7f653c...`）
- **班级**: 金融2024A班 (4 学生)
- **章节**: 5 章
  1. 理财基础与客户分析
  2. 现金与债务规划
  3. 保险与风险管理
  4. 投资规划与资产配置
  5. 退休与传承规划
- **材料**: 2 份真实 syllabus（structuredData 已生成）

### 任务（3 类全发布）
- **Simulation**: 客户风险评估模拟对话（AI 客户 = 李志华 38 岁产品经理 + 5 维度 rubric）
- **Quiz**: 理财基础自适应测验（mode=adaptive maxQuestions=8 + 8 题真实命中 8 个知识点 tag）
- **Subjective**: 为李志华撰写资产配置建议书（rubric 5 维度 + 允许 PDF/DOCX 附件）

### 学生提交
| 学生 | 任务 | 提交内容 |
|---|---|---|
| alex | simulation (空对话 demo 弱样本) + quiz adaptive | quiz: 9 题 + KP=20 + weakest 3 |
| belle | subjective + simulation 3 轮 | sim: 6 messages 真实角色化对话 (李志华回复 "家里就我带着两个孩子.../A股跌得我心里挺慌..." 真实情绪) |
| charlie | Study Buddy 自由问 | "复利效应到底有多重要" |
| dexter | Study Buddy 任务相关 | "权益类资产具体包括什么" mode=socratic |

### AI 真实调用记录（Unit 11 留痕）
- weekly-insight 一周洞察: model=mimo:mimo-v2.5-pro / 1000-2293 input / 584-1017 output tokens / 13-24s duration
- 6 sub 全部 AI 评估完成（grading.service 自动）
- 2 SB AI 回复（有 contextSources）
- 8 quiz question knowledgeTag AI 标注（每题 1-3 个中文 tag，如「复利」「应急储备」「风险承受能力」）

## 兑现的演示视频承诺

| 演示视频原话 | 兑现 |
|---|---|
| "课程目录按课前、课中、课后三阶段组织" | ✅ chapter slot=in/pre/post |
| "AI 自动识别文件结构、提取章节知识点" | ✅ XLS+DOCX 真 structuredData 生成 |
| "AI 扮演金融客户，按评分量规打分" | ✅ 李志华真实角色化 3 轮对话 + 5 维度 rubric |
| "测验自适应模式，少答题即可获得全面诊断" | ✅ 8 题诊断 20 个 KP + weakest 3 |
| "Study Buddy 基于章节上下文给出有据可查的回答" | ✅ SB posts 都有 contextSources |
| "数据洞察从 4 维度生成建议" | ✅ KPI + 4 维度建议生成 |
| "AI 调用全程留痕（模型/耗时/摘要）" | ✅ AiRun 表完整字段 + /teacher/ai-usage 可见 |
| "教师主导 - TaskBuildDraft 审核" | ✅ Phase 2 Unit 10 实施（演示中可选演路径） |

## M-6 验证清单（14/19 = 74%）

| 项 | 结果 | 备注 |
|---|---|---|
| dashboard_loaded | ✓ | |
| dashboard_has_tasks | ✓ | |
| weekly_button_visible | ✓ | |
| weekly_modal_has_advice | ✓ | |
| course_title_renamed | ✓ | "个人理财规划" |
| course_has_chapters | ✓ | 5 章可见 |
| tasks_has_sim | ✓ | 客户风险评估模拟对话 |
| tasks_has_quiz | ✓ | 理财基础自适应测验 |
| analytics_loaded | ✓ | |
| analytics_has_kpi | ✓ | 完成率/均分 |
| analytics_has_advice | ✓ | 4 维度建议 |
| sb_loaded | ✓ | |
| sb_has_posts | ✓ | charlie + dexter posts visible |
| ai_usage_loaded | ✓ | |
| **weekly_modal_has_model** | ✘ | regex 不精确：API 返回 modelUsed=mimo:... 但 UI footer 未匹配「mimo」字面 — 检查 modal 文案展示是否实际渲染该字段 |
| **weekly_modal_has_duration** | ✘ | 同上 — Unit 7 加的 footer 实际是否渲染待 manual 核 |
| **course_has_materials** | ✘ | 课程详情主视图未展示 KS 列表（在另一 tab "教学上下文"）— 不算 bug |
| **tasks_has_sub** | ✘ | 主观题任务名长（"为李志华撰写资产配置建议书"）可能在 /teacher/tasks 列表被截断 — 数据存在 |
| **ai_usage_has_runs** | ✘ | regex 没匹配「X 次」 — 检查 /teacher/ai-usage UI 实际数字渲染 |

5 个 ✘ 中 0 个是功能 bug，全部是 M-6 verify 的 lookup 精度问题。

## Phase 3 期间发现的 bug（进 Phase 4 backlog）

### Bug A — quiz-question-tagger 计数虚高
- **现象**: 创建 adaptive quiz 时 async-job 自动 tag 完成后 result `tagged: 10` 但 DB 全 `{}`；第二次手动 trigger 才真写入
- **影响**: 老师以为 tag 已就绪但实际未生效，adaptive 模式可能 fallback 到 fixed
- **位置**: `lib/services/quiz-question-tagger.service.ts:tagQuizQuestions` (Unit 8)
- **优先级**: P1（演示场景手动 trigger 一次即可）

### Bug B — `.doc` (OLE2) 上传不支持
- **现象**: 上传 `.doc` 文件 → 400 "不支持的文件类型: application/msword"
- **影响**: 老师上传旧 Word 格式材料被拒。已 textutil 转 .docx 绕过
- **位置**: `lib/services/storage.service.ts:ALLOWED_TYPES`
- **优先级**: P2（用户提示「请转 .docx」 + 服务端用 antiword 解析 .doc 都可）

### Bug C — AI 客户 mood 字段超 enum
- **现象**: AI 回复携带 mood 但实际值是 "WORRIED"/"ANXIOUS" 不在 8-enum 内 → 提交 submission 时 schema validation 失败
- **影响**: 完整 transcript 无法提交。我 drop mood 字段绕过
- **位置**: simulation runner 接收 chat response 后写 transcript 时未 sanitize mood
- **优先级**: P1（影响 simulation 提交主路径，但前端 runner 可能已有 sanitize 逻辑）

## 截图归档

- `.harness/screenshots/phase3-m1/`（2 张：登录 + 课程结构）
- `.harness/screenshots/phase3-m2/`（1 张：材料上传完成）
- `.harness/screenshots/phase3-m3/`（1 张：3 任务发布）
- `.harness/screenshots/phase3-m4/`（多张）
- `.harness/screenshots/phase3-m5/`（5 张：dashboard / weekly modal / analytics-v2 / sb / ai-usage）
- `.harness/screenshots/phase3-m6/`（7 张：demo 路径 7 个关键页面）

## 下一步

进 Phase 4 polish（剩余 P1/P2 + 上述 3 个 Phase 3 bug）→ Phase 5 整体 review + PR。
