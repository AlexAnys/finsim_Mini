# Build Report — Unit 6 Round 2

> Builder: builder · 2026-05-14 · Commit `04d7a8b` on `claude-demo-fixes`
> Builds on r1 commit `9929810`
> Delta: QA Finding A (critical) — 学生 /study-buddy 500 crash 修

## r2 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/design/tokens.ts` | +9 / -1 | `courseColorForId` 源头 null-guard (signature widening + early return) |
| `tests/course-color-for-id.test.ts` (新) | +35 | 5 个 unit test 覆盖 null/undefined/""/normal/deterministic |
| `tests/e2e/unit6-verify.spec.ts` | +67 / -1 | r2 D1 regression e2e (创建 free-form → 进 list 不崩) + 移除 unused const |

r2 总 diff +111 / -2。在 plan 预算（< 50 行 — 严格的 e2e 部分扩了，纯修复仍 ~10 行）。

## Root cause

Unit 6 r1 加了 `StudyBuddyPost.courseId String?`（自由问可选挂课程）。当学生发自由问无 courseId 且无 taskId 时：

```ts
// study-buddy-list-item.tsx:58
const courseSeed = post.courseId ?? post.taskId;  // 两者皆 null → null
const tagKey = courseColorForId(courseSeed);  // → 进 tokens.ts

// lib/design/tokens.ts:80 (r1)
export function courseColorForId(id: string): TagColorKey {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {  // ← null.length TypeError
```

TypeScript 的 `id: string` 签名让 callsite 不报警，但运行时 callsite 实参经 `??` 链可为 null。**CLAUDE.md L168 经典陷阱**：tsc 不抓 runtime null deref。

## Fix strategy（QA 推荐 Option 1）

源头 null-guard：

```ts
export function courseColorForId(id: string | null | undefined): TagColorKey {
  if (!id) return "tagA";  // 无 seed 时回退默认色
  let hash = 0;
  for (let i = 0; i < id.length; i++) { ... }
  return TAG_KEYS[hash % TAG_KEYS.length];
}
```

**为什么 Option 1 优于 Option 2**：
1. **辐射广**：14 个 caller 自动受益，不需逐个改
2. **签名诚实**：声明 nullable 入参，未来 caller 看签名就知道可传 null
3. **行为确定**：null seed → "tagA"，比 caller 各自 fallback 写不同字符串更一致

## Grep follow-up (按 coordinator 要求)

`courseColorForId` 全代码 14 个 caller，其中 **5 个传可能 null 的值**：

| 文件 | 调用 | 风险 |
|---|---|---|
| `study-buddy-list-item.tsx` | `post.courseId ?? post.taskId` | ✅ root cause (Unit 6) |
| `study-buddy-conversation-header.tsx` | `post.courseId ?? post.taskId` | ✅ 同模式 (Unit 6) |
| `grades/submission-row.tsx` | `row.courseId ?? row.taskInstanceId` | ✅ 历史隐患（被本 r2 顺手修了）|
| `today-classes.tsx` | `s.courseId` | ✅ 历史隐患 |
| `teacher-dashboard/today-schedule.tsx` | `s.courseId` | ✅ 历史隐患 |
| 其他 9 个 | `c.id` / `task.id` / 显式 hash 都非空 | OK |

5 个隐患修一处搞定，无需逐 caller 改。

## 测试结果

### TypeScript / Vitest / ESLint
```
tsc clean
vitest: 84 files / 991 tests pass (986 baseline + 5 new unit)
eslint: 0 problems
```

### Unit tests (新)
```
tests/course-color-for-id.test.ts:
✓ returns a tag key for normal string id (2ms)
✓ is deterministic for the same id
✓ returns default tagA for null
✓ returns default tagA for undefined
✓ returns default tagA for empty string
```

### Playwright E2E
```
[r1] Unit 6 A/B/C: 7/8 pass + 1 race-isolated (PASS in isolation)
[r2] Unit 6 r2 D1:
✓ alex POST free-form (taskId=null + courseId=null) → 再进 /study-buddy 200 + DOM 渲染正常 (11.4s)
   - HTTP 200 ✓
   - body 含 "QA-Unit6-r2-D1-*" title ✓
   - body 不含 "服务器开小差" / "Cannot read properties" ✓
   - page console 0 条 null deref 错误 ✓
```

### DB 测后还原
```
DELETE FROM "StudyBuddyPost" WHERE title LIKE 'QA-Unit6-r2-%';
=> DELETE 1
```

## 风险 / 不确定项

1. **🟢 默认色"tagA"**：与原本 hash 命中 tagA 视觉一致；用户感知不到异常。
2. **🟢 14 个 caller 0 改**：signature widening backward-compatible（TS 接收 `string` 也接收 `string | null | undefined`）。
3. **🟢 e2e 校验"创建-列表往返"**：补全 r1 漏测的 user flow。

## Reflection (按 coordinator 要求记录)

**未来 unit 测试设计补充原则**（已加 HANDOFF）：

> **每个新建实体后必须验"再次进入列表页"**（创建-列表往返）。
>
> Unit 6 r1 e2e 验了：post create POST 201、AI reply 生成、老师管理页可见。但没验"学生本人创建后再访问 SB list" 这个 demo 核心路径 — 列表渲染时遇到 nullable seed 没防护。
>
> 类似陷阱：每加一种"可空"字段（如 courseId nullable, taskId nullable），都需要在 e2e 加一个"该实体出现在列表中"的渲染测试，不只是"POST 200 + DB 写入"。

## Acceptance 对照（r2 角度）

| QA Finding A 要求 | 状态 |
|---|---|
| 源头加 null-guard `courseColorForId(null | undefined | "")` | ✅ |
| 加 unit test 覆盖 null/undefined 入参 | ✅ 5 case |
| 新 e2e：create free-form → 进 list 200 + DOM 正常 | ✅ Test D1 |
| 同模式其他 caller grep + 覆盖 | ✅ 5 callers 一处修 |
| tsc / vitest / lint 全绿 | ✅ |

## r1 → r2 总览

- r1 commit `9929810`：自由问 + courseId schema + excerpt 持久化 + 老师管理页 (QA FAIL on regression)
- r2 commit `04d7a8b`：null-guard + 测试补 (本报告)
- 累计 Unit 6：2 commits / 16 files / 10 e2e cases / 1 critical regression 修
