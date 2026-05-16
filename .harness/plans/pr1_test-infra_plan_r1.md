# Plan — PR-1 Candidate A · 测试基础设施 (r1)

> Builder: builder-test-infra · Branch: `claude-codequality-pr1`
> Source: `.harness/spec.md` "A 专属 acceptance" + `.harness/reports/review_test_r1.md` F-1 / F-3 / F-5 / F-6

## 实现方案概览

把 finsim 从「e2e 一行不在 CI / route 层 5/90 测 / 21 文件锁源码字符串 / 33 处重复写 prisma mock」拉到「权威 playwright.config + 5 主线 smoke 进 CI + ≥30 个 mutation route 三角 + 删 grep 守 + fixture 集中」。

```
新建:
  playwright.config.ts                       # 官方权威 config (替代 3 个一次性 *.config.ts 不删它们)
  tests/_fixtures/prisma.ts                  # createMockPrisma() 工厂 + 常用 model stub
  tests/_fixtures/users.ts                   # session/user fixture (teacher/student/admin/molly)
  tests/_fixtures/requests.ts                # buildJsonRequest 等小 helper
  tests/e2e/smoke/<5 个>.spec.ts             # 5 主线 smoke
  tests/api/<30+ 个>.api.test.ts             # 30+ 个 route 三角

修改:
  .github/workflows/ci.yml                   # 加 playwright-smoke job (独立 job, 跑 staging URL)

删除:
  tests/pr-dash-1a-text.test.ts              # 4 readFileSync grep 守
  tests/pr-dash-1b-text.test.ts              # 5 readFileSync
  tests/pr-dash-1c-text.test.ts              # 4
  tests/pr-dash-1d-text.test.ts              # 4
  tests/pr-dash-1e-weekly-insight.test.ts    # 6
  tests/pr-sim-1a-d1-release.test.ts         # 0 readFile 但同系列 hard-coded UI grep
  tests/pr-sim-1b-release-ui.test.ts         # 3
  tests/pr-sim-1c-student-ui.test.ts         # 4
  tests/pr-sim-3-config-submission.test.ts   # 1
  tests/pr-sim-bug-fix-leak.test.ts          # 1
  tests/pr-sim-pr1-hardening.test.ts         # 1
  tests/pr-course-1-2.test.ts                # 2
  tests/pr-fix-2-batch-b.test.ts             # 1
  tests/pr-fix-4-d1.test.ts                  # 1
  tests/pr-stu-1-grades.test.ts → 拆          # utils-pure 留, grep 守删 (见下)
  tests/pr-stu-2-study-buddy.test.ts → 拆     # utils-pure 留, grep 守删 (见下)
```

## 决策点 (4 个) — 请 coord 批准后再开 implementation

### Q1 — CI playwright step 选 `fail-on-error` 还是 `fail-on-warning`?

**提议**: **`fail-on-error` (硬阻塞)，但只跑 1-2 个最关键 smoke (teacher publish + student submit)**;
- 理由: spec 写「每次 PR 后 e2e 真测过才进下一步」是用户原话强标准；CI 跑 1-2 个 critical smoke 硬阻塞，能抓 main 合并时的 schema/route regression
- 5 主线 smoke 全跑会因 staging 共享栈 (concurrency: staging-shared) 出现 flaky，但只阻塞最关键 2 个 + 其余 3 个标 `test.fixme` 或软警告，平衡覆盖与稳定
- 备选: 全 5 个都 fail-on-error — 风险是 staging 跨 PR 串行 + AI 链路 (李志华 dialogue / IRT 引擎) 真调外部 AI provider 网络慢可能假阴性，会触发"红了→人肉去看→其实环境问题"的疲劳
- 不建议: 全 warn-only — 那就没在 CI 跑，等于不存在

**等 coord 决定**: 1-2 critical 硬阻塞 + 3 信息性? 还是全 5 硬阻塞?

### Q2 — 5 主线 smoke 用什么 seeded 账号?

**提议**: 用 `npm run db:seed` 后的 baseline 账号 (`teacher1@finsim.edu.cn` / `student1@finsim.edu.cn` / `password123`)，**不用 molly@qq.com 演示账号**
- 理由: seed.ts 是 deterministic、可复现、CI ephemeral DB 直接跑；molly 数据是「生产 DB 一次性 phase 3 建好的」不在 CI ephemeral DB 里
- staging CI 也用 seed 重新建 (deploy-staging.yml 已 `prisma migrate deploy` 但不 seed — 需要核对 staging DB 是否有 seed 数据)
- 风险: seed 默认课程「金融工程导论」无演示视频要的 sim/quiz/sub 任务，5 主线 smoke 中「teacher 建 task → publish」需要自己在 smoke 内 create instance；「student 提交 simulation」也要 smoke 自己造 task instance
- 备选 A (molly): 只能跑生产 DB，CI 无法访问 → 不可行
- 备选 B (新加 e2e 专用 seed `db:seed:e2e`): 引入新 fixture pipeline 增加复杂度，spec 没要求

**等 coord 决定**: seed baseline (teacher1/student1) + smoke 内自造任务?

### Q3 — 30 个 mutation route 选哪些?

**提议**: 按 review-security + codex 4 轮 review 高频热区 + 涉及金钱/分数/审计的 mutation 优先。下面 30 个分 5 组:

**Group 1 — 评分/提交 (8 个)**: 受 codex r4 SB over-match / publish 原子性影响最大
- `POST /api/submissions`
- `PATCH /api/submissions/[id]`
- `POST /api/submissions/[id]/grade`
- `POST /api/submissions/[id]/release`
- `POST /api/submissions/[id]/ungrade`
- `POST /api/submissions/[id]/retry-grade`
- `POST /api/submissions/batch`
- `POST /api/submissions/batch-release`

**Group 2 — 任务/实例 mutation (8 个)**: 受 Unit-FB1 + Unit 17 taskSnapshot 影响
- `POST /api/tasks`
- `PATCH /api/tasks/[id]`
- `DELETE /api/tasks/[id]`
- `POST /api/lms/task-instances`
- `PATCH /api/lms/task-instances/[id]`
- `DELETE /api/lms/task-instances/[id]`
- `PATCH /api/lms/task-instances/[id]/snapshot`
- `POST /api/lms/task-instances/[id]/publish`

**Group 3 — TaskBuildDraft 状态机 (4 个)**: codex r4 atomic publish 主战场
- `POST /api/lms/task-build-drafts`
- `PATCH /api/lms/task-build-drafts/[id]`
- `POST /api/lms/task-build-drafts/[id]/approve`
- `POST /api/lms/task-instances/with-task` (原子 publish)

**Group 4 — Study Buddy / 课程 (5 个)**: codex r1-r4 SB cross-course leak
- `POST /api/study-buddy/posts`
- `PATCH /api/study-buddy/posts/[id]`
- `POST /api/lms/courses`
- `PATCH /api/lms/courses/[id]`
- `POST /api/lms/courses/[id]/teachers`

**Group 5 — 其他热区 (5 个)**: AI / 测验 adaptive / 班级
- `POST /api/lms/tasks/[id]/adaptive-quiz/next` (codex r1-r3 多轮主题)
- `POST /api/lms/quiz-questions/[id]/check`
- `POST /api/ai/study-buddy/reply`
- `POST /api/lms/sections/[id]` (PATCH)
- `POST /api/lms/courses/[id]/classes`

每个 route 加 3 个 case: **200 happy** / **401 未登录** / **403 跨用户(student 触 teacher / B 班触 A 班 / 非 owner)**;
按 `tests/courses-patch.api.test.ts` 范式写, 每 test 约 30-50 行 → 总 30 × ~40 行 = ~1200 行 → 拆 5-10 个文件 (按 group):
- `tests/api/submissions.api.test.ts` (Group 1)
- `tests/api/tasks.api.test.ts` (Group 2)
- `tests/api/task-build-drafts.api.test.ts` (Group 3, 复用 existing `task-build-drafts-approve.api.test.ts` 扩展)
- `tests/api/study-buddy-posts.api.test.ts` + `tests/api/courses.api.test.ts` (Group 4)
- `tests/api/adaptive-quiz.api.test.ts` + `tests/api/quiz-check.api.test.ts` + `tests/api/ai-sb-reply.api.test.ts` (Group 5)

**等 coord 决定**: 30 个选这 5 组 OK 吗? 想加/减哪个? 是否担心 1200 行 + 5-7 新 test 文件超 PR diff 限?

### Q4 — 21 grep 守哪些删 / 哪些重写?

**提议**: **全删 14 个 (~2900 LOC)，2 个混合文件拆 (utils-pure 留, grep 守删 ~500 LOC)，不引入 @testing-library/react**
- 理由 (不引入 RTL): spec 说「优先做"删"的部分」+ 引入 RTL 要装 happy-dom + 改 vitest config + 写 5-10 真 render test, 是独立 PR 体量, 不应混在 PR-1
- 理由 (全删 14 个): 都是单纯 `expect(file).toContain("中文字符串")` — review F-3 说「换个等价写法就挂」「false-positive 安全感」
- 理由 (拆 2 个): `pr-stu-1-grades.test.ts` (359 行) + `pr-stu-2-study-buddy.test.ts` (401 行) 顶部 80% 是真 utils unit test (formatRelativeTime / joinSubmissions / computePercent 等 pure function), 底部 20% 是源码 grep — 拆出 pure 部分保留为新名字 (例: `tests/grades-transforms.test.ts` + `tests/study-buddy-transforms.test.ts`)

**完整删除清单 (14 文件)**:
- `tests/pr-dash-1a-text.test.ts` (103)
- `tests/pr-dash-1b-text.test.ts` (124)
- `tests/pr-dash-1c-text.test.ts` (159)
- `tests/pr-dash-1d-text.test.ts` (309)
- `tests/pr-dash-1e-weekly-insight.test.ts` (495) — ⚠️ 大文件，含 weekly-insight 服务路径 grep 但仍是源码字符串断言 — 删
- `tests/pr-sim-1a-d1-release.test.ts` (209) — sim release UI grep
- `tests/pr-sim-1b-release-ui.test.ts` (171)
- `tests/pr-sim-1c-student-ui.test.ts` (106)
- `tests/pr-sim-3-config-submission.test.ts` (259)
- `tests/pr-sim-bug-fix-leak.test.ts` (122)
- `tests/pr-sim-pr1-hardening.test.ts` (105)
- `tests/pr-course-1-2.test.ts` (161)
- `tests/pr-fix-2-batch-b.test.ts` (301)
- `tests/pr-fix-4-d1.test.ts` (127)

总删 ~2751 LOC。

**拆分 (2 文件)**:
- `tests/pr-stu-1-grades.test.ts` → 拆为 `tests/grades-transforms.test.ts` (~280 行真 unit) + 删 grep 守 ~80 行
- `tests/pr-stu-2-study-buddy.test.ts` → 拆为 `tests/study-buddy-transforms.test.ts` (~320 行真 unit) + 删 grep 守 ~80 行

**保留 (12 文件含 readFileSync 但合理)**:
- `tests/ai-assistant-result-views.test.ts` / `tests/ai-evaluation-prompt-contains-concept-tags.test.ts` / `tests/ai-workbench-tabs.test.ts` / `tests/auth-secret.test.ts` / `tests/course-entry-and-ai-draft-ui.test.ts` / `tests/course-sb-pending-list.test.ts` / `tests/fix-3-chat-streaming.test.ts` / `tests/fix-4-provider-deadcode.test.ts` / `tests/instance-snapshot-edit-sheet.test.ts` / `tests/instance-snapshot-update.test.ts` / `tests/use-persisted-job.test.ts` / `tests/low-conflict-production-guards.test.ts` (6) — 单/少 readFileSync 用作 sanity，主体是真 unit 行为；不删
- 备选: 这 12 也全审一遍可能找出更多删 / 但 spec 优先 "删 grep 守" — 保守不动

**等 coord 决定**: 删 14 + 拆 2 + 不引 RTL OK?

## 5 主线 smoke spec 设计 (回 Q2 后细化)

每个 spec 用 `tests/e2e/smoke/` 目录，`playwright.config.ts` testDir 指向 smoke;

1. `01-teacher-create-publish.spec.ts` — teacher1 登录 → 进 `/teacher/tasks` → API create task → API create instance → API publish → assert published 状态
2. `02-student-submit-simulation.spec.ts` — student1 登录 → 进 `/(student)/tasks/[id]` 找一个 sim instance → 完成 dialogue → submit → assert submission created
3. `03-ai-grade-release.spec.ts` — teacher1 → 找有 submission 的 instance → 触发 grade → 触发 release → student1 看到 score
4. `04-sb-free-question.spec.ts` — student1 → /study-buddy → 发自由问 → assert AI reply (mock provider 或真) 出现
5. `05-weekly-insight.spec.ts` — teacher1 → 触发 weekly-insight cron → assert report 生成

5 个 spec 共用 `tests/e2e/smoke/_setup.ts` (login helper + 等响应 helper + DB cleanup helper)。

**重要约束**: 5 主线 smoke **不能** 依赖 phase3 molly 数据, 全部自给自足 (在 spec 内 create / cleanup)。

## playwright.config.ts (官方权威)

```typescript
// 草稿，等 coord 批准后细化
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e/smoke",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,                              // staging 共享栈,严格串行
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["list"]]
    : [["list"]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
    trace: process.env.CI ? "retain-on-failure" : "off",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

3 个旧 `playwright.{review,qa-fix-3,codex-r4,iw}.config.ts` **不删** (历史 e2e debug 用), 但新权威 config 是 `playwright.config.ts` (Playwright CLI 默认拾取)。

## fixtures 设计

### `tests/_fixtures/prisma.ts`
```typescript
// createMockPrisma(overrides?) — 基于 Prisma.ModelName 自动 stub 每个 model CRUD
// 返回 typeof prisma 兼容对象;支持局部 override:
//   const prisma = createMockPrisma({ user: { findUnique: vi.fn().mockResolvedValue(...) } })
```
覆盖所有 schema.prisma 当前 model (16+ models)。

### `tests/_fixtures/users.ts`
```typescript
export const fixtures = {
  teacher1: { id: "tid-1", email: "teacher1@finsim.edu.cn", role: "teacher", classId: null },
  teacher2: { id: "tid-2", ... },
  student1: { id: "sid-1", role: "student", classId: "cls-A" },
  studentB1: { id: "sid-B1", role: "student", classId: "cls-B" },
  admin: { id: "aid-1", role: "admin" },
};
export const mockSession = (user) => ({ session: { user }, error: null });
```

### `tests/_fixtures/requests.ts`
```typescript
export function buildJsonRequest(url, method, body?) { ... }
export function buildAuthedRequest(url, method, sessionUser, body?) { ... }
```

## CI ci.yml 增改

加新 job `playwright-smoke`:
- 等 deploy-staging 完 (`needs: staging-deploy`?) — 但 ci.yml 和 deploy-staging.yml 是分开 workflow，跨 workflow 等待需要 `workflow_run` trigger
- 备选 A: 加在 ci.yml 同 workflow, 跑 local dev server (npm run dev &) + smoke — CI 内启 server 跨 minutes
- 备选 B: 加在 deploy-staging.yml 末尾 (smoke against staging URL) — 跑 staging 真栈
- **推荐 B**: 配合 Q1 fail-on-error 决策 — staging 真栈 + smoke 红 → block PR

**等 coord 决定 + Q1 决策一起定**

## 风险

1. **staging-deploy 已自带 smoke (curl /login HTTP 200)** — 我们加的 playwright smoke 是「真浏览器跑完整流程」更深，但可能与 curl smoke 时序冲突 — 解决: playwright 在 staging-deploy `Staging smoke test` step 之后
2. **5 主线 smoke 真调 AI provider** (simulation / SB reply / weekly-insight) — staging env 有 `AI_PROVIDER` 配置，会真烧 token (~$0.01/run) — 接受，每 PR 一次成本 OK
3. **删 14 个测试文件减少 ~2750 行覆盖** — review F-3 已 deletion-test 评估「复杂度消失」+ utils 部分拆留，CI 红绿信号反而提升 (假阳性消失)。但需要 user / coord 二次确认: **删 grep 守可能让某些"中文文案改了我们能在 CI 捕到"的 invariant 消失** — 这是 spec 列出的明确接受 trade-off
4. **fixture 引入后老 test 不立刻迁移** — 33 处 prisma mock 漂移问题不立刻解决，但 new test 都用 fixture → 漂移止血、不回头治理 (spec 没要求迁移老 test)
5. **vitest count 增长** — 1094 → 删 14*~10 = ~140 test (-140) + 加 ~30 route × 3 = ~90 test (+90) + 拆出 pure utils +50 → 净 -0~50；spec 没要 count 不降，OK

## 时间估

- Plan approval round-trip: 30 min
- playwright.config.ts + 5 smoke spec + _setup.ts: 2.5 hr
- tests/_fixtures/{prisma,users,requests}.ts: 1 hr
- 30 route × 3 case 三角 (5-7 files): 4 hr
- 删 14 文件 + 拆 2 文件: 30 min
- ci.yml 加 playwright job (取决 Q1 Q2 决策): 1 hr
- 全量 `npx tsc --noEmit && npx vitest run` + 修 regression: 1 hr
- build 报告: 30 min
- **Total: ~11 hr (单 session 完成可能勉强, 跨 2 session 安全)**

## 文件清单 (预计 diff)

```
+ playwright.config.ts                                    (~30 行)
+ tests/_fixtures/prisma.ts                               (~150 行)
+ tests/_fixtures/users.ts                                (~50 行)
+ tests/_fixtures/requests.ts                             (~30 行)
+ tests/e2e/smoke/_setup.ts                               (~100 行)
+ tests/e2e/smoke/01-teacher-create-publish.spec.ts       (~80 行)
+ tests/e2e/smoke/02-student-submit-simulation.spec.ts    (~80 行)
+ tests/e2e/smoke/03-ai-grade-release.spec.ts             (~80 行)
+ tests/e2e/smoke/04-sb-free-question.spec.ts             (~80 行)
+ tests/e2e/smoke/05-weekly-insight.spec.ts               (~80 行)
+ tests/api/submissions.api.test.ts                       (~300 行, 8 route * 3 case)
+ tests/api/tasks.api.test.ts                             (~280 行, 8 route * 3 case)
+ tests/api/task-build-drafts.api.test.ts                 (~150 行, 3 route * 3 case, +existing)
+ tests/api/study-buddy-posts.api.test.ts                 (~80 行, 2 route * 3 case)
+ tests/api/courses.api.test.ts                           (~150 行, 3 route * 3 case, +existing courses-patch)
+ tests/api/adaptive-quiz.api.test.ts                     (~80 行, 1 route * 3 case + already covered by anl-28-42)
+ tests/api/quiz-check.api.test.ts                        (~80 行, 1 route * 3 case)
+ tests/api/ai-sb-reply.api.test.ts                       (~80 行, 1 route * 3 case)
+ tests/grades-transforms.test.ts                         (~280 行, 拆自 pr-stu-1)
+ tests/study-buddy-transforms.test.ts                    (~320 行, 拆自 pr-stu-2)
~ .github/workflows/ci.yml 或 deploy-staging.yml         (~30 行)
- 14 文件 (~2751 行)
- pr-stu-1-grades.test.ts (359) - pr-stu-2-study-buddy.test.ts (401)

净新增: ~2350 (new) - ~3511 (deleted) = -1160 行 (PR 净 diff 负数, 收紧)
但「diff line count」算 GitHub PR 改动总和 = 5861 行 (insert + delete + modify)

⚠️ 触红线: spec 限 1500 行 — 已知超! 必须再 ask coord:
A. 改 spec 把 14 文件删去算「负 diff 不计入 1500」(本质是仪式删, 不增功能)
B. 把删除拆到独立后续 commit/PR (不在 PR-1, 单 PR-1.5)
C. 只删 5-6 个最严重的 (pr-dash-1a/1b/1c, pr-stu-1/2 拆), 其余 9 个留 backlog
```

**等 coord 决定第 5 个问题 Q5**: diff 总量超 1500 行,如何处理?
