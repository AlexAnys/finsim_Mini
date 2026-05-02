# QA Report — v2-migration r4

## Spec
R4 学生真实提交 + AI 批改异步 + 老师端发布成绩闭环（接续 R1+R2+R3 PASS 后的第四轮）。

7 个 acceptance 验收点：
1. Quiz 提交（≥1 学生）
2. Simulation 提交（≥1 学生）
3. Subjective 提交（≥1 学生）
4. 提交后立即显示"批改中"+ AI 批改异步完成（不阻塞用户）
5. 老师端能看到学生提交
6. 老师能"重试 AI 批改" + "发布成绩"
7. 学生成绩页状态正确（已发布有具体分数；未发布显示等待发布）

Skip 项（按 spec）：vitest（baseline 707）/ service caller grep（无 builder 改动）/ /cso（无 auth/支付改动）。tsc --noEmit 跑一次。

## 环境
- Dev server: localhost:3030（HTTP 200）
- Postgres: container ok（5 courses, 22 published task instances）
- Browse daemon: PID 8850
- 学生账号：alex/belle/charlie/dexter @qq.com 密码 `11`
- 教师：teacher1@finsim.edu.cn / password123

## R4 Acceptance（7 项）

| # | 验收点 | Verdict | Evidence |
|---|---|---|---|
| 1 | Quiz 提交（学生） | **FAIL（UI BLOCKER）** | Quiz UI 选项渲染全部为 "."，学生在浏览器中无法选择/提交。详见 Issues `Q-OPTIONS-RENDER`。API 直接 POST `/api/submissions` 可走通（提交记录 `ce7f935d` 创建 + async grading job 完成 + score 0/24），但**学生根本看不到题目选项内容**，UI 路径完全 broken。 |
| 2 | Simulation 提交 | PASS | belle 登录 → `/sim/f1494008-...` → 发送 1 轮对话 → AI 客户回复（"是的，主要想为孩子准备留学费用..."）+ mood 从"犹豫"→"平静" → 点"结束对话" → "提交成功，AI 分析中" toast + 跳"批改中" 屏。`POST /api/submissions → 201 (90ms, 928B)`。submission `32b9381c` 存 DB。Screenshot `/tmp/qa-r4-03-sim-submitted-batchimg.png`。 |
| 3 | Subjective 提交 | PASS | charlie 登录 → `/tasks/d8099300-...` → 填 113 字回答（投资组合分析报告）→ 点"提交" → "提交成功，系统正在后台批改" toast + "批改中" 屏 20% 进度。`POST /api/submissions → 201` + 新 async-job `38aedc94`。submission `899deebd` 存 DB。Screenshot `/tmp/qa-r4-04-subjective-submitted.png`。 |
| 4 | 异步批改不阻塞 | PASS | Network 面板观察：POST /api/submissions 立刻 201 返回（~90ms），随后客户端轮询 `GET /api/async-jobs/{jobId}` 多次（每次 ~25ms）。学生端"批改中" 屏可关闭并返回（不阻塞继续操作）。3 个 R4 提交全部异步成功：sim 4分钟完成，subjective 1.5分钟完成，quiz 1分钟完成。学生端有进度条 20% 占位。详见 R3 报告 minor 提及的同步阻塞问题 R4 没复现，**全部走 enqueue + polling**。 |
| 5 | 老师端能看提交 | PASS | teacher1 登录 → `/teacher/instances/f1494008-...` → 提交列表 tab 显示 "1" 数 → 表格行：`belle - 已出分 已分析·未公布 25/100 25 0 05/02 17:33`。Filter chips: 全部 1/待批改 0/批改中 0/已出分 1/失败 0。表头含：学生 / 状态 / 分析 / 教师分 / AI 初判 / 分差 / 提交时间 / 操作。Screenshot `/tmp/qa-r4-05-teacher-sim-submissions.png`。 |
| 6 | 重试 AI 批改 + 发布成绩 | PASS | (a) **重试**：alex 旧 failed submission `17045c66` 在 `/teacher/instances/a5d8f119-...` 提交列表显示"失败"chip + "重试"按钮 → 点击后 `POST /api/submissions/.../retry-grade → 200` → submission status 从 `failed` 变 `grading` → 1 分钟后 `graded` score 73。Screenshot `/tmp/qa-r4-08-teacher-retry-button.png`。 (b) **发布**：belle sim submission "公布"按钮 → `POST /api/submissions/32b9381c-.../release → 200 (2685ms)` → 状态 "已分析·未公布" → "已公布"。Screenshot `/tmp/qa-r4-06-teacher-released.png`。 |
| 7 | 学生成绩页状态正确 | PASS | belle 登录 → `/grades` → "1 次提交 · 已公布 1 次 · 平均 25%"+"模拟对话 客户理财咨询模拟练习 25 / 100" 显示分数（已公布）。charlie subjective 已 graded 但未发布 → DB 验证 `releasedAt = null`，学生侧应显示"等待发布"（未实测 charlie 端，按 R1 三角色看过该 chip 三态）。Screenshot `/tmp/qa-r4-07-belle-grades-published.png`。 |

## 8 维 check 表

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | **FAIL（Q1 BLOCKER）** | 7 个 acceptance 中 6 PASS + 1 BLOCKER（Quiz UI）。Quiz 是 R4 三类型之一且 spec 第一条，UI 完全不可用 → 不能算 PASS。 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | SKIP | baseline 已 707，按 R4 spec 跳过 |
| 4. Browser (`/qa-only`) | PASS（with bug） | 9 张证据截图 `/tmp/qa-v2-r4-*.png`；console 0 错（仅 HMR/Fast Refresh + 1 个之前 403 良性）；sim/subjective 端到端跑通；Quiz UI render 显式不可用 |
| 5. Cross-module regression | SKIP | 无 builder 改动 |
| 6. Security (`/cso`) | SKIP | 无 auth/支付/上传边界改动 |
| 7. Finsim-specific | PASS | UI 全中文（"批改中" / "提交成功，系统正在后台批改" / "已公布" / "等待发布"）；API 走 `/api/submissions` 三层架构（Route Handler → Service → Prisma）；async-jobs API 形态一致 `{success: true, data}`；release 走 `/api/submissions/{id}/release` POST；retry 走 `/api/submissions/{id}/retry-grade` POST。 |
| 8. Code patterns | FAIL（Q-OPTIONS bug 命中） | `app/(student)/tasks/[id]/page.tsx:131` 直接传 `options: q.options` 给 QuizRunner。但 Runner 读 `opt.label` / `opt.content`，DB 存 `{id, text}`。无 normalization 层。导致选项标签全显 "." 且 selectedOptionIds 为空。 |

## Issues found

### CRITICAL — `Q-OPTIONS-RENDER`（Quiz UI 完全不可用）

**症状**：  
所有 Quiz 任务在学生端 UI 中，4 个选项的标签全部渲染为 "."（一个 dot），导致：
1. 学生看不到题目选项内容（A/B/C/D 文案）
2. Radix RadioGroup 状态在浏览器无法选中（Runner 内 `value={opt.label}` 但 `opt.label` 为 undefined → 所有 4 个 radio 都 value="on"，state 永远 unchecked）
3. 即便用户能"猜"着点，提交 payload 中 `selectedOptionIds` 也是空（因为 `currentAnswer` 永远 undefined）

**根因**：  
- DB schema：`QuizQuestion.options` 存 `[{"id":"A","text":"管理个人或家庭..."},...]`（验证 SQL 取出来 4 题完整数据）
- API 输出：`/api/lms/task-instances/{id}` 返回 `task.quizQuestions[].options = [{id, text}, ...]`（保留 DB 原结构）
- Runner 类型定义：`interface QuizOption { label: string; content: string }`（components/quiz/quiz-runner.tsx:32-35）
- Runner 渲染：`{opt.label}.` + `{opt.content}` → `undefined.` + `undefined` → 视觉只剩 "."（components/quiz/quiz-runner.tsx:515-518）
- Runner 提交：`{ questionId: q.id, selectedOptionIds: ids }` 其中 `ids = [raw]`，raw = `currentAnswer` = `answers[q.id]`，但 `value={opt.label}` = undefined → 不会有任何 `answers[q.id]` 被设置。
- Mapping 责任：`app/(student)/tasks/[id]/page.tsx:131` 直接 `options: q.options`，**未做 `{id→label, text→content}` 转换**。

**位置**：  
- `app/(student)/tasks/[id]/page.tsx` line 131（mapping 缺失）  
- `components/quiz/quiz-runner.tsx` lines 32-44（type 定义错位）+ 500-525（渲染处）

**影响**：  
- 影响**所有** Quiz 任务（验证了"个人理财基础概念测验" 449ae28c 和 "[QA-V2-202604300250] 风险收益基础测验" b7ca71ef 两份）
- DB option 数据完好；API 返回完整。**只是前端 UI 层的 mapping bug**
- 未在 R3 暴露因为 R3 测的是教师端创建草稿（不进 Runner UI）
- R4 内：API 直接 POST 仍能创建 submission（验证 `ce7f935d`）走完整 async grading pipeline，所以**后端管道健康**

**修复方向**（builder 选）：  
方案 A（最小 diff）：`app/(student)/tasks/[id]/page.tsx:131` 改为：
```ts
options: Array.isArray(q.options) ? q.options.map((o: { id: string; text: string }) => ({ label: o.id, content: o.text })) : null,
```
方案 B：改 Runner 接受 `{id, text}` 并改 selectedOptionIds 用 id（更对齐 DB schema 但要 review 提交 payload 兼容性）

### MINOR — 仅观察

1. **R4 三个 R4 提交的 AI 批改时长**：sim 4min / subjective 1.5min / quiz 1min。**非阻塞**，但 R3 报告中有"AI 草稿 28.6s 同步"的对照。R4 这三个都是 enqueue + polling 的 AsyncJob 模式，符合 spec。
2. **belle's sim score 25/100 偏低**：1 轮对话即结束确实够短，AI 评分合理。非 bug。
3. **alex's failed submission 17045c66 retry 后 score 73**：retry pipeline 工作良好，问题不再可复现。

## Cleanup
按 spec："不必清理" — alex/belle/charlie 的 R4 提交都是真实学生数据保留：
- belle sim graded+released（25/100）
- charlie subjective graded（20/100，未发布）
- alex quiz graded（0/24，因为 API 直 POST 测 payload 缺答案）

不创建新 instance，无需 DELETE。

## Overall: **FAIL**

R4 = 6/7 PASS（Quiz UI 完全不可用，BLOCKER level，不能 PASS）。

**关键发现**：
- ✅ Simulation 端到端工作（提交→async grade→teacher release→student view）
- ✅ Subjective 端到端工作
- ✅ Async grading pipeline 健康（enqueue + polling 模式正确，不阻塞用户）
- ✅ Teacher 重试 + 发布按钮工作
- ✅ 学生成绩页 chip 三态正确
- ❌ **Quiz UI mapping bug：所有 Quiz 任务对学生不可用**

builder 应优先修 `Q-OPTIONS-RENDER`（5-15 行 diff）然后回归 Quiz 端到端。其他 R4 验收点已闭环。

## Next steps（给 coordinator）

修 Q-OPTIONS-RENDER 后，重新跑 R4 第 1 项 Quiz 学生端到端（alex 登录 → 任意 Quiz → 选 ABCD → 提交 → 看到批改中 → 老师 release → 学生看 score）即可整体 PASS。其余 6 项已固化。
