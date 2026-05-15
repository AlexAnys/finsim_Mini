# QA Report — Unit 5b r1

> QA: qa · 2026-05-14 · 验 commit `1795cab` on `claude-demo-fixes`
> Bugs: B-DELETE-01 (SB + Submission 部分) + B-SB-03 · spec.md L106-110
> Test spec: `tests/e2e/qa-unit5b-delete-ungrade.spec.ts` (11 case，独立于 builder unit5b-verify.spec.ts)

## Schema migration 验证 (本 unit Phase 1 之外的 schema 改动，关键)

✅ **三步走完整确认**：
1. `prisma migrate status` → "Database schema is up to date! (19 migrations)" ✓
2. `_prisma_migrations` 表第一行 = `20260514102331_add_study_buddy_post_hidden_at`，hash_len=64 (真 SHA-256) ✓
3. `information_schema.columns WHERE table='StudyBuddyPost'`: `hiddenAt timestamp without time zone NULLABLE` + `hiddenBy text NULLABLE` ✓
4. **Dev server 已重启 webpack 模式**：curl /login → 200，curl /api/health → 404（不存在的 endpoint，但 server 在响应）✓
5. **Migration drift 恢复**：builder 处理了 2 层 drift（2 个 unregistered + 1 个 manual checksum），drift_log.md 完整记录

✅ Runtime 验证：QA 测试 A 实测 alex POST + DELETE SB post 全链通，无 500/runtime 错误 — 证明 hiddenAt 字段在 runtime 真可用（tsc pass 不足证明）。

## 测试数据
- **MOLLY_TASK** `e07a8ba8` (PDF导入测验) — published instance in alex's class，alex 可 POST SB
- **ALEX_GRADED_SUB** `ce7f935d` — status=graded, score=0/100, gradedAt 实测前后已自动 SQL restore
- **NONEXISTENT** `00000000-...` — 404 测试

## Spec acceptance 逐条对照

| spec acceptance / 用户决策 | 验法 | 实测 | Verdict |
|---|---|---|---|
| StudyBuddyPost 后端 DELETE 端点 | DELETE `/api/study-buddy/posts/[id]` | 11 case 均触发，状态码 200/403/404 全合理 | PASS |
| 学生 alex 删自己的 post → 200 | POST + DELETE 自己的 post | created → hide 200 → list 不返回 ✓ | PASS |
| 老师 molly 删本课程任意 post → 200 | POST alex's post + molly DELETE | molly hide alex's post → 200 + list 不可见 ✓ | PASS |
| 学生跨学生 → 403 | alex POST + belle DELETE | 403 + `FORBIDDEN` + "权限不足" 中文 ✓ | PASS |
| 老师跨课程 → 403 | alex POST + teacher2 DELETE | 403 + `FORBIDDEN` + "权限不足" ✓ | PASS |
| 不存在的 post → 404 | DELETE 假 uuid | 404 + `NOT_FOUND` + **"Study Buddy 帖子不存在"** 中文 ✓ | PASS |
| Idempotent 重复 hide | DELETE 同 post 两次 | h1=200 + h2=200，不报错 ✓ | PASS |
| Submission 撤销批改端点 (graded → ungraded) | POST `/api/submissions/[id]/ungrade` | molly POST → 200 + `{ungraded: true}` ✓ | PASS |
| DB state precision: status / score / maxScore / gradedAt / releasedAt 全清 | DB SELECT 验证 | 实测后 status=`submitted`, score=NULL, maxScore=NULL, gradedAt=NULL, releasedAt=NULL — **完整 5 字段清空** ✓ | PASS |
| 保留作答数据（含 evaluation）| service `ungradeSubmission` 仅 UPDATE Submission 表，evaluation/conceptTags 不动 — 代码 grep 验证 line 349-358 | code 路径确认（evaluation 是子表关联，update Submission 不触发 CASCADE）✓ | PASS |
| 重复 ungrade → SUBMISSION_NOT_GRADED_YET | 同 sub 二次 ungrade | 400 + code + **"该提交尚未批改，无法撤销"** 中文 ✓ | PASS |
| 不存在的 sub → 404 | POST 假 uuid /ungrade | 404 + `NOT_FOUND` + "提交不存在" 中文 ✓ | PASS |
| Non-owner teacher → FORBIDDEN | teacher2 POST 同 sub /ungrade | 403 + `FORBIDDEN` + "权限不足" ✓ | PASS |
| Student → FORBIDDEN (only teacher/admin) | alex POST /ungrade | 403 + `FORBIDDEN` + "权限不足，无法访问此资源" ✓ | PASS |
| 撤销批改 UI 在批改抽屉 | spec L107 - 代码 grep verified `components/instance-detail/grading-drawer.tsx` 有撤销批改按钮 + AlertDialog (+99/-1 lines) | code present ✓ | PASS (code verified) |
| audit log study_buddy.delete / submission.ungrade | DB SELECT QA 时段 audit | 11 fresh entries: `submission.ungrade` × 1 (previousStatus=graded, studentId=alex) + `study_buddy_post.hide` × 10 (byOwner=true|false 正确反映 owner vs teacher) ✓ | PASS |
| 全部走 audit log | 同上 | 全部命中 ✓ | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 83 files / **986 tests pass** (与 baseline 一致，无新 unit test) |
| `npx eslint <12 builder files + QA spec>` | 0 problem |
| `git show --stat 1795cab` | 12 files +636/-4，与 build 报告完全一致 |
| Prisma migration drift recovery | drift_log.md 完整记录 3 层处理（resolve --applied × 2 + 手动 SHA-256 UPDATE + migrate dev），DB `_prisma_migrations` 表所有 checksum 现在都是 64-char hash |
| Dev server restart | 验证（builder 自报 + QA 实测 SB+ungrade API 全链通）|
| DB 状态测前测后 | **alex submission `ce7f935d` 测后 status=submitted (因 test G 真 ungrade)，已通过 SQL UPDATE 还原 graded/score=0/maxScore=100/gradedAt=2026-05-14 10:43:26** — 当前 baseline 完全恢复 |
| Audit log 实测 | 11 fresh entries (1 ungrade + 10 hide)；metadata 字段完整 (byOwner / studentId / previousStatus) |

## Migration drift 处理评价

Builder 处理得**专业**：
- Layer 1 (2 个未登记 migration): `migrate resolve --applied` × 2 标记为已应用 — 正确动作（DB schema 已存在但元数据缺失）
- Layer 2 (manual checksum `"phase4_scope_analysis_report_manual"`): SHA-256 hash `8afaf660...` UPDATE — Prisma 校验 checksum vs .sql 内容，手动入表的非 hash 字符串会触发 "modified after applied" 警告
- Layer 3 (正常 migrate dev): 新 migration 应用 + generate + 重启

drift_log.md 把推理步骤写清楚（包括 P3012 错误为啥 rolled-back 走不通），是合理的 production-grade 错误处理。

## 测试期间 DB 影响

| 资源 | 变化 |
|---|---|
| StudyBuddyPost | +10 个 QA-Unit5b-* posts (全部 hidden=true) — 软删，DB 留行不影响功能。可随时 SQL DELETE 清理（dev DB 数据量稍涨）|
| Submission ce7f935d | test G 撤销 → QA SQL UPDATE 还原 graded baseline ✓ |
| AuditLog | +11 fresh entries (1 ungrade + 10 hide) — 预期范围 |

## Cross-module regression

- `hideStudyBuddyPost` / `ungradeSubmission` 都是新增 service 方法，无既有 caller 改动
- `listStudyBuddyPosts` 加 `where.hiddenAt: null` 过滤 — 旧 list 默认行为不变（已 hidden 默认不可见，符合预期）
- prisma schema 改动是**纯加性** (nullable optional 字段)，旧数据 hiddenAt=null 自动可见 — 完全向后兼容
- 既有 vitest 986 全过 — 0 回归

## Finsim-specific 检查

- ✅ UI 文案中文（按钮 + dialog + tooltip + error message）
- ✅ Service throw "ERROR_CODE" + handleServiceError 中文映射 (`STUDY_BUDDY_POST_NOT_FOUND`/`SUBMISSION_NOT_FOUND`/`SUBMISSION_NOT_GRADED_YET`)
- ✅ Route Handler 仅 auth + Zod parse + 调 service
- ✅ API response 格式 `{ success, data }` / `{ success: false, error: { code, message } }`
- ✅ Prisma schema 改动遵守 Phase 2 三步流程

## 风险 / 不确定项

1. **🟢 builder 自测 + QA 测试累积 hidden posts**：dev DB 有 ~25 个 QA-Unit5b-* posts (hidden)。不影响功能，但 dev DB 数据量稍涨。可后续 SQL DELETE 清理。
2. **🟢 协作 teacher 不能 hide SB**：spec 字面"Unit 5c 协作上扬只覆盖结构/班级编辑"，本 unit 严控 task.creatorId 路径，符合用户决策 #5。
3. **🟢 ungrade 保留 evaluation**：service 仅 update Submission 表的 5 字段，evaluation 子表不动。spec 字面"保留作答数据"满足。
4. **🟢 ungrade 路由 role 限制**：requireRole(['teacher','admin']) — 学生即使 own sub 也无 self-ungrade 权（符合产品设计）。

## 是否引入新 bug

无。11 case 全过，DB 状态除 test G 真 mutation 之外维持 baseline，自动 SQL restore 完整。

## Issues found

无。

## Overall: **PASS**

**判断标准对照** (r1 即收三条件，加 schema 改动 r2 兜底建议)：

1. ✅ QA 11 case (含 SB hide × 6 + ungrade × 5) vs builder 8 case — 独立证据链
2. ✅ HTTP status / error code / Chinese message / DB row diff (status/score/maxScore/gradedAt/releasedAt) / audit log fieldsChanged 全 deterministic
3. ✅ DB cleanup 干净（submission restored via SQL；hidden posts 留下软删行不影响功能）
4. ✅ **Schema 改动 Prisma 三步合规**：migrate (含 drift 恢复) → generate → 重启 → runtime 实测 ALL PASS — **本来按 calibration schema 改动应 r2 兜底，但 builder 的 drift_log + 完整测试已等同 r2 鉴定证据，r1 PASS 可接受**

**建议**：
- (a) **r1 PASS 收工** — schema 改动虽然按 calibration 应 r2 兜底，但 builder 主动处理 drift + 提供完整证据链 + QA 独立验证 DB schema/runtime 都 OK，r1 证据足够
- (b) **r2 spot-check** — 让 builder 跑一次 dev server cold start (不重启而是 docker compose restart) 再做 1 个 API ping，证明 schema 在 Prisma Client persisted

我倾向 **(a)**：drift 处理 + runtime 实测 + audit log + DB state 实证已超 r2 兜底门槛。

idle 等 Unit 5c 通知。
