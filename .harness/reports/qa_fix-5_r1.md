# QA Report — Fix 5 大纲编辑（update / delete / reorder）

- Worktree: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-outline`
- Branch: `claude-fix-batch1-outline`
- Build commit verified: `fa08b9d` — `fix(outline): support update/delete/reorder chapters via mode=replace`
- QA: qa-outline (Claude Opus 4.7 [1M])
- Round: r1
- Verdict: **PASS**

## Approach

Independent verification per spec Worktree C 段:

1. Read build report `build_fix-5_r1.md` + the entire `outline-apply/route.ts` (502 lines) + UI page diff + new vitest spec.
2. Confirmed schema unchanged: `Chapter.order Int @@unique([courseId, order])` + `Section.order Int @@unique([chapterId, order])` already present (`prisma/schema.prisma:277, 300`). **No Prisma three-step required — no sync point triggered.**
3. Started dev server on **port 3003** (`npx next dev --webpack`, avoiding turbopack symlink panic in worktree node_modules) and verified `/login`, `/api/auth/session`, `/api/lms/courses/[id]/outline-apply` all reachable.
4. Captured pre-test DB baseline for teacher1's courses (12 existing chapters across 5 courses).
5. Wrote **real-browser Playwright e2e** (`tests/e2e/qa-fix-5-outline.spec.ts`, `playwright.qa-fix-5.config.ts`) and ran 6 cases on the live dev server with **Prisma-direct DB reconciliation** after every mutation.
6. Cleaned up after run — DB returned to the 12-chapter baseline (spot-checked).
7. Ran full project `tsc --noEmit` (0 errors), `vitest run` (75 files / 878 tests PASS), `npm run lint` (0 errors, 3 pre-existing warnings unrelated to Fix 5).

DB reconciliation was the strongest signal — every assertion below was confirmed via direct `prisma.chapter.findMany`, not just inspecting API response.

## Acceptance verification

| # | Spec acceptance | Verdict | Evidence |
|---|---|---|---|
| 1 | 上传大纲 → AI 识别 → 老师改章节名 → 保存 → 刷新 → 改名持久化 | PASS | Case 2: title 改为「财务管理导论（已改名）」via mode=replace；DB `SELECT title FROM "Chapter" WHERE id=:c1` 返回新名；`page.goto('/teacher/courses/:id')` 刷新后页面 body 仍包含新名（screenshot `case2-rename-refresh.png` 显示「第 1 章 · 财务管理导论（已改名）」） |
| 2 | 删除未关联章节 → 真删；删除关联了任务的章节 → 中文拒绝 | PASS | Case 4: 删 chapter B (无 TaskInstance) → `applied.deletedChapters=[B]`, DB 行真消失。Case 5: 给 chapter[0] 挂 1 个 TaskInstance 后尝试删 → 400 `OUTLINE_REPLACE_BLOCKED`, message=「章节「AI误抽章节C」下还有 1 个任务，请先删除任务后再删除该章节。」(含 `[一-龥]` 字符 + 「请先删除任务」)；DB chapter 仍在 |
| 3 | 拖拽/上下移重排 → 保存 → 刷新 → 顺序持久化 | PASS | Case 3: swap chapter[0] ↔ chapter[2]，mode=replace；DB 三行 order=0/1/2 sequential（无 @@unique 冲突），title 顺序 = `["AI误抽章节C","AI误抽章节B","财务管理导论（已改名）"]`；浏览器刷新后 screenshot `case3-reorder-refresh.png` 反映新顺序 |
| 4 | safe-merge (mode=apply) 行为不变（向后兼容） | PASS | Case 1: mode=apply 在空课程上创建 3 个新章节，`createdChapters.length=3`、`deletedChapters/updatedChapters=0`、DB orders=[1,2,3]（safe-merge 起 max+1）。`tests/outline-apply-replace.test.ts:187-208` 的 5th case 也覆盖此路径 |
| 5 | E2E case | PASS | `tests/e2e/qa-fix-5-outline.spec.ts` 加 6 个真浏览器场景（Case 0 seed, Case 1 safe-merge, Case 2 rename+refresh, Case 3 reorder+refresh, Case 4 delete unrelated, Case 5 delete blocked, Case 6 UI smoke），单 worker serial，**全 PASS**。Playwright 输出：`1 passed (15.1s)` |
| 6 | tsc / vitest 全过 | PASS | `tsc --noEmit`: 0 errors（含我新加的 spec）；`vitest run`: 75 files / 878 tests 全 PASS（含 builder 加的 `outline-apply-replace.test.ts` 5 个 case） |
| 7 | Commit 消息符合约定 | PASS | `fa08b9d fix(outline): support update/delete/reorder chapters via mode=replace` 符合 `fix(scope): ...` |

## Anti-regression checks（CLAUDE.md + spec）

| Check | Verdict | Note |
|---|---|---|
| Prisma 三步铁律 | N/A | 未改 schema，spec 也确认 Chapter.order/Section.order 已存在 |
| 删除级联 — 不能误删带 Task 的章节 | PASS | `findReplaceBlockers` 在事务外扫描 `taskInstances` 数量；Case 5 实测：挂任务的章节 dropping 立即 400，DB 未触碰 |
| diff key — 用 chapterId / slug 不用 title | PASS | `applyReplace` 用 `draft.chapter.chapterId` 匹配 `existingChapterMap`，`buildOutlineDiff` 先按 ID 再按 normalizeTitle 回退；Case 2 重命名同章节 ID 后 title 改动也被正确识别为 `updatedChapters` 而不是 `deletedChapters + createdChapters` |
| Service interface 全同步 | PASS | 改动全在 Route Handler + Page Component，未碰 `lib/services/` |
| 中文 UI / 错误消息 | PASS | 错误 message「章节「X」下还有 N 个任务，请先删除任务后再删除该章节。」，按钮「保存编辑/安全合并/应用到课程结构（替换）/上移/下移」全中文 |
| 业务无关文件未动 | PASS | `git diff HEAD~1 HEAD --stat` 3 files 改动，全在 Fix 5 范围（route + page + new test） |
| 两阶段 order 调整避免 @@unique 冲突 | PASS | Phase 1 把保留 chapter 临时 bump 到 `tempOffset`，Phase 2 写最终 order；Case 3 swap 时未触发 unique constraint error（如果直接 update 会因 (courseId,order) 冲突）。section 内部同样两阶段，scope by chapterId |
| safe-merge backwards compat | PASS | mode=apply 仍走 `applySafeMerge`；Case 1 + 单测 5 双重覆盖 |
| structuredData ID 回写 | PASS | safe-merge 与 replace 都把含 chapterId/sectionId 的 outline 写回 CourseKnowledgeSource.structuredData；Case 2 first read confirmed `sd.chapters[0].chapterId === chapter1Id` |

## DB 对账（reconciliation）— 抽样

**Pre-test baseline**（teacher1 的全部 chapter）: 12 行，跨 5 个老课程，order 列保持 0/1/2 sequential（未触动）。

**Case 1 后**（mode=apply 在空 QA 课程上）:
```
title              | order
AI误抽章节A         | 1
AI误抽章节B         | 2
AI误抽章节C         | 3
```
确认 safe-merge 用 `max(0,...)+1` 起序号（无现有则 0+1=1）；老 12 行 untouched。

**Case 2 后**（rename chapter[0]）:
```
title                       | order
财务管理导论（已改名）       | 0
AI误抽章节B                 | 1
AI误抽章节C                 | 2
```
replace 重新从 0 编号（合理：mode=replace 是完整覆盖）。

**Case 3 后**（swap 0 ↔ 2）:
```
title                       | order
AI误抽章节C                 | 0
AI误抽章节B                 | 1
财务管理导论（已改名）       | 2
```
order 仍 sequential，无 unique 冲突 → 两阶段 bump-and-resettle 正确。

**Case 4 后**（删 chapter B）:
```
title                       | order
AI误抽章节C                 | 0
财务管理导论（已改名）       | 1
```
B 行被 DELETE，剩余 reindex 0/1。

**Case 5 后**（试删 chapter[0]=「AI误抽章节C」，但它已挂 TaskInstance）:
- 响应 400 `OUTLINE_REPLACE_BLOCKED` + 中文 message
- DB 仍 2 行，order 0/1 未变 → 事务从未启动

**Post-test cleanup**: 删除所有 `courseTitle LIKE 'QA Fix5%'` 的课程及其级联数据；DB 回到 12 行 baseline。

## 单测验证

Builder 新加的 `tests/outline-apply-replace.test.ts` 5 case 独立跑：
```
✓ tests/outline-apply-replace.test.ts (5 tests) 11ms
  Test Files  1 passed (1)
       Tests  5 passed (5)
```
Cases 覆盖：rename+reorder by chapterId / delete chapter not in draft / blocked-by-task with 中文 message / save-draft persists structuredData / safe-merge backwards-compat。

## 一处小观察（非阻塞）

Worktree dev server 在 `/api/lms/course-knowledge-sources` GET 时偶发 500：`TypeError: Object.defineProperty called on non-object` from `pdfjs-dist/legacy/build/pdf.mjs` 加载阶段。这是 **worktree node_modules symlink + webpack 模块解析** 的副作用（同样模块通过 outline-apply 路径正常加载），**不是 Fix 5 引入的**。生产构建和主 worktree 应不受影响（主 worktree 单独 node_modules）。已在 Case 6 UI smoke 中通过解析编译产物 chunk 的方式确认 5 个新按钮 label 全部进入 bundle。

## 命令产出

```
$ cd /Users/alexmac/Documents/Mini\ 项目开发/finsim\ v2/finsim-wt-outline
$ npx tsc --noEmit
(无输出，0 errors)

$ npx vitest run
Test Files  75 passed (75)
     Tests  878 passed (878)
  Duration  3.59s

$ npm run lint
✖ 3 problems (0 errors, 3 warnings)
（warnings 全部在 quiz-runner.tsx / simulation-runner.tsx / subjective-runner.tsx，与 Fix 5 无关，pre-existing）

$ npx playwright test --config=playwright.qa-fix-5.config.ts
login: ok
Case 1 (safe-merge add-only): PASS
Case 2 (rename + persist): PASS
Case 3 (reorder + persist): PASS
Case 4 (delete unrelated): PASS
Case 5 (delete with task → 中文 reject): PASS
Case 6 (UI smoke — dialog + bundle labels): PASS
  ✓  Fix 5 — outline editor full flow (14.2s)
  1 passed (15.1s)
```

## 产物

- 新测试：`tests/e2e/qa-fix-5-outline.spec.ts`（420 行）+ `playwright.qa-fix-5.config.ts`
- 截图：`/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-outline/.harness/screenshots/qa-fix-5-r1/`
  - `case2-rename-refresh.png` — 改名后浏览器刷新仍显示新名（直观证据）
  - `case3-reorder-refresh.png` — 重排后浏览器刷新顺序生效
  - `case6-edit-dialog.png` — 编辑课程对话框打开

## 结论

**PASS**。Fix 5 acceptance 7 项全部通过，5 个 anti-regression check 全部通过。DB 对账（5 个状态变化点）与 API 响应、UI 刷新行为一致。建议进入 batch 1 integration。
