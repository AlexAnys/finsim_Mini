# QA Report — fix-quiz-options r1

## Spec
[.harness/spec.md](../spec.md) 末尾 `🔧 BLOCKER 修复 · Q-OPTIONS-RENDER`：alex 重跑 R4.1 quiz 学生端到端，4 选项要完整显示 / radio 可选 / 提交 selectedOptionIds 含真实值 / async grading 走通 / teacher 公布 / 学生看分。其他 R4 6 项已固化。

## 环境
- Dev server: localhost:3030（HTTP 200）
- Browse daemon: PID 8850（gstack browse v1.1.0 via `/Users/alexmac/.codex/skills/gstack/browse/dist/browse`）
- 测试 quiz：`b7ca71ef-7239-4844-b0bd-29e1b444be61` 「[QA-V2-202604300250] 风险收益基础测验」（注：spec 给的 UUID `b7ca71ef-...d04baf9eb8b6` 末段对不上 DB，DB 实际末段是 `29e1b444be61`，已用真实 UUID 跑）
- 学生：alex@qq.com / 11；抽查 belle/charlie；teacher1@finsim.edu.cn / password123
- 提交 ID（本轮新建）：`4a3f639d-ab10-4d2c-bd74-9ac0f7cf5c4e`

## R4.1 端到端 9 步（必跑）

| # | 步骤 | Verdict | Evidence |
|---|---|---|---|
| 1 | alex 登录 | PASS | `/login` → `/dashboard`（200）。fill @e3=alex@qq.com / @e4=11 / click @e5。 |
| 2 | 进 Quiz 任务，4 选项完整显示 | **PASS** | `/tasks/b7ca71ef-...`（200）。Page text 显示 "A. 资产配置是否匹配家庭情况"、"B. 是否一定选择最高收益产品"、"C. 是否完全不投资"、"D. 是否忽略现金流"。**完整文案，不再是 "."**。snapshot ARIA tree: `@e12 [radio] "A. 资产配置..."` … `@e15 [radio] "D. 是否忽略现金流"`。Screenshot `/tmp/qa-fix-quiz-r1-01-options-rendered.png`。 |
| 3 | Radio 选 B → B 高亮 + state 更新 | **PASS** | click @e13（"B. 是否一定选择最高收益产品"）→ `is checked @e13 = true`，`@e12/@e14/@e15 = false`。**RadioGroup state 真实工作**（之前 R4 时 `value={opt.label}=undefined` 全部 fallback 为 "on" → 永远 unchecked 的 bug 已修）。Screenshot `/tmp/qa-fix-quiz-r1-02-radio-selected.png`。 |
| 4 | 答完两题（Q1 单选 / Q2 简答） | PASS | Q2 是 short_answer（options=null），page.tsx 的 `Array.isArray(q.options) ? ... : null` 守卫工作（else 分支返回 null），无 crash。"已作答 2/2 总分 100"。 |
| 5 | 提交 → toast "提交成功，系统正在后台批改" | PASS | click 提交答卷（@e11）→ Radix popover 显示 "提交成功，系统正在后台批改"。Network: `POST /api/submissions → 201 (81ms, 922B)`。 |
| 6 | 提交 payload `selectedOptionIds: ["B"]`（不能是 `[]`） | **PASS（决定性证据）** | DB QuizSubmission.answers 直查：`[{"questionId": "68703099-...", "selectedOptionIds": ["B"]}, {"questionId": "22679edc-...", "textAnswer": "高风险一般对应高收益..."}]`。**Q1 含真实 `["B"]`，Q2 走 textAnswer，非空**。这是 spec acceptance #4 的核心证据。Screenshot `/tmp/qa-fix-quiz-r1-03-payload-network.png`。 |
| 7 | Async grading 走通 | PASS | `AsyncJob` type=`submission_grade` running 20% → 90s 后 graded（job completedAt 设置）。`Submission` status: `grading` → `graded`（gradedAt = 2026-05-02 10:04:16）。score 0/100 反映 alex 选 B 错（正确答案是 A，scorer 工作正常）。 |
| 8 | teacher1 进 instance → 看到 alex 提交 + 公布 | PASS | `/teacher/instances/b7ca71ef-...` 提交列表 4 条，alex 第一行：`alex 1 分钟 已出分 已分析·未公布 0/100 0 0 05/02 17:58 [复评] [公布]`。Total "已出分 4/10 100% 完成批改"。click 公布 → `POST /api/submissions/4a3f639d-.../release → 200 (36ms)`。DB releasedAt=`2026-05-02 10:05:36.771`。Screenshot `/tmp/qa-fix-quiz-r1-04-graded.png`。 |
| 9 | alex `/grades` 看到分数 | PASS | re-login alex → `/grades`：`6 次提交 · 已公布 1 次 · 平均 0%`。列表显示 "测验 个人理财规划 [QA-V2-202604300250] 风险收益基础测验 2026-05-02 17:58 0/100"（真实分数显示）。详情卡 "本次得分 0/100 0%"。Screenshot `/tmp/qa-fix-quiz-r1-05-student-score.png`。 |

## R4.2 / R4.3 抽查（不能 regression）

| # | 步骤 | Verdict | Evidence |
|---|---|---|---|
| 10 | belle 进 simulation 任务 | PASS | belle 登录 → `/tasks/c0c0c1e5-...` redirect 到 `/sim/c0c0c1e5-...`，page text 完整显示客户对话 "我想买收益最高的产品..."、评分对照（需求澄清/风险收益解释/行动建议）、配资工具（紧急备用金/稳健理财/成长投资）。Sim 路径与 quiz 路径独立，无受 page.tsx 改动影响。Console 0 error。 |
| 11 | charlie 进 subjective 任务 | PASS | charlie 登录 → `/tasks/57c9940b-...`，page text 显示 "主观题 已自动保存 0字 存草稿 提交 任务信息 题目要求 评分标准（满分 100 分）作答区域"。Subjective 分支独立，无影响。Console 0 error。 |

## 8 维 check 表

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | acceptance 6 条全 PASS（tsc / 4 选项渲染 / radio 可选 / 真实 selectedOptionIds / async grading / sim+subjective 不受影响） |
| 2. tsc --noEmit | PASS | 0 errors（无输出） |
| 3. vitest run | SKIP | 按 spec 跳过（无新单测要求） |
| 4. Browser (`/qa-only` via gstack) | PASS | 5 张截图 `/tmp/qa-fix-quiz-r1-*.png`；alex 端到端跑通；console 仅 HMR/Fast Refresh + 1 个旧的良性 404（非本轮新增）；3 个角色（alex/belle/charlie）+ teacher1 全部正常加载页面 |
| 5. Cross-module regression | SKIP | 无 service 改动，仅前端 mapping 层 |
| 6. Security (`/cso`) | SKIP | 无 auth/支付/上传边界改动 |
| 7. Finsim-specific | PASS | UI 全中文（"提交成功，系统正在后台批改" / "已出分" / "已公布" / "已分析·未公布"）；API 走 `/api/submissions` 三层架构（Route Handler → Service → Prisma）；release 走 `POST /api/submissions/{id}/release` |
| 8. Code patterns | PASS | git diff 仅 page.tsx 6 行（1 行 interface + 5 行 mapping with Array.isArray 守卫），完全符合 spec 给的 minimal patch；无 drive-by refactor；未碰 components/quiz/quiz-runner.tsx；未影响 sim/subjective 分支（diff 验证） |

## Issues found

无。Builder 改动完全符合 spec 方案 A（最小 diff），mapping 层 `{id→label, text→content}` 转换正确生效，Array.isArray 守卫处理了 short_answer 的 null options。

## Cleanup

按 R4 spec 不需清理，新建的 alex 提交 `4a3f639d-...` 留为真实数据（已 graded score 0、releasedAt 设置）。

## Overall: **PASS**

R4.1 Quiz 学生端到端 9 步全 PASS + R4.2/R4.3 抽查不 regression。Q-OPTIONS-RENDER BLOCKER 完整修复，UI 路径与后端管道（R4 已固化）打通。

**关键证据排序**：
1. DB `QuizSubmission.answers = [{questionId, selectedOptionIds: ["B"]}, {questionId, textAnswer: "..."}]` — 直接证明 mapping 修复后 selectedOptionIds 含真实值
2. `is checked @e13 = true` — RadioGroup state 真实工作
3. snapshot ARIA: `@e12 [radio] "A. 资产配置..."` — 4 选项完整文案在 ARIA tree
4. `POST /api/submissions/.../release → 200` + DB `releasedAt` 设置 — teacher 公布闭环
5. alex `/grades` "测验 ... 0/100" — 学生侧分数可见

下一步给 coordinator：可进 R5 Analytics V2，或按用户决定其他优先级。
