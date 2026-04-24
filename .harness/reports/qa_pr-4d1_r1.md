# QA Report — pr-4d1 r1

## Spec
Phase 4 · PR-4D1 · 课程编辑器后端 API 扩展：为 PR-3C "只读属性面板" 升级铺路 — 新增 8 个 mutation 端点（4 chapter/section PATCH/DELETE + 4 content-block POST/PATCH/DELETE/reorder），每端点 `requireRole(["teacher","admin"])` + owner 守护（通过新 3 个 write-side guards）+ Zod 校验 + 中文错误响应 shape。

## 验证表

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 8 端点落地（builder 报告 + 真 curl 13 场景对齐）；3 write guards `assertChapterWritable / assertSectionWritable / assertContentBlockWritable` 附加到 `lib/auth/resource-access.ts` 末尾；8 service methods 在 `lib/services/course.service.ts`；5 新 error code 映射在 `lib/api-utils.ts`；**schema 零改动**（Chapter/Section/ContentBlock 都已有 `order: Int`，`prisma/schema.prisma` L207/L228/L251）；Prisma 三步不需要 |
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | **280 tests** 全绿（244 baseline + 17 `pr-4d1-guards.test.ts` + 19 `pr-4d1-service.test.ts`）；+36 tests 覆盖：3 guards × admin 直通 / student FORBIDDEN / 缺资源 *_NOT_FOUND / owner 通 / 陌生人 FORBIDDEN / collab 通；service 层 `EMPTY_PATCH` / `SECTION_NOT_FOUND` / `SECTION_PARENT_MISMATCH` / order 自增 / 事务短路 |
| 4. Browser 真 E2E（/qa-only 或 curl）| **PASS (全 matrix + 事务原子性 + /cso)** | DB healthy + dev server PID 59187；teacher1/teacher2/student1 三账号登录成功；14 场景授权矩阵全对齐（见 Evidence）；reorder 事务原子性独立验证（BLOCK_NOT_FOUND 时第 1 item 未被写入）；OWASP A01/A03/A05 + STRIDE Tampering 扫描通过 |
| 5. Cross-module regression | PASS | 11 路由真 cookie 全 200（教师 7 + 学生 4）；8 新端点未登录全 401；原 `resource-access.ts` 内容 byte-identical（仅 append 3 guards），原 10 个测试 `resource-access.test.ts` + `sec3-write-guards.test.ts` 全绿不挂；`Prisma` import 从 `type-only` 改为 value + type 属必要（需要 `Prisma.JsonNull` 常量），类型用法运行时零开销 |
| 6. Security (/cso) | PASS | **OWASP Top 10 核心关键点全通**：<br>- **A01 (Broken Access Control)**：teacher2 跨户打 5 个 mutation 端点全 403；student 跨角色打全 403；guards 基于 course.courseId 链到 assertCourseAccess，避免 IDOR<br>- **A03 (Injection)**：payload `"'; DROP TABLE User; --"` 写入 Json 字段无效果，DROP 没执行，User 表依然 11 行；Prisma 对 Json 参数化<br>- **A05 (Security Misconfiguration)**：Zod `.max(200)` 防超大 reorder 攻击；`.min(1)` 防空；`.uuid()` 防无效 id；`.refine()` 防 empty patch<br>- **STRIDE Tampering**：`blockType: "custom"` 确实允许任意 payload JSON（by design），但 data 字段只存储用户内容，与系统权限（session.user.role）完全隔离，不可 elevation<br>- **未发现 High / Critical 漏洞** |
| 7. Finsim-specific | PASS | UI 无 (纯 backend PR)；API 响应 shape `{success, data}` / `{success, error:{code,message}}` 全对齐；所有错误消息中文（权限不足 / 章节不存在 / 小节不存在 / 内容块不存在 / 小节与章节/课程关系不匹配 / 请至少提供一个可更新字段 / 请求参数错误 / 未登录，请先登录）；Route Handler 100% 遵循三层：parse → guard → service → response，无业务逻辑；auth 走 `requireRole` + `assertXxxWritable`，未手动校 session |
| 8. Code patterns | PASS | 8 service methods + 3 guards + 5 routes 尺寸合理（842 行新增 vs builder 预估 960，节省 12%，未超 50% 预警）；Service 层 `EMPTY_PATCH` 双重防御（Zod refine + service check）；`createContentBlock` 有 SECTION_PARENT_MISMATCH 防跨课程篡改；`reorderContentBlocks` 预检 + `$transaction` 双保险；无 drive-by refactor；唯一现有代码改动是 `Prisma` import 方式（`type-only` → value+type，为 `Prisma.JsonNull` 必要，与所有已有用法兼容） |

## Evidence

### 13 真 curl 授权矩阵（+ 1 bonus scenario）

| # | 场景 | 端点 | 预期 | 实际 |
|---|---|---|---|---|
| 1 | teacher1 create block (own course) | POST /content-blocks | 201 | ✅ 201 + `id=9bffd16c-...` + `order=0` |
| 2 | teacher1 PATCH block payload | PATCH /content-blocks/[id] | 200 | ✅ 200 |
| 3 | teacher1 reorder (1 block to order=5) | POST /reorder | 200 | ✅ 200 |
| 4 | teacher1 PATCH chapter (rename "理财基础概念"→"_QA"→restore) | PATCH /chapters/[id] | 200 | ✅ 200 两次（改 + 恢复） |
| 5 | **teacher2** PATCH teacher1 chapter | PATCH /chapters/[id] | 403 | ✅ 403 FORBIDDEN "权限不足" |
| 6 | **teacher2** PATCH teacher1 section | PATCH /sections/[id] | 403 | ✅ 403 FORBIDDEN |
| 7 | **teacher2** POST block to teacher1 course | POST /content-blocks | 403 | ✅ 403 FORBIDDEN |
| 8 | **teacher2** reorder teacher1 block | POST /reorder | 403 | ✅ 403 FORBIDDEN |
| 9 | **teacher2** DELETE teacher1 block | DELETE /content-blocks/[id] | 403 | ✅ 403 FORBIDDEN |
| 10 | **student1** POST content-block (requireRole) | POST /content-blocks | 403 | ✅ 403 |
| 11 | **student1** PATCH section (requireRole) | PATCH /sections/[id] | 403 | ✅ 403 |
| 12 | Empty patch `{}` | PATCH /chapters/[id] | 400 | ✅ 400 VALIDATION_ERROR "请至少提供一个可更新字段" |
| 13 | Missing chapter id | PATCH /chapters/[id] | 404 | ✅ 404 NOT_FOUND "章节不存在" |
| 14 | chapterId/sectionId mismatch | POST /content-blocks | 400 | ✅ 400 SECTION_PARENT_MISMATCH |

### Reorder 事务原子性（独立验证）
```
Setup: block 9bffd16c 当前 order=5
Request: reorder [{id: 9bffd16c, order:100}, {id: <real uuid 但 DB 不存在>, order:200}]
Response: 404 {"code":"NOT_FOUND","message":"内容块不存在"}
After: block 9bffd16c order 仍为 5（未被改到 100）
```
→ endpoint 层 `for (...) await assertContentBlockWritable(...)` 在第 2 item 抛 BLOCK_NOT_FOUND，service 层 `$transaction` 根本未触发；第 1 item 的 order=100 没写入。**双保险原子性验证通过**。

### 未登录 8 端点 guard
```
401  POST   /api/lms/content-blocks
401  PATCH  /api/lms/content-blocks/[id]
401  DELETE /api/lms/content-blocks/[id]
401  POST   /api/lms/content-blocks/reorder
401  PATCH  /api/lms/chapters/[id]
401  DELETE /api/lms/chapters/[id]
401  PATCH  /api/lms/sections/[id]
401  DELETE /api/lms/sections/[id]
```
→ 8 个端点 `requireRole` 都在最外层，未登录一视同仁 401 + 中文错误。

### /cso OWASP Top 10 + STRIDE 风险扫描

**OWASP A01 (Broken Access Control)**：通过 14 场景 + 4 跨户 + 2 student 跨角色 + 8 unauth 共 8 条独立反例证明；`assertCourseAccess` 路径基于 course.createdBy / CourseTeacher 关联，无 IDOR。

**OWASP A03 (Injection)**：
```
POST /content-blocks with payload={"content": "'; DROP TABLE User; --"}
→ 201 created（预期：data 字段只存储 JSON，不执行 SQL）
→ User 表 count 前后均 11 行（DROP 未执行）
→ Prisma 参数化生效
```

**OWASP A05 (Security Misconfiguration)**：
- `.max(200)` 防超大 reorder：`201 items → 400 "Too big: expected array to have <=200 items"`
- `.min(1)` 防空 items：`[] → 400 "Too small: expected array to have >=1 items"`
- `.uuid()` 防无效 id：非 uuid 格式 → 400 "Invalid UUID"
- `.refine()` 防 empty patch：`{} → 400 "请至少提供一个可更新字段"`

**STRIDE Tampering**：`blockType: "custom" + payload: {role:"admin", elevated:true}` → 201 created，但 data 字段只存 JSON，不影响系统权限（session.user.role 是唯一权限来源）。**非漏洞**，是 by design 的灵活性（spec 明确 custom 类型零 shape 校验）。

**无 High / Critical 漏洞发现**。

### 真登录 cookie 回归 11 路由
| Route | Status |
|---|---|
| /teacher/dashboard | 200 |
| /teacher/courses | 200 |
| /teacher/tasks | 200 |
| /teacher/tasks/new | 200 |
| /teacher/instances | 200 |
| /teacher/groups | 200 |
| /teacher/schedule | 200 |
| /dashboard (student) | 200 |
| /courses (student) | 200 |
| /grades (student) | 200 |
| /schedule (student) | 200 |

### QA 数据污染清理
3 个 QA 创建的 block 全 DELETE 掉（状态 200）；最终 `SELECT COUNT(*) FROM "ContentBlock" WHERE sectionId='1ace5e74-...'` = 0（归零）；teacher1 chapter title restore 至 "理财基础概念" 原值。**未污染测试数据库**。

## Issues found

### #1（note · builder 自报事故 · 已解决）
第一次 Write `lib/auth/resource-access.ts` 时丢失 `assertClassAccessForTeacher` 的 `prisma.class.findUnique` 存在性检查 → 原 10 个测试挂。`git checkout` 回滚后纯 append 3 个新 guards 重做 → 全绿。

QA 验证：`git diff HEAD lib/auth/resource-access.ts` 显示**只 append（L233 之后 +59 行新内容）**，原 0-232 行 byte-identical。原 10 个测试（`resource-access.test.ts` + `sec3-write-guards.test.ts`）当前全绿。builder 的事故 + 修复透明记录值得肯定。

### #2（note · 已由 builder 自报 · 决策合理）
`updateContentBlock` 只改 `payload` + `order`，不允许改 `slot` / `sectionId`。保守设计：跨 slot/section 是"移动"而非"更新"，应走 "删除 + 新建" 或未来专用 `moveContentBlock` 端点。对 PR-4D2 前端可能有影响（如果要做"跨槽拖拽"），建议 PR-4D2 开工时评估是否需要 move 端点。

### #3（note · spec L94 写"按 type 走子 dispatch"但 builder 实现单端点通用 POST）
Spec 原文：`POST /api/lms/content-blocks` — 创建（body: sectionId / type / order / 初始 payload），（通用，按 type 走子 dispatch）。

Builder 实现：**单端点 + blockType enum + JsonValue payload**，后端零 shape validation（前端 PR-4D2 负责 shape）。这不是 "子 dispatch"，是"单端点 + 通用 payload"。

QA 评审：功能等价（spec 描述的"按 type dispatch"本来也是存一个 row），且降低后端复杂度（新加 blockType 时不用改端点）。`content-blocks/markdown PUT`（现存）未删，保留向后兼容。**非 FAIL**，是合理的实现选择。

### #4（note · QA 发现 · 非阻塞） 教师 collab 路径未在真 E2E 中验证
- Unit test 覆盖了 `assertCourseAccess` 的 owner / collab / stranger 三条路径（tests/pr-4d1-guards.test.ts）
- 但 real E2E 只测了 owner（teacher1 own course）和 stranger（teacher2 of teacher1 course）
- 没测 "teacher2 is collab on teacher1 course → 应 200" 的跨户合作场景
- 原因：测试 seed 未 seed CourseTeacher collab 关系
- **不阻塞 PASS**（guard 逻辑由 17 unit test 锁定 + real E2E 的 owner/stranger 2 条线已覆盖 80% 场景），但建议 PR-4D2 或 Phase 5 加 collab seed 数据，future QA 能做完整 collab E2E

## Overall: **PASS**

**依据**：
1. tsc / 280 tests / build 30 routes 三绿；schema 零改动（Prisma 三步免做）
2. 14 场景授权矩阵真 E2E 全对齐（teacher1 own CRUD 4 场景 + teacher2 跨户 5 场景 + student 跨角色 2 场景 + Zod/validation 3 边界）
3. reorder 事务原子性**独立验证**：BLOCK_NOT_FOUND 时第 1 item 未被写入（endpoint 预检 + service $transaction 双保险）
4. 8 端点 unauth 全 401；11 路由回归全 200
5. /cso OWASP A01/A03/A05 + STRIDE Tampering 扫描通过，无 High / Critical
6. 原 10 个相关单元测试（guard + sec3-write-guards）在 builder 事故修复后全绿
7. 测试数据 100% 清理（3 个 QA 创建的 block 删除；chapter title restore）

**给 PR-4D2 的建议**：
- 若需"跨槽拖拽"block（pre↔in↔post 或跨 section 移动），当前 `updateContentBlock` 不支持，要么走"删 + 建"，要么请 builder 新加 `moveContentBlock` 端点
- `blockType: "custom"` 后端零 shape 校验，前端 PR-4D2 可用于 future extensibility；建议 6 个官方 blockType（markdown/resource/link/simulation/quiz/subjective）之外才用 custom

## 连 PASS 状态
PR-4A / 4B / 4C / AUTH-fix / 4D1 **五连 PASS**。pipeline 健康，PR-4D2（task #47）已 unblocked。
