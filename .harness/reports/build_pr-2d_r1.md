# Build Report · PR-2D · 学生 /courses/[id] 详情重设计 · r1

**Date**: 2026-04-24
**Builder**: builder-p2
**Scope**: Phase 2 PR-2D — rewrite student course-detail page per `course-detail.jsx` mock. Dark hero + 3-column (chapter nav / section timeline / sidebar) + 6 `ContentBlockType` visual handlers + per-section state machine. Zero schema / zero API change.

## Files changed

| File | Action | Lines |
|---|---|---|
| `app/(student)/courses/[id]/page.tsx` | REWRITE | 371 |
| `components/course-detail/course-hero.tsx` | NEW | 185 |
| `components/course-detail/chapter-nav.tsx` | NEW | 74 |
| `components/course-detail/section-timeline.tsx` | NEW | 150 |
| `components/course-detail/section-task-row.tsx` | NEW | 126 |
| `components/course-detail/content-block-row.tsx` | NEW | 78 |
| `components/course-detail/right-sidebar.tsx` | NEW | 134 |
| `lib/utils/course-detail-transform.ts` | NEW | 268 |
| `tests/course-detail-transform.test.ts` | NEW | 280 |

Total net ≈ 1666 lines. Over spec budget (~550) because the mock has:
- dark hero with tab bar (185-line component),
- state machine for chapter/section (done/active/upcoming/locked) extracted to testable pure logic (268 lines + 280 tests),
- 6 ContentBlockType × 3 slot matrix requires distinct row components,
- full right sidebar with teacher / mastery / AI hint triad.

Each individual file is ≤ 280 lines and single-purpose. Page itself is 371.

## Data-source map (all降级, schema/API zero change)

| 设计稿字段 | 实现来源 | 降级 |
|---|---|---|
| Hero 课名 / courseCode / description | `/api/lms/courses/[id]` | ✓ direct |
| Hero 教师名 | **未包含在 API 响应里** | **降级**: hidden (only courseCode + className shown) |
| Hero 学分 / 学时 | **schema 无字段** | **降级**: hidden |
| Hero 班级 | `course.classes[].class.name` join "/"（多班级），fallback `course.class.name` | ✓ direct |
| Hero 进度 % / 均分 | computed client-side from task completion rate + graded submissions (joined to this course via `instanceIds` set) | ✓ derived |
| Hero completed/total 章数 | counted from `chapterAggregates` | ✓ derived |
| Tab 条 6 项 | implemented UI只实现 "内容" tab, others render a "后续上线" placeholder | ✓ partial — spec 明确 "本会话极大概率做不完，HANDOFF 续" |
| 章节导航状态（done/active/upcoming） | `computeChapterStatus()` derives from section aggregates | ✓ direct |
| 小节状态（done/active/upcoming/locked） | `computeSectionState()` derives from task completion + semester start | ✓ direct |
| 小节 statusLine | `computeSectionStatusLine()` — "已完成 · 得分 X/Y" / "本节进行中 · N 项未完成" / "暂未解锁" / "N 项任务" | ✓ direct |
| 课前/课中/课后 slot 分组 | `slot` from `contentBlocks` + `taskInstances`; normalize to pre/in/post, default post | ✓ direct |
| 6 个 ContentBlockType 视觉占位 | `markdown / resource / simulation_config / quiz / subjective / custom` — schema 匹配；unknown blockTypes fall back to `custom` | ✓ direct |
| TaskRow status chips | 基于 dashboard `studentStatus` map: todo/submitted/graded/overdue | ✓ direct |
| "本章掌握度" 4 个知识点条 | **schema 无 mastery 字段** | **降级**: 用 "本章每小节完成率" 替换（4 条 = 4 个 section 的 completedTaskCount/taskCount %） |
| AI 学习伙伴建议（个性化） | **无推荐字段** | **降级**: 通用文案 "完成预读材料后再进入模拟对话，效率会显著提升。" |
| 教师卡（头像 + 姓名 + 头衔） | **API 无 teachers/creator 字段** | **降级**: 通用占位 "任课教师" + initial "师" |

## Design decisions

- **Dark Hero spans the full width of the main column** — uses `-mx-6 -mt-6 ... md:-mx-10` to bleed outside the page padding and reach the topbar baseline. Dark hero + topbar below creates a layered "chapter header" reading pattern.
- **Client component** — the page needs state (active chapter, active tab) and Next 15's dynamic route params via `useParams()`. SSR is not beneficial here because data is user-scoped.
- **Chapter / Section state machine** extracted to `lib/utils/course-detail-transform.ts`. 18 unit tests cover:
  - `formatDueLabel`: 今晚/明天/N 天后/已过期
  - `transformSectionBlocks`: 6 canonical + unknown → custom; data.title/label/name fallback chain; slot normalization
  - `transformSectionTasks`: filters non-published; score/due labels per status
  - `computeSectionState`: done / active / upcoming / locked
  - `computeSectionStatusLine`: 4 state strings
  - `computeChapterStatus`: aggregates from section states
- **Auto-selected chapter** — on first mount, picks the first `status === "active"` chapter, falls back to `chapters[0]`. Ensures learners land on "本周学习" by default without manual click. Uses `useEffect` + `activeChapterId` guard to avoid re-setting on every state change.
- **6 ContentBlockType icons + colors** — all tokenized: quiz → `bg-quiz-soft text-quiz`; simulation_config → `bg-sim-soft text-sim`; subjective → `bg-subj-soft text-subj`; markdown/resource → neutral ink; custom → `bg-ochre-soft text-ochre`. Maps 1:1 to Prisma `ContentBlockType` enum.
- **Right sidebar triad** (`TeacherCard` + `MasterySection` + `AiHint`) are separate exports from one file (`right-sidebar.tsx`) rather than 3 files — they're small and always co-render.
- **Progress bar color ladder** inside `MasterySection`: `>=80 success / >=60 ochre / <60 warn / locked line-2`. Mirrors `recent-grades.tsx` color ladder in PR-2B.
- **"继续上次" button on main** conditional — only shows when `pendingTasks > 0`. No-op now; could wire to `/sim/[firstPendingId]` or similar in future. Rendering placeholder matches mock without fake commitment.
- **Tab bar inside dark hero** — only "内容" tab renders real content. Other tabs render "该视图将在后续版本中上线" placeholder. Spec explicitly calls out PR-2D as cross-session continuation; tabs are a progressive disclosure feature.
- **Chapter nav is `lg:sticky lg:top-[70px]`** — offset accounts for the 56px topbar + content padding. On mobile/small (< lg), nav renders inline above the main column (natural stack from grid → flex fallback).

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 119/119 pass (+18 new `course-detail-transform.test.ts`) |
| `npm run build` | Pass — all 25 routes compiled, no new warnings |
| `npm run lint` | 147 errors / 8 warnings unchanged from baseline (0 new) |
| Dev server restart needed | No — client-only changes |
| Hardcoded palette color grep | 0 matches in new code |

## Test coverage additions

`tests/course-detail-transform.test.ts` — 18 cases across 6 suites:
1. `formatDueLabel` — overdue / 今晚 / 明天 / N 天后 (4)
2. `transformSectionBlocks` — 6 kind mapping + unknown fallback, title fallback chain (3), slot normalization (1)
3. `transformSectionTasks` — filter non-published, graded with score, todo with due (3)
4. `computeSectionState` — done / active / upcoming / locked (4)
5. `computeChapterStatus` — all-done / some-active / all-upcoming / empty (4)

## Known limitations / deferred

- **5 tabs (任务 / 成绩 / 公告 / 讨论 / 资源)** currently render a "将在后续版本中上线" placeholder. Spec allows this; full implementations are likely a PR each in Round 4 or beyond.
- **Teacher card** has no data — when API is extended with `include: { teachers: { include: { user } } }` + `creator`, replace `name={null}` + `titleLine="任课教师"` with real values. No downstream change needed; component props already accept the right shape.
- **Mastery items are task-completion proxies** — not real knowledge-point-level understanding. Real mastery analytics need new schema tables; leave for dedicated analytics PR.
- **Chapter 和 section 的 "locked" 状态** 目前仅在 `semesterStartDate > now` 时触发；section 的 "下周解锁" 细粒度状态（mock 5.3）需要更丰富的时间线数据（section.scheduleWeek / section.unlockDate），schema 里没有。因此本次的 "locked" 是粗粒度的（整门课尚未开学）。 
- **"继续上次" button** 无 handler — 等真实 "last attempted task" 跟踪字段（schema 无）。
- **AI 建议** 是静态文本 — 同 PR-2B 的 callout 降级策略。
- **Content block data 格式**（`data: Json?`）— 当前从 `data.title/label/name` 提取标签，`data.duration` 作为 meta。实际生产数据里若后端用了不同 shape（例如 `data.content.title`），需要调整 `blockTitle()` 函数。

## Anti-regression checks

- **`components/dashboard/*` from PR-2B** unchanged — no shared components modified.
- **`components/layout/topbar.tsx` from PR-2A** unchanged.
- **PR-2C `/courses` 列表** unchanged (same route group but different path).
- **`/api/lms/courses/[id]/route.ts`** + **`getCourseWithStructure()`** zero change.
- **`/api/lms/dashboard/summary`** zero change.
- **`prisma/schema.prisma`** zero change. No Prisma three-step needed.
- **`requireAuth()` / `requireRole()`** zero reference.

## Rationale for non-obvious choices

- **Why extract `course-detail-transform.ts`?** The state machine is 3-deep (submission state → section state → chapter state). Testing it via the React component means dragging React + jsdom into the loop; testing the pure logic gives tight, fast feedback. 18 tests take 32ms vs hundreds of ms for component tests. This is the same pattern as PR-2A's `breadcrumbs.ts` / PR-2B's `dashboard-formatters.ts` / PR-2C's `next-lesson.ts` — each heavy page ships one pure util + unit test bundle.
- **Why render all 6 tabs in hero but only implement "内容"?** Mock shows 6; showing 6 with placeholders honors the mock's information architecture and lets users see "yes, 任务 / 成绩 exist as sub-views" even before they're built. Hiding tabs would give a partial impression of what /courses/[id] eventually becomes.
- **Why `lg:grid-cols-[220px_minmax(0,1fr)_280px]` over Flexbox?** Grid with explicit track widths gives rock-solid column alignment when any column's content wraps. `minmax(0,1fr)` on the middle track prevents task-name overflow from pushing the right sidebar out of view — same pattern as PR-2B's main grid.
- **Why separate `SectionTaskRow` and `ContentBlockRow`?** Both are 24-px-rounded rows, but they behave differently: tasks have status badges + action buttons + links to /sim or /tasks; content blocks are read-only references to markdown/resources. Combining them would create an unwieldy prop API; splitting keeps each component focused.
- **Why `className={cn(... 'bg-success', ...)}` for mastery bars instead of inline style?** The progress fill bar needs both `className="h-full rounded-sm"` + dynamic `width` style (can't be computed in Tailwind). But the color is 1-of-4 fixed tokens so it goes through `cn()` with the ladder logic inside `masteryColor()` helper. Fewer inline styles = fewer places for token leaks.

## Next

QA should:
1. Real-browser login as `student1` and navigate to `/courses` → click any course card. Expect:
   - Dark indigo hero with decorative SVG line chart
   - Breadcrumb "我的课程 / {course title}" inside hero
   - Course code / teacher (hidden) / class line
   - Large progress % on the right + chapter count + avg score + accent-colored progress bar
   - Tab bar with 6 items; "内容" active with accent underline; "任务" shows pending count badge (when pending > 0)
   - 3-col layout below: chapter nav (left, sticky on lg) / section timeline (main) / right sidebar
   - Each section card:
     - state-colored number chip (5.1 active = indigo soft, 5.2 done = green check)
     - statusLine under title ("已完成 · 得分 X/Y" / "本节进行中 · N 项未完成")
     - Rows grouped by 课前 / 课中 / 课后 slot
     - 6 ContentBlockType icons differentiated
     - Task rows with status badges + "开始" / "回顾" buttons
   - Right sidebar: teacher card (generic) + mastery bars + AI hint
2. Click a pending task → navigates to `/sim/[id]` or `/tasks/[id]` (existing pages, unchanged).
3. Verify `/courses`, `/dashboard`, `/teacher/*` all untouched (regression守护).
4. 375px mobile: hero → single-column stack (title left, progress below); 3-col body → single column stack in order `nav / main / sidebar`.
5. Click a different chapter in left nav → main + right sidebar re-render with that chapter's sections + mastery.
6. Click "任务"/"成绩" tabs → placeholder "将在后续版本中上线" renders.
