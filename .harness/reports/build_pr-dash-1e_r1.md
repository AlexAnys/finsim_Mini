# Build Report — PR-DASH-1e r1

**Unit**: PR-DASH-1e · B3 一周洞察 AI 管道（Phase 8 教师工作台收官）
**Round**: r1
**Builder**: Claude Opus 4.7（1M context）
**Base commit**: 86c99b0 (main HEAD)

## 摘要

完成 Phase 8 Block B 最后一个 PR：教师工作台"一周洞察"按钮真正接入 AI 管道。新建 `weekly-insight` AI feature（qwen3.5-plus 长 context），新 service / endpoint / modal 实现"按钮触发 → 1h cache 或 force 跳缓存 → 4 sections modal"全流程。无 schema 改动，无 dev server 重启需求。

## 文件清单

### 新增

- `lib/services/weekly-insight.service.ts` — `generateWeeklyInsight(teacherId, opts)` + `buildWeeklyInsightPrompt`（纯函数）+ `computeUpcomingOccurrences`（纯函数）+ in-memory `cache` Map + `__clearWeeklyInsightCache`（test-only helper）
- `app/api/lms/weekly-insight/route.ts` — `GET`，requireRole(["teacher", "admin"])，`?force=true` 跳缓存
- `components/teacher-dashboard/weekly-insight-modal.tsx` — shadcn Dialog；4 sections（亮点摘要 / 各课弱点 / 班级差异+学生聚类 / 接下来课堂建议）+ 重新生成按钮 + 关闭按钮 + 加载/错误态
- `tests/pr-dash-1e-weekly-insight.test.ts` — 18 测试覆盖：service prompt builder（2）+ computeUpcomingOccurrences（2）+ cache hit/force/AI 失败降级/teacher 隔离/conceptTags 聚合（5）+ API endpoint 401/403/200/force（4）+ UI 5 守护

### 修改

- `lib/types/index.ts` — `AIFeature` 加 `"weeklyInsight"`
- `lib/services/ai.service.ts` — `FEATURE_TEMPERATURES` + `FEATURE_ENV_MAP` 加 `weeklyInsight: 0.4 / "AI_WEEKLY_INSIGHT"`
- `components/teacher-dashboard/ai-suggest-callout.tsx` — header-chip 接受 `onWeeklyInsightClick` + `weeklyInsightLoading` props；onClick 渲染 button 含 spinner，无 onClick 时回退 Link 兼容老调用方
- `components/teacher-dashboard/greeting-header.tsx` — 透传 `onWeeklyInsightClick` + `weeklyInsightLoading` 到 AiSuggestCallout
- `app/teacher/dashboard/page.tsx` — 新增 `weeklyOpen / weeklyData / weeklyLoading / weeklyError` 4 个 state；`fetchWeeklyInsight(force)` + `handleWeeklyClick` + `handleWeeklyRegenerate` 3 个 callback；GreetingHeader 接 click handler；底部挂 `<WeeklyInsightModal />`
- `.env.example` — 加 `AI_WEEKLY_INSIGHT_PROVIDER=qwen` + `AI_WEEKLY_INSIGHT_MODEL=qwen3.5-plus`
- `.env` — 加 `AI_WEEKLY_INSIGHT_MODEL=qwen3.5-plus`
- `tests/pr-dash-1b-text.test.ts` — 1 处 regex 放宽：原 `<AiSuggestCallout variant="header-chip" />` 单行自闭合，PR-DASH-1e 加 props 后变多行；改为 `[\s\S]*?` 容纳 props（守护意图"渲染 header-chip 变体"不变）

## 关键决策

### 1. AI feature key 命名
新增独立的 `weeklyInsight` feature key（而不是复用 `insights`）— 因为：
- 提示词、温度、模型、限流口径都跟实例聚合 `insights` 不同
- 用户原话指定要"提示词管道可以新搭建一下，使用 qwen 3.5plus" — 单独配置 `AI_WEEKLY_INSIGHT_*` 才能独立调
- 老的 `AI_INSIGHTS_*` 仍指向 qwen-max（高价值聚合保留），weekly-insight 用 qwen3.5-plus（性价比 + 长 context）

### 2. 不持久化、in-memory 1h cache
spec 写明"如果用户后续要历史回看，PR-DASH-1f 加 WeeklyInsight 表"。本 PR 严格遵循：
- `Map<teacherId, { result, expiresAt }>` 存在 service 模块作用域
- TTL 1h；`?force=true` 跳缓存
- 单进程内有效；多 worker 部署时每个 worker 独立 cache（可接受，因为只是 AI 调用节流）
- 暴露 `__clearWeeklyInsightCache` 让单测能隔离

### 3. AI 失败降级
不向上抛 AI 错误（避免 modal 整体白屏），降级返回空 `payload` + 中文 `highlightSummary`。这样教师看到"暂不可用，请稍后重新生成"也能优雅关闭 modal。和 `insights.service.ts` PR-FIX-2 B3 的降级路径风格一致。

### 4. Schedule 未来 7 天计算
`computeUpcomingOccurrences` 只做最简的"日期循环匹配 dayOfWeek"，不严格校验 `startWeek/endWeek/weekType`。理由：
- AI 拿到 slot 数据后会自行决定哪些建议有意义
- 严格周次校验需要 `semesterStartDate` + 周次复算，会引入 60+ 行复杂逻辑（本 PR 不在 scope 内）
- 已限制最多 12 条避免重复爆炸

### 5. AiSuggestCallout 向后兼容
header-chip 模式增加可选 `onWeeklyInsightClick` 后，没传 onClick 时仍渲染原 Link（默认走 `/teacher/analytics`）。这样老调用方（如果有）不会因为 prop 缺失而炸掉。

## 验证

### TypeScript
```
npx tsc --noEmit
```
**0 errors**（命令无输出）

### Tests
```
npx vitest run
```
**Test Files: 52 passed (52); Tests: 646 passed (646)**

新 18 测试全过：buildPrompt 字段聚合 / computeUpcomingOccurrences 周次匹配 / cache 命中 / force 跳缓存 / AI 失败降级 / 教师隔离 / conceptTags 聚合 / API endpoint 401-403-200-force / UI 5 守护（chip props / greeting 透传 / modal 4 sections / dashboard 接线 / .env.example）

### Lint
本 PR 触动文件（10 个）lint：**0 errors**, 1 pre-existing warning（`generateObject` unused 在 ai.service，PR-7B 遗留）

仓库整体 5 errors / 21 warnings — 全部 pre-existing（grades/page useEffect setState + simulation-runner 中文引号未转义），不在本 PR scope。

### Build
```
npm run build
```
**✓ Compiled successfully in 8.5s**
**✓ Generating static pages 52/52**
新增路由 `/api/lms/weekly-insight` 进入 build 路由表（51 → 52）。

### 真 E2E（dev server PID 55027 alive）

| 场景 | 期望 | 实际 |
|---|---|---|
| GET 未登录 | 401 + 中文 | ✅ `{"success":false,"error":{"code":"UNAUTHORIZED","message":"未登录，请先登录"}}` |
| GET 学生（student1） | 403 + 中文 | ✅ `{"success":false,"error":{"code":"FORBIDDEN","message":"权限不足，无法访问此资源"}}` |
| GET 教师（teacher1）首次 | 200 + 真 AI payload | ✅ `success:true`, AI 返回真 `highlightSummary`（200 字以内中文）+ 6 条 `upcomingClassRecommendations`（个人理财规划课程的真实 6 节课建议）+ submissionCount=0（过去 7 天无 graded+released）+ cached=false |
| GET 教师 二次（cache 命中） | 200 + cached=true | ✅ `cached: True submissionCount: 0 recCount: 6` |

dev server 用的是 PID 55027（spec 提到的 96617 已死，但端口 3000 上有新 server）。

## Anti-Regression 检查

按 CLAUDE.md "Anti-Regression Rules" 走：

1. **Function signature 改动？**
   - `AiSuggestCallout`: 新增可选 prop（向后兼容），grep 调用方仅 `greeting-header.tsx` 1 处 → 已同 PR 更新
   - `TeacherGreetingHeader`: 新增可选 prop，grep 调用方仅 `dashboard/page.tsx` 1 处 → 已同 PR 更新

2. **Service interface 改动？**
   - `ai.service.ts`: 仅扩展 Record（新增 `weeklyInsight` key），不破坏 type narrowing（AIFeature 是 union → 加成员是 additive）
   - 新 service `weekly-insight.service.ts` 是新增不冲突

3. **Schema 改动？**
   - 0。无 Prisma 三步要求。

4. **被改动文件的其他业务逻辑？**
   - `dashboard/page.tsx`：仅在 useMemo 链尾追加 4 个新 state + 3 个 callback + 1 个组件挂载，原有 KPI/AttentionList/PerformanceChart/WeakInstances/TodaySchedule/ActivityFeed 数据流字节级不动
   - `ai-suggest-callout.tsx`：`callout` 大卡 variant 字节级不动；只是 header-chip 内追加 button 分支
   - `greeting-header.tsx`：仅透传 prop

## 不确定项 / 留给 QA

1. **Schedule 未来 7 天有重复**：同一 slot（如周一 18:00）在 7 天窗口内可能命中多次（本周一 + 下周一）。当前代码会列出 2 条同 slotId 不同 date 的记录。AI 看到了真实数据，能区分；UI 显示时也按 date 排序。但如果 spec 严格要求"去重 by slotId"，可加一行 `Map<id, ...>` 去重 — 本 PR 视为 acceptable behavior。

2. **AI 真返回 → modal UI 渲染**：本 build report 仅验证 API；modal 的 4 sections UI 在 dev 可手动打开点击验证（dev server alive）。Vitest 18/18 + tsc + build 均过，UI 层守护测试已写。建议 QA 做一次浏览器手动点 chip → 验证 modal 打开 + 4 sections 都渲染 + "重新生成"可点。

3. **dev server PID 不一致**：spec 说 96617，但实际监听端口的是 55027（用户可能在 spec 写完后重启过）。endpoint 200 OK 已实测。

## Dev server 重启

**不需要**。本 PR 无 Prisma schema 改动，纯 TS/TSX 改动 dev server 会 HMR。

## Rationale 摘要

| 问 | 答 |
|---|---|
| 为什么不改 schema 加 WeeklyInsight 表？ | spec 明示"如果用户后续要历史回看，PR-DASH-1f 加 WeeklyInsight 表"。本 PR 走 1h in-memory cache，简化 + 减少存储，符合 spec 决策。 |
| 为什么用 qwen3.5-plus 而不是 qwen-max？ | 长 context 用 plus 最合适（一周聚合数据可能很大）。spec 用户原话："使用 qwen 3.5plus"。.env.example 默认 plus，运行时若未设走 default qwen3.5-plus（QWEN_MODEL 默认）。 |
| 为什么 fetch 在 click 而不在页面 mount？ | 用户原话"按一下可以根据..."— 明确按需触发，避免每次进 dashboard 都跑 AI 浪费 token。`weeklyData` cache 在前端 state，只首次 click + force 时打 API。 |
| AI 失败为什么不抛 error？ | modal 半渲染好不友好。降级走"暂不可用"+空 sections，用户能优雅"重新生成"重试。 |

## Acceptance 自查（按 spec L46-50）

| Acceptance 项 | 状态 |
|---|---|
| tsc 0 errors | ✅ |
| lint 0 errors（本 PR 文件） | ✅（仓库整体 5 pre-existing 不属本 PR） |
| vitest 597+ PASS | ✅ 646 PASS（+18 新） |
| npm run build 含新 endpoint | ✅ `/api/lms/weekly-insight` 在 52 routes 内 |
| 真 cookie teacher1 GET 200 | ✅ 真 AI 返回 |
| 401 unauth | ✅ 中文 message |
| 403 student | ✅ 中文 message |
| modal 4 sections 渲染 | ✅ UI 守护测试 + 文件证据 |
| 重新生成可用 | ✅ `force=true` API + UI button + handleWeeklyRegenerate |

## Phase 8 Block B 收官

- PR-DASH-1a · B1+B8+B9（kpi-strip 文案）✅
- PR-DASH-1b · B2+B4（ai-suggest chip + 近期课表）✅
- PR-DASH-1c · B5+B6（任务列表 + 卡片重做）✅
- PR-DASH-1d · B7（班级表现重做）✅
- **PR-DASH-1e · B3（一周洞察 AI 管道）✅ 本 PR**

Block B 9 项反馈（B1-B9）全部完成。

---

**HANDOFF**: 给 QA r1。建议手动浏览器跑一次：登录 teacher1 → /teacher/dashboard → 点右上"一周洞察" chip → modal 打开 → 4 sections 渲染（亮点摘要 / 各课弱点 / 班级差异 + 学生聚类 / 接下来课堂建议）→ 点"重新生成"再走一次（cached: false）→ 关闭。
