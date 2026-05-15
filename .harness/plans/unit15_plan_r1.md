# Unit 15 Plan — 一周洞察 LLM 空数据 + 错误降级文案分级

## 调研

- `weekly-insight.service.ts:386` 当前流程：构造 prompt → 调 AI → catch 通用降级。空数据时仍然调 AI（造成机械重复）+ AI 失败时单一通用文案
- `WeeklyInsightPayload` 缺 emptyState flag；UI modal 也没 emptyState 分支
- Modal `data.payload.weakConceptsByCourse.length === 0` 已显示空文案但**没有 CTA 引导**
- API route `/api/lms/weekly-insight/route.ts` cache 路径 spread `...cached.result`，所以新加字段会被透传

## 改动

| 文件 | 改动 |
|---|---|
| `weekly-insight.service.ts` | (1) `WeeklyInsightPayload` 加 `emptyState?: boolean`。 (2) generateWeeklyInsight 在调 AI 前 check `submissions.length === 0` → 跳过 AI、直接返回空 payload + emptyState=true + modelUsed=null + durationMs=0。 (3) AI catch 块：分类 err.message 关键字（"timeout"/"aborted"/AbortError → 超时；"rate limit"/"quota"/429 → 配额；"NOT_CONFIGURED"/"AI_PROVIDER" → 未配置；其他 → 通用 + 截前 100 字 err msg）；输出对应中文文案进 highlightSummary。 |
| `components/teacher-dashboard/weekly-insight-modal.tsx` | 检测 `data.payload.emptyState === true` 或 4 个数据数组全空时显示**emptyState CTA 卡**："本周尚无已公布的提交，先去任务详情公布成绩，再生成洞察" + "去管理任务实例"按钮 → `/teacher/instances` |
| `tests/weekly-insight-empty.test.ts` (新) | unit: 0 submissions → 返回 emptyState=true + AI 未被调用 |
| `tests/weekly-insight-error-classify.test.ts` (新) | unit: timeout/rate-limit/未配置/其他 4 类错误文案 |
| `tests/e2e/unit15-verify.spec.ts` (新) | e2e: 注入 teacher 无 submission → API 返回 emptyState; modal cache hit + emptyState 也显示 CTA |

## 决策

- **emptyState 字段位置**：放在 `payload` 内部（与 highlightSummary 同层）— UI 只读 payload 一层，cache spread 也自动透传
- **AI 失败文案存哪**：复用 `highlightSummary` 字符串字段 + payload 4 数组空（不引入 errorCode 字段，避免扩 schema）。Modal 已有"无可聚合数据"渲染，AI 失败时复用同一空状态 + 文案在 highlightSummary
- **超时错误识别**：err.message 含 `timeout` 或 `aborted` 或 `AbortError`（Vercel SDK 30s 限制）
- **配额错误识别**：含 `rate limit` / `429` / `quota` / `RATE_LIMIT`
- **未配置错误识别**：含 `AI_PROVIDER_NOT_CONFIGURED` / `NOT_CONFIGURED`
- **emptyState cache 行为**：emptyState 结果也写 7 天 cache（避免每次 fetch 都查 DB）。第二次 fetch 命中 cache → 仍 emptyState=true → UI 仍 CTA

## 风险

- 🟢 schema 0 改动
- 🟢 cache spread `...cached.result` 自动透传新字段 emptyState
- 🟢 错误分类 fallthrough → 默认通用文案 + 截 100 字 err message（避免暴露敏感堆栈）
- 🟡 modal cache 显示 CTA 与 spec L6 一致（emptyState 是 stable 状态，cache 不破坏）

## Acceptance 对照

| spec 要求 | 状态 |
|---|---|
| 0 submissionCount 不调 AI 直返 emptyState | ✓ |
| UI modal emptyState 显示 CTA + 跳 /teacher/instances | ✓ |
| LLM 失败分级（timeout/quota/not configured/其他） | ✓ 复用 highlightSummary 4 文案 |
| modal cache + emptyState 仍 CTA | ✓ (cache 透传 emptyState=true) |
| tsc/vitest/lint 全过 | ✓ |
| e2e 验证 emptyState 路径 | ✓ |

预计 ~200 行 prod + ~200 行 tests / 0 schema / r1 即收概率高。
