# QA Report — PR-7A · Simulation Runner 视觉重做 r1

**Owner**: qa-p7 · **Date**: 2026-04-26 00:05Z · **Build report ref**: `.harness/reports/build_pr-7a_r1.md`

## Spec: 按 `mockups/design/student-sim-runner.jsx` 重做学生 Simulation Runner 主视图，仅换视觉外壳，所有 state / handler / API 调用 byte-equivalent。Mood + Hint AI 留 PR-7B；持久化留 PR-7C。

## 验证结果矩阵

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | **PASS** | 单文件 `components/simulation/simulation-runner.tsx` +835/-246 净 +589；零 schema / 零 API / 零 service / 零 layout 改动；`mockups/design/student-sim-runner.jsx` 三列 + 8 段 mood meter + 场景 callout + AI/Student 圆角 + donut + 滑杆 + 双 CTA 设计源全 1:1 落地 |
| 2. tsc --noEmit | **PASS** | exit 0 无输出 |
| 3. vitest run | **PASS** | 366/366 PASS · 1.62s · 与基线一致 |
| 4. Browser (`/qa-only`) | **PASS** | 真登录 student1 → /sim/{simInstance} 200；snapshot 三列布局完整 (LEFT 280 背景情景+对话目标+评分对照 / MID flex 场景+气泡+composer / RIGHT 320 donut+5 滑杆+重置/记录)；console 0 错误；POST `/api/ai/chat` 200 3573ms 真 AI 回复合理；handleRedo 后 localStorage messages=[] mood=NEUTRAL allocations 全 0；100% chip bg=rgb(220,242,232) 浅绿 fg=rgb(10,90,66) 深绿；0% chip bg=rgb(251,239,212) 暖赭 fg=rgb(180,117,28) 深暖赭 — chip dispatch 正确；截图 `/tmp/qa-7a-sim-initial.png` `/tmp/qa-7a-full-100.png` `/tmp/qa-7a-mobile.png` |
| 5. Cross-module regression | **PASS** | 9 路由真登录 cookie regression 全 200（5 student：/dashboard /courses /grades /tasks/{sim} /sim/{sim}；4 teacher：/teacher/dashboard /courses /instances /tasks）；API contract `/api/lms/task-instances/{id}` 字段集与 PR-5A baseline byte-equivalent（top-level 24 keys + task 17 keys 全保留） |
| 6. Security (/cso) | **N/A** | client component 改造，零 server / 零 API / 零 schema / 零 auth 触面 — STRIDE/OWASP 不命中 |
| 7. Finsim-specific | **PASS** | 中文 UI 16 处新文案命中；英文用户可见错误 0；4 处 throw Error 全中文（AI 回复失败/评估失败/提交失败/提交失败）；client component 不需 requireAuth；API response format 不动；prod build 25 routes 全成功；prod chunk `_next/server/chunks/ssr/app_(simulation)_sim_[id]_page_tsx_*.js` grep 12/12 文案命中（客户情绪 2 / 为客户配资产 2 / 背景情景 1 / 对话目标 1 / 评分对照 1 / 场景 1 / 继续对话 1 / 结束对话 1 / 学习伙伴 1 / 资产配比图 1 / 重来 1 / 重置 1） |
| 8. Code patterns (anti-regression) | **PASS** | 7 核心 handler 字节级 EQ：handleSend 1475B / handleAllocationChange 397B / handleSubmitAllocation 360B / handleFinishConversation 2309B / handleSubmit 989B / handleRedo 452B / parseMoodFromText 463B；messages init useState 376B EQ；DRAFT_KEY_PREFIX 常量同；4 API endpoint 同（`/api/ai/chat` / `/api/ai/evaluate` / `/api/submissions` ×2）；新增 `handleResetAllocation` 仅本 PR 引入，使用与 handleRedo 相同 default reset 逻辑，不重置 submitCount，不污染其他 caller |

## byte-equivalent audit 详情（spec 关键守护）

```
=== handleSend ===              orig 1475B / 53 lines  EQ
=== handleAllocationChange ===  orig 397B  / 14 lines  EQ
=== handleSubmitAllocation ===  orig 360B  / 11 lines  EQ
=== handleFinishConversation === orig 2309B / 67 lines EQ
=== handleSubmit ===            orig 989B  / 36 lines  EQ
=== handleRedo ===              orig 452B  / 17 lines  EQ
=== parseMoodFromText ===       orig 463B  / 12 lines  EQ
=== messages init slice ===     orig 376B EQ
```

## 真 AI E2E 闭环

学生输入"您好，我帮您分析下您的需求。请问您的投资期限是多久？" → POST /api/ai/chat 200 3573ms 231B → AI 回复"我主要是为了孩子三年后出国留学准备的，所以这笔钱大概得在三年内用上。我不太敢冒太大风险..."（与 system prompt 王女士人设一致）→ 1 轮计数器更新 → AI bubble 下"情绪 犹豫"chip 显示 → console 0 错误。

## 真交互测试

- **滑杆拖动**：5 滑杆通过 `fill @eN value` 设到 30/20/20/20/10 → 合计 100% → chip 转绿（rgb(220,242,232)/rgb(10,90,66)），donut 中心 "100%" 显示，5 段彩色 + 5 项 legend 正确
- **重置按钮**：点 @e31（重置）→ 5 滑杆全 0 → 合计 0% → chip 转暖赭（rgb(251,239,212)/rgb(180,117,28)），不影响 submitCount
- **重来按钮**：点 @e2（重来）→ messages [] / mood NEUTRAL / allocations 全 0 / submitCount 0；localStorage `finsim_sim_draft_*` 重新保存空 state；inputValue 不重置（原版 byte-equivalent 行为）

## Issues found

无 P0/P1。

## Observations（非阻塞）

1. **移动端 375 不折叠**：三列固定宽 280+flex+320 → 375 viewport 横向滚动 — spec L96 未要求 mobile 响应；与 HANDOFF L80 + PR-6C 先例一致；留 Phase 8/9 增量。
2. **DONUT_COLORS 6 色硬编码**（builder report L134 自报）：来自设计源 verbatim 的分类调色板，token 系统缺"分类色"语义；同 PR-6C 4 处先例；留 token 扩展时收编。
3. **Mood meter 8 槽 3 槽 PLACEHOLDER**（builder report L130）：当前 5 档 MoodType 映射到 8 档，留 PR-7B schema 扩展真填 8 档 enum 后补满。
4. **真"客户档案"卡 / 倒计时 / composer 左下 3 图标按钮 deferred**（builder report L142-148）：spec 范围内合理 deferred，PR-7C / Phase 8 衔接。

## Overall: **PASS**

PR-7A r1 通过 byte-equivalent + 真 AI E2E + chip dispatch + 9 路由 regression 全核验。建议 commit 并启动 PR-7B（schema + Prisma 三步 + AI 真 mood/hint）。
