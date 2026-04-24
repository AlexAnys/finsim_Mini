# Spec — Phase 1 · 技术债清理（2026-04-24）

## 背景

Round 1 设计系统基座已 commit 落地（commits 35d18f0 → 86e639f）。开始按 6-Phase 完整路线图推进，本 Phase 聚焦清理进入大面积视觉重构前的遗留问题。

## 两个独立 PR（单 team 串行，独立报告独立 commit）

### PR-1A · SSR 角色闪烁修复（~200 行）

**问题**：教师登录后首次 SSR HTML 渲染学生 nav（`section label` = "学习空间"、`navItems` = 学生版），hydration 后由 `useSession` 切成教师版。视觉跳变。

**根因**：`SessionProvider` 在 `components/providers.tsx` 是 client-side，SSR 阶段 `useSession().data === null`，`role` undefined，`getNavItems` / `getSectionLabel` fallback 到 student。

**改动**：
- `app/(student)/layout.tsx` + `app/teacher/layout.tsx` 改为 Server Component，用 `getServerSession(authOptions)` 在 server 端解析 role
- `components/sidebar.tsx` 新增 `initialRole?: "student" | "teacher" | "admin"` prop，作为 `useSession` 加载前的初始值
- `useSession` 保留给 hydration 后的状态更新（登出等场景），不破坏任何现有行为

**不做**：
- 不改登录/登出/会话存储逻辑
- 不改任何 API endpoint
- 不改 nav items 数组内容
- 不动 providers.tsx 的 SessionProvider 包装（它仍负责 client 侧 hooks）

**Acceptance**：
- [ ] 真登录 `teacher1@finsim.edu.cn`，`curl` 抓 `/teacher/dashboard` 首 SSR HTML，grep 到 "教师工作台"（不是 "学习空间"）
- [ ] 真登录 `student1@finsim.edu.cn`，首 SSR 仍然 "学习空间"
- [ ] `npx tsc --noEmit` + `vitest run` + `npm run build` 全过
- [ ] 退出登录 → `/login` → 重新登录流程不破坏

### PR-1B · 历史 latent bug 清理（~300 行）

**来源**：过往 Ultrareview + PR-calendar QA 识别的非阻塞观察。一次性清掉。

**改动**：
1. **`assertCourseAccess` 提公共**：当前重复存在于 `app/api/lms/courses/[id]/route.ts` 和 `app/api/lms/classes/route.ts`。提到 `lib/auth/guards.ts`，两处改为 import。如两份实现有语义差异，选更严格的；如完全一致，直接合并。
2. **`schedule.service` 同名 key 覆盖 bug**：`lib/services/schedule.service.ts` 里 `classId` 和 `teacherId` 过滤分支各自 spread 同名 `course` key。当前 caller 互斥不会触发，但显式隐患。按两分支独立 where clause 重写。
3. **老师侧公告范围缺 `teacherId` 分支**：`lib/services/announcement.service.ts` 老师侧当前会看到全系统公告。加 `teacherId` 过滤（只看自己 creator 或自己 CourseTeacher 的课公告）。
4. **`CourseAnalyticsTab` 错误隔离**：`components/course/course-analytics-tab.tsx` 当前 `Promise.all` 一个失败整 tab 坏。改 `Promise.allSettled` + 单独卡片级降级显示。

**不做**：
- 不改 schema
- 不加新功能
- 不改 API 响应 shape（外部 caller 不受影响）

**Acceptance**：
- [ ] `assertCourseAccess` 全仓 grep 只在 `lib/auth/guards.ts` 有实现，其他地方都 import
- [ ] `schedule.service` 两分支 where clause 独立（代码审查 diff 可读）
- [ ] 真登录教师 `/teacher/announcements`，只能看到自己课的公告（或 CourseTeacher 身份的课）
- [ ] CourseAnalyticsTab 其中一个子 fetch 挂掉时，其他卡片仍正常显示
- [ ] `tsc` + `vitest` + `build` 全过
- [ ] 新增/修改 tests：`assertCourseAccess` 单测 + 老师公告范围单测 + allSettled 分支单测（至少 3 个新测试）

## Risks

- **Layout RSC 化**：如果 layout 现有 "use client" 或依赖 client hook，可能需要抽一层 client wrapper（`<LayoutShell>`）承接 client 交互。builder 判断。
- **`assertCourseAccess` 两份差异**：合并前先 diff，若语义不同需要标记决策给 coordinator 看。
- **公告范围变更**：老师侧公告可见性变窄 — 现有测试（如果有）可能需要同步更新。这是预期行为变化，不是 regression，但需要 QA 确认测试反映的是"新的正确行为"。
- **Prisma 三步**：本 Phase 不改 schema，不涉及。

## 执行策略

- 单 team `finsim-phase-1`
- Tasks：#1 PR-1A / #2 PR-1B（#2 blockedBy #1 — 避免文件冲突，尤其是 guards.ts 可能被两 PR 都 touch）
- Builder 串行做，独立 commit，独立报告（`build_pr-1a_r1.md` / `build_pr-1b_r1.md`）
- QA 跑完每个 PR 追加 progress.tsv 一行
- 两 PR 全 PASS 后 coordinator 自动 commit 两发，然后进入 Phase 2

## Phase 1 完成后自动进入 Phase 2 — 不停不问

用户已明确指示 "自动 commit 然后迭代到最后"。coordinator 在 Phase 1 两 PR 完成后：
1. 按"一个 PR 一 commit"自动 commit 两发
2. 更新 HANDOFF
3. 立即写 Phase 2 spec（学生 dashboard + /courses + /courses/[id] + TopBar shell）并启动新 team
4. 每次 Phase 边界都更新 HANDOFF，本 session 无论推进到哪 Phase，下次都能续上
