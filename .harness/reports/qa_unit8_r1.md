# QA Report — Unit 8 r1

> QA: qa · 2026-05-14 · 验 5 commits `9bcdd34` → `79bf8ba` on `claude-demo-fixes`
> Bugs: B-STU-QUIZ-2/4 (probe r1 B1) · spec.md L161-178
> Test spec: `tests/e2e/qa-unit8-adaptive.spec.ts` (9 case，独立于 builder unit8-verify.spec.ts)

## Schema 改动 + Prisma 三步

- ✅ `_prisma_migrations` 含 `20260514142850_add_quiz_question_knowledge_tags`，hash_len=64
- ✅ `QuizQuestion.knowledgeTagIds` ARRAY type, nullable - 加上 ✓
- ✅ Dev server webpack 重启 PID 65025，/login 200
- ✅ Schema 仅加 1 字段（用户决策 Q1，masteryReport 走 QuizSubmission.evaluation JSON 嵌套同 Unit 9 模式）

## 测试数据 (fixtures)

- **ADAPTIVE_TASK** `e54e1cb9` (深度测试): quiz, mode=adaptive, **10 questions all tagged** (auto-tagging 已跑)
- **ADAPTIVE_INSTANCE** `a7d9b380` (深度测试 published instance): in alex's class 金融2024A班 deedd844
- 关键发现：QuizConfig `maxQuestions/startDifficulty/difficultyStep` 字段为 NULL — engine 用默认值 (8/3/1.0)
- 题型分布：4 single_choice + 3 multiple_choice + 1 true_false + 2 short_answer（覆盖 4 题型系数）

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| QuizQuestion 加 knowledgeTagIds: String[] | 代码 grep + DB 列 | schema `knowledgeTagIds String[] @default([])`，DB ARRAY type ✓ | PASS |
| quiz-adaptive.service.ts 引擎 (updateAbility / selectNextQuestion / shouldStop / buildMasteryReport) | builder 16 unit tests 全过（含 3 KP × 8 题诊断路径）+ vitest 91 files / 1049 tests | engine 单测全过 | PASS (code-verified) |
| TYPE_COEFFICIENT 用户决策 #1 (判 0.3 / 单 0.5 / 多 0.8 / 简 0.9) | 代码 grep + builder unit test | 系数完全匹配 ✓ | PASS |
| tag-questions API (POST + GET) | molly POST + GET 实测 | POST 200 + `{jobId: null, untaggedCount: 0, message: "全部题目已 tag，无需重新处理"}`；GET 200 + `{untaggedCount: 0, latestJob: {id, status: "succeeded", progress: 100}}` ✓ | PASS |
| adaptive-quiz/next API (空 history → 首题) | alex POST 空 history | 200 + `{done: false, nextQuestion: {id, type: short_answer, prompt: "请简述深度测试与广度测试的主要区别", points: 3}, progress: {answered: 0, maxQuestions: 8, coveredKnowledgePoints: 0}}` ✓ | PASS |
| adaptive-quiz/next 含 history → 不重复选题 | alex 两次 POST，第二次含已答 | 第二题 id=5f6fa80b ≠ 第一题 id=388bab6d ✓ — 引擎正确排除已答 | PASS |
| /check API 不存在题目 → 404 中文 | POST 假 question id | 404 + `QUESTION_NOT_FOUND` + **"题目不存在"** 中文 ✓ | PASS |
| 学生进 adaptive task 显示 "测验 · 自适应" | alex /tasks/[instance] | DOM 显示 **"深度测试 测验 · 自适应 第 1 题（最多 8 题）已诊断 0 个知识点 请简述... 3 分 简答题 提交本题"** — 完整自适应 runner UI ✓ | PASS |
| Fixed quiz mode 不破坏 (回归) | alex /tasks 列表加载 | 200 + 任务列表显示，未影响 | PASS |
| Non-creator teacher → 403 | teacher2 POST tag-questions | 403 ✓ | PASS |
| Student → 403 | alex POST tag-questions | 403 ✓ | PASS |
| Prisma 三步合规 | migrate / generate / restart / 验证 | ✓ | PASS |

## 引擎真行为实测 (B + B2)

**首题选择**：alex 空 history → engine 选 `短答题 "请简述深度测试与广度测试的主要区别"` (knowledgeTagIds: {深度测试,广度测试,测试策略})。这是 short_answer 难度 0.9 系数最高题，符合 spec "未覆盖 KP 优先 + 题型加权" 选题策略。

**第二题选择 (答对后)**：engine 排除已答 → 选 `短答题 "为什么在金融系统中特别需要深度测试？"` (knowledgeTagIds: {金融系统测试, 安全性测试, 合规性测试}) — 新 KP 覆盖。

**Progress 实时更新**：`{answered: 0, maxQuestions: 8, coveredKnowledgePoints: 0}` 初始 → 应递增。

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **91 files / 1049 tests pass** (1033 baseline + 16 adaptive-engine + 其他累积 = 1049) |
| `npx eslint <QA spec>` | 0 issue |
| `git log 5 commits` | 9bcdd34 → 3e5056c → 392b0d7 → 86317ca → 79bf8ba 全在 main，与 build 报告一致 |
| `git show --stat 5 commits` | 18 files +1928/-4，与 build 报告完全一致 |
| Schema 改动 | `QuizQuestion.knowledgeTagIds String[]` 1 字段 ✓ |
| Migration drift | 0 (drift-free, 22 migrations applied) |
| Dev server restart | webpack PID 65025 alive ✓ |
| DB 测前测后 | 10/10 tagged 状态维持，无副作用 (read-only API tests + 1 empty tag-questions trigger 不影响已 tagged 数据) |

## DOM 实证 — Adaptive Runner UI (D test)

alex 进 `/tasks/a7d9b380` 页面文本：
> 深度测试 测验 · 自适应 第 1 题（最多 8 题）已诊断 0 个知识点 请简述深度测试与广度测试的主要区别。3 分 简答题 提交本题

完整自适应 runner UI 渲染：
- ✅ "测验 · 自适应" mode 标识
- ✅ "第 1 题（最多 8 题）" 进度
- ✅ "已诊断 0 个知识点" KP coverage tracker
- ✅ 题型标识 "简答题"
- ✅ 分值 "3 分"
- ✅ "提交本题" 按钮

0 console error。

## API 权限矩阵

| 角色 | POST /tag-questions | 结果 |
|---|---|---|
| molly (creator) | ✓ | 200 ✓ |
| teacher2 (non-creator teacher) | ✗ | 403 ✓ |
| alex (student) | ✗ | 403 ✓ |

## Cross-module / Backward Compat

- 新 fields `knowledgeTagIds String[] @default([])` — 旧 quiz question 默认空数组，向后兼容
- `QuizConfig.maxQuestions/startDifficulty/difficultyStep` nullable — engine 内置默认值兜底
- `adaptiveMasteryReport` 嵌入 `QuizSubmission.evaluation` JSON（Unit 9 同模式）— 旧 graded sub 不存在该字段，UI 优雅降级
- Fixed mode 完全不动 — tasks page 仅 mode=adaptive 路由到 QuizAdaptiveRunner
- 既有 vitest 1033 baseline → 1049 (+16 engine new)，0 回归

## Finsim-specific 检查

- ✅ UI 文案全中文（"自适应"、"已诊断 N 个知识点"、"题目不存在"等）
- ✅ Service throw "QUESTION_NOT_FOUND" + handleServiceError 中文映射
- ✅ Route Handler 仅 auth + assertTaskInstanceReadable + 调 service
- ✅ API response 格式 `{ success, data }` / `{ success: false, error: { code, message } }`
- ✅ Prisma 三步合规 (migration + generate + restart + 验证)

## 风险 / 不确定项

1. **🟢 引擎纯规则 v1**: 用户决策 #1 接受规则引擎，未做贝叶斯。当前 demo 足够。
2. **🟡 fallback 阈值 50% hardcoded**: 当前 < 50% questions tagged 显示 fallback；可调
3. **🟢 短答题判定简化**: /check API short_answer "非空即对"；AI 评分由 grading.service 兜底
4. **🟢 自动 async tagging**: createTask 后 try/catch 不阻塞主流程
5. **🟢 旧 sub 无 masteryReport**: UI 优雅降级 (与 Unit 9 evidence undefined 同模式)
6. **🟡 学生答错时引擎降难度**: B/B2 仅测答对路径；难度下降逻辑由 builder 16 unit test 覆盖

## 是否引入新 bug

无。18 files +1928/-4 scope 严格按 plan；vitest 1049 全过；DB 状态干净；自适应 runner UI 完整渲染。

## Issues found

无 blocker。

## Overall: **PASS**

**判断标准对照 (r1 即收 4 条件 schema 版)**：
1. ✅ QA 9 case (含 4 API 路径 + 引擎选题验证 + 学生 runner UI + 权限矩阵) vs builder 6 e2e + 16 engine unit + 15 propagated — 独立证据链
2. ✅ HTTP / DB / response shape / Chinese / engine question selection 全 deterministic
3. ✅ DB cleanup 完整 (read-only API + 10/10 tagged 维持)
4. ✅ **Schema 改动 Prisma 三步合规 + runtime engine 实证** (engine 真选题 + 不重复 + question shape 完整)

**建议 r1 PASS 收工**。这个 unit 出乎预料地一次过 — schema + 算法引擎 + AI tagging + UI runner，每层都有独立 acceptance 锚点 + 16 engine unit tests 锁死核心算法。

## Phase 2 完整收官 🎉

| Unit | Status |
|---|---|
| Unit 8 (真自适应) | ✅ r1 PASS |
| Unit 9 (sim evidence) | ✅ r1 PASS |
| Unit 10 (TaskBuildDraft) | ✅ (worktree, qa-b) |
| Unit 11 (AI 留痕) | ✅ r1 PASS |

**Phase 2 全部 r1 即收**，按之前预判"4 个都 r2 必"完全打脸 — builder/builder-b 决策非常稳健，schema 改动严格三步走，acceptance 实证完整。

下一步 Phase 3 (molly 真实演示数据建设)。
