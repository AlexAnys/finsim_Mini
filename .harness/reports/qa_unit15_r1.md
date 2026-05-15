# QA Report — Unit 15 r1

> QA: qa · 2026-05-15 · 验 commit `905ef4b` on `claude-demo-fixes` (Phase 4 第四个 unit)
> Bug: probe r1 M1-P1-3 (空数据 6 条机械重复) + M1-P2-3 (AI 失败文案过通用)
> Test spec: `tests/e2e/qa-unit15-empty-state.spec.ts` (5 case，独立于 builder unit15-verify.spec.ts)

## 测试数据 baseline

- **teacher2** 拥有 0 个 task → 0 graded subs → emptyState 路径
- **molly** 拥有 7 个 graded subs (6 在 7-day window) → AI 路径 (regression)

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| `WeeklyInsightPayload.emptyState?: boolean` | API contract + payload 内 key | payload 内有 emptyState key ✓ | PASS |
| 0 submissions short-circuit → emptyState=true + AI 不调用 | teacher2 GET `?force=true` | `payload.emptyState=true` + `modelUsed=null` + `durationMs=0` + `submissionCount=0` ✓ | PASS |
| classifyAiErrorSummary 4 分类 (超时/配额/未配置/其他) | builder 10 unit case | vitest 1089 pass ✓ | PASS (code-verified) |
| EMPTY_STATE_CACHE_TTL_MS = 5 分钟 | builder code + cache 透传测试 | cache spread 自动透传 emptyState; 5min TTL 后老师 release 能重新生效 | PASS (code-verified) |
| Modal: emptyState 或 4 数据全空 → CTA 卡 + 友好文案 + Link | teacher2 dashboard 实测 | 显示 **"本周尚无可聚合数据 / 本周尚无已批改且已公布的提交，暂无可聚合的洞察。请先去任务实例公布学生成绩，再回来重新生成一周洞察。"** + **Link "去管理任务实例" → /teacher/instances** (1 个) | PASS |
| Cache 透传 emptyState (5 min TTL) | 第二次 GET 不 force | cache hit 仍 emptyState=true ✓ | PASS |
| 有数据时 emptyState 不触发 (regression) | molly GET | submissionCount=6, payload.emptyState=undefined, modelUsed="mimo:mimo-v2.5-pro" ✓ | PASS |
| TypeScript / Vitest / ESLint 全绿 | 独立运行 | tsc 0 / **vitest 95 files / 1089 tests pass** (1076 baseline + 13 unit15 new) / 0 lint | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **95 files / 1089 tests pass** (1076 baseline + 13 unit15 new) |
| `npx eslint <6 builder files + QA spec>` | 0 error / 0 warning |
| `git show --stat 905ef4b` | 5 files +427/-9 与 build 报告完全一致 |
| Schema 改动 | 0 ✓ (payload 内字段不需 migration) |
| DB 测前测后 | read-only API tests, 0 副作用 |

## DOM 实证 — emptyState CTA

```
一周洞察
基于过去 7 天已批改并已公布的提交，结合接下来 7 天课表，生成跨课程 / 班级 / 任务的教学聚合视图。
时间窗口 2026-05-08 ~ 2026-05-15 · 本周纳入 0 份提交
缓存（7天）已缓存（2026-05-15 生成）

本周尚无可聚合数据                              ← CTA 标题
本周尚无已批改且已公布的提交，暂无可聚合的洞察。
请先去任务实例公布学生成绩，再回来重新生成一周洞察。
去管理任务实例                                 ← Link → /teacher/instances

本周亮点摘要 本周尚无已批改且已公布的提交，暂无可聚合的洞察。
各课弱点概念聚合 暂无可聚合的弱点概念
班级差异 暂无班级差异数据
学生聚类 暂无学生聚类数据
接下来课堂的教学建议 未来 7 天暂无相关课堂
重新生成（48s）  关闭
```

## API contract 实证

**teacher2 (emptyState path)**:
```json
{
  "data": {
    "payload": {
      "weakConceptsByCourse": [],
      "classDifferences": [],
      "studentClusters": [],
      "upcomingClassRecommendations": [],
      "highlightSummary": "本周尚无...",
      "emptyState": true            // ← Unit 15 新字段
    },
    "generatedAt": "...",
    "windowStart": "...",
    "windowEnd": "...",
    "submissionCount": 0,
    "cached": false,
    "modelUsed": null,              // ← AI 不调用
    "durationMs": 0,                // ← AI 不调用
    "inputTokens": null,
    "outputTokens": null,
    "costEstUSD": null
  }
}
```

**molly (AI path - regression)**:
```json
{
  "data": {
    "payload": { /* normal AI output, no emptyState key */ },
    "submissionCount": 6,
    "modelUsed": "mimo:mimo-v2.5-pro",
    ...
  }
}
```

## Cross-module / Backward Compat

- `WeeklyInsightPayload.emptyState?: boolean` — payload 内层 optional, cache spread `...cached.result` 自动透传
- `classifyAiErrorSummary(err)` 复用 highlightSummary 字段 — 不扩 schema
- 4 错误类别覆盖：超时（timeout/aborted/AbortError）/ 配额（rate limit/429/quota）/ 未配置（NOT_CONFIGURED）/ 通用（前 100 字截断）
- `EMPTY_STATE_CACHE_TTL_MS = 5 分钟` (vs 成功 7 天) — 平衡 cache 收益 vs release 反馈延迟
- Existing tests fixed (mock 加 1 sub 触发 AI 路径，避免 emptyState short-circuit 改变行为)

## Finsim-specific 检查

- ✅ UI 文案全中文 ("本周尚无可聚合数据" / "请先去任务实例公布学生成绩" / "去管理任务实例")
- ✅ Schema 0 改动
- ✅ Backward compat (老 cache 无 emptyState → UI 检查 4 数据组全空再 fallback CTA)
- ✅ AI 错误降级文案分级 (4 类 + 通用截断)
- ✅ Link 用 Next.js `<Link href="/teacher/instances">` 而非 `<a>` — 已修原 @next/no-html-link warn

## 风险 / 不确定项

1. **🟢 Schema 0 改动**: payload 内字段不需 migration
2. **🟢 EMPTY_STATE_CACHE_TTL_MS=5min**: 权衡 cache 收益 vs release 反馈延迟，合理
3. **🟢 错误分类完整**: 4 类 + 通用截前 100 字防爆量
4. **🟢 backward compat**: 老 cache 无 emptyState → UI 检查 4 数据组全空再 CTA
5. **🟢 既有 mock 测试已修**: 不破坏 cache/throttle 既有测试

## 是否引入新 bug

无。5 files +427/-9 scope 严格按 plan；vitest 1089 全过；DOM 实证 CTA 显示完整；测试 0 副作用。

## Issues found

无 blocker。

## Overall: **PASS**

**判断标准对照 (r1 即收 3 条件 — 无 schema 版)**：
1. ✅ QA 5 case (emptyState API + cache 透传 + modal CTA + 有数据 regression + API 字段完整) vs builder 3 e2e + 13 unit — 独立证据链
2. ✅ emptyState bool / modelUsed null / durationMs 0 / Link href / submissionCount 全 deterministic
3. ✅ DB cleanup 完整 (read-only)

**建议 r1 PASS 收工**。Phase 4 第四个 unit 干净结束。

Phase 4 进度: Unit 17 ✅ / Phase3-A ✅ / Unit 12 ✅ / Unit 15 ✅ / Unit 13/14/Phase3-B/Unit 16 待开。
