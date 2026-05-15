# QA Report — Unit 5c r1

> QA: qa · 2026-05-14 · 验 commit `e228500` on `claude-demo-fixes`
> Bug: B-COURSE-04 + 用户决策 #5 · spec.md L108 + Unit 5c 角色定义
> Test spec: `tests/e2e/qa-unit5c-collab.spec.ts` (11 case，独立于 builder unit5c-verify.spec.ts)

## Build report 前置发现 (重要)

Builder 在 grep 时发现 codebase **已基本协作友好**（assertCourseAccess 已允许 CourseTeacher collab）。本 unit 真正补足的是 **audit log actorRole 区分 + KS owner-confirm UX**。

QA 独立 grep 确认：
- `lib/auth/course-access.ts:18-21` — `assertCourseAccess` 已通过 CourseTeacher 表允许 collab ✓
- `lib/auth/actor-role.ts` (新建) — `getCourseActorRole` 在 9 个 route handler 中算 actorRole 并传 audit metadata ✓

## 测试数据
- **TEACHER1_COURSE** `e6fc049c` — teacher1 owns, molly is **collab via CourseTeacher** (DB 实证)
- **MOLLY_OWN_COURSE** `8f7f653c` — molly owns
- **TEACHER1_KS** `46d57c02` — `lingxi-course-outline.txt`, teacher1 uploaded → collab molly 删要 confirm
- **TEACHER1_CHAPTER** `baf9c3d6` — `理财基础概念`, in teacher1 course
- alex (student) + teacher2 (no collab) for regression

## Spec acceptance 逐条对照

| 用户决策 #5 / spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| 协作教师 PATCH course 基础信息 (description/...) | molly PATCH teacher1's course | 200, response body 含新 description, audit actorRole=collaborator | PASS |
| 协作教师 POST chapter | molly POST chapter to teacher1 course | 201, audit `chapter.create` actorRole=collaborator | PASS |
| 协作教师 PATCH chapter | molly PATCH 理财基础概念 chapter | 200, audit actorRole=collaborator | PASS |
| 协作教师 DELETE chapter | molly DELETE own newly-created chapter | 200, audit `chapter.delete` actorRole=collaborator | PASS |
| 协作教师 DELETE owner's KS → owner-confirm 拦截 | molly DELETE TEACHER1_KS 无 force | **400 + `KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM` + "这是其他老师上传的素材，请确认后再删除"** 中文 | PASS |
| 协作教师不能 DELETE course (owner-only) | molly DELETE teacher1 course | 403 + `FORBIDDEN` + "权限不足" | PASS |
| 协作教师不能添加/管理协作教师 (owner-only) | molly POST `/courses/[id]/teachers` | 403 + `FORBIDDEN` + "权限不足" | PASS |
| 非课程教师 → 403 (regression) | teacher2 PATCH teacher1 course | 403 + `FORBIDDEN` + "权限不足" | PASS |
| 学生 → 403 (regression) | alex PATCH teacher1 course | 403 + `FORBIDDEN` + "权限不足，无法访问此资源" | PASS |
| owner 能力不变 (regression) | teacher1 PATCH own course + molly PATCH own course | 两者均 200 + audit actorRole=**owner** | PASS |
| 不存在的资源 → 404 | PATCH nonexistent course | 404 + `NOT_FOUND` + "课程不存在" | PASS |

## Audit log actorRole 实测

```sql
SELECT action, "createdAt", metadata->>'actorRole' AS actor_role
FROM "AuditLog"
WHERE "createdAt" > '2026-05-14 10:55:00' AND action IN ('course.update','chapter.create','chapter.delete')
ORDER BY "createdAt" DESC LIMIT 15;
```
```
course.update  | 11:17:59 | owner         (teacher1 + molly on own)
course.update  | 11:17:55 | owner         (teacher1 + molly on own)
chapter.delete | 11:17:33 | collaborator  (molly cleanup B)
chapter.create | 11:17:33 | collaborator  (molly POST B, courseId=e6fc049c) ★
course.update  | 11:17:30 | collaborator  (molly PATCH teacher1 course A)
course.update  | 11:17:30 | collaborator  (restore A)
...
```

✅ **actorRole 字段在每条 audit 都精确反映角色**:
- molly 在 teacher1 course 操作 → `actorRole: collaborator`
- teacher1/molly 在 own course → `actorRole: owner`

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 83 files / **986 tests pass** (与 baseline 一致，无新 vitest) |
| `npx eslint <16 builder files + QA spec>` | 0 problem |
| `git show --stat e228500` | 16 files +502/-12，与 build 报告一致 (declares +508/-28 含 e2e spec) |
| cross-module grep `getCourseActorRole` | 9 处 callsite（含 service deleteCourseKnowledgeSource + 8 个 route handler）— 一致地在 PATCH/DELETE/POST 后调用并传 audit metadata |
| DB 状态测前测后 | teacher1 course description 还原到 "本课程涵盖个人理财的基本概念..."；TEACHER1_CHAPTER title 还原到 "理财基础概念"；molly own course description 维持 NULL 基线 — 完全一致 |

## Cross-module regression

- `assertCourseAccess`（course-access.ts:9-22）允许 admin/owner/CourseTeacher — 既有逻辑，本 unit 不动 ✓
- `getCourseActorRole`（新文件 actor-role.ts）— 仅用于 audit metadata，**不参与权限判断**（避免引入新的拒绝条件）
- chapter/section/contentBlock service 签名 0 改动（builder 主动汇报）— 仅 route 层加 metadata 透传，service 不感知 actor 角色，最小侵入 ✓
- 既有 vitest 986 全过 — 0 回归

## Finsim-specific 检查

- ✅ UI 文案中文（"这是其他老师上传的素材，请确认后再删除" / "权限不足" / "课程不存在"）
- ✅ Service throw "ERROR_CODE" + handleServiceError 中文映射（`KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM`）
- ✅ Route Handler 仅 auth + assertCourseAccess + actorRole 计算 + service 调用，业务逻辑在 service
- ✅ API response 格式 `{ success, data }` / `{ success: false, error: { code, message } }`
- ✅ Prisma schema 0 改动

## 风险 / 不确定项

1. **🟡 KS 删除 UI 用 `window.confirm` 而非 AlertDialog**：builder 主动汇报，与 Unit 2/5a 模式不一致，但 KS 删除原本就用 window.confirm（既有代码风格保持）。一致性问题但不阻塞 acceptance。
2. **🟢 协作教师不能管理协作者**：Test F 验证 — 与用户决策 #5 一致（owner-only 保留 4 项）
3. **🟢 service 签名稳定**：未改 chapter/section/contentBlock service 入参，最小侵入
4. **🟢 SB hide 仍 task.creator-only**：Unit 5b 已严控，本 unit 不上扬（spec L113 / 用户决策一致）

## 是否引入新 bug

无。11 case 全过，DB 状态测前测后完全一致 (description / title / NULL 维持)。

## Issues found

无 blocker。一个 UX 一致性 note：KS owner-confirm 用 window.confirm 而非 AlertDialog（与 Unit 2/5a 模式不一致），可 Phase 4 polish。

## Overall: **PASS**

**判断标准对照** (r1 即收三条件)：
1. ✅ QA 11 case (collab allowed × 4 + KS confirm × 1 + owner-only × 2 + regression × 3 + 404 × 1) vs builder 6 case + 2 skip — 独立证据链
2. ✅ HTTP / error code / Chinese message / audit actorRole metadata 全 deterministic
3. ✅ DB cleanup 完整：course description + chapter title + 临时 chapter DELETE 全 restore，baseline 一致

**建议**：r1 PASS 收工。本 unit 是横切改动（16 files），但 builder 的 "audit metadata 透传 + service 签名稳定" 策略让回归面非常小，acceptance 客观可测，按 r1 即收三条件全过。

Unit 5c 整体可 close，下一步 Unit 6（Study Buddy 自由问）。
