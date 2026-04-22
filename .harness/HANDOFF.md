# HANDOFF

> 会话结束前由 coordinator 更新本文件。新会话启动时 SessionStart hook 自动显示。

## Last completed
- **8/8 ultrareview findings 全修**（2026-04-22，3 轮 PR r1 一次过 PASS）
  - PR-fix-1 (P0): B1 IDOR + B2 跨班泄露 + B3 删主 class dangling
  - PR-fix-2 (P1): B4 teacher dashboard OR + B5 schedule/announcement helper + B6 backfill migration + UI fallback
  - PR-fix-3 (P2): B7 Promise.all 并行化 + B8 ranking 过滤 gradedCount===0
- **20/20 tests** across 7 files (9 + 6 + 5 新)，全轮 tsc 0 errors
- Stop hook verify-qa（purple）独立确认 ok=true，覆盖 7 criteria

## Next step — 用户侧收官（4 步）

**1. Commit 策略**（推荐按 PR 拆 3 commit，在一个 branch 上）

当前 git status：9 files modified + 1 新 migration 目录 + 新 tests/ + 新 vitest.config.ts + .claude/ + .harness/

```bash
# 在 main 分支拉 feature 分支
git checkout -b fix/ultrareview-findings

# Commit 1 — P0 安全（B1/B2/B3）
git add app/api/lms/courses/\[id\]/route.ts \
        lib/services/course.service.ts \
        lib/api-utils.ts \
        tests/course.service.test.ts \
        tests/courses-patch.api.test.ts \
        tests/dashboard.service.test.ts \
        vitest.config.ts
# 注意：dashboard.service.ts 的 student dashboard where 改动属 B2（PR-fix-1）
# 但该文件也含 B4 teacher 改动（PR-fix-2），需要 git add -p 分段 stage
git add -p lib/services/dashboard.service.ts  # 只选 student 那段
git add -p app/teacher/courses/\[id\]/page.tsx  # 只选 × button 隐藏那段
git commit -m "fix: 修复课程 PATCH 权限越权、跨班 task 泄露、删主 class dangling (B1/B2/B3)"

# Commit 2 — P1 功能回归（B4/B5/B6）
git add -p lib/services/dashboard.service.ts  # teacher OR 那段
git add lib/services/schedule.service.ts \
        lib/services/announcement.service.ts \
        prisma/migrations/20260422041600_backfill_course_class/ \
        tests/course-filter.test.ts \
        tests/schedule-announcement.service.test.ts \
        tests/teacher-dashboard.test.ts
git add -p lib/services/course.service.ts  # courseClassFilter 新 helper
git add -p app/teacher/courses/\[id\]/page.tsx  # UI fallback 那段
git commit -m "fix: 修复老师 dashboard 丢 standalone 实例、schedule/announcement 半迁移、CourseClass backfill (B4/B5/B6)"

# Commit 3 — P2 perf/UX（B7/B8）
git add components/course/course-analytics-tab.tsx \
        tests/student-ranking.test.ts
git commit -m "perf: 并行化 CourseAnalyticsTab 请求 + 修正 ranking 未批改识别 (B7/B8)"

# 可选：harness infra 升级独立 commit
git add CLAUDE.md .claude/ .harness/
git commit -m "chore: 升级 harness infra 接入 gstack + 加 progress/HANDOFF (2026-04-22)"
```

**2. 应用 migration 并验证**（CLAUDE.md Prisma 三步硬规则）
```bash
docker compose up postgres -d
npx prisma migrate dev  # 会应用 20260422041600_backfill_course_class
# Prisma Client 未变（纯 data-only INSERT），无需 generate/重启
# 但验证一下：
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "CourseClass"' 
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "Course" WHERE "classId" IS NOT NULL'
# 前者应 ≥ 后者
```

**3. 浏览器三场景手测**（QA 在 agent 环境无 DB 无法跑）
```
A. 次班学生查 /schedule 和 /announcements → 应看到父课数据
B. 老师 dashboard → 应含 courseId=null 的 standalone task instance
C. 历史课程开 /teacher/courses/[id] → 显示 ≥1 个班级徽章（backfill 或 fallback 保证）
D. PR-fix-3：开一个有 >10 instance 的课程 → DevTools Network 面板应看到 /api/submissions 并行 pending，加载 <500ms
E. PR-fix-3：ranking 表不应有"gradedCount=0 avgScore=0"行，未批改学生应不在榜
```

**4. Push + 开 PR**（或一个 PR 含 3 commit）

## Open decisions
（无阻塞）

## Future tasks (未来非本次 scope)
- **assertCourseAccess 抽到 `lib/auth/guards.ts`** — 当前在 `app/api/lms/courses/[id]/route.ts` 和 `classes/route.ts` 重复两份（PR-fix-1 QA 观察）
- **schedule.service latent bug** — `classId` 和 `teacherId` 过滤分支各自 spread 同名 `course` key，JS 对象展开覆盖语义，当前 caller 互斥不会触发（PR-fix-2 QA 观察，预先存在于 HEAD）
- **announcements 缺 teacherId 分支** — 老师侧 `/announcements` 会看到全系统公告（PR-fix-2 QA 观察）
- **CourseAnalyticsTab 错误隔离** — Promise.all 一个失败整 tab 坏，可改 Promise.allSettled（PR-fix-3 QA 观察）
- **CourseAnalyticsTab 服务端 aggregation 端点** — 若真浏览器 perf 仍不够，加 `/api/lms/courses/:id/analytics-summary` 一次返全

## Summary
- ultrareview 配额剩 2/3
- 下一次 ultrareview 可在 commit + push 前跑一次，验证 3 PR 未引入新回归
