# QA Report — course-archive U4 r1（UI 回收站 + 归档按钮 + D6 真路径补验）

## Spec: U4（spec §6 U4 / D5）+ spec §11 D6 outline-apply 真路径

worktree `finsim-course-archive` / branch `claude-course-archive`；build report: `build_course-archive_u4_r1.md`

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 课程卡删除按钮去 hasContent 禁用(6 卡均含一键归档按钮，含有内容课程也可点)；头部「回收站」入口(D5)；归档确认弹窗中文+可恢复语义；回收站列已归档课程含「恢复」+「彻底删除」；彻底删除需输课程名强确认。 |
| 2. tsc --noEmit | PASS | exit 0 |
| 3. vitest run | PASS | 117 文件 / 1202 测试全绿（含 U5 已落地 +3）。0 回归。 |
| 4. Browser (/qa-only) | PASS | 真浏览器 teacher1 全流程（fixture=ZZQA 含章节的 throwaway 课程，关联 A 班）：①`/teacher/courses` 渲染 200 无 error boundary，头部「回收站」+「新建课程」并列；6 课程卡删除按钮 label「删除课程（移入回收站，可恢复）」均可点(无禁用) ②点删除→弹窗「确认删除「..」？课程及其章节内容、已发布任务将从所有页面消失，但不会被销毁——可在"回收站"中恢复或彻底删除」(正确归档文案非"不可恢复")→确认→课程从列表消失+DB deletedAt SET ③「回收站」→弹窗列已归档课程(标题/章节·任务数/删除时间)+恢复+彻底删除 ④「恢复」→POST /restore 200→DB deletedAt null→课程回列表(API+DOM 双证) ⑤「彻底删除」→弹窗输课程名：**空=按钮禁用 / 错误文本=禁用 / 精确名=启用**→确认→DELETE /purge 200→DB courseGone+chapterOrphans=0。截图 u4-teacher-courses-rendered / u4-recyclebin-open。 |
| 5. Cross-module regression | PASS | diff 仅 page.tsx(+299) + teacher-course-card.tsx(-55 净简化)；card prop onDelete→onArchive 调用方同步改；纯前端无 service/schema 改动。 |
| 6. Security (/cso) | N/A→人工核 | 彻底删除是销毁操作：UI **title-confirm 强确认门**经真浏览器验证(空/错/对三态)生效，叠加 service 层 owner/admin 守卫(U2 已验)+ confirmTitle 服务端二次校验 → R3 三重护栏完整。 |
| 7. Finsim-specific | PASS | 全中文(删除/移入回收站/恢复/彻底删除/确认文案)；UI 调 /restore /purge /archived 端点(Route Handler 薄包装)。 |
| 8. Code patterns | PASS | 卡片去禁用分支=净简化；purge 弹窗强确认门=正确的破坏性操作防护。 |

## spec §11 D6 outline-apply 真路径补验（team-lead 指派）
- **真路径 = outline 编辑器 replace 模式批量保存 → `outline-apply/route.ts:246` tx.chapter.delete()**（依赖级联）。
- QA 真 HTTP(teacher1 owner)：建 2 章课程(A 保留无内容 / B 删除含小节+内容块**无任务实例**) + syllabus 知识源(structuredData 仅列 A)；发 `mode:replace` 草稿省略 B → **200 success**；DB 核对 **chapterAKept=true / chapterBDeleted=true / sectionBCascaded=true / contentBlockBCascaded=true**。证明 U1 FK 修复覆盖真实用户路径（改前此路径撞 ContentBlock.chapterId RESTRICT→P2003→500）。
- **保留守卫验证**：给 A 章加 published 任务实例后再 replace 删 A → **400 OUTLINE_REPLACE_BLOCKED「章节「..」下还有 1 个任务，请先删除任务后再删除该章节。」**（spec §11 要求保留的有意守卫未被破坏）。

## Issues found
无 U4 范围问题。

## 观察 / flag
- **真浏览器一次性 500**（恢复后 reload）：Next.js dev overlay `Runtime SyntaxError: Unexpected end of JSON input` 带 **"(stale) Webpack"** 标记 → HMR 重编译瞬时 chunk/fetch 截断所致；**下次 reload 即 200 + fixture 正常显示**，API 数据始终正确(apiContainsFixture=true)。判定=worktree `--webpack` dev HMR 噪声，**非 U4 代码缺陷**。生产 build 不走 HMR 无此问题。
- **遗留 e2e .spec 文件**（builder flag）：`tests/e2e/qa-unit5a-delete.spec.ts` / `qa-unit5a-r2-spotcheck.spec.ts` / `unit2-verify.spec.ts` 断言**旧的"禁用+tooltip 无法删除"行为**，U4 已故意改为一键归档。已确认 vitest `include:["tests/**/*.test.ts"]` **不拾取 .spec.ts**（0 个，不入 CI、不阻塞）。但描述已被取代的设计=误导性 QA 产物 → 建议 team-lead 定夺(更新为新行为 / 删除)。QA 不擅自改测试文件。
- **详情页删除文案**（builder flag）：`/teacher/courses/[id]` EditorHero 删除按钮走 DELETE /courses/[id]（U2 已改归档语义，行为正确），但按钮/弹窗文案可能仍写"不可恢复" → 待 team-lead 定是否同步文案(spec U4 未点名详情页)。
- **预存 bug** page.tsx:1141 `course.class.id`(deprecated classId=null 崩) 仍待裁决。

## DB 卫生
- ZZQA + ZZD6 fixture(含章节/小节/内容块/任务实例/知识源) 全 purge；leftoverZZ=0，活跃课程 9=基线，归档 0。dev finsim 未 reset/seed/drop。

## Overall: PASS（UI 回收站全流程 + D6 真路径 + 保留守卫，真浏览器逐项验证）
