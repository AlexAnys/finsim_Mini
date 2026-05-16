# Unit B2 · r1 · Mini Plan

> builder@instance-workbench · 2026-05-16
> 单 commit

## 目标

课程详情 SB 统计 tab 增「未答疑列表」section，展示该课程的 raw SB posts（Q + AI 回复 + 删除）。复用 `/teacher/study-buddy` 现有 post-card UI 模式。**保留** `/teacher/study-buddy` 老页面（双轨）。

## 改动文件

| 文件 | 改/新 | 估行 |
|---|---|---|
| `app/api/teacher/study-buddy/posts/route.ts` | 改：加 `?courseId=` filter（仅显该课程的 posts；与 owner+collab 列表交集守护权限）| +12 |
| `components/course/course-study-buddy-analytics-tab.tsx` | 改：加 `PendingQuestionsList` section（fetch 该课程 posts，展开/删除复用模式）| +175 |
| `tests/course-sb-pending-list.test.ts` | 新：API courseId filter 静态结构 + 组件 grep | +75 |

合计 ~262 行（接近 200 上限，单 commit 可行；超 plan「~210」预期 ~50 行）。

## API 改动（关键）

`route.ts:23-46` 在 owner+collab courseIds 计算后加：

```typescript
const filterCourseId = searchParams.get("courseId");
if (filterCourseId && !courseIds.includes(filterCourseId)) {
  return success({ posts: [], stats: { ... } }); // 权限隔离：教师未拥有该课程则返空
}
const effectiveCourseIds = filterCourseId ? [filterCourseId] : courseIds;
```

然后 `where.OR` 改用 `effectiveCourseIds`。**关键：courseId 必须先与 owner+collab 列表交集（在 server 端守护），不能信任客户端传值**。

## UI 改动

在现有 `<div className="space-y-2">{data.groups.map...}</div>` 之后加一个 `PendingQuestionsList` section。组件内部：
- 独立 useEffect fetch `/api/teacher/study-buddy/posts?courseId=${courseId}&scope=pending`
- 展开/收起 + 删除按钮（AlertDialog）走现有 `/api/study-buddy/posts/${id}` DELETE endpoint
- 取消列表后从 state 删该 post（乐观更新）
- 空状态："本课程暂无未答疑提问"

## 关键决策

1. **courseId filter 在 server 端守护**：永远先与 owner+collab 课程列表求交集；客户端传未授权 courseId → 返空，不暴露错误（避免 enum scanning attacks）
2. **scope=pending**：只拿未答疑（默认场景）；如未来需要 answered 可加 prop
3. **fetch 独立**：不动现有 `/api/lms/study-buddy/analytics` API；新 fetch 与 groups fetch 并行
4. **复用 DELETE endpoint** `/api/study-buddy/posts/[id]` —— 老 `/teacher/study-buddy` page 用过，已生产验证
5. **保留 `/teacher/study-buddy` 老页面**：D3 决策双轨；sidebar 已在 B1 删入口（admin 走 `/admin` 或直 URL 访问），代码不删
6. **跨课程隔离**：测试用 mock courseId 不在 owner 列表 → 应返空

## 测试

- API 源结构：`?courseId=` filter 存在 + `courseIds.includes` 守护 + 不信任客户端
- 组件源结构：`PendingQuestionsList` 函数 / `?courseId=` 调用 / 删除 AlertDialog / 空状态文案

## Anti-regression

- `/api/lms/study-buddy/analytics` 不动
- `/api/teacher/study-buddy/posts` 现有 scope=all|pending|answered 行为不变（仅加 optional courseId filter）
- `/teacher/study-buddy` 老页面不动
- `course-study-buddy-analytics-tab` 现有 4 大 section（KPI / AI summary / groups）不动；仅追加新 section
- B1 / A1 / A2 / C1-B 改动 0 触碰
