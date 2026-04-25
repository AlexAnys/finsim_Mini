# Build Report — PR-5A · 实例详情 Shell + Overview tab · r1

**Unit**: `pr-5a`
**Round**: `r1`
**Date**: 2026-04-24

## Scope

Phase 5 · PR-5A — Rebuild `/teacher/instances/[id]` 的外壳：
- 新 header（面包屑 / 类型+状态 badge / 大标题 / meta / 右上 action 组）
- 4 tabs 导航（overview / submissions / insights / analytics，其中 `AI 洞察` 带 AI badge + 提交数 counter）
- Overview tab 内容：交付漏斗 4 卡（已指派 / 已提交 / 批改中 / 已出分）+ 关键动作面板 + 截止倒计时
- submissions tab 暂保留原 table + 讨论区作为 fallback，PR-5B 会重做
- insights / analytics tab 暂放 placeholder 等后续 PR

## Files changed

### 新文件（`components/instance-detail/`）
- `components/instance-detail/instance-header.tsx`（203 行）
- `components/instance-detail/tabs-nav.tsx`（77 行）
- `components/instance-detail/overview-tab.tsx`（180 行）
- `components/instance-detail/overview-utils.ts`（73 行，pure utils，可测）
- `tests/instance-detail-overview.test.ts`（89 行，12 unit tests）

### 修改
- `app/teacher/instances/[id]/page.tsx`（整体重写 · 606 行）— 保留所有原 hook / CSV 导出 / 讨论区 / 分页 / 状态切换逻辑；shell 从 `<Card>` 式改为 `<InstanceHeader>` + `<InstanceTabsNav>` + tab 分派
- `lib/services/task-instance.service.ts`（+6 行）— `getTaskInstanceById` 的 include **additive** 增加 `course / chapter / section / _count`（header 面包屑 / section/slot 行需要）

**未动的 service 字段**：`getTaskInstances` / `publishTaskInstance` / `updateTaskInstance` / `deleteTaskInstance` / `isAuthorizedForInstance` 字节级不变（中途误改触发了 tsc 崩、已 surgical revert）。

## Non-obvious decisions

1. **Shell 从 card 式改为 surface-banded**
   Header 用 `bg-surface border-b border-line px-6 pt-5` 横跨，tabs nav 在 header 下方同容器；页面 body 用负 margin 把 `<main>` 的 padding 吃掉（`-mx-4 -my-4 md:-mx-6 md:-my-6`），避免 header 被内层容器 padding 包裹。设计稿 L32-124 要求的是 "header 占满内容宽度 + 下方 body padding"。
   - 风险：若未来 layout padding 变了，`-mx-*` 需要对齐。已用 `md:` 断点。

2. **`exportGrades` 保留 CSV BOM**
   CSV BOM 用了 `"﻿"`（U+FEFF），原逻辑不变。**我的初版 Write 错把 `﻿` 脱义成字面字符串 ""，实际 output 会比原始多 3 字节** — 已不要紧（原来就是 byte、BOM 3 字节 in UTF-8），**但建议 QA** 在 submission 列表非空时真正下载一次并看是否 Excel 能正常识别中文（**已转回 surrogate**）。

3. **`getTaskInstanceById` 的 include 扩展是 additive change**
   - `class: true` 改为 `class: true` + 4 新字段。未动任何已有字段，下游消费者（只有 1 个 — `app/api/lms/task-instances/[id]/route.ts`）类型零破坏。`grep getTaskInstanceById` 全仓仅 1 处真实 caller（另 1 处在 `.next/standalone` build artifact 不计）。

4. **`classMembers` 用来算 `assigned`**
   Spec 说"班级全员"=指派数。原 page 无此查询，submission.total 只能算 submitted。我用 `GET /api/lms/classes/[classId]/members` 补一次调；失败 silently fallback 成 `submitted`（ui 不 break，数字可能偏低）。
   - **Open**: 如果 TaskInstance 的 assign 规则未来支持 `groupIds`，得改成 "班级成员 ∩ groupIds"。现在 `groupIds: String[]` 字段已有，但 Phase 4 未消费；暂维持 "全班" 语义符合设计稿 L143 "班级全员"。

5. **Countdown 4 档**
   - diff < 0: `已截止`（danger）
   - diff < 24h: `剩余 N 小时 M 分钟`（warn）
   - diff < 3 天: `剩余 N 天`（warn）
   - >= 3 天: `剩余 N 天`（ink，普通色）
   提取到 `overview-utils.ts` 便于测试。**`formatCountdown` 接受 `now` 参数** 以保证测试确定性。

6. **"开始批改" 按钮行为**
   设计稿按钮导向"批改流"，但 PR-5A 无 drawer，我做成 "切换到 submissions tab + scrollIntoView"。PR-5B 会接上真的 grading drawer。

7. **Preview 学生视角**
   simulation 走 `/sim/[id]?preview=true`（已有路由），quiz/subjective 走 `/tasks/[id]?preview=true`（已有）。不新增路由。

## Verification

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **300 passed / 0 failed / 31 files**（288 baseline + 12 new） |
| `npm run build` | 0 errors / 0 warnings / 25 routes emitted |
| dev server `/teacher/instances` | HTTP 200 |
| dev server `/teacher/instances/[real-id]` | HTTP 200（39.9 KB HTML） |
| API `/api/lms/task-instances/[id]` | 200 · course/chapter/section/_count 字段已返回 |
| 回归路由（8 页）| `/teacher/dashboard` `/teacher/courses` `/teacher/instances` `/teacher/tasks` `/teacher/tasks/new` `/dashboard` `/schedule` `/courses` `/grades` 全 200 |

**SSR grep**：`/teacher/instances/[id]` HTML 首屏只含"加载中"（client fetch 模式）—— 正确行为（原页面也是如此）；hydrate 后 UI 才渲染。

## Open concerns / QA hints

- **真浏览器验证必须（qa-p5 跑）**：
  1. teacher1 登录 → 进任何一个 published instance → 看 header：面包屑 4 级（课程管理 / 个人理财规划 / 任务实例 / 标题）、类型 badge（SUBJECTIVE 等 uppercase）、状态 badge（已发布）、meta（截止/指派/满分）
  2. 切到 submissions tab → 见原 table（未变）+ 讨论区
  3. 切到 insights / analytics → 见 "即将上线" placeholder
  4. Overview tab：交付漏斗 4 卡数字合理（assigned = classMembers.length or fallback）、关键动作面板在有 unsubmitted 时显示"N 名学生未提交"、倒计时用合理 tone
  5. 375 px 响应式：grid 2 列降 1 列、action 组 wrap 不溢出
  6. 点"催交"→ toast "催交通知已记录"；点"开始批改"→ 跳到 submissions tab + 滚动
  7. 点 "导出成绩" → 下载 CSV（含 UTF-8 BOM，Excel 中文 ok）
- **未改 schema**：无需 Prisma 三步，dev server 不需要重启（当前 PID 59187 仍有效；service include 扩展是 additive，Next.js 文件 watcher 下次 hit 会自动 pick up）
- **PR-5B 会做什么**：submissions tab 用 `@tanstack/react-virtual` 或 `react-window` 虚拟化 + 打开 drawer；目前 tab 里旧 table 保持可用避免 QA 途中断
- **未做 section · 设计稿 "分数分布 / 各评分维度" 被移到 Analytics tab**：PR-5D 会做直方图 + 维度条形图，spec 里也是这样划分

## Deferred (not in this PR)

- 任务说明没有 tag 组 / "需求识别" 这类自由 tag — 数据源 `Task.requirements` 是纯文本，不是 string[]。等 schema 支持
- "时间轴" section（设计稿 L287-312）略去 —— instance 数据缺乏"首个提交""中期统计"的聚合；会在 Analytics tab 或 Insights tab 并入，不浪费 Overview 格子

## 状态

Ready for QA.
