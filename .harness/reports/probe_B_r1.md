# Probe B · 工作台 sidebar + 学生提问 — Round 1

> qa@instance-workbench · 2026-05-15 静态代码 probe

## 1. sidebar 9 项

`components/sidebar.tsx:50-60` teacherNav：

| # | label | href |
|---|---|---|
| 1 | 仪表盘 | `/teacher/dashboard` |
| 2 | 课程管理 | `/teacher/courses` |
| 3 | 数据洞察 | `/teacher/analytics-v2` |
| 4 | 学生提问 | `/teacher/study-buddy` |
| 5 | 课表管理 | `/teacher/schedule` |
| 6 | 班级管理 | `/teacher/groups` |
| 7 | AI 助手 | `/teacher/ai-assistant` |
| 8 | AI 用量 | `/teacher/ai-usage` |
| 9 | AI 设置 | `/teacher/ai-settings` |

admin 多 1 项 `/admin/audit`。

## 2. 4 个目标页功能

### `/teacher/ai-usage` ~250 行
- API: `GET /api/lms/ai-usage?feature=&take=50`
- 内部 state: data/loading/errMsg/featureFilter
- **可抽离为 `<UsageTab />`**：把 default export 包成 named export

### `/teacher/ai-settings` ~500 行
- API: `GET/PATCH /api/ai/tool-settings`
- ToolSetting 字段含 testingKey/testResult per-tool map
- **可抽离为 `<SettingsTab />`**：注意保留闭包

### `/teacher/study-buddy` ~310 行
- API: `GET /api/teacher/study-buddy/posts?scope=all|pending|answered` + `DELETE /api/study-buddy/posts/[id]`
- 全跨课程聚合，无 courseId 过滤

### `components/course/course-study-buddy-analytics-tab.tsx`
- API: `GET /api/lms/study-buddy/analytics?courseId=&summarize=`
- 已具：totalQuestions/pendingQuestions/groups/aiSummary
- **缺**：raw post list

## 3. SB analytics API response shape

`app/api/lms/study-buddy/analytics/route.ts:130-137` 返回：
```typescript
{
  totalQuestions, pendingQuestions, activeStudents,
  groups: [{ chapterId, chapterTitle, sectionId, sectionTitle,
            taskId, taskTitle, taskType,
            questionCount, pendingCount,
            students: [{id, name, count}],
            examples: string[]  // 仅前 5 条 question 文本 }],
  aiSummary, aiError
}
```

**raw post 字段缺失**：id / aiReply / student.name / anonymous / status / createdAt / title 全无。

route.ts:36-50 内部已查询完整 posts include student/task/taskInstance，**信息已在内存里**，仅在 `examples.push(post.question)` 时挑出 question 一字段。

## 4. 关键决策：B2 改方案

**plan 原方案**：扩 `analytics/route.ts` response 加 rawPosts
**probe 发现更优方案 C**：复用 `/api/teacher/study-buddy/posts` 加 courseId filter

| 方案 | 改动文件 | 与 Unit 16 冲突 |
|---|---|---|
| A: 扩 analytics 加 rawPosts | `app/api/lms/study-buddy/analytics/route.ts` | ⚠️ Unit 16 B-SB-P2-4 可能改此 route |
| C: posts route 加 courseId filter | `app/api/teacher/study-buddy/posts/route.ts` | ✅ 主 session 8 项无一动此 endpoint |

**采用方案 C**：B2 改动估算从 plan 原版 200 行降至 ~10 行 API + 120 行 UI = 130 行。

### 课程 SB tab 改造
- 现在只 fetch analytics
- B2 增加 fetch `/api/teacher/study-buddy/posts?courseId=${courseId}&scope=pending`
- 新增 PendingQuestionsList section 渲染未答疑 raw posts
- 复用 `/teacher/study-buddy` page L191-289 的 post card UI

## 5. 修复粒度估算

### B1 ~400 行净增（接近上限 → 可拆 r1a sidebar+wrapper、r1b tab 组件抽离）

| 改动 | 文件 | 行 |
|---|---|---|
| 抽离 usage UI | new `components/ai-workbench/usage-tab.tsx` | +280 |
| 抽离 settings UI | new `components/ai-workbench/settings-tab.tsx` | +400 |
| Tabs 容器 + URL `?tab=` | new `app/teacher/ai-workbench/page.tsx` | +80 |
| 原 ai-usage 改 redirect | `app/teacher/ai-usage/page.tsx` | -250 + 30 |
| 原 ai-settings 改 redirect | `app/teacher/ai-settings/page.tsx` | -500 + 30 |
| sidebar 改动 | `components/sidebar.tsx` | ~10 |
| tests | new | +60 |

### B2 ~210 行

| 改动 | 文件 | 行 |
|---|---|---|
| posts endpoint 加 courseId filter | `app/api/teacher/study-buddy/posts/route.ts` | +10 |
| 课程 SB tab 加 PendingQuestionsList | `components/course/course-study-buddy-analytics-tab.tsx` | +120 |
| **不动** `/teacher/study-buddy/page.tsx`（D3 双轨保留）| — | 0 |
| **不动** sidebar（B1 已删入口）| — | 0 |
| tests vitest ≥2 | new | +80 |

## 6. 风险

- ai-settings 600 行抽离时多 state 闭包要完整搬移（builder 用 named export 整段搬）
- B2 跨课程隔离测试需 ≥2 course + ≥3 post，molly dev 数据应已就绪
- **D3 双轨保留**：sidebar 删入口后 `/teacher/study-buddy` 怎么进？建议改为"URL 直访 + 一周后用户确认无需后删除"，spec 加 follow-up TODO

## 7. 与主 session 协调

- 采方案 C 后，B2 改的文件与主 session 8 项完全无重合 → **B2 build 前不再需要 ask 主 session**
- sidebar 改动：B1 一次性完成，B2 不动；如主 session Unit 16 也改 sidebar → rebase 时手动 merge
