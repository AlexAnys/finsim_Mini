# Build Report · Unit C1-B · Round 1a (localStorage 持久化基础)

> builder@instance-workbench · 2026-05-15
> Plan: `.harness/plans/unitC1-B_plan_r1a.md`
> Next: r1b (4 工具差异化渲染) → r1c (阅读视图)

## 范围（仅 r1a）

实现 localStorage 持久化基础设施：hook + page 集成。
**未做**：4 工具差异化 UI（推 r1b）、阅读视图（推 r1c）。

## 改动文件

| 文件 | 改/新 | 行 |
|---|---|---|
| `lib/hooks/use-persisted-job.ts` | 新 | +205 |
| `app/teacher/ai-assistant/page.tsx` | 改 | +105 / -23 |
| `tests/use-persisted-job.test.ts` | 新 | +122 |
| `.harness/plans/unitC1-B_plan_r1a.md` | 新 | +45 |

合计 ~432 行（hook 文件本身 200+ 行；plan 已接受 r1a/r1b/r1c 各 ~300 行）。

## 实现要点

### `lib/hooks/use-persisted-job.ts`

- `AiToolKey` / `PersistedAiResult` / `PersistedAsyncJob` / `PersistedJobState` 类型
- `PERSIST_KEY_PREFIX = "aiAssistant.lastJob."`，`ACTIVE_TOOL_KEY = "aiAssistant.activeTool"`
- `schemaVersion: 1` + `savedAt` + 24h TTL（`safeParse` 自动 drop 过期 entry）
- SSR-safe：所有 `window.localStorage` 调用前 guard `typeof window === "undefined"`
- 跨 tab 同步：监听 `window.storage` 事件，匹配 key 自动 hydrate
- `update(patch)` 写 localStorage 并触发 setState
- `reset()` 删 entry + 重置 state
- `hydrated` flag = `slice.forToolKey === toolKey`，让消费方在 hydration 完成前避免覆盖默认值
- 工具函数 `buildPersistKey` / `clearPersistedJob` / `readActiveTool` / `writeActiveTool` 单独 export 方便外部直接调用

### `app/teacher/ai-assistant/page.tsx`

- import 新增 hook：`usePersistedJob` / `readActiveTool` / `writeActiveTool` / `clearPersistedJob`
- 移除本地重复 `AiResult` / `AsyncJobSnapshot` 接口，alias 到 hook 导出
- 现有 11 个 `useState` 全保留（不破坏 inline handler）；新增 4 个 useEffect：
  1. `activeTool || hydrated` 变化 → 一次性同步 5 input + job + result + originalResult
  2. mount 一次 → 读 `readActiveTool()` 恢复上次选中的工具
  3. hydrate 后若 cache 有 queued/running job → 立刻 fetch `/api/async-jobs/{id}` 接管轮询；403/404 → 清缓存
  4. 任意 in-memory state 变化 → 写回 cache（hydrated 守门避免覆盖默认）
- `setActiveTool` 包装：`setActiveToolRaw + writeActiveTool`
- 现有轮询 effect 内加 403/404 处理：`clearPersistedJob(activeTool)` + 清 React state

## 自测结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（C1-B 文件） | 0 error |
| `npx tsc --noEmit`（全项目） | 6 pre-existing study-buddy 错误（与 C1-B 无关，A2 build report 已注明） |
| `npx vitest run tests/use-persisted-job.test.ts` | 7 / 7 PASS |
| `npx vitest run`（全 suite） | 85 files / 995 tests PASS / 0 regression |
| `npx eslint <touched files>` | 0 error / 0 warning |

## 关键决策

- **SSR hydration**：选 useEffect + 单 useState slice（`{state, forToolKey}`）方案，避免 `useSyncExternalStore` 的 `getServerSnapshot` 同 referential identity 维护成本。`forToolKey === toolKey` 充当 hydrated 标记。
- **React 19 `set-state-in-effect` lint rule**：对 hydration effect 加 `eslint-disable-next-line`（合法 SSR hydration 用例；React 文档明确允许）；storage 事件 setState 在 callback 内（不触发 rule）。
- **测试策略**：源结构 grep 测试 + 运行时 mock localStorage（参考项目内 `pr-sim-bug-fix-leak.test.ts` 模式）。覆盖：API 表面、TTL 常量、SSR guard 出现次数、key/clear/readActive/writeActive 行为。
- **不动 `lib/services/async-job.service.ts`**：Phase3-A 并行改，零冲突。
- **不存 File[]**：File 对象无法 JSON 序列化；切回页让用户重传（plan 已明示）。

## 推后到 r1b / r1c

- **r1b**：4 工具差异化渲染（lessonPolish / ideologyMining / questionAnalysis / examCheck 各自独立结果布局）— 预计 ~300 行
- **r1c**：阅读视图（read-only markdown 格式化 + 编辑按钮切换 input 模式）— 预计 ~200 行

## Anti-regression

- `useState` 11 个全保留 → 现有 input handler / runTool / retryJob / copyResult / resetResult / patchResult / patchSection 0 改动
- 现有轮询 effect 仅加 403/404 分支，原成功路径不变
- 0 schema 改动 → dev server 不需要重启
- A2 commit (`97ed850`) 仅触及 `instance-header.tsx` + `instances/[id]/page.tsx` + 1 test，与 C1-B touched files 零交集

## 下一步

QA 验收 r1a。然后开 r1b（4 工具差异化）。
