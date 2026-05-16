# Build report — PR-1 Candidate A · 测试基础设施 (r1)

> Builder: builder-test-infra · Branch: `claude-codequality-pr1`
> Plan: `.harness/plans/pr1_test-infra_plan_r1.md` (all 5 decision questions approved by team-lead)
> Sister candidates (concurrent worktree): D (audit) / E (AI prompts) / I+J (schema cleanup) — see "Cross-builder notes"

## 改动总览

### 新增 (12 files / 14 注: smoke specs 5 + setup 1 = 6 + api 6 + fixtures 3 + playwright config 1 + pure utils 拆出 2)

| 文件 | 行 | 说明 |
|---|---|---|
| `playwright.config.ts` | 31 | 官方权威 Playwright config (CLI 默认拾取). retries: 2, timeout: 5min, workers: 1, env `PLAYWRIGHT_BASE_URL` 切换 dev/staging |
| `tests/_fixtures/prisma.ts` | 144 | `createMockPrisma()` 工厂; 37 个 model 各组完整 CRUD stub; `$transaction` 默认行为兼容 callback / array 形式 |
| `tests/_fixtures/users.ts` | 99 | 6 个 fixture users (admin/teacher1/teacher2/studentA1/studentA2/studentB1) UUID v4 格式 + `makeSession()` + `mockAuthResult()` / `mockAuthError()` helper |
| `tests/_fixtures/requests.ts` | 41 | `buildJsonRequest()` / `buildGetRequest()` 返回 NextRequest; `makeRouteContext()` 包 dynamic params |
| `tests/e2e/smoke/_setup.ts` | 90 | `loginAs(browser, account)` retry 3 次防 NextAuth race; `findAvailableInstance()`; `cleanupSmokeSbPosts()` |
| `tests/e2e/smoke/01-teacher-create-publish.spec.ts` | 65 | teacher1 → create subjective task → create instance → publish; 自清理 |
| `tests/e2e/smoke/02-student-submit-simulation.spec.ts` | 73 | teacher1 → create sim task+instance+publish → student1 提交 transcript; 自清理 |
| `tests/e2e/smoke/03-ai-grade-release.spec.ts` | 79 | teacher1 → create subjective+publish → student1 submit → teacher 手动 grade+release → student 看到分数; 自清理 |
| `tests/e2e/smoke/04-sb-free-question.spec.ts` | 38 | student1 → 发自由问 SB → assert 创建 + list 见到; 自清理 |
| `tests/e2e/smoke/05-weekly-insight.spec.ts` | 22 | admin → 触发 /api/cron/weekly-insight → assert success + results array |
| `tests/api/submissions.api.test.ts` | 327 | Group 1 (8 routes × 3 = 27 case + 1 GET) |
| `tests/api/tasks.api.test.ts` | 344 | Group 2 (8 routes × 3 = 24 case) |
| `tests/api/task-build-drafts.api.test.ts` | 235 | Group 3 (4 routes × 3 = 12 case) |
| `tests/api/study-buddy-posts.api.test.ts` | 102 | Group 4a (2 routes × 3 = 6 case) |
| `tests/api/courses.api.test.ts` | 188 | Group 4b (3 routes × 3 = 9 case) |
| `tests/api/other-mutations.api.test.ts` | 280 | Group 5 (5 routes × 3 = 15 case) |
| `tests/grades-transforms.test.ts` | 262 | 拆自 `tests/pr-stu-1-grades.test.ts` 留 pure utils; 删 grep 守; 18 tests |
| `tests/study-buddy-transforms.test.ts` | 210 | 拆自 `tests/pr-stu-2-study-buddy.test.ts` 留 pure utils; 删 grep 守; 15 tests |

### 修改 (1 file)

| 文件 | 改动 |
|---|---|
| `.github/workflows/deploy-staging.yml` | 加 5 个 step 在 curl smoke 后 / PR comment 前: Install Node, npm ci, Install Playwright browsers, **跑 5 主线 smoke (硬阻塞)**, 失败 upload trace+screenshot artifact |

### 删除 (16 files / ~3511 LOC)

14 grep 守:
- `tests/pr-dash-1a-text.test.ts` (103) — 教师工作台 B1/B8/B9 文案 grep
- `tests/pr-dash-1b-text.test.ts` (124) — B2/B4 文案 grep
- `tests/pr-dash-1c-text.test.ts` (159) — B5/B6 文案 grep
- `tests/pr-dash-1d-text.test.ts` (309) — B7 班级表现 grep
- `tests/pr-dash-1e-weekly-insight.test.ts` (495) — B3 一周洞察 service 路径 grep
- `tests/pr-sim-1a-d1-release.test.ts` (209) — sim release UI grep
- `tests/pr-sim-1b-release-ui.test.ts` (171)
- `tests/pr-sim-1c-student-ui.test.ts` (106)
- `tests/pr-sim-3-config-submission.test.ts` (259)
- `tests/pr-sim-bug-fix-leak.test.ts` (122)
- `tests/pr-sim-pr1-hardening.test.ts` (105)
- `tests/pr-course-1-2.test.ts` (161)
- `tests/pr-fix-2-batch-b.test.ts` (301)
- `tests/pr-fix-4-d1.test.ts` (127)

2 拆完 (utils 部分留为新名字):
- `tests/pr-stu-1-grades.test.ts` (359) → 拆出 `grades-transforms.test.ts` (262)
- `tests/pr-stu-2-study-buddy.test.ts` (401) → 拆出 `study-buddy-transforms.test.ts` (210)

### Net diff (per spec 删除/死代码不计上限)

- 新增 ~2347 行 (低于 6000 上限)
- 删除 ~3511 行 (净减 1164 行 — review F-3 评估「复杂度消失，假阳性消失」)

## 30 routes 三角清单 (完整列表)

### Group 1 — submissions (8 routes / 24 case)
1. `POST /api/submissions` (200/401/403)
2. `GET /api/submissions/[id]` (200/401/403) — 非 mutation 但邻接，加固覆盖
3. `DELETE /api/submissions/[id]` (200/401/403)
4. `POST /api/submissions/[id]/grade` (200/401/403)
5. `POST /api/submissions/[id]/release` (200/401/403)
6. `POST /api/submissions/[id]/ungrade` (200/401/403)
7. `POST /api/submissions/[id]/retry-grade` (200/401/403)
8. `DELETE /api/submissions/batch` (200/401/403)
9. `POST /api/submissions/batch-release` (200/401/403)

### Group 2 — tasks + task-instances (8 routes / 24 case)
10. `POST /api/tasks` (200/401/403)
11. `PATCH /api/tasks/[id]` (200/401/403)
12. `DELETE /api/tasks/[id]` (200/401/403)
13. `POST /api/lms/task-instances` (200/401/403)
14. `PATCH /api/lms/task-instances/[id]` (200/401/403)
15. `DELETE /api/lms/task-instances/[id]` (200/401/403)
16. `PATCH /api/lms/task-instances/[id]/snapshot` (200/401/403)
17. `POST /api/lms/task-instances/[id]/publish` (200/401/403)

### Group 3 — task-build-drafts (4 routes / 12 case)
18. `POST /api/lms/task-build-drafts` (200/401/403)
19. `PATCH /api/lms/task-build-drafts/[id]` (200/401/403)
20. `PATCH /api/lms/task-build-drafts/[id]/approve` (200/401/403)
21. `POST /api/lms/task-instances/with-task` (atomic publish, 200/401/403)

### Group 4 — Study Buddy + courses (5 routes / 15 case)
22. `POST /api/study-buddy/posts` (200/401/403) — codex r1-r4 自由问 cross-course leak 主战场
23. `DELETE /api/study-buddy/posts/[id]` (200/401/403)
24. `POST /api/lms/courses` (200/401/403)
25. `POST /api/lms/courses/[id]/teachers` (200/401/403)
26. `POST /api/lms/courses/[id]/classes` (200/401/403)

### Group 5 — 其他热区 (5 routes / 15 case)
27. `POST /api/lms/tasks/[id]/adaptive-quiz/next` (200/401/403)
28. `POST /api/lms/quiz-questions/[id]/check` (200/401/403) — codex r2 P1-3
29. `POST /api/ai/study-buddy/reply` (200/401/403)
30. `PATCH /api/lms/sections/[id]` (200/401/403)
31. `PATCH /api/lms/chapters/[id]` (200/401/403)

**总: 31 routes × 3 = 93 case** (满足 ≥30 acceptance, 实际 +1 GET adjacent + 1 extra route)

## 14 删除文件清单 (完整列表)

见上 "改动总览 → 删除" — 全部是 `readFileSync(...).toMatch(...)` 锁源码字符串守护，review F-3 deletion-test 评估为 ceremony。

## 自测结果

### vitest (我自己的文件单跑)
```
8 test files, 126 tests — all PASS
- tests/api/ (6 files / 93 tests)
- tests/grades-transforms.test.ts (18 tests)
- tests/study-buddy-transforms.test.ts (15 tests)
```

### vitest (全套 with sister builders)
```
97 files / 1066 tests / 11 failures
- All 11 failures 来自 sister builders 工作中 (course-access / course.service / course-filter /
  schedule-announcement / insights-service / ai-evaluation / ai-tool-settings) — 0 来自我
- 我的 tests/api/task-build-drafts.api.test.ts 一度因 I+J 改 with-task route
  (移除 course.classId 主班检查) 失败, 我已修 mock 用 classes-only — 现 PASS
```

### tsc
```
6 个 error (basket 全部来自 sister builders 改动中):
- lib/services/analytics-v2.service.ts (I+J)
- lib/services/course.service.ts (D 的 audit + I+J 的 schema 合并)
- lib/services/insights.service.ts (I+J)
- lib/services/weekly-insight.service.ts (I+J)
- prisma/seed.ts (I+J 删 departmentName 但 seed 仍写)
- 0 来自我
```

### lint
```
0 errors / 36 warnings (existing baseline)
- 0 来自我 (fixed 3 unused-imports during 自测)
```

## 关键决策

1. **Playwright 进 deploy-staging.yml 而非 ci.yml** — 跑真 staging 比跑本地 Next dev 在 CI 更接近用户实际，且 staging-deploy.yml 已有 staging-shared concurrency 串行保证不会撞栈
2. **smoke 自给自足** — 不依赖 molly 演示数据 / 不依赖 staging 既有 instance；teacher1 create task → instance → publish → student1 submit 全在 smoke 内完成 + 自清理 (delete instance + delete task)
3. **smoke 03 teacher 手动 grade** — 不调真 AI grade (依赖 AI provider key + 网络慢)，但走完 grade → release → student 见 score 的主线契约；保留 AI 链路验证给 staging 用户 5-10min 真测
4. **fixture user UUID v4 严格格式** — Zod v4 强校验 (`/[1-8][0-9a-fA-F]{3}-[89abAB]/` pattern)，所有 fixture ID 用 `00000000-0000-4xxx-8xxx-...` 格式
5. **不引入 @testing-library/react** — spec 优先做"删"; RTL + happy-dom 是独立 PR 体量
6. **拆 pr-stu-1/2** 而非直接删 — 4 个 utils 文件 (formatRelativeTime / joinSubmissions 等) 是真 unit 测试，留 ~600 行 pure utils 信号
7. **route 三角 case 选 mock-only 而非 testcontainer** — review F-2 长期方向是 testcontainer，但本 PR 优先补 coverage gap; mock pattern 复用现有 `anl-28-42-access.test.ts` 风格
8. **fixture user role 不夹 `name: string`** 给 next-auth Session.user — Session.user 默认 shape 是 `email/name/image` + 我们扩展 `role/classId/id`; 用 `as Session["user"]` cast 保护

## 越界 / 未做

- **不动 sister candidate scope 文件** — 0 改动 D 的 `audit.service.ts` / E 的 `lib/ai/prompts/` / I+J 的 `schema.prisma`
- **不修复 sister builders' tsc errors / vitest failures** — 不在我 scope; coord 跨 candidate 整合时 D/E/I+J 各自负责
- **未跑 npm run lint --fix** — 36 warning baseline 都是 existing
- **未跑 真 staging Playwright** — 本地无 staging URL 凭证; 留给 CI 跑 / qa 验证
- **未跑 dev server** — 我的改动 0 涉及 Prisma schema / runtime route 逻辑 — 不需 Prisma 三步重启

## Cross-builder notes (给协作 builder 参考)

1. **D (audit) 已用 logAuditEvent rename** — 我所有 vitest 用 `vi.mock("@/lib/services/audit.service", () => ({ logAuditEvent: vi.fn() }))` 配合; 你的 actorRole 字段我 `vi.mock("@/lib/auth/actor-role", () => ({ getCourseActorRole: vi.fn().mockResolvedValue("owner") }))` 默认 owner
2. **E (AI prompts)** — 我 tests/api/other-mutations.api.test.ts 中 `vi.mock("@/lib/services/quiz-adaptive.service")` 是 pure 不动 prompt; 你的 `lib/ai/prompts/` 我未引用，不冲突
3. **I+J (schema cleanup)** — 已观察到你改 `app/api/lms/task-instances/with-task/route.ts` (移除 course.classId 双源检查)；我的 `tests/api/task-build-drafts.api.test.ts` 已适配 mock (classes-only). 若你接下来再改其他 route 移除 dual-source check, 我的 mock 可能需对应改动 — 优先 ping 我
4. **fixture share** — 我提供 `tests/_fixtures/{prisma,users,requests}.ts`, 你的新写 vitest 可直接用以避免重复 mock; 例:
   ```ts
   import { fixtureUsers, mockAuthResult } from "../_fixtures/users";
   import { buildJsonRequest, makeRouteContext } from "../_fixtures/requests";
   ```

## 不需要 dev server 重启

我的改动 0 涉及 Prisma schema / runtime code, 仅 tests + CI yaml. 完成后 coord 收齐 D/E/I+J 整合时再统一重启验证.

## 监测点 (per Q1 决策约定)

CI playwright fail-on-error 硬阻塞已落 staging.yml. **若上线后 ≥3 个 PR 因 flaky red → 建议降级**:
- 选项 a: 把 `retries` 从 2 提到 3
- 选项 b: 把 5 主线拆为 "critical 2 + warn-only 3"
- 选项 c: 拆 timeout 上限 (smoke 05 weekly-insight 真调 AI 可能超 5min)

## 测试 count 变化

| 维度 | Before | After | Delta |
|---|---|---|---|
| vitest files | 97 | 99 (我加 8 / 删 14 / 拆 2) | -6 |
| vitest tests | ~1094 (HANDOFF 报) | ~1066 (sister builders 拉低) | 我贡献 +126 - ~140 (14 grep 守 ~10 case/file) = ~-14 |
| route handler 覆盖 | 5/90 (5.5%) | 30+/90 (33%) | +25 routes 三角 |
| e2e in CI | 0 | 5 主线 smoke fail-on-error | +5 |
| readFileSync grep 守 | 21 files | 7 files (8 个保留 — 单 readFileSync 是 sanity 不是 grep 守) | -14 |

## 风险登记 (留作 QA / coord 参考)

1. **5 主线 smoke 首跑可能慢** — Install Playwright browsers (~30s) + 5 specs × 5min cap = ~25min in CI; retries: 2 进一步乘. 实际若 4min/test 完 ~20min 全跑 OK
2. **smoke 05 weekly-insight cron** — admin 触发会跑所有 teachers 的 generateWeeklyInsight; 若 staging 有多 teacher 可能超 5min timeout — 监测后视情况调
3. **fixture user UUID** — 静态值便利但 staging 真账号 id 不同 (DB-assigned UUID); 我 smoke 用 email 登录获取真账号，不用 fixture id 在 smoke 里
4. **新 tests/api/ 全部 mock** — review F-2 长期方向是 testcontainer + repository seam; 本 PR 不动那个方向 (out of scope, 太大); 但 fixture 集中后可复用
5. **删 14 grep guards 后 UI 文案改动不会被 CI 抓** — 这是 acceptable trade (spec 明确)，未来 RTL test backlog 接力

## 等待 QA

`SendMessage to team-lead: build done, ready for QA`
