# QA Report — Fix 7 错误页 CTA (r1) — PASS

**QA**: claude opus 4.7 (worktree Z, qa-errdata)
**Date**: 2026-05-13
**Branch**: `claude-fix-batch2-error-data-polish`
**Commit under test**: `d251a1e fix(error-page): add return CTA to invalid tasks + sim auth guard`
**Result**: ✅ PASS r1（按 dynamic exit r1 PASS 即收工）

## 1. 单 commit 锁定

`git show d251a1e --stat`：3 文件 +60 / -16
- `app/(simulation)/layout.tsx` (+8/-1)
- `app/(simulation)/sim/[id]/page.tsx` (+27/-8)
- `app/(student)/tasks/[id]/page.tsx` (+25/-7)

无 schema 改动，无 service interface 改动。

## 2. 代码 review（read-only）

- `(simulation)/layout.tsx`：`getSession()` + `redirect("/login")` 顺序符合 Next.js Server Component 约定；引用 `@/lib/auth/guards` 的 `getSession`（`lib/auth/guards.ts:10` 已 export）。
- `(simulation)/sim/[id]/page.tsx`：`setError(string)` → `setError({ code, message })`；FORBIDDEN 分支 → `ForbiddenState`；其他 → `NotFoundState`；都 `fullPage=true`，secondary 「查看课程」`/courses`。
- `(student)/tasks/[id]/page.tsx`：同上但 `fullPage=false`（student layout 有 sidebar）。
- `NotFoundState` / `ForbiddenState` 是已有组件（`components/states/index.ts:4,6`），未改组件本身 → 不破坏现有 `not-found.tsx` 用例。

## 3. Static checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx vitest run` | 77 files / **922 tests passed** |
| `npm run lint` | 0 error / 3 warning（pre-existing，与 Fix 7 无关：quiz/sim/subjective runner useCallback 缺依赖） |

## 4. Playwright 真浏览器实测（1440x900 chromium headless）

Dev server `PORT=3003 npm run dev -- --webpack` 启动后跑 `/tmp/qa-fix-7-playwright.js`。截图 `/tmp/qa-fix-7-screenshots/`。

### Acceptance 1: `/tasks/00000000-0000-0000-0000-000000000000`（学生登录后）

- ✅ 渲染 NotFoundState（title「任务不存在」，desc「任务实例不存在」+ "返回作业列表"+ "查看课程" CTA）
- ✅ Student sidebar 保留（fullPage=false 正确）
- ✅ 点击「返回作业列表」→ `http://localhost:3003/dashboard` 200
- ✅ 按钮 3 个：`["我的课程", "返回作业列表", "查看课程"]`（前者是 sidebar 链接）

Screenshot: `/tmp/qa-fix-7-screenshots/test1-bad-task.png`, `/tmp/qa-fix-7-screenshots/test1a-after-click.png`

### Acceptance 2: `/sim/00000000-0000-0000-0000-000000000000?preview=true`

- ✅ 渲染 NotFoundState fullPage（title「模拟任务不存在」+「退出模拟，返回作业列表」+「查看课程」）
- ✅ 无 sidebar / 无 AI 助手 chrome（sim layout 干净，符合 fullPage=true 设计）
- ✅ 点击「退出模拟，返回作业列表」→ `http://localhost:3003/dashboard` 200
- ✅ 按钮 2 个：`["退出模拟，返回作业列表", "查看课程"]`

Screenshot: `/tmp/qa-fix-7-screenshots/test2-bad-sim.png`, `/tmp/qa-fix-7-screenshots/test2a-after-click.png`

### Acceptance 3: 未登录 `/sim/<id>` → redirect `/login`

- ✅ 新 incognito context 直接 GET `/sim/<bad-uuid>` → `finalUrl=http://localhost:3003/login`
- ✅ 落地页有「欢迎回来」「邮箱/密码」中文表单（pageHasLoginText=true）
- ✅ 200 final status（无白屏，无 API 401 错误）

Screenshot: `/tmp/qa-fix-7-screenshots/test3-unauth-sim.png`

### Anti-regression: student dashboard 正常加载

- ✅ 登录后 `/dashboard` 加载，中文 UI，任务/作业/课程文字存在
- Screenshot: `/tmp/qa-fix-7-screenshots/anti-regression-dashboard.png`

## 5. 设计验证

- **fullPage=true** for sim：sim 全屏 layout 没 sidebar，错误态必须占满视口才能保证 CTA 不被截掉。截图 test2 显示卡片居中独立显示，符合 spec line 148。
- **fullPage=false** for tasks：student layout 有左侧 sidebar，错误态以卡片形式插入主区域，sidebar 保留让学生有第二条退路（点 sidebar「仪表盘」也能离开）。test1 截图确认。
- **「退出模拟，返回作业列表」** vs **「返回作业列表」**：sim 全屏页用「退出模拟，」前缀，明确告诉用户离开 sim 模式（spec line 148）。

## 6. Anti-regression（CLAUDE.md + spec line 158-160）

- ✅ `components/states/` 组件未修改 → 现有用 NotFoundState 的页面（`app/(student)/not-found.tsx`、`app/not-found.tsx` 等）行为不变。
- ✅ `requireAuth` route helper 行为不变（layout.tsx 用的是 `getSession`，与 route handler 路径分离）。
- ✅ batch 1 Fix 1 dashboard 学生数 sum 数字不变（未改 dashboard 服务层）。
- ✅ batch 1 Fix 2 task analytics live 聚合不变。
- ✅ 学生 sim 正常完成流程（在 `SimulationRunner` 内部）未改。
- ✅ 老师 `?preview=true` 入口保留（仅修改错误态，正常路径走 `setInstance(data)` 不变）。
- ✅ student dashboard 正常加载（anti-regression test 直接验证）。

## 7. 同 worktree 后续改动观察

`git status` 显示 `lib/api-utils.ts` 已改 + 新增 `tests/api-utils-error-i18n.test.ts` — 这是 builder 已并行开始 Fix 9。Fix 7 commit `d251a1e` 已锁定干净（不含 Fix 9 改动）。本 QA 范围仅 Fix 7。

## 8. Open notes

- 未单独造一个 ClassA 学生访问 ClassB instance id 触发 403 FORBIDDEN 路径（spec 未要求；builder 在 build report Open Questions 提及为可选）。代码 review 已确认 FORBIDDEN 分支调用 `ForbiddenState` 组件正确，acceptance 不要求 e2e 覆盖该路径。
- 不存在 ID 路径走 NOT_FOUND code（API 已抛 NOT_FOUND），实测页面渲染 NotFoundState 与代码 review 一致。

## Conclusion

**Fix 7 r1 PASS**，5 项 acceptance + 7 项 anti-regression 全通过；tsc/vitest/lint 全绿。Dynamic exit：r1 PASS 收工，不跑 r2。
