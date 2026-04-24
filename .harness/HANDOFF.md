# HANDOFF

> 会话结束前由 coordinator 更新本文件。新会话启动时 SessionStart hook 自动显示。

## Last completed — Round 1 · 设计系统基座三 PR（2026-04-23）

用户拿到 claude.ai/design 的高保真重设计稿（深靛 #1E2A5E / 米象牙 #F7F4EC / 暖赭 #C48A3C），批准直接落地。设计源复制到 `.harness/mockups/`。

Round 1 三 PR 全部**一轮过 PASS**（无迭代 / 无 FAIL），dynamic exit 生效：

| PR | 文件 | 净增 | 报告 |
|---|---|---|---|
| PR-0 · Design Tokens 落地 | `app/globals.css` + `lib/design/tokens.ts`（新） | ~200 | `reports/build_pr-0_r1.md` + `qa_pr-0_r1.md` |
| PR-1 · 三（+1）张核心卡去硬编码 | `components/dashboard/{task-card,announcement-card,timeline,schedule-card}.tsx` | ~90 | `reports/build_pr-1_r1.md` + `qa_pr-1_r1.md` |
| PR-2 · AppShell + Sidebar + Wordmark | `components/sidebar.tsx` 重写 · `components/ui/wordmark.tsx`（新）· 两个 layout 宽度 | ~150 | `reports/build_pr-2_r1.md` + `qa_pr-2_r1.md` |

**关键技术决策**（Round 2+ 参考）：
- Tailwind 4 `@theme inline` 写法，所有 FS token 在 globals.css 一处定义
- shadcn `--primary` / `--accent` / `--sidebar-*` 全映射到 `--fs-*`，现有组件自动获新色
- Dark mode 基于深靛 lift：primary `#7B8CD9`、bg 深中性、accent `#D9A257`
- 课程色用 `courseColorForId(id)` hash 稳定分配 6 色（`lib/design/tokens.ts`）
- QA 验证法升级：除 tsc/vitest/build，还 grep `.next/static/chunks/*.js` 编译产物 + 真登录 API 取 task type 分布确认三色路径

## Next step — 用户侧收官（2 步）

### 1. Commit 策略（推荐 3 commit + 1 chore）

当前 git status：10 modified + 3 untracked（`wordmark.tsx` / `lib/design/` / `.harness/{reports,mockups}`）

**先把 mockups 设计源排除出仓**（57KB 离线设计文件不该进 main）：
```bash
echo ".harness/mockups/" >> .gitignore
```

```bash
# Commit 1 · PR-0 Tokens
git add app/globals.css lib/design/tokens.ts .gitignore
git commit -m "$(cat <<'EOF'
feat(design): 落地 FinSim v2 设计 tokens（深靛/象牙/暖赭 + dark 适配）

- app/globals.css: 替换 shadcn 默认蓝紫为 FinSim canonical tokens
  · 浅色：primary #1E2A5E / bg #F7F4EC / accent #C48A3C
  · 深色：primary lift #7B8CD9 / bg #0F1118 / accent #D9A257
  · 新增 --fs-* 语义 token：sim/quiz/subj/tag-a~f/success/warn/danger/info
  · Tailwind 4 @theme inline 映射齐全，.fs-num utility (tabular-nums)
- lib/design/tokens.ts: JS 镜像 + courseColorForId(id) hash helper

QA: 61/61 tests, tsc+build 过, served CSS 6 色全命中

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# Commit 2 · PR-1 核心卡去硬编码
git add components/dashboard/task-card.tsx \
        components/dashboard/announcement-card.tsx \
        components/dashboard/timeline.tsx \
        components/dashboard/schedule-card.tsx
git commit -m "$(cat <<'EOF'
refactor(dashboard): 核心卡去硬编码色，统一走 design tokens

- task-card: bg-violet/blue/teal → bg-sim/quiz/subj-soft；状态色独立走 success/warn/danger
- announcement-card: bg-amber → bg-ochre-soft（公告=强调，用暖赭 accent）
- timeline: 8 色硬编码 palette → 6 色 tag + courseColorForId hash 稳定分配
- schedule-card: bg-green → bg-info-soft（避让新 subj 绿）

grep 0 匹配 bg-(violet|emerald|blue-|rose|amber-|cyan|indigo|purple|pink|orange-|teal|green-|yellow-) in components/dashboard/
QA: 61/61 tests, 真登录 student1+teacher1, API 返 4quiz+4sim+2subj 三色路径全覆盖

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# Commit 3 · PR-2 AppShell + Wordmark
git add components/sidebar.tsx \
        components/ui/wordmark.tsx \
        'app/(student)/layout.tsx' \
        app/teacher/layout.tsx
git commit -m "$(cat <<'EOF'
feat(ui): 新 Wordmark + 侧边栏视觉重构（232px + 象牙 + 深靛激活条）

- components/ui/wordmark.tsx: 手绘 SVG 上升折线 + 暖赭端点 + Fin/Sim 文字
- sidebar.tsx: 232px 宽 / bg-paper-alt / 激活态 bg-brand-soft + 左侧 3px 深靛条 /
  顶部搜索占位 + ⌘K badge / uppercase section label / 底部实心深靛 Avatar /
  所有品牌 logo GraduationCap → Wordmark（保留 task-card & simulation-runner
  里的 semantic/role icon 用途）
- 两 layout pl-60 → pl-[232px]

auth/session/routing/nav items 零改动；QA 7 路由 200；移动端 Sheet 宽度同步

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# Commit 4 · harness 证据链
git add .harness/spec.md .harness/progress.tsv .harness/reports/ .harness/HANDOFF.md
git commit -m "chore: 归档 Round 1 设计系统重构证据链（spec + 6 reports + progress 3 行）"
```

### 2. 浏览器验收

dev server 若开着，`Cmd+Shift+R` 硬刷后打开：
- `/dashboard`（学生）→ 背景米象牙、TaskCard 类型色 sim 紫/quiz 蓝/subj 绿（不是 violet/blue/teal）
- `/teacher/dashboard` → 侧边栏激活项深靛 soft + 左侧 3px 实心深靛条 / 顶部 Wordmark（不是 GraduationCap）
- 系统切换深色模式 → 仍可读，primary `#7B8CD9` 亮化深靛

Mockup 对比服务器后台在 `localhost:8765`（Python PID 59984）。完全收工时 `kill 59984`。

## Round 1 发现的 Round 2+ 工作（QA 记录，非阻塞）

1. **SSR 角色闪烁**（pre-existing，非 PR-2 引入）：教师首次 SSR 显示学生 nav，hydration 后 swap。修方案：`(student)/layout.tsx` + `teacher/layout.tsx` 升 RSC + `getServerSession()` 把 role 作为 initial prop 传 Sidebar。~200 行一 PR。
2. **page 级 `bg-primary/10` 残留**：`/grades`（3 处）、`/study-buddy`、`/register` 等 — 合并到对应专题 PR 清理。
3. **顶部栏 shell 未加**：spec 用 "若存在顶部栏" 软条件，layout 实际没有 topbar。Round 2 开学生 dashboard 时可一并开 topbar PR（面包屑 + AI 助手按钮 + 通知）。
4. **其他保留 `GraduationCap` 的位置**：`task-card.tsx:255`（教师 hover menu 成绩 icon，semantic）、`simulation-runner.tsx:475`（角色头像，contextual）— 这两个不是品牌 logo，保留合理。

## Round 2+ 路线图（8 Round 总计 13 会话，待用户确认顺序）

| Round | 内容 | 预计会话 |
|---|---|---|
| Round 2 | 学生 `/dashboard` + `/courses` + `/courses/[id]` + topbar shell | 2 |
| Round 3 | 学生 `/grades` + `/study-buddy` + `/schedule` | 2 |
| Round 4 | 教师 `/teacher/dashboard` + `/teacher/courses` + `/teacher/courses/[id]` | 3 |
| Round 5 | 任务向导 `/teacher/tasks/new`（1500 行巨型向导） | 2 |
| Round 6 | `/teacher/instances/[id]` + insights + analytics | 2 |
| Round 7 | Runner 外壳 + 登录 + 空错态全局打磨 | 1 |
| Round 8 | Simulation 对话气泡单独重做 | 1 |

## Open decisions

- 是否本会话继续 Round 2？（工程量约 2 会话，可留下次 —— Round 1 已是一个完整阶段）
- Round 2 开头是否先做 SSR 闪烁修复作为 "Round 2 PR-0"？（QA 发现，独立 PR ~200 行，解决 role hydration 问题后 topbar + dashboard 布局更稳）

## Summary

- **Round 1 一次过 PASS 3 连发**，harness 三角色协同顺畅
- Auto-QA Stop hook 和显式 QA 两层验证未出现互斥
- Build+QA 约 4 分钟/PR 的节奏在 opus 下很稳
- 遗留的 Ultrareview 收尾和上海教师 AI 案例规划仍在 queue（详见 git log & `.harness/shanghai-ai-case-2026.md`）
