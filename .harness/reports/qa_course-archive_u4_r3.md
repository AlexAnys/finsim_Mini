# QA Report — course-archive U4 r3（终轮：:1141 修复 + 详情页删除文案 + 全回归）

## Spec: U4 收尾（详情页删除文案 correctness 修复）+ 预存 :1141 修复（team-lead 拍板纳入）+ U4/U5/D6 全回归

worktree `finsim-course-archive` / branch `claude-course-archive`；build report: `build_course-archive_u4_r3.md`

**前置**：clean-restart dev server（webpack/:3003）+ 重启 browse daemon（清陈旧 HMR 态），全程真浏览器 teacher1。

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 详情页删除文案改归档语义；:1141（Course.class 类型说谎 non-null 实为 Class? nullable）4 处 deref 全 null-safe（835/860 任务向导回退 courseClasses[0].classId；1143 primaryClassId ?? null；1145 name ?? null）。过时 .spec：删 2 保 1（正确）。 |
| 2. tsc --noEmit | PASS | exit 0 |
| 3. vitest run | PASS | 117 文件 / 1202 测试全绿，0 回归 |
| 4. Browser (/qa-only) | PASS | clean-restart 后真浏览器逐项（见下分项）。 |
| 5. Cross-module regression | PASS | :1141 修触 page.tsx + editor-hero.tsx（primaryClassId 放宽 string\|null，下游仅相等判断、null 安全）；diff 受控。 |
| 6. Security (/cso) | N/A→人工核 | 本轮无新增 auth/权限逻辑（文案 + null-safe + 写守卫回归）。U5 守卫 + 强确认门已前轮核。 |
| 7. Finsim-specific | PASS | 全中文；详情页文案/守卫错误经 handleServiceError。 |
| 8. Code patterns | PASS | :1141 根因修复（类型纠正 + null-safe deref，非吞错 workaround）；文案 correctness 修复对齐 U2 归档语义。 |

## 终轮真浏览器分项（clean-restart 后）
1. **:1141 正向验 PASS**：自建 `Course.classId=null` 课程（崩溃原触发条件，dev 9 门 seed 全非空故自建）→ 详情页 `/teacher/courses/[id]` **200 OK_RENDERED**，console/page error **(none)**，标题 + 班级 badge（CourseClass 回退）正常渲染。修复前必崩 "Cannot read properties of null (reading 'id')"。截图 final-1141-nullclass-detail.png。
2. **详情页删除文案 PASS**：点「删除课程」→ 弹窗「删除课程（移入回收站）/ 确认删除「..」？…将从所有页面消失，但不会被销毁——可在课程管理页的"回收站"中恢复或彻底删除 / 删除（移入回收站）」。旧「不可恢复 / 将被服务端拒绝」已去。点确认 → **DB stillExists=true & archived=true**（归档非硬删，行为对齐文案）。
3. **U4 流程回归 PASS**：archived fixture 在 /archived（count 含）→ restore →（inArchived=false, inActiveList=true）回归。
4. **U5 三写路径守卫回归 PASS**：归档课程 → 新建实例 / with-task 发布 / AI 起草 → 全 **409 COURSE_ARCHIVED**。
5. **D6 replace 真路径回归 PASS**：outline-apply replace 删含小节+内容块无实例的章节 → **200**，DB chapterB+section+block 级联删、chapterA 保留。
6. **过时 .spec 确认**：`qa-unit5a-delete.spec.ts` + `qa-unit5a-r2-spotcheck.spec.ts` 已删（ls 不存在）；`unit2-verify.spec.ts` 保留——扫确认它测 TaskInstance close/reopen/删实例 生命周期、与课程归档无关、非 stale，保留正确。

## Issues found
无。:1141 三处崩点（833/858/1141 → 现 835/860/1143）全修；详情页文案 correctness 修复到位。

## DB 卫生
- 全部 ZZ throwaway fixture（含 classId=null 课程 + D6 内容树 + 知识源）purge 清理；leftoverZZ=0，活跃课程 9=基线，归档 0。dev finsim 未 reset/seed/drop。

## Overall: PASS
