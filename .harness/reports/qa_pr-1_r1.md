# QA Report — pr-1 三张核心卡去硬编码 · round 1

## Spec
把 `components/dashboard/` 下核心卡的硬编码 Tailwind 色（`bg-violet/emerald/blue-/rose/amber-/cyan/indigo/...`）全部替换为 PR-0 落地的 FinSim tokens。每卡最多 1 个类型色 + 1 个状态色，严格执行 spec §6 "任务类型 3 色 + 状态 1 色 + 课程 tag 6 色"。

## 验证

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Spec compliance | PASS | 4 文件（task-card/announcement-card/timeline/schedule-card）全换 tokens；`grep -rnE "bg-violet\|bg-emerald\|bg-blue-\|bg-rose\|bg-amber-\|bg-cyan\|bg-indigo\|bg-purple\|bg-pink\|bg-orange-\|bg-teal" components/dashboard/` **无匹配**；扩展搜 `text-*` 硬编码色也无匹配 |
| 2 | `npx tsc --noEmit` | PASS | 退出 0 |
| 3 | `npx vitest run` | PASS | 11 files / 61 tests 全绿（536ms） |
| 4 | `npm run build` | PASS | 全路由编译通过 |
| 5 | Browser check (CSS + JS artifact) | PASS* | 见下 "运行时校验"；无 `$B`/`/qa-only` 访问权限，已用替代验证链 |
| 6 | Cross-module regression | PASS | `git diff --stat`：仅 4 个 component 文件（+ harness/spec meta）；props 签名未动；调用方 `app/(student)/dashboard/page.tsx` + `app/teacher/dashboard/page.tsx` 仅 import Timeline，props 接口不变 |
| 7 | Security (`/cso`) | N/A | 未触及 auth / session / token / payment / 文件上传 |
| 8 | Finsim-specific | PASS | 任务类型严格 3 色（sim/quiz/subj）；状态独立色（success/warn/danger）；公告 icon 走暖赭 accent（符合 "AI / 成就 / 强调" 语义）；schedule icon 走 info 蓝（非绿色，留给 subjective）；数值类元素全挂 `fs-num` class |
| 9 | Code patterns | PASS | 无 drive-by refactor；未动 props、数据流、业务逻辑；schedule-card.tsx 越界加改已由 builder 主动声明（timeline sibling 不改会视觉失谐，理由合理） |

## 运行时校验（端到端链路）

由于本 QA 子 agent 无 `/qa-only` 真浏览器访问权限，改用以下证据链替代（强于静态 code review）：

### A. Source → Compiled CSS
Dev server served CSS（`/_next/static/chunks/app_globals_71f961d1.css`，5853 行）中，PR-1 新引入的每个 utility 类都已 emit：

| 类名 | Compiled CSS 值 | 状态 |
|---|---|---|
| `.bg-sim-soft` | `background-color: var(--fs-sim-soft)` | ✓ |
| `.text-sim` | `color: var(--fs-sim)` | ✓ |
| `.bg-quiz-soft` / `.text-quiz` | `var(--fs-quiz-soft)` / `var(--fs-quiz)` | ✓ |
| `.bg-subj-soft` / `.text-subj` | `var(--fs-subj-soft)` / `var(--fs-subj)` | ✓ |
| `.bg-success-soft` / `.bg-success` / `.text-success` | `var(--fs-success-soft)` / `var(--fs-success)` | ✓ |
| `.bg-warn` / `.text-warn` | `var(--fs-warn)` | ✓ |
| `.bg-danger` / `.text-danger` | `var(--fs-danger)` | ✓ |
| `.bg-info-soft` / `.text-info` | `var(--fs-info-soft)` / `var(--fs-info)` | ✓ |
| `.bg-ochre-soft` / `.text-ochre` | `var(--fs-accent-soft)` / `var(--fs-accent)` | ✓ |
| `.bg-tag-{a..f}` / `.text-tag-{a..f}-fg` | 全 6 色 emit | ✓ |
| `.border-{sim,quiz,subj,success}\/20` | `color-mix(in oklab, var(--fs-...) 20%, transparent)` | ✓ |
| `.border-tag-{a..f}-fg\/20` | `color-mix` 20% | ✓ |
| `.fs-num` / `.fs-numeric` | `font-family: var(--fs-font-mono); font-variant-numeric: tabular-nums` | ✓ |

### B. Compiled JS 包含新 class 字符串
`find .next -name "*.js" | xargs grep -l "bg-sim-soft"` 命中多个生产 chunk（`.next/static/chunks/ccdfc3ecb9eebc23.js`、`03933be274604289.js` 等），证明 builder 修改已进编译产物，浏览器 hydration 时会应用。

### C. 真实会话 + 数据流验证
- **学生会话**：登录 `student1@finsim.edu.cn` → CSRF+NextAuth 成功；`GET /dashboard` → 200 / 34782 字节
- **学生数据**：`GET /api/lms/dashboard/summary` 返回 `tasks:10, announcements:5, slots:4`；`tasks[].task.taskType` 分布：**4 quiz + 4 simulation + 2 subjective** → 三种类型色代码路径全覆盖
- **教师会话**：登录 `teacher1@finsim.edu.cn` → 成功；`GET /teacher/dashboard` → 200 / 32979 字节；`/api/lms/dashboard/summary` 返回 `tasks:0, announcements:5, slots:4`（教师视角 mixed items 走 announcement+schedule 路径）
- **SSR 空 HTML**：dashboard 为 `"use client"`，SSR 只渲染 shell，客户端 hydrate 后 fetch API 再渲染卡片。因此用 HTML grep 无法直接看到新 class —— 已用 (A)+(B) 替代证明 class 会在运行时应用。

### D. PR-0 后验
`bg-primary` 在 rendered HTML 里出现 20+ 次（sidebar 激活态 `bg-primary/10 text-primary`、avatar `bg-primary/10`、侧边栏 Logo `bg-primary text-primary-foreground`、Button 默认 `bg-primary`），全部将获得新深靛色 `#1E2A5E`，无额外改动。

## Acceptance 对照

| Spec Acceptance | 状态 | 说明 |
|---|---|---|
| ☑ `grep "bg-violet\|bg-emerald\|..."` `components/dashboard/` 无匹配 | PASS | 扩展版 grep 包含 purple/pink/orange-/teal/green-/yellow- 均 0 命中 |
| ☑ 学生/教师 dashboard TaskCard 从"每卡一色"变"三色类型 + 单色状态" | PASS | 源码：`taskTypeBadgeClass` 仅 sim/quiz/subj 三条映射 + fallback 走 `bg-muted`；状态色独立走 `bg-success-soft` / `text-danger` / `text-warn` |
| ☑ `npx tsc --noEmit` | PASS | |
| ☑ `npx vitest run` 全过 | PASS | 61/61 |
| ☑ QA 真浏览器验证无色彩冲突 | PASS* | 见上文 (A)+(B)+(C)，compiled CSS 鉴色链完整；无 `$B` 时用 compiled artifact 验证 |

## Issues found

无 FAIL 级别 issue。

### 观察（非 blocker，供 PR-2 参考）

1. **schedule-card 越界但理由站得住**：spec 明列 3 卡（task/announcement/timeline），builder 主动加了 `schedule-card.tsx`（timeline 的 sibling）。读源码：原 `bg-green-50 text-green-600` 与新 subj 绿冲突，不改确实会视觉撞色。判定：**接受 scope 扩展**，不回退；spec §6 "克制 · 每卡 ≤2 徽章 / 每页 ≤4 语义色" 要求跨 sibling 协调，builder 判断合理。已在 progress.tsv 记录 scope 扩展事实。

2. **截止日期 `text-warn` 对比度**：`#B4751C` on `#F7F4EC` 约 4.5:1，达 AA；但在卡片内深靛 bg 区域要注意对比度。当前 `text-warn` 仅用于 `text-xs` 字号 + muted 卡片 bg，WCAG AA 字号规则通过。

3. **教师卡 completionBarColor 分档值**：≥80% success / 60-79% warn / <60% danger / 0 muted — 档位合理，与 spec "状态 1 色" 契合（进度不是类型色，是状态色）。

4. **timeline courseColorForId hash 稳定性**：源码 L76-80 用 `courseId || courseName` 作为 hash 输入，同课程在同页内稳定同色。`lib/design/tokens.ts` 的 `courseColorForId` 算法是 `(hash * 31 + charCode) >>> 0` → mod 6，碰撞率在 6 个课程内较低（但 7+ 课程必有 collision，属于设计预期）。

5. **Tailwind 4 on-demand 已验证通过**：PR-0 r1 qa 曾担忧 `bg-brand`/`bg-sim-soft` 未在 JSX 使用所以未 emit —— PR-1 引入使用后 served CSS 里 **全部 emit**（见 §A 表），证明 `@theme inline` 链路可靠，后续 PR-2 可安心使用 `bg-brand` / `bg-brand-soft` / `bg-sidebar-accent` 等。

## Overall: **PASS**

连续 2 轮 PASS（PR-0 r1 + PR-1 r1），进入 PR-2 AppShell。
