# QA Report — course-archive U1 r1

## Spec: U1 schema 地基 + 章节删除 FK 修复 + P2003 兜底（spec §6 U1 / 验收 §6·§7·§8 前提 / D6）

worktree `finsim-course-archive` / branch `claude-course-archive`；build report: `build_course-archive_u1_r1.md`

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | diff = 仅 schema.prisma(+deletedAt nullable+@@index, ContentBlock.chapter→Cascade) + api-utils.ts(P2003 兜底) + 新 migration + p2003 test + cascade 验证脚本。无 drive-by。`deletedAt` 唯一真源已立（D1）；FK 修复（D6）；purge 三条 RESTRICT 中 ContentBlock.chapterId 已解、Section.courseId/ContentBlock.courseId 保留待 U2。 |
| 2. tsc --noEmit | PASS | exit 0，无输出 |
| 3. vitest run | PASS | 全套 116 文件 / 1191 测试全绿（含新 api-utils-p2003.test.ts；隔离单跑 1/1 PASS）。注：首跑见 4 个 `course-archive.service.test.ts` 失败=U2 archiveCourse RED 阶段（彼时未实现），非 U1 范围；builder 已在我复核期间补齐 U2 impl，复跑 0 失败、0 回归。 |
| 4. Browser (/qa-only) | PASS | 真浏览器 teacher1 登录（session 验证返回 王教授/teacher/4dbbe635）→ 对一个带 section+contentBlock 的 throwaway 章节发 `DELETE /api/lms/chapters/{id}` → **HTTP 200 `{success:true,data:{id}}`**（改前会 P2003→500）。课程编辑页 `/teacher/courses/{id}` 加载 200 无 500。截图 `.harness/screenshots/course-archive-qa/u1-d6-course-after-chapter-delete.png` |
| 5. Cross-module regression | PASS | DB SQL 级核对 FK confdeltype：ContentBlock_chapterId=c(CASCADE 已改)/ContentBlock_courseId=r(保留)/Section_courseId=r(保留)/Section_chapterId=c(未误改)/ContentBlock_sectionId=c(未误改)。Prisma client 接受 `deletedAt` filter/select 无 ValidationError（运行时 500 陷阱已规避）。migrate status: 25 migrations，DB up to date。 |
| 6. Security (/cso) | N/A | U1 未触碰 auth/权限/支付逻辑（P2003 兜底仅错误映射；FK 是 DB 约束）。学生守卫加固在 U3。 |
| 7. Finsim-specific | PASS | P2003 映射返回中文 `操作失败：存在关联数据，请先处理相关内容后再试` + code `FK_CONSTRAINT_FAILED` + 409，走 `handleServiceError` / `{success:false,error:{code,message}}` 标准格式。Route Handler 无业务逻辑。 |
| 8. Code patterns | PASS | 根因修复（FK RESTRICT→Cascade 直击 ContentBlock.chapterId），非绕过。migration 纯 additive（ADD COLUMN nullable + CREATE INDEX + FK 重建），对共享 dev DB 安全（R6）。diff 受控。 |

## Prisma 三步核对（R4）
- migrate（20260525015540 已应用）→ generate（client 接受 deletedAt）→ dev server 重启（webpack/:3003，页面 200）：全部完成。DB 实测 deletedAt 列存在(timestamp,nullable)+索引 Course_deletedAt_idx 存在。

## 真 DB 级联证明
- builder `scripts/verify-chapter-cascade.mjs` 独立复跑 PASS，throwaway rows 自清理 leftover=0。
- QA 自建 teacher1-owned fixture 走真 HTTP DELETE 后 DB 核对：chapterGone=true / sectionCascaded=true / blockCascaded=true / courseSurvives=true。fixture 已清理，0 leftover。

## Issues found
无。

## 观察（不阻塞 U1，供后续注意）
- 当前 UI 无任何前端按钮调用 `DELETE /api/lms/chapters/{id}`：live 结构编辑器（chapter-section-list）只 wire 了 section/block/draft/course 删除；课程编辑页"删除章"按钮（page.tsx:2201）属草稿大纲表单，仅改本地 array 经批量保存 reconcile。U1 修复在 service+schema 层，端点无关，已通过真 HTTP 验证。若产品希望 live 编辑器直接删章节，是 UI wiring 的后续话题（非本 spec 范围）。
- dev 环境 quirk（非代码问题）：`/api/auth/providers` 显示 NEXTAUTH_URL=:3030 而 dev server 在 :3003；未阻塞 credential 登录（cookie 同源设置成功），仅记录。

## Overall: PASS
