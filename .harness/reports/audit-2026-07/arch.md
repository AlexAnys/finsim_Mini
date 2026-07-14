# 工程质量审查报告 · audit-arch · 2026-07

> 审查基线：main @ f45b94c（[ahead 9] 均 harness docs）。规模：34 页 / 97 API 端点 / 36 services / 38 模型 / schema 1098 行 / 28 migrations。
> 纪律：只读审查，不改应用代码；共享 dev DB(5432) 仅 SELECT。
> 本报告边审边增量落盘。

---

## 执行摘要

**总体判断**：工程质量**扎实**。资源级授权（IDOR 防护）体系化——`lib/auth/resource-access.ts` + `course-access.ts` 的 assert* 家族 + 服务层 owner/collab 归属判断被一致应用；抽查 60+ 端点仅 3 处真实缺口。型别纪律好（1 个真实 `as any`、0 个 `@ts-ignore`）、TODO 卫生好（4 处规划注释）、错误映射统一、校验覆盖完整。基线全绿（typecheck 0 错 / 1265 tests pass）。主要风险集中在：1 个可规模化的越权读、1 个必崩型别说谎、核心 grading 链路测试深度不足。

**发现计数**：P0 = **0**（但 F-ARCH-01 多校部署实质 P0、F-ARCH-04 为必崩）｜ P1 = **3** ｜ P2 = **5** ｜ 信息性 = 1

**Top 3（一句话）**：
1. **F-ARCH-01（P1，多校→P0）**：`GET /api/submissions?studentId=X` 对 teacher 只传 studentId 时无任何资源校验，任意教师可读任意学生跨所有课程的完整提交（分数/评估/答案/附件）。
2. **F-ARCH-04（P1，必崩）**：`Course.class` 已弃用可空、新建课程恒为 null，但 schedule-grid-tab 三处 `slot.course.class.name` 未守空——任意教师给新课排课后打开课表即 `Cannot read properties of null`（复发 lessons 型别说谎模式）。
3. **F-ARCH-08（P1）**：grading（每份提交必经、被 analytics 全链路当真值消费）仅 2 个窄边界测试，核心 AI 评估→分数解析→rubric 链路零 happy-path 覆盖；另 question-bank/import-job 处理不可信输入却零测试。

### 基线健康（charter #1）

- **finsim-app 容器未运行**：`docker ps` 显示 `:3000` 实际是无关的 `multica-ws0-frontend-1`（另一个项目），**并非 finsim**。finsim 仅 `finsim-postgres`(5432) 在跑，无 `finsim-app` 容器，无 host `node_modules`。→ product/insights 两位 agent 若要真浏览器走查 :3000，需先 `docker compose up app` 起 finsim，否则测的是 multica。**这是本次审查的环境阻断项，已上报。**
- `npx tsc` / `npx vitest` 在 host 直接跑均失败（无本地依赖，npx 抓到缓存里的错误版本）。`npm ci` 装依赖后用本地 binary 重跑：
- **`npm run typecheck`（tsc --noEmit）：PASS（exit 0，无错误）**
- **`vitest run`：PASS — 124 test files / 1265 tests 全绿，2.75s**
- 注意：`package.json` 无 `test` script（只有 dev/build/start/lint/typecheck/db:seed）。CI/AGENTS.md 要求 commit 前跑 `npx vitest run`，但 `npx vitest` 在未装依赖的 host 上会抓错版本报错——CI 环境装了依赖故无碍，但本地新人易踩坑。（F-ARCH 见死代码/工程卫生段）

---

## 端点安全矩阵（97 端点）

**读法**：认证列 = requireAuth/requireRole；资源守卫列 = 是否验证资源归属（IDOR 防护），✅=有 / ⚠️=部分或依赖服务层 / ❌=缺失 / N/A=无资源维度。守卫可能在 route 或 service 层，本表已追进 service 确认。

### 核心链路（auth / submission / grading / task-instance / course / files）

| 端点 | 方法 | 认证 | 资源守卫 | 备注 |
|---|---|---|---|---|
| submissions | POST | student | ✅ | assertTaskInstanceReadable + 服务端派生权威 taskId/taskType（不信客户端），studentId=self |
| submissions | GET | any | ⚠️**见 F-ARCH-01** | student 强制 self；teacher 传 taskInstanceId/taskId 有 assert，**但只传 studentId 时无任何资源校验** |
| submissions/[id] | GET/DELETE | auth / teacher+admin | ✅ | assertSubmissionReadable（student 仅本人；teacher 经 task creator/course） |
| submissions/[id]/grade | POST | teacher+admin | ✅ | assertSubmissionReadable |
| submissions/[id]/retry-grade | POST | teacher+admin | ✅ | assertSubmissionReadable |
| submissions/[id]/ungrade | POST | teacher+admin | ✅ | assertSubmissionReadable（读守卫兜写操作，见 F-ARCH-06） |
| submissions/[id]/release | POST | teacher+admin | ✅ | assertTaskInstanceWritable（release.service） |
| submissions/batch-release | POST | teacher+admin | ✅ | 每个 unique instance 走 assertTaskInstanceWritable |
| submissions/batch | DELETE | teacher+admin | ✅ | 每 id assertSubmissionReadable（读守卫兜删除，见 F-ARCH-06） |
| task-instances | POST/GET | teacher+admin | ✅ | assertCourseAccess+NotArchived+TaskReadable；GET 按 createdBy+course scope 过滤 |
| task-instances/[id] | GET | teacher+admin+student | ✅ | assertTaskInstanceReadable |
| task-instances/[id] | PATCH/DELETE | teacher+admin | ✅ | service isAuthorizedForInstance |
| task-instances/[id]/{close,publish,reopen,snapshot} | POST/PATCH | teacher+admin | ✅ | service isAuthorizedForInstance（createdBy/collab/admin） |
| task-instances/[id]/release-config | PATCH | teacher+admin | ✅ | assertTaskInstanceWritable |
| task-instances/[id]/insights[/aggregate] | GET/POST | teacher+admin | ✅ | assertTaskInstanceReadableTeacherOnly |
| task-instances/[id]/objective-stats | GET | teacher+admin | ✅ | assertTaskInstanceReadableTeacherOnly |
| task-instances/with-task | POST | teacher+admin | ✅ | assertCourseAccess+NotArchived |
| tasks | POST/GET | teacher+admin | ⚠️ | GET 按 creator scope（见服务层）；POST 创建 |
| tasks/[id] | GET/PATCH/DELETE | teacher+admin | ✅ | assertTaskReadable |
| courses | POST/GET | teacher+admin | ✅ | GET 按 teacherCourseFilter scope |
| courses/[id] | GET/PATCH/DELETE | auth / teacher+admin | ✅ | assertCourseReadable / assertCourseAccess；DELETE=归档软删 owner/admin |
| courses/[id]/purge | DELETE | teacher+admin | ✅ | assertCourseOwnerOrAdmin + confirmTitle 强确认 |
| courses/[id]/restore | POST | teacher+admin | ✅ | assertCourseOwnerOrAdmin |
| courses/[id]/{classes,teachers,outline-*} | * | teacher+admin | ✅ | assertCourseAccess（teachers 用 OwnerOrAdmin） |
| courses/batch-semester | PATCH | teacher+admin | ✅ | assertCourseAccessBulk |
| courses/archived | GET | teacher+admin | ✅ | teacherCourseScope 过滤 |
| files/[...path] | GET | auth | ✅ | assertFileReadable（经 attachment→submission 或 importJob.teacherId） |
| files/upload | POST | auth | ⚠️ | 见 F-ARCH-07（任意登录用户可上传，无类型/配额随存储服务） |
| auth/[...nextauth] | — | — | N/A | NextAuth |
| auth/register | POST | 公开 | ⚠️ | 见 F-ARCH-08（角色分配 + 自助注册开关） |
| users/me | GET/PATCH | auth | ✅ | 仅本人 name/avatarUrl，**不能改 role/classId/email** — 无提权 |
| users/me/password | PATCH | auth | ✅ | 仅本人（见服务层校验旧密码） |

### 教师管理 / LMS / AI / 分析 / 其他（详见下方矩阵续表，随审进补）

| 端点 | 方法 | 认证 | 资源守卫 | 备注 |
|---|---|---|---|---|
| admin/audit | GET | admin | N/A | admin only |
| classes | GET | 公开(flag) | N/A | 仅注册开关开时返回班级列表(id/name/code) — 设计如此 |
| lms/classes | GET/POST | teacher+admin | ❌**F-ARCH-02** | listClassesForStaff 返回**全校所有班级**给任意教师，无 per-teacher scope |
| lms/classes/[id]/members | GET | teacher+admin | ✅ | assertClassAccessForTeacher |
| groups, groups/[id] | *  | teacher+admin | ✅ | service: teacherId + assertClassAccessForTeacher |
| async-jobs/[id][/retry] | GET/POST | auth | ✅ | service: createdBy!==user → FORBIDDEN |
| feedback | POST/GET | auth / admin | ✅ | POST 任意登录；GET admin only；有 rate-limit |
| feedback/[id] | PATCH | admin | N/A | admin only |
| cron/* (4) | GET/POST | CRON_TOKEN or admin | N/A | token 或 admin fallback；见 F-ARCH-09 |
| lms/tasks/[id]/tag-questions | POST/GET | teacher+admin / +student | ⚠️ | POST 查 creator/admin；**GET 无资源校验**（泄露任意 task 的 untagged 计数+job错误，F-ARCH-03） |
| study-buddy/posts/[id] | DELETE | auth | ✅ | service: student 本人 / teacher task.creatorId / admin |
| teacher/study-buddy/posts | GET | teacher+admin | ✅ | owner+collab courseIds 交集；外部 courseId/instanceId 静默返空 |
| ai/study-buddy/summary | POST | teacher+admin | ✅ | service generateSummary → assertTaskReadable |
| ai/study-buddy/reply | POST | auth | ✅ | service 校验 post.studentId===self |
| lms/weekly-insight | GET | teacher+admin | ✅ | generateWeeklyInsight(user.id) 自 scope |
| lms/study-buddy/analytics | GET | teacher+admin | ✅ | assertCourseAccess |
| lms/ai-usage | GET | teacher+admin | ✅ | scope userId=self（admin ?scope=all 全局） |
| ai/tool-settings | GET/PATCH | teacher+admin | ✅ | per-user（listAiToolSettings(userId)），非全局；无 API key 存储 |
| lms/analytics-v2/{diagnosis,drilldown,recompute,scope-insights} | GET/POST | teacher+admin | ✅ | assertCourseAccess；courseId 为安全锚，所有子过滤 AND 在其内 |
| lms/announcements | POST/GET | teacher+admin / auth | ✅ | assertCourseAccess / assertCourseAccessForStudent |
| lms/schedule-slots[/[id]] | * | teacher+admin / auth | ✅ | assertCourseAccess / ForStudent |
| lms/chapters,sections,content-blocks[/[id]] | * | teacher+admin | ✅ | assertCourseAccess / assert{Chapter,Section,ContentBlock}Writable |
| lms/course-knowledge-sources[/*] | * | teacher+admin | ✅ | assertCourseAccess + assertKnowledgeSourceScope |
| lms/courses/[id]/{outline-import,outline-apply} | POST | teacher+admin | ✅ | assertCourseAccess |
| lms/task-build-drafts[/*] | * | teacher+admin | ✅ | assertCourseAccess (+NotArchived) |
| task-posts | POST/GET | auth | ✅ | service assertTaskInstanceReadable |
| study-buddy/posts | POST/GET | auth | ✅ | service：student 本班 assert + self scope |
| ai/chat | POST | auth | ✅ | assertTaskInstanceReadable/assertTaskReadable |
| ai/evaluate | POST | teacher+admin | ✅ | assertTaskInstanceReadable/assertTaskReadable |
| ai/question-bank, ai/task-draft/from-context | POST | teacher+admin | ✅ | assertCourseAccess + assertKnowledgeSourceScope |
| ai/task-draft/{quiz,subjective}, ai/work-assistant, ai/speech-to-text | POST | teacher+admin / auth | N/A | 无状态生成，无资源维度 |
| import-jobs[/[id]] | POST/GET | teacher+admin | ✅ | assertImportJobReadable（[id]）；POST 自 teacherId |
| lms/dashboard/summary | GET | auth | ✅ | 自 scope（user.id/classId） |
| lms/quiz-questions/[id]/check | POST | auth | ✅ | assertTaskInstanceReadable |
| lms/tasks/[id]/adaptive-quiz/next | POST | auth | ✅ | assertTaskInstanceReadable |

> 结论：**资源级授权整体扎实** — `lib/auth/resource-access.ts` + `course-access.ts` 的 assert* 家族 + 服务层 owner/collab 归属判断被一致应用；抽查的 60+ 端点里仅下列少数有真实缺口。admin 一律短路直通（符合设计）。

---

## 发现清单

## F-ARCH-01 · teacher 传 `?studentId=` 越权读取任意学生全部提交
- 严重级: **P1**（多校部署下实质 P0：跨校教师可读他校学生作答）
- 证据: `app/api/submissions/route.ts:84-108` + `lib/services/submission.service.ts:175-201`（getSubmissions 纯过滤，无归属）
- 影响: GET `/api/submissions` 里，teacher/admin 传 `studentId` 单独一项时，代码只对 `taskInstanceId`/`taskId` 跑 assert（第 94、102 行），**对 `studentId` 无任何资源校验**。任意教师可 `?studentId=<任意学生UUID>` 拉取该生跨所有课程/所有其他教师任务的**完整提交**（分数、AI 评估、transcript、答案、附件）。学生自己的 UUID 在教师本班名册里唾手可得；用它可读到该生在**别的教师**课程里的作业。绕过了 assertSubmissionReadable 的 teacher 归属边界。
- 修复方向: studentId-only 分支必须加范围约束——要么强制同时带一个已 assert 的 taskInstanceId/taskId/courseId，要么在 service 层用"教师可见学生集"（本人任务/课程覆盖的学生）过滤 studentId。

## F-ARCH-02 · 任意教师可见全校所有班级（无 per-teacher scope）
- 严重级: P2（多校部署下升 P1：跨校班级名单/学生数泄露 + 可给自己课程挂他校班级）
- 证据: `lib/services/class.service.ts:44-52` `listClassesForStaff` 无 where 过滤；`app/api/lms/classes/route.ts:8-21`
- 影响: `GET /api/lms/classes` 对任意 teacher 返回**全库所有班级** + 学生数。当前单校尚可接受，但模型无 school/tenant 边界，多校即跨租户泄露。且 `POST /api/lms/courses/[id]/classes` 可把任意 classId 挂到自己课程（assertCourseAccess 只校验课程侧），从而经 analytics 侧读到该班聚合数据。
- 修复方向: 班级引入 owner/tenant 归属；listClassesForStaff 按教师可达班级（本人建的 + 本人课程关联的）过滤；关联班级时校验班级归属。

## F-ARCH-03 · tag-questions GET 无资源校验，泄露任意 task 元数据
- 严重级: P2
- 证据: `app/api/lms/tasks/[id]/tag-questions/route.ts:58-81`（GET 分支仅 requireRole，无 creator/course 校验）
- 影响: 任意 teacher/admin/student 可对任意 taskId 查 `untaggedCount` + 最近 tag job 的 status/**error 字符串**。信息泄露有限（计数 + 错误串），但 POST 分支有 creator 校验、GET 分支却没有，属遗漏。
- 修复方向: GET 也做 assertTaskReadable（或至少 creator/course 校验）。

## F-ARCH-04 · Course.class 可空但前端多处按非空访问 → schedule 面必崩（型别说谎）
- 严重级: **P1**（命中 lessons L 型别说谎模式；新建课程 100% 触发）
- 证据: schema `prisma/schema.prisma:253` `classId String?` → `:262 class Class?`（可空，已弃用）；`lib/services/course.service.ts:76-89` createCourse **从不写 classId**（只建 CourseClass）；消费端未 `?.` 守空：
  - `components/schedule/schedule-grid-tab.tsx:343` `slot.course.class.name`
  - `components/schedule/schedule-grid-tab.tsx:472` `c.class.name`
  - `components/schedule/schedule-grid-tab.tsx:558` `deleteSlot.course.class.name`
  - 次要：`app/teacher/courses/[id]/page.tsx`、`insights-filter-bar.tsx` 已用 `?.` 属安全
- 影响: `Course.classId` 弃用后**所有新建课程 class=null**。schedule.service 查询 include 了 `course.class`（返回 null），schedule-grid-tab 三处直接 `.class.name` → 运行时 `Cannot read properties of null`。任意教师给新课排课后打开课表/删除排课/打开课程下拉即崩。`tsc` 不报（Prisma 关系型别本就 `Class | null`，但访问处未收窄）。与 L-lessons「Course.class 标非空实为 nullable 导致页面必崩」同型复发。
- 修复方向: schedule 相关 `.class` 访问全部改 `?.` + 空态文案；或从 CourseClass（M:N，非空）取班级名而非弃用的 Course.class。根因层面应彻底移除 Course.classId 读路径。

## F-ARCH-05 · analytics 无死代码（澄清）+ TODO 卫生良好
- 严重级: P2（信息性，非缺陷）
- 证据: `app/teacher/analytics/page.tsx` 仅 5 行 `redirect("/teacher/analytics-v2")`（legacy 重定向壳，非死代码）；sidebar 只链 v2；全仓 TODO/FIXME 仅 4 处且均为规划注释（`grades-transforms.ts:42`、`ai.service.ts:538` 等）；`as any` 仅 1 处真实（`app/(simulation)/sim/[id]/page.tsx:150` `(task as any).simulationConfig`）；0 处 `@ts-ignore`。
- 影响: 工程卫生整体优良。analytics v1/v2 非冗余（v1=重定向壳；instance-detail 的 insights/analytics 两 tab 是 instance vs course 不同 scope，非重复）。
- 修复方向: v1 重定向壳可留可删（cosmetic）；`sim/[id]/page.tsx:150` 的 `as any` 建议补 SimulationConfig 型别收窄。

## F-ARCH-06 · 读守卫（assertSubmissionReadable）兜写/删操作，边界偏松
- 严重级: P2
- 证据: `app/api/submissions/[id]/ungrade/route.ts:21`、`app/api/submissions/[id]/route.ts:50`(DELETE)、`lib/services/submission.service.ts:421-425`(batchDelete)
- 影响: ungrade / delete / batchDelete 用 `assertSubmissionReadable`（读守卫）而非写守卫。教师侧 readable≈writable（都经 task creator/course），实际风险低；但语义上用读权限门禁破坏性操作，若日后 readable 放宽（如共享阅卷）会连带放宽删除权。
- 修复方向: 破坏性操作统一走 assertTaskInstanceWritable 类写守卫。

## F-ARCH-07 · 三层架构违例：业务逻辑下沉进 Route Handler
- 严重级: P2（可维护性/回归风险；CLAUDE.md 明令 Route Handler 不含业务逻辑）
- 证据: 97 端点中 28 个 route.ts 直接 import prisma。重灾区（>60 行且含 prisma 直查）：
  - **`app/api/lms/courses/[id]/outline-apply/route.ts` = 502 行**（在 route 里做整份大纲落库的多步事务/业务逻辑，最严重）
  - `app/api/ai/chat/route.ts` = 295 行
  - `app/api/ai/task-draft/from-context/route.ts` = 219 行
  - `app/api/lms/task-instances/[id]/insights/route.ts` = 163 行
  - `app/api/lms/study-buddy/analytics/route.ts` = 141 行
  - `app/api/teacher/study-buddy/posts/route.ts` = 133 行（整块跨课聚合查询在 route）
- 影响: 逻辑散落 route 层 → 难以单测（service 有测试基座，route 无）、复用困难、易在多入口漂移。功能正确但违背既定分层，规模化后维护成本高。部分 route 的 prisma 只是取 audit 上下文的轻查询（如 publish/route.ts），可接受；上列大文件是真违例。
- 修复方向: 把 outline-apply / chat / from-context / insights / SB analytics 的业务逻辑抽进对应 service，route 回归"解析→调 service→返回"薄壳。

## F-ARCH-08 · 核心链路测试深度不足（grading 尤甚）
- 严重级: **P1**（grading 是每份提交的必经服务，核心路径零 happy-path 单测）
- 证据: 全仓 124 test files / 1265 tests（基线全绿）。逐 service 覆盖：
  - **零直接覆盖 4/36**：`question-bank.service`（AI 题库解析，处理不可信文件/AI 输出，复杂）、`import-job.service`（批量导入）、`ai-usage.service`、`ai-work-assistant.service`
  - **grading.service 仅 2 个测试**：`grading-late-penalty` + `fix-6-grading-fail-feedback` —— 都是窄边界；**AI 评估→分数解析→rubric 拆分→conceptTags 生成的核心链路无直接 happy-path 单测**
  - 覆盖较好：ai=16、audit=12、course=9、submission=6、task-instance=6、async-job=4、task-build-draft=4
  - 偏薄（=1）：release、weekly-insight、insights、schedule、class、group、task、task-post、quiz-question-tagger、instance-objective-stats
- 影响: grading 输出被 analytics/insights 全链路当真值消费；其解析逻辑一旦回归（AI 返回格式漂移、rubric 映射错位）无测试网兜底。question-bank/import-job 零覆盖 + 处理不可信输入，规模化导入易出静默错误。
- 修复方向: 补 grading 核心 happy-path（三类型各一：simulation/quiz/subjective 的正常评分→字段落库）；question-bank/import-job 至少各补 happy + 一个畸形输入用例。

## F-ARCH-09 · 基线环境/工程卫生（运维）
- 严重级: P2
- 证据: 见「基线健康」段。`docker ps` 无 `finsim-app` 容器（:3000 是无关的 multica）；host 无 node_modules；`package.json` 无 `test` script。
- 影响:（1）product/insights 两审需先起 finsim 才能真浏览器走查，否则测错项目；（2）AGENTS.md 要求 commit 前 `npx vitest run`，但未装依赖的 host 上 `npx vitest` 抓错版本报错，本地新人/agent 易误判"测试挂了"。
- 修复方向:（审查外）product/insights 前置 `docker compose up app`；`package.json` 加 `"test": "vitest run"`；文档提示先 `npm ci`。

---

## 补充：校验覆盖（charter #3）

整体**良好**。抽查显示先前 grep 的"无 safeParse"多为误报：
- 无 body 的参数化 POST（close/publish/reopen/restore/ungrade/retry-grade/tag-questions/approve 等）无需校验 —— 合理。
- `ai/question-bank` 用自定义 `parseQuestionBankRequest`（返回 `{success}`，等价 Zod）；`files/upload`、`import-jobs`、`course-knowledge-sources` 走 `validateFile`（formData 类型+大小）；`insights/aggregate` 仅可选 force flag。均有校验。
- 错误统一经 `handleServiceError`（`lib/api-utils.ts`）映射为 `{success,error:{code,message}}`，中文文案齐全（~90 个 case）。响应格式统一。
- **小瑕疵**：`tag-questions` route 抛 `TASK_NOT_QUIZ`，但该 code 不在 `handleServiceError` switch → 落 default 返 500（应为 400）。`app/api/lms/tasks/[id]/tag-questions/route.ts:31`。P2。

## 补充：三层/型别/死代码/AI-provider 一致性

- **Service 接口一致性**：抽查多处 service 签名（userId+role 透传、UserLike）在 route 调用侧一致，未见调用错位。`isAuthorizedForInstance`/`assertCourseAccess` 家族复用良好。
- **型别说谎**：除 F-ARCH-04（Course.class）外，`as any` 仅 1 处真实（sim 页 simulationConfig），无 `@ts-ignore`/`@ts-nocheck`。TaskInstance.classId 为非空（`schema:517`），故 `ti.class.name`/`inst.class.name` 安全。整体型别纪律良好。
- **死代码**：analytics v1 = 5 行重定向壳（非死代码）；TODO/FIXME 仅 4 处规划注释。未发现明显未调用端点（97 端点均有前端/cron/job 触发路径）。

---
