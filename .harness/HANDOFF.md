# HANDOFF

> 会话结束前由 coordinator 更新本文件。新会话启动时 SessionStart hook 自动显示。

## Last completed — 本 session 是 FinSim v2 最高产 session（2026-04-24，19 commits）

### Phase 0 · Round 1 基座（4 commit）
- `35d18f0` feat(design): FinSim v2 tokens（深靛/象牙/暖赭 + dark）
- `ebc25d2` refactor(dashboard): 核心卡去硬编码色
- `ab397be` feat(ui): 新 Wordmark + 侧边栏重构
- `86e639f` chore: Round 1 证据链

### Phase 1 · 技术债清理（3 commit · 双 PR r1 PASS）
- `d313416` fix(ssr): 教师登录侧边栏闪烁（layout RSC + getSession + initialRole）
- `41decaa` fix: 4 项 latent bug（guards 提公共 + schedule where + 老师公告缩紧 + allSettled）
- `e810045` chore: Phase 1 证据链（+13 tests）

### Phase 2 · 学生端全体（5 commit · 四 PR r1 PASS）
- `19f8758` feat(layout): TopBar 共享 shell（面包屑 + AI 按钮 + 用户菜单）
- `47f445d` feat(student-dashboard): 问候 Hero + 4 KPI + 三列 + AI 渐变卡
- `59f06e1` feat(student-courses): summary strip + 2 列 CourseCard
- `f964094` feat(course-detail): 深色 Hero + 三列 + 三态时间线 + 6 ContentBlockType
- `424cb4a` chore: Phase 2 证据链（+32 tests）

### Phase 3 · 教师端全体（4 commit · 三 PR r1 PASS）
- `8a37422` feat(teacher-dashboard): 5 KPI + 需要关注 + 班级表现 + AI 卡
- `55ea8c1` feat(teacher-courses): 多教师头像堆叠 + 多班级徽标
- `fa750a3` feat(course-editor): UI 重皮（深色 Hero + 三列 + TOC + 只读属性面板，path A）
- `31b0921` chore: Phase 3 证据链（+17+15+14 tests = 162 累计）

### Phase SEC · 3 个 pre-existing 漏洞闭环（3 commit · 三 PR r1 PASS）
- `d74231c` fix(security): /api/lms/courses/[id] GET 权限守护（P1，PR-3C QA 独立发现）
- `ef0880c` fix(security): 系统扫描 by-id GET 补守护 8 端点（173→208 tests）
- `be09270` fix(security): write 端 owner 守护（DELETE submission / grade / content-block PUT，P1 数据破坏级，208→219 tests）

## 本 session 统计

| 指标 | 数值 |
|---|---|
| Commit 数 | 19（12 feat/refactor + 3 security fix + 4 harness chore） |
| PR 连续 PASS | **12 个 PR 全部 r1 PASS，0 FAIL，0 迭代** |
| Tests 增长 | 61 → **219**（+158） |
| 新建组件文件 | 35+ |
| 新建 util + guard 文件 | 12 |
| 新建测试文件 | 12 |
| Scope 重写页面 | 学生 4 页 + 教师 3 页 + TopBar + Sidebar + Wordmark |
| Schema 改动 | 0 |
| API 改动 | 0 新增 · 11 个 handler 加 guard · service 层零改 |
| P1 安全漏洞闭环 | 3 个 pre-existing |

## Next step — Phase 4 · 任务向导（下次 session 开始）

### 关键已知：`/teacher/tasks/new` 巨型向导

现有 ~1500 行向导（3 类任务 × 各自 config × AI 生成题目 × AI 生成主观题 × ScoringCriterion × AllocationSection/Item × QuizQuestion 4 种）

**Phase 4 预估拆分**（builder 读完源码后自行调整）：
- PR-4A · 向导壳 + Type/Basic 两步（~400 行）
- PR-4B · Config 步 simulation + quiz + subjective 三分支（~500 行）
- PR-4C · Review 步 + AI 生成题目 / 主观题接入（~400 行）
- 预计 2-3 会话做完

**数据降级（schema 零改，延续策略）**：
- AllocationItem 无 `defaultValue` 字段 → 前端默认 0
- AI 生成后的 QuizQuestion preview 若字段缺 → 占位显示
- 其他数据应该都齐全（向导是写侧，schema 健全）

### Phase 4 关联 — 合并做 block 深度编辑

PR-3C 走的 A 方案（UI 重皮，块深度编辑推迟）。Phase 4 任务向导很可能新增 `/api/lms/task-drafts` 或类似端点，到时**可一并做**：
- 6 ContentBlockType 完整 CRUD API（resource / simulation_config / quiz / subjective / custom）
- section/chapter PATCH/DELETE
- block reorder 持久化

这会让 PR-3C 右面板从"只读属性 + 占位"升级为"可交互 block editor"。但要确认用户愿意**解锁"不改 API"硬约束**（当前 Phase 3 已默认不解锁）。

## Phase 5-7 路线（再下次）

- Phase 5 · `/teacher/instances/[id]` + insights + analytics ~2 会话
- Phase 6 · Runner 外壳（Simulation/Quiz/Subjective runner 的 chrome）+ 登录页 + 空错态 ~1 会话
- Phase 7 · Simulation 对话气泡专题（产品差异化核心，设计师 Q4 留的）~1 会话

## Open decisions

1. **Phase 4 起点是否允许解锁"不改 API"硬约束** — 用户上次选 A 默认保守；任务向导本身很可能**必须**新端点（AI 生成题目的 draft 接口），触发时 Phase 4 builder 需 SendMessage 停下来问
2. **block 深度编辑** 何时合并做（Phase 4 同步做 / Phase 5 专门做 / 延后）

## Open observations（非阻塞，后续 Phase 酌情清理）

- `app/(student)/courses/[id]/page.tsx` L283 `const className` 名称冲突（Phase 2 QA 观察）
- `isBehind && totalTasks > 0` 边缘 case —— 0 任务课程显示"进度落后"徽章（Phase 2 QA 观察）
- `app/(auth)/login/page.tsx` 仍用 `from-blue-50 to-slate-100` 渐变硬编码（Round 7 登录页打磨 scope）
- `scheduleSlots.course` API 只返 `{courseTitle, classId, semesterStartDate}` 不含 `classes[]`，今日课表 className 显 null fallback 不 crash（Phase 3 QA 观察）
- `/teacher/announcements` 老师侧已缩紧（PR-1B），与设计师 Review 里提的 "announcements 缺 teacherId 分支" 问题已闭环

## Open task（独立工作线）

- 上海教师 AI 案例申报（`.harness/shanghai-ai-case-2026.md`）— 规划已锁定，11 单元 4 周时间线。默认 UI 重构完成后做

## Mockup server

Python HTTP server 仍在 `localhost:8765`（PID 59984）供 QA 对比设计稿用。**本 session 结束时保留** — 下次 session Phase 4 仍需对比设计稿；如果用户关机自然就结束。不需要强制 kill。

## Session 收尾笔记

**本 session 成功关键**：
- coordinator 写 spec 时明确了数据降级策略表，让 builder 不用反复问
- builder-p3 在 PR-3C 主动识别 spec 低估，请求决策（不硬做）
- QA 真登录 + API 数据核算 + 编译产物 grep + /cso 审计 4 层验证法，让 3 个 pre-existing P1 都被 regression sweep 捕获
- Dynamic exit 规则保证一轮 PASS 直接 ship，不做"第二轮保险起见"的 churn

**给下次 session coordinator 的建议**：
- Phase 4 第一件事：builder 先**评估**任务向导 scope，再决定拆法
- 如果发现必须改 API，立刻 SendMessage 停下来问用户是否解锁硬约束
- 不要 blindly spec "按设计稿做"——先看现状 + spec 数据降级
