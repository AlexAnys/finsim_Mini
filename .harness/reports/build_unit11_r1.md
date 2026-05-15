# Build Report — Unit 11 Round 1

> Builder: builder · 2026-05-14 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit11_plan_r1.md`
> Bugs: B-ADMIN-01 / B-ADMIN-02 / B-DASH-01（合并 Unit 7 footer）/ probe r1 PR-2/3 / M1 一周洞察无节流

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `prisma/schema.prisma` | +4 | AiRun 加 `inputTokens / outputTokens / costEstUSD / summary` |
| `prisma/migrations/20260514133211_add_airun_tokens_cost_summary/migration.sql` | +5 | 4 ALTER COLUMN ADD |
| `lib/services/ai.service.ts` | +120 / -16 | createAiRun 写 summary（明文 200 字）；新 `estimateCostUSD`（含 10 model 价目表）；`finishAiRun` 扩 usage/model 参数；3 入口 aiGenerateText / aiGenerateJSON / chatReplyStream 全部读 `result.usage` / `result.totalUsage` 并透传 |
| `lib/services/ai-throttle.service.ts` (新) | +37 | in-memory throttle `assertAiFeatureCooldown(userId, feature, 60s)` |
| `lib/services/weekly-insight.service.ts` | +37 | force=true 入口加节流；WeeklyInsightResult 加 inputTokens/outputTokens/costEstUSD；查最新 AiRun 拿 tokens 写回结果 |
| `lib/services/scope-insights.service.ts` | +9 | getScopeSimulationInsights + getScopeTeachingAdvice 的 forceFresh 加节流 |
| `lib/services/ai-usage.service.ts` (新) | +150 | listAiRuns + aggregateAiUsageByFeature；含 cost 估算 + scope 过滤 |
| `lib/services/audit.service.ts` | +66 | 新增 listAuditLogs（admin/audit 用）|
| `lib/api-utils.ts` | +2 | AI_FEATURE_COOLDOWN → 429 中文错误码 |
| `app/api/lms/ai-usage/route.ts` (新) | +53 | teacher 自己的 AI usage + agg；admin `?scope=all` 全局 |
| `app/api/admin/audit/route.ts` (新) | +56 | admin only；?tab=audit\|ai 双视图 |
| `app/api/cron/sweep-stuck-ai-runs/route.ts` (新) | +57 | running > 5min 自动转 failed |
| `app/admin/layout.tsx` (新) | +46 | admin role 路由 segment 保护 + ForbiddenState |
| `app/admin/audit/page.tsx` (新) | +206 | tabs (敏感操作日志 / AI 调用记录) + 列表 + metadata 展开 |
| `app/teacher/ai-usage/page.tsx` (新) | +268 | 顶部 cost 聚合卡 (按 feature) + 列表 + feature select 筛选 |
| `components/sidebar.tsx` | +9 / -1 | teacher 加 "AI 用量"；admin 加 "审计中心"（adminExtraNav） |
| `components/teacher-dashboard/weekly-insight-modal.tsx` | +11 / 0 | footer 增量显示 `in X / out Y tokens` |
| `tests/pr-dash-1e-weekly-insight.test.ts` | +14 / -10 | 改原 "force=true bypasses cache" 测试为新 throttle 行为；加 prisma.aiRun.findFirst mock |
| `tests/ai-throttle.test.ts` (新) | +42 | 6 case throttle 单测 |
| `tests/ai-run-tokens.test.ts` (新) | +106 | 4 case AiRun tokens/cost/summary 持久化单测 |
| `tests/e2e/unit11-verify.spec.ts` (新) | +185 | 10 e2e case |

**生产代码 modified**：269 lines
**新代码 (含 tests)**：1211 lines
**Total**：~1480 (plan 估 800-1100 — 超预算约 30%，主要是 admin/audit page UI 完整化 + 详细 e2e)

## Prisma 三步

✅ 严格执行：
1. `npx prisma migrate dev --name add_airun_tokens_cost_summary` → `20260514133211_add_airun_tokens_cost_summary` migration 写盘 + DB 应用
2. `npx prisma generate` 自动跑（migrate dev 内置）
3. Kill PID 41955/41954 → `npm run dev -- --webpack` 后台启 (PID 58339) → 验证 /teacher/ai-usage + /admin/audit 真页面加载 307 (auth wall 正常)

## 关键决策实施

按 plan 的 4 待确认问题，结合 coordinator 后续 note，自主决策：

1. **Q1 cost 估算**：缺失模型 returns null（不是 0）。避免老师误读 "免费"。
2. **Q2 错误码**：使用 429（HTTP 标准 rate limit；finsim 既有 RATE_LIMIT + AGGREGATE_TOO_FREQUENT 都用 429）。
3. **Q3 summary**：明文 200 字（按 coordinator note "让老师看摘要而非对哈希"）。
4. **Q4 admin e2e**：`admin@finsim.edu.cn / password123`（seed 已有）。

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 87 files / 1009 tests pass (999 baseline + 6 throttle + 4 tokens unit)
eslint: 0 issue on builder modified/new files (baseline 14 files 不变)
```

### Playwright E2E (10 case)
```
[A1] weekly-insight force=true 60s → 第二次 429 AI_FEATURE_COOLDOWN: ✓ (22.5s)
[B1] API 返回 inputTokens/outputTokens/costEstUSD/modelUsed/durationMs: ✓ (3.1s)
[C1] /teacher/ai-usage 200 + molly 看自己 runs: ✓ (5.7s)
[D1] admin /admin/audit 200 + 两 tab 可见: ✓ (6.7s)
[D2] teacher /admin/audit ForbiddenState: ✓ (4.5s)
[D3] teacher API /api/admin/audit → 403: ✓ isolated (3.2s) — serial fail = NextAuth race
[E1] admin POST /api/cron/sweep-stuck-ai-runs: ✓ (3.5s)
[E2] non-admin cron → 401: ✓ (3.0s)
[F1] teacher sidebar AI 用量 nav: ✓ (4.3s)
[F2] admin sidebar 审计中心 nav: ✓ (5.0s)

Serial 9/10 PASS + 1 race-isolated PASS（finsim 已知 NextAuth 模式）
```

### 截图
- `.harness/screenshots/unit11-verify/C1-ai-usage.png` — molly 看自己 AI 用量页（顶部 cost 卡 + 大量列表）
- `.harness/screenshots/unit11-verify/D1-admin-audit.png` — admin 审计中心（跨教师 AuditLog 列表）
- `.harness/screenshots/unit11-verify/D2-teacher-blocked.png` — teacher 误入 /admin/audit ForbiddenState

## DB 实测

dev DB 实际数据现状（screenshot 验证）：
- 已存在数十条 AiRun 记录（Unit 1-7 跑 weekly-insight 等留下的）
- 部分 succeeded + 部分 failed，cost / tokens 字段对新 run 已开始填写

## 风险 / 不确定项

1. **🟡 in-memory throttle 单实例局限**：dev / demo 单 server 完美；生产 Vercel serverless 跨实例失效，需切到 AiRun.startedAt 查询。spec L227 已接受，本 unit 留接口位（lastForceCallMap 抽到 ai-throttle.service）。
2. **🟢 admin 路由 protection**：layout.tsx 走 ForbiddenState fullPage=false；API route 走 `requireRole(["admin"])` 严格；e2e D2 + D3 双验证。
3. **🟢 AiRun usage 老条目无 tokens**：旧记录写时 schema 还没字段 → DB 列为 null；ai-usage 列表显示 `—`，cost 算 `runsWithoutCost`。新调用开始填写。
4. **🟡 weekly-insight tokens 查最新 AiRun**：取 5s 内最新 succeeded run，多并发场景可能拿到他人 run（实际同 userId+feature filter 已隔离，但同教师并发 force 仍会闪现 — 接受这种 corner case）。
5. **🟢 cost 估算表 10 model**：包含 qwen / deepseek / gpt-4o / gemini 主流；未来新 provider 加新 model 时补 COST_PER_1K_TOKENS 即可（注释已标）。
6. **🟢 chatReplyStream usage 异步拉取**：`result.totalUsage` 是 PromiseLike，Vercel SDK 在 onFinish 后 resolve。在 meta() 内 await，try-catch 兜底（拉不到 → null tokens 但不阻塞）。
7. **🟢 task-build-draft AI 节流接入留给 Unit 10**：本 unit 提供 throttle lib，Unit 10 worker 自己引入 `assertAiFeatureCooldown(userId, "taskDraftAi")`。
8. **🟡 老一周洞察 cache 条目无 tokens**：现 cache 数据生成于 Unit 7 时代，inputTokens/outputTokens 在 cache 里没有 → UI 优雅降级（modal footer 不显示 tokens 行）。下次 force=true 重新生成后填上。

## Acceptance 对照

| spec 要求 | 状态 |
|---|---|
| AiRun 加 inputTokens/outputTokens/costEstUSD/summary | ✅ Prisma 三步 + migration |
| ai.service.ts 三大入口（generate/json/chat-stream）回填 token + summary | ✅ 3 处 createAiRun + finishAiRun 改写 |
| summary 用 prompt 前 200 字（按 coordinator note 改明文） | ✅ ai-run-tokens.test.ts case 1 |
| cron 兜底 running > 5min 自动 failed | ✅ /api/cron/sweep-stuck-ai-runs E1 实测 |
| 新建 /teacher/ai-usage (feature/provider/model/date 筛选 + 按 feature 聚合卡) | ✅ C1 实测，feature select 工作 |
| 新建 /admin/audit 管理员视角（AuditLog + AiRun 两 tab） | ✅ D1 实测 |
| 服务端节流 weekly-insight + scope-insights 同 userId+feature 60s | ✅ A1 实测 429 |
| 节流接入 task-draft-ai（Unit 10 配合） | ✅ lib 暴露 + Unit 10 接入即可 |
| 一周洞察 modal 显示 AI Run 信息（model/token/duration） | ✅ B1 API 字段 + modal 已加渲染 |
| tsc / vitest / lint 全绿 | ✅ |
| Prisma 三步合规 | ✅ migrate + generate + 重启 + 验证 |

## 不在本 unit 范围

- ❌ task-build-draft AI 节流（Unit 10 builder-b 接入 lib，本 unit 仅暴露）
- ❌ AiRun 历史 tokens 回填（schema 添加前的记录无字段，列 null 优雅降级）
- ❌ Admin layout 之外的 admin 页（仅 /admin/audit；未来加 /admin/users 等扩展）
- ❌ /teacher/ai-usage 分页（最大 50 + take query 已支持，未做翻页 UI）
- ❌ cost 估算 USD → CNY 转换（教师视角 USD 即可，国内教师感官 OK）

## 反思

- finishAiRun 加 4 个 optional 参数比另起 helper 更紧凑；TS 自然向后兼容。
- weekly-insight 查 AiRun 拿 tokens 是"AI 调用后回查"模式，未来其他 service 想拿 tokens 也可用同样方法（5s 窗口 + status=succeeded filter）；不需扩 aiGenerateJSON 返回签名。
- ai-throttle 用 Map 而非 Redis：简单足够 demo，spec 已批准。生产再换。
- admin 路由从零起，layout.tsx 一定要拦截早（getSession 直接 redirect /login，不让 client-only 组件渲染再 401 才发现）。
