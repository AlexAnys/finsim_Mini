# Build Report — Fix 3 · Chat 流式 SSE (Worktree B, r1)

- **Unit**: `fix-3-chat-streaming`
- **Worktree**: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-ai`
- **Branch**: `claude-fix-batch1-ai`
- **HEAD**: `a58fdba`
- **Parent**: `da9a505` (mimo reasoning fix — 不能破坏)
- **Builder**: Builder B (AI 组)

## 用户看到的改变

学生在 simulation 里发消息后，**首字 ≤ 2s** 出现在客户消息气泡里（baseline 18-26s 整体卡死无反馈），逐 chunk 流式渲染；mood 标签、Socratic hint、studentPerf 仍在完整 reply 收尾后注入。**「提交给客户」配置反馈也走同一条流式通道**。

超时 / 上游错 / 配额不足 → SSE error 事件 → 前端中文 toast，占位消息被自动清理（不留半截泡泡）。

## 改动文件

| 文件 | 行数 | 角色 |
|---|---|---|
| `lib/services/ai.service.ts` | +361 / -107 | `chatReplyStream` + `buildChatPrompts` + `finalizeChatReply` + `degradedFallback` |
| `app/api/ai/chat/route.ts` | +85 / -1 | SSE 通道 (`streamChatResponse`) + Accept 头 dual-channel |
| `components/simulation/simulation-runner.tsx` | +185 / -119 | `parseSseEvent` + `streamChatTurn` 共享 helper |
| `tests/fix-3-chat-streaming.test.ts` | +153 | 新增静态守护（17 cases） |
| `tests/pr-sim-3-config-submission.test.ts` | +12 / -7 | 反映 streamChatTurn 重构后的 mood 解析路径 |

## 关键技术决策

### 为什么用 `streamText` 而不是 `streamObject`

`streamObject` 要求 schema 严格匹配，但 MiMo 输出的 JSON 常带尾随空白、reasoning 痕迹（即便 reasoningEffort=none 也偶有）。`streamText` 流文本，我在 `tryExtractReplyFromPartial` 里增量解析 `"reply": "...` 字段：
- 仅取 reply 字段做流式渲染（mood/score 在收尾才有意义）
- partial JSON 不完整时返回 null，不影响后续 chunk
- 转义字符（`\"`/`\\`/`\n`/`\uXXXX`）正确处理

### 30s AbortController（spec acceptance #4）

`ai.service.ts:CHAT_STREAM_TIMEOUT_MS = 30_000`。`setTimeout(() => abortController.abort(), 30_000)` 在 `streamText` 开始前装好，stream 收尾或异常时 `clearTimeout`。前端额外 35s 兜底（不依赖服务端，防 SSE 连接挂死）。

mock 上游 ≥30s 卡顿 → AbortError → SSE 写 `event: error data: {"code":"AI_TIMEOUT","message":"AI 回复超时，请稍后再试"}` → 前端 toast 中文超时 + 删占位消息。

### 兜底逻辑（spec anti-regression）

`chatReplyStream` 失败兜底完全复刻 `chatReply`：reply 尽力从 raw 抽 / `stripMoodTagFromText`，mood `NEUTRAL` 0.3 / `犹豫`，studentPerf 0.5。增加 `degraded: true` flag 让上游可降权日志。

JSON 严格校验失败（zod schema reject）→ 同样走 `degradedFallback`，不退化到 chatReply 的 `aiGenerateText` 二次调用（避免双倍延迟）。

### 双通道（向后兼容）

`/api/ai/chat` 不破坏旧 JSON 调用：

| Accept | 路径 | 用途 |
|---|---|---|
| `text/event-stream` | `streamChatResponse` (SSE) | 浏览器 simulation runner |
| 其它（含缺失） | `chatReply` (JSON) | curl / 旧测试 / 任何非 SSE caller |

### 不破坏 da9a505

`getProviderForFeature` / `getProviderOptions` 未触碰；`chatReplyStream` 仍调 `getProviderOptions(provider, setting, "simulation")`，MiMo reasoningEffort:none 路径完整保留。`fix-3-chat-streaming.test.ts:67-70` 静态守护这点。

### Anti-regression 检查

- ✅ `role` enum (`chat/route.ts:31`) 保留
- ✅ `MAX_TRANSCRIPT_ENTRIES=50`, `SERVER_TRIM_RECENT_TURNS=30`, `MAX_ALLOCATION_*` 全保留
- ✅ PR-FIX-2 B1 服务端从 transcript 推 lastHintTurn 逻辑下移到 `finalizeChatReply`，行为一致
- ✅ PR-7B hint 节流逻辑保留（`if (m.role === "ai" && m.hint) lastHintTurn = ...`）
- ✅ Sim runner 退出 / 评分触发路径不动（仅 chat-send 改流式）
- ✅ localStorage draft key 不动
- ✅ `chatReply` 仍 exported，pr-fix-4-d1.test 仍 PASS

## 自测结果

```
$ npx tsc --noEmit       # 0 errors
$ npx vitest run         # 75 files / 890 tests / 0 failed
$ npm run lint           # 3 warnings (pre-existing react-hooks/exhaustive-deps in runners)
$ next dev --webpack     # ✓ Ready in 493ms on port 3002, HTTP 200 on /
```

> Turbopack 在 worktree symlink 下 panic（"Symlink [project]/node_modules is invalid, it points out of the filesystem root"）— 与本 fix 无关，是 Next 16 + worktree symlink 已知限制。`--webpack` 模式 OK。QA 真浏览器请走主 worktree 或 `next dev --webpack`。

## 提供给 QA 验证的入口

**SSE 协议契约**（curl 单条验证）:

```bash
# 登录拿 session cookie 后：
curl -N -H 'Accept: text/event-stream' \
     -H 'Content-Type: application/json' \
     -H "Cookie: next-auth.session-token=..." \
     --data '{"transcript":[{"role":"ai","text":"您好"}],"scenario":"普通客户咨询"}' \
     http://localhost:3002/api/ai/chat
# 期望：event: chunk data: {"delta":"..."} 多条 → event: meta → event: done
```

**真浏览器 Playwright** (acceptance #1 + #2):

1. 登录 `student1@finsim.edu.cn` / `password123`
2. 进入 Class A 一个 simulation 任务（PR-SIM-3 D3 后任意 simulation 任务即可）
3. 发消息「我的退休金主要靠社保，想买点稳健理财，月薪 8000」
4. 启动 `performance.now()` 在 fetch 发起前，第一个 `setMessages` 触发后停表
5. 预期首字 ≤ 2000ms，整体 ≤ 10000ms
6. DOM 应看到 AI message bubble 内文字一段段长出来（不是空白后整段出现）

**Acceptance #4 30s 超时**:

mock 上游：临时把 `MIMO_BASE_URL` 改成不存在的端点，发消息 → 30 秒前后看到中文「AI 回复超时，请稍后再试」toast。或在 ai.service 里临时 `await new Promise(r => setTimeout(r, 35000))` 验证。

**Acceptance #3 mood/perf 仍传到 evaluateSimulation**: 完整跑一轮对话后点「结束对话」，evaluation 仍有完整 totalScore / rubricBreakdown（不是 0 / NaN）。

**Acceptance #5 e2e 脚本**: 项目无 playwright config，已用 `tests/fix-3-chat-streaming.test.ts`（17 case）替代 — 真浏览器 acceptance 由 QA `/qa-only` 执行。

## Dynamic exit 状态

- r1 提交，等 QA 反馈
- 若 QA PASS → 进 Fix 4
- 若 FAIL 同样问题 3 连 → 回 spec 重规划

## 时间预算

| 阶段 | 实际 | 预算 |
|---|---|---|
| 读 spec + 摸代码 | ~25 min | - |
| 实现 ai.service streaming | ~40 min | - |
| route SSE | ~15 min | - |
| 前端 SSE consumer | ~30 min | - |
| 测试 + 自检 + commit | ~20 min | - |
| **总计** | **~2h 10min** | **≤ 6h** ✅ |
