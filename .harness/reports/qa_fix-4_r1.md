# QA Report — Fix 4 · AI Provider 死代码删除 (Worktree B, r1)

- **Unit**: `fix-4-provider-deadcode`
- **Worktree**: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-ai`
- **Branch**: `claude-fix-batch1-ai`
- **HEAD tested**: `b367998`（叠在 e2fd4c8 Fix 3 r2 上跑 — 当前 HEAD）
- **QA**: QA B (AI 组)
- **Verdict**: **PASS**（7 项 acceptance 全过 + 真浏览器 + DB 对账）

---

## Acceptance Matrix（spec L158-167）

| # | Acceptance | 结果 | 证据 |
|---|---|---|---|
| 1 | UI Provider 下拉 ≥ 5 项 | ✅ PASS | `qa-fix-4-ui-dropdown.spec.ts` 点 combobox 后弹出 `["小米 MiMo","阿里通义千问","DeepSeek","Google Gemini","OpenAI"]` 5 项；截图 `test-results/qa-fix-4-dropdown-open.png` |
| 2 | 切到 qwen 后真用 qwen（AiRun.provider 验证） | ✅ PASS | teacher1 PATCH simulationChat→qwen+qwen-plus + student1 chat with `taskInstanceId=00000000...a602` → DB `AiRun` 最新行：**provider=qwen / model=qwen-plus / latencyMs=2233 / status=succeeded**；之前所有 row 都是 mimo |
| 3 | 缺 key 时中文错误 | ✅ PASS | `POST /api/ai/tool-settings/test-connection {provider:"gemini"}` → 400 `AI_PROVIDER_KEY_MISSING`「Google Gemini API key 未配置（请设置 GEMINI_API_KEY 环境变量）」；openai 同款 |
| 4 | mimo 默认行为不变 + da9a505 不破坏 | ✅ PASS | mimo test-connection 200 / sample="123" / latencyMs=1857；reasoningEffort 路径仍在（'high' / 'low'，da9a505 SDK 白名单不变） |
| 5 | tests/ai-provider.test.ts 加 case 验证非 mimo 不再被强制改写 | ✅ PASS | b367998 diff: +51/-7 行；新 4 case 加上 `fix-4-provider-deadcode.test.ts` 15 case 全过 |
| 6 | tsc 0 / vitest 全过 | ✅ PASS | tsc exit=0；vitest 76 files / **908 tests / 0 failed**（含 fix-3 17 + fix-4 15）；lint 3 warning pre-existing |
| 7 | Commit msg = `fix(ai): respect provider selection (remove forced mimo rewrite)` | ✅ PASS | `git log -1 b367998` 显示完全匹配 |

---

## 真浏览器实测细节

### Test 1 — API `GET /api/ai/tool-settings` 返回 5 个 provider option

```json
{
  "providerOptions": [
    {"value":"mimo","label":"小米 MiMo","description":"默认 OpenAI-compatible provider；高质量 + 低成本"},
    {"value":"qwen","label":"阿里通义千问","description":"DashScope OpenAI 兼容；中文金融语义稳定"},
    {"value":"deepseek","label":"DeepSeek","description":"中文推理强；评分 / 思政挖掘备选"},
    {"value":"gemini","label":"Google Gemini","description":"需 GEMINI_API_KEY；境外网络"},
    {"value":"openai","label":"OpenAI","description":"GPT-4o 系列；境外网络 + 付费"}
  ]
}
```

### Test 2 — UI Select 下拉点开真显示 5 项

`teacher1@finsim.edu.cn` → `/teacher/ai-settings` → 点 combobox 触发器 → 期望选项含全部 5 个 label。

实测 `[role="option"]` 列表：`["小米 MiMo","阿里通义千问","DeepSeek","Google Gemini","OpenAI"]`。

### Test 3 — 切 qwen + chat 实测 DB 对账（最关键）

步骤：
1. `PATCH /api/ai/tool-settings {toolKey:"simulationChat", provider:"qwen", model:"qwen-plus", thinking:"disabled", temperature:0.8}` → 200，DB row teacherId=4dbbe635 toolKey=simulationChat provider=qwen
2. `student1` 登录 → `POST /api/ai/chat {taskInstanceId:"00000000-0000-4000-8000-00000000a602", transcript:[student], scenario:...}` Accept SSE
3. **5.1s 内返回 8 个 chunk + meta，degraded=false，studentPerf 真值**
4. DB 查询 `SELECT * FROM "AiRun" WHERE feature='simulation' ORDER BY createdAt DESC LIMIT 1`:

```
createdAt | feature    | provider | model     | status    | latencyMs
2026-05-13 12:18:27.658 | simulation | qwen   | qwen-plus | succeeded | 2233
```

**这就是 acceptance #2 的硬证据** — provider 选择真生效，AiRun audit trail 写的是 qwen 不是 mimo。

Bonus：qwen 实际 latency 2.2s 完整 chat，远好于 Fix 3 r2 在 mimo 上的 14-22s — 因为 qwen 默认不开 reasoning。

### Test 4 — 缺 key 中文错误

`POST /api/ai/tool-settings/test-connection {provider:"gemini", toolKey:"simulationChat"}`:
```json
{
  "success": false,
  "error": {
    "code": "AI_PROVIDER_KEY_MISSING",
    "message": "Google Gemini API key 未配置（请设置 GEMINI_API_KEY 环境变量）"
  }
}
```

`openai` 同款。错误码 + 中文 message + env var 名称都齐。

### Test 5 — mimo 测试连接 OK

`POST /api/ai/tool-settings/test-connection {provider:"mimo", toolKey:"simulationChat"}`:
```json
{
  "success": true,
  "data": {
    "ok": true,
    "latencyMs": 1857,
    "providerName": "mimo",
    "effectiveModel": "mimo-v2.5-pro",
    "sample": "123"
  }
}
```

mimo 仍连通；da9a505 + Fix 3 r2 reasoning='low' 路径合理工作（test-connection 用 simulation feature → 走 thinking-disabled → reasoningEffort:'low'）。

### Test 6 — qwen 保存 + 撤回

QA 测完后已把 teacher1 simulationChat 的 provider/model 还原为 NULL（默认 mimo），不影响后续 QA / 用户。SQL: `UPDATE "AiToolSetting" SET provider=NULL, model=NULL WHERE toolKey='simulationChat' AND teacherId=...`。

---

## Anti-regression 检查

| 项 | 状态 | 证据 |
|---|---|---|
| da9a505 mimo reasoning 路径未触碰 | ✅ | `lib/services/ai.service.ts:279` `reasoningEffort: thinking === "enabled" ? "high" : "low"` 仍在；getProviderOptions/JSON_FORCE_DISABLE_THINKING 注释 全保留；fix-4-provider-deadcode.test.ts L107-110 + fix-3-chat-streaming.test.ts L67-70 双重静态守护 |
| `tests/pr-mimo-reasoning-param.test.ts` 5 case | ✅ PASS | 测试已配套切到 'low'（Fix 3 r2），断言现在是 `reasoning_effort:"low"`，5/5 全过 |
| Service interface 兼容扩展 | ✅ | `ProviderConfig.name` 加 "gemini" 是 union 扩展不破坏 caller |
| `listAiToolSettings` 返回形状不变 | ✅ | UI 类型不需要改 |
| Route Handler 仍是薄壳 | ✅ | `test-connection/route.ts` 调 service 层 `aiGenerateText`，业务 + provider 解析全在 service |
| 中文 UI / 错误消息 | ✅ | 所有 label / description / error msg 全中文，env var 名英文（合理） |
| 旧 chatReply / aiGenerateText / aiGenerateJSON | ✅ | mimo 默认行为对老用户完全不变 |

---

## 静态/代码 review

✅ `ai.service.ts:158-170` 删 `const providerName = requestedProviderName === "mimo" ? ... : "mimo"`，注释完整保留事故 context
✅ `ai.service.ts:181-189` 删 fallback 强制改写
✅ 删 "silent keyless-return" 分支 — 缺 key 显式 throw `AI_PROVIDER_NOT_CONFIGURED: <name>`，前端拿到中文 toast
✅ gemini case 走 OpenAI-compatible 端点（`generativelanguage.googleapis.com/v1beta/openai/`），支持 `GEMINI_PROXY_URL` 自建网关
✅ `isModelCompatible` 加 `model.startsWith("gemini-")` 校验
✅ test-connection 用 simulation feature（thinking-disabled）+ createAiRun audit 留痕，sample 限制 prompt 防 token 浪费
✅ `ai-tool-settings.service.ts:160` AI_PROVIDER_OPTIONS 5 项；`AI_PROVIDER_VALUES` Set 验证
✅ `ai-tool-settings.service.ts` model 白名单从 `mimo-` 前缀放开（让 qwen-plus / deepseek-chat / gemini-2.5-flash / gpt-4o-mini 都能通过）
✅ Zod enum 扩到 5 项（`tool-settings/route.ts:3`）
✅ UI test-connection 按钮 + 状态显示 + Toast 中文（`app/teacher/ai-settings/page.tsx`）

---

## 验收脚本与产物

QA 新增的真浏览器 e2e（worktree-local，不进 PR）:

- `tests/e2e/qa-fix-4-provider.spec.ts` — 6 case（API/UI label/test-connection × 3/save qwen）— 1 fail 误报已用 `qa-fix-4-ui-dropdown` 替代
- `tests/e2e/qa-fix-4-routing.spec.ts` — student1 chat with taskInstanceId 验证 qwen 路由（**关键 acceptance #2**）
- `tests/e2e/qa-fix-4-ui-dropdown.spec.ts` — combobox 点开 5 项可见
- `tests/e2e/qa-fix-4-chat-with-qwen.spec.ts` — sanity check

实测命令（主 worktree）：
```
cd "/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim"
npx playwright test --config=playwright.qa-fix-3.config.ts \
  tests/e2e/qa-fix-4-provider.spec.ts \
  tests/e2e/qa-fix-4-ui-dropdown.spec.ts \
  tests/e2e/qa-fix-4-routing.spec.ts
```

DB 对账 SQL：
```sql
SELECT "createdAt", feature, provider, model, status, "latencyMs"
FROM "AiRun" WHERE feature = 'simulation' ORDER BY "createdAt" DESC LIMIT 5;
```

---

## Dynamic exit status

- r1 PASS（所有 acceptance + anti-regression 通过 + DB 对账）
- 无 r2 需要

---

## 时间花费

QA r1 ≈ 1h（含 6 个 e2e case + DB 对账 + 撤回 qwen 设置）。预算 1.5h 内。

---

## 关联 Fix 3

- Fix 4 r1 PASS 不依赖 Fix 3 acceptance #1 是否 PASS
- Fix 3 r2 流式实装 PASS，但 acceptance #1 性能未达 — 已升级 team-lead 决定 A/B/C
- Worktree B 完工与否取决于 Fix 3 性能决策
