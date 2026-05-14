# Build Report — Fix 7 错误页 CTA (r1)

**Builder**: claude opus 4.7 (worktree Z)
**Branch**: `claude-fix-batch2-error-data-polish`
**Commit**: `d251a1e fix(error-page): add return CTA to invalid tasks + sim auth guard`

## Problem (recap)

Source: Stream D `review_pages_r1.md` 🟡。
- `/tasks/<bad-uuid>` 显示红色感叹号 + 文本「任务实例不存在」，**没有返回 CTA**，学生只能手动改 URL。
- `/sim/<bad-uuid>?preview=true` 更糟：`(simulation)/layout.tsx` 无 sidebar，错误时陷死路。
- `(simulation)/layout.tsx` 缺 server-side auth guard，未登录访问先白屏再被 API 401。

## Changes

3 files, +60 / -16:

### 1. `app/(simulation)/layout.tsx` — server-side auth guard

```ts
const session = await getSession();
if (!session?.user) {
  redirect("/login");
}
```

参考 `app/(student)/layout.tsx:12` 的 pattern。`requireAuth` 用于 Route Handler（返回 NextResponse），Server Component 用 `getSession()` + `redirect()`。

### 2. `app/(student)/tasks/[id]/page.tsx` — 错误态用 NotFoundState/ForbiddenState

- `setError(string)` → `setError({ code, message })`，保留 API 返回的 `error.code` 用于区分 FORBIDDEN vs NOT_FOUND
- 404 / 通用错误 → `<NotFoundState>` (`fullPage=false`，因 student layout 有 sidebar)
- 403 → `<ForbiddenState>` 同上
- Primary CTA「返回作业列表」→ `/dashboard`，Secondary「查看课程」→ `/courses`

### 3. `app/(simulation)/sim/[id]/page.tsx` — 同上 + fullPage=true

Sim 全屏页无 sidebar，必须 `fullPage` 模式占满视口才能让用户看到返回按钮。
- Primary CTA「退出模拟，返回作业列表」明确告诉用户这是退出 sim
- 移除 `import AlertCircle`（不再用 bare AlertCircle）

## Anti-regression

- ✅ NotFoundState / ForbiddenState 是已有组件（`components/states/`），未改组件本身
- ✅ Sim 正常加载 → 走 SimulationRunner 流程不变
- ✅ 老师 `?preview=true` 入口保留
- ✅ 学生 sim 完成后的正常退出（在 SimulationRunner 内）不破坏
- ✅ `requireAuth` route helper 行为不变（这里用的是 `getSession`）

## Verification

- `npx tsc --noEmit` ：0 错（无输出）
- `npx vitest run` ：77 files / 922 tests 全过

## Acceptance Coverage (待 QA Playwright 实测)

1. `/tasks/00000000-0000-0000-0000-000000000000` → 404 + 「返回作业列表」中文按钮，点击 → `/dashboard` ✓ (代码逻辑确认)
2. `/sim/00000000-0000-0000-0000-000000000000?preview=true` → 404 fullPage + 「退出模拟，返回作业列表」按钮 ✓
3. 未登录访问 `/sim/<id>` → server-side redirect `/login` ✓
4. tsc 0 / vitest 全过 ✓
5. Commit message 符合 spec 模板 ✓

## Open Questions / Notes

- QA 也可顺便验证 403 路径：以 ClassA 学生登录访问 ClassB task instance id，应该看 ForbiddenState（resource-access guard 早就在 API 层抛 FORBIDDEN）
- `NotFoundState` / `ForbiddenState` 已 export 在 `components/states/index.ts:4,6`
- 不动 `not-found.tsx`（已用 NotFoundState 完整）

## Next

继续 Fix 9（错误码中文映射 → `lib/api-utils.ts` 单文件）。
