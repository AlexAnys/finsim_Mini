# Spec — 数据洞察重构 · Phase 1：Filter Bar + 班级多选 + Sidebar 改名

> 完整 6-phase 实施计划见 `~/.claude/plans/main-session-snug-tide.md`。本 spec **仅** 负责 Phase 1。Phase 2-6 完成 Phase 1 PASS + 用户合并 PR 后单独写。

## Unit 标识

- **unit name**：`insights-phase1`
- **轮次约定**：build_insights-phase1_r1.md → qa_insights-phase1_r1.md → 失败则 r2、r3...
- **Dynamic exit**：连续 2 PASS 收工；同一 fail 连续 3 轮回 spec 重规划。

## 用户原话（多 session 并行 + 强调质量）

> "重构 洞察实验 这个页面，新的页面 就叫数据洞察"
> "认真细致的 plan 下 原子 git 每个阶段都真实 QA"
> "1. 替换 2. 可以但要效果最好风格一致 3. 默认全部 4. DDL 已到但未发布"
> "改确认的已经确认了, 相信你的判断, 过程里也不断对齐我高层意图, 质量和稳定 重于效率, 你来直接启动吧"

**最高优先级原则**：质量 > 稳定 > 效率。Phase 1 不破坏任何现有功能；用户合并 PR 是可逆的安全门。

## 当前 Baseline

- Worktree 分支：`claude/elastic-davinci-a0ee14`，从 main `e311571` 创建，**0 commits ahead** — 干净起点
- 主仓库 main HEAD：`e311571`（其他 session 在 main 工作中，并行隔离）
- 现 `/teacher/analytics-v2` 路由 = 用户口中的「洞察实验」，sidebar label 写着「洞察实验」
- 8 Tabs 结构本 phase **完全保留**（phase 3 才删）
- Dev server 状态：QA 启动时 verify
- `npx tsc --noEmit`：起点 0 errors（QA 必须验证 Phase 1 后仍 0 errors）

## Phase 1 范围（必须做 + 必须不做）

### ✅ 必须做的 6 件事

1. **Sidebar label 改名**
   - 文件：[components/sidebar.tsx:48](components/sidebar.tsx)
   - 「洞察实验」→「数据洞察」
   - 路由 `/teacher/analytics-v2` 不动（phase 6 才决定老路由清理）
   - 实验 Badge（在 dashboard H1 旁，[analytics-v2-dashboard.tsx:447](components/analytics-v2/analytics-v2-dashboard.tsx)）**保留**（phase 6 才去）

2. **Service 入参 `classId?: string` → `classIds?: string[]`**
   - 文件：[lib/services/analytics-v2.service.ts](lib/services/analytics-v2.service.ts)
   - **必改**（这些是 filter 入参 / scope 标识 / 内部 where 子句）：
     - L11 `AnalyticsV2DiagnosisInput.classId?: string` → `classIds?: string[]`
     - L25 `scope.classId: string | null` → `classIds: string[]`（scope 反映当前 filter 状态）
     - L616 `classId: input.classId ?? null` → `classIds: input.classIds ?? []`
     - L655 `...(input.classId && { classId: input.classId })` → `...(input.classIds && input.classIds.length > 0 ? { classId: { in: input.classIds } } : {})`
   - **绝对不改**（这些是 entity 字段，标识"某条记录属于哪个班"，不是 filter）：
     - L41 `taskInstance.classId: string`（filterOptions 中）
     - L120 `ClassTrendPoint.classId`、L133 `StudentGrowthPoint.classId`
     - L147 `ChapterClassHeatmapRow.classId`、L162 `ActionItem.classId`
     - L180 `InstanceDiagnostic.classId`、L219 `StudentIntervention.classId`
     - L251、L271、L317、L503、L535、L616 内部对 `Class.id` / `instance.classId` 等 entity 字段的引用
     - L669+ `instances.map(i => i.classId)` 等用 entity 字段聚合的逻辑
   - **判定原则**：「某 entity 一定有一个 class 归属」的字段保持 `classId: string`；「filter 由用户选择多个班」的入参/scope 改 `classIds: string[]`

3. **API Route 改成接受 `classIds` 重复 query 参数**
   - 文件：[app/api/lms/analytics-v2/diagnosis/route.ts:49](app/api/lms/analytics-v2/diagnosis/route.ts)
     - `classId: searchParams.get("classId") ?? undefined` → 取 `searchParams.getAll("classIds")`
   - 文件：[app/api/lms/analytics-v2/recompute/route.ts:51](app/api/lms/analytics-v2/recompute/route.ts)
     - 同上
   - **向后兼容**：如果客户端传单个 `?classId=X`（旧 URL 收藏夹），route 也要识别并转成 `classIds=[X]`，避免老链接 404。实现：先取 `classIds`，若为空再 fallback `classId` 单值并 wrap 成数组。

4. **新建 `components/analytics-v2/insights-filter-bar.tsx`**
   - 提取出现 [analytics-v2-dashboard.tsx:475-582](components/analytics-v2/analytics-v2-dashboard.tsx) 顶部 filter 区为独立组件
   - **布局重构**：从现 `grid md:grid-cols-2 xl:grid-cols-4` 多行 grid 改成**单行 horizontal flex**（`flex flex-wrap items-end gap-3`），溢出时优雅 wrap，不要横向滚动条（保持响应式）
   - **Filter 顺序**：课程 → 章 → 节 → 任务 → 班级 → 时间（用户原话顺序）
   - **班级 filter 改多选**：
     - 用 [components/ui/popover.tsx](components/ui/popover.tsx) + 内嵌 [components/ui/checkbox.tsx](components/ui/checkbox.tsx) 列表实现多选下拉（shadcn 没有现成 multi-select primitive）
     - Trigger 显示：「全部班级」/「{className}」/「{N} 个班级」
     - 选项区域：每行 `[ ] {className}`，顶部一行「全选 / 取消全选」
   - **Filter 移除项**（简化老师视图，按 plan §1）：删掉「测试实例」「计分口径」filter（这两个对老师太底层）
     - 「测试实例」：phase 3 改成"图表上点击柱→drawer"代替
     - 「计分口径」：默认 `latest`，不暴露 UI（service input 仍保留 `scorePolicy?: ScorePolicy`，新组件不传即使用默认）
   - **保留项**：`scopeTags` 当前范围标签条 + 「重置筛选」「后台重算」按钮
   - 组件接口：
     ```ts
     interface InsightsFilterBarProps {
       courses: CourseOption[];
       diagnosis: AnalyticsV2Diagnosis | null;
       coursesLoading: boolean;
       searchParams: URLSearchParams;
       recomputeJob: AsyncJobSnapshot | null;
       recomputeStarting: boolean;
       onReplaceQuery: (updates: Record<string, string | string[] | null>) => void;
       onReset: () => void;
       onStartRecompute: () => void;
     }
     ```
   - `onReplaceQuery` 支持 `string[]`：当 value 是数组时，用 `URLSearchParams.append` 多次（`?classIds=A&classIds=B`）；当是 `null` 或空字符串时 delete 所有同名 key

5. **班级多选默认行为：默认全部班**
   - 当 URL 无 `classIds` 参数时，filter bar 加载完 `diagnosis.filterOptions.classes` 后，**自动 dispatch `onReplaceQuery({ classIds: <全部 class.id 数组> })`**，让 URL 变成 `?courseId=X&classIds=A&classIds=B&...`
   - 但首次加载（diagnosis 还没回来）不要自动设 — 等 diagnosis 加载完成、且检测到 URL 无 classIds 时再设
   - 切换课程时：因为切课程会清空 chapter/section/taskInstance，**也要清空 classIds**（让新课程的 diagnosis 回来后再自动选其全部班）
   - 用户手动取消全选 → URL 变 `?classIds=` 空？ 不允许 — 实现：取消全选等同于"全选"（"全部" 即 "无过滤"），让 URL 删除 classIds 参数。或者保留显式空状态显示「无班级选择」给用户提示。本 phase 推荐前者（简单 + 不会有「空数据」尴尬）

6. **Dashboard 主组件接 InsightsFilterBar**
   - [analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx)：
     - 替换顶部 Card filter 区域为 `<InsightsFilterBar {...} />`
     - `searchParams.get("classId")` → `searchParams.getAll("classIds")`，所有 `classId` 单值变量改 `classIds: string[]`
     - `filteredInstances`（L369）的过滤条件 `instance.classId !== classId` → `classIds.length > 0 && !classIds.includes(instance.classId)`（多班 OR 关系）
     - `replaceQuery` 函数支持数组值（见 4 中描述）
   - 8 Tabs 全部不动（phase 3 才删）

### ❌ 必须不做的 5 件事（防止 scope creep）

1. ❌ 不动 KPI 5 卡（phase 2）
2. ❌ 不引入 recharts（phase 2）
3. ❌ 不动 Prisma schema（phase 4）
4. ❌ 不删 8 Tabs / 老 helper / 路由 `/teacher/analytics`（phase 3、6）
5. ❌ 不动 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx)（保留作 drill-down 终点）

## Acceptance Criteria（QA 必须逐条 verify）

### A. 类型与构建
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过（无新增 warning）
3. 不引入新的 npm 依赖（`package.json` 只能改源码、不能加 deps；recharts 是 phase 2 的事）

### B. Sidebar
4. teacher 登录后 sidebar 显示「数据洞察」（不是「洞察实验」）
5. 点击「数据洞察」跳到 `/teacher/analytics-v2`（路由不变）

### C. Filter Bar 视觉与行为
6. 顶部 filter 在大屏（≥ xl 1280px）单行显示 5 个控件（课程/章/节/任务/班级/时间），不出现横向滚动条
7. 中屏（md 768-1279px）优雅 wrap 成 2-3 行
8. 「测试实例」「计分口径」两个下拉**消失**（已迁出，phase 3 改交互）
9. 「重置筛选」「后台重算」按钮位置和功能保持
10. `scopeTags` 当前范围条显示为多班级时格式：「班级：A 班 / B 班」（用 `/` 分隔），单班时「班级：A 班」，全部时「班级：全部」

### D. 班级多选
11. 班级 filter 是 popover 多选下拉（不是 single Select）
12. Trigger 文本规则：
    - 全部选中 → 「全部班级」
    - 单个选中 → `${className}`
    - 多个选中 → `${N} 个班级`
13. Popover 内顶部有「全选 / 取消全选」开关，下方为 checkbox 列表
14. 取消全选等同于全选（URL 删除 classIds，或保留全选）— 实现一致即可，QA 要 verify「不出现空数据」状态

### E. 默认全部行为（用户 D3 决策）
15. 首次进入 `/teacher/analytics-v2`（URL 无 classIds），课程默认选第一个 → diagnosis 加载后 → URL **自动变成** `?courseId=X&classIds=<班1>&classIds=<班2>&...`
16. 切换课程 → URL 中 chapter/section/taskInstance/classIds 全部清空 → 新 diagnosis 加载后 → 再次自动选新课程的全部班
17. 浏览器刷新（URL 含 `?classIds=A&classIds=B`）→ filter 状态精确恢复

### F. 服务接口与 API
18. `AnalyticsV2DiagnosisInput.classIds?: string[]`（不再有 `classId?: string`）
19. `scope.classIds: string[]`（不再有 `scope.classId: string | null`）
20. `where` 子句：当 `classIds.length > 0` 时用 `{ classId: { in: classIds } }`，否则不加 class 过滤
21. `entity` 字段（如 `Class.id`、`instance.classId`、`StudentIntervention.classId` 等）**保持 `classId: string`** — 这是 entity 数据，不是 filter
22. API GET `/api/lms/analytics-v2/diagnosis?classIds=A&classIds=B` 返回 200 + 数据正确（多班聚合）
23. API GET `/api/lms/analytics-v2/diagnosis?classId=A`（**老格式**）→ 兼容工作，等价于 `?classIds=A`
24. API POST `/api/lms/analytics-v2/recompute?classIds=A&classIds=B` 返回 200 + 异步任务启动

### G. 8 Tabs 全功能回归（不破坏现状）
25. 课程总览 / 章节诊断 / 测试实例 / 测验题库 / 模拟主观题 / 学生干预 / AI 周洞察 / 长期趋势 8 个 tab 全部仍能渲染数据（多班选中时为聚合视图）
26. KPI 5 卡（完成率/归一化均分/低掌握/待批改/风险章节）数字与多班选中前的单班加总数字一致（手动验证一个班 + 多班对比）
27. 章节×班级热力图、行动清单 仍正常显示
28. 「重置筛选」按钮重置时**也清空 classIds**，回到「自动默认全选」状态

### H. 与单实例洞察隔离
29. 打开 `/teacher/instances/{id}/insights`（任一已有实例）页面正常加载，不受本次改动影响
30. teacher dashboard `/teacher/dashboard` 不受本次改动影响

## Risks / 反退化清单（参考 [CLAUDE.md](CLAUDE.md)）

| 风险 | 触发场景 | 防御 |
|---|---|---|
| Service interface 不一致 | classId → classIds 漏改某个 caller，编译过但运行 500 | 全仓 grep `classId.*string \| undefined` 等 input 字段位置；不改 entity 字段 |
| 老 URL 收藏失效 | 老师收藏 `?classId=A`，本 phase 后变 404 | route 兼容层：`classIds.length===0 时 fallback classId` |
| 多班聚合数字错 | scope.classIds.length > 1 时 KPI 错算 | 现有 service 内部已用 `classIds.in` (Prisma 标准)，只要正确替换 where 子句即可；QA 必须手动核对一个 KPI 数字 |
| Filter UI 单行溢出 | 6 控件 + 2 按钮挤在一行 | flex-wrap + 控件最小宽度 + 大屏验证 |
| 默认全部行为递归 dispatch | URL 自动设 classIds 触发 useEffect 再次自动设 → 死循环 | 用 ref 守卫，仅在 `urlClassIds.length === 0 && diagnosis.filterOptions.classes.length > 0` 时 dispatch 一次 |

## QA 验证手段

### 必须做
1. `npx tsc --noEmit` 跑通
2. `npm run lint` 跑通
3. **真浏览器** via gstack `/qa-only`（**不可跳过**，UI/路由/交互改动）：
   - 启动 dev server（验 port 3000 还是 3030 — 看 [HANDOFF.md](.harness/HANDOFF.md) 当前是哪个）
   - teacher1 登录 → sidebar 见「数据洞察」→ 点进入 `/teacher/analytics-v2`
   - 验 acceptance #6-#17 全部
   - URL 状态测试：
     - `http://localhost:{port}/teacher/analytics-v2`（无参）→ 自动选第一课程 + 全部班
     - 加 `?classIds=A&classIds=B` 刷新 → 状态恢复
     - 加 `?classId=A`（老格式）→ 兼容显示单班
   - 截图至少 4 张存 `/tmp/qa-insights-phase1-*.png`：sidebar、filter 单行、班级多选 popover、scopeTags 多班显示
4. **数据正确性**：选 2 个班对比 KPI 数字 = 单选每班 + 手算和（接近相等，有取整误差容忍）
5. **8 Tabs 全开一遍**，每个 tab 至少看到一行数据 + 无 console error

### 跳过项（本 phase 显式说明）
- ❌ vitest 单测（service 接口签名变了但纯逻辑函数无新增；phase 2/4 加 unit test）
- ❌ Prisma 三步（无 schema 改动）
- ❌ /cso（本 phase 无安全敏感改动）

## Build 报告产出位置

`build_insights-phase1_r{N}.md` — Builder 写完读 acceptance 自检 + 列改动 + 跑 tsc/lint 结果

## QA 报告产出位置

`qa_insights-phase1_r{N}.md` — QA 写 verdict (PASS/FAIL/BLOCKER) + acceptance 表格逐条 + 截图链接

## Coordinator 监控

监控 `progress.tsv` 尾部行 + TaskList。Dynamic exit：
- 2 PASS in a row → 标 task completed → 通知用户准备开 PR
- 同一 fail 3 轮 → 回 spec 重设计，不硬磨
- Phase 1 完成（PASS + commit）后 **Coordinator 停下，等用户合 PR + 决定是否进 Phase 2**

## 提交策略

- Phase 1 一个 atomic commit，message：
  ```
  feat(insights): phase 1 — filter bar + class multi-select + sidebar rename

  - Sidebar 「洞察实验」→「数据洞察」
  - Filter bar 单行布局，移除测试实例/计分口径 filter
  - 班级 filter 改多选下拉，默认全部班
  - Service classId?: string → classIds?: string[]，保留 entity 字段
  - API 兼容老 ?classId=X 格式
  - 8 Tabs 全保留，phase 2 起进一步重构

  See plan: ~/.claude/plans/main-session-snug-tide.md
  ```
- Builder 完成后**不要直接 commit**；交给 QA verify PASS → Coordinator 让 builder commit → 由用户 push + 开 PR
