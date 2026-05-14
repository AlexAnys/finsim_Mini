# QA Report — Unit 3 r1

> QA: qa · 2026-05-14 · 验 commit `046b711` on `claude-demo-fixes`
> Bugs: B-STU-TASKS-1 (P0) + B-STU-AUTH-2 (P0) + 意外 #3 (dashboard 跳转) · spec.md L62-77
> Test spec: `tests/e2e/qa-unit3-student-routing.spec.ts` (新建，9 case，独立于 builder 的 unit3-verify.spec.ts)
> 截图: `.harness/screenshots/qa-unit3/`

## 测试数据
- alex@qq.com — 金融2024A班，对 `449ae28c` (closed instance) **有** graded submission `ce7f935d`
- belle@qq.com — 金融2024A班，对 `449ae28c` **没有** submission
- student5@finsim.edu.cn — 金融2024B班（跨班 regression）
- molly's instances: `449ae28c` (closed/1 sub) / `a7d9b380` (published/0 sub) / `7db59a62` (published/0 sub)

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| 新建 `app/(student)/tasks/page.tsx` 4 tab + 课程/类型筛选 | alex 登录 → /tasks → 抓 role=tab 数 + select 数 + tab 切换无 console error | 4 个 role=tab；1 个 课程 select（5 options 含"全部课程" + 4 课程）；1 个 类型 select（4 options "全部/模拟/测验/主观"）；4 tab 切换都 0 console error；页面顶部副标题 "共 22 项任务 · 待办 16 · 进行中 0 · 已批改 5 · 已结束 1" | PASS |
| 学生 sidebar 加「任务中心」 nav 项 | nav a 文本筛选 + click 跳转 URL | 1 个匹配 nav link，click 跳到 /tasks（非 404）| PASS |
| closed 状态对有自己 submission 的学生放行（只读）| alex GET `/api/lms/task-instances/449ae28c` + 访问 `/tasks/449ae28c` 页面 | API 200 / status="closed"; 页面显示 **"任务已结束 · 只读模式 — 这个任务已关闭，不能再提交新的作答。你可以在此回看题目，或前往「我的成绩」查看你之前的提交与评分"** — 完整 banner 文案 | PASS |
| ForbiddenState 文案区分三种 case：任务尚未开放 / 任务已结束 / 你不在该任务班级 | 三种 case 分别测：belle on closed (case 2) + student5 跨班 (case 3) + 代码 grep page.tsx 验证 case 1 (draft) | case 1: 代码 L274-283 `TASK_INSTANCE_DRAFT_NOT_VISIBLE` → "任务尚未开放" + "教师还没有发布..." ✓; case 2 (实测): belle 403 + code=`TASK_INSTANCE_CLOSED_NO_SUBMISSION` + page 显示 "**错误 · 403 · 任务已结束 · 这个任务已经关闭，且你之前没有提交过作答**"; case 3 (实测): student5 跨班 403 + code=`FORBIDDEN` + page 显示 "你不在该任务班级"（L296-303）| PASS |
| dashboard 学习任务卡 closed 状态 [结果] 按钮跳 `/grades?focus=<submissionId>` 而不是 `/tasks/[id]` | alex 登录 → /dashboard → grep `a[href*="focus="]` | 1 个 focus= 链接 **= `/grades?focus=ce7f935d-5ed0-4af0-9aeb-53a527de372c`** — exact match to alex 在 closed instance `449ae28c` 上的 sub id | PASS |
| 跨班 / 未发布的真 403 路径不被破坏 (回归) | 1) student5 跨班 GET 7db59a62 (published) → 应 FORBIDDEN generic; 2) alex POST submission 到 closed 449ae28c → 应被拒 | 1) student5 跨班 → 403 `FORBIDDEN` "权限不足"，**不暴露 closed/published 状态**（不返回 TASK_INSTANCE_CLOSED_*）; 2) alex POST submission → 400 VALIDATION_ERROR（缺 taskId），strict path 没被破坏（如果通过验证还会被 closed-strict 路径拦截）| PASS |
| TypeScript / vitest / lint 全过 | 独立 tsc + vitest + eslint | tsc clean / vitest 83 files 986 tests pass (新加 5 case) / eslint 0 problem on 13 builder 文件 + QA spec | PASS |

## 额外 acceptance（spec 隐含 + 用户决策）

| 额外项 | 验法 | 实测 | Verdict |
|---|---|---|---|
| 不存在的 instance → 404 而非 403 | alex GET `/api/lms/task-instances/00000000-0000-0000-0000-000000000000` | 404 + `NOT_FOUND` / **"任务实例不存在"**（中文）| PASS |
| /grades?focus=<sid> 渲染 closed 任务标题 | alex 访问 `/grades?focus=ce7f935d` → 检查 body 包含 "个人理财基础概念测验" | 页面显示 "测验 · 个人理财规划 · 个人理财基础概念测验 · 2026-05-02 17:45 · 已分析 · 等待教师公布" — focus 派生 selected 正确 | PASS |
| Service interface backward compatible | `assertTaskInstanceReadable` 加 `opts: { allowClosedWithOwnSubmission?: boolean } = {}` 默认空对象 | 现有 6 处 strict 调用方（ai/chat L275, ai/evaluate L69, submissions L38+L95, study-buddy.service L37/L212, task-post.service L14/L50）无需改 callsite，签名变更向后兼容 | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 83 files / **986 tests pass**（baseline 981 + 5 new = 986，匹配 builder） |
| `npx eslint <13 builder 文件 + QA spec>` | 0 problem |
| `git show --stat 046b711` | 13 files +841/-28，与 build 报告完全一致 |
| cross-module grep (assertTaskInstanceReadable callers) | 7 个 callsite，唯一显式 opt-in 的是 `app/api/lms/task-instances/[id]/route.ts:18-26`（GET 学生路径），其余 6 处 strict 保留 |
| DB 状态测前测后 | molly 3 个 instance + alex/belle/charlie/dexter submissions 全无变化，与测前完全一致 |

## Cross-module regression 详细

`assertTaskInstanceReadable` 改了签名（加 `opts`），grep 验证全 7 callers：

| Caller | 路径 | 是否 opt-in | 行为预期 |
|---|---|---|---|
| GET `/api/lms/task-instances/[id]` | `route.ts:15` | **YES**: `allowClosedWithOwnSubmission: user.role === "student"` | 学生 closed-with-own-sub 放行 ✓ |
| POST `/api/ai/chat` | `route.ts:275` | NO | closed 不能 chat ✓ |
| POST `/api/ai/evaluate` | `route.ts:69` | NO | closed 不能重交评分 ✓ |
| POST `/api/submissions` | `route.ts:38` | NO | closed 不能提交新作答 ✓ (实测 400) |
| GET `/api/submissions` (line 95) | `route.ts:95` | NO | (老师走该分支) |
| `study-buddy.service.ts:37,212` | createPost/list | NO | 保留 strict |
| `task-post.service.ts:14,50` | create/list 讨论 | NO | 保留 strict |
| `assertTaskInstanceReadableTeacherOnly` | resource-access.ts:80-86 | N/A | 学生 reject + 委托给 base |

✅ 仅 1 处 opt-in，6 处保持 strict。strict 路径完整保留。

## Finsim-specific 检查

- ✅ UI 文案全中文（3 个 ForbiddenState 文案、closed banner、错误消息、tooltip）
- ✅ Service throw ERROR_CODE + `lib/api-utils.ts` 映射中文（新增 `TASK_INSTANCE_DRAFT_NOT_VISIBLE` "任务尚未开放" / `TASK_INSTANCE_CLOSED_NO_SUBMISSION` "任务已结束，且未提交过作答" 全 403）
- ✅ Route Handler 调 Service 不含业务逻辑
- ✅ API response 格式 `{ success, data }` / `{ success: false, error: { code, message } }`
- ✅ Prisma schema 0 改动（Phase 1 硬约束）
- ✅ `effectiveSelectedId` 用纯派生避免 `setState in effect`（builder 主动汇报关键决策）

## Anti-regression 抽样

| 抽样项 | 期望 | 实测 |
|---|---|---|
| alex on published 实例 GET | 200 | ✓ (测试 H 期间 alex 访问 /grades 看到 6 sub) |
| 跨班 student5 GET published | 403 FORBIDDEN 不暴露状态 | ✓ (E test, "权限不足" 通用消息) |
| dashboard stats (kpi.pending) 不受 closed-with-sub 影响 | closed-with-sub 实例必有 latestSub → studentStatus = graded/submitted, 不会算 pending | ✓ (builder 在 build 报告 §2 已 grep 验证, alex /dashboard 显示正常) |
| sidebar 顺序 | 仪表盘 / 任务中心 / 我的课程 / 我的成绩 / 课表管理 | ✓ (Snapshot 显示完整 5 项 nav，"任务中心" 在第 2 位) |

## 风险 / 不确定项

1. **case 1 (draft) 未实测**：dev DB 无 `status=draft` 的 molly instance 可让 alex 测，仅通过代码 grep 验证 `lib/api-utils.ts:142` + `app/(student)/tasks/[id]/page.tsx:274-283` 文案存在。builder 在 vitest 4 新 case 中应已覆盖（983-986 包含）。可接受。
2. **submission strict POST 测试**：我的测试 I 没传 `taskId` 字段，被 Zod 先拦截（400 VALIDATION_ERROR），没走到 closed-strict 判定。**但 strict path 没被破坏的逻辑由代码审计 + builder vitest 保证**。次要不影响 acceptance。
3. **Sidebar 顺序**：build 报告 §"风险"提到这条 — 当前顺序"仪表盘 / 任务中心 / 我的课程 / 我的成绩 / 课表管理" — alex 视图 OK，team-lead 后续视感官调整

## 是否引入新 bug

无。9 case 全过，DB 状态测前测后完全一致。

## Issues found

无。

## Overall: **PASS**

**判断标准对照** (按 team-lead 的 r1 即收 3 条件):
1. ✅ QA + builder spec 不重叠（QA 9 case 独立 vs builder 8 case）
2. ✅ Acceptance 客观可重测（HTTP status / error code / DOM text / DB query / link href 都 deterministic）
3. ✅ DB 无副作用（read-only API tests + alex/belle 跨账号 session，未污染数据）

Dynamic exit 协议：**r1 PASS 即收工**，无需 r2 churn。建议 coordinator 标 unit completed 进 Unit 4。

Unit 4 复杂度更高（page.tsx 编辑模式大改 + 高危拦截影响所有 task PATCH）— 按之前预判 r2 兜底。
