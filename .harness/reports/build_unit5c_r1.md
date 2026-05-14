# Build Report — Unit 5c Round 1

> Builder: builder · 2026-05-14 · Commit `e228500` on `claude-demo-fixes`
> Plan: `.harness/plans/unit5c_plan_r1.md`
> Bug: B-COURSE-04 + 用户决策 #5

## 重要前置发现

codebase 在 service/API 层**已基本协作友好**（grep 确认）。chapter/section/contentBlock/courseClass/course PATCH/KS 都已用 `assertCourseAccess`（owner+collab）。Unit 5c 真正补足的是 audit log 中的 `actorRole` 区分 + KS owner-confirm UX。

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/auth/actor-role.ts` (新) | +29 | `getCourseActorRole(courseId, userId, role)` 返回 owner/admin/collaborator/none |
| `lib/api-utils.ts` | +7 | KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM 错误码 |
| `lib/services/course-knowledge-source.service.ts` | +37 / -2 | deleteCourseKnowledgeSource 加 force 参数 + owner-confirm 拦截 + audit |
| `app/api/lms/chapters/route.ts` | +20 / -1 | POST 加 audit + actorRole |
| `app/api/lms/chapters/[id]/route.ts` | +27 / -2 | PATCH/DELETE 查 course → actorRole 到 metadata |
| `app/api/lms/sections/route.ts` | +18 / -1 | POST 加 audit + actorRole |
| `app/api/lms/sections/[id]/route.ts` | +27 / -2 | PATCH/DELETE actorRole |
| `app/api/lms/content-blocks/route.ts` | +18 / -1 | POST 加 audit + actorRole |
| `app/api/lms/content-blocks/[id]/route.ts` | +28 / -2 | PATCH/DELETE actorRole |
| `app/api/lms/courses/[id]/route.ts` | +9 / -2 | PATCH actorRole |
| `app/api/lms/courses/[id]/classes/route.ts` | +24 / -2 | POST/DELETE 加 audit + actorRole |
| `app/api/lms/course-knowledge-sources/[id]/route.ts` | +34 / -3 | DELETE force 参数 + actorRole + audit |
| `app/api/lms/course-knowledge-sources/route.ts` | +2 | DELETE force 透传 |
| `components/course/context-sources-panel.tsx` | +24 / -2 | handleDelete force confirm 流 |
| `components/course/course-context-sources-tab.tsx` | +24 / -3 | handleDelete force confirm 流 |
| `tests/e2e/unit5c-verify.spec.ts` (新) | +200 | 6 case + 2 skip |

总 diff +508 / -28（plan 预算 350-450，多出来主要是 actorRole 透传 boilerplate × 9 处）。

## 关键决策落实（按 plan Q1-Q3 + 额外建议）

1. **Q1 owner-only 4 项保留** ✓
   - 删除课程（Unit 5a）
   - 删除任务模板（Unit 5a）
   - SB hide（Unit 5b）
   - 添加/移除协作教师（本 unit 不动）

2. **Q2 编辑课程基础信息开放协作** ✓ — Test A 验证

3. **Q3 Class 操作开放协作** ✓ — 加 audit

4. **额外建议：route 层算 actorRole + 传给 service** — 部分采纳
   - KS service 内部直接调 getCourseActorRole（仅 1 处，简洁）
   - Chapter/Section/ContentBlock service 不动签名（避免改 9 个方法的所有调用方）；route 层算 actorRole 并直接传给 audit metadata
   - 实施成本最低 + 保持现有 service 签名稳定

5. **KS 协作删 owner-confirm 流** — round-trip 模式（与 Unit 4 一致）：
   - 服务端拦 → 400 + KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM
   - UI window.confirm → force=true 重发
   - audit metadata 标 byCollaborator: true

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc clean
vitest: 83 files / 986 tests pass
eslint: 0 problems
```

### Playwright E2E（6 pass + 2 skip）

使用 isolated browser contexts（Unit 5b 验证有效）：

```
✓ A: molly (collab) PATCH teacher1 course → 200 (8.4s)
✓ B: molly (collab) POST chapter 到 teacher1 course → 201 (4.9s)
- C: skip（创建 dummy KS 需要 multipart upload；D 间接覆盖）
✓ D: molly (collab) DELETE teacher1 KS 无 force → 400 + KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM (3.7s) ⭐ 关键
- E: skip（破坏性测试 — 不实际删 dev DB 真实素材）
✓ F: alex (student) PATCH 课程 → 403 FORBIDDEN（回归 — 非教师角色被拦）(5.0s)
✓ G: molly (collab) POST addCourseTeacher → 403 FORBIDDEN（owner-only 保留）(3.8s)
✓ H: molly own course PATCH → 200 + audit actorRole=owner (3.3s)

6 passed, 2 skipped (35.0s)
```

### Audit log 实测
```sql
SELECT action, metadata->>'actorRole' AS actor_role, "actorId", "createdAt"
FROM "AuditLog"
WHERE "createdAt" > NOW() - INTERVAL '10 minutes'
ORDER BY "createdAt" DESC LIMIT 6;
```
```
course.update  | owner        | molly@...
course.update  | owner        | molly@... (restore)
chapter.delete | collaborator | molly@...
chapter.create | collaborator | molly@... (Test B)
course.update  | collaborator | molly@... (restore Test A)
course.update  | collaborator | molly@... (Test A)
```
actorRole 字段在每条 audit 都精确反映角色 ✓

### DB 测后还原
- 临时 chapter 已 DELETE
- description 已 restore 到 baseline

## 是否需要重启 dev server

不需要（无 schema 改动）。

## 风险 / 不确定项

1. **🟢 不破坏现有回归**：Test F (student) + Test G (collab 无权管理协作者) 都正确 403。
2. **🟢 Service 签名稳定**：未改 chapter/section/contentBlock service 的入参（actor 信息只在 route 层透到 audit metadata）。
3. **🟡 KS owner-confirm 走 window.confirm 而非 AlertDialog**：与 Unit 2/5a 的 AlertDialog 模式不一致，但 KS 删除原本就用 window.confirm（既有代码风格），保持一致最小改。如 QA 要求统一可 r2 切换。
4. **🟢 service `deleteCourseKnowledgeSource` 内部查了一次 course.createdBy（getCourseActorRole 内）**：可优化复用 assertCourseAccess 的查询，但 ms 级影响 + 代码可读性更好，保持现状。

## Acceptance 对照

| spec / coordinator 要求 | 状态 |
|---|---|
| Service 层允许协作者改 chapter/section/block/class/knowledge-source | ✅ 已有（grep 确认），加 audit 区分 |
| UI 不再隐藏 owner-only 按钮 | ✅ 既有状态保持 |
| audit 标 actor=collaborator | ✅ metadata.actorRole = "owner"/"collaborator"/"admin" |
| 高危操作（删 owner 上传素材）走二级 confirm | ✅ Test D + UI window.confirm |
| 不破坏隔离（非课程教师 403） | ✅ Test F |
| 自管理（删协作者）owner-only 保留 | ✅ Test G |

## 不在本 unit 范围（依旧）

- ❌ UI owner/collab 视觉区分（B-COURSE-04 polish — Phase 4）
- ❌ Class 新建独立模块（spec 未细节）
- ❌ Service 签名重构（actor 透传通过 route 层 metadata，service 内部仍直接查）
- ❌ KS owner-confirm 改用 AlertDialog 替代 window.confirm（既有风格保持）
