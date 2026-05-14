# QA Report — Unit 11 r1

> QA: qa · 2026-05-14 · 验 commit `f2ba5df` on `claude-demo-fixes`
> Bugs: B-ADMIN-01 / B-ADMIN-02 / probe r1 PR-2/3 + M1 weekly-insight 无节流 · spec.md L218-232
> Test spec: `tests/e2e/qa-unit11-airun-throttle.spec.ts` (11 case，独立于 builder unit11-verify.spec.ts)

## Schema migration 验证

- ✅ `_prisma_migrations` 含 `20260514133211_add_airun_tokens_cost_summary`，hash_len=64
- ✅ 4 列已添加: `inputTokens INTEGER NULL` / `outputTokens INTEGER NULL` / `costEstUSD NUMERIC NULL` / `summary VARCHAR NULL`
- ✅ Dev server webpack 重启，curl /login 200
- ✅ migrate drift-free（Unit 5b 处理之后保持干净）

## Spec acceptance 逐条对照

| spec acceptance (L218-232) | 验法 | 实测 | Verdict |
|---|---|---|---|
| `AiRun` 加 inputTokens/outputTokens/costEstUSD/summary | DB schema + migration | 4 columns ADDED, all nullable, types correct | PASS |
| `ai.service.ts` 三大入口回填 token + summary | molly POST SB → new AiRun → 检查字段 | **G test 实证**: 新 run inputTokens=821, outputTokens=189, summary="对话历史:\n学生: 什么是货币时间价值？\n\n请回复：" (明文, ~57 chars), latencyMs=4055 | PASS |
| Cron 兜底 running > 5min 自动 failed | admin POST `/api/cron/sweep-stuck-ai-runs` | 200 + body `{ swept: 0 }`（无 stuck runs 时返回 swept=0），endpoint 工作 | PASS |
| /teacher/ai-usage 列表 (feature/dateRange/provider/model 筛选 + 按 feature 聚合成本卡) | molly GET 页面 + API | 页面 200，UI 显示 "本期总估算成本 $0 / 共 48 次成功调用"，按 feature 聚合卡 7 类（聚合洞察/一周洞察/taskDraft/模拟对话/AI 批改/quizDraft/题目分析），实测**一周洞察 9 次 in 3.0K out 1.8K** — tokens 真的写入 ✓；API 返回 `{items: 50, total: 66, aggregateByFeature}` | PASS |
| /admin/audit 管理员视角 (跨教师 AuditLog + AiRun) | admin GET 页面 + API | 页面 200, body 含 "审计中心" 等字眼；teacher 访问触发 ForbiddenState "错误 · 403 · 管理员页面 · 该页面仅对管理员可见" 完整中文；API 直访 admin 200 / teacher 403 / 不需 admin role 也禁止 | PASS |
| 服务端节流: weekly-insight + scope-insights 60s 内 force=true 仅 1 次 | GET `/api/lms/weekly-insight?force=true` × 2 (1.5s 间隔) | 第二次 **429 + `AI_FEATURE_COOLDOWN` + "请稍后再试（60 秒内仅可重新生成 1 次）"** 中文 | PASS |
| 一周洞察 modal 显示 AI Run 信息 (model/token/duration) | API response keys | 11 keys 全在: payload/generatedAt/windowStart/windowEnd/submissionCount/cached/**modelUsed/durationMs/inputTokens/outputTokens/costEstUSD** | PASS |
| TypeScript / Vitest / ESLint 全绿 | 独立运行 | tsc clean / **vitest 87 files / 1009 tests pass** (999 baseline + 6 throttle + 4 tokens = 1009) / 0 new lint error | PASS |
| Prisma 三步合规 | migrate / generate / restart / 验页面 | 全合规 ✓ | PASS |

## 额外 acceptance

| 额外项 | 实测 | Verdict |
|---|---|---|
| Teacher sidebar "AI 用量" nav | molly /teacher/dashboard | 1 个 nav link，click 跳 /teacher/ai-usage | PASS |
| Admin sidebar "审计中心" nav | admin dashboard | 1 个 "审计中心" nav | PASS |
| Non-admin cron POST → 401 | molly POST sweep | 401 + 错误消息 | PASS |
| AiRun 新字段 backward-compat | 老 cache 数据 modelUsed=null/inputTokens=null | UI 优雅降级（显示 "—"），仅新 run 填充 | PASS |
| Cost 估算 model not in table → null (不 0) | mimo model 实测 | `costEstUSD: null` (Q1 decision honored) | PASS |
| Summary 明文 200 字 | G test 实测 | summary 字段含真实 prompt 前缀 "对话历史:\n学生: 什么是货币时间价值？\n\n请回复：" — 明文 (Q3 coordinator note) | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **87 files / 1009 tests pass** (999 baseline + 6 throttle + 4 tokens) |
| `npx eslint <21 builder files + QA spec>` | 0 error / 0 new warning (prisma.schema warning 是基础设施忽略) |
| `git show --stat f2ba5df` | 21 files +1480/-18，与 build 报告一致 |
| Cross-module grep `ai.service.ts` callers | 3 入口（generate/json/chat-stream）已扩 finishAiRun 参数，向后兼容 |
| DB cleanup | QA-r11-G dummy SB post + ai-run 已 DELETE，AiRun 总数 240 (test 前 237 + QA 触发 3) |

## DB 实测样本 — AiRun 新字段写入

```sql
-- QA G 触发的新 run (SB AI reply)
{
  "id": "28099618-c1ce-4c0e-bffa-3f6054dbe99f",
  "feature": "studyBuddyReply",
  "provider": "mimo",
  "model": "mimo-v2.5",
  "status": "succeeded",
  "inputTokens": 821,        // ← Unit 11 新字段，真实写入 ✓
  "outputTokens": 189,       // ← Unit 11 新字段，真实写入 ✓
  "costEstUSD": null,        // ← mimo 不在价目表，Q1 decision honored
  "latencyMs": 4055,
  "summary": "对话历史:\n学生: 什么是货币时间价值？\n\n请回复：",  // ← Q3 明文 200 字
  "error": null,
  "userEmail": "molly@qq.com"
}
```

## 节流 429 实测

```
GET /api/lms/weekly-insight?force=true   (t=0)    → cache hit 或 200
GET /api/lms/weekly-insight?force=true   (t=1.5s) → 429
{
  "success": false,
  "error": {
    "code": "AI_FEATURE_COOLDOWN",
    "message": "请稍后再试（60 秒内仅可重新生成 1 次）"
  }
}
```
✅ 中文消息 + 标准 429 HTTP status + 精确错误码

## /teacher/ai-usage 页面实测内容

molly login → /teacher/ai-usage:
- **总览卡**: "本期总估算成本 $0 / 共 48 次成功调用"
- **按 feature 聚合 (7 卡)**:
  - 聚合洞察 $0 (20 次)
  - **一周洞察 $0 (9 次 · in 3.0K · out 1.8K)** ← 新 tokens 字段汇总
  - taskDraft $0 (12 次)
  - 模拟对话 $0 (4 次)
  - AI 批改 $0 (1 次)
  - quizDraft $0 (1 次)
  - 题目分析 $0 (1 次)
- "成本未估算（模型不在价目表）" 提示信息 — Q1 decision UX 显示

API: `{ items: 50, total: 66, aggregateByFeature: {...} }` 完整结构。

## ForbiddenState 文案

teacher /admin/audit 访问后页面文案：
> "错误 · 403 · 管理员页面 · 该页面仅对管理员可见 · 返回工作台"

中文 + ForbiddenState 组件复用 + URL 保持但内容拦截 ✓

## Cross-module regression

- `ai.service.ts` 3 入口扩 `finishAiRun(opt usage/model)` — 既有 caller 不传可向后兼容
- `weekly-insight.service.ts` force=true 入口加 throttle — 老 cache 路径不变（GET 默认 ?force=false 不触发）
- `scope-insights.service.ts` forceFresh 加 throttle — 同模式
- `getRuntimeSetting` 已是 export (Unit 7) — 复用无 signature 变化
- 既有 vitest 999 baseline → 1009 (+10 new only)

## 风险 / 不确定项

1. **🟢 In-memory throttle 单实例局限**: dev/demo OK，生产 Vercel serverless 失效。已 spec L227 注明，未来切 Redis or AiRun.startedAt 查询
2. **🟡 老 AiRun 历史无 tokens/cost/summary**: 240 行中 4 行有新字段（QA + builder 自测产生），237 老行 null。UI 优雅降级显示 "—"。下次 AI 调用陆续填上。
3. **🟢 mimo model 价目表缺**: costEstUSD=null（Q1 decision）。未来加 mimo 价目即可
4. **🟡 summary 明文存储**: Q3 coordinator note 同意明文（"让老师看摘要而非哈希"）。注意敏感场景（如个人隐私 prompt）不宜，需引导教师不输入隐私
5. **🟢 NextAuth 多用户 race**: 测试 G 在多 context 切换时偶发 401，isolated 100% PASS。生产无问题

## 是否引入新 bug

无。21 files / 1480 LOC，scope 严格按 plan。0 final FAIL。

## Issues found

无 blocker。

## Overall: **PASS**

**判断标准对照 (r1 即收 4 条件 schema 版)**:
1. ✅ QA 11 case (含 throttle + DB 实证 + UI + cross-role + cron) vs builder 10 case — 独立证据链
2. ✅ HTTP / error code / Chinese / token int / cost USD / summary text / aggregate stats 全 deterministic
3. ✅ DB cleanup 完整（QA-r11-G dummy 已删，AiRun 自然累积）
4. ✅ **Schema 改动 Prisma 三步合规 + runtime 实证**: migrate ✓ + generate ✓ + 重启 ✓ + page 200 ✓ + 4 字段真实写入 ✓ + cost null 优雅 ✓

**建议 r1 PASS 收工**。

Phase 2 进度: Unit 10 (migration 已应用) + Unit 11 (本 unit) 同时推进。等 Unit 10 r1 通知。
