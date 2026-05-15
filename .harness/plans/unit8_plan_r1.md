# Unit 8 Plan — 真自适应模式（IRT + 知识点 + 题型难度 + 答对率）

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 8
> Bugs: B-STU-QUIZ-2/4 (probe r1 B1: QuizConfig.mode 字段未运行时消费)

## 调研发现

### A. Schema 现状（关键发现）

- **QuizQuestion 无知识点直接关联**：仅 `difficulty: Int?`、`type: QuizQuestionType` (single_choice / multiple_choice / true_false / short_answer)、`order`、`points`
- `QuizConfig.{mode, maxQuestions, startDifficulty, difficultyStep}` 4 字段都在，但 runtime 仅消费 `mode`（adaptive 仅映射到 "practice" UI 显示，**不真自适应**）
- 学生 `tasks/[id]/page.tsx:138` 把 adaptive → practice，把 fixed → exam
- `QuizSubmission` 有 `conceptTags: String[]` 但来自 AI 提交后提取（rear-view），不能驱动选题
- `QuizQuestion.options` 是 Json，`correctOptionIds: String[]`、`correctAnswer: String?` (short_answer 用)

### B. 现有 quiz-runner.tsx 结构（724 行）

- `practice` 模式：逐题答 → 点"确认" → 显示答案 + 解释 → 下一题（pre-rendered all questions in nav bar）
- `exam` 模式：批量答完后一次性提交
- 关键：所有题在 props.questions 里**预渲染**，无"动态下一题"接口

### C. 用户决策 #1 原文要素

| 要素 | 当前 |
|---|---|
| 按知识点 | ❌ 无 QuizQuestion ↔ knowledge 关联 |
| 题型难度 (判 0.3 / 单 0.5 / 多 0.8 / 简 0.9) | ❌ 只用 `difficulty` (Int?) 不用 type 系数 |
| 答对率自适应 | ❌ 完全没有 |
| ≤8 题诊断 ≥3 知识点 | ❌ 完全没有 |
| 末尾"薄弱知识点报告" | ❌ 完全没有 |
| 规则引擎 + 简化贝叶斯混合 | ❌ 完全没有 |

### D. 现有 conceptTags 数据流

```
quiz 学生提交 → grading.service.ts:407 extractQuizConceptTags(AI)
              → QuizSubmission.conceptTags  ← 这是事后提取的概念
              → weekly-insight aggregate 用此聚合班级弱点
```

## 关键决策（coordinator 5 问 + plan 推荐）

**Q1. Schema 字段：是否加 QuizQuestion.knowledgeTagIds + 加 KnowledgeMastery 表？**
→ 答：**加 `QuizQuestion.knowledgeTagIds: String[] @default([])`**，不加新表。
- knowledgeTagIds 是数组字符串（用 conceptTag 字符串作为知识点标识，跟现有 conceptTag 一致）
- 不加 KnowledgeMastery 表：**masteryReport 存到 QuizSubmission.evaluation.masteryReport (Json 嵌套)**，与 Unit 9 evidence 同款"评估输出嵌套"模式
- 跨 sub 历史聚合用现有 conceptTags 已够（weekly-insight 已实现）

**Q2. 选题引擎：纯规则 vs 规则 + 简化贝叶斯**
→ 答：**纯规则引擎 v1**，按用户原话"如果效果更好可融合"作为 Phase 4 polish。
- 规则引擎已足够覆盖核心需求（题型难度系数 + 能力估计 + 弱点优先）
- 贝叶斯需要先验+似然+后验 计算，调试成本高 + r2 风险
- 单测可锁定规则行为，QA 可验证；贝叶斯黑盒，演示价值低
- **后续可加**：如果 v1 跑通后 demo 反馈"诊断不准"再融合

**Q3. 早停规则：≤8 题 + ≥3 知识点估计就停？**
→ 答：**两个条件 AND 即停**。已答题数 ≥ 3 个知识点（即 distinct knowledgeTagIds 覆盖 ≥ 3）AND 已答题数 ≥ min(maxQuestions, 4) 时停。即至少答 4 题、最多答 maxQuestions（默认 8）；任一知识点能力估计置信度 < 0.4 强制再答 1 题（除非已 8 题）。

**Q4. 薄弱知识点报告位置：测验末尾 + 学生 /grades？**
→ 答：**两处都显示**。测验末尾报告页（quiz-runner 完成后的 result page）+ 学生 /grades 详情面板（仅 quiz 类型显示）。雷达图用 recharts（已依赖）。

**Q5. 题型不匹配兜底**
→ 答：**降级到任意题型 + 用 type 系数权重**。若某弱知识点没"判断题"，引擎从该知识点池子里选 `type 系数 × (1 - |当前能力 - 目标能力|)` 最大的题。

### 题型难度系数（用户原话）

```ts
const TYPE_COEFFICIENT: Record<QuizQuestionType, number> = {
  true_false: 0.3,
  single_choice: 0.5,
  multiple_choice: 0.8,
  short_answer: 0.9,
};
```

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `prisma/schema.prisma` | 改 | QuizQuestion 加 `knowledgeTagIds: String[] @default([])` + `@@index([taskId, knowledgeTagIds])` |
| `prisma/migrations/...` | 新 | migrate dev 自动产 |
| `lib/services/quiz-adaptive.service.ts` (新) | 新 | 引擎：能力估计 / 选题 / 早停判断 / 薄弱报告生成 |
| `app/api/lms/tasks/[id]/adaptive-quiz/next/route.ts` (新) | 新 | POST: { history } → { nextQuestion \| done, masteryReport? } |
| `lib/services/quiz-question-tagger.service.ts` (新) | 新 | offline AI 一次性给 QuizQuestion 打 knowledgeTagIds（被 cron 或手动触发） |
| `app/api/lms/tasks/[id]/tag-questions/route.ts` (新) | 新 | POST: teacher 触发本任务的 question 知识点 tagging |
| `components/quiz/quiz-runner.tsx` | 改 | adaptive 模式分支：不预渲染所有题；调 /next 拉下一题；终态时调用末尾报告 |
| `components/quiz/quiz-mastery-report.tsx` (新) | 新 | 雷达图 + 弱点列表（recharts RadarChart） |
| `app/(student)/tasks/[id]/page.tsx` | 改 | adaptive 模式不传完整 questions；只传 quizConfig + taskId |
| `components/grades/evaluation-panel.tsx` | 改 | quiz 类型显示 masteryReport（如有） |
| `lib/services/grading.service.ts` | 改 | gradeQuiz 把 adaptive 模式提交的 masteryReport 透传到 evaluation Json |
| `tests/quiz-adaptive-engine.test.ts` (新) | 新 | 引擎单测：3 知识点 × 8 题路径出 ≥3 诊断 + 类型权重 + 早停 |
| `tests/e2e/unit8-verify.spec.ts` (新) | 新 | 6-8 case |

## 关键改动思路

### 1. Schema 改动（最小）

```prisma
model QuizQuestion {
  // ... existing
  knowledgeTagIds  String[] @default([])  // ← 新
  // existing @@index 保留
  @@index([taskId, knowledgeTagIds])  // ← 新
}
```

无新表。masteryReport 存 QuizSubmission.evaluation Json 嵌套。

### 2. 引擎核心算法（纯规则）

```ts
// 能力估计：每知识点初始 0.5（startDifficulty/10 = 0.5 if 5），答对 +diff*step，答错 -diff*step
// diff = (题型系数 * 题目 difficulty / 10) 归一化到 [0,1]
// step = config.difficultyStep / 10

// 选题流程：
function selectNextQuestion(state: AdaptiveState, available: QuizQuestion[]): QuizQuestion | null {
  // 1. 已答过的题排除
  const candidates = available.filter(q => !state.answeredIds.has(q.id));
  if (candidates.length === 0) return null;

  // 2. 找最弱知识点（已估算过的中能力最低）+ 仍未覆盖的知识点优先
  const uncoveredKp = findUncoveredKnowledgePoints(state, candidates);
  if (uncoveredKp.length > 0) {
    // 从未覆盖的知识点里选最匹配 startDifficulty 的题
    return pickClosestDifficulty(candidates, uncoveredKp, state.targetDifficulty);
  }

  // 3. 全覆盖后，按能力区间 ±1 step × 题型系数加权选题
  const weakestKp = findWeakestKnowledgePoint(state);
  return pickByAbility(candidates, weakestKp, state.abilities[weakestKp], config.difficultyStep);
}

// 早停：已答 ≥ 4 题 AND 已覆盖 ≥ 3 知识点 AND 所有知识点置信度 ≥ 0.4
// 或：已答 = maxQuestions（强制停）
function shouldStop(state, config): boolean {
  if (state.answeredIds.size >= config.maxQuestions) return true;
  if (state.answeredIds.size >= 4 && Object.keys(state.abilities).length >= 3) {
    const allConfident = Object.values(state.confidences).every(c => c >= 0.4);
    if (allConfident) return true;
  }
  return false;
}
```

### 3. /next API 流程

```
学生答完一题 → POST /api/lms/tasks/[id]/adaptive-quiz/next
  body: { taskInstanceId, history: [{questionId, answer, correct, timeMs}] }
  → service.processAnswer + service.shouldStop
  → 若停：返回 { done: true, masteryReport }
  → 否则：返回 { done: false, nextQuestion: {...} }
```

服务端无状态，每次请求带完整 history（避免 server-side session）。

### 4. quiz-runner.tsx adaptive 分支

```tsx
// adaptive 模式
const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
const [history, setHistory] = useState<Answer[]>([]);
const [done, setDone] = useState(false);
const [masteryReport, setMasteryReport] = useState<MasteryReport | null>(null);

// 答完一题 → 调 /next 拿下一题或终态
async function submitAnswer(answer) {
  const newHistory = [...history, { questionId: currentQuestion.id, ...answer }];
  setHistory(newHistory);
  const res = await fetch(`/api/lms/tasks/${taskId}/adaptive-quiz/next`, { ... });
  const data = await res.json();
  if (data.done) {
    setDone(true);
    setMasteryReport(data.masteryReport);
  } else {
    setCurrentQuestion(data.nextQuestion);
  }
}

// 完成时显示 <QuizMasteryReport report={masteryReport} />
```

### 5. masteryReport 结构

```ts
interface MasteryReport {
  totalQuestions: number;
  correctCount: number;
  knowledgePoints: Array<{
    tag: string;           // "复利" 等
    ability: number;       // 0-1，0=完全没掌握，1=完全掌握
    confidence: number;    // 0-1，估计置信度（与答题数相关）
    questionsAnswered: number;
    classification: "薄弱" | "一般" | "掌握";  // 由 ability 阈值决定
  }>;
  weakestTopics: string[];   // 排序后前 3 个 ability < 0.4 的 tag
  recommendation: string;    // 简短建议文案
}
```

### 6. 题打标 (quiz-question-tagger)

教师创建/编辑测验后调一次 AI 给所有 QuizQuestion 打 knowledgeTagIds。
- prompt：给 prompt + options + correctAnswer，AI 返回 1-3 个 conceptTag
- 触发：POST /api/lms/tasks/[id]/tag-questions（教师手动）+ 测验首次进 adaptive 模式时检查 knowledgeTagIds 为空则触发 tagging
- 已有 conceptTag 的 question 不重新打

## 风险点

1. **🔴 Schema migration 必走 Prisma 三步**：QuizQuestion 加字段；dev DB 已经有 5+ migrations，需 `prisma migrate dev --name add_quizquestion_knowledge_tags` + generate + 重启 dev server。**与 worktree 协调：已关闭并行，主目录单线作战 ✓**
2. **🔴 引擎复杂度**：能力估计 + 选题 + 早停 + 题型权重 + 兜底降级 — 单测必须覆盖核心 happy path + 边界。
3. **🟡 现有 QuizQuestion 没 knowledgeTagIds**：要么 manual tag 旧数据，要么 lazy tagging（首次 adaptive 测验时调 AI 打）。建议 lazy + teacher 主动 trigger（避免学生开测时卡顿 30s）。
4. **🟡 quiz-runner.tsx 改动量大**：adaptive 不预渲染全题 → 改动 nav bar 渲染 + 完成态 + masteryReport 集成。可能 r2 兜底。
5. **🟡 已发布 instance 兼容性**：旧的 adaptive 测验 + 旧 questions (无 knowledgeTagIds) → fallback 到 fixed 模式（answer all）+ 提示 "需先打知识点标签"。或允许 lazy tag。
6. **🟢 学生 grades 显示 masteryReport**：evaluation-panel 已有结构，加 quiz 分支即可。
7. **🟢 雷达图**：recharts RadarChart 已有依赖；3-6 个知识点 polygon 适合。
8. **🟡 现有 quiz fixed/practice mode 不能动**：所有改动只针对 `mode === "adaptive"` 分支。fixed 完全沿用现状。

## 自测计划

### 单测覆盖（核心）
1. `selectNextQuestion`: 未覆盖 KP 优先 + 全覆盖后能力区间内选 + 排除已答
2. `shouldStop`: 4 题 + 3 KP + 全 confident → true / 8 题强制停 / 否则继续
3. `updateAbility`: 答对 +diff*step / 答错 -diff*step / 系数生效
4. **关键场景**：3 KP × 8 题路径出 ≥3 KP 诊断（spec 字面要求）
5. 题型不匹配兜底：弱 KP 无判断题 → 降级到其他题型 + 权重对

### E2E
- A: adaptive 模式测验真按引擎出题（不是预渲染全部）
- B: 完成后显示薄弱知识点报告（雷达图 + 推荐文案）
- C: 学生 /grades 详情显示 masteryReport
- D: fixed 模式不动 (回归测试)
- E: 旧 question 无 knowledgeTagIds → fallback to fixed + 提示文案 OR 触发 lazy tag
- F: API /next 调用流程

## 不在本 unit 范围

- ❌ 简化贝叶斯（Phase 4 polish if needed）
- ❌ KnowledgeMastery 跨 sub 历史聚合（用 conceptTags 已聚合够；本 unit 单次诊断）
- ❌ 教师 dashboard 显示班级薄弱（weekly-insight 已聚合 conceptTags）
- ❌ 已发布老 instance 的 adaptive 转换数据迁移
- ❌ Quiz 题库 / 题目复用机制

## diff 预算

预计 1200-1500 行（最复杂 unit）：
- schema + migration ~10
- quiz-adaptive.service.ts ~250（引擎 + masteryReport）
- quiz-question-tagger.service.ts ~80（AI tagging）
- 2 新 API routes ~80
- quiz-runner.tsx 改动 ~150（adaptive 分支）
- quiz-mastery-report.tsx ~120（雷达图）
- evaluation-panel.tsx ~40（quiz 分支）
- grading.service.ts ~10
- (student) tasks/[id]/page.tsx ~20
- tests unit ~250 + e2e ~250

**复杂度评估**：r2 兜底高（引擎边界 + 题打标 corner case + UI 大改）。建议拆 commit 5 个：
1. schema + 类型 + 引擎 service + 单测
2. tagging service + 2 API routes
3. runner UI adaptive 分支
4. masteryReport 雷达图 + evaluation-panel
5. e2e

## 待 coordinator 确认

1. **Schema 选择 QuizQuestion.knowledgeTagIds: String[]**（Q1 决策，最小侵入；与 conceptTag 字符串对齐）
2. **纯规则引擎 v1**（Q2 决策，贝叶斯放 Phase 4）
3. **早停 = 4 题 AND 3 KP AND 全 confidence ≥ 0.4 OR 答完 maxQuestions**（Q3 决策）
4. **masteryReport 两处显示**（Q4 决策：测验末尾 + 学生 grades）
5. **题型不匹配 → 权重降级**（Q5 决策）
6. **lazy tagging**：旧 question 首次 adaptive 测验时调 AI 打标 vs 教师手动触发？倾向"教师手动触发 + 学生进测时若空则提示 '老师还未配置知识点诊断，本次走 fixed 模式'"，避免学生等 AI tagging。
7. **commit 拆分 5 步**：是否同意？或合并为 2-3 commit？

预计 r2 兜底高概率（引擎 + UI + 题打标 三大块）。
