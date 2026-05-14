# Probe Report — M3a 模拟对话任务 (r1)

**Scope**: 演示视频「模块三-A：模拟对话」全链路（教师建设 → 发布 → 学生进入 → 多轮对话 → 评分 → 留痕 → 审计 → 错误处理 → 权限）

**Evidence base**:
- 代码：`app/(simulation)/sim/[id]/page.tsx`、`components/simulation/simulation-runner.tsx` (1977 行)、`app/api/ai/{chat,evaluate,speech-to-text}/route.ts`、`lib/services/{ai,grading,submission}.service.ts`、`components/task-wizard/wizard-step-sim.tsx`、`app/teacher/instances/[id]/insights/page.tsx`
- Playwright 实测：`tests/e2e/probe-m3a*.spec.ts`（5 用例全过，含教师 preview、学生多轮、AI 上下文记忆、跨班权限、localStorage 恢复、教师 preview 出分）
- 截图：`.harness/screenshots/probe-m3a/`（21/23/24/30/40/50/51/60/61）

---

## P0（阻塞或体验严重缺陷）

无。已修部分（PR#6/#7/STT a9f042f）实测均正常：role enum、systemPrompt 学生 403 fix、per-browser draft userId scope、webm→wav 转码逻辑均生效。

## P1（功能可用但有明显短板）

### P1-1 教师建设入口缺独立 wizard 入口
- 症状：URL `/teacher/tasks/new` 渲染"任务不存在"（404 fallback）。截图 03。教师任务管理页只有「前往课程添加任务」按钮跳转到 `/teacher/courses`，必须先进入某门课程才能创建。
- 实测证据：`app/teacher/tasks/page.tsx:144-149` 的按钮 href 是 `/teacher/courses`；`app/teacher/tasks/[id]/page.tsx` 把 `new` 当 taskId 查询 → 404
- 根因：任务建设强绑定课程上下文（章节/小节归属），但缺少"任务库"独立入口，对"我只想快速试一个 sim"场景不友好。
- 优化方向：保留课程入口为主；任务列表页加 dropdown「选课程 → 进入 wizard」，或拦截 `/teacher/tasks/new` 跳到"先选课程"对话框。

### P1-2 评分依据未结构化"引用学生原话"
- 症状：评估出分后 rubric `comment` 是连贯段落，AI 偶尔引用对话片段但未强制（截图 61）。演示视频"评分依据可见 quote 学生原话"要求未严格满足。
- 实测证据：`lib/services/ai.service.ts:1480` 评估 prompt 仅要求"评语要具体，引用对话中的原文作为依据"，`rubricBreakdown` schema 只有 `score / comment` 两字段，无 `quotedUtterances` 数组。前述 eval 测试 comment 文本质量好但格式自由
- 根因：prompt + zod schema 都没把"原文引用"提升到结构化字段，AI 取舍随机
- 优化方向：schema 追加 `evidence: Array<{ studentText: string, comment: string }>`；prompt 明确"每项 rubric 至少 1 条 evidence，引用对话中学生原句"

### P1-3 学生入口仅依赖 dashboard，无独立任务列表索引
- 症状：访问 `/tasks` 直接 404（截图：spec 输出 `404 http://localhost:3000/tasks`）。学生必须从 dashboard 卡片或 grades 页找入口，没有"我的全部任务"页
- 实测证据：`app/(student)/tasks/` 下只有 `[id]/page.tsx`，无 index `page.tsx`
- 根因：路由设计倾向 dashboard 为唯一入口
- 优化方向：补 `app/(student)/tasks/page.tsx` 给学生「我的任务」列表（按 due / class / type 过滤），dashboard 卡片仍是首屏

## P2（小毛刺/可观察体验）

### P2-1 评分项中 quote student 原话依赖 AI 自觉
- 见 P1-2；P2 角度，AI 在 MODERATE 严格度下已主动引用了学生话语（"在第二轮对话中，面对客户已明确回答的信息..."），但具体到 STRICT 模式时未必稳定。
- 优化方向：在 grading.service 跑 post-process 校验 `comment` 是否包含 ≥1 段对话原文（regex 比对 transcript），否则 retry / 触发降级文案

### P2-2 教师查看对话原文路径较深
- 路径：`/teacher/instances/[id]/insights` → 点学生卡片 → SheetContent 内才看到「对话记录」（`page.tsx:594-617`）
- 体验：教师如果只想"看某学生对话原文"需绕到 insights 页 + 找学生 + 展开侧栏，步骤多
- 优化方向：教师任务详情页 (`/teacher/instances/[id]`) 直接挂"按学生列对话原文"tab，与 insights 平级

### P2-3 客户情绪条仅前端可视，未持久到 submission
- 截图 24：UI 上每轮 mood band 实时变化（HAPPY → NEUTRAL → SKEPTICAL），但 mood 历史只存 `messages[i].mood`，提交后 transcript 持久化的字段里有 mood，教师 insights 页没用这个信号
- 优化方向：教师 insights 可视化"客户情绪轨迹折线"，作为沟通效果定性反馈

### P2-4 AI 上下文记忆良好但 transcript 服务端硬截断 30 轮
- 验证：context spec 中 AI 准确复述第一轮提到的"两个孩子 / 小学+幼儿园"，上下文记忆 OK
- 限制：`app/api/ai/chat/route.ts:16` 服务端 `SERVER_TRIM_RECENT_TURNS=30` + 客户端 `MAX_TRANSCRIPT_ENTRIES=50`。30 轮以上对话 AI 会"忘记"早期信息，未给学生任何提示
- 优化方向：超过 25 轮时返回 meta 字段 `transcriptTrimmed: true`，前端 toast 提示"对话已较长，AI 可能只记得最近 30 轮"

### P2-5 跨班权限未能在 seed 中真实验证
- 现状：seed 数据只有 1 个学生班级，无法构造"A 班学生访问 B 班 sim"。代码上 `assertTaskInstanceReadable` (`lib/auth/resource-access.ts`)、`requireAuth` + `instance.classId` 检查双层把关
- 优化方向：seed 加 2 个班级 + 2 个不同班级的 simulation 实例，便于回归测试

### P2-6 语音输入降级提示不分级
- 截图无直接验证，代码 review：`speech-to-text/route.ts:80-90` 4xx/5xx 不同状态码返回不同中文提示，已较好；但浏览器 SpeechRecognition fallback (`simulation-runner.tsx:1342`) 失败时只有"当前浏览器不支持本地语音识别"通用文案，未告诉学生"可以手动输入"备选
- 优化方向：失败 toast 统一加"或手动输入"备选 CTA

---

## 已修部分回归验证（无回归）

| 改动 | 实测结果 |
|---|---|
| PR#6 role enum 防注入 | chat schema z.enum(["student","ai"]) 生效 |
| PR#6 evaluate guard 只允许教师 | 学生侧 evaluate 路径未触发，学生走 submissions 异步队列 |
| PR#6 thinking-disable | API 调用正常无超时 |
| PR#7 student systemPrompt 403→服务端拉权威 | 学生直接 chat 200 OK，未 403 |
| PR#7 draft key scope userId+preview | localStorage key 形如 `finsim_sim_draft_<uid>_live_<instId>`，恢复正常 |
| a9f042f STT webm→wav | encodeBlobAsWav 逻辑在 simulation-runner.tsx:1138 完整存在 |

## 评分量规配置 / 资产配置编辑器

- 教师 wizard `WizardStepSim` 完整支持：场景 / 开场白 / 核心人设 / 对话风格 / 禁止行为 / 多 requirement / 多 criterion (name+maxPoints+description) / 多 allocation section + items + defaultValue
- 评分量规合计与 totalPoints 不一致时给 warn 提示（`wizard-step-sim.tsx:103`）
- "AI 生成配置" 按钮可调用上下文生成（来自课程章节）

## 审计 / AI 留痕

- `lib/services/ai.service.ts:722, 772, 1189` 三处 `createAiRun` + `finishAiRun` 调用，覆盖 chat / chat-stream / evaluate；记录 model / provider / startedAt / status / output 字段
- `audit.service.ts:13` auditLog 在数据库异常时 console.error 但不阻塞主流程（已防御）

## Overall

模拟对话核心闭环（建设→发布→学生对话→评分→留痕）功能完整，PR#6/#7/STT 修复已稳固。主要短板是 P1-2（评分依据未强制结构化引用原文）和 P1-1/P1-3（建设/学生入口路径需 dashboard 中转）。建议下一迭代优先 P1-2 + P2-1（评分证据结构化）以兑现演示视频"评分依据可见 quote 学生原话"承诺。
