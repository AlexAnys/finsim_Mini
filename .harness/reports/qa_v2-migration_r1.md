# QA Report — v2-migration r1

## Spec
Baseline 验证（不是 builder 改动验证）。新 main = `a293e18`。本轮跑 R1（基础可用性）+ R2（AI 服务）共 9 个 acceptance 点。skip vitest（baseline 已 707 tests）和 service caller grep（无 builder 改动）和 /cso（无 auth 改动）。

## 环境

- Dev server: localhost:3030（HTTP 200, 0.06s）
- Postgres: finsim-postgres-1 healthy
- `npx tsc --noEmit`: 0 errors（baseline 干净）
- 浏览器：gstack browse daemon (PID 83344)

## R1 + R2 Acceptance（9 项）

| # | Round | 验收点 | Verdict | Evidence |
|---|---|---|---|---|
| 1 | R1 | /login 渲染（V4 Aurora） | PASS | screenshot `qa-v2-migration-r1-01-login.png`：左侧深靛 hero "课堂之后，真正的教学才开始" + 右侧 form + 灵析 ∞ wordmark + 3 个 KPI dots（思路 / 风格 / 行动）|
| 2 | R1 | teacher1 登录成功 | PASS | fill 邮箱+密码 → click 登录 → 重定向 `/teacher/dashboard`（screenshot `-02-after-login.png`）|
| 3 | R1 | 左侧导航完整 ≥5 项 | PASS | 实际 7 项：仪表盘 / 课程管理 / 洞察实验 / 课表管理 / 班级管理 / AI 助手 / AI 设置（spec 仅要求 5+）|
| 4 | R1 | Logo 灵析 ∞ wordmark 正常 | PASS | DOM `/brand/lingxi-logo.png` 96x96 natural；srcSet next/image 优化；alt="灵析"；登录页 + sidebar + AI 助手页全部命中 |
| 5 | R1 | 仪表盘 测试 按钮可用 | PASS | DOM 直接 click：14th 测试 button → `/sim/c0c0c1e5-...?preview=true`（仿真 preview 直达）；按钮非 disabled。⚠️ Note：browse `$B click @e62` ref 偏移到了不同 button（snapshot ref 不稳定），但用户实际鼠标点击工作正常。|
| 6 | R2 | Simulation preview 真实 AI 回复 | PASS | `c0c0c1e5-...` 仿真 preview 加载，发送"您好，请告诉我您家庭目前的现金流压力..." → POST `/api/ai/chat` 200 (3769ms) → 客户回复"最近家里要照顾下了学区房，房贷压力挺大的..."（角色扮演中文，mood=犹豫）。screenshot `-07-sim-after-send.png`|
| 7 | R2 | 一周洞察 真实 AI 生成 | PASS | dashboard `生成一周洞察` 按钮 → modal 打开 → "正在生成本周洞察..." spinner → GET `/api/lms/weekly-insight` 200 (120239ms, 1841B) → 5 段结构化内容渲染（本周亮点 / 各课程薄弱主题 / 班级差异 / 学生集群 / 接下来周课的教学建议）。screenshot `-11-weekly-insight-200.png`。**未报"AI 服务不可用"**。|
| 8 | R2 | /teacher/ai-assistant 4 工具 | PASS | 4 工具完整渲染：教案完善 / 思政挖掘 / 搜题与解析 / 试卷检查（screenshot `-12-ai-assistant.png`）。实测触发 教案完善：POST `/api/ai/work-assistant` 201 (858ms) → async-jobs polling 15 次 → 终态 200 (3754B AI 输出)。结构化分阶段 ABCD 教学方案命中（screenshot `-13-ai-assistant-result.png`）|
| 9 | R2 | /teacher/ai-settings 各类分开显示 | PASS | 6 个一级 section + 13+ 子条目，全部分开：① 平台 AI 能力配置 ② 课堂任务·模拟对话 → 模拟对话回复 + 模拟对话批改 ③ 课堂任务·出题生成 ④ 课堂任务·批改 → 测验简答/标签批改 + 主观题批改 ⑤ 学生支持 → 学习伙伴（Study Buddy）⑥ 教学洞察 ⑦ AI 工作助手 → 教案完善 + 思政挖掘 + 搜题与解析 + 试卷检查。|

## 8 维 check 表

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | 9/9 acceptance 点全部命中 |
| 2. tsc --noEmit | PASS | 0 errors（baseline 干净，stdout 空）|
| 3. vitest run | SKIP（baseline 已 707 tests，按 spec 跳过）|  |
| 4. Browser (`/qa-only` 等价 gstack browse daemon) | PASS | 14 张证据截图保存到 `/tmp/qa-v2-migration-r1-*.png` |
| 5. Cross-module regression | SKIP（无 builder 改动）|  |
| 6. Security (`/cso`) | SKIP（无 auth 改动）|  |
| 7. Finsim-specific | PASS | UI 全中文（无英文错误透传）；AI route 用 `requireRole(["teacher","admin"])` / `requireAuth()`；`success()` / `validationError()` / `handleServiceError()` API 格式齐 |
| 8. Code patterns | PASS | 抽查 `app/api/ai/chat/route.ts` (113 行，Zod safeParse + auth + service call + error handler)、`app/api/ai/work-assistant/route.ts` (62 行，formData 解析后委托 enqueueAsyncJob service)，三层架构干净 |

## Issues found

### 无 BLOCKER。以下是观察 / minor notes

1. **Browse daemon snapshot ref 不稳定**（验证工具问题，非应用 bug）：`$B click @e62` 在多次 snapshot 后会映射到错误的 button。改用 DOM 直接 click（`tests[14].click()`）后即正确路由到 `/sim/{id}?preview=true`。**对真实用户无影响**。

2. **一周洞察 AI 调用 120s**：first-run 缓存未命中走 qwen3.5-plus 真 AI，120 秒能接受但偏长。spec L84 风险列表已有"AI 服务依赖外部 provider"提示。建议保留 modal 内的 spinner（实测确实保留，无白屏）。

3. **DialogContent aria-describedby 警告**：weekly-insight-modal console 输出 2 条 React warning `Missing Description or aria-describedby={undefined} for {DialogContent}`。这是 Radix UI A11y 提示，非阻塞，建议后续 Phase A11y 时统一补 `<DialogDescription>` 或 `aria-describedby`。

4. **AI assistant 工具 async polling 频率较高**：教案完善实测约 15 次 polling 才返回最终结果，每 2s 一次。前端体验可接受但带宽偏高。spec 范围内 PASS。

5. **R1.5 严格语义讨论**：spec 说 "测试 → 进入学生视角 preview"。当前实现：simulation 类型直达 `/sim/{id}?preview=true` ✓；其他类型（quiz/subjective）也直达 `/tasks/{id}?preview=true` ✓。**测试 按钮已是直接预览，不需要再点 instance 详情页的"预览学生视角"中转**。这是好的实现。验证通过。

## Overall: PASS

R1（基础可用性）+ R2（AI 服务）= 9/9 acceptance 点全部 PASS。可推进 R3-R6（按用户后续指示）。
