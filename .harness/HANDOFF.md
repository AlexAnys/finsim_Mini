# HANDOFF

> 会话结束前由 coordinator 更新本文件。新会话启动时 SessionStart hook 自动显示。

## Last completed — Phase 2 · 学生端全体重做（2026-04-24，本 session 累计 12 commit）

### Phase 0 · Round 1 基座（4 commit）
- `35d18f0` feat(design): 落地 FinSim v2 tokens（深靛/象牙/暖赭 + dark）
- `ebc25d2` refactor(dashboard): 核心卡去硬编码色
- `ab397be` feat(ui): 新 Wordmark + 侧边栏重构
- `86e639f` chore: Round 1 证据链

### Phase 1 · 技术债清理（3 commit，双 PR 一次过 PASS）
- `d313416` fix(ssr): 教师首次登录侧边栏闪烁（layout RSC + getSession + initialRole）
- `41decaa` fix: 4 项 latent bug（guards 提公共 + schedule where + 老师公告缩紧 + allSettled）
- `e810045` chore: Phase 1 证据链（+13 tests）

### Phase 2 · 学生端全体（5 commit，四 PR 全部一次过 PASS）
- `19f8758` feat(layout): TopBar 共享 shell（面包屑 + AI 按钮 + 用户菜单 + 通知占位）
- `47f445d` feat(student-dashboard): 问候 Hero + 4 KPI + 三列 + AI 渐变卡
- `59f06e1` feat(student-courses): summary strip + 2 列 CourseCard
- `f964094` feat(course-detail): 深色 Hero + 三列 + 三态时间线 + 6 ContentBlockType
- `424cb4a` chore: Phase 2 证据链（+32 tests，总计 119）

**统计**：
- 共 12 个功能/修复 commit
- 新建 25+ 组件文件 / 6 util 文件 / 7 测试文件
- tsc 0 errors，vitest 从 61 涨到 **119**（+58 新测试）
- build 全通过，schema/API/auth 零改动
- 设计 tokens 全仓 penetration，硬编码 Tailwind 色已在 dashboard/ 完全消除

## Next step — Phase 3 · 教师端全体（下次 session 主战场，跨 3 会话）

已写入 `.harness/spec.md` 等启动：

### Phase 3 PR 路线
- **PR-3A** `/teacher/dashboard` 重设计（对齐 `mockups/design/teacher-dashboard.jsx`）
  - 5 KPI strip 按业务优先级排序（待批改排第一）
  - "需要你关注" AI 整理的工作清单（取代原始任务列表）
  - 班级表现折线+柱状混合图
  - 学生薄弱概念 top 3 → "待分析实例 top 3"（设计师 C2 降级）
  - 今日课表 + 动态 feed + AI 建议深色卡
  - ~500-600 行
- **PR-3B** `/teacher/courses` 列表（多教师头像堆叠 + 班级徽标）
- **PR-3C** `/teacher/courses/[id]` 课程编辑器（Notion 式文档编辑器，左目录 + 主内容流 + 右块属性面板）~600 行

### 后续 Round（留给再下次 session）
- Round 5 任务向导 `/teacher/tasks/new`（1500 行巨型向导重做）~2 会话
- Round 6 `/teacher/instances/[id]` + insights + analytics ~2 会话
- Round 7 Runner 外壳 + 登录 + 空错态 ~1 会话
- Round 8 Simulation 对话气泡专题 ~1 会话

## Phase 3 关键数据降级（schema 零改，延续设计师降级策略）

| 设计稿模块 | 后端现状 | 本 Phase 落地策略 |
|---|---|---|
| 5 KPI 待批/均分/班级/提交/薄弱 | 4 个有 stats；薄弱 = 无跨 instance 聚合 | 薄弱卡降级为"待分析实例 top 3"（C2 决策） |
| "需要你关注"清单 | 现有 taskInstances 数据足够 | ✓ 直接 |
| 8 周班级表现趋势 | submissions 按周聚合（客户端算） | ✓ 前端聚合即可 |
| 今日课表 | scheduleSlots + 当前日过滤 | ✓ |
| 动态 feed | submissions 最近 + activity | ✓ 前端聚合 |
| AI 建议本周卡 | ❌ 无"主动建议"数据 | **降级**：改为"打开 AI 助手"入口占位 |
| 多教师头像 + 班级列表 | CourseTeacher / CourseClass 多对多已支持 | ✓ 直接 |

## 路线图（11 session → 8 Phase）

| Phase | 内容 | 状态 |
|---|---|---|
| 0 | Round 1 基座 tokens+卡+sidebar | ✓ 完成 |
| 1 | 技术债清理（SSR 闪烁 + latent bug） | ✓ 完成 |
| 2 | 学生端全体 4 PR | ✓ 完成 |
| 3 | 教师端 dashboard + courses + courses/[id] | 下次 session 开始 |
| 4 | 任务向导 /teacher/tasks/new | 规划中 |
| 5 | /teacher/instances + insights + analytics | 规划中 |
| 6 | Runner 外壳 + 登录 + 空错态 | 规划中 |
| 7 | Simulation 对话气泡 | 规划中 |

## Open decisions（留给新 session 自动处理）

- Phase 3 AI 建议卡降级成"入口占位"还是显示示例建议文案（非真 AI 数据）？— 默认走前者（更诚实）。
- `/teacher/dashboard` 的"薄弱概念"降级成"待分析实例"后，按钮 "生成讲解" 改名为"查看洞察"比较合适。builder 自行判断。

## Open observations（PR-2C/2D QA 留的非阻塞 finding）

1. `isBehind && totalTasks > 0` 边缘 case — 0 任务课程目前显示"进度落后"徽章，建议 Phase 3/4 期间小 patch 修正
2. `app/(student)/courses/[id]/page.tsx` L283 `const className` 与 React className prop 命名冲突（语义是"课程班级字符串"），可重命名为 `classNamesJoined` 等

## Open task（跨会话无关 UI 重构）

- 上海教师 AI 案例申报（`.harness/shanghai-ai-case-2026.md`）— 规划已锁定，独立工作线，用户说过可并行或后做，**默认后做**（UI 重构优先）。

## Mockup server

Python HTTP server 仍在 `localhost:8765`（PID 59984）供 QA 对比设计稿用。最终 session 收工时 `kill 59984`。

## Summary

本 session 是 harness 效率高峰：8 个 PR（3 Phase）全部一次过 PASS，0 回滚 / 0 FAIL / 0 超 scope。下次 session 启动即可直接进 Phase 3，HANDOFF 已锁定状态。
