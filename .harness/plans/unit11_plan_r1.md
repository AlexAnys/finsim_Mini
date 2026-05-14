# Unit 11 Plan — AI 留痕 UI + 服务端节流 + AiRun tokens 字段

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 11
> Bugs: B-ADMIN-01 / B-ADMIN-02 / B-DASH-01（合并 Unit 7 footer）/ probe r1 PR-2/3 / M1 一周洞察无节流

## 调研发现

### A. AiRun schema 现状（已有 13 字段）
```
id / userId / toolKey / feature / provider / model / status / promptVersion
promptHash / inputSize(prompt char) / outputSize(output char) / latencyMs
error / metadata / createdAt / updatedAt
```
**缺 4 字段（spec 要求）**：`inputTokens Int?` / `outputTokens Int?` / `costEstUSD Decimal? @db.Decimal(10,6)` / `summary String? @db.VarChar(200)`

### B. ai.service 三大入口（已写 AiRun，但未回填 tokens）
- `aiGenerateText` (line 704) — generateText 返回 `{text, usage}`，需读 usage.inputTokens/outputTokens 写 finishAiRun
- `aiGenerateJSON` (line 752) — 同上，循环 retry 时每次成功才写 tokens
- `chatReplyStream` (line 1171) — streamText 返回 result，需在 meta() 内拿 `result.totalUsage` 写入

### C. Vercel AI SDK token 来源
- `node_modules/ai/dist/index.d.ts:267` `LanguageModelUsage = { inputTokens, outputTokens, totalTokens, ... }`
- generateText 返回的对象 `.usage` 即此类型
- streamText 返回的 `result.totalUsage` 是 Promise<LanguageModelUsage>

### D. 现有 cron 模板（`/api/cron/weekly-insight/route.ts`）
- 已有 `x-cron-token` header 校验 + admin fallback 双路径，可复用结构
- 用于实现 spec L227 "running > 5min 自动转 failed" cron

### E. 节流目标 3 个 feature
- `weeklyInsight` — `/api/lms/weekly-insight?force=true`（已知 Unit 7 实现）
- `scopeInsights` — `/api/lms/analytics-v2/scope-insights`
- `taskDraftAi` — task-build-draft AI 生成路径（Unit 10 worker 改这个，我**不动 task-build-draft 流程**，但加节流 lib 的 hook 让 Unit 10 接入）

实现：**in-memory Map<userId+feature, lastAtMs>**。60s 内 force=true 仅 1 次。简单实用，dev 重启重置（生产 Vercel/serverless 会失效但 demo 期可接受 — spec L227 接受 "redis-less in-memory throttle"）。

未来生产环境可改 AiRun.startedAt 查询（"过去 60s 内是否有同 userId+feature 的 running/succeeded 记录"），本 unit 不上 DB 查询以保性能简单。

### F. 现有页面层
- 无 `/teacher/ai-usage` 也无 `/admin/*`，需从零起。`role === "admin"` 已经在 sidebar 兼容（line 60 + 68）。
- 一周洞察 modal（Unit 7 已加 model+duration footer）合并 token 字段即可（无需新设计 footer）。

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `prisma/schema.prisma` | 改 | AiRun 加 4 字段 |
| `prisma/migrations/...` | 新 | migrate dev 自动产 |
| `lib/services/ai.service.ts` | 改 | finishAiRun 签名加 `usage` + `outputText` 用作 summary；3 入口传 usage；export AI feature throttle 工具 |
| `lib/services/ai-throttle.service.ts` | 新 | in-memory throttle `assertAiFeatureCooldown(userId, feature, cooldownMs=60_000)` |
| `lib/services/weekly-insight.service.ts` | 改 | force=true 进入前调 assertAiFeatureCooldown；Result 加 inputTokens/outputTokens（透传 AiRun） |
| `lib/services/scope-insights.service.ts` | 改 | force=true 进入前调 assertAiFeatureCooldown |
| `lib/services/ai-usage.service.ts` | 新 | listAiRuns / aggregateByFeature 服务方法 |
| `app/api/lms/ai-usage/route.ts` | 新 | teacher 自己的 AI usage list + agg API |
| `app/api/admin/audit/route.ts` | 新 | 跨教师 AuditLog + AiRun list API（admin only） |
| `app/teacher/ai-usage/page.tsx` | 新 | teacher AI 用量页（按 feature 聚合卡 + 列表筛选） |
| `app/admin/audit/page.tsx` | 新 | admin 跨教师 AuditLog + AiRun 查看 |
| `app/admin/layout.tsx` | 新 | admin 路由 segment 受 admin role 保护 |
| `app/api/cron/sweep-stuck-ai-runs/route.ts` | 新 | running > 5min 自动 → failed |
| `components/sidebar.tsx` | 改 | teacher 加"AI 用量"nav；admin 加"审计中心"nav |
| `components/teacher-dashboard/weekly-insight-modal.tsx` | 改 | footer 合并 inputTokens/outputTokens 显示 |
| `tests/ai-throttle.test.ts` | 新 | 节流逻辑单测 |
| `tests/ai-run-tokens.test.ts` | 新 | 4 字段持久化 + summary 截断 |
| `tests/e2e/unit11-verify.spec.ts` | 新 | 6-8 case |

## 关键改动思路

### 1. AiRun 4 新字段
```prisma
model AiRun {
  // ... existing 13 fields
  inputTokens   Int?
  outputTokens  Int?
  costEstUSD    Decimal? @db.Decimal(10, 6)  // 6 位小数，cent 级精度
  summary       String?  @db.VarChar(200)     // prompt 前 200 字（明文，方便审计）
}
```

### 2. finishAiRun 签名扩
```ts
async function finishAiRun(
  runId: string | null | undefined,
  data: {
    status: "succeeded" | "failed";
    startedAt: number;
    output?: string;
    error?: unknown;
    usage?: { inputTokens?: number; outputTokens?: number };  // ← 新
    userPromptForSummary?: string;                            // ← 新（取前 200 字）
  },
) { ... }
```

### 3. summary 用 prompt 前 200 字（按 coordinator 反建议）
coordinator note: "Unit 11 应让老师能'看摘要'而非'对哈希'"。✓ 用明文截断。

```ts
const summary = data.userPromptForSummary?.slice(0, 200) ?? null;
```

### 4. costEstUSD 估算（按 model + tokens）
轻量启发式表（按主流 provider 当前价格）：
```ts
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "qwen-plus": { input: 0.0008, output: 0.002 },
  "deepseek-chat": { input: 0.0003, output: 0.0014 },
  "gemini-2.0-flash": { input: 0, output: 0 },         // free tier
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  // ... default fallback to 0
};
function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null { ... }
```
（如果 model 不在表里，returns null — Decimal? 允许 null。）

### 5. ai-throttle.service.ts
```ts
const lastCallMap = new Map<string, number>();  // key = userId+feature

export function assertAiFeatureCooldown(
  userId: string,
  feature: string,
  cooldownMs: number = 60_000,
): void {
  const key = `${userId}:${feature}`;
  const lastAt = lastCallMap.get(key) ?? 0;
  const now = Date.now();
  if (now - lastAt < cooldownMs) {
    throw new Error("AI_FEATURE_COOLDOWN");
  }
  lastCallMap.set(key, now);
}

export function recordAiFeatureCall(userId: string, feature: string): void {
  lastCallMap.set(`${userId}:${feature}`, Date.now());
}
```

handleServiceError 加映射：`AI_FEATURE_COOLDOWN → 429 "请稍后再试（60秒内仅可重新生成 1 次）"`。

### 6. 一周洞察 modal footer 合并 tokens
当 fresh 路径有 `inputTokens/outputTokens` 时，footer 显示：
```
由 qwen-plus 生成 · 耗时 8.2s · 输入 1.2K tokens · 输出 380 tokens · 生成于 2 分钟前
```
（cache hit 路径保持现状不显示 tokens — coordinator 已确认合理）

### 7. /teacher/ai-usage 页面（最小可用）
- 顶部：本月成本估算卡（按 feature aggregate）
- 列表：AiRun 表分页（按 createdAt desc），每行 feature/provider/model/tokens/latency/status
- 筛选：feature select / dateRange / provider / model
- 权限：teacher 只看自己（`WHERE userId = me.id`）

### 8. /admin/audit 页面
- 跨教师 AuditLog + AiRun 两个 tab
- AuditLog 已有 model，复用查询；AiRun 跨 teacher（管理员视角无 userId 过滤）
- 仅 admin 可访问（layout 强校验）

### 9. Cron sweep-stuck-ai-runs
```ts
// 找 status=running 且 createdAt < now - 5min
const stuck = await prisma.aiRun.findMany({
  where: { status: "running", createdAt: { lt: new Date(Date.now() - 5 * 60_000) } },
  take: 200,
});
await prisma.aiRun.updateMany({
  where: { id: { in: stuck.map(s => s.id) } },
  data: { status: "failed", error: "STUCK_TIMEOUT_GAVE_UP" },
});
```

## 风险点

1. **🟡 Prisma 三步**：必须 migrate dev + generate + 重启 dev server + 验证页面。AiRun.metadata 已包含运行时数据，schema 改不破坏读取（4 新字段都是 optional）。
2. **🟡 Migration timestamp 冲突**：与 Unit 10 worker 协调；本 plan 写完后我开干前看 `git log` 是否对方刚 commit migration。
3. **🟢 ai.service 三入口改动**：finishAiRun signature 扩 optional 参数，向后兼容（现有调用不传新字段照常工作，但 tokens=null）。
4. **🟢 ai-throttle in-memory**：dev/demo 环境足够，spec L227 已明文接受。生产 serverless 可后续切 AiRun 查询。
5. **🟡 admin layout**：从零起，需保证 `requireRole(["admin"])` 严格，避免误授权。
6. **🟡 一周洞察 modal**：tokens 字段为 optional，老 cache 条目无 tokens 时静默不显示（与 Unit 7 同款 optional chaining 策略）。
7. **🟢 cost 估算表**：当前价格表无侵入，未来 ai.service 加新 provider 时补充即可。

## 自测计划

### 自动化
1. tsc + vitest（含 4 新 unit 测）+ eslint
2. e2e 6-8 case

### e2e 计划
- A: 节流 — weekly-insight 60s 内连点 2 次 force=true，第二次 429 + 中文
- B: AiRun tokens 持久化 — 触发 1 次 AI 调用后 DB 查 inputTokens/outputTokens 非空
- C: /teacher/ai-usage 页面 200 + 显示 molly 自己的 runs
- D: /admin/audit 页面 admin 200，teacher 403
- E: weekly-insight modal footer 显示 tokens
- F: cron sweep-stuck — 注入 1 条 5min 前 running 记录，POST cron → status 变 failed
- G: summary 字段写入（200 字明文 prompt）
- H: cost 估算字段（可选 — 老 model 不在表里 returns null 也是 PASS）

## 不在本 unit 范围

- ❌ task-build-draft AI 入口节流（Unit 10 worker 改这个，我提供 throttle lib，他接入）
- ❌ AiRun 历史回填 tokens（旧记录无 tokens 字段；新记录开始填）
- ❌ Admin 页面 Polish UI（最小可用即可）
- ❌ Prompt rotation（spec.md 提到 promptVersion 已有但本 unit 不动）

## diff 预算

预计 800-1100 行：
- schema + migration ~10
- ai.service + throttle + ai-usage service ~250
- 2 新页 + layout + 2 新 API ~400
- 一周洞察 modal + sidebar ~40
- tests (unit ~150 + e2e ~250) ~400

复杂度高但分层清晰，不会一个文件改 200 行。

## 待 coordinator 确认

1. **costEstUSD 估算表**：本 plan 写最常用 4-5 model 当前价格。如果价格不准/缺，returns null 而非 0（避免老师误读为"免费"）。是否同意？
2. **节流错误码** `AI_FEATURE_COOLDOWN → 429`：当前 finsim 没用过 429 状态码（习惯 400/403/404），是否同意首次引入？或继续用 400 + 特定 code？
3. **summary 用 userPrompt 前 200 字**：spec.md 字面"prompt 前 200 字哈希" 我已按 coordinator note 改成"明文"。是否同意？
4. **admin role 是否已存在**：grep 显示 `role === "admin"` 已在 sidebar 兼容，但需 seed 一个 admin 账号才能测 e2e D。是否用 `admin@finsim.edu.cn` (seed 已有)？

预计 r1 即收概率 70%；schema + 横切 ai.service 一致性是 r2 兜底高风险点。
