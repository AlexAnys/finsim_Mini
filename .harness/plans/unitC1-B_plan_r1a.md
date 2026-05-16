# Unit C1-B · r1a · Mini Plan

> builder@instance-workbench · 2026-05-15
> C1-B 拆 3 commit：**r1a localStorage hook + page 集成（本 commit）** → r1b 4 工具差异化渲染分支 → r1c 阅读视图

## 目标（r1a only）

实现 `usePersistedJob(toolKey)` hook + 在 `app/teacher/ai-assistant/page.tsx` 用 hook 替换关键 useState；切回页面/刷新/跨 tab 时自动恢复 job 进度 + result + 5 个 input（text / teacherRequest / outputStyle / strictness / enableSearch）。

## 改动文件

| 文件 | 改动 | 估行 |
|---|---|---|
| `lib/hooks/use-persisted-job.ts` | 新文件 — localStorage 读写 + storage event + 24h TTL + 403/404 清缓存 | +130 |
| `app/teacher/ai-assistant/page.tsx` | 集成 hook：以 activeTool 为 key，hydrate 5 input + job + result + originalResult + autofetch + autopoll | +80 / -10 |
| `tests/use-persisted-job.test.ts` | vitest ≥3：读写、24h 过期、切工具加载 | +130 |

合计 ~340 行（拆为 r1a 单 commit 仍超 150 但 plan 明示 r1a/r1b/r1c 各 ~300 行）。

## 关键决策

1. **storage shape**：每个工具一个 key `aiAssistant.lastJob.${toolKey}`，value = `{ schemaVersion: 1, savedAt: number, job, result, originalResult, text, teacherRequest, outputStyle, strictness, enableSearch }`
2. **`activeTool` 单独 key** `aiAssistant.activeTool`（不影响其他 3 工具）
3. **SSR hydration**：`useEffect` 延迟读 localStorage（第一帧空，第二帧恢复）
4. **24h TTL**：读 cache 时检查 `savedAt + 24h < now()` → 视为过期、删 entry
5. **403/404 清缓存**：page 在 `useEffect` 内自动 fetch `/api/async-jobs/{id}` 拉最新状态，若返回 403/404 即 `clearCache()` + clear hook state
6. **自动恢复轮询**：切回页 + cache 有 job.id + status 是 queued/running → 立刻发起 fetch + 进入现有轮询 useEffect
7. **storage event 跨 tab 同步**：监听 `window.addEventListener("storage", ...)`，同 toolKey 发生变更则重 hydrate
8. **不存 File[]**：File 对象无法序列化；切回页时让用户重传（plan 已明示）
9. **不动 `lib/services/async-job.service.ts`**（Phase3-A 并行改）

## tsc + vitest 计划

- `npx tsc --noEmit` 0 新 error（已知 6 study-buddy 错误为 pre-existing，与 C1-B 无关）
- `npx vitest run tests/use-persisted-job.test.ts` 新测全过
- `npx vitest run` 全 suite 不引入回归
- vitest 环境是 node，无 `window`/`localStorage` → 测试中用 mock（`globalThis.localStorage = { ... }` + JSDOM-style 桩）

## 范围外（推到 r1b / r1c）

- r1b：4 工具差异化渲染分支（lessonPolish / ideologyMining / questionAnalysis / examCheck）
- r1c：阅读视图（read-only markdown 格式化 + 编辑切换 button）

## 风险

- vitest 缺 `localStorage` → 单测里桩入 `globalThis.localStorage = createMockStorage()`
- 切 activeTool 时 5 input + job/result 需"原子切换"——hook 设计上每次 hydrate 一次性返回全部 5 state，避免半成态
