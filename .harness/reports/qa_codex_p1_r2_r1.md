# QA Report — Codex-P1-r2 Round 1

> QA: qa · 2026-05-15 · Branch `claude-demo-fixes` @ 36aca56
> Build report: `.harness/reports/build_codex_p1_r2_r1.md`
> Plan: `.harness/plans/codex_p1_r2_plan_r1.md`
> Bug: Codex r2 review — P1-2/P1-3 real fixes + P1-1 false-positive comment

## Spec: 修 3 P1（P1-1 false positive 注释 + P1-2 createPost 强制 server 权威 courseId + P1-3 quiz check endpoint access）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 9 acceptance items 全实现（P1-2 taskId 分支 + taskInstanceId 对称 + P1-3 schema/access/forgery 三层 + P1-1 注释 + client wire 配套 + tsc/vitest/lint 全过） |
| 2. tsc --noEmit | PASS | clean output |
| 3. vitest run | PASS | 96 files / 1094 tests passed (baseline 不变) |
| 4. Browser (independent QA Playwright) | PASS | 13/13 QA case + 6/6 builder case = 19/19 PASS |
| 5. Cross-module regression | PASS | quiz-adaptive-runner client wire `taskInstanceId` 到 check fetch body (line 180-185)；P1-1 r1 修复未被 r2 改动破坏（regression QA-P1-1-A/B 实测）；schema 0 改动 |
| 6. Security (vertical access control) | PASS | (a) P1-3 双校验链 — assertTaskInstanceReadable 班级隔离 + instance.taskId === question.taskId 防伪造；(b) P1-2 server-side authoritative courseId — 无论 client supplies bogus 还是 legitimate value，都被 instance.courseId 覆盖；(c) 403/404 response **不暴露** correctOptionIds/correctAnswer/题目内容（实测 JSON.stringify 不含 leak） |
| 7. Finsim-specific | PASS | 中文 error messages（"题目与任务实例不匹配"、"任务实例不存在"、"题目不存在"、"权限不足"）；统一 {success,error.code,message} 响应；Service throw Error("CODE") + Route handleServiceError 映射；UI/API 中文 |
| 8. Code patterns | PASS | 无 drive-by refactor；P1-2 在 taskId + taskInstanceId 两分支统一 server-authoritative；P1-3 schema 加 required uuid 配 client wire 同 commit；P1-1 JSDoc 引用 r1 commit 489aa8e anchor codex r3 LLM understanding |

## 独立证据链（QA 自建 13 case spec，非 builder 自测复用）

### P1-3 quiz-questions/[id]/check 路径

**正向**
- QA-P1-3-A: alex (A班) POST `/api/lms/quiz-questions/${QUESTION_FROM_A}/check` w/ A 班 instance → **200**, `{"correct":false,"correctOptionIds":["C"]}`（alex 选 A，正确是 C，引擎正常判定）

**Access (核心修复)**
- QA-P1-3-B: student5 (B班) → **403 FORBIDDEN**, `{"success":false,"error":{"code":"FORBIDDEN","message":"权限不足"}}` — **无 leak**（response 不含 correctOptionIds / correctAnswer / 题目内容）
- QA-P1-3-D: 别 task question + A 班 instance（伪造） → **403** "题目与任务实例不匹配"，response 无 correctOptionIds leak
- QA-P1-3-E: fake instance UUID → **404** "任务实例不存在"（不暴露 500 / 答案）
- QA-P1-3-F: fake question UUID → **404** "题目不存在"

**Validation (defense-in-depth)**
- QA-P1-3-C-missing: 不带 taskInstanceId → **400 VALIDATION_ERROR**
- QA-P1-3-C-blank: taskInstanceId = "" → **400 VALIDATION_ERROR** (uuid 校验)
- QA-P1-3-C-notuuid: taskInstanceId = "not-a-uuid" → **400 VALIDATION_ERROR**

### P1-2 SB createPost 服务端权威 courseId

- QA-P1-2-A: alex taskId + bogus B班 courseId → **201**, `post.courseId=e6fc049c-...` (instance.courseId in A 班 deedd844) **≠** client `COURSE_B_BOGUS` — **服务端强制覆盖**
- QA-P1-2-B: alex taskId + 合法 A班 COURSE_A_CLASS (940bbe23) → **201**, server stored `e6fc049c-...` 仍由 instance.courseId 反推；与 client value (940bbe23) 不同 — **server is authoritative regardless**
- QA-P1-2-C: 重复测试 bogus 路径，post.courseId ≠ COURSE_B_BOGUS

> 关键发现：service `findFirst` 返回 task 第一个 instance (`a7d9b380` in A 班) 的 courseId (`e6fc049c-...`)。即使 client supplied A 班的 `COURSE_A_CLASS` (`940bbe23-...`)，也被覆盖为 `e6fc049c-...` — **设计完全 server-authoritative**。DB 双校验：course `e6fc049c` 是合法 A 班课 (classId=deedd844, courseTitle="个人理财规划")。

### P1-1 r1 regression（防 r2 误改）

- QA-P1-1-A: adaptive-quiz/next 正向 200 OK
- QA-P1-1-B: 缺 taskInstanceId → 400 VALIDATION_ERROR（r1 fix 仍生效）

### Cross-module wire 验证

```
components/quiz/quiz-adaptive-runner.tsx:
  L110-111  next fetch body: {history, taskInstanceId}        (P1-1 r1 wire)
  L180-185  check fetch body: {taskInstanceId, ...answer}      (P1-3 r2 wire)
  L78       prop taskInstanceId 从 props 来                    (已有)
  L242      submit body 含 taskInstanceId                       (已有)
```

服务端 + 客户端配套修复完整，prod 学生答题不会 break。

### DB fixture 双校验

```
Task e54e1cb9 (深度测试)     creatorId=148ad66f
  └─ instance a7d9b380       courseId=e6fc049c  classId=deedd844 (A班)  status=published
QuizQuestion 4fc6dedc        type=single_choice  taskId=e54e1cb9 (匹配 task A)
QuizQuestion b8047af8        type=single_choice  taskId=9cd29095 (别 task — 伪造路径用)
Course e6fc049c              classId=deedd844 (A班)  courseTitle=个人理财规划
Course 940bbe23 (COURSE_A_CLASS) classId=deedd844  courseTitle=个人理财规划 (同名不同 row)
Course 00000000-...a202 (COURSE_B_BOGUS)  classId=1dbdc794 (B班)  courseTitle=个人理财规划
alex      (A班 deedd844)
student5  (B班 1dbdc794)
```

### 测试套件 numerical evidence

```
tsc --noEmit: clean
vitest: 96 files / 1094 tests passed (baseline)
lint: 0 errors / 29 warnings (1 unused-var in QA temp spec, spec 已删)
e2e (builder spec): 6/6 PASS serial (~30s)
e2e (QA independent spec): 13/13 PASS (~56s, real browser, real auth)
```

## Issues found

无 blocking issue。一些值得记录的设计观察：

### Note 1 — P1-2 server-authoritative 强度
即使 client 传**合法** A 班 courseId (`COURSE_A_CLASS=940bbe23`)，server 也覆盖为 instance.courseId (`e6fc049c`)。这是更强的安全保证（client 完全不被信任）。Trade-off: 学生界面可能 prefer 显示自己选的 course；但当前实现服务端唯一权威是更安全的选择。**符合 P1-2 spec 意图**。

### Note 2 — assertTaskInstanceReadable 二次 findUnique
Route `app/api/lms/quiz-questions/[id]/check/route.ts:66-70` 在 access guard PASS 后又 `findUnique` instance for forgery check。assertTaskInstanceReadable 内部已对 null throw INSTANCE_NOT_FOUND，理论上二次查询 null 路径是 dead code。**保留 defense-in-depth 不算 bug**（与 P1-1 adaptive-quiz/next 同款）。

### Note 3 — DB cleanup
QA spec 留下 5 个 soft-hidden SB posts（builder 2 + QA 3，DELETE → hideStudyBuddyPost 软删）。已 hard-delete (`StudyBuddyPost` + `AuditLog`) 还原 baseline。

## Overall: PASS

3 P1 (P1-1 false positive comment + P1-2 + P1-3 real fixes) 完整修复，跨班/伪造/缺参/不存在四维 19 case 真浏览器 PASS，无 leak，DB cleanup 完整。
