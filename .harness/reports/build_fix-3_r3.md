# Build Report — Fix 3 r3 · MiMo reasoning OFF via fetch interceptor

- **Unit**: `fix-3-chat-streaming` r3
- **Worktree**: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-ai`
- **Branch**: `claude-fix-batch1-ai`
- **HEAD**: `55e89af`
- **Builder**: Builder B (AI 组)

## 用户致谢

QA r2 报告里公开承认 r1 两条误判（vitest / scope）并自我修正流程错误，态度专业。**复测后两个真问题（reasoning_effort 退化 + streamDone bug）都正确**，r3 解锁 acceptance #1 是建立在他们扎实的 curl 验证 + SDK 文档查证之上的。这次 QA 真的有读到 ai-sdk.dev 白名单文档 + 跑 3 套 dummy curl 才上来报路线，下次合作放心很多。

## 实装：Option B（QA 推荐）

`lib/services/ai.service.ts:219-280` 改动：

```ts
function createProvider(config: ProviderConfig) {
  if (config.name === "mimo") {
    return createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      fetch: createMimoFetch(),     // ← Option B：仅 MiMo 走 fetch 拦截
    });
  }
  return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
}

function createMimoFetch(): typeof fetch {
  const baseFetch = globalThis.fetch.bind(globalThis);
  return async function mimoFetch(input, init) {
    if (!init?.body || typeof init.body !== "string") return baseFetch(input, init);
    let body: Record<string, unknown>;
    try { body = JSON.parse(init.body); } catch { return baseFetch(input, init); }
    if (typeof body !== "object" || body === null) return baseFetch(input, init);

    const re = body.reasoning_effort;
    if (re === "low") {
      delete body.reasoning_effort;
      const existing = body.chat_template_kwargs;
      body.chat_template_kwargs =
        existing && typeof existing === "object"
          ? { ...(existing as Record<string, unknown>), enable_thinking: false }
          : { enable_thinking: false };
    }
    // re === "high" 或 undefined → body 不动（reasoning ON）

    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return baseFetch(input, { ...init, body: JSON.stringify(body), headers });
  };
}
```

## 行为对照表

| `reasoningEffort` (来自 getProviderOptions) | 原 SDK body | r3 注入后 MiMo 收到 | 期望行为 |
|---|---|---|---|
| `"low"` (thinking=disabled，默认 / sync 路径) | `{reasoning_effort: "low", ...}` | `{chat_template_kwargs: {enable_thinking: false}, ...}` | reasoning OFF，1-2s 首 content chunk |
| `"high"` (thinking=enabled，async batch) | `{reasoning_effort: "high", ...}` | `{reasoning_effort: "high", ...}` 透传 | reasoning ON（高质量评分 / 草稿） |
| 缺字段 | `{...}` | `{...}` 透传 | MiMo 默认 reasoning ON |

## 影响范围

- **仅 MiMo provider**：拦截只在 `config.name === "mimo"` 分支注入；其它 4 个 provider (qwen/deepseek/gemini/openai) 走原生 `createOpenAI({apiKey, baseURL})` 不变
- **不影响 STT / multipart**：拦截器对 `typeof init.body !== "string"` 直接透传 baseFetch
- **不影响其它 endpoint**：所有 MiMo `/v1/*` 请求都经过 fetch wrapper，但只有 `reasoning_effort` 在 body 里时才会被改写

## 不破坏 da9a505 + e2fd4c8

- `getProviderOptions` 仍按 `reasoningEffort: thinking === "enabled" ? "high" : "low"`（e2fd4c8 修复，从 'none' 到 'low'）
- SDK 白名单 path 仍 OK：'low' 是 OpenAI 标准枚举值，不被 ai-sdk 吞掉
- r3 fetch 拦截只是把"SDK 输出的 low"再次转译成"MiMo 真正认得的 enable_thinking=false 顶层"
- da9a505 那条改动（用 SDK reasoningEffort 而不是 thinking）完整保留

## 自测

```
$ npx tsc --noEmit       # 0 errors
$ npx vitest run         # 76 files / 913 tests / 0 failed
                         #   tests/fix-3-chat-streaming.test.ts: 22 cases (新增 5 个 r3 拦截器守护)
$ npm run lint           # 3 warnings (pre-existing)
```

## 给 QA 的验证清单

请按 r2 失败的 acceptance 重测：

1. **acceptance #1**：实测 3 轮 chat-bench
   - **期望**: 首 content chunk ≤ 2s（curl 直 MiMo 用 `chat_template_kwargs: {enable_thinking: false}` 实测 1.5s）
   - 旧 r2 数字：14831 / 18348 / 22098 ms
2. **acceptance #2 整体 ≤ 10s + 提升 ≥50%**：
   - **期望**: 总时长 < baseline 50%（baseline 18-26s → 目标 < 9-13s，实际预期 < 5s）
3. **acceptance #3 流式渲染**: r2 已 PASS，r3 应仍 PASS（chunk 一段段出）
4. **acceptance #4 30 秒中文超时**: 不变
5. **acceptance #5 mood 透传**: 不变
6. **tsc / vitest / lint**: 0 / 913 / 3 ✅
7. **非 mimo provider 不受影响**：可选验证，老师切 qwen 后 chat 仍能用（key 配齐时）

请 curl 直测 SSE 通道也确认：

```bash
# 不带 reasoning_effort 透传 — body 不会被改
# 带 reasoning_effort:"low" — body 改成 chat_template_kwargs
# 带 reasoning_effort:"high" — body 不会被改
```

实际 SDK 调用走的是 `reasoning_effort: "low"` 路径（getProviderOptions 默认），所以 SDK 出来的 body 都会被 r3 拦截器改写。

## Worktree B 当前 commit 顺序

```
55e89af fix(ai): MiMo reasoning OFF via chat_template_kwargs (fetch interceptor)        ← Fix 3 r3
e2fd4c8 fix(ai): MiMo reasoning_effort='none' → 'low' (API regression) + streamDone     ← Fix 3 r2
b367998 fix(ai): respect provider selection (remove forced mimo rewrite)                ← Fix 4 r1
a58fdba fix(ai): stream chat replies via SSE — 18-26s → first chunk <2s                 ← Fix 3 r1
da9a505 (上游)
```

## 时间

r3 ≈ 25 min（含读 QA r2 + 验证 createOpenAI 的 fetch 选项 + 实装拦截器 + 5 新测试 + 全套自测 + commit + 报告）。

## Dynamic exit

- r2 PASS（流式架构 + r1 真问题修复）
- r3 解锁 acceptance #1/#2 性能数字
- 等 QA r3 实测
- 同时 Fix 4 等 QA r1
