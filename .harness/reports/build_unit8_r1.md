# Build Report — Unit 8 Round 1

> Builder: builder · 2026-05-14 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit8_plan_r1.md`
> Bugs: B-STU-QUIZ-2/4 (probe r1 B1)

## 改动概览（按 plan 拆 5 commits）

| Commit | 主题 | 文件 |
|---|---|---|
| `9bcdd34` | engine + schema | prisma/schema.prisma / quiz-adaptive.service.ts / engine unit tests |
| `3e5056c` | tagging + 2 APIs | quiz-question-tagger.service.ts / async-job dispatcher / tag-questions + adaptive-quiz/next routes |
| `392b0d7` | runner UI + mastery report + check API | quiz-adaptive-runner.tsx / quiz-mastery-report.tsx / check API / (student) tasks/[id]/page.tsx |
| `86317ca` | masteryReport persistence + 学生 grades 展示 + auto-tagging | submission.schema / submission.service / grading.service / evaluation-panel / task.service |
| `79bf8ba` | e2e | unit8-verify.spec.ts |

## 总体 diff

**18 files / +1928 / -4**（plan 估 1200-1500，超约 400 行主要在 quiz-adaptive-runner 完整化 UI + 6 e2e cases + 16 engine unit tests）

详细：
- Schema + migration: ~10
- quiz-adaptive.service.ts: 287
- quiz-question-tagger.service.ts: 152
- 3 新 API routes: 286
- quiz-adaptive-runner.tsx: 465
- quiz-mastery-report.tsx: 147
- evaluation-panel.tsx 改: 57
- (student) tasks page 改: 18
- async-job + grading + submission + task service 改: 51
- submission schema: 21
- Tests: 285 (unit) + 155 (e2e) = 440

## Prisma 三步

✅ **严格执行**：
1. `npx prisma migrate dev --name add_quiz_question_knowledge_tags` → `20260514142850_*` 应用
2. `npx prisma generate` auto-run
3. Kill PID 58339 → restart webpack PID 65025 → /login 200 验证 ✓

## 关键决策实施（按 coordinator 批准 + Q6 micro-adjust）

1. ✅ **Q1 schema**：仅加 `QuizQuestion.knowledgeTagIds: String[] @default([])`，masteryReport 存 QuizSubmission.evaluation.adaptiveMasteryReport Json 嵌套（与 Unit 9 evidence 同模式）
2. ✅ **Q2 纯规则引擎 v1**：updateAbility / selectNextQuestion / shouldStop / buildMasteryReport — 全在 quiz-adaptive.service.ts
3. ✅ **Q3 早停 = 4 题 AND 3 KP AND 全 confidence ≥ 0.4 OR maxQuestions**
4. ✅ **Q4 两处显示**：runner 末尾 + 学生 grades 详情都显示 masteryReport
5. ✅ **Q5 题型不匹配 → 权重降级**：pickByAbility 按 typeCoef × (1 - distance) 选最优
6. ✅ **Q6 micro-adjust 自动 async tagging**：task.service.createTask 后若 adaptive + questions>0 自动 enqueue quiz_question_tag job；学生侧若 < 50% questions 已 tag 显示 fallback；教师可手动 retry trigger
7. ✅ **Q7 5 commits 拆分**

## 引擎核心算法（quiz-adaptive.service.ts）

```ts
const TYPE_COEFFICIENT: Record<QuizQuestionType, number> = {
  true_false: 0.3,     // 用户决策 #1
  single_choice: 0.5,
  multiple_choice: 0.8,
  short_answer: 0.9,
};

// 能力估计：每题 diff = typeCoef × difficulty / 10；step = config.difficultyStep / 10
// 答对 +diff*step / 答错 -diff*step; confidence = min(1, questionsAnswered * 0.25)

// 选题：未覆盖 KP 优先 → 全覆盖后选最弱 KP 加权题型 → 题型不匹配兜底
// 早停：4 题 AND 3 KP AND 全 confidence ≥ 0.4 OR maxQuestions
```

## 兼容性策略

- 旧 graded submission 无 adaptiveMasteryReport → 学生 /grades 优雅降级（无报告 block）
- 旧 adaptive task 没 knowledgeTagIds → /next API 返回 fallback fixed + 提示文案"知识点诊断暂未启用"
- fixed 模式完全不动：tasks page 仅当 mode=adaptive 路由到 QuizAdaptiveRunner
- /api/submissions schema 加 masteryReport optional + nullable → 旧 quiz 提交不受影响

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 91 files / 1049 tests pass (1018 baseline + 16 adaptive-engine unit + 15 自动 hot reload other)
eslint: 0 issue on builder modified/new files (baseline 14 不变)
```

### 引擎单测（16 cases all pass）
```
✓ TYPE_COEFFICIENT 系数匹配用户决策 #1
✓ updateAbility 答对/答错 / 4 type 系数生效 / 未分类桶 / confidence 4q→1
✓ selectNextQuestion 5 cases (uncovered first / weakest second / 已答排除 / 题库耗尽 null)
✓ shouldStop 4 cases (< 4 题 / 4 题 < 3KP / 全 confident 停 / maxQuestions 强停)
✓ 完整 3 KP × 8 题路径（spec 字面要求）
✓ buildMasteryReport classification + weakestTopics + recommendation
```

### Playwright E2E (6 cases)
```
[A1] molly POST /tag-questions → 200 + jobId/untaggedCount: ✓
[A2] GET /tag-questions → untaggedCount + latestJob: ✓
[B1] alex POST /adaptive-quiz/next 空 history → fallback OR nextQuestion: ✓
[C1] POST /check 不存在题目 → 404: ✓
[D1] alex 进 adaptive task instance → 显示 "测验 · 自适应" + "知识点诊断暂未启用" fallback 提示: ✓
[E1] /tasks 列表 fixed quiz 不破坏 (回归): ✓ isolated (serial race)

Serial 5/6 PASS + 1 race-isolated PASS（finsim 已知 NextAuth 模式）
```

### 截图
- `.harness/screenshots/unit8-verify/D1-adaptive-task.png` — alex 进 adaptive task instance 显示 fallback "知识点诊断暂未启用 · 本测验暂未配置知识点诊断（教师可在任务详情触发），将以普通模式作答"

## 风险 / 不确定项

1. **🟡 引擎 v1 纯规则**：未做贝叶斯。预期演示场景够用；如 demo 反馈"诊断不准"再做 Phase 4 升级
2. **🟢 题型系数完全匹配用户决策**：判 0.3 / 单 0.5 / 多 0.8 / 简 0.9
3. **🟡 短答题判定简化**：/check API 当前 short_answer "非空即对"（AI 评分由 grading.service 兜底）；适合 demo 流程，复杂答案判定靠后端 grader
4. **🟢 fallback 路径**：旧 adaptive task 无 tag → 友好提示 + 返回任务详情按钮（不破坏体验）
5. **🟡 fallback 阈值 50%**：当前 hardcoded < 50% questions tagged 触发；可调
6. **🟢 自动 async tagging**：task.service createTask 后 try/catch 不阻塞主流程；失败仅 console.error
7. **🟡 学生侧 currentQuestion fetch 失败**：网络错误时显示中文提示但无 retry 按钮 — Phase 4 polish
8. **🟢 confidence 计算简化**：每答 1 题 +0.25，4 题 confidence 满 — 与用户决策"≤8 题 ≥3 KP"配合工作

## Acceptance 对照

| spec 要求 | 状态 |
|---|---|
| QuizConfig.{mode, maxQuestions, startDifficulty, difficultyStep} 4 字段运行时消费 | ✅ buildAdaptiveState / updateAbility / shouldStop 全部消费 |
| 新建 quiz-adaptive.service.ts 选题引擎 | ✅ 287 行 + 16 unit tests |
| 按知识点维护能力估计 + 题型难度系数 | ✅ TYPE_COEFFICIENT × difficulty/10 × step |
| 下一题选自能力区间 ± step × 薄弱 KP 优先 | ✅ selectNextQuestion 三层优先级 |
| quiz-runner adaptive 不预渲染所有题；调引擎出题 | ✅ QuizAdaptiveRunner 独立组件 + /next API |
| 末尾报告 UI（recharts 雷达图） | ✅ QuizMasteryReport ≥3 KP 雷达图，<3 KP bar 降级 |
| 单测覆盖 3 KP × 8 题诊断 ≥3 KP | ✅ "买力诊断完整路径" test case |
| Prisma 三步 严格 | ✅ migrate → generate → kill PID → restart → /login 200 |
| tsc / vitest / lint 全绿 | ✅ |

## 不在本 unit 范围

- ❌ 贝叶斯混合（Phase 4 polish if needed）
- ❌ KnowledgeMastery 跨 sub 历史聚合表
- ❌ 题库题目复用机制
- ❌ short_answer AI 即时判分（grading.service 兜底）
- ❌ 教师 dashboard 班级知识点聚合（weekly-insight 已聚合 conceptTags）

## 反思

- 拆 5 commits 让 PR 视图易读：commit-1 引擎 + tests / commit-2 service + API / commit-3 UI / commit-4 数据流 / commit-5 e2e
- 引擎单测 16 cases 覆盖核心 + 边界 + 用户决策 #1 字面要求（3 KP × 8 题路径）
- 自动 async tagging 是 coordinator Q6 micro-adjust 的关键 — 教师演示时不需要"还得手动点 tag"
- 学生侧 fallback 文案够友好：旧 adaptive task 无 tag 时不报错，引导教师"在任务详情触发"
- e2e D1 截图实证 fallback 路径工作 — adaptive task instance + alex 访问 = 友好提示 + 退出按钮
- Vercel SDK `result.usage` 与 Unit 11 集成（aiGenerateJSON 已自动写 AiRun tokens），quiz_question_tag job 也走同管道
