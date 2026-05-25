# HANDOFF — 课程归档（软删除）功能

> 会话结束前由 coordinator 更新. SessionStart hook 自动显示.

## 状态 (2026-05-25): ✅ 全部完成 + QA 全绿，等用户 staging 实测后合并

- **Worktree**: `finsim-course-archive`，分支 `claude-course-archive`（基于 origin/main #20，现 **[behind 1]，push 前需 `git rebase origin/main`**）
- **Spec**: `.harness/spec-course-archive.md`（§1-12，含决策记录 + D6 澄清 + :1141 决策）
- 团队 `course-archive`（builder/qa）standby；reports 在 `.harness/reports/*course-archive*`

### 已交付（U1-U5 + 收尾全 PASS，真浏览器逐面验、dev DB 0 leftover、vitest 1202 全绿）
- **U1** schema：`Course.deletedAt`+索引；`ContentBlock.chapterId` RESTRICT→Cascade（修"章节删不掉"根因）；P2003→中文兜底
- **U2** service+API：archive/restore/purge（§8 级联 15 节点 + 留共享 Task 模板）/归档列表；`DELETE /courses/[id]` 改归档语义；owner/admin 守卫 + purge title-confirm
- **U3**（最高风险）读取点过滤：全站归档课程+其任务消失（teacher 列表/dashboard/SB/公告 + student dashboard/grades）+ 学生守卫 F1 + grades 过滤 F2；恢复可逆
- **U4** UI：一键归档（去 hasContent 禁用）+ 回收站抽屉（恢复 / 彻底删除输课程名强确认）
- **U5** 写路径守卫 F4：归档课程拒 新建实例/发布/AI起草 → 409 中文
- **收尾**：详情页删除文案改归档可恢复；**:1141 预存崩根因修复**（类型说谎 `Course.class` 标 non-null 实为 nullable → 4 处 deref null-safe + 向导回退 courseClasses）；删 2 个过时 spec、留 unit2-verify
- **D6 用户原诉求**：outline 编辑器 replace 删"含内容无实例"章节 → 成功；含实例 → 400 守卫（保留）

### 下一步
1. **等用户 staging 实测**确认"成品对不对路"（删课程→回收站→恢复→彻底删除流程）
2. 确认后：worktree commit（`feat(course-archive):` 中文 message）→ `rebase origin/main` → push → 自动 PR（**core-change** 标签）→ staging → squash merge
3. **当前未 commit/push**（按 spec §10.4 等用户确认）

### 注意事项
- 共享 dev DB(5432) 已应用 `deletedAt` 迁移（additive 安全）；**严禁** reset/seed/drop
- worktree node_modules 是 symlink → dev server 用 `next dev --webpack`（:3003），Turbopack 拒启
- 经验沉淀已进 MEMORY：客户端页面必须真浏览器验（curl 200≠没崩）、"use client" define-before-use 防 HMR forward-ref 崩
