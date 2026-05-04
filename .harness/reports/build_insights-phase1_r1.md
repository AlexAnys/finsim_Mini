# Build Report — insights-phase1 r1

**Builder**: claude-opus-4-7[1m]  · **Date**: 2026-05-03  · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` (branch `claude/elastic-davinci-a0ee14`)

## 改动文件清单

| 文件 | 改动 | 类型 |
|---|---|---|
| `components/sidebar.tsx` | line 48 「洞察实验」→「数据洞察」 | edit |
| `lib/services/analytics-v2.service.ts` | input `classId?: string` → `classIds?: string[]`；scope 同样；scope 赋值；where 子句 `{ classId: { in: classIds } }`；entity 字段全部不动 | edit |
| `app/api/lms/analytics-v2/diagnosis/route.ts` | 接受 `classIds` 重复 query；`?classId=X` legacy fallback；调用 service 用 `classIds: array` | edit |
| `app/api/lms/analytics-v2/recompute/route.ts` | 同上；async-job input 写 `classIds` array | edit |
| `lib/services/async-job.service.ts` | analytics_recompute worker 读 `classIds` array + 兼容老 `classId` 单值；新增 `readInputStringArray` helper | edit |
| `components/analytics-v2/insights-filter-bar.tsx` | **新建**。单行 horizontal flex 布局；filter 顺序 课程 → 章 → 节 → 任务 → 班级 → 时间；班级用 Popover + Checkbox 多选；scopeTags + 重置 + 后台重算 | new |
| `components/analytics-v2/analytics-v2-dashboard.tsx` | 接 InsightsFilterBar；移除老 Card filter 区 + FilterSelect helper + 8 个老下拉；H1 区域只留 title + 实验 Badge + 最后计算 timestamp（按钮迁到 filter bar）；`searchParams.get("classId")` → 读 `classIds` 数组（带 legacy fallback）；本地 scope 接口 `classId: string \| null` → `classIds: string[]`；`replaceQuery` 支持 `string \| string[] \| null`；新增 `defaultClassIdsAppliedRef` + useEffect 实现"无 classIds 时自动选全部班"，ref 守卫防递归；`buildScopeTags` 多班用 `/` 分隔 | edit |
| `tests/analytics-v2.api.test.ts` | line 87 断言 `classId: "class-A"` → `classIds: ["class-A"]`（接口签名等价更新，**非新增测试**） | edit |
| `tests/analytics-v2.service.test.ts` | line 273+282 filter 输入 `classId: "class-A"` → `classIds: ["class-A"]`；where 断言相应改为 `classId: { in: ["class-A"] }` | edit |

**总 diff 量**：~10 个文件触动，大头集中在 dashboard + 新 filter-bar 组件，其它都是窄改动。

## 验证结果

| 检查项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors / 0 warnings** |
| 单元测试 | `npx vitest run` | **782 / 782 passed**（含 analytics-v2.service.test.ts 13 + analytics-v2.api.test.ts 4）|
| 路由可达性 | `curl /teacher/analytics-v2` | HTTP 307 → /login（auth 重定向，正常） |
| Dev server | port 3030 PID 检查 | alive |

## Acceptance 自检（spec §A-§H）

| # | 验收点 | 状态 | 证据 |
|---|---|---|---|
| 1 | tsc 0 errors | ✅ | 见上 |
| 2 | lint 通过 | ✅ | 见上 |
| 3 | 不引入新 npm 依赖 | ✅ | 仅改源码，未 touch package.json |
| 4 | sidebar 显示「数据洞察」 | ✅ | sidebar.tsx:48 已改 |
| 5 | 「数据洞察」跳 `/teacher/analytics-v2` | ✅ | href 不变 |
| 6 | xl 单行 5 控件 | ✅ | flex flex-wrap items-end gap-3，每控件 minWidth 140-200 + flex 1，xl=1280px 容得下 |
| 7 | md 优雅 wrap | ✅ | flex-wrap 自动换行 |
| 8 | 「测试实例」「计分口径」消失 | ✅ | 老 Card 全部删；新 bar 只 5 dropdown + 1 multi-select |
| 9 | 「重置筛选」「后台重算」位置功能保持 | ✅ | 移到 filter bar 右上 ml-auto，事件回调相同（onReset / onStartRecompute） |
| 10 | 多班 scopeTags 格式 `班级：A 班 / B 班` | ✅ | `buildScopeTags` 用 `.join(" / ")`；全部 → 「班级：全部」；单班 → 「班级：A 班」 |
| 11 | 班级 popover 多选下拉 | ✅ | `ClassMultiSelect` 用 PopoverContent + Checkbox 列表 |
| 12 | trigger 文本规则 | ✅ | 全部 → 「全部班级」；单 → className；多 → `{N} 个班级` |
| 13 | popover 顶部「全选/取消全选」 | ✅ | `toggleAll` checkbox + label 联动 |
| 14 | 取消全选 = 删 URL 参数（不出现空数据） | ✅ | `onChange([])` → `replaceQuery({ classIds: null })` → URL 无 classIds → service no class 过滤 → 全数据。ref 守卫已置位防自动重选 |
| 15 | 首次进入 + 课程默认 → URL 自动加 classIds | ✅ | `defaultClassIdsAppliedRef` useEffect：`courseId` 已设、`diagnosis` 加载完、`urlClassIds.length === 0`、有 class 时 dispatch 全部 |
| 16 | 切课程 → 清空+再次自动全选 | ✅ | course Select onValueChange 显式 set classIds=null；ref 与 courseId 比对，新 course 触发新 dispatch |
| 17 | 刷新 `?classIds=A&classIds=B` 状态恢复 | ✅ | searchParams.getAll("classIds") 直读，无副作用覆盖 |
| 18 | input 类型 `classIds?: string[]` | ✅ | service.ts L11 |
| 19 | scope 类型 `classIds: string[]` | ✅ | service.ts L25 |
| 20 | where 子句 `{ classId: { in: classIds } }` 当 length>0 | ✅ | service.ts L655 |
| 21 | entity 字段保持 `classId: string` | ✅ | grep 验证：service 内 43 处 `classId\b`，全部为 entity（heatmap row / instance / intervention / 内部聚合 var 等） |
| 22 | API GET ?classIds=A&classIds=B 返回 200 | ⏸️ | 类型 + 单测通过；待 QA 真浏览器验证 |
| 23 | API GET ?classId=A 兼容 | ⏸️ | route 有 `readClassIds` fallback 函数；single test ok；待 QA 真验 |
| 24 | API POST recompute ?classIds=A&classIds=B 200 | ⏸️ | 同上；async-job worker 也读 classIds + legacy fallback |
| 25 | 8 Tabs 全可渲染（多班聚合） | ⏸️ | 8 tab JSX 完全未动；待 QA 真验聚合数据正确 |
| 26 | KPI 5 卡数字一致（多班 = 单班和） | ⏸️ | service KPI 算法未改，只 where 过滤多班；逻辑等价；待 QA 手动核对 |
| 27 | 章节×班级热力图、行动清单正常 | ⏸️ | 组件未动；数据来自 diagnosis 同口径 |
| 28 | 重置按钮重置时清空 classIds + 回到自动全选 | ✅ | `resetFilters` 主动 reset ref + URL 只留 courseId → 触发自动全选 useEffect |
| 29 | `/teacher/instances/{id}/insights` 不受影响 | ✅ | 该页面未动 |
| 30 | `/teacher/dashboard` 不受影响 | ✅ | 未动 |

## 关键决策（rationale）

1. **递归 dispatch 防御**：`defaultClassIdsAppliedRef` 用 `courseId` 字符串作 key，而不是布尔 — 这样切课程时 ref 自然失效（`current !== newCourseId`）触发新 dispatch；同时手动 cancel-all 不会触发递归（ref 已置位）。
2. **legacy `?classId=X` fallback 双层**：API route + dashboard 都加 fallback，目的是
   - API：老 URL 收藏夹 → 200（spec §F.23）
   - Dashboard：避免客户端 useEffect 把 `?classId=A` 误认为「无 classIds，自动全选」从而覆盖单班视图
3. **Card filter 区彻底删除 vs 局部改动**：老的 4-col grid 8-FilterSelect 跟新的 horizontal flex 单行结构差距过大，整体替换为 `<InsightsFilterBar />` 比 inline 渐进改造更干净；H1 区只留 title + Badge + 最后计算 timestamp（按钮已迁入 filter bar，spec §C.9 要求"位置和功能保持"，按钮挪到 bar 右上 ml-auto 位置一致）。
4. **scope 字段重命名而不是新增并存**：spec §F 说「scope 反映当前 filter 状态」，所以 `scope.classId: string \| null` 直接改成 `classIds: string[]`，不保留旧字段，避免 dual source of truth。本地 dashboard 复制的 interface 同步改。
5. **测试更新**：spec 说 vitest 跳过，但 api/service 测试断言对接口签名敏感，**会因签名变更而 fail**；我把这两处断言改成等价新格式，**不算"新增测试"**而是"维护已有测试随接口同步"。

## 不确定 / 待 QA 验证项

1. **真浏览器视觉**：xl 1280px 单行布局是否真的"不出现横向滚动条"。controls 总宽度估算 = 课程 180 + 章 160 + 节 160 + 任务 200 + 班级 180 + 时间 140 + 重算/重置按钮 ~200 + gap 21 = ~1241px，理论容得下，但 SelectTrigger 内文本可能溢出（如长课名）。**需要 QA 截图 verify**。
2. **KPI 多班聚合数字**：service KPI 计算口径未改，理论上 multi-class 等价于"in 多个 classId 的 union" — 但 spec §G.26 要求"手动核对一个 KPI 数字（一个班 + 多班对比）"，**待 QA 用真数据 verify**。
3. **8 Tabs 全数据**：spec §G.25 要求每个 tab 渲染数据 + 无 console error。我未跑真浏览器，不能确证多班选中时所有 tab 都正常。**待 QA 用 gstack `/qa-only` 8 tab 全开一遍**。
4. **legacy `?classId=A` 浏览器行为**：服务端转 `classIds=[A]` 没问题；客户端我做了 fallback，但 trigger 文本会显示 "1 个班级"（应该）或 className 单班（视字典查找成功与否）。**待 QA verify**。

## Dev Server 重启

**不需要**。本 phase 无 schema 改动；客户端 / 服务端 .ts/.tsx 改动 Next.js fast refresh 已自动 pick up（已 curl 验证 `/teacher/analytics-v2` 路由可达）。

## 提交策略

按 spec 明确：**Builder 不 commit**，等 QA 出 PASS verdict + Coordinator 给信号再 commit（一个 atomic commit，message 模板见 spec 末尾）。

## 反退化检查（CLAUDE.md §6-§9）

- [x] 改 service interface (`classId` → `classIds`) 前 grep 全仓 callers，已逐一更新（`tests/analytics-v2.{api,service}.test.ts` + `app/api/lms/analytics-v2/{diagnosis,recompute}/route.ts` + `lib/services/async-job.service.ts` + `components/analytics-v2/analytics-v2-dashboard.tsx`）
- [x] entity 字段（heatmap row / intervention / instance / class trend）全部保持 `classId: string` —— grep 验证 service 内 43 处 entity classId 完全未动
- [x] 单一职责：未做 drive-by refactor，仅 Phase 1 范围内改动
