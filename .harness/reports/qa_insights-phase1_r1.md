# QA Report — insights-phase1 r1

**QA**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Branch**: `claude/elastic-davinci-a0ee14`

## Spec: 数据洞察重构 Phase 1 — Filter Bar + 班级多选 + Sidebar 改名

## 验证手段

- **静态层**：`npx tsc --noEmit` / `npm run lint` / `npx vitest run`
- **真浏览器**：gstack `/qa-only` (browse skill) + 13 张截图证据 `/tmp/qa-insights-phase1-*.png`
- **API 直测**：browser fetch 验证 `?classIds=A` / `?classId=A` legacy / POST recompute
- **Dev server**：worktree 内启动 `next dev -p 3031`（main repo 的 3030 server 拿不到 worktree 改动，已新建 symlink + 启动独立 server，关键发现）

## Acceptance Criteria 逐条验证

| # | 验收点 | Verdict | 证据 |
|---|---|---|---|
| **§A 类型与构建** | | | |
| 1 | `npx tsc --noEmit` 0 errors | ✅ PASS | 全无输出 |
| 2 | `npm run lint` 通过 | ✅ PASS | 0 errors / 0 warnings |
| 3 | 不引入新 npm 依赖 | ✅ PASS | git diff 未触 package.json |
| **§B Sidebar** | | | |
| 4 | sidebar 显示「数据洞察」 | ✅ PASS | screenshot 01-sidebar.png |
| 5 | 点击跳 `/teacher/analytics-v2` | ✅ PASS | click @e3 → URL = `/teacher/analytics-v2` |
| **§C Filter Bar 视觉与行为** | | | |
| 6 | xl ≥ 1280 单行 5 控件不溢出 | ✅ PASS | 1280: 5 控件 row 1 + 时间/buttons row 2（无横向滚动条）；1440: 6 控件 row 1 + buttons row 2。screenshot 05/06/11 |
| 7 | md 768-1279 优雅 wrap | ✅ PASS | 768: 3+3 控件 + buttons row 3，无横向滚动条 screenshot 08 |
| 8 | 「测试实例」「计分口径」filter 消失 | ✅ PASS | snapshot 仅见 6 控件（课程/章/节/任务/班级/时间），无 instanceFilter/scorePolicy dropdowns |
| 9 | 「重置筛选」「后台重算」位置功能保持 | ✅ PASS | 两按钮迁到 filter bar 右上 ml-auto，禁用态正确（无 courseId 时 disabled） |
| 10 | 多班 scopeTags `班级：A 班 / B 班`，单 `班级：A 班`，全 `班级：全部` | ✅ PASS | 单 `班级：金融2024A班`、全 `班级：全部`；多班 `/` 分隔由代码 review 验证 [components/analytics-v2/analytics-v2-dashboard.tsx:1283](components/analytics-v2/analytics-v2-dashboard.tsx#L1283)（实测无 2/2 split 数据可视，但 join(" / ") 实现正确） |
| **§D 班级多选** | | | |
| 11 | 班级 popover 多选下拉 | ✅ PASS | snapshot 见 `@e16 [button] "班级"` + 展开后 checkbox 列表 screenshot 09/10 |
| 12 | trigger 文本：全部 / className / N 个班级 | ✅ PASS | 全部 ✅ "全部班级"；单 ✅ "金融2024A班"；N 个 ✅ 实测后 (940bbe23 课程 deselect B → trigger "1 个班级" screenshot 12) — 实现 [insights-filter-bar.tsx:357-365](components/analytics-v2/insights-filter-bar.tsx#L357) |
| 13 | popover 顶部「全选/取消全选」+ checkbox 列表 | ✅ PASS | screenshot 09/10：顶部「全选/取消全选」label + 下方 checkbox 列表 |
| 14 | 取消全选 = 删 URL 参数 / 不出现「空数据」 | ✅ PASS | click 取消全选 → URL 删除 classIds → KPIs 仍正常 16.7%/61.7%（与全选时数字一致，因为 deselect-all 等同 no-filter = 全数据） |
| **§E 默认全部行为** | | | |
| 15 | 首次进入 → URL 自动填 classIds | ⚠️ PASS-with-note | spec 文字含糊：§E.15 acceptance 写"课程默认选第一个"，但 spec 实施 §6 写"等 diagnosis 加载完成、检测 URL 无 classIds 时再设"。**实际行为**：选课程后 URL 自动加 classIds（验证 OK：goto `?courseId=X` → URL 变 `?courseId=X&classIds=Y`）；**首次进入无 courseId 时不自动选第一课程**（与 phase 1 前一致，无回归）。建议未来 spec 明确 |
| 16 | **切换课程 → URL classIds/chapter/section 全部清空 + 自动重选新课程全部班** | ❌ **FAIL** | **Race condition 反退化**：从 A课(classIds=[A班id]) 切到 B课(应该 classIds=[B班id])，URL 实际为 `?courseId=B&classIds=A班id`（A班id 残留）。原因：[analytics-v2-dashboard.tsx:296-330](components/analytics-v2/analytics-v2-dashboard.tsx#L296) 的 diagnosis fetch effect 在 courseId 变化时**未先 setDiagnosis(null)**，导致 [analytics-v2-dashboard.tsx:357-379](components/analytics-v2/analytics-v2-dashboard.tsx#L357) 的 auto-fill effect 在新 courseId 下读到**旧 diagnosis** 的 filterOptions.classes，把旧 classIds 重新写进 URL。**用户视觉影响**：切课程后 KPIs 全部显示「无 0/0 人次」，scopeTags 误显「班级：全部」（误导）— screenshot 12 |
| 17 | 浏览器刷新 ?classIds=A&classIds=B 状态恢复 | ✅ PASS | goto multi-class URL → snapshot 显示对应 trigger label / scopeTags 状态 |
| **§F 服务接口与 API** | | | |
| 18 | input `classIds?: string[]`（无 `classId?: string`） | ✅ PASS | [analytics-v2.service.ts:11](lib/services/analytics-v2.service.ts#L11) |
| 19 | `scope.classIds: string[]`（无 `scope.classId: string \| null`） | ✅ PASS | [analytics-v2.service.ts:25](lib/services/analytics-v2.service.ts#L25) + API 直测 `'classId' in scope === false` |
| 20 | where 子句 `{ classId: { in: classIds } }` 当 length>0 | ✅ PASS | [analytics-v2.service.ts:655](lib/services/analytics-v2.service.ts#L655) + API instanceCount 测试：classIds=[A] → 3 个，classIds=[B] → 0 个，无 filter → 3 个 |
| 21 | entity 字段保持 `classId: string` | ✅ PASS | grep 验证 service 内 43 处 entity classId 完全未动；API response taskInstances[0].classId / heatmap[0].classId 均为 singular string |
| 22 | API GET ?classIds=A&classIds=B 200 + 数据正确 | ✅ PASS | API 直测：classIds=[A] → success, scope.classIds=["A"], completionRate=0.167, instanceCount=3 |
| 23 | API GET ?classId=A 兼容 | ✅ PASS | API 直测：legacy `?classId=A` → success, scope.classIds=["A"], 同 multi 数据。`/teacher/analytics-v2?classId=A` 浏览器 also 200，scopeTags 正确显示 |
| 24 | API POST recompute ?classIds=A 200 + job started | ✅ PASS | API 直测：success: true, status: "queued", type: "analytics_recompute" |
| **§G 8 Tabs 全功能回归** | | | |
| 25 | 8 个 tab 全部能渲染数据 | ✅ PASS | 依次 click @e20-@e27（课程总览/章节诊断/测试实例/测验题库/模拟主观题/学生干预/AI 周洞察/长期趋势），**console --errors: (no console errors)** |
| 26 | KPI 5 卡数字一致（多班 = 单班和） | ✅ PASS（受测试数据限制） | 单课程 A班：完成率 16.7% (5/30) / 归一化均分 61.7% / 中位数 58.4% / 低掌握 2 / 待批改 1 / 风险章节 2。多班课程（940bbe23）选两班数据为 0 是该课程本身无 published instances（非 bug）；选单班行为正确。**真"多班 sum = 单班 + 单班"对比无可用 seed**（每课基本都是单 class entity）— 推荐 phase 2/3 加入 multi-class seed |
| 27 | 章节×班级热力图、行动清单正常 | ✅ PASS | 单课正常显示 chapterTitle + className + 完成率 + 均分；行动清单显示"高 20% ANL-2 客户风险评估模拟 完成率偏低" 等 |
| 28 | 「重置筛选」清空 classIds + 回自动全选 | ✅ PASS | 切课后残留 stale classIds → click 重置 → URL 变 `?courseId=X&classIds=<新课程全部班>`（正确 reset） |
| **§H 与单实例洞察隔离** | | | |
| 29 | `/teacher/instances/{id}/insights` 不受影响 | ✅ PASS | goto 单实例洞察页 → 200 + 完整数据（提交总数/已批改/均分/分数分布）+ 0 console errors |
| 30 | `/teacher/dashboard` 不受影响 | ✅ PASS | goto 仪表盘 → 200 + 完整数据 + 0 console errors |

## Issues found

### 🚨 BLOCKER 1 — §E.16 切课程未清空 classIds（user-visible 数据丢失）

- **复现路径**：teacher 已选 A 课程（URL = `?courseId=A&classIds=A班id`），从 course dropdown 切换到 B 课程
- **预期**：URL 变 `?courseId=B&classIds=B班id`（diagnosis 重新加载后自动填 B 班 ids）
- **实际**：URL 变 `?courseId=B&classIds=A班id`（A 班 id 残留）→ filter applied to B 课但 A 班对 B 课没有数据 → KPIs 全部「无 / 0 / 0/0 人次」
- **误导**：scopeTags 文字显示「班级：全部」（因为 selectedCount === filterOptions.classes.length 都为 1），用户**看不到** filter 在错误生效
- **根因**：[analytics-v2-dashboard.tsx:296-330](components/analytics-v2/analytics-v2-dashboard.tsx#L296) 的 diagnosis fetch effect 在 courseId change 时未先 `setDiagnosis(null)`，stale diagnosis 让 [analytics-v2-dashboard.tsx:357-379](components/analytics-v2/analytics-v2-dashboard.tsx#L357) auto-fill effect 在新 courseId 下用 **旧 course 的 filterOptions.classes** 重新写 URL
- **修复方向**（builder 决定）：
  - **A**: diagnosis fetch effect 入口加 `setDiagnosis(null)` —— 简单但 UI 闪烁（loading 短瞬）
  - **B**: auto-fill effect 加防御 `diagnosis.scope.courseId === courseId` —— 不闪烁，更精确
  - **C**: course dropdown onValueChange 显式不依赖 effect，直接 `replaceQuery` 后立刻清 ref —— 当前已有 `defaultClassIdsAppliedRef.current = null` 设置但**只在 resetFilters 中**，course-switch 路径 ref 未清 → A→B 时 ref.current 一直是 "B course id"（即便 diagnosis 还是 B 的，effect 也会跳过）。**等等**，本地复测仔细看：实际 ref 行为还要再debug，**非纯 race**，可能是 ref 设置时机和 diagnosis fetch 异步顺序的复合问题
- **截图证据**：[/tmp/qa-insights-phase1-12-bug-stale-classids.png](file:///tmp/qa-insights-phase1-12-bug-stale-classids.png) — A→B 课切换后："1 个班级" trigger label, "完成率 无 0/0 人次", scopeTags 误显 "班级：全部"

### Minor 1 — 面包屑仍写「洞察实验」（spec 未明确要求改，但语义不一致）

- **位置**：[lib/layout/breadcrumbs.ts:17](lib/layout/breadcrumbs.ts#L17) `"analytics-v2": "洞察实验"`
- **现象**：sidebar 已改「数据洞察」，但顶部面包屑「教师 / **洞察实验**」未改
- **判断**：spec §B 仅指定 sidebar.tsx:48，breadcrumb 不在 phase 1 scope 内；H1 "实验" Badge 也是 spec 显式 phase 6 才去
- **不阻塞 PASS**：但建议 builder 顺手改 [breadcrumbs.ts:17](lib/layout/breadcrumbs.ts#L17) → `"analytics-v2": "数据洞察"`（或留到 phase 6 路由清理时）

### Minor 2 — §E.15 spec acceptance 文字含糊

- **位置**：[.harness/spec.md](.harness/spec.md#L139-L140) §E.15: "首次进入 `/teacher/analytics-v2`（URL 无 classIds），**课程默认选第一个** → diagnosis 加载后..."
- **现象**：实测首次进入无 URL params 时，course dropdown 显示「选择课程」placeholder（不自动选第一课程），与原代码一致
- **解读**：spec body §6 内文写"等 diagnosis 加载完成、检测 URL 无 classIds 时再设"——重点在 classIds 自动填，不强制 course 自动选。**与原代码行为一致 → 无回归 → PASS-with-note**
- **建议**：spec 修订澄清"course 是否自动选" or "保留与原代码一致的 placeholder"

## 关键审计：entity 字段保持 vs filter 入参改

经 grep + API response 直测确认，service 内**绝对不该改**的 entity 字段全部保留 `classId: string`：

```
lib/services/analytics-v2.service.ts:
- L41 (taskInstance entity)
- L120 ClassTrendPoint
- L133 StudentGrowthPoint
- L147 ChapterClassHeatmapRow
- L162 ActionItem (classId?: string optional)
- L180 InstanceDiagnostic
- L219 StudentIntervention
- L251/271/317 InstanceMetric / DiagnosisInstance / OptionInstance
- L503/535 select 子句的 classId: true（学生记录关系）
- L669-1618 内部聚合 instance.classId / metric.instance.classId / row.classId 等 30+ 处
```

**filter 入参 / scope 输出 / where 子句**正确改成 `classIds: string[]`：

```
- L11 input.classIds?: string[]
- L25 scope.classIds: string[]
- L616 scope 输出 input.classIds ?? []
- L655 where: { classId: { in: input.classIds } }
```

**判定**：entity vs filter 边界 100% 正确，无遗漏、无误改。

## 静态层结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors / 0 warnings |
| `npx vitest run` | 782 / 782 passed (含 analytics-v2.service.test.ts 13 + analytics-v2.api.test.ts 4) |
| dev server (worktree) | next dev -p 3031 alive — 注：此前 builder 在 main repo (3030) 测过，**不是 worktree**；QA 启动 worktree 独立 dev server 才能验证 phase 1 改动真实生效 |

## 截图证据（13 张，均存 `/tmp/qa-insights-phase1-*.png`）

| # | 文件 | 内容 |
|---|---|---|
| 01 | sidebar.png | sidebar「数据洞察」高亮 |
| 02 | filter-bar-1440.png | 1440 视口，单课程 A 班选中状态 |
| 03 | popover-singlecls.png | 单课程 popover 展开（仅 A 班） |
| 04 | first-load-no-params.png | 无 URL 参数首次进入（不自动选课程） |
| 05 | filter-1280.png | 1280 视口（5 控件单行 + 时间/buttons row 2） |
| 06 | filter-1440.png | 1440 视口（6 控件单行 + buttons row 2） |
| 07 | filter-1366.png | 1366 视口（5 控件单行 + 时间 + buttons row 2） |
| 08 | filter-768.png | 768 视口 md wrap（3+3 + buttons row 3） |
| 09 | popover-open.png | 单课程 popover 重复 open snapshot |
| 10 | popover-multicls.png | 多班课程（940bbe23）popover 同时显示 A+B 班 |
| 11 | final-1440.png | 静态状态最终验证 |
| 12 | bug-stale-classids.png | **🚨 BUG 证据**：切课程后 stale classIds 残留 + KPIs 全空 |
| 13 | multicls-course.png | 多班课程默认状态 |

## Overall: **FAIL**

**根因总结**：单一 BLOCKER 阻断 — §E.16 切课程未清空 classIds，导致 user-visible 数据丢失（teacher 切到新课程后看到空 dashboard，无法察觉是 stale filter 问题）。其他 29 项 acceptance 全部 PASS / PASS-with-note，包括关键的 §F service 接口 entity vs filter 边界、§G 8 Tabs 全功能、§H 隔离模块。

**修复成本估计**：5-15 行代码（最小 fix：L296-330 diagnosis fetch effect 入口加 `setDiagnosis(null)`，或 L357-379 auto-fill effect 加 diagnosis.scope.courseId 守卫）

**给 builder 的反馈**：
1. 主要：§E.16 切课程 race condition，详见 issue BLOCKER 1（修复方向 B 推荐：auto-fill effect 加 `diagnosis.scope.courseId === courseId` 守卫）
2. 次要（可顺手改）：[lib/layout/breadcrumbs.ts:17](lib/layout/breadcrumbs.ts#L17) 改「洞察实验」→「数据洞察」与 sidebar 一致
3. 验证方法：fix 后用 `/qa-only` 复测「切课程后 URL classIds 自动清 + 重新自动选新课程班级」流程（screenshot 12 那个 case 应该消失）
