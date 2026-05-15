# Probe C · AI 助手切页/刷新/多 tab — Round 1

> qa@instance-workbench · 2026-05-15 静态代码 probe

## 1. AI 助手 state 矩阵

`app/teacher/ai-assistant/page.tsx:89-99` 11 个 useState：

| state | 类型 | 切页是否丢 | C1 是否需 persist |
|---|---|---|---|
| `activeTool` | ToolKey | ❌ 丢失 | ✅ |
| `text` | string | ❌ 丢失 | ✅ |
| `teacherRequest` | string | ❌ 丢失 | ✅ |
| `files` | File[] | ❌ 丢失 | ❌（localStorage 无法存 File，让用户重传）|
| `outputStyle` | string | ❌ 丢失 | ✅ |
| `strictness` | string | ❌ 丢失 | ✅ |
| `enableSearch` | boolean | ❌ 丢失 | ✅ |
| `submitting` | boolean | ❌ 丢失 | ❌（瞬态）|
| **`job: AsyncJobSnapshot`** | 富对象 | ❌ 丢失（关键 bug） | ✅ **必 persist** |
| **`result: AiResult`** | 富对象 | ❌ 丢失 | ✅ **必 persist** |
| `originalResult` | AiResult | ❌ 丢失 | ✅ |

## 2. 轮询机制（page.tsx:106-130）

```typescript
useEffect(() => {
  if (!job?.id || !processing) return;  // 切回页面后 state 重置 → 不会自动恢复轮询
  const timer = setInterval(async () => {
    const next = await fetch(`/api/async-jobs/${job.id}`);
    setJob(next);
    if (next.status === "succeeded") setResult(next.result);
  }, 1400);
}, [job?.id, processing]);
```

**关键观察**：deps `[job?.id, processing]` 切回 page 时这俩都 null/false → 不会自动重启轮询。即便后端 AsyncJob 还跑，前端不知道 jobId 就拉不回结果。

## 3. 4 工具共享同一 state

page.tsx:241 `onClick={() => setActiveTool(tool.key)}` — 4 工具共享 text/job/result。切工具 A→B 后，A 的进度+result 立刻消失。

**C1 必须**用 `key = aiAssistant.lastJob.${toolKey}` 给每个工具独立缓存。

## 4. AsyncJob schema + TTL

`prisma/schema.prisma:918-941` 包含 id/type/status/progress/result/error/createdAt 等。

**关键发现**：grep `purgeAsyncJobs / deleteMany.*[Aa]syncJob / DELETE FROM.*async` 在 lib/ 全部空。

**没有 24h 自动清理机制**。只有 sweep stuck：
- SWEEP_QUEUED_STUCK_THRESHOLD_MS = 60s
- SWEEP_RUNNING_STUCK_THRESHOLD_MS = 10min

old job 行**永久保留**（除非外部 cron job 删，未找到）。

**对 C1 影响**：
- plan acceptance 第 6 条"async-job 24h 后清除时 client fetch 404 → 清缓存" → **实际不会 24h 清除**，但代码逻辑保留：fetch 404 / 403 → 清缓存（应对 admin 手动删 + 跨账号场景）
- plan acceptance 第 4 条"job > 24h 自动 drop" → 纯客户端 TTL（createdAt + 24h 判断不 hydrate）

## 5. SSR hydration mismatch 防御

防御方法：
- ❌ 不在 `useState(initialFromLocalStorage)` 里直接读
- ✅ `useEffect(() => { const cached = localStorage.getItem(...); if (cached) setX(cached) }, [])` 延迟 hydrate
- 第一帧空（与 server 一致），第二帧恢复

## 6. Key naming（plan 已规划，细化）

```
aiAssistant.lastJob.lessonPolish     → { job, result, originalResult, text, teacherRequest, outputStyle, strictness, enableSearch, createdAt }
aiAssistant.lastJob.ideologyMining   → 同上
aiAssistant.lastJob.questionAnalysis → 同上
aiAssistant.lastJob.examCheck        → 同上
aiAssistant.activeTool               → 单独存（独立 key 因切工具不影响其他 3 工具）
```

## 7. C1 改动估算 ~300 行（可拆 r1a hook、r1b page）

| 改动 | 文件 | 行 |
|---|---|---|
| 新建 `usePersistedJob(toolKey)` hook（读写 localStorage + storage event + 24h TTL + 403/404 清缓存）| new `lib/hooks/use-persisted-job.ts` | +120 |
| 改 page.tsx：用 hook 替换 useState；切工具切 hook target；轮询逻辑增"切回时如缓存有 job.id 且仍 processing 立刻发轮询" | edit `app/teacher/ai-assistant/page.tsx` | +60 |
| tests vitest ≥3：hook 读写 / 24h 过期 / 切工具自动加载 | new `tests/use-persisted-job.test.ts` | +120 |

## 8. 风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| hydration mismatch | 🟢 低 | useEffect 延迟读 |
| Phase3-A 改 async-job.service 同时刻 | 🟢 低 | C1 仅调 API GET，不动 service |
| 跨账号污染 | 🟡 中 | 加 userId 字段或所有 403/404 清缓存 |
| localStorage 满 | 🟢 低 | 4 工具上限 8MB |
| storage event 兼容 | 🟢 低 | 现代浏览器全支持 |
| 4 工具 state 切换时残留 input | 🟡 中 | 切 activeTool 必须同步切 text/teacherRequest/outputStyle/strictness/enableSearch 5 input |

**builder 注意**：切 activeTool 时要把 cache 的 5 个 input state 全部 hydrate，不能只切 job/result。
