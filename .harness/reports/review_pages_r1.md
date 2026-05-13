# Stream D — 页面端到端 review (r1)

**审查范围**：`app/` 全部 page.tsx / layout.tsx / error.tsx / not-found.tsx + e2e 实测 9 个场景（学生、老师、跨账号、错误页、preview）。
**实测脚本**：`tests/e2e/review-pages.spec.ts`（9 测试，全部通过 44.9s）
**截图与 trace**：`.harness/screenshots/review-2026-05-13/pages/`（13 张 PNG + trace.log）
**Dev server**：`http://localhost:3000` 实跑，Playwright 1.60 + Chromium。

---

## 1. 主线流程（老师建 → 学生做 → AI 评 → 老师看）

整条主线在 dev 环境下**可走通**，但分钟级实测受限于种子任务的就绪度（既有种子里 sim 任务 ANL-2 等已经被学生完成，无法重放"老师从零建到学生提交"的端到端）。改走结构化判断：

- **跳转流畅**：未登录访问 `/dashboard`、`/teacher/dashboard`、`/grades` 均 307 → `/login`，平均 1.5s。登录耗时 0.9–1.8s（auth.js 写 cookie）。学生 dashboard 首屏 1.08s，`/grades` 0.95s，老师 dashboard 0.82s，老师 `/tasks` 2.22s（有 2s+ 偏长，疑为列表 N+1 include 拖累 — 见 §4）。所有页都用本地 `Loader2 + "加载中..."`，**没有 Next.js `loading.tsx` 文件**（全 0 个），所以路由级别 Suspense 边界不存在；首屏白屏依赖客户端 useEffect 首发请求。
- **学生 /grades 体验**：截图 05 显示 `AnalysisStatus` 三态（pending / analyzed_unreleased / released）chip + 等待文案完整渲染（PR-SIM-1c D1 防作弊机制），评估面板支持 rubric 详情。展示设计已成熟。
- **学生 dashboard**：截图 02 渲染 hero + KPI + 优先任务 + 公告四区，"加载中" 1s 内消失，控制台 0 报错（test 09）。

---

## 2. 权限边界（必须严守的红线）

**全部通过**：

- **学生 → `/teacher/dashboard`** → 不 redirect，直接渲染 `ForbiddenState`（`app/teacher/layout.tsx:32` 的 403 卡片）。截图 03 验证："你还不能看这个页面 · 教师工作台仅对教师和管理员可见"，按钮回到 `/dashboard`。这个设计**故意保留 URL**，比硬 redirect 体验好（用户知道自己在错的页面）。⚠️ 但 breadcrumb 仍显示 "学生 / 仪表盘"——topbar 是依据 role 渲染的，没回应当前路径。轻度 UX bug，非阻塞。
- **跨账号切换 cookie 串号**：test 07 切老师→学生后，`localStorage`、`sessionStorage` 全空（PR `9a761d1` 的 per-browser draft 清理生效）。学生再访问 `/teacher/tasks` 直接被 ForbiddenState 接住（截图 07c）。
- **API 端 ownership**：`app/api/lms/task-instances/[id]/route.ts:9` 通过 `requireRole(["teacher","admin","student"])` + `assertTaskInstanceReadable()` 双层校验，无 IDOR 风险。

---

## 3. 错误页 / loading 页 / 空态页

**这是最大问题域**。

- ❌ **零 `loading.tsx`**：`find app -name loading.tsx` 返回空。所有页面都用 client-side `useEffect` fetch + 本地 `Loader2` 转圈，意味着：(a) 没有路由级 Suspense；(b) 慢网络下用户看到 HTML 骨架 + 客户端 loading，**两层 loading 闪烁**。
- ❌ **不存在任务 ID 的 UX 差**：截图 04 学生访问 `/tasks/<bad-uuid>` → 仅一个红色感叹号 + "任务实例不存在"，**没有"返回首页"按钮**。截图 08b 同样在 `/sim/<bad-uuid>?preview=true` 体现，全屏只有错误文字，连侧边栏都没有（因 `(simulation)` layout 无 sidebar），用户陷死路。建议复用 `NotFoundState` 组件（同 `app/(student)/not-found.tsx`），加 secondary action。
- ✅ **统一的 error.tsx**：`app/error.tsx` 用 `ServerErrorState`，含 reset + 返回首页两按钮，digest 透出。`(auth)`、`(student)`、`teacher/` 各自有局部 error boundary。
- ⚠️ **`(simulation)/layout.tsx` 无 auth guard**：layout 仅 `<div bg-slate-50>`，全依赖 `sim/[id]/page.tsx` 的 client-side fetch + API 端 401。未登录用户**会先看到全屏白底加载中**，再被 API 401 触发本地 error → 显示 "加载失败"。建议参考 `(student)/layout.tsx:12` 加 `getSession() + redirect("/login")`。**安全上不破，但 UX 不一致**。

---

## 4. 三种任务类型对称性 + 代码工程小问题

- **三种类型路由分发**：quiz/subjective 走 `(student)/tasks/[id]/page.tsx`（带 sidebar），simulation 走 `(simulation)/sim/[id]/page.tsx`（全屏）。tasks 页 useEffect 检测到 simulation 会 `router.replace` 到 `/sim/[id]`（line 245），有 race window：fetch 完成 → setState → render → replace，期间用户看到一闪 quiz 不可用 fallback。可改为 server component prefetch 或在 fetch 前先看 URL hint。**非阻塞**。
- **预览模式**：仅 simulation 显式支持 `?preview=true`，quiz/subjective runner 也接 `isPreview` prop 但没看到老师端入口跳转传该参数（grep `?preview=true` 仅 sim 路径）。三类型对称性缺一块。
- **stale-closure / abort 检查**：
  - `(student)/dashboard/page.tsx:117` ✅ 用 `aborted` flag 防 setState-after-unmount。
  - `(student)/grades/page.tsx:57` ✅ 用 `cancelled` flag。
  - `(student)/tasks/[id]/page.tsx:231` ❌ **无 abort**，快速切换任务时会出现 setState on unmounted。
  - `(simulation)/sim/[id]/page.tsx:68` ❌ **无 abort**，同上。
  - 这两处 useEffect deps 含 `taskInstanceId` 是对的，但缺 cleanup，且 race 条件下两次 fetch 后到的会覆盖第一个。建议加 `AbortController`。
- **client/server 边界**：grep `lib/services` 在 `app/**/page.tsx` 仅有注释引用，**没有 service 泄漏到 client**。`lib/db` 也仅在 API 路由出现。三层架构 page→API→service→prisma 完整保持。
- **教师 tasks 页 2.2s**：`/teacher/tasks` 与 `/teacher/instances` 都 2s+，比 dashboard 慢 3×，疑似列表 N+1 include。需 Stream C 或 E 后续 profile 确认。

---

## 总结

- **阻塞**：0
- **次阻塞**：(1) `/tasks/<bad-id>` 和 `/sim/<bad-id>` 错误态无返回 CTA，用户陷死路；(2) `(simulation)/layout.tsx` 缺 server-side auth guard，未登录直闯先白屏。
- **轻量改进**：(a) 加 `loading.tsx` 让 Next.js Suspense 接管；(b) tasks/[id] + sim/[id] 加 AbortController；(c) 三任务类型预览入口对称化；(d) ForbiddenState 时 topbar breadcrumb 同步；(e) 教师列表页 2s+ 性能 profile。
- **亮点**：权限三层校验扎实、AI 评分三态 chip 设计成熟、跨账号串号已修复并验证、客户端 0 报错、UI 全中文化。

**测试矩阵 9/9 通过，截图 + trace 全部归档**。后续如需端到端实测"老师建任务→学生提交→AI 评分→老师看分"完整 flow，建议增加 seed reset + Playwright fixtures（≈1h 工作量）。
