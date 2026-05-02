# Spec 草案: 一周洞察 → 异步化 + 每日 cron + 手动刷新

> 草案状态：待用户确认后切到 `spec.md` 启动 builder

## 用户原话

> "改成异步任务, 每天 trigger 一次,加老师可以手动刷新"

## 当前实现（已 review）

- [lib/services/weekly-insight.service.ts](lib/services/weekly-insight.service.ts) 474 行：`generateWeeklyInsight()` 直接同步调 AI，含 in-memory cache（`__clearWeeklyInsightCache`）
- [app/api/lms/weekly-insight/route.ts](app/api/lms/weekly-insight/route.ts) 27 行：HTTP GET 直接 await，**120s 阻塞**（QA R2 实测）
- 仪表盘 modal 用户点击 → 转 spinner 120s → 出结果（无白屏但偏慢）

## 已有基础设施可复用

- `model AsyncJob` 已在 schema（type / status / payload / result / error）
- [lib/services/async-job.service.ts](lib/services/async-job.service.ts) 已是 v2 的 async 任务核心
- [app/api/cron/release-submissions/route.ts](app/api/cron/release-submissions/route.ts) 是已有 cron pattern
- 环境变量 `CRON_TOKEN` 已在 .env.example

## 目标设计

### UX 三态

| 状态 | 触发 | 显示 |
|---|---|---|
| **缓存命中**（7 天内有 snapshot） | 用户点"一周洞察" | 立即显示 snapshot + "生成于 X 小时前" + "刷新"按钮 |
| **首次/过期** | 用户点"一周洞察" | enqueue AsyncJob + spinner（"正在生成本周洞察..."），polling 1s × max 180s |
| **手动刷新** | 用户点"刷新" | enqueue 新 AsyncJob（即使 cache 未过期）+ spinner |

### Cron 行为

每周一 06:00（北京时间·一周开始时）触发一次 `/api/cron/weekly-insight`：
- 遍历所有 teacher 角色
- 对每个 teacher batch enqueue AsyncJob（避免他第一次进 dashboard 就吃 120s）
- 用 `CRON_TOKEN` header 鉴权（沿用现有模式）

### Acceptance criteria

1. ✅ 仪表盘点"一周洞察"，**首次响应 < 1s**（不再 120s 阻塞）
2. ✅ 命中 cache 时立即显示 snapshot，标记"生成于 X 小时前"
3. ✅ 过期/首次显示 polling spinner，AsyncJob 完成后自动更新
4. ✅ "刷新"按钮可见（仅 cache 命中时显示），点击 → 强制重算
5. ✅ 每周一 06:00 cron 自动给所有教师生成 snapshot（周一早上进 dashboard 立即出结果）
6. ✅ Schema 三步舞跑完（migrate + generate + 重启 dev server）
7. ✅ `npx tsc --noEmit` 0 errors
8. ✅ vitest 全过（含至少 2 个新单测：cache 命中分支 + cache 过期分支）
9. ✅ 真浏览器验证：teacher1 点"一周洞察" 立即显示 cached / 点刷新触发 polling

## 改动范围

| 文件 | 改动 |
|---|---|
| `prisma/schema.prisma` | 加 `model WeeklyInsightSnapshot { id, teacherId, generatedAt, payload Json, expiresAt }` + AsyncJob type enum 加 `weekly_insight` |
| `lib/services/weekly-insight.service.ts` | refactor：抽出 `runWeeklyInsightJob(teacherId)` 作为 AsyncJob runner，老接口保留兼容 |
| `lib/services/async-job.service.ts` | 注册 `weekly_insight` handler |
| `app/api/lms/weekly-insight/route.ts` | GET：查 snapshot，命中返回 + 标记 stale；未命中或 force=1 → enqueue + 返回 jobId |
| `app/api/cron/weekly-insight/route.ts` | 新增：CRON_TOKEN 鉴权 → 遍历 teachers → batch enqueue |
| `app/teacher/dashboard/page.tsx`（含 modal 组件）| modal 改为三态显示（snapshot / spinner / refresh button）；polling 用现有 async-job 模式 |
| `.env.example` | 文档化 `CRON_TOKEN` 用途 |

## 实施顺序（builder 必须严格按此）

1. Schema 改动 → `npx prisma migrate dev --name add_weekly_insight_snapshot` → `npx prisma generate` → **杀掉并重启 dev server**（CLAUDE.md 三步舞，已多次踩坑）
2. service 层 refactor + AsyncJob handler 注册（typecheck 通过）
3. API route 改造（GET 三态：cache hit / enqueue+jobId / force-refresh）
4. Cron route 新增 + secret 鉴权
5. UI modal 三态实现 + 手动刷新按钮
6. 单测：cache hit / cache expire / force refresh 三个分支
7. 自检：tsc + vitest + lint
8. **builder 必做的 service-interface 影响检查**：grep 所有 `generateWeeklyInsight` caller，确认全部更新到新签名

## 风险（按 CLAUDE.md anti-regression rules）

- **Prisma 三步舞**：schema 改动后必须 migrate + generate + 重启 dev server。仅 generate 不够（CLAUDE.md 反复警告）。
- **service interface 改动**：`generateWeeklyInsight` 签名/返回值若变，所有 caller（dashboard.service / analytics-v2.service / API route）必须同步。
- **数据迁移**：现有 in-memory cache 切换到 DB snapshot 后，第一次访问会触发新生成。可接受（次日 cron 会预热）。
- **Cron 未在阿里云配置**：本 spec 只写 endpoint，**cron schedule 需要服务器层加 cron job 调用**（aliyun crond 或 GitHub Actions schedule）。这部分 ops 由用户决定，不在 builder 范围。
- **服务器迁移并行**：用户同时在做"切 Finsim-mbp 服务器"，cron 配置最好等服务器迁移完再做。

## 不做的事

- ❌ 不改 weekly-insight 的 AI prompt 内容
- ❌ 不改 5 段结构化输出格式（保持 user-visible 行为不变）
- ❌ 不删 in-memory cache 路径（保留作为 dev/test fallback）
- ❌ 不在本 PR 配置 cron schedule（仅提供 endpoint，schedule 配置另开 ops 任务）

## 报告路径

- builder：`.harness/reports/build_weekly-insight-async_r1.md`
- qa：`.harness/reports/qa_weekly-insight-async_r1.md`
- progress.tsv：`<ts>\tweekly-insight-async\tr1\t<verdict>\t<cost>\t<注>\t<commit>`

---

## ⚠️ 等用户确认才启动

确认点：
1. 7 天缓存窗口是否合适？（一周洞察按周变化，24h 应该够）
2. cron 周一 06:00 北京时间合适吗？（避开教师查看高峰）
3. "force refresh" 是否需要权限保护？（防止恶意刷爆 LLM quota）建议加节流：每教师每小时最多 3 次手动刷新
