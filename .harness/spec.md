# Spec — Phase 4 · 任务向导 + 课程编辑器完整版（2026-04-24）

## 用户决策（已回答）

- **A4 · 模型选择**：AI 批量出题 / Simulation / Insights 聚合用 **`qwen-max`**（最强大）；批改 / Socratic 用 **`qwen3.5-plus`**（均衡）；低置信度批改走 qwen-max 二次校验
- **B4 · 置信度输出**：AI 批改输出 `confidence: 0-1`；低置信度触发复合校验
- **G2 · 课程编辑器**：升级为真 block editor（不是占位）
- **H1 · API 解锁**：同意新增 5-8 个 CRUD 端点
- **其他**：全走我的推荐，遇到"对效果影响大且最终需求不确定"的再问用户

## 全局约束更新

- ~~不改 schema~~ — **允许新增字段/表**（但每次改前告知用户影响）
- ~~不改 API~~ — **允许新增端点**（在 Phase 4 scope 内）
- 仍不改核心状态机 / 中文 UI / 任务类型 3 色 / 克制 / AI 就地

## AI Provider 映射（本次落地）

写入 `.env.example` 和代码注释：
```
AI_PROVIDER=qwen                        # 默认
AI_MODEL=qwen3.5-plus                   # 默认型号
AI_SIMULATION_MODEL=qwen-max            # 模拟对话用最强
AI_TASK_DRAFT_MODEL=qwen-max            # AI 出题用最强
AI_EVALUATION_MODEL=qwen3.5-plus        # 批改均衡
AI_EVALUATION_FALLBACK_MODEL=qwen-max   # 低置信度复合校验
AI_STUDY_BUDDY_MODEL=qwen3.5-plus       # Socratic 引导
AI_INSIGHTS_MODEL=qwen-max              # Insights 聚合（Phase 5）
```

## Phase 4 · 4 PR 拆分（预计 2-3 会话）

### PR-4A · 任务向导骨架 + Step 0/1（~450 行）

**目标**：按 `mockups/design/teacher-task-wizard.jsx` 结构换壳，保留现有 form 逻辑。

**改动**：
- `app/teacher/tasks/new/page.tsx` 重构为：顶部面包屑 + 标题 + taskType pill + 左 220 stepper + 右主内容
- 新建 `components/task-wizard/` 目录：
  - `wizard-stepper.tsx`（垂直步骤条 + 可点 + connector line + 草稿摘要卡）
  - `wizard-step-type.tsx`（Step 0 三类任务大卡）
  - `wizard-step-basic.tsx`（Step 1 名称/章节/总分/时长）
- 保留现有 form state / Zod / 提交流程

**不做**：Step 2/3 / 新 API

**Acceptance**：
- teacher1 真登录 `/teacher/tasks/new` 打开 Step 0
- 点击任务类型大卡切换
- Step 1 填基本信息正常
- 保存草稿 / 取消 / prev/next 正常
- tsc/vitest/build 过

### PR-4B · 向导 Step 2 · 三类 config（~550 行）

**改动**：
- `components/task-wizard/step-sim.tsx` — scenario / openingLine / requirements[] / scoringCriteria[] / allocationSections[]
- `components/task-wizard/step-quiz.tsx` — questions[] + quizMode(fixed/adaptive) + shuffle + showResult + **AI 批量出题 dialog**
- `components/task-wizard/step-subjective.tsx` — prompt + wordLimit + allowAttachment + maxAttachments + scoringCriteria[]

**AI 批量出题接入**：
- 调现有 `/api/ai/task-draft/quiz`
- 前端确认 + 编辑后加入 questions[]
- Provider 走 `AI_TASK_DRAFT_MODEL=qwen-max`（builder 确保后端读这个 env，否则改）

**Acceptance**：
- 三类 config UI 对齐设计稿
- AI 出题端到端可用（生成 → 预览 → 确认 → 加入）
- tsc/vitest/build 过

### PR-4C · Step 3 Review + 创建提交（~300 行）

**改动**：
- `components/task-wizard/step-review.tsx`：展示"学生视角"的预览
- "创建任务"按钮走现有 `/api/tasks POST`

**Acceptance**：
- Review 预览与 Runner 实际渲染对齐
- 创建任务端到端成功
- tsc/vitest/build 过

### PR-4D · 课程编辑器升级为真 block editor（~800-1200 行，拆 PR-4D1 + PR-4D2）

**目标**：升级 Phase 3 PR-3C 的"只读占位"右面板为完整可交互 block editor。参考 `mockups/design/teacher-course-editor.jsx` + `teacher-course-editor-parts.jsx`。

#### PR-4D1 · 后端 API + Service 扩展（~400 行）

**新增 schema 字段**（若需要，builder 评估后告知 coordinator）：
- `ContentBlock` 可能需要 `order: Int` 如已有则不动
- `Section / Chapter` 已有 `order` 可用于 reorder

**新增 API 端点**（8 个）：
- `POST /api/lms/content-blocks` — 创建（body: sectionId / type / order / 初始 payload）
- `PATCH /api/lms/content-blocks/[id]` — 更新 payload（通用，按 type 走子 dispatch）
- `DELETE /api/lms/content-blocks/[id]` — 删除
- `POST /api/lms/content-blocks/reorder` — 批量调序（body: [{id, order}]）
- `PATCH /api/lms/sections/[id]` — 改名/描述
- `DELETE /api/lms/sections/[id]` — 删除（级联 blocks）
- `PATCH /api/lms/chapters/[id]` — 改名/描述
- `DELETE /api/lms/chapters/[id]` — 删除（级联 sections + blocks）

**权限**：每个端点用 PR-1B 的 `assertCourseAccess` + PR-SEC2 的 `assertContentBlockWritable`

**测试**：每端点至少 3 tests（own 200 / 跨户 403 / admin 200）

#### PR-4D2 · 前端 block editor 可交互（~400-800 行）

**改动**：
- `components/teacher-course-edit/` 扩展：
  - `block-editor-markdown.tsx`（已有 markdown，升级）
  - `block-editor-resource.tsx`（新：文件上传 + 标题/描述）
  - `block-editor-link.tsx`（新：URL + 标题）
  - `block-editor-simulation.tsx`（新：关联已有 simulation task）
  - `block-editor-quiz.tsx`（新：关联已有 quiz task）
  - `block-editor-subjective.tsx`（新：关联已有 subjective task）
- 右面板：选中 block 时显示对应 editor（不是只读 meta）
- 新建 block 按钮 + 删除 + reorder（拖拽 or 上下箭头）
- Section/Chapter 右键菜单：改名/删除

**Acceptance**：
- 6 种 ContentBlockType 都能创建 + 编辑 + 删除
- reorder 持久化
- Section/Chapter 改名删除正常（级联）
- tsc/vitest/build 过
- 真登录 teacher1 完整 block 编辑 flow 可用

## Risks

- **Schema 变更触发 Prisma 三步**：若 PR-4D1 需要加字段（如 `ContentBlock.order`），必须跑 `npx prisma migrate dev → generate → 重启 dev server`。coordinator 在 commit 前确保 builder 按 CLAUDE.md 完整三步。
- **PR-4D2 虚拟化**：如果单 section 下 blocks 超过 20 个，右面板渲染多 block editor 会慢。设计稿没出虚拟化方案，留给 builder 判断。
- **Block 类型对齐**：schema 里的 `ContentBlockType` enum 和设计稿的 6 类（lecture/simulation/quiz/subjective/resource/link）必须一一对应。builder 先 grep `ContentBlockType` 定义确认。
- **AI 出题 provider 切换**：codebase 可能还有硬编码的 model 名（如 `qwen-turbo`），builder 要确保全局走 env。

## 执行策略

- 单 team（team name 复用 `finsim-redesign-r1`）
- Agents：`builder-p4` + `qa-p4` fresh spawn
- Tasks：PR-4A → 4B → 4C → 4D1 → 4D2（链式 blockedBy）
- 每 PR PASS auto-commit 独立 commit
- PR-4D1 schema 改动前 builder 必须 SendMessage 给 coordinator，coordinator 通知用户（不阻塞 build，但用户在新 session 启动时能知道）
- Phase 4 完成后写新 HANDOFF 并转 Phase 5

## 用户监督节点

Builder 在以下情况**必须** SendMessage 给 team-lead，由 coordinator 决定是否转给用户：
1. 需要改 schema（加字段/加表）
2. 发现 API 需要改变响应 shape（而不只是新增端点）
3. Scope 超 spec 预估 50%（即 PR-4A 超 700 行，PR-4B 超 800 行，etc.）
4. AI provider 切换发现 codebase 有硬编码冲突
5. "不确定最终需求" 的方向问题（用户已授权："对效果影响大的不确定的再来问我"）

## Phase 5-7 预告

详见上个版本 spec.md section "Roadmap · Phase 4-7"（保留在 HANDOFF 引用里），本 spec 聚焦 Phase 4。Phase 5 启动前用户需答 C1/C3/H3 决策。
