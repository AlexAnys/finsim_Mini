# Spec — Phase 6 · Runner 外壳 + 登录 + 8 空错态（2026-04-25）

## 背景

- Phase 0-5 全 commit 落地（main HEAD=54987e0，32 commit · 23 PR r1 PASS · 366 tests · 4 P1 安全闭环 · 1 schema 改动成功 · 真 AI 调用闭环）
- 设计稿参考：
  - `mockups/design/auth-states.jsx`（登录 + 8 种空错态）
  - `mockups/design/student-sim-runner.jsx`（Sim Runner 顶栏 + 三列）
  - `mockups/design/student-quiz-subj-runner.jsx`（Quiz / Subjective Runner）

## 用户决策（按推荐锁定）

- **D4** 空态文案：8 种全做（404 / 500 / 403 / 登录超时 / 维护中 / 无数据 / 搜索无结果 / 网络错误）
- **Q3** Runner 外壳：只换 chrome tokens，内部交互不动（CLAUDE.md anti-regression）

## Phase 6 · 3 PR 拆分（预计 1-2 会话）

### PR-6A · 登录 + 注册页重设计（~300 行）

**目标**：按 `auth-states.jsx` 的 LoginPage 重做 `/login` + `/register`。

**改动**：
- `app/(auth)/login/page.tsx` 重设计：
  - 去掉硬编码 `from-blue-50 to-slate-100` 渐变（Phase 1 QA 观察）
  - 左侧品牌区（深靛 bg + Wordmark + 一句 tagline）
  - 右侧 form（角色 chip 选择 student/teacher + email + password + signin button）
  - 错误状态：账号/密码错误 inline error
- `app/(auth)/register/page.tsx` 同样风格

**不做**：
- 不改 NextAuth credentials provider 逻辑
- 不改任何 auth API
- 不加新角色

**Acceptance**：
- 真访问 `/login` 看到新视觉（深靛/象牙/暖赭）
- 真登录 student1/teacher1 流程通（沿用 PR-AUTH-fix）
- 错误提示中文
- 移动端 375px 响应式
- tsc + vitest + build

### PR-6B · 8 种空错态组件 + boundary 挂载（~400 行）

**目标**：建立全局空错态 UI 标准，挂到对应路由 error boundary / not-found boundary。

**新建 `components/states/`**：
- `state-card.tsx`（基础容器：插画/icon + 标题 + 描述 + 主 CTA + 备选 CTA）
- `not-found.tsx`（404 — "页面不见了"）
- `server-error.tsx`（500 — "服务器开小差"）
- `forbidden.tsx`（403 — "你没有权限访问"）
- `session-timeout.tsx`（"登录已过期，请重新登录"）
- `maintenance.tsx`（"系统升级维护中"）
- `empty-list.tsx`（通用 — "暂无数据，开始添加第一项"）
- `no-search-result.tsx`（搜索无结果）
- `network-error.tsx`（网络错误，"重试" CTA）

**挂载**：
- `app/not-found.tsx`（root 404）
- `app/error.tsx`（root error boundary）
- `app/(auth)/error.tsx`（auth 路由组 error）
- 学生 + 教师 layout 的 not-found / error 各一份
- 各 page 用现有 list/search 时复用 `empty-list` / `no-search-result`

**视觉**：
- 设计稿 `auth-states.jsx` 的 StateGallery 展示 8 种 hi-fi
- 所有 state 必须有：插画/icon + 标题 + 描述 + 主 CTA + 备选 CTA（设计师硬约束）
- 中文文案 + 克制配色（深靛/暖赭/象牙）

**Acceptance**：
- `/this-page-doesnt-exist` 返回新 404
- 故意触发 500 看到新 error 页（throw in dev）
- 学生访问教师页面 → 403 状态
- 网络错误模拟（DevTools 离线）触发 network-error
- 8 种 state 都有插画 / icon（不是空盒子）
- tsc + vitest + build

### PR-6C · Runner 外壳统一 topbar（~250 行）

**目标**：3 个 Runner（Simulation / Quiz / Subjective）共享 chrome（56px 黑色顶栏）。**仅换 chrome，内部交互完全不动**。

**改动**：
- 新建 `components/runner/runner-topbar.tsx`：
  - 56px 高 · 黑色 bg `T.ink` · 白色 fg
  - 左：返回按钮 + 任务名 + 课程/章节
  - 中：状态 meta（轮数 / 倒计时 / 题目进度等，按 Runner 类型 dispatch）
  - 右：重来 / 结束/提交 button
- 让 3 个 Runner 复用：
  - `components/simulation/simulation-runner.tsx`
  - `components/quiz/quiz-runner.tsx`
  - `components/subjective-runner.tsx`（如存在）
- Runner 内部 state / handlers / submit logic 不动

**Acceptance**：
- 三类 Runner 顶栏统一视觉（56px 黑色）
- 学生真做一份 quiz / simulation 提交流程不破（PR-AUTH-fix E2E 模式）
- 内部交互（气泡 / 滑杆 / 计时）完全不动
- tsc + vitest + build

## Risks

- **Auth pages 改动 + auth flow 不破坏**：PR-AUTH-fix 已稳，此处仅改视觉，但 form submit 路径不能动
- **8 种空错态 boundary 挂载**：可能影响现有页面错误显示（默认 Next.js error 替换为新组件）— 测试已有 page 跑通
- **Runner topbar dispatch**：3 类 Runner 的状态 meta 不同（simulation 看轮数 / quiz 看题目 / subjective 看字数），topbar 要 dispatch 不要写死
- **不改 schema / 不改 API**：Phase 6 全部前端 + boundary 文件，零 server 改动

## 执行策略

- 单 team 复用（new fresh agents `builder-p6` + `qa-p6`，phase-5 agents shutdown）
- Task 链：PR-6A → 6B → 6C
- 每 PR PASS auto-commit
- 本 session 目标：完成全部 Phase 6 后 HANDOFF 续 Phase 7（Simulation 对话气泡专题）

## Phase 7 预告（Phase 6 完成后）

- Simulation 对话气泡专题（产品差异化核心）
- mood + 学习伙伴 hint + 资产配置滑杆持久化
- 依赖决策：A1/A7（mood AI provider）/ B1/B2/B3（人设 + mood + hint prompt）/ D1/D2（mood 文案 + hint 范文）/ H2（API 解锁 mood/hint 字段）
- Phase 7 启动前 coordinator 会让用户回答这批决策
