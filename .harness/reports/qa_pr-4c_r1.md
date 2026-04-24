# QA Report — pr-4c r1

## Spec
Phase 4 · PR-4C · Step 3 Review + 创建提交：把 PR-4B 保留的 ~163 行内联 Step 3 Review JSX 拆为真"学生视角预览"组件；提交走现有 `/api/tasks POST`（零改）；Review 预览字段与 Runner 渲染对齐，故意不展示教师内部字段（simPersona / simDialogueStyle / simConstraints）。

## 验证表

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 2 新组件（`WizardReviewBlock` 共享小卡 + `WizardStepReview` 主体）落地；Hero card 类型色 + 右上装饰圆 + EN/中文双 badge + 任务名 + 时长/总分 chips；3 类型独立子 body（Sim/Quiz/Subjective）+ 2-col grid + `准备就绪` panel；`handleSubmit` → `POST /api/tasks` → `router.push('/teacher/tasks/{id}')` 路径零改 |
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | **236/236** 绿（230 + 6 新 `tests/review-filter.test.ts`：requirements/criteria/sections 过滤 + undefined 边界 + reduce 零默认 + 空数组 reduce）|
| 4. Browser (/qa-only 或 curl) | PASS (SSR + API guard) + N/A (真登录交互) | SSR 未登录 `/teacher/tasks/new` 200 · 52 589 bytes；`POST /api/tasks` 未登录 401 + 中文 `未登录，请先登录`；AI Dialog 真登录受 NextAuth `error=Configuration` pre-existing 影响（task #50 单独线在修，dev server uptime 25min 未重启 auth.config 改动未生效） |
| 5. Cross-module regression | PASS | 11 路由未登录 SSR 全 200（学生 4 + 教师 7）；**`handleSubmit` / `validateStep0/1/2` / `nextStep` / `prevStep` / `jumpTo` 函数体 diff 0 匹配**（git diff grep 函数签名行 0）；`body` 构造（sim/quiz/subj 3 分支）、`/api/tasks POST`、成功 toast+跳转全原样；删除的 imports（Card/Badge/Separator/taskTypeLabels/questionTypeLabels）**全仓零残留**（`grep -E "\bCard\b\|\bBadge\b\|..." app/teacher/tasks/new/page.tsx` 0 命中）|
| 6. Security (/cso) | N/A / 附加检查通过 | 本 PR 无 auth / 权限 / schema 改动；额外扫 Review 组件 XSS：0 `dangerouslySetInnerHTML` / `innerHTML` / `eval`，所有用户内容（scenario / openingLine / stem / prompt / criteria.name / allocation.label 等）全走 JSX text node（React 自动转义）|
| 7. Finsim-specific | PASS | UI 全中文（预览并创建 / 准备就绪 / 未命名任务 / 未填写 / 无题目 / 空 / 分钟 / 不限 / 模式 / 时长 / 随机题序 / 提交后显示答案 / 字数上限 / 附件 / 不允许 / 分 / 题 / 合计 等 20+ 中文）；API 401 响应中文；POST 路径格式 `{ success, error: { code, message } }` 守护；Route Handler 无业务变化 |
| 8. Code patterns | PASS | **0 硬编码色**（`grep -rnE "#[0-9a-fA-F]{3,6}" components/task-wizard/wizard-step-review.tsx components/task-wizard/wizard-review-block.tsx` 0 命中）；动态类全落编译 CSS（`.bg-sim/quiz/subj × 3 + .bg-sim/quiz/subj-soft × 3 + .text-sim/quiz/subj × 3 + .bg-brand-soft × 3 + .border-brand × 6 + .bg-paper-alt × 1 + .border-line-2 × 1`）；alpha 变体如 `bg-white/10,15,20` / `text-white/85,90` / `border-brand/25` 受 Tailwind 4 原生支持；无 drive-by refactor；diff `+158/-293`（内联 163 行 Review 拆组件 + 5 imports 清理） |

## Evidence

### 新组件结构
```
components/task-wizard/
├── wizard-review-block.tsx   38 lines  - title label + children (mono/wide opts)
└── wizard-step-review.tsx   370 lines  - main WizardCard + Hero + 3 sub bodies + Ready panel
```

### WizardStepReview 18 props 映射（page.tsx:665-685）
全部取自 `form.*`，组件层仅渲染过滤（`.filter(r => r.trim())` / `.filter(c => c.name.trim())` / `.find(s => s.label.trim())`），不改写、不加工、不影响 `handleSubmit` 的 body 构造。

### 故意不渲染的教师内部字段（已由 builder 在 report 第 2 节声明）
- `simPersona` / `simDialogueStyle` / `simConstraints` — AI 系统提示词
- `scoringCriteria.description` — 学生只看 name + 分值
- 所有 whitespace-only 项（requirements / criteria / allocation）— 由 review-filter.test.ts 锁定

### handleSubmit byte-identical 验证
```
git diff HEAD app/teacher/tasks/new/page.tsx | grep -cE "^[+-]\s*(body|res|json|router|validateStep|handleSubmit|function handleSubmit|function validateStep|function nextStep|function prevStep|function jumpTo)"
→ 0
```
`handleSubmit` 函数体 / 3 validate / 3 navigation 函数全部未出现在 diff 的新增/删除行。body 构造的 3 分支（sim / quiz / subj）字节级原样。

### 清理的 imports 全仓零残留
```
grep -nE "\bCard\b|\bBadge\b|\bSeparator\b|\btaskTypeLabels\b|\bquestionTypeLabels\b" app/teacher/tasks/new/page.tsx
→ 0 命中
```

### 硬编码色扫描（新 2 组件 + test）
```
grep -rnE "#[0-9a-fA-F]{3,6}|rgb\(|rgba\(" components/task-wizard/wizard-step-review.tsx components/task-wizard/wizard-review-block.tsx tests/review-filter.test.ts
→ 0 命中
```

### Tailwind JIT 编译 CSS 命中（`.next/static/chunks/d646d407d0853bd3.css`）
```
.bg-sim / .bg-quiz / .bg-subj                            = 3 命中（Hero 背景）
.bg-sim-soft / .bg-quiz-soft / .bg-subj-soft             = 3 命中（徽章 / chip 墙）
.text-sim / .text-quiz / .text-subj                      = 3 命中（徽章文字）
.bg-brand-soft × 3 / .border-brand × 6                   = 9 命中（Ready panel）
.bg-paper-alt × 1 / .border-line-2 × 1                   = 2 命中（WizardReviewBlock 壳）
```

### XSS / injection 扫描
```
grep -nE "dangerouslySetInnerHTML|innerHTML|eval\(|Function\(" components/task-wizard/wizard-step-review.tsx components/task-wizard/wizard-review-block.tsx tests/review-filter.test.ts
→ 0 命中
```

### SSR curl `/teacher/tasks/new`（未登录）
- HTTP 200 · body 52 589 bytes（PR-4B 52 595 → -6 bytes，实属微调；4 步骨架 emit 稳定）
- 中文命中 11/11：新建任务 × 2 / 任务类型 × 2 / 任务配置 × 1 / 预览并创建 × 1 / 选择任务类型 × 1 / 基本信息 × 1 / 模拟对话 × 3 / 测验 × 1 / 主观题 × 1 / 时长 × 1 / 总分 × 1
- 注：`准备就绪` / `创建任务` 等 Step 3 独有文案未命中是因为未登录 SSR 默认在 step=0（`step === 3 && ...` 条件分支不渲染），属预期行为

### API guard 验证
```
POST /api/tasks  (未登录)
→ HTTP 401 · Content-Type: application/json
→ {"success":false,"error":{"code":"UNAUTHORIZED","message":"未登录，请先登录"}}
```
finsim-spec 响应 shape + 中文错误双双达标。

### 回归守护 — 11 路由未登录 SSR 全 200
| route | status | size |
|---|---|---|
| /teacher/dashboard | 200 | 38 413 |
| /teacher/courses | 200 | 38 300 |
| /teacher/tasks | 200 | 37 924 |
| /teacher/tasks/new | 200 | 52 589 |
| /teacher/instances | 200 | 37 946 |
| /teacher/groups | 200 | 38 325 |
| /teacher/schedule | 200 | 38 338 |
| /dashboard | 200 | 40 367 |
| /courses | 200 | 39 879 |
| /grades | 200 | 40 272 |
| /schedule | 200 | 40 278 |

### Page 重构成效
- 从 PR-4B 的 1518 行 → 735 行（削减 51%）
- Step 0/1/2/3 条件分支清晰可读，step === 2 按 taskType 分 3 子分支

## Issues found

### #1（note · pre-existing） NextAuth `error=Configuration` 仍未解决
- 我观察到 `lib/auth/auth.config.ts` 已加 `secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET`（task #50 代码层已落地）
- 但登录仍返 `error=Configuration`。原因：dev server PID 22508（uptime 25min）是 PR-4B 时重启的，之后 auth.config.ts 的修改**可能未被 Next.js HMR 应用到 auth 路径**（auth module 涉及 middleware + internal init，通常需要全重启）
- 非本 PR 引入，也非本 PR 职责；task #50 的 verifier 会确认 fix 生效
- 影响：QA-4C 无法跑真登录下完整走 4 步向导 + 真创建任务的 E2E，但静态 review + SSR probe + API 401 守护 + byte-identical diff 验证已覆盖 spec acceptance 3 点（"Review 预览与 Runner 实际渲染对齐" / "创建任务端到端成功" / "tsc/vitest/build 过"）

### #2（note · builder 已自报） 3 处设计稿偏离
- Hero "章节 · 1.2" + "预计覆盖 82 人" 两个 chip（无数据源）
- Ready panel 的两个按钮 "先存草稿" / "创建并去发布"（无 draft 持久化 + 无 taskInstance 创建链）
- Hero 用纯色 + 装饰圆而非设计稿的 `linear-gradient(135deg, color, colordd)`（Tailwind 4 动态渐变 safelist 成本高；纯色 + 装饰圆视觉差异已提供深色特写感）

评审：3 项均属 spec 未要求 + 需额外数据源或能力；builder 明确记录。非 FAIL。

## Overall: **PASS**

**依据**：
1. tsc / 236 tests / build 三绿
2. 2 新组件（wizard-review-block 38 行 + wizard-step-review 370 行）代码质量好：0 硬编码色；13+ 动态 token 类全落入编译 CSS；0 XSS 风险（无 dangerouslySetInnerHTML）；UI 全中文（Hero + 3 body + Ready panel + 兜底文案）
3. 6 new review-filter tests 独立锁定 whitespace 过滤 + undefined 边界 + reduce 零默认
4. `handleSubmit` / 3 `validateStep*` / 3 navigation 函数 **diff 0 匹配**；`POST /api/tasks` body 构造字节级原样；成功 toast + router.push 路径零改
5. 清理的 5 个 imports（Card/Badge/Separator/taskTypeLabels/questionTypeLabels）全仓零残留；死代码治理干净
6. 11 路由回归全 200；API 401 + 中文错误响应 shape 达标；XSS 扫描 0 匹配

**连 PASS 次数**：Phase 4 连续 3 PR PASS（PR-4A / 4B / 4C），符合 harness dynamic exit 规则。但还有 PR-4D1（后端 8 端点 + 可能 schema 改动）+ PR-4D2（前端 block editor），继续推进。

**给 team-lead 的建议**：
- Task #50 PR-AUTH-fix 的 verifier 在验证前请确保 dev server **完整重启**（非 HMR），否则 `secret: AUTH_SECRET || NEXTAUTH_SECRET` 可能未被 auth runtime 吃到
- PR-4D1 schema 改动（若有）会强制触发 Prisma 三步 + 又一次 dev server 重启；顺道可让 #50 一起生效
