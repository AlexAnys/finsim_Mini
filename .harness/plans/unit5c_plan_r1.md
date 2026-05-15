# Unit 5c Plan — 协作教师权限上扬

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 5（用户决策 #5）
> Bug: B-COURSE-04（"协作教师在 owner 课程上看到完整 owner 级按钮，权限边界不清"）

## 重要发现（grep 调研结果）

**codebase 已经基本上协作友好**！按 service 维度盘点：

| 操作 | service 函数 | 当前权限 |
|---|---|---|
| 课程 PATCH（title/desc/semesterStartDate）| `/api/lms/courses/[id]/route.ts` PATCH | ✅ `assertCourseAccess`（owner+collab）|
| Chapter CRUD | service 无 access 检查；API 用 `assertCourseAccess` | ✅ collab |
| Section CRUD | 同上 | ✅ collab |
| ContentBlock CRUD | 同上 | ✅ collab |
| CourseClass add/remove | service 无 access；API 用 `assertCourseAccess` | ✅ collab |
| CourseTeacher add/remove | 用 `assertCourseOwnerOrAdmin`（自定义本地函数）| ⚠️ owner-only — **保留**（管理协作者需 owner 权） |
| Announcement create | 内联 collab 检查 | ✅ collab |
| KnowledgeSource CRUD | API 用 `assertCourseAccess` | ✅ collab |
| Course DELETE | `deleteCourse` createdBy === userId | ✅ owner-only（Unit 5a 决策）|
| Task DELETE | `deleteTask` task.creatorId === userId | ✅ task.creator-only（Unit 5a）|
| SB hide | `hideStudyBuddyPost` task.creator-only | ✅ task.creator-only（Unit 5b）|

**实际差距**（B-COURSE-04 真正未解决的）：
1. ❌ **缺 audit log**：chapter/section/contentBlock/course PATCH/KS create+delete 都没写 audit。无法事后追溯"是谁改了什么"。
2. ❌ **没有 byCollaborator 元数据**：即使写 audit，也分不清是 owner 还是 collab 操作。
3. ❌ **协作删除 owner 上传素材无二级 confirm**：spec 明确要求"协作者删 owner 素材必弹二级 confirm + audit"。当前 UI 协作可直接删，没特殊提示。
4. ⚠️ **UI 无 owner/collab 视觉区分**：collab 看到的 UI 与 owner 完全相同（包括"添加章节""协作教师"等），易混淆。spec 不强要求改 UI 显示边界，但 KS 删除 confirm 必须做。

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `lib/services/course-knowledge-source.service.ts` | 改 | `deleteCourseKnowledgeSource` 加 audit log + `byCollaborator` metadata + 接收 `confirmedDeleteOwnerMaterial: boolean` 参数 |
| `app/api/lms/course-knowledge-sources/[id]/route.ts` | 改 | DELETE 加 actor-role 判断 + 调 service 传 confirm 标记 + 接收 query/body `force=true` 跳过协作删 owner 的拒绝 |
| `lib/services/course.service.ts` | 改 | createChapter / updateChapter / deleteChapter / createSection / updateSection / deleteSection / createContentBlock / updateContentBlock / deleteContentBlock 加 audit log + actorRole metadata（共 9 个方法）|
| `app/api/lms/courses/[id]/route.ts` | 改 | PATCH 已有 audit；加 actorRole metadata + isOwner 标 |
| `app/api/lms/{chapters,sections,content-blocks}/[id]/route.ts` | 改 | 传 actor 信息到 service（service 写 audit 需要 actorId + actorRole）|
| `lib/api-utils.ts` | 改 | 加 `KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM` 错误码 |
| `components/course/context-sources-panel.tsx` 或类似 | 改 | KS 删除按钮：如果当前 user.id !== source.teacherId（即非自己上传），先弹"协作者二级 confirm"，确认后第二次 DELETE 带 `force=true` |
| `tests/e2e/unit5c-verify.spec.ts` | 新 | 6-8 case |

注：协作权限上扬本质是"already 收口在 service/API 的访问权放开 + 加 audit 区分 actor 角色"。**不重写权限模型**。

## 关键决策（coordinator 要审）

### Q1: owner-only 保留范围

按 spec + 既有实现，**保留 4 项**：
1. ✅ 删除课程（Unit 5a 实施 owner-only）— 不动
2. ✅ 删除任务模板（Unit 5a 实施 task.creator-only）— 不动
3. ✅ SB hide（Unit 5b 实施 task.creator-only）— 不动
4. ✅ 添加/移除协作教师（addCourseTeacher / removeCourseTeacher）— **本 unit 保留 owner-only**（管理协作者列表是 owner 权）

### Q2: 编辑课程基础信息（courseTitle / description）协作开放

`/api/lms/courses/[id]/route.ts` PATCH 当前用 `assertCourseAccess`（已允许 collab）。**保留现状**（已开放），仅加 audit + actorRole。

### Q3: Class 操作（addCourseClass / removeCourseClass）协作开放

`/api/lms/courses/[id]/classes/route.ts` 已用 `assertCourseAccess`（已允许 collab）。**保留现状**，加 audit。

### Q4: 协作者删 owner 上传素材二级 confirm 设计

**API 行为**：
- DELETE `/api/lms/course-knowledge-sources/[id]` 现在直通
- 改为：若 `requester.id !== source.teacherId` 且 `!body.force` → 抛 `KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM` (400)
- 协作者前端拦到该错误码 → 弹 AlertDialog "这是 {ownerName} 上传的素材，确认删除？" → 用户确认后 PATCH body 加 `force: true` 再调一次
- 自删（teacherId === user.id）正常直通

**Audit**：每次 DELETE 都写 audit，metadata 含 `byCollaborator` 和 `fileName / ownerTeacherId / actor.role`。

## 风险点

1. **🔴 9 个 service 方法加 audit 是大改动**：每个都需要 actorId + actorRole 参数，要 grep 所有调用方
2. **🟡 backward compat**：旧调用方未传 actorId → 加 optional + audit 跳过（不写 audit 比 throw 安全）
3. **🟢 协作删 owner 素材的拦截在 service 层**：route 不动逻辑，service 检查；前端拦错码弹 dialog
4. **🟡 协作者可改课程基础信息（title/desc）的演示风险**：用户已批准（决策 #5 含"结构"）
5. **🟡 UI 没改 owner/collab 视觉区分**：B-COURSE-04 期望权限边界清晰，但 spec 没要求，本 unit 不做（可 Phase 4 polish）

## 自测计划

### 自动化
1. tsc + vitest + eslint
2. e2e 6-8 case

### e2e 计划
- **A**: molly 协作教师在 teacher1 的课程上 PATCH course title → 200 + audit actorRole=collaborator
- **B**: molly 协作教师在 teacher1 课程上加章节 → 200 + audit
- **C**: teacher1（owner）删自己上传的素材 → 200 直通（无 confirm）
- **D**: molly（collab）删 teacher1 上传的素材 → 400 KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM
- **E**: molly（collab）带 force=true 删 teacher1 素材 → 200 + audit byCollaborator=true + actorRole=collaborator
- **F**: 非课程教师（如 belle）改课程 → 403 FORBIDDEN（回归测）
- **G**: 协作教师调用 addCourseTeacher → 403 FORBIDDEN（owner-only 保留）

### 手动验证
- molly 登录 → teacher1 的课程详情 → 改个 title → 看 audit log
- molly 登录 → 删 teacher1 的素材 → 看 AlertDialog "..."

## diff 预算

预计 350-450 行：
- service +160（9 方法各 +10-20 audit）
- routes +40
- KS UI confirm dialog +60
- e2e +120

## 不做的范围

- ❌ UI owner/collab 视觉区分（B-COURSE-04 polish，Phase 4）
- ❌ Class 新建（addClass 整体，spec 未细节）— 只做 CourseClass 关联
- ❌ 协作者管理协作者（owner-only 保留）
- ❌ 移植 ContentBlock 编辑面板（已废弃组件，Unit 5c 不动）

## 待 coordinator 确认

1. Q4 设计：API 拦 `KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM` → 前端弹 + force=true 重发 — 这个 round-trip 模式 OK？或者更倾向：API 不拦，前端在请求前先 fetch source.teacherId 判断 → 弹 confirm → 再调 DELETE？

   **我倾向 API 拦**（与 Unit 4 `TASK_HAS_GRADED_SUBMISSIONS` 模式一致），单次 round-trip 失败就拦，前端不需要"预先 fetch"开销。

2. 是否对所有 audit 加 `actorRole` 字段？默认 audit.service `logAuditForced` 只传 actorId。我会在每个 service 函数内查 course.createdBy 推断 actorRole（owner / collaborator / admin），存进 metadata.actorRole。

3. 协作教师 e2e 测试需要 molly 是 teacher1 课程的协作者。请 dev DB 确认这个关系存在（之前 probe 报告显示存在）。
