# HANDOFF

> 会话结束前由 coordinator 更新本文件。新会话启动时 SessionStart hook 自动显示。

## Last completed — Phase 4 · 任务向导 + 课程编辑器完整版（2026-04-24）

本 session 是 FinSim v2 最大 session：**跨 Phase 0/1/2/3/4 五个 Phase + 3 个 SEC 安全 PR + 1 个 AUTH fix + 1 个课表日历化**。

### Phase 4 · 6 连 PASS（5 主 PR + 1 fix + env hygiene，2026-04-24）

- `53a141e` feat(task-wizard): 骨架 + Step 0/1（PR-4A）
- `e44c8e9` feat(task-wizard): Step 2 三类 config + AI 出题（PR-4B）
- `b1f730c` chore: .env.example 入仓 + AI 模型分层模板
- `66f490e` feat(task-wizard): Step 3 Review 组件（PR-4C）
- `1ad3837` fix(auth): NextAuth v5 secret 兼容（PR-AUTH-fix）
- `bcbbe4d` feat(content-blocks): 8 新端点课程编辑器后端（PR-4D1）
- `901f17f` feat(course-editor): 前端 block editor 完整版 6 种 blockType（PR-4D2）

### 本 session 总 commit 累计（26 个）

从早到晚：35d18f0 → 86e639f (Phase 0/R1 基座) → d313416 → e810045 (Phase 1) → 19f8758 → 424cb4a (Phase 2) → 8a37422 → 31b0921 (Phase 3) → d74231c → be09270 (SEC1/2/3) → 94ca2c1 (HANDOFF) → Phase 4 上述 7 个

**测试增长**：61 → **288**（+227 新测试，+372%）

**0 schema 改动**：Phase 1-3 打好的字段弹性 + Phase 4 评估确认（Chapter/Section/ContentBlock 已有 order）

**累计 PR**：**18 PR 全 r1 PASS / 0 FAIL / 0 迭代**（12 Phase 0-3 + 5 Phase 4 + 1 AUTH fix）

## Next step — Phase 5 · 实例详情 4 tabs（下 session 主战场）

### Phase 5 目标

`/teacher/instances/[id]` 页面重做，4 tabs：
- overview（交付漏斗 + 关键动作）
- submissions（提交列表 + 批改入口 + 虚拟化）
- insights（AI 洞察 · 共性问题聚合）
- analytics（数据分析 · 分布/散点/热图）

### 启动前用户需决策

在 `.harness/decisions-pending.md` 里：
- **C1 · 薄弱概念聚合路径** — 推荐路径 2（AnalysisReport 加 `conceptTags` 字段）
- **C3 · Insights AI 聚合时机** — 推荐教师手动触发
- **C4 · Analytics tab 可视化** — 已选前端 SVG 自画（Phase 3 延续）
- **A6 · AI Insights 模型** — 推荐 qwen-max + longer context
- **B6 · Subjective 批改** — 推荐 AI 建议默认显示，老师可关
- **H3 · API 解锁请求** — 新增 `/api/lms/task-instances/[id]/insights/aggregate` + AnalysisReport.conceptTags/commonIssues 字段

### Phase 5 PR 预估

- PR-5A · Shell + Overview tab（~400 行）
- PR-5B · Submissions tab + 虚拟化 + 批改 drawer（~400 行）
- PR-5C · Insights tab + 新 aggregate API（~300 行 · 依赖 H3 approve）
- PR-5D · Analytics tab · SVG 自画（~300 行）

预计 2 会话完成 Phase 5。

## Phase 6-7 路线（再下 session）

- Phase 6 · Runner 外壳（3 类共享 topbar）+ 登录 + 8 种空错态 · ~1-2 会话
- Phase 7 · Simulation 对话气泡专题 · mood + 学习伙伴 hint + 资产配置滑杆 · ~1-2 会话

## Phase 4 发现的 Phase 5+ 工作（非阻塞）

1. **P2** Chapter/Section 无 `updatedAt` 字段（ContentBlock 有）— 下个小 PR 顺手补
2. AI Dialog `courseName: taskName` prompt 语义错位（PR-4B 遗留）— 下个 PR 顺便修
3. 学生端 ContentBlock render 防御式 check（payload 是 JsonValue，绕前端可能存非 object）
4. `prisma/seed.ts` 补 CourseTeacher collab 关系让 E2E collab 路径能真测
5. PR-4D2 Builder 延后的 5 项（chapter UI / 创建 autoSelect / 拖拽 / 虚拟化 / 旧 block-property-panel 清理）
6. block-edit-panel dispatcher 有 `link` case 但 schema 无 `link` enum（dead branch + 注释 "未来扩展"）
7. SSR 角色闪烁（Phase 1 已修，但某些页面仍零星闪烁）— 下次 QA 真登录时留意

## Open task（独立工作线）

- 上海教师 AI 案例申报（`.harness/shanghai-ai-case-2026.md`）— 规划已锁定。本 session 末端用户未提及，默认放后。

## 运维状态

- Postgres `finsim-postgres-1` healthy on 5432（Docker）
- Dev server：本 session 重启 2 次，最新在 PID 59187 port 3000
- 下次 session 启动前可能需要用户确认 Docker 还活着、dev server 是否要 restart
- AUTH_SECRET / NEXTAUTH_SECRET 都能用（PR-AUTH-fix 保证兼容）

## 用户决策记录

本 session 用户给过的关键决策：
- 设计方向 approve（深靛/象牙/暖赭）
- Dark mode 保留（方案 A）
- Phase 3 教师课程编辑器 Path A 保守 → 后来 G2 同意升级 Path 完整版（Phase 4 PR-4D1/D2 落地）
- H1 API 解锁同意（Phase 4 新增 8 端点落地）
- AI 模型：qwen-max（高价值场景：Sim/TaskDraft/Insights）+ qwen3.5-plus（高频场景：Evaluation/StudyBuddy）+ 低置信度复合校验（用户说的"3.6 plus"实为 3.5 plus，最强型号是 qwen-max 或 qwen3-max）
- B4 批改输出 confidence 0-1
- 其他全走 coordinator 推荐
- "对效果影响大且最终需求不确定"的 builder 主动问

## Session 收尾

**本 session 超高产**：26 commit · 18 PR 全一次过 PASS · 0 FAIL · 0 回滚 · 227 新测试 · 0 schema 改动 · 3 个 pre-existing P1 安全漏洞闭环 · OWASP+STRIDE 全通过

**给下 session coordinator 的建议**：
1. 开工前检查 DB + dev server 状态（`docker ps` + `lsof :3000`）
2. 读完 `decisions-pending.md` 并让用户回 Phase 5 那批决策（C1/C3/H3/A6/B6）
3. 读 Phase 5 的 spec section（`teacher-instance-detail.jsx` + `teacher-instance-detail-tabs.jsx` 1109 行）
4. Phase 5 PR-5C 若 user approve H3，会新增 `conceptTags`/`commonIssues` 字段到 AnalysisReport — Prisma 三步必跑
