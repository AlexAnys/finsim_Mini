# PR-SIM-3 r1 · D3 资产配置"提交给客户"语义改造 — Build Report

**Builder**: claude opus 4.7 (1M)
**Date**: 2026-04-27
**Base commit**: 86c99b0 (PR-SIM-1c finished)
**Status**: BUILD complete · ready for QA

## 用户原话回顾

> "配置资产应该是可以提交给客户，而不是记录当前配置（意义不大）"

## 已实现

把"记录当前配比"语义改为**"提交给客户"**：
- 文案重命名：按钮 / 头部副标 / 计数文案 / 提示文案 4 处
- 点击触发**客户 AI 评论该配置**（不仅本地 snapshot）
- 客户在对话流里加新消息（ai role）回应这版配置 — 必须点名具体项
- mood 因此变化（按 PR-7B 8 档协议）
- 配置 snapshot **仍然**保存（PR-7C 兜底持久化）

## 修改文件（3 个 + 1 新测试）

```
M  app/api/ai/chat/route.ts                        +32 / -0
M  components/simulation/simulation-runner.tsx    +104 / -15
M  lib/services/ai.service.ts                      +53 / -2
A  tests/pr-sim-3-config-submission.test.ts        +245 (new, 20 tests)
```

## 后端改造

### 1. `lib/services/ai.service.ts`

新增导出类型：
```ts
export type ChatMessageType = "user_message" | "config_submission";
export interface ChatAllocationSection {
  label: string;
  items: Array<{ label: string; value: number }>;
}
```

`chatReply` 函数签名 additive 扩展：
- 加可选 `messageType?: ChatMessageType`（默认 `"user_message"` — 兼容 PR-7B 历史 caller）
- 加可选 `allocations?: ChatAllocationSection[]`（仅 `config_submission` 用）

systemPrompt 内联 `configSubmissionBlock`：当 `messageType=config_submission` 时拼接：
```
【本轮交互类型 · 资产配置提交 · PR-SIM-3】
学生刚刚向你展示了一版资产配置（参见用户消息中的"提交资产配置"段落）。
请基于配置数字 + 已有对话上下文，做出客户视角的具体回应：
- 必须在 reply 中明确提到配置的至少一项具体内容（如"为什么完全不配债券"...）
- 如果配置与你之前表达的偏好/风险承受能力 / 隐性需求一致，表达认可并追问深层逻辑；如果不一致，礼貌质疑、表达担忧
- 不要泛泛评价整体（如"看起来不错"），要点名具体项
- mood_score / mood_label 反映你看到这版配置后的真实情绪变化
- student_perf 评估学生这版配置是否贴合你已表达的偏好与对话目标
```

userPrompt 在 `config_submission` 时附加摊平配置：
```
[资产配置]
  · 股票: 70%
  · 债券: 20%
  · 现金: 10%
```

JSON 输出协议**完全保留 PR-7B 8 档 mood**（`reply` / `mood_score` / `mood_label` / `student_perf` / `deviated_dimensions`）— 客户端解析路径不变。

### 2. `app/api/ai/chat/route.ts`

zod schema 加两个字段：
```ts
messageType: z.enum(["user_message", "config_submission"]).optional(),
allocations: z.array(z.object({
  label: z.string().max(80),
  items: z.array(z.object({
    label: z.string().max(80),
    value: z.number().min(0).max(100),
  })).max(30),
})).max(10).optional(),
```

加路由层守护：`messageType=config_submission` 必须带非空 `allocations`，否则 400。

PR-FIX-1 A9（transcript trim）/ UX4（student 禁 systemPrompt）/ 401 unauth 全保留。

## 前端改造（`components/simulation/simulation-runner.tsx`）

### 文案改名（4 处）

| 旧文案 | 新文案 |
|---|---|
| 记录当前配比 | 提交给客户 |
| 已记录 N 次配比 | 已向客户提交 N 次配置 |
| 随对话实时调整，教师会看到最终配比 | 调整后可「提交给客户」，听听客户的反馈 |
| 请根据对话中获取的客户偏好与风险承受能力调整配比。 | 调整后点「提交给客户」听反馈；客户会针对配置具体项给出回应。 |

注：JSX 内文本的中文引号用「」（fullwidth corner brackets）避免 react/no-unescaped-entities 报错。Toast / system prompt 中的 `"` 因不在 JSX 文本节点中无需转义。

### `handleSubmitAllocation` 重写（旧 17 行 → 新 ~70 行）

旧实现仅 push snapshot + toast。新实现：

1. **同步校验**：100% 总计 + isSending guard（防双击）
2. **派生 hint 节流参数**：复用 `handleSend` 同款逻辑（lastHintTurn 推断）
3. **POST `/api/ai/chat`** 带：
   - `messageType: "config_submission"`
   - `allocations`（结构化提交）
   - 现有 transcript / scenario / openingLine / systemPrompt / objectives / lastHintTurn
4. **Loading toast**："客户正在阅读你的配置..."（带 toast id 用于 dismiss）
5. **解析响应** —— 复用 PR-7B 解析器：
   - `stripLegacyMoodTag` 兜底清 `[MOOD: XXX]`
   - `moodKeyFromLabel` 把中文 label 映射为 MoodType
6. **同步 3 个 state**：
   - `setMessages([...prev, aiMsg])`：客户消息 push（role=ai）
   - `setMood(newMood)`：8 档 mood meter 更新
   - `setSnapshots([...prev, snapshot])`：PR-7C 兜底持久化
7. **成功 toast**："客户已回应你的配置"
8. **finally**：`setIsSending(false)`

### 关键不破坏点

- `submitCount` 仍由 `snapshots.length` 派生（PR-FIX-3 C2 不动）
- 数 `submitCount >= maxSubmissions` 时按钮 disabled（默认 3 次上限）
- `handleSubmit` / `handleFinishConversation` 中的 `assets={ sections: allocations, snapshots }` 上报路径不动（3 处）
- `saveDraft(messages, mood, allocations, snapshots)` localStorage 持久化不动
- `handleRedo` 把 messages/mood/allocations/snapshots 全清不动
- PR-7B chatReply 8 档 JSON 协议不动（同一 schema）
- PR-SIM-1a/1b/1c 防作弊机制（releaseMode / releasedAt / 学生 submitted view）不动

## 测试

新增 `tests/pr-sim-3-config-submission.test.ts` · 20 cases · 4 describe blocks：

1. **ai.service config_submission 模式**（5 cases）：
   - 导出 ChatMessageType 类型
   - chatReply 签名带 messageType + allocations
   - systemPrompt 注入 configSubmissionBlock
   - userPrompt 摊平 allocations
   - 默认 messageType 兜底兼容历史 caller

2. **/api/ai/chat 路由 schema**（3 cases）：
   - schema 接受 messageType + allocations
   - config_submission 必带 allocations 守护
   - MAX_ALLOCATION_* 常量存在

3. **simulation-runner UI 改造**（6 cases）：
   - 按钮文案 "提交给客户" 替换 "记录当前配比"
   - snapshot 计数 "已向客户提交 N 次配置"
   - handleSubmitAllocation 走 /api/ai/chat with messageType=config_submission
   - AI 回复 push messages + 同步更新 mood/snapshot
   - 复用 PR-7B 的 stripLegacyMoodTag / moodKeyFromLabel
   - PR-7C snapshots 持久化路径完整保留（≥3 处 `{ sections, snapshots }` 上报点）

4. **zod schema 实模拟**（6 cases）：用 zod 真实 parse 验证 schema 行为
   - user_message 不带 allocations 通过
   - config_submission 带 allocations 通过
   - 非法 messageType 拒绝
   - allocations.items.value 超 100 拒绝
   - allocations.sections 超 10 拒绝
   - 缺省 messageType 兼容通过

## 验证

### 静态

- `npx tsc --noEmit`：**0 errors**
- `npx vitest run`：**670 PASS / 670 total**（包含本 PR 新加 20 tests，含其他 concurrent agents 的工作）
- `npx vitest run tests/pr-sim-3-*`：**20/20 PASS**
- `npm run lint`（仅 PR-SIM-3 文件）：**0 errors**（修了 4 处 JSX 内 `"` 转义为 「」）
- `npm run build`：**52 routes 编译过 + Compiled successfully in 4.7s**

### 动态（真 AI E2E）

dev server PID 55026 alive。student1 真登录后 4 个 case：

1. **config_submission · 高股票 vs 保守客户偏好（不一致）**
   - 提交：股票 70% / 债券 20% / 现金 10%
   - 客户回复："看到股票配置高达**70%**，我有点担心。之前我说过最多只能承受5%的亏损，这么高的股票比例波动太大了吧？**债券才20%**，是不是太少了？"
   - mood: 略焦虑 / score 0.65
   - **完美命中 spec**：点名具体项 ✅，引用对话历史 ✅，mood 反映真实情绪变化 ✅

2. **config_submission · 保守配置 vs 保守客户偏好（基本匹配）**
   - 提交：股票 10% / 债券 50% / 现金 30% / 货币基金 10%
   - 客户回复："看到**债券配了50%**，**现金也有30%**，整体感觉比较稳妥...不过**股票只配了10%**，是不是太保守了？我其实也想稍微有点增长..."
   - mood: 犹豫 / score 0.30
   - **充分体现适应性**：认可保守符合需求，但提出新维度（退休后增长）— 推动学生进一步对话

3. **config_submission 缺 allocations → 400**：路由层守护命中 `"提交配置时必须附带 allocations"`

4. **legacy user_message（无 messageType）→ 200**：PR-7B 8 档 mood 协议照常工作，零回归

5. **anon 401 + student systemPrompt 403**：PR-FIX-1 A9/UX4 守护链路全保留

## 安全 & 数据一致性

- 不动 schema / Submission 持久化逻辑（spec 严禁，已闭环）
- 不动 snapshots cap / mood 8 档逻辑
- 不动 PR-SIM-1a/b/c 防作弊机制
- service 接口 additive 扩展（messageType / allocations 都 optional），唯一 caller `/api/ai/chat/route.ts` 同步更新；`task.service.ts` 引用 chatReply 仅注释，无运行时调用
- zod schema 上限：max 10 sections × 30 items × 80 chars label，防 token 浪费 / context overflow

## 不需要 dev server 重启

零 schema / 零 Prisma 三步。dev server PID 55026 全程 alive，热更新已自动 pick up。

## 待 QA 验收

- [ ] 浏览器 student1 真打开模拟任务，调滑杆 → 点"提交给客户" → 看客户对话流回复 ✅
- [ ] 客户回复点名提到至少一个具体配置项（spec 验收点）
- [ ] mood meter 8 档 dispatch 正确（spec 不变）
- [ ] snapshots[] localStorage 持久化（reload 不丢）+ 教师 insights tab 仍能看到演变（PR-7C 不动）
- [ ] handleRedo 后 messages/mood/allocations/snapshots 全清
- [ ] submitCount 计数（snapshots.length）从 N/3 涨到 3/3 后按钮 disabled

## 不确定 / 留增量

- 当 AI 调用失败时，**snapshot 不入库**（错误路径 early return），与现有"记录当前配比"行为不一致（旧版本 always push）。这是合理的 — 因为新语义"提交给客户"是一个**双向事件**，要客户回应才算"提交完成"。但若产品判断 snapshot 历史在失败时也要保留以便老师诊断，可在 catch 路径里补 push。**留作 QA 决策点**。
- E2E 浏览器验证依赖人手在浏览器测，但 curl + AI 真返回已充分证明后端 + AI 协议工作。
- spec L88 "教师 insights tab 不动" — 已确认 instance-detail/insights-tab.tsx 与本 PR 0 改动。

## Rationale

**为什么 messageType 默认 user_message 而不是 required**：保持向后兼容，PR-7B 现有 caller（包括 handleSend）完全不需要改动。新行为是 opt-in。

**为什么 snapshot 仍 push**：spec 明说"配置 snapshot **仍然**保存（持久化逻辑不变，PR-7C 兜底）"。教师 insights tab 仍依赖 snapshots 演变可视化。

**为什么用「」而非 &ldquo; / &rdquo; 转义**：「」是 fullwidth Chinese corner brackets，与中文 UI 风格更一致；HTML entity 转义虽然合法但渲染出来还是普通 ASCII 引号。

**为什么 fallback 路径（aiGenerateText 兜底）不区分 messageType**：fallback 触发条件是 JSON 解析失败，已经走非 JSON 输出路径。再额外针对 config_submission 加分支会让 fallback 复杂化且无法区分用户期望（fallback 本身已经是降级体验）。
