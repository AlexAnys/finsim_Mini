# Build r2 — concurrent password update

独立 QA 在未改生产基线复现：两独立浏览器同时提交不同新密码，两个响应成功，最终只保存一个。原因是先检查旧密码、再仅按用户 id 无条件更新，检查与写入之间可被另一请求穿插。

最小修复：更新条件包含本次验证的原 passwordHash，更新 0 行时返回 HTTP 409 / PASSWORD_CHANGED 和中文重新登录指引。bcrypt、字符保留规则和会话撤销机制不变；不新增密码日志或修改 schema。

先增加冲突回归，旧实现 2 FAIL / 1 PASS（错误地返回 200），再修复。

- `npx tsc --noEmit && npx vitest run`: PASS，147 files / 1412 tests。
- 4 个改动源码/测试文件的 ESLint、change_policy、check_docs、diff --check 均通过。
- 独立实际浏览器验收待执行，不能以本报告替代。

本变更不能单独证明真实用户历史事故由并发引起。
