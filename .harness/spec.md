# Spec — Phase 7 · Simulation 对话气泡专题（2026-04-25）

## 用户决策（全走推荐，已锁定）

用户："Phase 7 全走推荐，结束后我统一验收"。8 个决策按 `decisions-pending.md` 推荐 apply：

| ID | 决策 | 锁定值 |
|---|---|---|
| **A1** | Simulation 对话 provider | `qwen-max` |
| **A7** | Mood 推断 provider | 与 A1 同一调用（每轮 AI response 顺带输出，省 token） |
| **B1** | 客户人设顽固度 | 中等顽固（学生需说服才改观点）+ 隐性需求需追问才暴露 |
| **B2** | Mood 维度 + 档数 | 单维 0-1 · 8 档：`平静/放松/兴奋/犹豫/怀疑/略焦虑/焦虑/失望` · 阈值 `[0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.85, 0.95]` |
| **B3** | 学习伙伴 hint 触发规则 | (`student_perf < 0.5` OR `偏离评分维度 ≥ 1`) AND `距上次 hint ≥ 3 轮` |
| **D1** | Mood 8 档文案 | 沿用 B2 |
| **D2** | Hint 范文形式 | Socratic 追问（"客户提到 X，暗示了什么？试试追问"）|
| **H2** | API 解锁 | messages 加 `mood` + `hint?` 字段 · AnalysisReport 加 `moodTimeline` + `allocationSnapshots` |

## 背景

- Phase 0-6 全 commit 落地（main HEAD=bea2431，36 commit · 24 PR r1 PASS · 366 tests · 4 P1 SEC 闭环）
- 设计源 `mockups/design/student-sim-runner.jsx`（567 行）+ `student-quiz-subj-runner.jsx`
- DB + dev server 活（fresh restart on 3000，login HTTP 200 已验证）

## Phase 7 · 3 PR 拆分（预计 1-2 会话）

### PR-7A · Simulation Runner 视觉重做（~450 行，纯前端）

**目标**：按 `student-sim-runner.jsx` 三列布局重做。**仅视觉 + 占位 mood/hint UI（mock 数据）**，不动 AI 调用 / state / handlers / submit。

**改动**：
- `components/simulation/simulation-runner.tsx` 重构为三列：
  - 左 280px 客户档案 card（profile + 场景要求 + 评分指引折叠）
  - 中 flex 气泡区（AI/学生消息 + 输入框 · 圆角时间戳头像）
  - 右 320px 资产配置滑杆 + 轮数 + 提交
- 气泡支持 `mood`（8 档高亮 chip 占位）+ `hint`（紫色左边框卡占位）
- topbar 复用 PR-6C runner-topbar

**不做**：AI API / schema / state / handlers / 滑杆持久化（PR-7B/C）

**Acceptance**：student1 真登录三列布局对齐稿；mock UI 显示；真发消息 AI 回复路径不破；tsc+vitest+build 过

### PR-7B · Mood + Hint AI 真接入（~400 行，schema 改动）

**Schema 改动**（PR-7B 改前 SendMessage 给 team-lead）：
```prisma
model AnalysisReport {
  ...
  moodTimeline   Json?    // [{turn, score, label}]
}
```

**Prisma 三步严格**：migrate dev → generate → kill 3000 + npm run dev + curl 200 + 真访问 /sim/[id] 200

**API**：
- `POST /api/instances/:id/messages` 响应加 `mood: {score, delta, label}` + `hint?: string`
- AI prompt 升级：要求输出 JSON `{ response, mood_score:0-1, mood_label, student_perf:0-1, deviated_dimensions[] }`
- 后端解析 → 写 mood / 按 B3 规则生成 hint / 追加 moodTimeline
- Provider: `AI_SIMULATION_MODEL=qwen-max`

**前端**：真 mood chip（8 档色）+ hint 卡（紫边可关闭）+ topbar mood meter 真数据

**Acceptance**：Prisma 三步完整；真 AI E2E mood label 在 8 档；moodTimeline 持久化；偏离触发 hint 间距 ≥3 轮；/cso 通过

**容忍度**：真 AI prompt 调试可能 r2/r3，3 轮同 FAIL 才回 spec

### PR-7C · 资产配置滑杆持久化（~250 行，schema 改动）

**Schema 改动**（PR-7C 改前 SendMessage 给 team-lead）：
```prisma
model AnalysisReport {
  ...
  allocationSnapshots  Json[]  @default([])  // [{turn, ts, allocations: [{label,value}]}]
}
```

**Prisma 三步严格**（同 PR-7B 模式）

**改动**：
- 滑杆 onChange → debounce 2s → `PATCH /api/instances/:id` 保存 draft
- "记录当前配比"按钮 → snapshot 到 `allocationSnapshots`
- AI 评分 prompt 加"参考资产配置演变"指令（隐性工作）

**Acceptance**：debounce 真生效（多拖 1 PATCH）；snapshot 入库；刷新 draft 还原；tsc+vitest+build 过

## Risks

- AI prompt 调试 r1 不一定一次过（允许 r2/r3）
- Schema 改动 2 次 → Prisma 三步 2 次 → dev server 重启 2 次
- mood/hint 触发克制（B3 规则严格）
- Anti-regression：Sim 内部交互 byte-equivalent（沿用 PR-6C 先例）
- 成本守护：mood 顺带 AI 输出（不增调用次数）

## 执行策略

- 单 team fresh agents `builder-p7` + `qa-p7`
- Task 链：72→73→74
- 每 PR PASS auto-commit
- PR-7B/7C schema 改动前 SendMessage 给 team-lead
- 用户已声明全走推荐 + session 末统一验收，coordinator 不再问决策

## Phase 7 完成后 = UI 重构 100% 收官

后续仅 Phase 8（软结尾，可选）：50+ inline 空态迁移 / AI 助手页骨架 / Sim Runner -bright token 变体 / AI Dialog courseName 修 / Subjective SavedChip state / 上海教师 AI 案例申报。
