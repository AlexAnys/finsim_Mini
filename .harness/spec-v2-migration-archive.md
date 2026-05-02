# Spec: V2 Migration · 真实应用六轮闭环验证

## 用户原话
> "我将 codex 那个我花时间最多目前最满意的分支放到了 main 吧你原本的 main 分支放到了 backup,同时吧 codex lab 不重要的分支清楚了, 你帮我 review 一遍目前这个调整是否有任何问题, 我意图也保留之前的 harness infra,所以你完整的帮我用真实应用测下,看下目前的 main 主要有哪些问题, 高维帮我总结下"
> "先测 V2 main 的关键闭环，不要先散测页面"
> "建议你先从 第一轮 + 第二轮 开始测"

## Baseline 状态（review 已确认）

- **当前 main HEAD**：`a293e18 chore: port main infra for v2 migration`
- **远端 main HEAD**：`f52ea4b`（origin 还停在旧 main，本轮 deliberately 不 push）
- **backup**：`backup/main-before-v2-20260502 = f52ea4b`，独立 worktree
- **dev server**：3030 端口（PID 49865），`/login` HTTP 200
- **Prisma migrations**：9 个，最新 `20260501031814_add_async_jobs_task_drafts_ai_runs`
- **类型层**：`npx tsc --noEmit` 通过（0 errors）
- **harness infra**：`.claude/agents/` 三角色 + `settings.json` hooks 完整保留

## V2 main 相对旧 main 引入的新模块（需重点验证）

| 类别 | 新文件 |
|---|---|
| Services | `analytics-v2` / `ai-work-assistant` / `ai-tool-settings` / `async-job` / `course-knowledge-source` / `document-ingestion` / `insights` / `task-build-draft` / `task-post` / `weekly-insight` |
| Teacher routes | `/teacher/ai-assistant` / `/teacher/ai-settings` / `/teacher/analytics-v2` |
| API surface | `/api/async-jobs` / `/api/files` / `/api/import-jobs` / `/api/lms` |
| Schema | async jobs / task drafts / AI runs / OCR ingestion / class group rework |

## 六轮闭环 · Acceptance criteria（来自用户原话）

### 第一轮 · 基础可用性（必须先过）
1. ✅ http://localhost:3030/login 渲染正常（V4 Aurora 风格）
2. ✅ teacher1@finsim.edu.cn / password123 登录成功
3. ✅ 左侧导航显示完整：教师仪表盘、课程管理、洞察实验、AI 助手、AI 设置
4. ✅ Logo（灵析 ∞ wordmark）正常显示
5. ✅ 教师仪表盘任务卡上的"测试"按钮 → 进入学生视角 preview，**不应是不可用按钮**

### 第二轮 · AI 服务
1. ✅ 进入 Simulation preview，发消息，AI 客户能回复
2. ✅ 教师仪表盘点"一周洞察" → 能生成，**不报"AI 服务不可用"**
3. ✅ /teacher/ai-assistant 四个工具：教案完善、思政挖掘、搜题解析、试卷检查 各自能跑
4. ✅ /teacher/ai-settings：模拟对话回复、模拟对话批改、Study Buddy、各 AI 工具设置 **分开显示**

### 第三轮 · 课程与任务创建（用户后续会指示）
1. ✅ 课程详情页 5 个 tabs：课程结构 / 任务实例 / 数据分析 / 公告管理 / 上下文素材
2. ✅ 课程结构里新增任务草稿，PDF/AI 草稿生成能跑
3. ✅ 草稿能挂到对应章节、小节、课前/课中/课后
4. ✅ 发布任务后任务实例 tab 只显示当前课程任务（不串其他课程）

### 第四轮 · 学生真实提交
- 账号：alex@qq.com / belle@qq.com / charlie@qq.com / dexter@qq.com，密码 `11`
- 提交 Quiz / Simulation / Subjective 各一次
- ✅ 提交后显示"批改中"
- ✅ AI 批改异步完成
- ✅ 老师端能看到提交、能重试、能发布成绩
- ✅ 学生端成绩页状态正确

### 第五轮 · Analytics V2
- URL：`/teacher/analytics-v2?courseId=e6fc049c-756f-4442-86da-35a6cdbadd6e`
- ✅ 完成率按学生人数算（不按批改数）
- ✅ Quiz / Simulation / Subjective 分开诊断
- ✅ 学生干预清单有意义
- ✅ 无异常大数值、无完成率 > 100%、无空数据误导
- ✅ data quality flag 能提示口径问题

### 第六轮 · 上下文
1. ✅ 教师在课程/章节/任务上传上下文素材
2. ✅ 学生 Study Buddy 提问选课程/章节/任务
3. ✅ 回答能体现任务上下文，显示引用范围
4. ✅ 不同课程/班级不串上下文

## 优先级 / 实施顺序

用户明确："**先从第一轮 + 第二轮开始测。你看到任何问题直接用浏览器批注，我按批注继续修。**"

故本轮 spec 只跑 **R1（基础可用性）+ R2（AI 服务）** = 9 个 acceptance 点。
通过后用户决定是否继续 R3-R6。

## 风险（review 已识别）

1. **本地 main 与 origin/main diverged 25↔6**：用户 deliberately 不 push（HANDOFF 已记录）。这是状态而非 bug，但任何深度修复前先确认 deploy 链路意图（用旧 main 部署？或本地稳后才 push？）。
2. **codex/* 三个分支本地+远端仍存活**（codex/lab / codex/analytics-diagnosis-v2 / codex/analytics-diagnosis-insight-lab-refactor）：内容已并入 main，可在 R1+R2 通过后清理。
3. **AI 服务依赖外部 provider**（qwen/deepseek/gemini）：测试时若 provider key 无效或 quota 满，R2 会假阳性 fail。qa 需在 fail 时区分"代码 bug"vs"provider 问题"。
4. **dashboard "测试"按钮**：用户指出之前可能是不可用状态，重点验证。
5. **/api/healthcheck 404**：v2 没引入这个 endpoint（不影响功能，但 deploy 健康检查若依赖这个会失败，留 R5 后处理）。

## 不做的事

- ❌ 不直接修代码：本 spec 是验证任务，发现问题先汇总给用户，由用户决定优先级再 builder 修
- ❌ 不 push origin/main：用户明确说本轮只切本地
- ❌ 不删 codex/* 分支：等 R1+R2 通过，用户拍板再清

## 报告路径

- qa 报告：`.harness/reports/qa_v2-migration_r1.md`
- progress.tsv 追加一行：`unit=v2-migration / round=R1+R2 / pass-or-fail`

---

# 🔧 BLOCKER 修复 · Q-OPTIONS-RENDER（2026-05-02 R4 暴露）

## 用户原话
（无 — R4 自动暴露，QA 报告 [qa_v2-migration_r4.md](.harness/reports/qa_v2-migration_r4.md) 已诊断到 file:line）

## 现象
所有 Quiz 任务在学生 UI **完全不可用**：
- 4 个选项 label 全显 "."（应该是 "A. xxx" / "B. yyy"）
- Radio button state 永远 unchecked（value=undefined → 全部 fallback 为 "on" 无法区分）
- 提交 payload `selectedOptionIds` 是空（state 永远未设置）

## 根因（QA 已诊断）

数据契约错位：
- DB / API 输出：`options: [{id: "A", text: "管理..."}]`
- Runner 期望（[components/quiz/quiz-runner.tsx:32-44](components/quiz/quiz-runner.tsx)）：`{label, content}`
- Mapping 层 [app/(student)/tasks/[id]/page.tsx:131](app/(student)/tasks/%5Bid%5D/page.tsx) 直接 `options: q.options`，**未做 `{id→label, text→content}` 转换**

后端管道全 OK：API 直接 POST `/api/submissions` 能创建提交并完成 async grading（QA 验证了 alex 的 `ce7f935d` quiz submission）。

## 改动范围（最小 diff）

仅一处 mapping：[app/(student)/tasks/[id]/page.tsx:131](app/(student)/tasks/%5Bid%5D/page.tsx#L131)

```ts
// 当前（broken）
options: q.options,

// 修复
options: Array.isArray(q.options)
  ? q.options.map((o: { id: string; text: string }) => ({ label: o.id, content: o.text }))
  : null,
```

## Acceptance

1. ✅ `npx tsc --noEmit` 0 errors
2. ✅ 浏览器：alex@qq.com / 11 登录 → 进任意 Quiz 任务（如 b7ca71ef "[QA-V2-...] 风险收益基础测验"）→ 4 选项显示 "A. xxx" / "B. yyy" / "C. zzz" / "D. www" 完整文案
3. ✅ Radio button 可选中（点 B → B 高亮）
4. ✅ 提交后 payload 含真实 `selectedOptionIds: ["B"]` 而非 `[]`
5. ✅ 后续 async grading + score 显示走 R4 已验证的管道
6. ✅ 其他类型（subjective/simulation）不受影响（page.tsx 改动只在 quiz 分支内）

## 不做的事（CLAUDE.md anti-regression）

- ❌ **不**改 [components/quiz/quiz-runner.tsx](components/quiz/quiz-runner.tsx)（方案 B 改 Runner 接受 `{id, text}` 风险更大，要 review 提交 payload 兼容性）
- ❌ **不**改其他 mapping（subjective/simulation/scoringCriteria 等已工作的）
- ❌ **不** drive-by refactor 周围代码

## 报告

- builder：`.harness/reports/build_fix-quiz-options_r1.md`
- qa（回归）：`.harness/reports/qa_fix-quiz-options_r1.md` — 仅重测 R4.1 Quiz 学生端到端
- progress.tsv：两行（builder 一行 + qa 一行）unit=`fix-quiz-options`
