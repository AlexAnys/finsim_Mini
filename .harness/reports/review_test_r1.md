# Review — Test coverage & testability (r1)

## Reviewer charter

独立审查 `tests/**` 1086 case + vitest/playwright 配置 + 34 service 的可测性。关注「interface is the test surface」——哪些接口不是好测试面、哪些覆盖是仪式、哪些核心路径根本没测。

## Method

- 读 `vitest.config.ts`、3 个 `playwright.*.config.ts`、`.github/workflows/ci.yml`、`package.json` scripts
- `ls tests/*.test.ts` 列 194 文件，逐 service 做覆盖映射（grep service 名出现在多少 test 文件）
- 抽样精读 6 个有代表性 test：`grading-concept-tags`、`grading-late-penalty`、`anl-28-42-access`、`courses-patch.api`、`quiz-adaptive-engine`、`pr-stu-3-schedule-hero`
- 抽样 4 个 "guard / 文案" 类 test：`pr-dash-1a-text`、`pr-stu-2-study-buddy`、`pr-sim-bug-fix-leak`、`pr-fix-2-batch-b`
- 抽样 2 个 e2e：`phase3-m4-student-submissions`、`unit1-verify`
- 关键指标 grep：`describe`=275 / `it|test`=1086（与 HANDOFF 报 1094 几乎一致）/ `vi.mock`=33 文件 mock prisma / `readFileSync`=21 文件做源码 grep / `toMatchSnapshot`=0 / `@testing-library`=未安装 / route handler test 文件=2
- 比对 service 文件 mtime vs 同名 test 文件 mtime（TDD 信号）
- 比对 CI workflow 是否跑 playwright（结果：**不跑**）

## Top findings

### F-1: e2e specs 形同虚设——CI 完全不跑，98 个文件几乎都是一次性 QA 脚本 — Severity: **P0**

- **Files**: `.github/workflows/ci.yml`（仅 `npx vitest run`），`tests/e2e/*.spec.ts`（98 文件），`playwright.{review,qa-fix-3,codex-r4}.config.ts`（3 个一次性 config，没有规范的 `playwright.config.ts`）
- **Problem**: **No-seam in CI**——quality job 只跑 vitest，e2e 一行都不跑。98 个 spec 里 35 个叫 `unit{N}-verify.spec.ts` 或 `phase3-m{N}-*.spec.ts`，是 builder/QA 一次性手工验收脚本，硬编码了 instance UUID（`SIM_INSTANCE_ID = "341231af-..."` 见 phase3-m4-student-submissions.spec.ts:9），DB 一变就失效。spec.md 提到的 `playwright.iw.config.ts` **不存在**。
- **Why-it-bites**: 真实演示路径回归只能靠人肉跑 + 截图。任何 schema change / route 重构通过 CI 后到 staging 才被发现。phase3-m4 把 6 个学生的真实提交硬编码成 e2e 输入，离开 molly 这个固定数据集就跑不通——它不是 e2e test，是 **seed 脚本**伪装成 test。
- **Deletion test**: 删 90% e2e specs 复杂度**消失**——它们没有 owner、没有 baseline、CI 不跑、没 docs。保留 3-5 个真正的核心 smoke（login → 看 dashboard、teacher publish task、student submit → AI grade）即可。
- **Suggested direction**: 写一个权威的 `playwright.config.ts`，挑 3-5 个核心 smoke，每个 PR 在 staging 上跑一遍；其余 e2e 全部归档到 `.harness/scripts/` 或删。
- **Tests would improve**: 一旦 e2e 真上 CI，task→submit→grade 主线就有自动护栏；目前 1086 vitest case 全是单元，主线集成靠人。

### F-2: 几乎所有 service 测试都 mock 整个 Prisma client——验证的是 mock 的对话，不是真实查询 — Severity: **P0**

- **Files**: 33 个 test 文件 `vi.mock("@/lib/db/prisma")`（占核心 service test 大头），具体如 `tests/dashboard.service.test.ts:3-11`、`tests/anl-28-42-access.test.ts:30-64`、`tests/grading-concept-tags.test.ts:3-25`
- **Problem**: **Shallow seam + leaky abstraction**。Service 直接 `import { prisma } from "@/lib/db/prisma"`，没有 repository / DAO 接口隔离。测试只能 `vi.mock` 整个 prisma 客户端，然后断言「调用了 `findMany` with `{ where: { OR: [...] } }`」——这是在测 ORM 调用形状，不是测业务规则。如果有人改了 schema 字段名或 include 树，**mock 的 Prisma 永远不会报错**，但运行时 500。CLAUDE.md 自己强调「Prisma Gotchas: `npx tsc --noEmit` passes even when Prisma runtime fields are wrong」——测试也一样过。
- **Why-it-bites**: 这正是 HANDOFF 里 #43 单元（"Prisma 三步严格走，仅 generate 不够"）已经踩过的坑。dashboard.service.test.ts:54 显式断言「analytics relation 不在 include 里」——这种断言只有读 mock 实现细节才能写，重构 include 必断。
- **Deletion test**: 删掉这些 mock 复杂度**分散到每个 test**——所以现状已经在分散状态了；问题是它创造了**假信号**（mock 替代真 DB 时所有错都被吃掉）。
- **Suggested direction**: 引入 repository 层（哪怕只是 `lib/db/repositories/*.ts` 把每个 model 的查询包成函数），让 service test 可以 mock repository 而非整个 prisma；或者更狠：service test 走 **真 testcontainer postgres**，仪式测试退化为「调用了某 mock」的占大头部分能直接删。
- **Tests would improve**: 引入 repo seam 后，service 单测 mock 面缩到 5-10 函数（不是整个 prisma），且 schema drift 会立刻让 mock signature 编译失败；目前 schema 改了，mock 不会报。

### F-3: 21 个 `readFileSync` 锁文件式守护测试——锁了字符串，不锁行为 — Severity: **P1**

- **Files**: `tests/pr-dash-1a-text.test.ts:13-103`（greeting-header / weak-instances / kpi-strip 三个组件全靠 `readFileSync(...).toMatch(/中文文案/)`），`tests/pr-stu-2-study-buddy.test.ts:212-400`（8 个 it 块全是源码 grep），还有 19 个 PR-* 系列同类
- **Problem**: **Wrong abstraction level**——UI 行为应该走 `@testing-library/react` 渲染断言，但 package.json 根本没装 testing-library，vitest `environment: "node"`。测试只能 grep 源码字符串，等于「这个组件文件里有 `<span>新建任务</span>` 这串字符」。无法验证 prop 传递、事件、条件渲染、a11y。换个等价的写法（比如把字符串拆到常量文件）就挂。
- **Why-it-bites**: 这种测试给 false-positive 安全感——「pr-dash-1a 8 个 it 全绿，组件没被破坏」实际上字符在不在文件里和组件能不能 render 没关系。一旦 i18n、字符串提取、styled-jsx 替换 className，全炸但实际 UI 完全没坏。同时反过来——文件里有这字符串但渲染条件挂了，测试不抓。
- **Deletion test**: 删掉这 21 文件**复杂度消失**——它们在 git diff 上充当「这是我改了什么」笔记本，不是测试。
- **Suggested direction**: 装 `@testing-library/react` + `happy-dom`，把核心 dashboard / runner / dialog 组件做 5-10 个真渲染测试；其余文案守护直接删（或转为 ESLint rule 如「不许引入 hard-coded 英文」更便宜）。
- **Tests would improve**: 真 render 后能测 `<KpiStrip>` 4 列、`<StudyBuddyComposer>` 切换 mode 后 placeholder 变化、`<SimulationRunner>` 超时禁用——都是真业务规则。

### F-4: pure function 被 leaky module-level imports 污染——`computeLatePenalty` 测试要 mock 4 个依赖才能 import — Severity: **P1**

- **Files**: `lib/services/grading.service.ts:1-5`（顶部 `import { prisma }` + `import * as aiService` + 等），`tests/grading-late-penalty.test.ts:3-6`（要 mock prisma/ai/submission/audit 才能 import 一个**完全 pure** 的 `computeLatePenalty`）
- **Problem**: **No locality / leaky abstraction**。`computeLatePenalty` 是纯函数（in: 4 个 primitives, out: object），但因为它住在 grading.service.ts 顶部，整个模块的副作用依赖（prisma / ai sdk / audit / submission service）一起被拉进来。最小测试要 4 行 `vi.mock` 才能 `import`，污染所有「我只想测一个数学计算」的场景。
- **Why-it-bites**: 测试启动成本（import + mock 设置）压倒断言。开发想给「分数下限不能负」加一个 case，看到要写 4 个 mock，会跳过；或者倾向「在 service 里加 if 而不是抽函数」因为抽出来还要再 mock。Pure 函数应该住在 `lib/utils/` 或 `lib/grading/late-penalty.ts`，被 service import，测试 0 mock。
- **Deletion test**: 删 mock 块复杂度**消失**——前提是把 pure 函数搬出 service。否则分散到每个测试。
- **Suggested direction**: 把 grading.service.ts 里的 pure helpers (`computeLatePenalty`、`clampScore`、`roundScore`) 拆到 `lib/grading/penalty.ts`；同样原则用到 `quiz-adaptive.service.ts`（已经做得不错，引擎大部分函数 pure）、`schedule-utils.ts` 之类。
- **Tests would improve**: pure 模块的 test 0 mock，rerun 速度从「import 整个 prisma client」降到几 ms；其次让人愿意补 case（penalty edge cases、四舍五入策略、跨时区 dueAt 等）。

### F-5: 90 个 route handler，只有 2 个有真测试——authorization gap 主战场是裸的 — Severity: **P1**

- **Files**: `app/api/**/route.ts`（90 个文件，其中 75 个有 POST/PUT/DELETE/PATCH），可直接 `import { GET as ..., POST as ... }` 的测试只在 `tests/anl-28-42-access.test.ts`、`tests/courses-patch.api.test.ts`、`tests/task-build-drafts-approve.api.test.ts`、`tests/analytics-v2.api.test.ts`、`tests/scope-insights-route.test.ts`（5 个，剩余路由全靠服务层间接覆盖）
- **Problem**: **Bad locality**——route handler 的核心责任是 Zod 校验 + auth guard + service 调用 + 错误映射，这 4 项里只有「service 调用」被服务层测试间接覆盖了。Zod 边界、`handleServiceError` 错误码→HTTP status 的映射、`requireRole(["teacher", "admin"])` 实际触发——基本没系统性测试。`anl-28-42-access.test.ts` 是个例外（它专门补 PR #11 codex 抓的 ANL-28~42 鸿沟），但它本身就说明**之前 14 个 authorization gap 没测**才被 codex 抓出来。
- **Why-it-bites**: codex 的 4 轮 review 抓 10 个 P1（HANDOFF #20）几乎全是 authorization / over-fetch / cross-course 类，正是 route 层的 zone。没有 route handler 测试 = 这一层永远靠 codex 抓而不是自测。
- **Deletion test**: 不能删——这是漏洞的天然栖息地。
- **Suggested direction**: 给每个 mutation route（PATCH/POST/DELETE）至少加 3 case：`200 happy / 401 未登录 / 403 跨用户`，跑在 vitest 内（已有 anl-28-42 模式可复用，~30 行/test）。
- **Tests would improve**: Route 层 200/401/403 三角能在 CI 直接抓「我把 `requireRole(["teacher"])` 改成 `requireRole(["teacher", "student"])` 一时手滑」这种事故；目前要等 codex 或 staging。

### F-6: 没有 test-helpers / fixtures——33 个 test 文件各写各的 mock prisma 块 — Severity: **P1**

- **Files**: 无 `lib/db/test-helpers.ts`、无 `tests/_fixtures/`、无 `tests/helpers/`——`ls` 全空。33 文件各重写 `vi.mock("@/lib/db/prisma")` 块，每个 8-50 行
- **Problem**: **Bad leverage**——同样一个 prisma mock shape 复制 33 次，每个略不同（field 顺序、mock 哪些 model 不一样）。一旦 prisma client 类型变（比如 schema 加 model），33 处都要单独改；没人会全部改对，所以漂移开始。`courses-patch.api.test.ts:4-7` 还显式 `vi.importActual` 拿真实 assertCourseAccess——这种小心思应该在 helper 里复用。
- **Why-it-bites**: 加新 model（如 PR #12 加 hiddenAt / TaskBuildDraft.approved / AiRun.tokens） → 老 mock 没这字段 → 用了老 mock 的测试看不见新行为。F-2 + F-6 叠加：mock 是浅的，又是分散重复的——schema drift 双倍隐形。
- **Deletion test**: 不能整体删，但 33 处 prisma mock 块 → 1 个 `createPrismaMock()` 工厂，复杂度集中。
- **Suggested direction**: 建 `tests/_fixtures/prisma.ts` 导出 `createMockPrisma()`（基于 `Prisma.ModelName` enum 自动 stub 每个 model 的 CRUD），加 `tests/_fixtures/users.ts` 导出 mock teacher/student/admin session；test 文件用 helper，schema 一变只改一处。
- **Tests would improve**: 测试可读性陡升（每个 file 不用 50 行 setup），且新加 test 的成本降低 → 大家更愿意补；schema drift 集中在 helper 一个文件里。

### F-7: TDD 几乎不存在——source files 系统性比 test files 新 — Severity: **P2**

- **Files**: 抽样比对：`lib/services/study-buddy.service.ts`、`grading.service.ts`、`quiz-adaptive.service.ts` 都是近 7 天 mtime，且**比对应 test 文件新**。所有"近 7 天新建 test"（16 文件）几乎全是 `pr-*` / `fix-*` / `unit*-verify` 命名——后置补的回归 guard，不是先 test 后 impl
- **Problem**: **No discipline seam**——CLAUDE.md 写「TDD: 写 test → 确认失败 → 写实现 → 测试通过」，但实操是 spec → builder 写 impl → qa 跑 → 出错再补 test。Test-after 本身不致命，但**和 F-2 / F-3 叠加**就有 negative leverage：测试是为了「锁住我刚写的实现」而不是「描述我想要的行为」，所以多数测试 mock 自己刚写的 prisma 调用 / 文案。
- **Why-it-bites**: 1086 case 看起来豪迈，但「实质测试」（IRT 引擎、computeLatePenalty、Zod schema 边界、resource-access guard、joinStudyBuddyPosts 派生逻辑）约占 30-40%；其余是 ceremonial。**Deletion test for the discipline**: 砍 50% 仪式测试，bug 捕捉率几乎不掉——这是 ceremony 的定义。
- **Deletion test**: 砍 50%（grep 守护 + 复述 mock 调用 + 单一字符串断言）→ 真信号没受损。
- **Suggested direction**: 不是机械要求 TDD，而是 PR review check「这测试在哪种 bug 下会变红？如果只有重命名变量会让它红，删」。可考虑给每个 PR 用 mutation testing tool（如 `stryker`）小范围跑一次。
- **Tests would improve**: 移除噪音后，剩下 600-700 case 真信号密度翻倍，单测跑得更快，failure 都是真信号。

### F-8: AI provider 没 Adapter seam——`getProviderConfig` 直接读 `process.env`，测试只能 stub env — Severity: **P2**

- **Files**: `lib/services/ai.service.ts:35-65`（`getProviderConfig` 直接 `process.env.MIMO_API_KEY` 等），`tests/ai-provider.test.ts`、`tests/ai-tool-settings.test.ts`
- **Problem**: **No-seam for providers**——`getProviderConfig` 是 5-arm switch 读 env，没接受 config object。测试想验证「provider=mimo 时 baseURL 走 resolveMimoBaseUrl」只能 `vi.stubEnv`，且不能并行（env 全局）。同时 `aiGenerateJSON` / `aiGenerateText` 是模块顶层函数，使用方靠 `import * as aiService` + `vi.mock` 拦截——这是测试者拼命补的 seam，不是设计提供的 seam。
- **Why-it-bites**: 加新 provider 时，没接口约束（只有 string union），测试不强制全 provider 都过同一组 contract case。`AI_PROVIDER` 切换的运行时回退逻辑（fallback / per-feature override）几乎无法集成测试。
- **Deletion test**: 删 AI provider abstraction 不通——核心需求；但 `getProviderConfig` 改成接受 `(env: Env)` 函数即可让测试 0 stubEnv。
- **Suggested direction**: `getProviderConfig` 接受 env source（`(env = process.env) => ...`），让 tests 传 fake env；同时把 5 个 provider 抽成 array of `Provider` shape 跑 contract test。
- **Tests would improve**: 加 provider 自动跑同一组 contract test（"返回 baseURL + apiKey + defaultModel + name"），不会出现 r5 codex 抓"新 provider 不走 throttle"这种 cross-cut bug。

### F-9: `quiz-adaptive.service.test.ts` 是反向案例——pure function service 的标杆 — Severity: **Anti-finding（非问题，标杆）**

- **Files**: `lib/services/quiz-adaptive.service.ts:1-30`（全文件无 prisma import，全 export pure function），`tests/quiz-adaptive-engine.test.ts:1-100`
- **Problem**: 不是问题——它是**正确的 deep model with thin seam**。算法引擎接受参数返回结果，测试 0 mock，断言真实业务（题型系数顺序、ability 上升、知识点桶覆盖、stop condition）。这是 finsim 单测里**最高密度的真信号**。
- **Why-it-bites**: 反过来——如果所有 service 都按 quiz-adaptive 这种范式写（pure core + thin shell 调 prisma），可测性大幅提升，F-2 / F-4 / F-6 多半自动消失。
- **Deletion test**: 不删——证明 pure-core 模式 work，应推广到 grading / weekly-insight / scope-insights。
- **Suggested direction**: 让 grading.service 和 scope-insights.service 学这个 pattern——核心算法 pure，shell 函数（DB I/O）薄壳。
- **Tests would improve**: 看 IRT 引擎能加 20 case 覆盖各种边界，grading 也能做到。

### F-10: 测试不互相依赖——这一点做得 OK — Severity: **Anti-finding**

- **Files**: 全 tests/*.test.ts
- **Problem**: 没看到 `beforeAll` 共享 DB state、没有 test order dependency、没有「这个 test 必须先跑」的注释。1086 case 顺序无关，单跑也能跑。这是 vitest + 纯 mock 模式的自然受益（不接 DB → 无共享 state）。
- **Why-it-bites**: 反例——一旦引入真 DB（F-2 建议），需要 test isolation 设计（每 test 一个 schema 或 truncate 策略），现在的代码完全没准备。所以引入 testcontainer 时要补这一层。
- **Suggested direction**: 引入 DB 测试时，借鉴 `pgtap` 或者 `prisma migrate reset` per-test-file pattern；不要倒退到 test order 依赖。

## Anti-findings

- **1086 case 不算少**——LOC 比例 17.8k tests vs 15k services = **1.19x**，行业 1-1.5x 范围内，量纲健康。问题不是量，是**结构**。
- **e2e 文件多** 不代表 e2e 健壮——98 个里 80+ 是 unit/qa-* 一次性脚本，没有 owner、不在 CI、不被维护。这是 ceremony，不是 coverage。把它当 e2e suite 看是错觉。
- **`pr-fix-*` / `pr-dash-*` 系列**看起来是 regression guard，但多数是源码 grep guard——它们能阻止"误删某行"，**但不能阻止行为退化**。不要把它们当作 "bug 修了不会回来" 的保证。
- **`quiz-adaptive-engine`、`grading-late-penalty`（去掉 mock 噪音后）、`pr-stu-3-schedule-hero`、`pr-stu-2-study-buddy.utils 部分`** 都是真信号——pure function 测试浓度高、好维护。这部分占 30-40%，是 finsim test suite 的真核心。

## Coverage gaps map

按"service → 不易测原因 → 当前 test 真假信号"列：

| Service / 模块 | LOC | 测试文件数 | 真测什么 | 不易测原因 |
|---|---|---|---|---|
| `ai.service.ts` | ~400 | 间接 85 处 mock 但只 1 个直接 test 文件 | 几乎只测 `getProviderConfig` 各 provider 的 baseURL/apiKey/defaultModel 形状 | 模块顶层 `createOpenAI` + `streamText` 没 seam；env 读取硬编码；fallback 链路无集成 test |
| `ai-usage.service.ts` | - | **0** | — | tokens 累计、cost 计算关键路径无 unit test |
| `ai-work-assistant.service.ts` | - | **0** | — | Codex review 加进来的功能完全无 unit test |
| `study-buddy.service.ts` | 402 | 3 | createPost 部分授权 + utils transforms | KS 注入 + AI generate 调用都被 mock；excerpt 持久化逻辑无真验证 |
| `grading.service.ts` | 641 | 12 | `computeLatePenalty` 数学；部分授权 + conceptTags 落表 mock 断言 | 整个 AI evaluate → rubric breakdown → update submission 链路被 mock 断成碎片；late penalty + AI score 组合 case 无 |
| `weekly-insight.service.ts` | - | 2 | 个别错误处理 + cron path | AI 生成内容 mock 掉；prompt 实际 shape 无 contract test |
| `scope-insights.service.ts` | ~? | 2 | route 表面 | 大量 prisma include 树没 schema-drift 防护 |
| `scope-drilldown.service.ts` | ~? | 1 | 一个 case | 跨 student 聚合逻辑薄 |
| `task-build-draft.service.ts` | - | 3 | approve 状态机部分 | atomic publish + Prisma transaction 边界依靠 codex 抓 |
| `import-job.service.ts` | - | 1 | 1 case | XLS/DOCX 解析路径几无 |
| `storage.service.ts` | - | 2 | path validate | 真上传 + 防穿越 + MIME 校验链路只覆盖一半 |
| `task-post.service.ts` | - | 1 | 单 case | 讨论区授权 + clamp（codex 加） |
| `question-bank.service.ts` | - | 1 | regex | 实质题库 CRUD 无 |
| `question-bank-regex.service.ts` | - | 1 | regex | OK，是 pure helper |
| **90 个 route handler** | — | **5** | 5 个文件覆盖 ANL-* / courses PATCH / task-build-drafts approve / analytics-v2 / scope-insights | 85 个 route 的 Zod / auth / response shape 全裸 |

闭环主线 e2e 覆盖（teacher 建 task → student 答 → AI grade → analytics）：**没有任何 vitest case 串这一条**。`phase3-m4-student-submissions.spec.ts` 是 playwright 但 (a) 硬编码 molly seed UUID、(b) CI 不跑、(c) AI grade 那步还要手工触发 → 不是 e2e test，是 demo seed 脚本。

## Cross-cutting hunches

1. **F-2（mock Prisma 整片）+ F-6（无 fixture）+ F-3（grep 源码）三联** 是同一个病的不同症状：**finsim 没有「测试 seam」这个抽象**。测试都是 ad-hoc 绕开运行时依赖的方式，每种方式不一样。引入 repository / adapter / fixture 层后，三个症状会同时缓解。给 review-arch / review-data 看：repository 层不只是测试想要，也是 schema migration 漂移的拦截点。
2. **F-5 + F-1 联系**：90 个 route 没真测试 + 98 个 e2e 不跑 CI，所以 finsim 的「集成层」（HTTP + auth + Zod + service 调用 + Prisma）**完全没有自动护栏**。codex 4 轮 + ultrareview 抓的几乎全是这一层的 bug——这不是巧合，是必然结果。给 review-security / review-recent 看：authorization fence 测试覆盖率是 critical 风险。
3. **F-7（TDD 缺失）+ HANDOFF.md "r1 即收"** 一起读，得到 finsim 实际质量门:**先做工作，事后补回归 guard，期望 codex 抓集成 bug**。这不是 TDD，是 review-driven development——只要 codex / ultrareview 没漏，就 OK；只要漏，就上 staging 时炸。Demo 阶段可承受，长期教学项目并发用户上来后是定时炸弹。给 coordinator 看：是否要把"PR 合 main 前至少加 1 个 happy + 1 个 error e2e in CI" 写进 spec.md 行为底线。
4. **`pr-stu-2-study-buddy.test.ts` 同时混合 utils pure test（好）+ readFileSync UI guard（差）** 是典型「一个测试文件双重人格」。F-3 改造时要拆，不要一刀切（utils 部分要留）。给 review-recent 看：PR #12 大量 unit 测试都是这种混合形态。

---

**Report ends.** Top P0 是 e2e + route handler 全裸（F-1/F-5）+ mock 整片 Prisma 没有 seam（F-2）；中长期治理靠 repository / fixture / pure-core 三件套。**Interface is the test surface**——finsim 的测试面被 `lib/db/prisma` 这个不可换模块和 90 个无测试 route handler 切割成"测 service 表面行为 + 锁 UI 字符串"两块，**真业务行为**（authorization + schema drift + AI 链路 + 主线集成）夹在中间没人守。
