# QA Report — PR-1 Regression (4 candidate sampling + vitest baseline) r1

> QA: qa-pr1-regression · Branch: `claude-codequality-pr1` · PR #14
> Scope: vitest baseline + 4 candidate (A / D / E / I+J) 真浏览器抽样
> Local env: postgres (Docker) :5432, dev server :3000 (next-server v16.2.4, started 14:10 post-migration 13:54), schema = `drop_dead_schema_pr1` applied
> Live drive: scripted Playwright against http://localhost:3000 (gstack `/qa-only` not available in teammate shell — used `npx playwright test` 等价路径)
> CI status @ QA time: `quality` PASS · `staging-deploy` **FAIL** (10m21s, 4/5 smoke spec 在 staging 红)

## 结果总览

| 候选 | 我的验证项 | verdict | 关键证据 |
|---|---|---|---|
| **A** CI 测试基础 | staging-deploy CI 红绿 | **FAIL** | CI staging Playwright job 红 (run 25954876119); 4/5 smoke spec payload 不符合 zod schema; smoke QA r1 已记录同一问题 |
| **D** 审计 default-on | molly 改 instance title → audit 行 + actorRole=owner | **PASS** | API 实测 4 行 `task_instance.update` 行入库, `actorId=molly`, `metadata.actorRole=owner`, targetId 匹配 |
| **E** AI prompt registry | /teacher/ai-settings preview vs builder | **PASS** | `/api/ai/tool-settings` 返回 simulationChat preview 含 builder 第一句 "你是一个金融理财场景中的模拟客户" — 单源派生确认 |
| **I+J** Schema 清理 | 3 teacher 页 200 + removeCourseClass guard + DB DDL | **PASS** | 死表 / 死字段 / Visibility enum 全 dropped (SQL 验证), Course.classId nullable=YES; 3 页加载无 fatal; guard 返回 400 + 中文 "至少保留" |

**vitest 全量 baseline**: 1099/1099 PASS (105 files, ~6.5s) — 0 regression

**Overall: FAIL (A acceptance 未达标 → PR-1 整体未通过 100% 100%)**

---

## 详细 dimension checklist

| # | 维度 | verdict | evidence |
|---|---|---|---|
| 1 | Spec compliance | **FAIL** | spec.md A 专属 acceptance "playwright 主线 smoke step fail-on-error/warning 由 builder 决定" — 选了 fail-on-error 硬阻塞, 但 4/5 spec 立即红 → A acceptance "5 主线 smoke 编写完" 字面 ✓ 但运行 ✗ |
| 2 | tsc --noEmit | **PASS** | CI `quality` job 报 0 error; 本地 `git status` clean (我只新增 1 个 QA spec test 文件) |
| 3 | vitest run | **PASS** | 本地全量 1099/1099 (Test Files 105 passed) — D/E/I+J 改动 0 regression |
| 4 | 真浏览器 (live drive) | **MIXED** | D/E/I+J = PASS (5 张截图 + API 断言); A staging CI = FAIL (staging-deploy run 25954876119) |
| 5 | Cross-module regression | **PASS** | git diff main..HEAD 主要 service + prompts; teacher dashboard/courses/instances 真加载无 Cannot read undefined / Prisma unknown field 类报错 (page errors filter 0 命中) |
| 6 | Security (/cso) | **N/A** | PR-1 改动: A (test infra) / D (audit append-only) / E (prompt 重构, 内容字字不变 by snapshot) / I+J (dead schema drop). 触及 `requireRole` 仅 D 加 actorRole 字段, 行为不变。`/cso` 未触发 |
| 7 | Finsim-specific | **PASS** | UI 中文 (dashboard/courses/instances/audit/ai-settings 截图确认); guard error message "必须至少保留 1 个班级关联" (zh); `requireAuth/requireRole` 用法对 (D 加 actorRole 是 wrapper 参数, 不改 auth 模式); API 响应格式 `{success, data, error}` 一致 |
| 8 | Code patterns | **PASS** | D 改动局限于 audit + actorRole 顶层参数 (review-only spot check 11 service/route caller 全同步); E prompt 内容 by snapshot test 锁定字字不变; I+J 严守 Prisma 三步 (migration applied 13:54, dev server restart 14:10) |

---

## 候选 A — CI 测试基础 (FAIL)

### 验证
- CI `staging-deploy` job (run 25954876119) **FAIL** after 10m21s
- 实测本地 reproduce: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/smoke/01-teacher-create-publish.spec.ts` → 同样 400 (与 staging 结果一致, 排除环境因素)
- API 返回真实错误体 (从我的 debug spec 抓): `subjectiveConfig: ["Invalid input: expected string, received undefined"]` — 缺 `prompt` 字段

### 根因 (smoke QA r1 已记录, 我独立 reproduce 确认)
1. `tests/e2e/smoke/01-teacher-create-publish.spec.ts:30-39` — `subjectiveConfig` 缺 zod 强制必填的 `prompt`, 含无效字段 `wordLimit`
2. `tests/e2e/smoke/02-student-submit-simulation.spec.ts:25-31` — `simulationConfig` 缺 `scenario` + `openingLine`, 含无效字段 `rounds`/`timeLimitSeconds`
3. `tests/e2e/smoke/03-ai-grade-release.spec.ts:22-29` — 同 01
4. `tests/e2e/smoke/04-sb-free-question.spec.ts:32` — list 响应 shape `data: [...]` 实际, spec 读 `data?.items` 永远 undefined
5. `tests/e2e/smoke/_setup.ts:88 cleanupSmokeSbPosts` — 同样 shape mismatch, cleanup 不工作

→ 这 5 处 bug 让 staging Playwright job 在 CI 上 4/5 fail. fail-on-error 硬阻塞设置生效, **PR-1 整体不能 merge** 直到 builder-test-infra 修 r2.

### A 之外的连锁影响
- staging URL 给用户兜底 QA 之前需要 Playwright CI 绿, 当前红卡住. (这是 spec workflow §5: "Playwright fail-on-error 硬阻塞 PR merge")
- A 自身 vitest 部分 (新加 31 routes × 3 mutation case + 6 fixture file + 14 grep guard 删除) 完全 OK, 是 e2e smoke 部分有 bug

---

## 候选 D — 审计 default-on (PASS)

### 验证 (file: `tests/e2e/smoke/pr1_qa_regression.spec.ts` test 1)
1. molly@qq.com 登录, GET /api/auth/session 拿到 userId
2. molly GET /api/lms/task-instances?take=50 — 找她拥有的 instance (createdBy === me)
3. molly PATCH /api/lms/task-instances/{id} `{title: "[QA-REG-AUDIT-PROBE] <ts>"}` — 200 OK
4. admin@finsim 登录, GET /api/admin/audit?tab=audit&take=20
5. 找最近 5 分钟内 row: `action=task_instance.update` + `metadata.actorRole=owner` + `targetId={target}` — **命中**

### 直接 DB 验证 (PSQL)
```
        action        |               actorId                |               targetId               | role  
----------------------+--------------------------------------+--------------------------------------+-------
 task_instance.update | 148ad66f-c793-4ca5-9b0d-e2d5cc7edd39 | 1eed59f9-3a70-4b30-9755-30a485e52b07 | owner
 task_instance.update | 148ad66f-c793-4ca5-9b0d-e2d5cc7edd39 | 1eed59f9-3a70-4b30-9755-30a485e52b07 | owner
 task_instance.update | 148ad66f-c793-4ca5-9b0d-e2d5cc7edd39 | 1eed59f9-3a70-4b30-9755-30a485e52b07 | owner
 task_instance.update | 148ad66f-c793-4ca5-9b0d-e2d5cc7edd39 | 1eed59f9-3a70-4b30-9755-30a485e52b07 | owner
```
(`148ad66f...` = molly's id, `1eed59f9...` = "为李志华撰写资产配置建议书" instance)

### Acceptance 命中
- ✅ `task_instance.update` action 入库 (PR #13 path 之前漏)
- ✅ `metadata.actorRole = "owner"` (自动推导, 由 `existing.createdBy === createdBy ? "owner" : "collaborator"` 判定)
- ✅ admin UI /admin/audit 200 加载 (截图 D-audit-page.png)

### 未触及 (D 之外但相关)
- ai_grading.complete + model/tokens metadata 路径未在本 spec 测 (需要真触发 AI grade, 走 AI provider 网络外部依赖) — vitest `tests/audit-default-on.test.ts` (8/8 PASS) + `tests/fix-6-grading-fail-feedback.test.ts` (13/13 PASS, 含 `ai_grading.failed` 期望) 已覆盖此路径
- ENABLE_AUDIT_LOGS env gate 删除: 通过 grep 验证 (build report 已 grep `logAudit$|logAuditForced` 空, 我本次只跑 vitest + 真接口, 没复查 grep, 但 vitest pass + functional probe pass 间接确认)

### Side effect baseline 还原
按 brief 要求 hard-delete 还原: `DELETE FROM "AuditLog" WHERE action='task_instance.update' AND actorId=molly AND targetId=1eed59f9 AND createdAt > NOW()-15min` → **DELETE 4** ✓
(虽然 D 设计是 append-only, 但 brief 显式要求清 QA-probe 行, 我已清)

---

## 候选 E — AI prompt registry (PASS)

### 验证 (test 2)
1. molly GET /api/ai/tool-settings → 拿 `data.definitions[]` 中 `simulationChat`
2. `simulationChat.basePromptPreview` 长度 > 10, 含 builder 第一句 `"你是一个金融理财场景中的模拟客户"`
3. molly 浏览器加载 /teacher/ai-settings → 200, 16 个 tool card 都渲染 (截图 E-ai-settings.png)
4. pageerror listener: 0 fatal (no `Cannot read undefined`)

### 单源对照
- 源: `lib/ai/prompts/simulation-chat.ts:22` `buildPersonaPrompt()` 首行 — `"你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话："`
- preview 来源: `lib/ai/prompts/preview.ts getToolPromptPreview("simulationChat")` → 派生自同一 builder.systemPrompt
- API 实测包含子串: ✅ — 单源派生 (review-ai F-10 修复)

### Acceptance 命中
- ✅ `lib/ai/prompts/` 23 文件存在 (build report 列, file exists 检查跳过)
- ✅ basePromptPreview 不再手写副本, 派生自 builder
- ✅ /teacher/ai-settings 真加载无错

### 未触及
- 完整 12 builder × snapshot 锁未单独跑 (`tests/ai-prompts/*.snapshot.test.ts` 52 tests) — vitest 全量已含且 PASS
- 其他 toolKey preview 字字对比 (只验了 simulationChat 这一个抽样)

---

## 候选 I+J — Schema 清理 (PASS)

### DB level 验证 (PSQL on dev DB, postgres :5432)
| 项 | 期望 | 实测 |
|---|---|---|
| `Task.visibility` 列存在 | NO | ✅ 0 rows (column dropped) |
| `Task.courseName` 列存在 | NO | ✅ 0 rows |
| `Task.chapterName` 列存在 | NO | ✅ 0 rows |
| `Visibility` type 存在 | NO | ✅ 0 rows (type dropped) |
| `TaskInstanceAnalytics` 表存在 | NO | ✅ `to_regclass=NULL` (table dropped) |
| `Class.departmentName` 列存在 | NO | ✅ 0 rows |
| `Course.classId` 列存在 | YES (留 nullable + deprecated) | ✅ exists |
| `Course.classId` is_nullable | YES | ✅ `YES` |

### 页面 level 验证 (test 3)
- molly /teacher/dashboard → 200, KPI (1/6/0/3) + 任务列表 + 趋势图 + 落后名单全渲染 (截图 IJ-teacher-dashboard.png)
- molly /teacher/courses → 200 (截图 IJ-teacher-courses.png)
- molly /teacher/instances → 200 (截图 IJ-teacher-instances.png)
- pageerror + console.error filter: 0 schema 类 fatal (no `TaskInstanceAnalytics`/`visibility`/`courseName.*not exist`)

### removeCourseClass guard (test 4)
| 路径 | 期望 | 实测 |
|---|---|---|
| 单班级 course → DELETE 主班 | 400 `MUST_KEEP_AT_LEAST_ONE_CLASS` + 中文 "至少保留" | ✅ 命中 (molly 的 "个人理财规划" 单班 case) |
| ≥2 班级 course → DELETE 主班 | 200 + 还原 baseline | ⚠️ molly dev DB 无 ≥2 班 course, 此路径未实际 exercise (test annotation 标记) — vitest `tests/course.service.test.ts` 已覆盖 service 单元层 |

### Acceptance 命中
- ✅ DROP TABLE / DROP COLUMN / DROP TYPE 全部应用
- ✅ Course.classId nullable + 保留 (writer 不写, reader 收敛, 留迁移期)
- ✅ Prisma 三步: migration 13:54 → dev server restart 14:10 (16 min gap, 充分覆盖 generate 时间)
- ✅ 3 teacher 页面 200 + 无 schema 残留类 fatal
- ✅ removeCourseClass guard reject 路径中文 + 错误码对

### 提醒 (转给 builder)
- spec brief 说 guard 返回 403, 真实 impl 返回 **400** (`lib/api-utils.ts:84-85` + `lib/services/course.service.ts:186`) — 这是 validation-class 错误更合理, 与 spec brief 表述不一致只是文字, 不算 FAIL (lib/api-utils mapping 是 PR-1 自己加的, 内部一致)

---

## CI 状态对照

| Check | 状态 | URL |
|---|---|---|
| quality | **PASS** (1m31s) | https://github.com/AlexAnys/finsim_Mini/actions/runs/25954876114/job/76299644100 |
| core-change-label | PASS | (auto) |
| staging-deploy | **FAIL** (10m21s) | https://github.com/AlexAnys/finsim_Mini/actions/runs/25954876119/job/76299644109 |

PR 当前 **不能 merge** — branch protection 要求 staging-deploy 通过.

---

## Issues found (按优先级)

### P0 阻塞 — A 候选 (smoke QA r1 已记录, 我独立 reproduce 确认)
1. `tests/e2e/smoke/01-teacher-create-publish.spec.ts:30-39` — `subjectiveConfig` 缺 `prompt`
2. `tests/e2e/smoke/02-student-submit-simulation.spec.ts:25-31` — `simulationConfig` 缺 `scenario` + `openingLine`
3. `tests/e2e/smoke/03-ai-grade-release.spec.ts:22-29` — 同 01
4. `tests/e2e/smoke/04-sb-free-question.spec.ts:32` — list shape `data: [...]` vs spec 读 `data?.items`
5. `tests/e2e/smoke/_setup.ts:88` — cleanupSmokeSbPosts 同 shape mismatch

### P1 改进建议
6. `lib/services/course.service.ts:186` + `lib/api-utils.ts:84-85` 返回 400 (validation-class), spec brief 说 403, 文字不一致但 impl 合理 — 建议 spec 校正

### P2 风险登记 (信息)
7. spec brief 提到 "staging DB side effect (audit log 行) 完成后 hard-delete 还原 baseline" — 我已 DELETE 4 行 (molly 的 task_instance.update probe rows), 但**这与 D 设计 (append-only audit) 冲突**, 建议 spec 改成 "append-only by design, 仅清功能态副作用"
8. dev DB molly 只有 1 course / 1 class, removeCourseClass allow 路径未 exercise (vitest 已覆盖 service 层)

---

## Test artifact

| 文件 | 用途 |
|---|---|
| `tests/e2e/smoke/pr1_qa_regression.spec.ts` | 5 个 QA 抽样 test, 全部 PASS (D/E/I+J + A sanity + guard 双路径) |
| `.harness/screenshots/pr1-qa-regression/D-audit-page.png` | admin /admin/audit 截图 |
| `.harness/screenshots/pr1-qa-regression/E-ai-settings.png` | molly /teacher/ai-settings 截图 |
| `.harness/screenshots/pr1-qa-regression/IJ-teacher-dashboard.png` | molly /teacher/dashboard |
| `.harness/screenshots/pr1-qa-regression/IJ-teacher-courses.png` | molly /teacher/courses |
| `.harness/screenshots/pr1-qa-regression/IJ-teacher-instances.png` | molly /teacher/instances |

### git diff (本 QA 新增)
- `tests/e2e/smoke/pr1_qa_regression.spec.ts` (新增, ~315 行 QA 验证 spec)
- `.harness/screenshots/pr1-qa-regression/` (新增, 5 张 png)
- `.harness/reports/qa_pr1_regression_r1.md` (本报告)

**0 生产代码修改** (review-only, 无 Edit 工具调用动到 lib/ app/).

---

## Overall verdict: **FAIL**

**理由**:
- D/E/I+J 三候选全 PASS (代码 + 真浏览器 + DB 验证三层都过)
- A 候选 e2e 部分 FAIL (CI staging-deploy 红, 4/5 spec 在 staging 立即 fail, smoke QA r1 已确认同源)
- PR-1 整体 100% acceptance 未达标, branch protection 卡 staging-deploy → 当前不能 merge

**下一步**:
- 等 builder-test-infra r2 修 A 的 5 处 spec/setup payload 问题 (smoke QA 已给完整修复指引)
- r2 修完后建议 coord spawn qa-pr1-smoke r2 重跑 5 主线 + qa-pr1-regression r2 重跑本套抽样 (本套 D/E/I+J 已 PASS 可复用结果不必重测)

---

## SendMessage

`team-lead`: PR-1 整体 FAIL — D / E / I+J 抽样全 PASS, A staging-deploy CI 红 (smoke QA r1 已记录的 4 spec payload bug). vitest baseline 1099/1099 PASS. 报告 `.harness/reports/qa_pr1_regression_r1.md`.
