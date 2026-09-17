# Build r3 — focus and screenshot privacy

独立 QA 对 dd1e479 完成 13 项：12 PASS，焦点 FAIL；另发现反馈截图序列化包含显示中的合成密码。正式 FAIL 及证据已保留，不覆盖旧报告。

- 将延迟 requestAnimationFrame 焦点恢复改为 layout effect，仅同步恢复仍聚焦的输入选区。不主动 focus，不抢回用户已用 Tab 移走的焦点。
- 使用 modern-screenshot 的 onCloneNode，在截图副本中清空 password 或 current-password/new-password 自动填充字段，并恢复隐藏类型。活 DOM、输入值和可见性不改；反馈文字与截图功能保留。

`npx tsc --noEmit && npx vitest run` 通过（147 files / 1412 tests），5 个改动源码/测试文件 lint、check_docs、diff --check 通过。独立浏览器复验待执行。

这些修复不新增密码日志、不修改真实学生账号、不部署生产。
