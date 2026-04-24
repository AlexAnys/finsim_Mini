# Build Report · PR-4C · r1

**Unit**: `pr-4c` Step 3 Review + 创建提交
**Round**: r1
**Date**: 2026-04-24

## 目标

把 PR-4B 里保留的 Step 3 ~160 行内联 Review JSX 拆成真"学生视角预览"：深色类型色渐变 Hero + 2-col Detail grid + "准备就绪" panel。提交走现有 `/api/tasks POST`（零改动）。

## 改动文件

**新增**（2 组件 + 1 测试）：
- `components/task-wizard/wizard-review-block.tsx` — 共享 `<WizardReviewBlock>` 小卡（uppercase label + pre-wrap 内容 + 可选 mono / wide 跨列）
- `components/task-wizard/wizard-step-review.tsx` — 主 Review 组件 + 3 个子 body（Sim / Quiz / Subjective）
  - **Hero card**：类型色背景（`meta.bgClass`）+ 白字 + 右上装饰圆 + EN/中文双 badge + 任务名 + 描述 + 时长/总分 chips
  - **Detail grid**：`grid-cols-2` 响应式
    - Sim: 场景（wide）/ AI 开场白 mono（wide）/ 对话要求数字徽章列表 / 评分标准（左名右分）/ 资产配置 chip 墙
    - Quiz: 题目列表（类型徽章 + stem truncate + 分值）+ 设置 4 字段
    - Subjective: 题干（wide）/ 提交要求（字数+附件）/ 评分标准 / 作答要求
  - **Ready panel**：brand-soft 背景 + brand 勾号徽章 + "准备就绪" + 说明文案
- `tests/review-filter.test.ts` — 6 tests 覆盖：requirements 过滤、criteria name 过滤、first-section-with-label 查找、undefined 边界、quiz 总分 reduce（含 zero-default）

**修改**（1 文件）：
- `app/teacher/tasks/new/page.tsx`
  - 删除 Step 3 内联 JSX（lines 680-843，~163 行）
  - 删除未再用的 imports：`Card/CardContent/CardHeader/CardTitle`, `Badge`, `Separator`, `taskTypeLabels`, `questionTypeLabels`
  - 新增 `WizardStepReview` import + 调用（传 18 个 props，全部取自 form）
  - form state / handler / validation / `handleSubmit` body 构造**字节级零改动**

## 设计决策

### Hero card 用类型色背景 vs 渐变

设计稿 L506-510 用 `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}dd 100%)`，我用纯色 `bg-sim/quiz/subj`。原因：
- Tailwind 4 不在 safelist 里编译 `from-sim to-sim/80` 这种动态渐变类（需要 `@variant` 或硬写）
- 纯色 + 右上装饰圆 + `bg-white/10` 层视觉差异几乎一致，也保留了"深色特写"感
- 设计稿的 `color + colordd` 渐变只是细微降亮，信息密度不变

### 不做的设计稿元素

| 元素 | 原因 |
|---|---|
| Hero 第 3 个 chip "1.2 · 风险与收益的权衡" | 需要 chapterName 数据，PR-4A 已延后，用户明确"保留现有 form 逻辑" |
| Hero 第 4 个 chip "预计覆盖 82 人" | 需要 class membership 数据，任务创建时尚未 assignedTo（要先创 taskInstance） |
| Ready panel 的两个按钮 "先存草稿" / "创建并去发布" | 当前无 draft 持久化；"去发布"需要 taskInstance 创建。底部 nav 已有"创建任务"按钮，不重复 |

### "学生视角" 的理解

Spec L74: `step-review.tsx：展示"学生视角"的预览`。我的解读：
- Hero 显示学生在任务卡/详情页顶部会看到的类型色+标题+时长+总分（对应 `app/(student)/tasks/[id]/page.tsx` L240, L252 的 `instance.title || taskName`）
- Detail grid 的字段是学生端实际看得到的（评分标准、资产配置、题干），不是教师 config 原样堆叠

故意不渲染的：
- `simPersona / simDialogueStyle / simConstraints` — 这些是 AI 系统提示词，学生不直接看
- `scoringCriteria.description` —  学生只看评分项名字和分值（卡片展示 vs 批改详情）
- 所有空/whitespace 项（requirements / criteria / allocation items）—  符合 "学生视角不会看到空骨架" 的 intent

## 验证

| 项目 | 结果 | 备注 |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | |
| `npx vitest run` | **236 tests** 全绿（230 PR-4B 后 + 6 review-filter 新） | 无 regression |
| `npm run build` | 25 routes 全过 | `/teacher/tasks/new` 在列 |
| SSR curl `GET /teacher/tasks/new` | 200 · 52602 bytes | 大小与 PR-4B 相当（+4 bytes），步骤标签全渲染 |
| Tailwind JIT | `bg-sim / bg-quiz / bg-subj / text-sim / text-quiz / text-subj / bg-brand-soft / border-brand / border-line-2` 全编译 | 8 个 token base classes 至少各出现 1 次 |

## 与 spec Acceptance 对齐

| Spec | 状态 |
|---|---|
| `Review 预览与 Runner 实际渲染对齐` | ✅ Hero 的 taskName/timeLimitMinutes/totalPoints 与 `(student)/tasks/[id]` 一致；不展示仅教师相关字段（如 AI 系统提示词） |
| `创建任务端到端成功` | ✅ `handleSubmit` body 构造 byte-identical，提交路径零改 |
| `tsc/vitest/build 过` | ✅ 全过 |

## Anti-regression 扫描

- 所有 handler / validation / submit 逻辑：**diff 两边一致**（grep + line-by-line 比对 `handleSubmit` 函数体）
- 删除的 imports：`Card` `Badge` `Separator` `taskTypeLabels` `questionTypeLabels` → grep 全仓无其他引用（只在被替换的 Step 3 内联块里用过）
- 3 个 validate 函数：零改动
- `WizardStepReview` 的 18 个 props 都是从 form 直读，不加工，渲染层过滤不会影响提交数据

## 关于 NextAuth `error=Configuration`

独立问题，已向 team-lead 报告：
- 根因：`next-auth@5.0.0-beta.30` 默认期望 `AUTH_SECRET` env；`.env` 只有 `NEXTAUTH_SECRET`
- task #50 `PR-AUTH-fix NextAuth v5 secret 兼容` 已单独创建（非 PR-4C scope）
- 修复 2 行（`auth.config.ts` 显式 `secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET`）或 `.env` 加 `AUTH_SECRET=<same value>`

建议并行处理（不阻塞 PR-4C commit），QA-4C 如果做真登录 smoke test 需要先 #50 PASS。

## Dev server

无 schema 改动，无需重启。SSR probe 200 确认工作正常。

## 不确定 / 建议

1. **"学生视角" 的精确度**：我做的是"信息对齐"，不是像素级 mirror。若用户期待更像 `(student)/tasks/[id]` 的 Runner 外壳（气泡、题目卡、附件 dropzone），那是 Phase 6 "Runner 外壳"的事，不在 PR-4C 合理 scope 内。
2. **Hero 的 `meta.bgClass` + 装饰圆**：设计稿预期渐变，我用纯色。若 QA 觉得过于 flat 可以加 `bg-gradient-to-br from-sim to-sim/80` 类（Tailwind 4 支持 alpha 变体，但需要 safelist 或在 component 内写死才能 JIT 扫到）。目前有装饰圆 + white/85 text 已经有足够深色对比。

## 下一步

移交 QA：4 步全走一遍，尤其 3 类型的 Review 视觉对比 + 真创建任务端到端成功 + 按钮路径回 `/teacher/tasks/{id}`。
