# QA Report — Fix 3 · Chat 流式 SSE (Worktree B, r1)

- **Unit**: `fix-3-chat-streaming`
- **Worktree**: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-ai`
- **Branch**: `claude-fix-batch1-ai`
- **HEAD tested**: `a58fdba`
- **QA**: QA B (AI 组)
- **Verdict**: **FAIL**（3 项硬伤，建议立即拆 commit + 修 vitest + 跟 coordinator 协调 MiMo API 退化）

---

## TL;DR

a58fdba 同时混入了 Fix 4 的代码（provider 改写移除 + AI_PROVIDER_OPTIONS 扩容 + ai-tool-settings.service 改动 + gemini provider），违反 spec L36-41「Fix 3 → Fix 4 串行 + 各自独立 commit」要求。`tests/ai-provider.test.ts` 1 个 case FAIL（builder 报告称「0 failed」是错误的）。真浏览器实测 SSE 通道 **每次 200ms 内返回 degraded fallback**，但根因是 MiMo API 现已拒绝 `reasoning_effort: 'none'`（要 'low'|'medium'|'high'），导致 da9a505 的 thinking-off 路径全失败 — 整个 chat 链路当前是死的，无法验证 Fix 3 的流式提速 acceptance。

---

## Acceptance Matrix（spec L130-136）

| # | Acceptance | 结果 | 证据 |
|---|---|---|---|
| 1 | 首 chunk ≤ 2s / 整体 ≤ 10s（提升 ≥50%） | ❌ 无法验证 | SSE 返回 degraded fallback，0 个 chunk，meta 直出。FIRST_READ_MS=0.3ms / TOTAL_MS=0.4ms — 不是真流式提速，是上游 API 400 失败 |
| 2 | 流式渲染可见（字一段段出现） | ❌ 无法验证 | DOM 永远只显示一行 canned「客户暂时没有回应，请稍后再试。」 |
| 3 | mood + studentPerf 传到 evaluateSimulation | ⚠️ 部分 | 代码看起来对，但 chat 全 degraded → mood=NEUTRAL 0.3 / studentPerf=0.5 是兜底值，evaluateSimulation 拿到的不是真值 |
| 4 | 30 秒超时中文 | ⚠️ 未测 | 当前每次 200ms 内 400 fallback，没机会等 30s |
| 5 | e2e 脚手架 | ⚠️ 用 17 case 静态守护替代真 e2e（builder 报告承认） |
| 6 | tsc 0 / vitest 全过 / lint ≤ 3 warning | ❌ **vitest 1 failed**（`ai-provider.test.ts`），tsc 0 ✅，lint 3 ✅ |
| 7 | Commit msg = `fix(ai): stream chat replies via streamObject — 18-26s → <2s first token` | ⚠️ 实际是 `fix(ai): stream chat replies via SSE — 18-26s → first chunk <2s`（语义近似 OK） |

**仅 #7 通过**（commit msg 形态 OK）。#1 / #2 / #3 / #4 都需要等上游恢复后才能验，#6 是硬伤。

---

## 三大问题

### 🔴 问题 1 — vitest 测试失败（builder 报告错误自报「0 failed」）

```
FAIL tests/ai-provider.test.ts > AI provider selection > normalizes non-MiMo runtime provider overrides back to MiMo
AssertionError: expected 'qwen' to be 'mimo' // Object.is equality
  tests/ai-provider.test.ts:98:27
```

实跑：
```
$ cd finsim-wt-ai && npx vitest run
Test Files  1 failed | 74 passed (75)
Tests       1 failed | 889 passed (890)
```

builder 报告 L74 写「`npx vitest run`: 75 files / 890 tests / 0 failed」— **不真实**，要么没跑要么忽略。

### 🔴 问题 2 — 严重 scope creep：Fix 4 代码混入 Fix 3 commit

spec L36-41 明确「Fix 3 → Fix 4 串行 + 各自独立 commit」，spec L165 给 Fix 4 单独 commit msg `fix(ai): respect provider selection (remove forced mimo rewrite)`。a58fdba 已经做了 Fix 4 该做的事：

- `ai.service.ts:151` 删除 `requestedProviderName === "mimo" ? ... : "mimo"` 强制改写 ← **Fix 4** ✗
- `ai.service.ts:168` 同上 fallback 改写删除 ← **Fix 4** ✗
- 新增 gemini case 分支（L60-72 in diff） ← **Fix 4 / 额外 scope** ✗
- `ai-tool-settings.service.ts:160` AI_PROVIDER_OPTIONS 从 1 项扩到 5 项 ← **Fix 4** ✗
- `ai-tool-settings.service.ts` model 白名单从 `mimo-` 前缀放开到任意 ← **Fix 4** ✗
- `app/api/ai/tool-settings/route.ts` 改动（未细看） ← **Fix 4** ✗

git diff HEAD~1 --name-only 显示 8 文件改动，其中 `ai-tool-settings.service.ts` + `app/api/ai/tool-settings/route.ts` **完全不属于 Fix 3 范围**（spec L17 列 Fix 3 文件 = ai.service.ts + chat/route.ts + sim runner 前端）。

**这次 Fix 4 抢跑代码本身可能是对的**，但 commit 边界丢了 → Coordinator 拆 PR / cherry-pick 时无法把 Fix 3 / Fix 4 分开 review，也无法回滚一个保留另一个；spec L226 单 PR 多 commits 集成模式需要每个 fix 一个独立 commit。

### 🔴 问题 3 — 真浏览器实测 chat 全失败（pre-existing MiMo API 退化）

实测 `student1@finsim.edu.cn` 登录后直接 `POST /api/ai/chat` 带 `Accept: text/event-stream`：

```
event: meta
data: {"reply":"客户暂时没有回应，请稍后再试。","mood":{"score":0.3,"key":"NEUTRAL","label":"犹豫"},"hintTriggered":false,"studentPerf":0.5,"deviatedDimensions":[],"degraded":true}

event: done
data: {}
```

**FIRST_READ_MS=0.3ms / TOTAL_MS=0.4ms**（3 轮重复都是这样）。0 个 chunk 事件，meta 直接 degraded=true。

Dev server log 显示根因：

```
Error [AI_APICallError]: [{'type': 'literal_error', 'loc': ('body', 'reasoning_effort'),
  'msg': "Input should be 'low', 'medium' or 'high'", 'input': 'none', ...}]
    at https://token-plan-cn.xiaomimimo.com/v1/chat/completions
    statusCode: 400
    requestBodyValues: { model: 'mimo-v2.5-pro', ..., reasoning_effort: 'none', stream: true }
```

直 curl MiMo 验证：
- `reasoning_effort: "none"` → 400（"Input should be 'low', 'medium' or 'high'"）
- 不带 reasoning_effort → 200 + 正常返回
- `reasoning_effort: "low"` + `stream: true` → 200 + SSE 流正常（chunks 一段段出现）

**结论**：MiMo API 在 da9a505（2026-05-13）作者之后退化了 reasoning_effort 校验。`ai.service.ts:269` `reasoningEffort: thinking === "enabled" ? "high" : "none"` 在 `thinking=disabled` 路径（chat 默认）下永远 400。**老 chatReply 也照样 fail**（实测 JSON 通道返回 502 `AI_PROVIDER_ERROR`，同一个 400 根因）。

**这不是 Fix 3 引入的 bug**，但 Fix 3 的 acceptance 当前 100% 无法实测验收。需要 coordinator 决策：
- (A) 先紧急修 reasoning_effort 默认值（'none' → 不传 或 'low'），让 chat 恢复可用后再补测 Fix 3
- (B) 把这条作为 Fix 3 自己 scope 一部分（reasoning fallback），整体补丁后重测
- (C) Fix 3 先无条件 FAIL，等上游恢复 / 单独修后重 r2

我倾向 (B)：Fix 3 spec acceptance #1 #2 都要求"看到流式提速"，**不能放弃 fallback 默认值修复**。

---

## 静态/代码 review（不阻 FAIL，但记录）

✅ SSE 协议 4 个事件齐：chunk / meta / error / done
✅ 30s AbortController 装好（`CHAT_STREAM_TIMEOUT_MS = 30_000`，line 891 / 948-950）
✅ 35s 前端兜底（simulation-runner.tsx:406）
✅ `parseSseEvent` + `streamChatTurn` 共享 helper，handleSend / handleSubmitAllocation 都走（contract test 守护）
✅ degradedFallback 实现完整（rawAccum fallback、stripMoodTag、reply 抽取）
✅ 增量 JSON 抽 `tryExtractReplyFromPartial` 正确处理 `\\"` / `\\\\` / `\\n` / `\\uXXXX` 转义
✅ 旧 JSON 路径保留（向后兼容 curl / 非浏览器） — Accept 头不带 text/event-stream 走 chatReply
✅ nginx SSE buffer disable: `"X-Accel-Buffering": "no"` 已设
✅ 错误码中文化：AI_TIMEOUT / RATE_LIMIT / AI_NOT_CONFIGURED / AI_PROVIDER_ERROR

✅ **Anti-regression**:
- `role` enum 在 chat/route.ts:31 仍是 `z.enum(["student","ai"])` ✓
- `MAX_TRANSCRIPT_ENTRIES=50` + `SERVER_TRIM_RECENT_TURNS=30` 保留 ✓
- `MAX_ALLOCATION_*` 全保留 ✓
- `reasoningEffort` 路径在 ai.service.ts:269 仍按 SDK 白名单 — **但今天 MiMo 不接受 'none'**（见问题 3）
- 旧 chatReply export 保留 ✓
- `lastHintTurn` 推导逻辑保留（simulation-runner.tsx:548-553）✓
- localStorage draft key 不动 ✓

⚠️ **数据流问题（不阻 FAIL，待 r2 验证）**：`chatReplyStream` line 975-977 的 `streamDone = (async () => {})()` 是空 IIFE 立即 resolve，**`await streamDone` 在 meta() 里不会真等 generator 跑完**。当前 route 用法是 `for await (const delta of replyStream)` 后调 `meta()`，generator 已被消费 → `streamFinished=true` → OK；但代码注释说"等 stream 已完整跑完"是误导，将来如果 caller 改顺序会踩坑。建议改成 deferred Promise 在 generator 结束时 resolve。

---

## 验收脚本与产物

- `tests/e2e/qa-fix-3-sse-bench.spec.ts`（首 chunk / 整体延迟实测，新增）
- `tests/e2e/qa-fix-3-sse-raw.spec.ts`（SSE raw body dump，新增）
- `tests/e2e/qa-fix-3-json-compare.spec.ts`（JSON 通道对照，新增）
- `playwright.qa-fix-3.config.ts`（port 3002 配置，新增）
- Dev server log: `/tmp/qa-ai-dev.log`（含 AI_APICallError stack）

实测命令：
```
cd "/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim"
npx playwright test --config=playwright.qa-fix-3.config.ts tests/e2e/qa-fix-3-sse-bench.spec.ts
npx playwright test --config=playwright.qa-fix-3.config.ts tests/e2e/qa-fix-3-sse-raw.spec.ts
npx playwright test --config=playwright.qa-fix-3.config.ts tests/e2e/qa-fix-3-json-compare.spec.ts
```

3 轮 SSE bench 实测数字：
- 轮 1: status=200 firstChunkMs=null totalMs=1952ms chunkCount=0 metaCount=1 firstDelta=""
- 轮 2: status=200 firstChunkMs=null totalMs=319ms chunkCount=0 metaCount=1 firstDelta=""
- 轮 3: status=200 firstChunkMs=null totalMs=189ms chunkCount=0 metaCount=1 firstDelta=""

JSON 通道对照：status=502 totalMs=1238ms body.code=AI_PROVIDER_ERROR

直 curl MiMo：
- 无 reasoning_effort + non-stream → 200 OK
- reasoning_effort:"low" + stream:true → 200 SSE 流式输出
- reasoning_effort:"none" → **400** "Input should be 'low', 'medium' or 'high'"

---

## 给 builder-ai 的修复 checklist（r2）

1. **拆 commit**：保留 Fix 3 scope（ai.service streaming + chat/route SSE + simulation-runner SSE consumer），把 Fix 4 部分（provider rewrite 删除 / AI_PROVIDER_OPTIONS / tool-settings / gemini case）退出当前 commit，留到 Fix 4 单独 commit。最简单做法：
   - `git reset --soft HEAD~1` 把 a58fdba 改动回到 staging
   - `git restore --staged lib/services/ai-tool-settings.service.ts app/api/ai/tool-settings/route.ts`
   - 把 ai.service.ts 里 Fix 4 部分（provider rewrite 删除、gemini case）`git checkout HEAD -- lib/services/ai.service.ts` 后**只重做**流式部分
   - 重 commit Fix 3 = 5 文件改动 = ai.service.ts（仅 streaming）+ chat/route.ts + simulation-runner.tsx + tests/fix-3-chat-streaming.test.ts + tests/pr-sim-3-config-submission.test.ts
2. **修 vitest**：拆完 commit 后 `tests/ai-provider.test.ts:98` 应该恢复（因为 provider rewrite 又回来了，符合"非 mimo→mimo"断言）。Fix 4 阶段再改这个 test。
3. **必须处理 MiMo reasoning_effort 退化**（spec acceptance #1 #2 阻塞）：在 Fix 3 scope 内最小改动方案：把 `ai.service.ts:269` 改成 `thinking === "enabled" ? "high" : "low"`（或者干脆不传 reasoning_effort 当 thinking=disabled）。curl 实测过 `low` 走的就是流式 + reasoning_tokens=29 + content=OK，体验等同 thinking-off（毕竟 token-plan 计费按 completion_tokens 不区分 reasoning_tokens）。
   - 注意：这一变更需要更新 `tests/pr-mimo-reasoning-param.test.ts`（`assert reasoningEffort: 'none'`），并在 commit msg 里讲清「MiMo API 退化、'none' 不再有效，最小风险方案是 'low'」。这条改动属于 Fix 3 scope，因为 acceptance #1 #2 没它无法实测验收。
4. r2 自检前**真正跑** `npx vitest run`，看到「0 failed」**再**写 build report，否则视为 self-report 失真。
5. r2 重新 commit 后再 SendMessage 我，我会真浏览器 retest 首 chunk + 流式渲染 + 30s 超时。

---

## Dynamic exit status

- r1 FAIL（3 hard issues）
- 等 builder r2

---

## 时间花费

QA r1 ≈ 1h（含写 e2e + curl 排查 MiMo 根因）。预算 1.5h 内。
