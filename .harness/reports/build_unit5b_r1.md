# Build Report — Unit 5b Round 1

> Prisma 三步完成：18→19 migration（新增 add_study_buddy_post_hidden_at），dev server 重启后验证 /teacher/dashboard + /teacher/courses + /study-buddy 均 200。

> Builder: builder · 2026-05-14 · Commit `1795cab` on `claude-demo-fixes`
> Plan: `.harness/plans/unit5b_plan_r1.md`
> Drift log: `.harness/plans/unit5b_drift_log.md`
> Bugs: B-DELETE-01 (SB + Submission 部分) + B-SB-03

## Migration drift 处理（按 coordinator 要求记录）

Prisma 三步执行前 dev DB 有 2 层 drift：

### Layer 1（resolve --applied 修复 2 个未登记 migration）

`prisma migrate status` 显示 18 个 migration 找到但 `_prisma_migrations` 表只 16 行。2 个本地 .sql 已存在但 DB 元数据未登记（其 ALTER TABLE 用 `IF NOT EXISTS` 写法，DB 实际已有这些列，可能历史上 `db push` 推过）：
- `20260504150000_add_study_buddy_preview_flag`
- `20260504152000_align_ai_material_schema`

执行：
```bash
npx prisma migrate resolve --applied 20260504150000_add_study_buddy_preview_flag
# → "Migration marked as applied."
npx prisma migrate resolve --applied 20260504152000_align_ai_material_schema
# → "Migration marked as applied."
```

### Layer 2（SQL UPDATE 修一条字面字符串 checksum）

resolve 后 `migrate status` 显示 "Database schema is up to date!"，但 `migrate dev` 仍报：
```
The migration `20260503011246_phase4_scope_analysis_report` was modified after it was applied.
```

根因：DB 中该 migration 的 checksum 是字面字符串 `"phase4_scope_analysis_report_manual"`（非 SHA-256 hash），说明历史上有人手动 INSERT 到 `_prisma_migrations` 表。Prisma `migrate dev` 校验 checksum vs .sql 文件内容，发现 mismatch。

尝试方案 1（`migrate resolve --rolled-back`）失败：P3012 "cannot be rolled back because it is not in a failed state"。

走方案 2（coordinator 提供真实 SHA-256 哈希 `8afaf660...`）：
```bash
docker exec acc4fef29d82_finsim-postgres psql -U finsim -d finsim -c "
UPDATE \"_prisma_migrations\"
SET checksum = '8afaf660216fdc9048614430b70a80e728a9655f47ba0dc33dfe62adb23712bd'
WHERE migration_name = '20260503011246_phase4_scope_analysis_report'
RETURNING migration_name, length(checksum) AS hash_len;"
# → hash_len=64 ✓
```

### Layer 3（正常 migrate dev）

```bash
npx prisma migrate dev --name add_study_buddy_post_hidden_at
# → "Applying migration `20260514102331_add_study_buddy_post_hidden_at`"
# → "Your database is now in sync with your schema."
npx prisma generate
# → "Generated Prisma Client (v6.19.3)"
```

### Dev server restart 验证

```bash
kill 55128 55643   # 旧 dev server PID
npm run dev -- --webpack  # webpack 模式（与 worktree 兼容）
```

验证 3 个页面：
```
/teacher/dashboard: 200
/teacher/courses:   200
/study-buddy:       200
```

✓ 全部三步完成。

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `prisma/schema.prisma` | +5 | StudyBuddyPost.hiddenAt + hiddenBy + index |
| `prisma/migrations/20260514102331_add_study_buddy_post_hidden_at/migration.sql` (新) | +5 | ALTER TABLE ADD COLUMN |
| `lib/services/study-buddy.service.ts` | +43 | hideStudyBuddyPost + list 过滤 hidden |
| `lib/services/submission.service.ts` | +34 | ungradeSubmission |
| `lib/api-utils.ts` | +4 | 2 新错误码映射 |
| `app/api/study-buddy/posts/[id]/route.ts` (新) | +24 | DELETE 路由 |
| `app/api/submissions/[id]/ungrade/route.ts` (新) | +28 | POST 路由 |
| `components/study-buddy/study-buddy-conversation-header.tsx` | +28 / -2 | Trash 按钮 + onDelete prop |
| `components/study-buddy/study-buddy-conversation.tsx` | +9 / -1 | 透传 onDelete |
| `app/(student)/study-buddy/page.tsx` | +66 | AlertDialog + handleConfirmedDeletePost |
| `components/instance-detail/grading-drawer.tsx` | +99 / -1 | 撤销批改按钮 + AlertDialog + handleUngrade |
| `tests/e2e/unit5b-verify.spec.ts` (新) | +291 | 8 case 端到端 |

总 diff +636 / -4。

## 关键决策落实

1. **Schema 方案 D（hiddenAt 字段）**：实施完成，migration 已应用。
2. **ungrade 保留 evaluation**：service 仅 update Submission 表，子表 evaluation/conceptTags 不动。
3. **协作权限**：本 unit 严格按 task.creatorId，Unit 5c 协作上扬不含 SB hide / submission ungrade。

## 自测结果

### Prisma / TypeScript
```
prisma migrate status: Database schema is up to date! (19 migrations)
npx tsc --noEmit: clean
```

### Vitest
```
Test Files  83 passed (83)
Tests       986 passed (986)
```

### ESLint
```
npx eslint <12 touched files>: 0 problems
```

### Playwright E2E (8 case, isolated browser contexts)
```
Unit 5b A: Study Buddy 软删
✓ A1: alex hide 自己 → 200 + list 不返回 (3.5s)
✓ A2: belle hide alex post → 403 FORBIDDEN (5.8s)
✓ A3: molly hide alex 在 molly 任务下的 post → 200 (6.0s) ⭐
✓ A4: hide 不存在 → 404 NOT_FOUND (3.1s)
✓ A5: idempotent 重复 hide → 200 不报错 (2.9s)

Unit 5b B: Submission 撤销批改
✓ B1: ungrade graded → 200 + 字段清空 + status=submitted (3.3s) ⭐
✓ B2: ungrade 同一二次 → 400 SUBMISSION_NOT_GRADED_YET (3.0s)
✓ B3: ungrade 不存在 → 404 NOT_FOUND (2.9s)

8 passed (31.5s)
```

注：e2e 使用每 test 独立 BrowserContext 避免 NextAuth 多用户切换 session race。serial mode + clearCookies + 多次重新登录有可重现的偶发 401（page.request 上下文与 NextAuth 写 cookie 时序不稳）。改用 isolated context 后 100% 稳定。

### Audit log 实测
```sql
SELECT action, "targetId", metadata->>'byOwner' AS by_owner, "createdAt"
FROM "AuditLog"
WHERE action IN ('study_buddy_post.hide','submission.ungrade')
ORDER BY "createdAt" DESC LIMIT 10;
```
- `study_buddy_post.hide` × 多条：metadata 含 `byOwner: true|false` + `studentId`
- `submission.ungrade` × 多条：metadata 含 `studentId / taskInstanceId / previousStatus: "graded"`

### DB 测后还原
- ALEX_GRADED_SUB (ce7f935d) status=graded + score=0 (baseline) ✓
- 所有 QA-Unit5b-* 名的 SB post 都被 hide（软删，DB 行还在但不可见）— 累计 dev DB 已有若干测试 hide 历史，不影响功能

## 是否需要重启 dev server

**本次已重启**（schema 改动后）。dev server 现以 webpack 模式跑，PID 新分配。

## 风险 / 不确定项

1. **🟢 hiddenAt 字段添加纯加性**：旧数据默认 NULL，与现有逻辑兼容。
2. **🟡 测试期间累积 hidden post**：dev DB 里有若干 QA-Unit5b-* 标题的 hidden post 没清理（hidden 不阻塞功能，但 dev DB 数据量稍涨）。可后续 SQL DELETE WHERE 清理。
3. **🟢 ungrade 保留 evaluation**：spec 字面"保留作答数据"，evaluation 视为参考价值保留。
4. **🟢 协作 SB hide 待 Unit 5c**：本 unit 严格 task.creator，Unit 5c 上扬时只覆盖结构/班级编辑，SB hide 仍 task.creator-only。

## Acceptance 对照

| spec / coordinator 要求 | 状态 |
|---|---|
| StudyBuddyPost 软删（hiddenAt 字段）| ✅ Schema + Layer 3 migrate dev |
| 学生删自己 / 老师删本课程任意 post | ✅ A1 / A3 |
| 列表默认不返回 hidden | ✅ A1 验证 list 不含 |
| Submission 撤销批改端点（graded → ungraded）| ✅ B1 验证 status=submitted |
| 保留作答数据（含 evaluation） | ✅ service 不动 evaluation 字段 |
| 撤销批改 UI 在批改抽屉 | ✅ grading-drawer footer button + AlertDialog |
| audit log（hide + ungrade）| ✅ DB 实测 |
| tsc / vitest / lint 全绿 | ✅ |
| Prisma 三步严格执行 | ✅ migrate (drift fix + new) → generate → restart → page verify |
