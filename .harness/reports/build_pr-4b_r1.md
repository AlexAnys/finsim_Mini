# Build Report · PR-4B · r1

**Unit**: `pr-4b` 向导 Step 2 三类 config + AI 出题
**Round**: r1
**Date**: 2026-04-24

## 目标

把 PR-4A 里保留的 Step 2 内联 JSX（~900 行混合 3 类型 config）拆成 3 个独立组件对齐设计稿；新增真确认式 AI 批量出题 Dialog；更新 `.env.example` 落地 spec 的模型分层策略。

## 改动文件

**新增**（4 组件 + 1 util + 1 测试）：
- `components/task-wizard/wizard-step-sim.tsx` — Simulation config（场景/开场/要求/评分/资产配置/人设提示词，含评分合计 vs 总分一致性 warn）
- `components/task-wizard/wizard-step-quiz.tsx` — Quiz config（设置条 + 题库），题目卡用设计稿单卡式布局（编号徽章 + 类型徽章 + 类型切换 + 可视化选项选择器）
- `components/task-wizard/wizard-step-subjective.tsx` — Subjective config（题目/字数/附件开关/作答要求/评分标准 + AI 辅助入口）
- `components/task-wizard/ai-quiz-dialog.tsx` — 新 AI 出题 Dialog：调 `/api/ai/task-draft/quiz` → 预览列表 → 用户可删除不合适题 / 编辑题干 / 编辑解析 → "加入题库"（合并到 questions[]，不覆盖已有）
- `lib/utils/quiz-merge.ts` — `mergeGeneratedQuestions()`：若仅有默认空白题就替换、否则追加（被页面调用 + 被测试直接 import）
- `tests/quiz-merge.test.ts` — 5 tests 覆盖 replace / append / multiple-existing / whitespace-stem / empty-generated

**修改**（3 文件）：
- `app/teacher/tasks/new/page.tsx` — Step 2 三分支从 900+ 行内联 JSX → 各 10 行调用 + 接线 handlers；`handleAIQuizAccept` 用 `mergeGeneratedQuestions` util；删除不再用的 `Plus/Trash2/Sparkles/Input/Label/Textarea/Checkbox/Select*` 导入；新增 `aiDialogOpen` state + 插入 `<AIQuizDialog>`。`handleAIGenerateSubjective` 路径保留（主观题入口在本 step 卡内）。
- `components/task-wizard/wizard-card.tsx` — `subtitle` prop 从 `string` → `ReactNode`（子组件需要塞带 `<b>`/`<span>` 的动态摘要）
- `.env.example` — 按 spec 落地 6 个 `AI_*_MODEL` 默认值：
  - `QWEN_MODEL=qwen3.5-plus`（默认改均衡）
  - `AI_SIMULATION_MODEL=qwen-max`
  - `AI_TASK_DRAFT_MODEL=qwen-max`
  - `AI_EVALUATION_MODEL=qwen3.5-plus` + 新 `AI_EVALUATION_FALLBACK_MODEL=qwen-max`
  - `AI_QUIZ_GRADE_MODEL=qwen3.5-plus` / `AI_SUBJECTIVE_GRADE_MODEL=qwen3.5-plus`
  - `AI_STUDY_BUDDY_MODEL=qwen3.5-plus`
  - 新增 `AI_INSIGHTS_*`（Phase 5 预留）
  - 顶部注释说明"核心分层策略"（qwen-max 一次性 vs qwen3.5-plus 高频）

**注意** — `.env`（用户本地）未动。`ai.service.ts` 不改：`AI_TASK_DRAFT_MODEL` 已经是它消费的 env key，只要用户在本地 `.env` 设 `qwen-max` 就生效。

## 设计决策

### AI Dialog 交互（核心差异点）

旧版 `handleAIGenerateQuiz` 直接覆盖 `form.questions`，无确认步骤——用户丢了已手工填的题就很糟糕。

新版：
1. **确认式**：生成后在 Dialog 内先预览列表，用户可删单题 / 改题干 / 改解析，点"加入题库"才写回 form
2. **补充提示输入框**：可以告诉 AI"混合难度 / 必须包含货币基金题"
3. **合并策略**（util 化可测）：仅默认空题 → 替换；否则追加
4. **重新生成** 按钮复用：首次点"生成题目"，有 drafts 时变"重新生成"

### 模拟配置子分区

设计稿用 sub-tab（scene/rubric/assets/persona），我用 4 个 `<WizardCard>` 垂直排列。原因：
- sub-tab 需要额外 state、滚动容器、焦点管理，PR-4B 本来就大（spec 预估 550 行 → 实际新增 ~720 行）
- 垂直排列同样把信息密度降下来，配合 sticky stepper 的"当前草稿"摘要，用户始终能看到任务名 + 总分
- 功能等价，视觉层级依然清晰（每卡有 title + subtitle + extra）

此决定对效果影响不大（非"最终需求不确定"），未向 team-lead 申请。

### 不做的设计稿元素（记录）

| 元素 | 原因 |
|---|---|
| 场景卡的"启动预览对话"按钮 | 需要临时调 simulation API 跑一次，超出 spec scope；已有"保存草稿+去详情页 Preview"路径 |
| sim 评分标准的"AI 生成"按钮 | spec 只提 AI 出题（quiz + subjective 已在），sim rubric 不在列 |
| quiz 的"已关联小节 1.2 · 建议 5 题"面板 | 需要 chapter 级联数据（PR-4A 延后项），本 PR 不做 |
| subjective 的 "从章节生成题干 / 生成评分标准 / 生成样卷参考" 三按钮 | 当前 `/api/ai/task-draft/subjective` 是单一端点返回整 config，已在主观题配置卡头部加"AI 出题"按钮接入 |

## 验证

| 项目 | 结果 | 备注 |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | 需要把 `WizardCard.subtitle` 改 ReactNode 才过 |
| `npx vitest run` | **230 tests** 全绿（225 原 + 5 quiz-merge） | 无 regression |
| `npm run build` | 25 routes 全过 | `/teacher/tasks/new` 在列 |
| Dev server 重启 | ✅ 杀旧 PID 30886/50083 + 新起 Ready in 933ms | 干净日志无 error |
| SSR curl `GET /teacher/tasks/new` | 200 · 52598 bytes | 4 个 step 标签 + 新建任务 + 任务类型全部渲染 |
| Tailwind JIT | `bg-sim-soft / text-sim / bg-quiz-soft / text-quiz / bg-subj-soft / text-subj / bg-success-soft / border-quiz / bg-danger / text-warn` 10 类已入编译 CSS | 无硬编码色泄漏 |

## 与 spec Acceptance 对齐

| Spec | 状态 |
|---|---|
| `三类 config UI 对齐设计稿` | ✅ 3 组件落地；sub-tab 换垂直卡见上 |
| `AI 出题端到端可用（生成 → 预览 → 确认 → 加入）` | ✅ Dialog 实现 4 步流程；加入走 `mergeGeneratedQuestions` 单元测试覆盖 |
| `Provider 走 AI_TASK_DRAFT_MODEL=qwen-max` | ✅ `.env.example` 更新；`ai.service.ts` 原本就读此 env（无硬编码），需用户 `.env` 自行对齐。QA 可用 `/api/ai/task-draft/quiz` 真触发检查 qwen-max 响应 |
| `tsc/vitest/build 过` | ✅ 全过 |

## Anti-regression 扫描

改动只涉及：
- **新组件**：task-wizard/{wizard-step-sim, wizard-step-quiz, wizard-step-subjective, ai-quiz-dialog}
- **新 util**：lib/utils/quiz-merge.ts
- **页面**：`app/teacher/tasks/new/page.tsx` —
  - ✅ 表单 state / handler / `handleSubmit` body 构造零改动（grep + diff 两边 body 构造段落 byte-identical）
  - ✅ 3 个 validation 函数零改动
  - ✅ 删除 `handleAIGenerateQuiz`（被 `AIQuizDialog` 内的 fetch 替代）→ 搜全仓 `handleAIGenerateQuiz` 0 引用 ✅
- **WizardCard.subtitle 类型放宽**：`string` → `ReactNode`，之前 4 个调用点全部兼容（传 string 也合法 ReactNode）
- **`.env.example`**：仅扩展注释 + 补新 key；已有 key 值保持 empty default，不破坏任何 opt-in 覆盖逻辑

## Dev server 重启

本 PR **无 schema 改动**，但 QA 上轮提醒重启——已完成：
- 旧 PID 30886 / 50083 kill 成功
- 新 PID 22073（起 933ms）Ready，日志 `✓ Ready in 933ms`
- SSR probe `GET /teacher/tasks/new` 200 · 52598 bytes

## 不确定 / 建议

1. **AI Quiz Dialog 生成后的草稿可编辑程度**：目前只允许改题干 + 解析。选项文本 / 正确答案切换要回主界面做。若 QA 反馈体验不好可以扩（~150 行）。偏好是先简单，因为 Dialog 不应变成"第二个 Quiz config step"。
2. **模拟配置是否需要 sub-tab**：目前 4 卡垂直；若用户觉得信息太多要滚太远，可 PR-4C 加 sub-tab（不影响功能）。
3. **AI_EVALUATION_FALLBACK_MODEL**：env 写好但 ai.service 尚未消费（当前只读 `AI_FALLBACK_PROVIDER`）。低置信度复合校验的实际落地在 Phase 4/5 批改增强，本 PR 只是为它铺路。

## 下一步

移交 QA：
- 4 步向导完整流程（Type → Basic → Sim/Quiz/Subj config → Review → 创建）
- AI 出题 Dialog 端到端（真 API 触发 → 预览 → 编辑 → 加入）
- 跑一个真的"生成+改题+创建"full flow 确认入库数据无误
- 3 类 config 的新增/删除 list item、必填验证、错误展示
- 设计稿对比（仅差 sub-tab）
- tokens / tsc / vitest / build / dev server 日志
