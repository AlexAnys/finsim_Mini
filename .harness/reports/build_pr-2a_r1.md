# Build Report · PR-2A · TopBar 共享 shell · r1

**Date**: 2026-04-24
**Builder**: builder-p2
**Scope**: Phase 2 PR-2A — build a shared top bar and mount it into both `(student)` and `teacher` layouts.

## Files changed

| File | Action | Net lines |
|---|---|---|
| `components/layout/topbar.tsx` | NEW | +130 |
| `lib/layout/breadcrumbs.ts` | NEW | +58 |
| `tests/breadcrumbs.test.ts` | NEW | +59 |
| `app/(student)/layout.tsx` | EDIT | +3 / −1 |
| `app/teacher/layout.tsx` | EDIT | +3 / −1 |

Total ≈ 250 net lines (spec budget 250).

## Design decisions

- **TopBar is a client component** — it needs `usePathname` for breadcrumb and `useSession` + `signOut` for the avatar dropdown. Layouts stay RSC and pass `initialRole` / `initialName` as SSR seed to avoid role-flash, same pattern PR-1A established for `Sidebar`.
- **Breadcrumb logic extracted to `lib/layout/breadcrumbs.ts`** (pure, no React) so it's trivially unit-testable. The client component imports `deriveCrumbs` from there.
- **Opaque id detection**: regex `/^[0-9a-f-]{8,}$/i` — matches UUIDs / cuids used throughout this app. Segments that match are skipped so `/teacher/courses/<uuid>` renders `教师 / 我的课程` (last-crumb still maps correctly).
- **`/teacher/...` prefix** is stripped from segment parsing because the role root (`教师`) already represents it — avoids the redundant `教师 / 教师 / ...`.
- **Mobile strategy**: TopBar is `hidden lg:flex`. The sidebar already renders its own 56px top bar on mobile (`lg:hidden`) containing the menu trigger + Wordmark — adding the desktop topbar on mobile would double-stack. Mobile still has sidebar + its own top chrome; topbar is desktop-only per spec (which permits hiding breadcrumb on mobile, and in practice the Menu trigger is already there).
- **Z-index**: topbar is `z-30`. Sidebar mobile bar is `z-40` — safe because topbar is `hidden` at that breakpoint. Sidebar desktop is positioned with `lg:fixed lg:inset-y-0` (no explicit z in the fixed block), so sticky `top-0 z-30` on the topbar sits above page content correctly.
- **User menu dropdown**: keeps the existing `signOut({ callbackUrl: "/login" })` logic from the sidebar user card. Sidebar's user card still has its own sign-out button — two entry points, one shared behavior, no dependency. A future pass could pull that to a single component once design confirms.
- **"AI 助手" button**: purely visual per spec — `variant="secondary"` with `bg-brand-soft text-brand`, no handler, matches the ghost-ish look in `app-shell.jsx` line 99. Will wire in Round 5 alongside the task wizard sheet.
- **Notification button**: `Bell` icon, ghost button, no unread badge yet (spec says "假设数据" optional, kept placeholder-only to avoid fake state leaking into QA). Actual notifications belong to a future backend feature.

## Layout integration

Both layouts changed identically:
- Added `<Topbar />` mounted inside `<main>` above the content wrapper.
- `<main>` became `flex flex-col min-h-screen`, so Topbar sticks via `sticky top-0` and content fills below.
- Content wrapper kept `p-6 pt-20 lg:pt-6` — on mobile the sidebar's own top chrome still needs `pt-20` clearance; on desktop the new sticky topbar doesn't need extra top padding because it's part of the flex column and content starts directly after it (`pt-6` is just visual).

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors (clean) |
| `npx vitest run` | 82/82 pass (+8 new `breadcrumbs.test.ts`) |
| `npm run build` | Pass — all 25 routes compiled, no new warnings |
| `npm run lint` | 147 errs / 8 warns unchanged from baseline (pre-existing), 0 new from this PR |
| Dev server restart needed | No — pure UI PR, no Prisma / server-only code |

## Breadcrumb unit test coverage

`tests/breadcrumbs.test.ts` (8 cases):
1. `/dashboard` + `student` → `学生 / 仪表盘` (last=true on tail)
2. `/teacher/courses` + `teacher` → `教师 / 我的课程` (prefix strip)
3. `/teacher/courses/<uuid>` → opaque id filtered
4. Unknown segment falls back to raw (e.g. `custom-page`)
5. Root `/` → only role crumb, isLast=true
6. `admin` role → `管理员` root
7. Nested `/teacher/tasks/<uuid>/new` → `教师 / 任务中心 / 新建`
8. `undefined` role → defaults to `学生` root

## Known limitations / deferred

- **TopBar not shown on `<lg` viewports**. Acceptable per spec ("移动端可能需要隐藏面包屑只留右侧三按钮") — we currently hide the entire topbar. If the team later wants bell + AI helper accessible on mobile, wire them into the sidebar's mobile chrome (PR-2B onwards if needed). This was a conscious trade-off vs. duplicating chrome.
- **Notification unread-count badge** not rendered. Spec said "placeholder" — I chose no-badge over fake-badge to not lie about state.
- **`⌘K` / command palette** deferred to Round 7 per spec.
- **`/sim/[id]` route (simulation fullscreen)** is in a separate route group with its own layout; no topbar intentionally (spec doesn't require it). Unaffected.

## Anti-regression checks

- Sidebar unchanged (still the sole source of role-driven nav + user card + sign-out). Only layout wrapper structure edited.
- No API / service / Prisma changes. `/api/lms/*` untouched.
- `requireAuth` / `requireRole` zero references in this PR.
- `signOut` callback URL identical (`/login`) to sidebar's — no auth redirect semantics change.

## Rationale for non-obvious choices

- **Why extract `deriveCrumbs`?** Testing a client component that imports `usePathname` pulls Next.js + React + jsdom into the test graph; the pure function splits cleanly, is 30 lines of logic, and gives us 8 lock-in tests for future refactors.
- **Why not use `BreadcrumbList` / shadcn breadcrumb primitive?** Existing codebase has no shadcn breadcrumb installed, and this topbar is a single-purpose slot — adding a new primitive for 3-segment text was more complexity than benefit.
- **Why `bg-brand-soft` over `bg-primary-soft` for AI button?** Tailwind theme maps `--color-brand` to `--fs-primary`, so `bg-brand-soft` = `--fs-primary-soft` = the soft indigo blue from the token palette. Identical result, `brand` is the semantic name we've used since PR-0.

## Next

QA should:
1. Real-browser load `/dashboard`, `/teacher/dashboard`, `/grades`, `/teacher/courses`, `/teacher/courses/<any-id>` and confirm topbar sticks to top, 56px high, breadcrumb tracks route, avatar dropdown opens, sign-out redirects to `/login`.
2. Mobile (375px) verify sidebar's own top bar still works and topbar is hidden.
3. Check ssr grep for `学生 /` vs `教师 /` on first paint to confirm no role-flash on hydration.
