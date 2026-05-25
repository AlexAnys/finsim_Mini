# QA Report — course-archive U2 r1

## Spec: U2 archive/restore/purge service + API（spec §6 U2 / 验收 §3·§4 / §8 purge 顺序 / F5 / R2·R3·R5）

worktree `finsim-course-archive` / branch `claude-course-archive`；build report: `build_course-archive_u2_r1.md`

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | archiveCourse 无 COURSE_HAS_* 闸（兑现"无须先清空章节/实例"）；restoreCourse 清 deletedAt 不动实例；getArchivedCourses teacher=AND[deletedAt not null, teacherCourseFilter]/admin=deletedAt not null；purgeCourse confirmTitle 强校验 + 事务按 §8 承重次序 + 不删 Task(F5)。DELETE 语义改归档、新增 restore/purge/archived 三端点。 |
| 2. tsc --noEmit | PASS | exit 0 |
| 3. vitest run | PASS | 全套 116 文件 / 1191 测试全绿（U2 新增 course-archive.service.test.ts 11 + course-archive.api.test.ts 12，0 回归）。service 测试断言 purge 承重次序 contentBlock→section→chapter→course、course.delete 最后、tx.task 永不调用——非 tautological。 |
| 4. Browser/HTTP (/qa-only) | PASS | 真浏览器 teacher1 session 下真 HTTP 全端点矩阵：①archive 带 chapter+instance 课程→200 {archived:true}（无 HAS_* 闸）②restore→200 {restored:true} ③GET /archived→200 count=1 containsFresh=true allArchived(deletedAt≠null)=true ④purge wrong title→400 PURGE_TITLE_MISMATCH「课程名称输入不一致，已取消彻底删除」⑤purge empty body→400 VALIDATION_ERROR ⑥purge correct title→200 {purged:true,chapters:1,sections:1,instances:1,submissions:0} ⑦403：archive/restore/purge 他人(其他 teacher)课程→403 FORBIDDEN「权限不足」(purge 即便给对的 title 也先 403，owner 守卫先于 title 校验) |
| 5. Cross-module regression (R5) | PASS | grep 全仓确认 `deleteCourse` 0 真调用方（匹配项均为 deleteCourseKnowledgeSource/deleteCourseOpen/注释 false positive）；DELETE 路由唯一调用方已同步改 archiveCourse。teacherCourseFilter 未改签名（U2 不动 F3，那是 U3）。diff scope 仅 route.ts/api-utils.ts/course.service.ts + 3 新路由 + 2 新测试 + 1 脚本，无 drive-by。 |
| 6. Security (/cso) | N/A→见备注 | U2 触碰删除/守卫，按约定属安全敏感。已人工核 owner/admin 守卫(assertCourseOwnerOrAdmin: admin 直通/否则 createdBy/COURSE_NOT_FOUND/FORBIDDEN)、confirmTitle 强确认(D4)、audit 留痕(archive/restore/purge 三 action + purge 含计数)。真 HTTP 验证 403 对他人课程生效、purge 名称不符 400。未发现 High/Critical。purge 真销毁但有 owner+admin 校验+强确认+audit 三重护栏(R3) → 不触发整体 FAIL。 |
| 7. Finsim-specific | PASS | 全部错误中文(PURGE_TITLE_MISMATCH/FORBIDDEN「权限不足」)，经 handleServiceError；3 新 Route Handler 均薄包装(requireRole→service→success)，无业务逻辑；zod safeParse on purge body；{success,data}/{success,error}格式。 |
| 8. Code patterns | PASS | purge 显式删 SET NULL 表(submission/taskInstance/studyBuddyPost/analysisReport)避免孤儿、解 RESTRICT(contentBlock/section)、confirmTitle 校验在事务前(失败不进事务)。根因取向，无绕过。 |

## §8 purge 级联真 DB 证明（R2 / F5）
- builder `scripts/verify-purge-cascade.ts` 独立复跑 **PASS**：建 15 节点完整后代树（chapter→section→contentBlock + instance + submission + subjectiveSubmission + attachment + studyBuddyPost + taskPost + analysisReport + announcement + scheduleSlot + courseKnowledgeSource + taskBuildDraft）→ purge 后 15 项断言全 null、共享 Task 模板存活、counts={chapters:1,sections:1,instances:1,submissions:1}；throwaway 自清 0 leftover。
- QA 自建 teacher1 fixture 真 HTTP purge 后 DB 核对：courseGone+chGone+secGone+blkGone+instGone=true，sharedTaskTemplatesStillExist=true。

## 范围边界（本轮不验，后续）
- **未验"归档后全站消失"**（读取点过滤=U3，目前归档课程仍可能出现在 dashboard/列表/学生侧——符合 builder 声明的 U2 边界）。
- **D6 outline-apply 真路径补验**（spec §11 新增）：replace 模式删含小节+内容块但无任务实例的章节 → outline-apply:246 tx.chapter.delete() 级联成功无 FK 错。此项 U1 已验 raw 端点，§11 要求补 outline-apply 真路径，待 U4 或单独一轮——记此为 pending QA 项。

## Issues found
无。

## 观察（不阻塞）
- 沿用 U1：dev NEXTAUTH_URL=:3030 而 server 在 :3003（env quirk，未阻塞登录）。
- builder flag 的预存 bug（page.tsx:1141 `course.class.id` 当 deprecated classId=null 时崩）——非 U2 触碰，origin/main 同款，已转告 team-lead，U3/U4 真浏览器可能撞到。

## DB 卫生
- 全部 QA fixture（含他人 owner 的 Course B）+ 临时脚本清理干净：0 QA/probe 课程残留，活跃课程 9（=U1 起始基线），0 归档残留。dev finsim 未被 reset/seed/drop。

## Overall: PASS
