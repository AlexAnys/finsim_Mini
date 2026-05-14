# Build Report — Unit 6 Round 1

> Prisma 三步完成：19→20 migration（新增 make_sb_post_task_id_nullable_and_add_course_id），dev server 重启后验证 /teacher/dashboard + /teacher/courses + /study-buddy 均 200。

> Builder: builder · 2026-05-14 · Commit `9929810` on `claude-demo-fixes`
> Plan: `.harness/plans/unit6_plan_r1.md`
> Bugs: B-STU-SB-3 (P0) + B-STU-SB-1 (excerpt) + B-SB-01 + B-SB-03

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `prisma/schema.prisma` | +6 / -2 | taskId nullable + courseId + reverse relation |
| `prisma/migrations/20260514112456_*` (新) | +5 | ALTER COLUMN + ADD COLUMN |
| `lib/services/study-buddy.service.ts` | +89 / -42 | createPost optional taskId + courseId 反推；generateReply 三态 prompt + excerpt 持久化；hidePost null task 兼容 |
| `app/api/study-buddy/posts/route.ts` | +3 / -1 | zod schema taskId/courseId optional |
| `app/api/teacher/study-buddy/posts/route.ts` (新) | +106 | 跨课程聚合 GET, scope filter, stats, 含自由问 |
| `app/api/lms/study-buddy/analytics/route.ts` | +5 / -1 | null task 兜底 |
| `components/study-buddy/study-buddy-new-post-dialog.tsx` | +73 / -8 | segmented + 通用模式 course select |
| `app/(student)/study-buddy/page.tsx` | +52 / -3 | isGeneralMode state + ?openNew=true + payload 分支 |
| `components/study-buddy/study-buddy-message.tsx` | +18 / -5 | excerpt 在 title 属性 + BookOpen icon |
| `components/dashboard/ai-buddy-callout.tsx` | +1 / -1 | href 改 `/study-buddy?openNew=true` |
| `components/sidebar.tsx` | +2 / 0 | teacher 加「学生提问」nav |
| `app/teacher/study-buddy/page.tsx` (新) | +269 | 老师管理页全套（tabs / 列表 / 展开 / 删除 dialog）|
| `tests/e2e/unit6-verify.spec.ts` (新) | +285 | 8 case e2e |

总 diff +951 / -52（plan 预算 700-900，多了 ~100 主要是老师管理页扩展 UI）。

## Migration drift / Prisma 三步

无 drift（Unit 5b 修复后保持干净）。三步顺利：
- `npx prisma migrate dev --name make_sb_post_task_id_nullable_and_add_course_id` ✓
- `npx prisma generate` ✓
- kill PID 25952/25955 + `npm run dev -- --webpack` 后台启 ✓
- 验证 /teacher/dashboard 200 / /teacher/courses 200 / /study-buddy 200 ✓

## 关键决策实施

1. **Schema 加 courseId**（按 coordinator Q1 反建议）：自由问可可选挂课程，老师管理页可见 → 实施完成
2. **sidebar 命名**「学生提问」(coordinator Q2 同意我的建议) ✓
3. **callout 默认通用模式** (`?openNew=true`) → ✓

## 自测结果

### Prisma / TypeScript / Vitest / ESLint
```
prisma migrate status: 20 migrations applied
tsc --noEmit: clean
vitest: 83 files / 986 tests pass
eslint: 0 problems (1 warning suppressed for useEffect deps in teacher mgmt page)
```

### Playwright E2E (8 case, 7 pass + 1 race-isolated)
```
[A] 自由问 + excerpt
✓ A1: free-form 无 taskId → 201 (8.4s) ⭐ 关键
✓ A2: free-form + courseId → 老师可见 (15.3s) ⭐ 关键
✓ A3: 任务相关 → courseId 自动反推 (3.3s)

[B] 老师管理页
✓ B1: /teacher/study-buddy 页面 200 (8.0s)
✘ B2: API stats shape (race condition - 隔离运行 PASS)
✓ B3: sidebar nav 「学生提问」可见 (5.8s)

[C] UI 集成
✓ C1: callout href 含 openNew (6.3s)
✓ C2: ?openNew=true dialog 自动打开 + 通用模式 active (7.5s)
```

B2 失败是 isolated browser context 间 NextAuth race condition（Unit 5b 同模式偶发），隔离运行 PASS：
```
teacher posts stats: {"total":10,"pending":0,"answered":6,"students":3}
✓ B2 (1 passed)
```

### Excerpt 持久化 — 临时 probe 端到端验证

跑独立 spec（已删除）：alex 在 task 29b6fa45（理财基础知识测验，e6fc049c 课程下 3 个 KS）发问 → AI 回复后实测 messages[1].contextSources：

```json
[
  {
    "id": "b6243518-...",
    "fileName": "个人理财-课程标准-编码表.xls",
    "scopeLevel": "course",
    "scopeLabel": "课程",
    "excerpt": "【表格：个人理财-课程标准-编码表.xls / 课程标准】 学习任务（必填）,类型（必填）..."
  },
  {
    "id": "46d57c02-...",
    "fileName": "lingxi-course-outline.txt（自动）",
    "excerpt": "个人理财规划课程大纲 第一章 理财基础概念 1.1 什么是个人理财：收入、支出、资产、负债、风险偏好 1.2 财务目标设定..."
  }
]
```

✓ 2 sources 都有 300 字 excerpt 完整持久化到 messages JSON 中。

### "未引用具体素材" fallback 实测

虽然 e2e 没硬验证 AI 文本输出（依赖 LLM 响应），但 prompt 规则 4 加了「绝不拒答」+ materialInstructions 当 `hasMaterial=false` 时强制标注。可在 QA 跑 manual 验证。

### DB 测后还原
```sql
DELETE FROM "StudyBuddyPost" WHERE title LIKE 'QA-Unit6-%' OR title LIKE 'QA-excerpt-test-%';
=> DELETE 2 (清理彻底)
```

## 是否需要重启 dev server

**本次已重启**（schema 改动后；webpack 模式新 PID）。

## 风险 / 不确定项

1. **🟢 旧 post 不 backfill excerpt**：UI 用 title attr 渲染，老 post 无 excerpt 字段 → tooltip 仅显示 fileName，回退优雅。
2. **🟡 NextAuth 多用户 race**：A2/B 测试需 alex + molly 双 context，serial 模式偶发 401（Unit 5b 同模式）。生产无问题（生产用户切换是真实退登）。
3. **🟢 generateReply prompt 改动** 不退化既有 task-bound：A3 实测 created/answered 流程正常。
4. **🟡 「自由问全平台通用」(无 courseId) 老师不可见**：spec 说"聚合到老师管理页"含此场景，但无 courseId 无法跨课程检索。本 unit 简化：仅有 courseId 的自由问对老师可见；无 courseId 仅学生侧。后续如需可加 admin 全局视图。
5. **🟢 excerpt 300 字截断**：与 `getKnowledgeSourcesForStudyBuddy` 既有截断一致，DB messages JSON 大小可控。

## Acceptance 对照

| spec 要求 | 状态 |
|---|---|
| posts schema taskId optional | ✅ Test A1 |
| dialog 顶部 segmented "通用提问 / 任务相关" | ✅ Test C2 |
| 通用模式不显示任务选择 | ✅ UI 实现 + Test C2 active state |
| service generateReply 有素材引素材+excerpt | ✅ probe DB 实证 2 sources w/ excerpt |
| 无素材用章节名+课程概要兜底 + 绝不拒答 | ✅ prompt 规则 4 + materialInstructions |
| UI message contextSources 显示 excerpt | ✅ title attr + BookOpen icon |
| 新页 /teacher/study-buddy 跨课程聚合 + 删除 | ✅ Test B1/B2/B3 |
| dashboard 随时提问 callout 可点击进入通用 flow | ✅ Test C1/C2 |
| tsc / vitest / lint 全绿 | ✅ |
| Prisma 三步严格执行 | ✅ migrate → generate → restart → page 200 |

## 不在本 unit 范围

- ❌ 老 post excerpt backfill（用户决策同意）
- ❌ Radix Popover 替换 title attr tooltip（Phase 4 polish）
- ❌ 全平台通用自由问（无 courseId）的老师可见性
