# QA Report — course-archive U5 r1（写路径守卫 F4，P2）

## Spec: U5 / F4（向已归档课程 新建实例 / 发布任务 / AI 起草 应被拒）

worktree `finsim-course-archive` / branch `claude-course-archive`；build report: `build_course-archive_u5_r1.md`

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 新增 `assertCourseNotArchived`（COURSE_NOT_FOUND / COURSE_ARCHIVED）；3 个 spec 点名写路径(task-instances POST / with-task POST / task-build-drafts POST) 在 assertCourseAccess 后加守卫。 |
| 2. tsc --noEmit | PASS | exit 0（U4 轮已验，U5 无新增类型问题） |
| 3. vitest run | PASS | 117 文件 / 1202 测试全绿（含 +3 F4 守卫测试 + 2 API mock export 同步）。 |
| 4. Browser/HTTP (/qa-only) | PASS | 真浏览器 teacher1 真 HTTP，fixture=archived 课程(classId set 避 :1141)：①新建实例 POST→**409 COURSE_ARCHIVED** ②with-task 原子发布 POST→**409 COURSE_ARCHIVED「该课程已删除（在回收站中），请先恢复后再操作」** ③task-build-drafts(AI 起草) POST→**409 COURSE_ARCHIVED**。**恢复后**：AI draft POST→**200**(guard 通过，draft 创建)——证明守卫 archive-driven 可逆。 |
| 5. Cross-module regression | PASS | 加 export `assertCourseNotArchived` 后同步补 2 个 API 测试的 mock export（否则 undefined()→500）——正确修复。守卫只加 3 路径，未触其他写端。 |
| 6. Security (/cso) | N/A→人工核 | F4 是写入防护加固。守卫与角色无关(admin 也须先恢复)，叠加 assertCourseAccess(owner)。真 HTTP 验证 3 路径 409。无 High/Critical。 |
| 7. Finsim-specific | PASS | COURSE_ARCHIVED→409 中文「该课程已删除（在回收站中），请先恢复后再操作」经 handleServiceError；Route Handler 守卫调用无业务逻辑。 |
| 8. Code patterns | PASS | 守卫加在 assertCourseAccess 之后（先鉴权后状态校验，正确顺序）；范围克制（只 3 路径，符合 anti-regression rule 9）。 |

## F4 真 DB 证明
- builder `scripts/verify-f4-guard.ts`：归档前不抛、归档后抛 COURSE_ARCHIVED；self-clean。
- QA 真 HTTP 3 路径 409 + 恢复后 200 双向验证。

## 范围观察（builder 已 flag，认可）
- F4 只加 spec 点名 3 写路径；chapters/sections/content-blocks/announcements 创建端靠 assertCourseAccess + 归档课程已从所有列表移除(owner 进不去) 保护。我未发现学生侧或直链可绕过对已归档课程写入（U3 已验学生 F1 直链 403）。认可 builder 范围克制。

## Issues found
无 U5 范围问题。

## 观察（环境，非代码缺陷）
- 恢复后一次请求遇服务端 `SyntaxError: Unexpected end of JSON input` at Next `load-manifest.external.js`（webpack dev server 增量 build manifest 瞬时损坏）→ **retry 即 200**。这是 worktree `--webpack` dev server（symlink node_modules）多次热重载后的不稳定，**与路由代码无关**；生产 build 不走 dev manifest 无此问题。

## Overall: PASS（F4 写路径守卫 3 路径 409 + 可逆，真 HTTP 验证）
