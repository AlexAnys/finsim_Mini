# QA Report — Codex-P1-r3 Round 1

> QA: qa · 2026-05-15 · Branch `claude-demo-fixes` @ c8b3137
> Build commit: c8b3137 (build report 未写独立文件，引用 git commit message)
> Bug: Codex r3 review — taskId 分支 findFirst 未 class-scope，task 多班复用时可能返回别班 instance.courseId

## Spec: createPost taskId 分支加 classId scope 防多班复用泄漏

`r2 fix` 删除了 client courseId fallback，强制使用 instance 反推。但 `findFirst({where:{taskId}})` 没限制 class，**task 复用 A+B 班场景**下，`findFirst` 可能返回 B 班 instance 的 courseId（即使学生在 A 班）→ AI generateReply load B 班 KS 泄漏。**r3 修法**：`findFirst({where:{taskId, classId: user.classId}})` + 找不到 throw FORBIDDEN。

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 修法精确匹配 codex r3 ask；line 66-72 加 `userClassId` + scope where + 找不到 throw FORBIDDEN |
| 2. tsc --noEmit | PASS | clean output |
| 3. vitest run | PASS | 96 files / 1094 tests passed (baseline 不变) |
| 4. Browser (independent QA Playwright) | PASS | 7/7 QA case (经 1 次 baseline fixture 修正后) + 3/3 builder case = 10/10 PASS |
| 5. Cross-module regression | PASS | adaptive-quiz/next 仍正常（QA-R3-F）；自由问 + courseId path 仍正常（QA-R3-G）；其他 taskInstanceId 分支未受影响 |
| 6. Security (vertical access control) | PASS | r3 把 server-authoritative 推进一层 — 不仅 client courseId 被覆盖，连 server 反推 instance.courseId 也限定在学生班级；多班复用攻击场景被 R3-B/R3-E 实测堵住 |
| 7. Finsim-specific | PASS | 错误码 FORBIDDEN → 中文 "权限不足"；响应统一 {success,error.code,message}；Service throw Error("CODE") + handleServiceError 映射 |
| 8. Code patterns | PASS | 单点修改，3 行业务逻辑（userClassId 校验 + where classId scope + throw FORBIDDEN）；不引入新 abstraction；注释明确引用 r2 + r3 锚点 |

## 独立证据链（QA 自建 7 case spec）

### 正向 + 核心 acceptance

- **QA-R3-A**: alex (A班) 用 A 班 task → 201, `post.courseId=940bbe23` 经 SQL 校验关联 A 班 (classId=deedd844 / CourseClass.classId=deedd844)
- **QA-R3-B (核心)**: 注入 B 班 instance 复用 A_CLASS_TASK，B 班 instance.courseId=`00000000...a202` → alex POST taskId=A_CLASS_TASK → server stored `post.courseId=940bbe23` (A 班 instance.courseId) ≠ `00000000...a202` (B 班 注入的)。**class scope 生效，B 班数据不污染**。
- **QA-R3-E (二次防御)**: 同上 inject B 班 instance + alex **同时** 在 client supplies `courseId=B_COURSE` 试图双重污染 → server 仍 `post.courseId=940bbe23` (A 班)。**任何 client 输入都被服务端 overlay 掉**。

### 拦截路径

- **QA-R3-C**: alex 用 B_ONLY_TASK → **403 FORBIDDEN** (assertTaskReadable 先拦，不到达 r3 路径)
- **QA-R3-D**: 对称 — alex 用 B_ONLY_TASK 重复验证 → **403 FORBIDDEN** (assertTaskReadable defense layer)

### Regression

- **QA-R3-F**: adaptive-quiz/next w/ alex+A班 instance → **200 OK** (P1-1 r1 修不被 r3 破坏)
- **QA-R3-G**: alex 自由问 + A 班 courseId → **201 OK** (P1-2 r1 修不被 r3 破坏)

### 关键 console 日志

```
R3-A: A 班 instance.courseId = 940bbe23-6172-40bf-bc7f-b22a1840a1de, classId 关联 = deedd844-e302-4b20-903d-d9b1d0e12439
R3-B: client taskId=6018c58c..., 注入 B 班 instance courseId=00000000...a202, 服务端 post.courseId=940bbe23 (== A 班 940bbe23 ✓)
R3-E: client bogus courseId=00000000...a202, server stored=940bbe23 (= A 班 instance.courseId)
```

### DB fixture 状态（baseline）

```
A_CLASS_TASK (6018c58c) 理财基础知识测验
  └─ 1 published instance @ A 班 deedd844, courseId=940bbe23 (个人理财规划 A 班)
B_ONLY_TASK (00000000...b501) ANL-2 B 班独立测验
  └─ 1 published instance @ B 班 1dbdc794
alex (A班 deedd844) / student5 (B班 1dbdc794)
B_COURSE (00000000...a202) 个人理财规划 B 班 classId=1dbdc794
```

### 测试套件 numerical evidence

```
tsc --noEmit: clean
vitest: 96 files / 1094 tests passed (baseline)
lint: 0 errors / 29 warnings (1 unused-var in QA temp spec, spec 已删)
e2e (builder spec): 3/3 PASS (~22s)
e2e (QA independent spec): 7/7 PASS (~45s, real browser, real auth, DB inject + cleanup)
```

## Issues found

### Finding 1 (minor, builder e2e robustness) — `runSql RETURNING id` 在 e2e 失败时 finally 块的清理脆弱性

builder spec line 103-105 `injectedInstanceId = runSql("INSERT ... RETURNING id")` 在 try 块**外**执行。若 INSERT 后但 `try` 内 makeAuthedContext throw（NextAuth race），`finally` 块按 id 删除是 OK 的。但若 INSERT 自身 throw、或 RETURNING id 输出格式异常（多行/空格），`injectedInstanceId` 可能为空字符串，DELETE WHERE id='' 命中 0 行 — **orphan 残留**。

**实测**：我清理前 DB 有 3 个 B 班 instance 复用 A_CLASS_TASK 留下来（titles: `CODEX-P1-r3-test-B-class-instance` 与 builder spec 同款）。这是历史失败 runs 留下的 orphan，不是本次提交 commit c8b3137 的问题。

**建议（不阻塞 PASS）**：builder e2e 可以加 `beforeAll`/`beforeEach` 清理 `WHERE title LIKE 'CODEX-%-class-instance'` 防御性 sweep；或把 INSERT 也搬进 try 块；或在 finally 用 title-based 删除 (`DELETE FROM TaskInstance WHERE title='CODEX-P1-r3-test-B-class-instance'`) 不依赖 returned id。

### Finding 2 (QA spec issue, self-corrected) — A_CLASS_TASK 不能用作 "A 班 only" 资源判断

我初版 QA-R3-D-symmetric 错把 A_CLASS_TASK 当作 A 班专属，期望 student5 (B班) 拒访。但 builder e2e 与项目设计是 **task 可被多班复用**（这正是 r3 修补的场景）。已修正测试为 alex 用 B_ONLY_TASK → 403。

### DB cleanup

测后清理：8 SB QA posts + 2 注入 instance + 8 audit log entries 已 hard-delete。A_CLASS_TASK instances count 恢复为 1（仅 A 班 published instance）。

## Overall: PASS

r3 修补完整堵住 r2 留下的多班复用攻击面：class scope where + 找不到 throw FORBIDDEN + server-authoritative courseId 一致。10/10 真浏览器 case 全过含 inject DB 真实多班复用场景。
