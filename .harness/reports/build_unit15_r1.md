# Build Report — Unit 15 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit15_plan_r1.md`
> Bug: probe r1 M1-P1-3 (空数据 6 条机械重复) + M1-P2-3 (AI 失败文案过于通用)

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/weekly-insight.service.ts` | +84 / -6 | (1) WeeklyInsightPayload 加 `emptyState?: boolean`; (2) 新 `classifyAiErrorSummary(err)` helper 4 类错误分级; (3) 0 submissions short-circuit 直接返回 emptyState=true + AI 不调用; (4) `EMPTY_STATE_CACHE_TTL_MS = 5 分钟`（缩短，老师 release 后能在 5min 内重新生效）; (5) AI catch 用 classifyAiErrorSummary + 标 emptyState=true |
| `components/teacher-dashboard/weekly-insight-modal.tsx` | +33 / -1 | WeeklyInsightUiPayload 加 emptyState; Link + Inbox/ArrowRight 图标导入; 当 emptyState OR 4 数据组全空 → CTA 卡显示 highlightSummary + "请先去任务实例公布学生成绩，再回来重新生成一周洞察。" + Link "去管理任务实例" → /teacher/instances |
| `tests/pr-dash-1e-weekly-insight.test.ts` | +43 / -6 | 修 2 个既有 cache/throttle 测试给 mock 加 1 submission 触发 AI 路径；改 "returns 200 with payload" 测期望 emptyState 短路行为 |
| `tests/weekly-insight-empty-error.test.ts` (新) | +124 | 13 case (classifyAiErrorSummary 10 + emptyState short-circuit 3) |
| `tests/e2e/unit15-verify.spec.ts` (新) | +110 | 3 case (A1 teacher2 0 subs → emptyState API / B1 modal CTA 显示 / C1 cache 透传 emptyState) |

**生产代码**：117 / -7
**测试**：277
**Total**：~394（plan 估 200 prod + 200 tests = 400，命中）

## 关键决策实施（按 coordinator 批准 + 额外提醒）

1. ✅ **emptyState 放 payload 内** — UI 单层读取，cache spread `...cached.result` 自动透传
2. ✅ **错误文案复用 highlightSummary** — 不扩 schema 字段
3. ✅ **cache 仍写 emptyState（5 分钟 TTL）** — 按 coordinator 额外提醒"避免老师 release 完才生效"，权衡选 5min 短 TTL
4. ✅ **classifyAiErrorSummary 4 分类**：超时（timeout/aborted/AbortError）/ 配额（rate limit/429/quota）/ 未配置（NOT_CONFIGURED）/ 通用（截前 100 字 err.message）

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 95 files / 1089 tests pass (1076 baseline + 13 unit15 new)
eslint: 0 new issue on builder modified files (修 a→Link href 之前的 @next/no-html-link 也消除)
```

### Unit tests (13 cases all pass)
```
classifyAiErrorSummary:
  ✓ 超时 (timeout / aborted / AbortError) — 3 case
  ✓ 配额耗尽 (rate limit / quota) — 2 case
  ✓ 模型未配置 (AI_PROVIDER_NOT_CONFIGURED) — 1 case
  ✓ 其他错误通用文案带前 100 字 — 1 case
  ✓ 超长 err 截到 100 字 + 省略号 — 1 case
  ✓ 非 Error 类型（字符串 / object） — 2 case

generateWeeklyInsight emptyState:
  ✓ 0 submissions → emptyState=true + AI 不调用 + modelUsed=null + durationMs=0
  ✓ 0 submissions cache 命中 (cached=true 仍 emptyState=true)
  ✓ AI 失败时 emptyState=true + classifyAiErrorSummary 文案
```

### Playwright E2E (3 cases all pass)
```
[A1] teacher2 (0 graded subs) → API emptyState=true / modelUsed=null / durationMs=0: ✓ (26.4s)
[B1] teacher2 dashboard 打开 modal → CTA 卡显示 "本周尚无可聚合数据 + 去管理任务实例": ✓ (9.9s)
[C1] 第二次 GET 命中 cache 仍 emptyState=true: ✓ (7.0s)

Serial 3/3 PASS
```

### 截图
- `.harness/screenshots/unit15-verify/B1-emptyState-cta.png` — modal 完整显示 CTA 卡 "本周尚无可聚合数据" + 友好文案 + "去管理任务实例 →" 按钮

## 风险 / 不确定项

1. **🟢 schema 0 改动**：emptyState 在 payload JSON 内，不动 Prisma
2. **🟢 cache 透传**：`...cached.result` 自动包含 emptyState 字段
3. **🟢 5 分钟 TTL** vs 7 天：emptyState 缩短到 5min，正常成功结果仍 7 天 — 老师 release 后最多等 5 min 重新生成；用户点"重新生成"force=true 走 Unit 11 throttle 60s（即时生效）
4. **🟡 AI 失败时 emptyState=true** — modal CTA 卡会显示，文案是 classifyAiErrorSummary。如果是 "AI 模型未配置"，CTA 仍推 "去管理任务实例" — 文案 + CTA 不太一致（应该推 /teacher/ai-settings）。**接受妥协**：spec L31-32 CTA 文案固定，错误分级只改 highlightSummary 文字内容，CTA 链接保持单一目标
5. **🟢 IMAGE_EXTENSIONS / DEFAULT_ALLOWED_EXTENSIONS** 未被影响（Unit 12 改动）
6. **🟢 Unit 11 throttle 兼容**：force=true 路径不变，仍 60s 节流

## Acceptance 对照

| spec 要求 | 状态 |
|---|---|
| 0 submissionCount 不调 AI 直返 emptyState | ✅ short-circuit + unit test 验证 AI 0 调用 |
| UI modal emptyState 显示 CTA + 跳 /teacher/instances | ✅ Link 跳转 + B1 截图 |
| LLM 失败分级 4 类 | ✅ classifyAiErrorSummary 10 unit case 覆盖 |
| modal cache + emptyState 仍 CTA | ✅ C1 实证 cache=true + emptyState=true |
| tsc/vitest/lint 全过 | ✅ |

## 不在本范围

- ❌ "未配置"错误 CTA 改推 /teacher/ai-settings（保持单一 CTA 链接）
- ❌ payload 加 errorCode 字段（避免扩 schema）
- ❌ 后端 throttle 改时长（Unit 11 范围）

## 反思

- 既有测试 mock 用空数组，Unit 15 short-circuit 后这些测试断言失败（AI 0 调用而非 1）。修测试比绕过逻辑更 production-grade — 测试是契约，行为变了契约也要更新
- coordinator 提醒"emptyState cache TTL 缩短"采纳为 5 分钟 — 在 user experience 与 cache hit rate 之间取实用平衡
- modal 添加 Link 替代 `<a>` 第一次提交 lint 抓到 `@next/no-html-link-for-pages`，及时修正——pre-commit 风格统一项目规则
