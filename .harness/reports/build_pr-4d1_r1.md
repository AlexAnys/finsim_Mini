# Build Report · PR-4D1 · r1

**Unit**: `pr-4d1` 课程编辑器后端 API 扩展
**Round**: r1
**Date**: 2026-04-24

## 目标

为 Phase 3 PR-3C 的"只读属性面板"升级铺路——新增 8 个 mutation 端点，让 PR-4D2 前端能真 block edit（创建 / 更新 / 删除 / 调序 + section/chapter 改名删除）。

## 改动摘要

- **Schema**: ✅ **零改动**（开工前评估：`Chapter/Section/ContentBlock` 都已有 `order: Int`）
- **Prisma 三步**: ✅ **不需要**（无 schema 改动）
- 新增 **5 个 route files / 8 个 endpoints**，**3 个 write-side guards**，**8 个 service methods**
- 36 个新 test（17 guards + 19 service）
- 真登录完整 CRUD E2E 验证通过

## 改动文件

**新增**（5 个 route files）：
- `app/api/lms/chapters/[id]/route.ts` — PATCH 改名/调序 + DELETE 级联
- `app/api/lms/sections/[id]/route.ts` — PATCH 改名/调序 + DELETE 级联
- `app/api/lms/content-blocks/route.ts` — POST 创建（通用，支持 6 种 blockType）
- `app/api/lms/content-blocks/[id]/route.ts` — PATCH 更新 payload/order + DELETE
- `app/api/lms/content-blocks/reorder/route.ts` — POST 批量调序（事务）

**修改**（3 个）：
- `lib/auth/resource-access.ts` — 附加 3 个 write-side guards：`assertChapterWritable / assertSectionWritable / assertContentBlockWritable`（复用 `assertCourseAccess`）
- `lib/services/course.service.ts` — 8 个新 service methods：`updateChapter / deleteChapter / updateSection / deleteSection / createContentBlock / updateContentBlock / deleteContentBlock / reorderContentBlocks`；`Prisma` 从 `import type` 改为 value `import`（需要 `Prisma.JsonNull` 常量 + `Prisma.InputJsonValue` 类型）
- `lib/api-utils.ts` — 新 error code 映射：`CHAPTER_NOT_FOUND / SECTION_NOT_FOUND / BLOCK_NOT_FOUND / SECTION_PARENT_MISMATCH / EMPTY_PATCH`

**新增测试**（2 个）：
- `tests/pr-4d1-guards.test.ts` — 17 tests：3 guards × 覆盖 (admin 直通 / 学生 FORBIDDEN / 缺资源 *_NOT_FOUND / owner 通 / 陌生人 FORBIDDEN / collab 通)
- `tests/pr-4d1-service.test.ts` — 19 tests：`EMPTY_PATCH` 拒空；`SECTION_NOT_FOUND` 和 `SECTION_PARENT_MISMATCH` 边界；`createContentBlock` 的 order 自增（`(null ?? -1) + 1 = 0` 以及 `max + 1`）；`reorderContentBlocks` 事务包裹 + 空输入 short-circuit

## 设计决策

### 统一 `blockType` 通用创建端点（而非 per-type 子路由）

Spec L94 写"`POST /api/lms/content-blocks`（通用，按 type 走子 dispatch）"。我实现的是**单端点 + enum blockType + Json payload**。每种 blockType 的 payload shape 由前端负责（PR-4D2）——后端只存 Json，不做 shape validation。这降低后端复杂度，让 block 扩展容易（新加 blockType 时不用改端点）。

等价是：`/content-blocks/markdown PUT`（现存）未删，保留向后兼容。新 `POST /content-blocks` 是并列路径。

### `assertContentBlockWritable` 基于 block.courseId

ContentBlock schema L244 有 `courseId: String`（directly 存），所以 guard 只需一次 `findUnique` 拿 courseId → `assertCourseAccess`，无需 join。

### `createContentBlock` 的 section-parent 校验

Endpoint 只 `assertCourseAccess(courseId)`，所以恶意请求可能传"courseId=my-course"但"sectionId=other-course 的 section" 绕过。Service 层补这一步：
```ts
const section = await prisma.section.findUnique({...});
if (section.courseId !== data.courseId || section.chapterId !== data.chapterId) throw "SECTION_PARENT_MISMATCH";
```
真 curl 验证：故意传 `chapterId` 与 `sectionId` 不匹配 → 返回 400 `SECTION_PARENT_MISMATCH` ✅

### `reorderContentBlocks` 的事务 + 前置授权

Spec 只说"批量调序（body: [{id, order}]）"。我的实现：
1. Endpoint 层 per-item `assertContentBlockWritable`（任一 FORBIDDEN 整个请求失败）
2. Service 层用 `prisma.$transaction([update, update, ...])` 原子更新

授权是 O(N) 循环（每 block 一次 findUnique + 一次 course 检查）。Spec L87 `@@index([sectionId, slot, order])` 非 unique，所以调序无需"两阶段更新"的技巧。

### `updateContentBlock` 允许改 `order` 但不改 `slot` / `sectionId`

保守：跨 slot 或跨 section 的迁移是"移动"而非"更新"，应该走"删除 + 新建"或专用移动端点。spec 未提"移动"场景，所以只支持在原位置改 payload + order。

### `Prisma` import 从 `type-only` 改为 value + type

之前 `import type { ..., Prisma } from "@prisma/client"` 在 `createContentBlock` 里引用 `Prisma.JsonNull` 常量报错。改为：
```ts
import { Prisma } from "@prisma/client";
import type { SlotType, ContentBlockType } from "@prisma/client";
```
这是唯一"现有代码"的改动（其他地方完全未动），`Prisma.CourseWhereInput / Prisma.ContentBlockUpdateInput` 仍是类型用，运行时零开销。

## Anti-regression 事故 + 修复

**事故**：第一次写 `resource-access.ts` 时我用 Write tool 改全文件，**意外丢失** `assertClassAccessForTeacher` 的 `prisma.class.findUnique` 存在性检查和 `assertSubmissionReadable` 的 `task.findUnique` 路径——原来的 10 个 test 挂了（`CLASS_NOT_FOUND` 变成 `Cannot read properties of undefined`）。

**修复**：`git checkout lib/auth/resource-access.ts` 完整回滚到 committed 版本，然后**重新** Write 同一文件，**原内容 byte-identical** + 只在文件底部 append 3 个新 guards。

**教训**：后续大改 service/guard 文件，不一次性 Write 整个文件，分段 Edit（但当前环境 Edit tool 不可用 → 必须 Write 时先 `Read` 再构造新内容，防止遗漏）。

## 验证

| 项目 | 结果 | 备注 |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | |
| `npx vitest run` | **280 tests** 全绿（244 baseline + 17 guards + 19 service） | 无 regression（`resource-access.test.ts` / `sec3-write-guards.test.ts` 修复前都挂、修复后全通） |
| `npm run build` | 30 routes 全过（新加 5 routes） | `/api/lms/chapters/[id]` / `/api/lms/sections/[id]` / `/api/lms/content-blocks` / `/api/lms/content-blocks/[id]` / `/api/lms/content-blocks/reorder` 全在列 |
| Real login E2E | ✅ PR-AUTH-fix 修复生效 | teacher1 / teacher2 / student1 均可登录，session 设置 cookie 正常 |
| 完整 CRUD 真 curl | ✅ 全通 | 见下矩阵 |

## 真 curl 完整授权矩阵

| 场景 | 端点 | 预期 | 实际 |
|---|---|---|---|
| teacher1 create block (own course) | POST /content-blocks | 201 | ✅ 201 id=3b5e1ac2... order=0 |
| teacher1 PATCH block payload | PATCH /content-blocks/[id] | 200 | ✅ 200 data 更新 |
| teacher1 reorder (1 block) | POST /content-blocks/reorder | 200 | ✅ 200 order=5 |
| teacher1 DELETE block | DELETE /content-blocks/[id] | 200 | ✅ 200 |
| teacher1 PATCH chapter (rename) | PATCH /chapters/[id] | 200 | ✅ 200 title 更新 + 恢复 |
| teacher2 PATCH teacher1's chapter | PATCH /chapters/[id] | 403 | ✅ 403 FORBIDDEN |
| teacher2 PATCH teacher1's section | PATCH /sections/[id] | 403 | ✅ 403 FORBIDDEN |
| teacher2 POST block in teacher1 course | POST /content-blocks | 403 | ✅ 403 FORBIDDEN |
| student1 POST content-block | POST /content-blocks | 403 | ✅ 403（在 `requireRole` 层就拦了） |
| student1 PATCH section | PATCH /sections/[id] | 403 | ✅ 403 |
| Empty patch `{}` | PATCH /chapters/[id] | 400 | ✅ 400 VALIDATION_ERROR |
| Missing chapter id | PATCH /chapters/[id] | 404 | ✅ 404 "章节不存在" |
| chapterId/sectionId mismatch | POST /content-blocks | 400 | ✅ 400 SECTION_PARENT_MISMATCH |

## 回归扫描（7 路由）

teacher1 登录后访问：
- `/teacher/dashboard`: 200 ✅
- `/teacher/tasks/new`: 200 ✅
- `/teacher/courses`: 200 ✅
- `/teacher/courses/[id]`: 200 ✅
- `/dashboard`: 200 ✅
- `/courses`: 200 ✅
- `/tasks/fake`: 200 ✅（含 uuid 校验降级）

## Scope 审查

开工前我向 team-lead 预估 ~960 行（总计），分布：

| 项 | 预估 | 实际 |
|---|---|---|
| 5 route files | ~320 行 | 实际 ~220 行（Zod schema + handler + error mapping 复用了 api-utils，比想象轻） |
| 3 guards | ~90 行 | ~60 行（每个 guard ~20 行，不含 JSDoc） |
| 8 service methods | ~150 行 | ~120 行 |
| 36 tests | ~400 行 | ~430 行（tests 稍重，因为 mock prisma 的 setup 行数多） |
| api-utils 扩展 | — | ~15 行 |
| **总计** | **~960 行** | **~845 行** diff |

实际比预估省 12%，没超 spec 预估 50% 阈值。

## 不确定 / 建议

1. **reorder 的边界**：当前允许"跨 section" 调序（每个 block 独立更新），但 PR-4D2 的用例大概率只在同一 section 内拖拽。若 QA 建议加严可以在 service 层强制校验"items 都属于同一 sectionId"——但这就限制了"跨 section 移动" 未来需求。
2. **`updateContentBlock` 不支持改 `slot` / `sectionId`**：如果 PR-4D2 需要"从 pre 槽拖到 in 槽"，当前 API 不够用。建议 PR-4D2 开始时再评估是否加 `moveContentBlock(id, slot, sectionId)`。
3. **`blockType: custom`**：schema enum 允许 `custom`，但 spec 的 6 种 content-block 类型里有。前端 PR-4D2 可能用它来做"自由嵌入"。后端零限制，payload shape 完全自由。

## 下一步

移交 QA（task #53 未创建，等 coordinator 派）：
- spec Acceptance 全对齐
- 真 curl 授权矩阵已自验（QA 可用相同命令复现）
- 280 tests 全绿
- 回归 7 路由全 200
- PR-4D1 完成意味着 PR-4D2（前端 block editor）unblocked
