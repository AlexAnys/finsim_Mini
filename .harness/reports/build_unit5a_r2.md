# Build Report — Unit 5a Round 2

> Builder: builder · 2026-05-14 · Commit `a1a9c2e` on `claude-demo-fixes`
> Builds on r1 commit `e217835`
> Delta：QA Finding A 一致性 polish（hidden → disabled+Tooltip）

## r2 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `app/teacher/tasks/[id]/page.tsx` | +24 / -1 | Tooltip import + 3 态按钮（编辑中/0 instance 可点/≥1 instance disabled+Tooltip）|
| `tests/e2e/unit5a-verify.spec.ts` | +31 | r2 新 case I |

r2 总 diff +55 / -1。在 plan 预算（< 30 行）之内（含 e2e 增量），核心 page.tsx 改动 +23/-1。

## 关键改动思路

只动 page.tsx 一个 UI 分支。原代码：
```tsx
{task.taskInstances.length === 0 && (
  <Button ...>删除任务</Button>
)}
```
改为：
```tsx
{task.taskInstances.length === 0 ? (
  <Button ...>删除任务</Button>
) : (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex">
        <Button disabled ...>删除任务</Button>
      </span>
    </TooltipTrigger>
    <TooltipContent side="bottom">
      该任务已发布 {N} 个实例，请先删除实例再删任务
    </TooltipContent>
  </Tooltip>
)}
```

`<span className="inline-flex">` 包 disabled Button 是 Radix Tooltip 标准模式 — disabled element 自身不响应 hover/focus，需要外层非 disabled 容器接收 pointer events。Unit 2 / Unit 5a 列表 / Unit 4 都用同一模式。

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc clean
vitest: 83 files / 986 tests pass
eslint: 0 problems
```

### Playwright E2E（9 case 累计，serial）
```
[r1] Unit 5a:
✓ A: 列表卡片 owner tooltip 删除按钮可见
✓ B: 有 chapter 课程 DELETE → 400 COURSE_HAS_CHAPTERS
✓ C: 创建+删除 dummy 课程 → 200 + GET 404
✓ D: non-owner DELETE → 403 FORBIDDEN
✓ E: 不存在的课程 DELETE → 404
✓ F: 任务详情页 0 instance 显示「删除任务」按钮
✓ G: 创建+删除 dummy 任务 → 200
✓ H: 有 instance 的 task DELETE → 400 TASK_HAS_INSTANCES

[r2] new:
✓ I: 任务详情页有 instance 时 删除按钮 disabled + Tooltip 显示原因 (5.6s) ⭐ r2

9 passed (30.4s)
```

### DB 状态
- Test C/G/H 创建的 dummy task/course 都已在测试内 cleanup
- r1 后 DB clean 状态保持

## 是否需要重启 dev server

不需要。

## 风险 / 不确定项

无新风险引入。该改动是 UI-only polish，纯前端条件分支重构。后端 API/service/audit 未动。

## Acceptance 对照（仅 r2 范围）

| QA Finding A 期望 | 状态 |
|---|---|
| 按钮可见但 disabled（不再 hidden）| ✅ Test I |
| Tooltip 文案显示具体原因 + 实例数 | ✅ "该任务已发布 N 个实例，请先删除实例再删任务" |
| UI 与 Unit 2 / Unit 5a 列表 disabled+Tooltip 模式一致 | ✅ 同款 span-wrap-disabled-button Radix 模式 |

## r1 → r2 总览

- r1 commit `e217835`：deleteCourse + deleteTask + UI 3 处（list/detail course/detail task）— QA r1 PASS w/ Finding A
- r2 commit `a1a9c2e`：Finding A 修复（hidden → disabled+Tooltip）— 本报告
- 累计 Unit 5a：2 commits / 11 files / 9 e2e cases / 0 regression
