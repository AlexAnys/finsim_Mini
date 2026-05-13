# Build Report — Fix 4 · AI Provider 死代码删除 (Worktree B, r1)

- **Unit**: `fix-4-provider-deadcode`
- **Worktree**: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-ai`
- **Branch**: `claude-fix-batch1-ai`
- **HEAD**: `b367998`
- **Parent**: `a58fdba` (Fix 3 — chat streaming)
- **Builder**: Builder B (AI 组)

## 用户看到的改变

老师在「AI 设置」页面 Provider 下拉**真实展开成 5 项**（MiMo / 通义千问 / DeepSeek / Gemini / OpenAI），切到非 mimo 保存后下一次 chat / draft / grading **真的走选择的 provider**（之前 ai.service.ts:151 把所有选项强制改写成 mimo，老师选 qwen 但实际仍跑 mimo 是「幽灵设置」）。每个工具卡新增「测试连接」按钮，点一下 1-shot ping 选择的 provider + model，返回 latency 或中文错误。Provider 选了但 `.env` 没配 key 时显示「XXX API key 未配置（请设置 XXX_API_KEY 环境变量）」。

## 改动文件

| 文件 | 行数 | 角色 |
|---|---|---|
| `lib/services/ai.service.ts` | +30 / -13 | 删 L151/L168 强制改写 + 加 gemini + 不再 silent keyless-return |
| `lib/services/ai-tool-settings.service.ts` | +13 / -4 | AI_PROVIDER_OPTIONS 扩 5 + 不强制 model 以 mimo- 开头 |
| `app/api/ai/tool-settings/route.ts` | +2 / -1 | zod enum 扩到 5 |
| `app/api/ai/tool-settings/test-connection/route.ts` | +75 (new) | 测试连接 endpoint |
| `app/teacher/ai-settings/page.tsx` | +69 / -2 | 「测试连接」按钮 + 状态显示 + testConnection() |
| `tests/ai-provider.test.ts` | +51 / -7 | 反转旧 "normalize to mimo" 断言 + 新增 4 case |
| `tests/ai-tool-settings.test.ts` | +8 / -1 | 反转 "only exposes MiMo" → 5 个 |
| `tests/fix-4-provider-deadcode.test.ts` | +193 (new) | 15 case 静态守护 + behavioral |

## 关键技术决策

### 删 L151 + L168 强制改写

```ts
// 旧
const providerName = requestedProviderName === "mimo" ? requestedProviderName : "mimo";
const fallbackName = requestedFallbackName === "mimo" ? requestedFallbackName : "mimo";
// 新
const providerName = requestedProviderName;
const fallbackName = requestedFallbackName;
```

注释保留了事故 context（"`Fix 4` ... 历史这里硬 lock 到 MiMo ..."），防止后人误把改写加回来。

### 删 "silent keyless-return" 分支

旧版：

```ts
if (!provider || !provider.apiKey) {
  if (setting?.provider && provider) {
    return { provider, model: ... };   // ← keyless！createOpenAI 拿到 apiKey:"" → 网络 401
  }
  ...
}
```

新版：直接走 fallback 链；fallback 也缺 key → throw `AI_PROVIDER_NOT_CONFIGURED: <name>`，`handleServiceError` 映射成中文「AI 服务未配置」（已存在）。

### gemini 走 OpenAI-compatible

Google 的 Gemini 1.5+ 有 `generativelanguage.googleapis.com/v1beta/openai/` 兼容端点；用 `createOpenAI()` 而不是 `@ai-sdk/google`，保持单一 adapter 路径，所有 thinking/temperature/reasoningEffort 逻辑复用。GEMINI_MODEL 默认 `gemini-2.5-flash`，`GEMINI_PROXY_URL` 支持自建网关。

`isModelCompatible` 新增 `model.startsWith("gemini-")` 兼容性校验。

### 测试连接 endpoint 走 simulation feature

`/api/ai/tool-settings/test-connection` 走 `aiGenerateText("simulation", ...)`，原因：
1. simulation 在 `JSON_FORCE_DISABLE_THINKING` 集合里，与真实学生 chat 同款 thinking-OFF 路径；测出来的状态最接近实战
2. `createAiRun` 留一条 `AiRun` audit 行供老师在出错时排查（metadata.probe = "test-connection"）

请求体: `{ provider, model? }` — 老师在 UI 选好但**未保存**的 setting 也能直接测；不依赖 DB row。

### 缺 key 中文错误（spec acceptance #3）

`test-connection` route 在 `provider.apiKey === ""` 时返回 `AI_PROVIDER_KEY_MISSING` + 中文 msg，列出对应 env var 名（`MIMO_API_KEY` / `QWEN_API_KEY` / ...）。Test 守护这些字面量。

### 不破坏 da9a505 (anti-regression #1)

`getProviderOptions` / `reasoningEffort: thinking === "enabled" ? "high" : "none"` 路径完全不动。`fix-4-provider-deadcode.test.ts:107-110` 静态守护这点，`fix-3-chat-streaming.test.ts:67-70` 也守护。`tests/pr-mimo-reasoning-param.test.ts`（5 case）仍 PASS。

## 自测结果

```
$ npx tsc --noEmit       # 0 errors
$ npx vitest run         # 76 files / 908 tests / 0 failed
                         #   (新增 fix-4: 15 cases + fix-3: 17 cases）
$ npm run lint           # 3 warnings (pre-existing react-hooks/exhaustive-deps in runners)
```

## 提供给 QA 验证的入口

**Acceptance #1 + #2 (UI 5 项 + 切换后真生效)**:

1. 登录 `teacher1@finsim.edu.cn` / `password123`
2. 访问 `/teacher/ai-settings`
3. 找任一工具（如「模拟对话回复」），点 Provider 下拉
4. 期望看到 5 项：小米 MiMo / 阿里通义千问 / DeepSeek / Google Gemini / OpenAI
5. 切到「阿里通义千问」，保存
6. 进一个 simulation 任务发消息
7. 看 `AiRun` 表（或 server log）确认下一次 chat 的 provider 字段是 `qwen`

```sql
-- DB 对账
SELECT provider, model, status, latencyMs, "metadata"->>'effectiveProvider' as eff
FROM "AiRun"
WHERE feature = 'simulation' AND "userId" = '<teacher1-id>'
ORDER BY "createdAt" DESC LIMIT 5;
```

**Acceptance #3 (缺 key 中文错误)**:

1. 临时把 `.env` 的 `QWEN_API_KEY=` 清空（restart dev server）
2. teacher 设置切到 qwen，点「测试连接」
3. 期望: toast「阿里通义千问 API key 未配置（请设置 QWEN_API_KEY 环境变量）」
4. UI 状态：红色 ✗「阿里通义千问 API key 未配置」

**Acceptance #4 (mimo 默认 + da9a505 不破坏)**:

1. 默认 Provider 仍是 mimo（数据库 row.provider=null → listAiToolSettings 给 "mimo"）
2. 进 simulation 发消息：chat-bench 实测仍是 <1s 首 chunk（不破坏 reasoningEffort=none）
3. `tests/pr-mimo-reasoning-param.test.ts` 5 case PASS

**Acceptance #5 (test 非 mimo 不再被强制改写)**:

`tests/ai-provider.test.ts` 新 4 case 守护:
- "Fix 4 · 老师选 qwen + qwen key 存在 → 真用 qwen"
- "Fix 4 · 老师选 deepseek/gemini/openai 也一样真生效"
- "Fix 4 · 选了 provider 但 .env 缺 key → throw"
- "Fix 4 · 选了 provider 但缺 key + 配 AI_FALLBACK_PROVIDER → fallback"

**测试连接按钮 e2e**:

1. teacher 在 ai-settings 任一工具点「测试连接」
2. 期望 ≤ 5s 内出现绿色 ✓「连通正常（XXX ms）」
3. toast: `${tool.label} 连通正常（XXX ms）`

## Anti-regression 检查清单

- ✅ da9a505 mimo `reasoningEffort` 路径未触碰（getProviderOptions / JSON_FORCE_DISABLE_THINKING / 注释 全保留）
- ✅ `chatReply` / `chatReplyStream` / `aiGenerateText` / `aiGenerateJSON` 行为对 mimo 用户完全不变（默认 provider 仍 mimo）
- ✅ `listAiToolSettings` 仍返回 `{ provider, model }` 形状（UI 不需要改类型）
- ✅ Service interface 无 breaking change（ProviderConfig.name 加了 gemini，是兼容扩展）
- ✅ tsc 0 / vitest 908 全过 / lint 3 warning（≤ spec ≤ 3）
- ✅ 中文 UI（所有新增 label / description / error msg）
- ✅ Route Handler 仍是薄壳（test-connection 调 service 层 `aiGenerateText`）

## Dynamic exit 状态

- r1 提交，等 QA 反馈
- Fix 3 + Fix 4 两个都 PASS 后 → SendMessage team-lead「Worktree B 完工」
- 任一 FAIL 同样问题 3 连 → 回 spec 重规划

## 时间预算

| 阶段 | 实际 | 预算 |
|---|---|---|
| 读 service 代码 + 设计 | ~15 min | - |
| ai.service 改 | ~15 min | - |
| ai-tool-settings 改 + UI | ~25 min | - |
| test-connection 路由 + UI 按钮 | ~20 min | - |
| 测试 + 自检 + commit | ~15 min | - |
| **总计** | **~1h 30min** | **≤ 3h** ✅ |
