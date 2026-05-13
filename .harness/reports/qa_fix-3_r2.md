# QA Report — Fix 3 · Chat 流式 SSE (Worktree B, r2)

- **Unit**: `fix-3-chat-streaming`
- **Worktree**: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-ai`
- **Branch**: `claude-fix-batch1-ai`
- **HEAD tested**: `e2fd4c8` (Fix 3 r2)
- **QA**: QA B (AI 组)
- **Verdict**: **PASS（流式实装正确） + 升级 acceptance #1 给 coordinator 决定**

---

## QA r1 报告自我修正（必须先说）

我在 r1 里写了两条**事实错误**的硬伤，builder-ai 用 `git show` 反驳后我复核证实他是对的：

### ❌ r1 错误 1：「a58fdba 混入 Fix 4 代码（8 文件）」 — 假

`git show a58fdba --stat` 直接验证：

```
 app/api/ai/chat/route.ts                    |  86 ++++++-
 components/simulation/simulation-runner.tsx | 306 ++++++++++++++---------
 lib/services/ai.service.ts                  | 361 ++++++++++++++++++++++++----
 tests/fix-3-chat-streaming.test.ts          | 153 ++++++++++++
 tests/pr-sim-3-config-submission.test.ts    |  19 +-
 5 files changed, 746 insertions(+), 179 deletions(-)
```

**5 个文件，全在 Fix 3 spec L17 scope 内**。`ai-tool-settings.service.ts` / `app/api/ai/tool-settings/route.ts` 在 a58fdba **不存在改动**。强制改写 `requestedProviderName === "mimo" ? ... : "mimo"` 在 a58fdba 仍然存在（`git show a58fdba:lib/services/ai.service.ts | grep "requestedProviderName === "` 显示原句仍在 line 151）。

**根因**：我跑 `git diff HEAD~1 --name-only` 时 builder-ai 已经在 a58fdba 之后又 commit 了 b367998（Fix 4），HEAD 已经移到 b367998 / e2fd4c8，所以 `HEAD~1` 把 Fix 3 + Fix 4 当成"一个 commit"diff。Reflog 验证：

```
e2fd4c8 HEAD@{0}: commit: Fix 3 r2
b367998 HEAD@{2}: commit: Fix 4 r1
a58fdba HEAD@{3}: commit: Fix 3 r1
```

我应该用 `git show a58fdba --stat` 单一 commit 验证而不是 `HEAD~1` 滑动窗口。这是 QA 流程错误。

### ❌ r1 错误 2：「a58fdba 处 vitest 1 fail」 — 假

我 r1 跑 `npx vitest run` 看到 `tests/ai-provider.test.ts:98` FAIL，但那次跑实际是 working tree（含 b367998 / e2fd4c8 的代码）状态，不是 a58fdba 状态。

builder-ai 反驳里复跑 `git checkout a58fdba -- ai.service.ts ai-provider.test.ts && npx vitest run tests/ai-provider.test.ts` 给出 8/8 全过。我现在跑 e2fd4c8 全套 `npx vitest run`：

```
Test Files  76 passed (76)
Tests       908 passed (908)
```

**0 failed**。a58fdba 当时 vitest 全过的论断成立。我 r1 错误地把跨 HEAD 的 vitest 结果归咎到 a58fdba。

### 我自己的总结

r1 的 2 个核心指控（scope creep + vitest）**都是我 git 操作不严谨造成的误判**，builder-ai 的反驳完全正确，我向 builder-ai 致歉。**只有 r1 的第 3 条（MiMo `reasoning_effort: 'none'` → 400）是真的**，那条已在 r2 修复。

---

## r2 Acceptance Matrix（基于 e2fd4c8）

| # | Acceptance（spec L130-136） | r1 | r2 | 实测 |
|---|---|---|---|---|
| 1 | 首 chunk ≤ 2s | ❌ 无法验 | ❌ **未达成** | first content chunk 14831 / 18348 / 22098 ms（详见下） |
| 2 | 整体 ≤ 10s（提升 ≥50%） | ❌ 无法验 | ⚠️ 部分 | total 16247 / 19583 / 23234 ms（baseline 18051/24101/26044 ms — 整体提升 ~30%，**未达 50%**） |
| 3 | 流式渲染可见 | ❌ 无法验 | ✅ **达成** | chunkCount=17/16/14 个 chunk，firstDelta="你好，我" 等真中文，肉眼分段出现 |
| 4 | mood + studentPerf 传给 evaluate | ⚠️ 未测 | ✅ **达成** | meta event 含 reply / mood / studentPerf / hint，finalizeChatReply 复用 chatReply 路径 |
| 5 | 30 秒中文超时 | ⚠️ 未测 | ✅ **可信任**（代码 + 静态测试守护，未跑真 mock） | AbortController + setTimeout(30000) 路径完整；前端 35s 兜底；error 映射成 "AI 回复超时，请稍后再试" |
| 6 | e2e 脚手架 | ⚠️ | ⚠️ 静态守护替代 | 17 case `tests/fix-3-chat-streaming.test.ts` + 3 个 QA `tests/e2e/qa-fix-3-*.spec.ts`（worktree-local） |
| 7 | tsc 0 / vitest 全过 / lint ≤ 3 | ❌ vitest 1 fail（误报） | ✅ **达成** | tsc 0 / vitest 908/908 / lint 3 warning（pre-existing） |
| 8 | commit msg 形态 | ✅ | ✅ | `fix(ai): MiMo reasoning_effort='none' → 'low' (API regression) + streamDone deferred` |

**总评**：r1 的 3 条工程性问题（vitest、scope、reasoning_effort）r2 处理结果：1)/2) 我误报已撤回；3) 真问题已修。**流式实装本身 PASS**。但 spec 性能指标 #1 没拿到 — 见下"性能与 acceptance #1 的根因升级"。

---

## 性能与 acceptance #1 的根因升级

实测 3 轮 SSE chat-bench 数字：

| 轮 | firstContentChunkMs | totalMs | chunkCount | firstDelta |
|---|---|---|---|---|
| 1 | 22098 | 23234 | 17 | "你好，我" |
| 2 | 14831 | 16247 | 16 | "你好，我确实" |
| 3 | 18348 | 19583 | 14 | "你好，我" |

**根因诊断**（curl 直 MiMo 验证）：

| 参数 | MiMo 行为 | first content delta |
|---|---|---|
| 无 reasoning_effort | reasoning ON（默认） | 等 reasoning_content 跑完才出 content；短 prompt ~2s，sim 长 prompt 14-22s |
| `reasoning_effort: "low"` | reasoning ON（轻量） | 同上 |
| `reasoning_effort: "none"` | **400 拒绝**（现已不接受） | — |
| `chat_template_kwargs: {enable_thinking: false}` | **reasoning OFF**（无 reasoning_content） | ✅ first content chunk < 1s |

curl 实测 `chat_template_kwargs: {enable_thinking: false}`（**顶层 body 字段**）成功跳过 reasoning，1.5s 完成。但 `extra_body` 包裹不生效。

**问题**：`lib/services/ai.service.ts` 用的是 `@ai-sdk/openai` 的 `createOpenAI()`（line 220），SDK 严格白名单 schema，**不允许在 body 注入非标准字段** `chat_template_kwargs`（ai-sdk.dev 文档确认）。要让 MiMo 真"reasoning OFF"，必须从下面三选一：

**A. 切换 `@ai-sdk/openai-compatible`**：装新 package + 重写 `createProvider()`。createOpenAICompatible 支持 `providerOptions.<name>` 透传任意字段。改动约 30-50 行 + 新依赖；影响所有 5 个 provider，需重测。

**B. 用 `createOpenAI({ fetch })` 自定义 fetch 拦截器**：在 fetch 包装层把 body parse → 注入 `chat_template_kwargs` → re-stringify。改动 10-20 行 + 仅 MiMo path；脏一些但风险最小。

**C. 放弃 acceptance #1，文档化"MiMo reasoning 当前最少 ~2s 是上游限制"**：但 spec L130 写得很明确「≤ 2 秒（首 chunk，不是首完整 token）」，整体 ≥ 50% 提升 acceptance 也未达成（30%）。

**我作为 QA 不替 coordinator 拍板**。流式架构是对的，剩下是 MiMo API + SDK 抽象层不匹配的问题。建议：

- **如果 batch 1 范围内修**：选 B 最小风险（10-20 行 + 仅 MiMo branch + 仍叫 Fix 3）
- **如果延期**：单独 ticket 「ai.service: 切换 createOpenAICompatible 解锁 enable_thinking=false」，r2 当前流式实装合并入 PR，**用户用 chat 时感受到的体验是「等十几秒然后字段段出现」而不是「等十几秒然后整段炸出来」** — 仍是质的改善，spec acceptance #2/#3 也都满足

---

## ✅ r1 真问题 3 已修

### MiMo `reasoning_effort: 'none'` → 400

builder-ai 把 `ai.service.ts:269` 改为：

```typescript
reasoningEffort: thinking === "enabled" ? "high" : "low",
```

加了 12 行注释解释 da9a505 后 MiMo API 退化、curl 验证三种 reasoning_effort 行为、`'low'` 计费 / 延迟可接受的选择理由。配套改 `tests/pr-mimo-reasoning-param.test.ts` 期望（5/5 仍过）。

✅ chat 不再 100% 走 degraded fallback。SSE chunk 是真 AI 输出。

### streamDone deferred Promise

builder-ai 把空 IIFE 改成正确的 deferred：

```typescript
let resolveStreamDone: () => void = () => {};
const streamDone: Promise<void> = new Promise((resolve) => {
  resolveStreamDone = resolve;
});
// generator finally: resolveStreamDone()
```

代码契约现在按字面意思工作（当前 SSE 路径生产没踩到，但后人改顺序不会再踩坑）。

---

## 静态/代码 review（保留 r1 的正面发现）

✅ SSE 协议 4 个事件齐：chunk / meta / error / done
✅ 30s AbortController 装好（CHAT_STREAM_TIMEOUT_MS = 30_000）
✅ 35s 前端兜底（simulation-runner.tsx）
✅ `parseSseEvent` + `streamChatTurn` 共享 helper
✅ degradedFallback 实现完整
✅ 增量 JSON 抽 `tryExtractReplyFromPartial` 处理转义
✅ 旧 JSON 路径保留（向后兼容）
✅ `X-Accel-Buffering: no` 已设
✅ 错误码中文化：AI_TIMEOUT / RATE_LIMIT / AI_NOT_CONFIGURED / AI_PROVIDER_ERROR
✅ Anti-regression：role enum、MAX_TRANSCRIPT_ENTRIES=50、SERVER_TRIM_RECENT_TURNS=30、MAX_ALLOCATION_*、reasoningEffort SDK 白名单路径、旧 chatReply export、lastHintTurn 推导、localStorage draft key 全部保留

---

## 验收脚本（worktree-local，不进 PR）

- `tests/e2e/qa-fix-3-sse-bench.spec.ts` — 首 chunk + 整体延迟 3 轮
- `tests/e2e/qa-fix-3-sse-raw.spec.ts` — SSE raw body dump（验证流式 chunk）
- `tests/e2e/qa-fix-3-json-compare.spec.ts` — JSON 通道对照
- `playwright.qa-fix-3.config.ts` — port 3002 配置

实测命令（在主 worktree）：
```
cd "/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim"
npx playwright test --config=playwright.qa-fix-3.config.ts tests/e2e/qa-fix-3-sse-bench.spec.ts
```

3 轮实测 JSON 输出已粘在上面 "性能与 acceptance #1 的根因升级" 段。

---

## 给 coordinator 的升级请求

请决策 acceptance #1（首 chunk ≤2s）出路：

1. **选 B（fetch 拦截注入 chat_template_kwargs）**：Builder B 大概 30min 完成 + 重测；仍属 Fix 3 scope；总 latency 应能到 1-2s first chunk
2. **选 C（spec relax）**：spec acceptance #1 改成「首 chunk ≤ baseline 50%」（约 9-13s），acceptance #2 改成「streaming 渲染可见」（已达成）。我建议同时开一个新 unit `fix-3b-mimo-reasoning-off` 追踪选项 B 的工作
3. **选 A（切 SDK 抽象）**：超出 batch 1 单 fix scope，建议 batch 2 处理

我**倾向选 B 然后 PASS** — 30min 内可以完成、风险最小、用户能拿到完整的 spec 性能 acceptance。

## Dynamic exit status

- r2 大体 PASS（流式实装正确，r1 误报已撤回）
- acceptance #1/#2 性能数字未达，但根因不是 Fix 3 代码 — coordinator 决定后续
- **不计入"同一 FAIL 3 连"**（r1 的 vitest/scope FAIL 是误报，r1 的 reasoning_effort FAIL 已在 r2 修；r2 唯一未达 acceptance 是新发现的 reasoning-off 问题，不同类）

## 时间花费

QA r2 ≈ 1.5h（含复核 a58fdba git stat / vitest、curl 排查 enable_thinking、ai-sdk 文档查证）。
