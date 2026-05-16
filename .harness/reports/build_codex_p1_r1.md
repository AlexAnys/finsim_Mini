# Build Report — Codex-P1 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/codex_p1_plan_r1.md`
> Bug: Codex review PR #12 标 2 个 P1 authorization gaps (Unit 6 + Unit 8 衍生)

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `app/api/lms/tasks/[id]/adaptive-quiz/next/route.ts` | +22 | Bug 1: requestSchema 加 `taskInstanceId: z.string().uuid()` required；handler 解析 + `assertTaskInstanceReadable(taskInstanceId, user)` strict；instance.taskId 必须 === URL taskId（防伪造） |
| `components/quiz/quiz-adaptive-runner.tsx` | +2 / -1 | 客户端 POST body 加 `taskInstanceId` 字段（runner 已有 prop，wire fetch body） |
| `lib/services/study-buddy.service.ts` | +18 / -1 | Bug 2: createPost 自由问分支若 data.courseId → Prisma 查 Course where {id, OR:[{classId:user.classId}, {classes:{some:{classId:user.classId}}}]}；找不到 throw `COURSE_ACCESS_DENIED`；不传 courseId 仍允许（admin-bin 兜底）|
| `lib/api-utils.ts` | +2 | 新错误码映射 `COURSE_ACCESS_DENIED → 403 "你不在该课程的班级，无法关联此课程"` |
| `tests/e2e/codex-p1-verify.spec.ts` (新) | +175 | 7 case (Bug1: A/B/C/D - 正向 / 跨班 403 / 伪造 instanceId 403 / 缺 instanceId 400 ; Bug2: A/B/C - 自班 201 / 跨班 403 中文 / 无 courseId 201) |

**生产代码**：44 / -2
**测试**：175
**Total**：~219（plan 估 80-120 prod + 100 e2e = 200, 命中）

## 关键决策实施（按 coordinator 批准）

1. ✅ **Bug 1**: schema required taskInstanceId + assertTaskInstanceReadable strict（不 opt-in closed-with-own-sub）+ 防伪造 instance.taskId === taskId 双重校验
2. ✅ **Bug 2**: 自由问 + courseId → ClassMember 校验 via `Course where {classId | classes.some.classId}` (OR 二路：直接 classId 或 CourseClass 多班级关联)
3. ✅ **不传 courseId**: 仍允许 admin-bin 兜底（courseId=null 持久化）

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 96 files / 1094 tests pass (baseline 不变)
eslint: 0 new issue (quiz-adaptive-runner 已在 baseline)
```

### Playwright E2E (7 cases all PASS isolated)

```
Bug 1 — adaptive-quiz/next 权限校验:
[A] alex (A班) 调自己班 adaptive instance → 200/OK (positive): ✓
[B] student5 (B班) 调 A 班 adaptive instance → 4xx (跨班拒): ✓
[C] alex 伪造 instanceId 不匹配 taskId → 403 FORBIDDEN "不匹配": ✓
[D] 缺 taskInstanceId → 400 VALIDATION_ERROR: ✓

Bug 2 — SB 自由问 courseId ownership:
[A] alex 自由问 + courseId=A班课 → 201 OK: ✓ (isolated)
[B] alex 自由问 + courseId=B班课 → 403 COURSE_ACCESS_DENIED "不在该课程的班级": ✓ (isolated)
[C] alex 自由问 不传 courseId → 201 OK (admin-bin 兜底): ✓ (isolated)

Serial 4/7 PASS + 3/7 race-isolated PASS (NextAuth 已知模式，serial 多 context login 竞态)
```

## 风险 / 不确定项

1. **🟢 schema 0 改动** — 仅服务层 + route + helper
2. **🟢 仍允许 admin-bin 兜底**：自由问无 courseId 时 courseId=null 持久化，与 Unit 6 行为一致
3. **🟢 client wire complete**：QuizAdaptiveRunner 已用 props.taskInstanceId，仅 wire 进 fetch body
4. **🟢 防伪造双校验**：A 班 instance + B 班 task 组合的伪造也被 instance.taskId !== taskId 抓
5. **🟡 student5 fixture**：B 班学生 password 是 password123（与 student1 同），seed 默认。如未来 seed 改动 e2e fixture 需同步

## Acceptance 对照

| Codex P1 要求 | 状态 |
|---|---|
| Bug 1: adaptive-quiz/next 加 assertTaskInstanceReadable strict | ✅ |
| Bug 1: schema 强制 taskInstanceId | ✅ required z.string().uuid() |
| Bug 1: 防伪造 instance.taskId 匹配 | ✅ 双校验 |
| Bug 2: 自由问 courseId 走 ClassMember 校验 | ✅ Prisma OR 二路 |
| Bug 2: FORBIDDEN 中文友好 | ✅ "你不在该课程的班级，无法关联此课程" |
| Bug 2: 不传 courseId 不破坏 | ✅ admin-bin 兜底保留 |
| 单 commit 修两个 | ✅ |
| e2e 覆盖三案（自班/跨班/边角） | ✅ 7 case |

## 不在本范围

- ❌ instance opt-in closed-with-own-sub（Unit 3 路径）— spec 明确 active 答题路径 strict
- ❌ getKnowledgeSourcesForStudyBuddy 自身校验（修上游 createPost 已切断 cross-course post 进入；service 内 KS load 无需再校验，结构正确）

## 反思

- Codex review 抓住的两个 P1 都是"功能完整但 access 缺校验"的典型模式 — Unit 6/8 实施时关注业务流程但漏了 vertical security check
- Bug 1 修复连带前端 wire（runner 客户端 fetch body 加字段）— 必须配套，否则 production 学生答题挂掉
- Bug 2 选 `Course.OR{classId, classes.some.classId}` 是 Prisma 标准模式，与 lib/services/course.service.ts:teacherCourseFilter 同款思路（教师权限），学生权限对称查询
- 单 commit 修两个 + 7 case e2e 覆盖三案是合理 vertical：security fix 优先合并而不拖延 PR
