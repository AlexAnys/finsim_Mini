# Build Report · Unit B2 · Round 1 (学生提问搬课程 SB 统计 tab)

> builder@instance-workbench · 2026-05-16
> Plan: `.harness/plans/unitB2_plan_r1.md`
> 单 commit / 方案 C（API courseId filter）

## 范围

课程详情 SB 统计 tab 加「未答疑列表」section，展示该课程的 raw SB posts（Q + AI 回复 + 软删除）。后端 `/api/teacher/study-buddy/posts` 加 optional `?courseId=` filter；前端复用现有 `/teacher/study-buddy` post-card UI 模式。

## 改动文件

| 文件 | 改/新 | 净行 |
|---|---|---|
| `app/api/teacher/study-buddy/posts/route.ts` | 改：加 courseId filter + 权限交集守护 | +11 / -2 |
| `components/course/course-study-buddy-analytics-tab.tsx` | 改：加 `PendingQuestionsList` 子组件 + AlertDialog 删除 | +220 / -1 |
| `tests/course-sb-pending-list.test.ts` | 新：13 测试 | +118 |
| `.harness/plans/unitB2_plan_r1.md` | 新 | +50 |

合计净 +231 / -3 = +228 净。

## API 改动（方案 C）

`app/api/teacher/study-buddy/posts/route.ts` 加 5 行核心逻辑（11 行含注释）：

```typescript
const filterCourseId = searchParams.get("courseId");
if (filterCourseId && !courseIds.includes(filterCourseId)) {
  return success({ posts: [], stats: { total: 0, pending: 0, answered: 0, students: 0 } });
}
const effectiveCourseIds = filterCourseId ? [filterCourseId] : courseIds;
```

**安全约束**：
- `filterCourseId` 必须与 owner+collab 课程 `courseIds` 求交集
- 未授权 → 静默返空（避免 enum scanning attacks）
- 缺省 → 回退到全 `courseIds`（向后兼容 `/teacher/study-buddy` 老页面）

`where.OR` 内 2 处 `courseIds` 替换为 `effectiveCourseIds`。

## UI 改动（`course-study-buddy-analytics-tab.tsx`）

在 4 大现有 section（KPI Metric / AI 问题总结 / groups）之后加新 section `<PendingQuestionsList courseId={courseId} />`：

- 独立 `useEffect` fetch `/api/teacher/study-buddy/posts?courseId=${courseId}&scope=pending`
- 卡片化每条 post：badge 标识（自由问 / 章节 / 匿名）+ 标题 + 学生名 + 时间
- 展开/收起：学生提问 + AI 回复
- 删除：AlertDialog 确认 → DELETE `/api/study-buddy/posts/{id}` → 乐观更新 state
- 空状态：「本课程暂无未答疑提问」
- Loading：Loader2 spinner

复用 `/teacher/study-buddy/page.tsx` 的 post-card 模式（class names / badge / Trash2 / AlertDialog 文案），保持视觉一致。

## 自测结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（B2 文件） | 0 error |
| `npx tsc --noEmit`（全项目） | 0 error |
| `npx vitest run tests/course-sb-pending-list.test.ts` | 13 / 13 PASS |
| `npx vitest run`（全 suite） | **103 files / 1184 tests PASS** / 0 regression（B1 baseline 1171 + B2 +13）|
| `npx eslint <touched files>` | 0 error / 0 warning |

## 关键决策

- **方案 C**（扩 `/api/teacher/study-buddy/posts` 而非新建 endpoint）：~10 行 API 改动 vs 新 endpoint ~50 行；复用现有 `enriched` 序列化逻辑 + scope filter，保持 API 单一职责
- **服务端守护 courseId**：永远求交集，不信任客户端；防 enum scanning
- **复用 DELETE endpoint** `/api/study-buddy/posts/[id]`：生产已验证（`/teacher/study-buddy` 老页面用同 endpoint）
- **保留 `/teacher/study-buddy` 老页面**：D3 双轨决策；sidebar 已在 B1 删入口，admin 可直访 URL 跨课程聚合查看；代码不删
- **不动 `/api/lms/study-buddy/analytics`**：仅追加新 section，不改原 4 大 section 数据源
- **测试策略**：源结构 grep（与 B1 / A1 / A2 / C1-B 同模式），覆盖 13 个语义点

## Anti-regression

- `/api/lms/study-buddy/analytics` 0 改动（KPI / AI summary / groups 数据源不变）
- `/teacher/study-buddy` 老页面 0 改动（`scope=all|pending|answered` 行为保留 — courseId 缺省时回退到全 courseIds）
- `/api/study-buddy/posts/[id]` DELETE endpoint 0 改动
- B1 sidebar 改动 0 触碰
- A1 / A2 / C1-B 改动 0 触碰
- 0 schema 改动 → dev server 不需要重启

## Worktree 5 unit 全部完成总结

| Unit | Commits | vitest 新增 |
|---|---|---|
| A2 | `439cc74` | 7 |
| C1-B | `6f4c70e` / `ea0f047` / `f12166c` (r1a/b/c) | 18 |
| A1 | `9f5be86` / `b531638` (r1a/b) | 36 |
| B1 | `04bc427` | 9 |
| B2 | （本 commit） | 13 |

总计 **83 个新 vitest 测试** / 0 regression / 全 suite 1184 PASS

## 下一步

QA 验收 B2。然后 worktree 整体就绪，等你 push / PR。
