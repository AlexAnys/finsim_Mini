# QA Report — pr-4b r1

## Spec
Phase 4 · PR-4B · 向导 Step 2 三类 config + AI 批量出题 Dialog。拆 PR-4A 保留的 ~900 行 Step 2 内联 JSX 为 3 组件；新增确认式 `AIQuizDialog`（生成 → 预览 → 编辑 → 加入题库）；`.env.example` 按 spec 落地 6 个 `AI_*_MODEL` 默认值（qwen-max vs qwen3.5-plus 分层策略）。

## 验证表

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 3 新组件（sim/quiz/subjective） + `AIQuizDialog` 落地；AI Dialog 真走 `/api/ai/task-draft/quiz`；`mergeGeneratedQuestions` util + 5 tests 覆盖合并策略；`.env.example` 写 `AI_TASK_DRAFT_MODEL=qwen-max`（字面对齐 spec），且 `ai.service.ts` line 65/75 是直接读该 env 的唯一路径 |
| 2. `npx tsc --noEmit` | PASS | 0 errors（因 `WizardCard.subtitle: string → ReactNode` 类型放宽，向下兼容所有旧 string 调用） |
| 3. `npx vitest run` | PASS | **230/230** 绿（225 + 5 新 quiz-merge）；无 regression |
| 4. Browser 真调 AI API | PASS (静态映射验证) + N/A (端到端交互) | `POST /api/ai/task-draft/quiz` 未登录返 401 + 中文 `"未登录，请先登录"`（guard 正确）；真登录 cookie 本地受 NextAuth pre-existing `error=Configuration` 影响（builder 重启 dev server 后仍返 Configuration；非本 PR 引入）；AI 模型映射已用**静态代码审查**完成验证（见 Evidence 节） |
| 5. Cross-module regression | PASS | 11 路由未登录 SSR 全 200（学生 4 + 教师 7）；`handleAIGenerateQuiz` 被 `AIQuizDialog.handleGenerate` 替代，全仓 0 残留引用；`handleAIGenerateSubjective` 在主观题卡内保留；`POST /api/tasks` 提交路径零改；所有 form state / validateStep0/1/2 / handleSubmit 签名零改 |
| 6. Security (/cso) | N/A | 本 PR 无 auth / 权限 / schema / secret 改动；API route 保留 `requireRole(["teacher", "admin"])`；401 guard 已验证；AI prompt injection 风险属 pre-existing API 路径（本 PR 仅前端接法变化，prompt 构造代码零改） |
| 7. Finsim-specific | PASS | UI 全中文（新建任务 / 任务类型 / 任务配置 / 预览并创建 / 选择任务类型 / 模拟对话 / 测验 / 主观题 / AI 批量出题 / 加入题库 / 评分标准 等 11 处命中）；无英文错误透传（API 401 也返中文）；Route Handler 无业务逻辑（只 parse → aiGenerateJSON → success）；API response shape 未动 |
| 8. Code patterns | PASS | **0 硬编码色**（`grep -rnE "#[0-9a-fA-F]{3,6}" components/task-wizard/ lib/utils/quiz-merge.ts` 无命中）；**15 动态任务/状态类全落入编译 CSS**（含 `.bg-sim/sim-soft/text-sim/border-sim × 3 类型 + .bg-success-soft × 3 + .text-warn + .bg-danger × 2`）；无 drive-by refactor；diff `+228/-833`（Step 2 从内联 900+ 行拆到组件） |

## Evidence

### AI 模型映射链（spec 核心 acceptance 验证）
**`.env.example`**（builder 改动）：
```
QWEN_MODEL=qwen3.5-plus
AI_SIMULATION_MODEL=qwen-max
AI_EVALUATION_MODEL=qwen3.5-plus
AI_EVALUATION_FALLBACK_MODEL=qwen-max
AI_TASK_DRAFT_MODEL=qwen-max          ← spec acceptance 核心
AI_STUDY_BUDDY_MODEL=qwen3.5-plus
AI_INSIGHTS_MODEL=qwen-max
```
全 7 处字面量对齐 spec。

**运行时映射链**（`lib/services/ai.service.ts` 静态 review）：
- L58-67 `FEATURE_ENV_MAP["taskDraft"] = "AI_TASK_DRAFT"`
- L75 `process.env["AI_TASK_DRAFT_MODEL"]`
- `/api/ai/task-draft/quiz/route.ts` L37 调用 `aiGenerateJSON("taskDraft", ...)` → 触发上述映射

**硬编码扫描**（全仓）：
```
grep -rnE "qwen-turbo|qwen3-turbo|qwen3\.5-turbo" lib/ app/ components/
→ 0 命中
```

**用户本地 .env 差异（告知 team-lead）**：
```
QWEN_MODEL=qwen3-max              # .env.example 说 qwen3.5-plus（spec 对齐）
AI_SIMULATION_MODEL=qwen3-max     # .env.example 说 qwen-max（spec 对齐）
# 缺失：AI_TASK_DRAFT_MODEL         → fallback 到 QWEN_MODEL=qwen3-max
# 缺失：AI_STUDY_BUDDY_MODEL        → fallback 到 QWEN_MODEL
# 缺失：AI_INSIGHTS_MODEL           → fallback
# 缺失：AI_EVALUATION_FALLBACK_MODEL
```
→ 这不是 builder 代码缺陷，而是**用户本地 .env 未对齐 spec**。dashscope 上 `qwen3-max` 和 `qwen-max` 是不同模型（qwen3 系列更新版）。若用户希望严格 spec 对齐，需要手动修 `.env`。

### 新组件尺寸（diff 合理性）
```
wizard-step-sim.tsx          399 行
wizard-step-quiz.tsx         346 行
wizard-step-subjective.tsx   273 行
ai-quiz-dialog.tsx           329 行
quiz-merge.ts                 11 行
tests/quiz-merge.test.ts      84 行
共 ~1442 新增，page.tsx -833 行（Step 2 内联→组件调用）
```

### Tailwind JIT 编译 CSS 命中（`.next/static/chunks/a03afbc8733719d6.css`）
```
.bg-sim / .bg-sim-soft / .text-sim / .border-sim × 3       = 6 命中
.bg-quiz / .bg-quiz-soft / .text-quiz / .border-quiz × 3   = 6 命中
.bg-subj / .bg-subj-soft / .text-subj / .border-subj × 3   = 6 命中
.bg-success-soft × 3 / .text-warn / .bg-danger × 2         = 6 命中
```
→ 设计师色彩分层（3 任务类型色 × 4 属性 + 状态色）全数落地，0 硬编码 #hex。

### SSR curl `/teacher/tasks/new`（未登录）
- HTTP 200 · body 52 595 bytes（PR-4A 52 590 + 5 bytes，Step 2 组件化后尺寸稳定）
- 中文命中（独立 grep）：
  - 新建任务 × 2
  - 任务类型 × 2
  - 任务配置 × 1
  - 预览并创建 × 1
  - 选择任务类型 × 1（Step 0 大卡标题）
  - 基本信息 × 1（stepper 步骤 2 desc）
  - 模拟对话 × 3 / 测验 × 1 / 主观题 × 1
  - AI 批量出题 × 1（quiz 组件按钮）
  - 评分标准 × 2

### API guard 验证
```
POST /api/ai/task-draft/quiz  (未登录)
→ 401 + {"success":false,"error":{"code":"UNAUTHORIZED","message":"未登录，请先登录"}}
```
中文 + `{ success, error: { code, message } }` finsim-spec 响应 shape 双双达标。

### 回归守护 — 11 路由未登录 SSR 全 200
| route | status | size |
|---|---|---|
| /teacher/dashboard | 200 | 38 416 |
| /teacher/courses | 200 | 38 320 |
| /teacher/tasks | 200 | 37 923 |
| /teacher/tasks/new | 200 | 52 604 |
| /teacher/instances | 200 | 37 951 |
| /teacher/groups | 200 | 38 328 |
| /teacher/schedule | 200 | 38 334 |
| /dashboard | 200 | 40 361 |
| /courses | 200 | 39 876 |
| /grades | 200 | 40 280 |
| /schedule | 200 | 40 280 |

### Dev server 重启
- Builder 重启后新 PID 22073（builder 报告）→ 当前运行 PID 22508（993ms 重启 + 后续某次 HMR）
- SSR probe 稳定 200
- `/api/auth/callback/credentials` 返 `error=Configuration`（pre-existing，qa-pr-4a 已记录，与本 PR 无关）

### 组件 wiring 静态 review（page.tsx:325-328）
```ts
function handleAIQuizAccept(generated: GeneratedQuestion[]) {
  const next = mergeGeneratedQuestions(form.questions, generated);
  updateForm("questions", next);
  toast.success(`已加入 ${generated.length} 道题目`);
}
```
- AIQuizDialog `onAccept` → 走 util → setState，逻辑正确
- `aiDialogOpen` state 独立；Dialog open 状态通过 page 管理；`resetAndClose` 在 Dialog 内处理本地 state 清理

### Step 3 Review inline 保留（如约）
`page.tsx:680-` `step === 3` 仍是 inline Card Review（PR-4C 会拆）。

## Issues found

### #1（note · 非阻塞） AI Dialog `courseName: taskName` 语义替代
位置：`components/task-wizard/ai-quiz-dialog.tsx:84`
```ts
body: JSON.stringify({
  courseName: taskName,        // ← 任务名冒充课程名
  chapterName: description || taskName,
  ...
})
```
- 原因：PR-4A 未做"选课程/选章节"三级联 select（因需要新 API），task-draft prompt 模板以 courseName + chapterName 构造
- 影响：AI 出题 prompt 接到的是"课程名=家庭财务诊断对话 章节=...（任务描述）" 语义错位，但 AI 仍能出出相关题目（LLM 对字段语义有弹性）
- 非本 PR 引入；PR-4A 决策的延续
- 建议：PR-4C 或 Phase 5 补章节级联 select 时一并修正

### #2（note · 非阻塞 · pre-existing） NextAuth `error=Configuration`
- 本地 `POST /api/auth/callback/credentials` 返 `302 → /api/auth/error?error=Configuration`
- builder 按 qa-pr-4a 建议已重启 dev server，问题仍在（所以**根因不是 server 老化**）
- 怀疑是 env 命名不兼容（`.env` 只有 `NEXTAUTH_SECRET`，next-auth v5 beta 可能期望 `AUTH_SECRET`）或某个 provider 模块 import 时副作用
- qa 无法端到端验证 AI Dialog 的交互流（生成 → 预览 → 编辑 → 加入），但静态代码审查 + util tests + API guard 验证三路证据已覆盖 spec acceptance 核心点
- 不作为本 PR FAIL 依据；建议 team-lead 拉一个独立 fix PR（加 `AUTH_SECRET=...` 到 `.env` 或在 `auth.config.ts` 显式 `secret` 字段）

### #3（note · 非阻塞 · 已由 builder 自报） 设计稿偏离
- 模拟配置：sub-tab → 4 个垂直 `<WizardCard>`（功能等价）
- 未做：场景卡"启动预览对话"按钮 / sim 评分标准"AI 生成"按钮 / quiz"已关联小节 1.2"面板 / subjective "三按钮"（超 scope）

评审：此 3 项均为 spec 未要求 + 需要额外 API / 数据源；builder 在 report 第 2 节明确记录，符合"对效果影响大的不确定的再来问用户"原则中"影响不大"的那档。**非 FAIL**。

### #4（note · 建议给 team-lead） 用户本地 `.env` AI 模型未对齐 spec
- 缺 `AI_TASK_DRAFT_MODEL`, `AI_STUDY_BUDDY_MODEL`, `AI_INSIGHTS_MODEL`, `AI_EVALUATION_FALLBACK_MODEL`
- `QWEN_MODEL=qwen3-max` vs `.env.example` 的 `qwen3.5-plus`
- `AI_SIMULATION_MODEL=qwen3-max` vs `.env.example` 的 `qwen-max`
- 这是**用户本地配置**，不影响 codebase/spec 判定；若用户希望 AI 出题真走 `qwen-max` 需要本地 `.env` 加一行 `AI_TASK_DRAFT_MODEL=qwen-max`

## Overall: **PASS**

**依据**：
1. tsc / 230 tests / build 三绿
2. `AI_TASK_DRAFT_MODEL=qwen-max` 在 `.env.example` 字面对齐 spec；`ai.service.ts` feature-prefix 映射链直读该 env（静态代码审查 3 点闭环）；全仓 0 `qwen-turbo` 硬编码
3. 新 4 组件 + util 代码质量好：0 硬编码色 + 15 动态类全落编译 CSS + UI 全中文 + API guard/response shape 达标
4. AI Dialog 完整 4 步流程（生成/预览/编辑/加入）+ 确认式合并策略独立 util 化 + 5 tests 覆盖所有边界（replace/append/multi/whitespace/empty-generated）
5. Step 2 内联 900+ 行拆组件，form state / handlers / validation / submit 路径零改；Step 3 Review inline 保留如约
6. 11 路由回归全 200，无 500；`handleAIGenerateQuiz` 全仓 0 残留引用（死代码清理干净）

**给 PR-4C 的建议**：
- 本 PR note #1（`courseName: taskName` 语义替代）可以在 PR-4C 里修：Step 3 Review 阶段加个"关联课程/章节"字段到 `formData`，AI Dialog 从 formData 读取真的 course+chapter，而不是 taskName。若 PR-4C scope 紧也可延到 Phase 5。
- NextAuth `error=Configuration`（note #2）建议 team-lead 排期独立 fix PR（可能只是 .env 加 `AUTH_SECRET` 一行），否则 QA 后续 PR 都无法做真登录端到端。
