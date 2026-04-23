# HANDOFF

> 会话结束前由 coordinator 更新本文件。新会话启动时 SessionStart hook 自动显示。

## Last completed

- **Ultrareview 8/8 findings 全修（2026-04-22）** — 3 轮 PR（P0/P1/P2），20/20 tests，tsc 0 errors
- **Harness infra 升级（2026-04-22）** — coordinator/builder/qa 三角色 + Stop hook 自动 QA + progress.tsv + HANDOFF（本文件）
- **2026 上海教师 AI 案例申报规划锁定（2026-04-23）** — 创 AI · 智能信息系统方向确定；详见 `.harness/shanghai-ai-case-2026.md`

## Next step

**队列（按时间顺序）**：

1. **Ultrareview 3 PR 收尾**（等用户本地操作）
   - `git commit` 按 PR-fix-1 / PR-fix-2 / PR-fix-3 拆 3 commit（详细命令见下方"Ultrareview 收尾待办"段）
   - 应用 backfill migration：`docker compose up postgres -d && npx prisma migrate dev`
   - 浏览器手测 5 场景（次班 schedule/announcement / teacher dashboard standalone / 历史课徽章 / analytics 并行加载 / ranking 过滤）
   - Push + 开 PR → merge to main

2. **当下的功能优化**（待用户澄清是什么范围）
   - 本会话用户明确需要"先就一些 finished 的功能做优化"；具体是 Ultrareview `Future tasks` 里的 5 项观察、还是其他新需求，**下一轮对话澄清后再写 spec.md**

3. **案例申报改造**（5 月启动，详见规划文件）
   - 时间线见 `.harness/shanghai-ai-case-2026.md` §4
   - 11 个 unit（合规 4 + 创新 2 + 开源/文档 4 + 最终交付 1）
   - 里程碑 M2–M7

## Open decisions（等用户确认）

- **当下优化的具体 scope**：是清理 Ultrareview 收尾留下的 Future tasks（assertCourseAccess 抽提 / schedule latent bug / announcements teacherId / CourseAnalyticsTab allSettled / aggregation 端点），还是新的优化需求？
- **开源仓策略**：`AlexAnys/finsim_Mini` 直接转 public，还是新建镜像仓 `finsim-edu`？(unit-07 前置)
- **创新点范围确认**：AI 量规（unit-05 必做）+ 学业诊断（unit-06 选做） 或 全做？

## Ultrareview 收尾待办（保留自上轮）

**1. Commit 拆分** — 当前 branch 上已修代码，按 3 PR 拆 commit：

```bash
git checkout -b fix/ultrareview-findings

# Commit 1 — P0 (B1/B2/B3)
git add app/api/lms/courses/\[id\]/route.ts \
        lib/services/course.service.ts \
        lib/api-utils.ts \
        tests/course.service.test.ts \
        tests/courses-patch.api.test.ts \
        tests/dashboard.service.test.ts \
        vitest.config.ts
git add -p lib/services/dashboard.service.ts   # 只选 student 段
git add -p app/teacher/courses/\[id\]/page.tsx # 只选 × button 隐藏段
git commit -m "fix: 修复课程 PATCH 权限越权、跨班 task 泄露、删主 class dangling (B1/B2/B3)"

# Commit 2 — P1 (B4/B5/B6)
git add -p lib/services/dashboard.service.ts   # teacher OR 段
git add lib/services/schedule.service.ts \
        lib/services/announcement.service.ts \
        prisma/migrations/20260422041600_backfill_course_class/ \
        tests/course-filter.test.ts \
        tests/schedule-announcement.service.test.ts \
        tests/teacher-dashboard.test.ts
git add -p lib/services/course.service.ts      # courseClassFilter helper
git add -p app/teacher/courses/\[id\]/page.tsx # UI fallback 段
git commit -m "fix: 修复老师 dashboard 丢 standalone 实例、schedule/announcement 半迁移、CourseClass backfill (B4/B5/B6)"

# Commit 3 — P2 (B7/B8)
git add components/course/course-analytics-tab.tsx tests/student-ranking.test.ts
git commit -m "perf: 并行化 CourseAnalyticsTab 请求 + 修正 ranking 未批改识别 (B7/B8)"

# Commit 4 — harness infra
git add CLAUDE.md .claude/ .harness/
git commit -m "chore: 升级 harness infra + 2026 上海教师 AI 案例申报规划"
```

**2. Migration 应用 + 验证**
```bash
docker compose up postgres -d
npx prisma migrate dev   # 应用 20260422041600_backfill_course_class
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "CourseClass"'
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "Course" WHERE "classId" IS NOT NULL'
# 前者 ≥ 后者
```

**3. 浏览器 5 场景手测**
- A. 次班学生 `/schedule` + `/announcements` → 看到父课数据
- B. 老师 dashboard → 含 `courseId=null` standalone instance
- C. 历史课 `/teacher/courses/[id]` → 显示 ≥1 个班级徽章
- D. analytics tab 开 >10 instance 课 → DevTools 看并行 fetch，<500ms
- E. ranking 表无"gradedCount=0 avgScore=0"底部行

## Future tasks（Ultrareview 观察到但非本次 scope）

1. **assertCourseAccess 抽到 `lib/auth/guards.ts`** — 当前 `courses/[id]/route.ts` 和 `classes/route.ts` 重复两份
2. **schedule.service latent bug** — `classId` / `teacherId` 分支各自 spread 同名 `course` key，互斥不触发但风险存在
3. **announcements 缺 teacherId 分支** — 老师 `/announcements` 会看到全系统公告
4. **CourseAnalyticsTab 错误隔离** — `Promise.all` 改 `Promise.allSettled`
5. **CourseAnalyticsTab 服务端 aggregation** — 若真浏览器 perf 不够，加 `/api/lms/courses/:id/analytics-summary`

这些是"当下优化"候选的一部分，等用户确认纳入还是另起新需求。

## Notes

- **Ultrareview 配额剩 2/3**；下次 push 前可再跑一次兜底
- **案例 6/1 截止**；5 月改造窗口仅 4 周可执行
- 所有大改动前 review `.harness/shanghai-ai-case-2026.md` 保持方向不漂
