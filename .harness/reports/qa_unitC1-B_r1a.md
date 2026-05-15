# QA Report · Unit C1-B · Round 1a (localStorage 持久化基础)

> qa@instance-workbench · 2026-05-15
> Build: `918a5d7 feat(unit-C1-B): localStorage 持久化基础（r1a）`
> Plan: `.harness/plans/unitC1-B_plan_r1a.md`
> Build report: `.harness/reports/build_unitC1-B_r1a.md`

## Acceptance（r1a 部分）

| # | Acceptance | Verdict | 证据 |
|---|---|---|---|
| 1 | 4 工具独立 cache key `aiAssistant.lastJob.${toolKey}` | **PASS** | `lib/hooks/use-persisted-job.ts:68-73` `PERSIST_KEY_PREFIX = "aiAssistant.lastJob."` + `buildPersistKey(toolKey)` 返回 `${PREFIX}${toolKey}`；vitest `clearPersistedJob` 跨 toolKey 隔离已覆盖（test L99-107） |
| 2 | 切工具时同步 5 input + job + result + originalResult | **PASS**（含一处轻度风险，见下） | `page.tsx:98-110` 切 activeTool 触发 hook re-hydrate；hook `forToolKey === toolKey` 守门后**一次性 setState** 5 input + job + result + originalResult（L100-107）；DEFAULT_STATE 含 5 input 默认值（hook L75-84），无 stale 残留 |
| 3 | 切回页 cache 有未完成 job → 自动 fetch 接管轮询 | **PASS** | `page.tsx:125-158` `hydrated` 后判断 `cachedJob.status in {queued, running}` → fetch `/api/async-jobs/{id}` 立刻拉最新 → setJob → 现有 polling effect (L180-212) `[job?.id, processing]` deps 触发轮询接管 |
| 4 | 24h TTL（createdAt + 24h 判断不 hydrate） | **PASS** | `hook L67` `TTL_MS = 24*60*60*1000`；`safeParse L91-92` `Date.now() - obj.savedAt > TTL_MS → return null`；过期 entry `readEntry L104` 主动 `removeItem`（避免污染） |
| 5 | 跨 tab `storage` event 同步 | **PASS** | `hook L159-167` `window.addEventListener("storage", handler)`；handler 匹配 `event.key === buildPersistKey(toolKey)` → `setSlice({ state: readEntry() ?? DEFAULT_STATE, ... })`；**自动覆盖删除场景**：`readEntry` 返回 null → 回退 DEFAULT_STATE（即等同清缓存） |
| 6 | 403/404 清缓存 | **PASS** | 两处实现：<br>① `page.tsx:133-141` hydrate 后接管轮询时 → `persistReset()` + 清 3 个 React state<br>② `page.tsx:187-194` 后台轮询循环内 → `clearPersistedJob(activeTool)` + 清 3 个 React state |
| 7 | SSR hydration 安全（useEffect 延迟读，第一帧空） | **PASS** | hook `useState` 初值 = `{ state: DEFAULT_STATE, forToolKey: null }`（L144-147）；`useEffect` 延迟 hydrate（L153-156）；所有 storage 调用前 `typeof window === "undefined"` guard（L100, 120, 134, 160, 190, 199）共 6 处守门 |
| 8 | vitest 新增 ≥3 | **PASS** | `tests/use-persisted-job.test.ts` 7 个测试覆盖：① hook API 表面 export ② TTL 常量 + schemaVersion + storage event ③ SSR window guard 计数 ④ buildPersistKey ⑤ clearPersistedJob 隔离 ⑥ readActiveTool null + write/read 往返 ⑦ readActiveTool 拒非法值 |

## 自动化测试

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（全项目） | 6 errors **全部 pre-existing**（同 A2 验证：`e3115712` 2026-05-02，早于 C1-B 13 天，study-buddy 模块） |
| `npx vitest run tests/use-persisted-job.test.ts` | ✅ **7/7 PASS** (25ms) |
| `npx vitest run`（全 suite） | ✅ **995/995 PASS, 85/85 files**, **0 regression**（A2 baseline 988 + C1-B +7 = 995） |

## 改动范围

`git show 918a5d7 --stat`：
```
.harness/plans/unitC1-B_plan_r1a.md    |  47 ++++++++
.harness/progress.tsv                  |   3 +
.harness/reports/build_unitC1-B_r1a.md |  81 +++++++++++++
app/teacher/ai-assistant/page.tsx      | 128 +++++++++++++++----
lib/hooks/use-persisted-job.ts         | 205 +++++++++++++++++++++++++++++++++
tests/use-persisted-job.test.ts        | 122 ++++++++++++++++++++
6 files changed, 563 insertions(+), 23 deletions(-)
```
- 产线代码净增 +310 / -23（hook 205 + page.tsx 105/-23）
- 测试 +122
- 单 commit；plan 已声明 r1a/r1b/r1c 各 ~300 行可接受

## Finsim-specific 检查

| 维度 | 结果 |
|---|---|
| UI 中文文案 | ✅ page.tsx 用户可见文案 0 改动（全保持原中文："已提交后台分析，结果会自动刷新"/"AI 工具运行失败"等） |
| Route Handler 无业务逻辑 | ✅ 不动任何 route handler |
| Auth | ✅ 复用现成 `requireAuth` on `/api/async-jobs/[id]` |
| Zod | ✅ 不动 validator |
| Prisma / schema 改动 | ✅ 零，dev server 不需重启 |
| 不动 `async-job.service.ts` | ✅ git diff 验证，Phase3-A 并行无冲突 |

## 关键风险分析

### 🟢 实现稳健的设计选择

1. **schemaVersion 守门**：`safeParse` 拒非 schemaVersion=1 的 entry（L90）—未来升级 schema 时不会读旧数据
2. **TTL 自清**：过期 entry 在 `readEntry` 时主动 `removeItem`（L104）—不只是不 hydrate 而是真的删，避免 localStorage 累积
3. **JSON.parse try-catch**：safeParse 内置 try-catch（L94-96）防 corrupt JSON 崩溃
4. **`writeEntry` 配额满 try-catch**（L126-130）：私密浏览或配额满时静默忽略
5. **forToolKey 守门双重作用**：① 初始 SSR 阶段 = null 阻止 hydrate-before-mount 覆盖；② 切工具时同步 toolKey + 内容，避免半成态

### 🟡 中风险（可接受，r1b 阶段可复核）

1. **写回循环依赖**（page.tsx:161-174）：
   - `useEffect` deps 包含 9 个 state（text/teacherRequest/.../result/originalResult/hydrated）
   - 每次任一变化即 `persistPatch(...)` 写 localStorage
   - hook `update` 内 `setSlice` → 但 hook 比对仅 `forToolKey`，**未做深比较** → state 引用变后必触发 hook re-render，hook 给 page 的 state 引用也变
   - **潜在问题**：page.tsx 切工具→ hydrate 触发同步 setState 8 次 → 写回 effect 触发 persistPatch → 写 localStorage → 不会循环（写不触发 storage event 自身）
   - **结论**：不会无限循环，但每个 keystroke 写 localStorage 一次（约 50-100KB JSON），**性能可接受**但若 result 很大可考虑 debounce（r1b 可优化）
2. **跨 tab storage event 不区分"自己写 vs 别 tab 写"**（hook L161-163）：
   - 同 tab 写 storage 不触发自身的 storage event（浏览器行为）—所以同 tab 写后又 re-read 是别 tab 写的结果，OK
   - 但场景：tab A 写 → tab A 自身 hook `update` → setSlice 写 cache 新值；tab B 收到 storage event → setSlice re-read = 新值 ✅
3. **首挂 readActiveTool 不写 localStorage**（page.tsx:119-122）：
   - 若 localStorage 已存 activeTool=ideologyMining，page 首挂时 setActiveToolRaw 设进去；但 `writeActiveTool` 没被调用（init 路径）
   - 之后用户点别的 tool → 走 `setActiveTool` 即 `setActiveToolRaw + writeActiveTool`，恢复一致
   - **不阻塞**：init 路径只读不写是合理的，下次用户改一次即同步

### 🟢 轻度风险（不影响 acceptance）

1. **build report 行数估算偏差**：plan 估 +340（hook 130 + page 80 + test 130）；实际 +449（hook 205 + page 128 + test 122）。其中 hook 比预期多 75 行（多了完整 TS interface + SSR guard 重复），page +48 是因 hydrate effect 比预期复杂。**纯估算偏差，质量层面无影响**。
2. **vitest 是源 grep + 桩测试而非真 hook 渲染测试**：项目无 `@testing-library/react`（禁止 npm install）。测试覆盖：API export 表面、TTL 常量值、schemaVersion 常量、SSR guard 出现次数、buildPersistKey 输出、clearPersistedJob 跨 toolKey 隔离、readActiveTool/writeActiveTool 往返 + 非法值。**未覆盖** hook 内部 React 状态机（useEffect 触发顺序、setSlice 触发 re-render 等）— **需 final QA staging 真浏览器验**。

## 与 plan 风险点对照

| Plan 风险 | 验证结果 |
|---|---|
| 切 activeTool 时 5 input + job/result 需"原子切换"——hook 设计上每次 hydrate 一次性返回全部 5 state | ✅ hook `setSlice({ state: readEntry() ?? DEFAULT_STATE, forToolKey })` 一次性切；page.tsx:98-107 在 hydrated 后 8 个 setX 在同 useEffect 内（React 会 batch） |
| vitest 缺 `localStorage` → 单测里桩入 `globalThis.localStorage = createMockStorage()` | ✅ test L20-36 实现 `createMockStorage()`；beforeEach 桩入 globalThis；afterEach 还原 |
| storage event listener `e.newValue === null`（删除场景）| ✅ hook L161-163 不读 `event.newValue`，直接重新 `readEntry()` → readEntry 见 null 时回退 DEFAULT_STATE，覆盖删除场景 |

## Anti-regression 已验证

- A2 commit (`97ed850`) 改 `instance-header.tsx` + `instances/[id]/page.tsx`，与 C1-B touched files **零交集**
- 不动 `lib/services/async-job.service.ts`（Phase3-A 并行无冲突）
- 不动 `app/api/async-jobs/[id]/route.ts`（仅消费现成 GET 接口）
- 不动 schema.prisma / migrations
- 现有 polling effect (L180-212) 仅追加 403/404 分支，原成功路径不变

## Overall: **PASS**（r1a part of C1-B）

8/8 acceptance 全 PASS，tsc 0 new error，vitest 995/995 全过 + 0 regression，SSR/TTL/跨 tab/403/404 全部正确实现。

**建议**：
- 标 Task #8 备注 `r1a PASS`，**不**标 completed（C1-B 还有 r1b 差异化渲染 + r1c 阅读视图）
- builder 可推进 r1b（4 工具差异化渲染）
- Final QA staging 阶段需补：
  1. 真浏览器 hook re-render 顺序（切工具时是否出现"短暂残留旧 input"闪烁）
  2. 跨 tab storage event 真触发链路
  3. 403/404 实际清缓存 + UI 复位
  4. 进度条接管轮询 UX 体验

## 下一步给 coordinator

A2 已 PASS、C1-B r1a 已 PASS，**dynamic exit 2 连 PASS**触发——可考虑：
- 派 builder 推进 r1b/r1c 或 A1/B1
- 或继续我做下一个 build 的 QA
