# Build r4 — selection restoration after browser layout

r3 独立 QA 保留 FAIL：隔离菜单关闭干扰后，数字事件时间线证明 layout effect 已恢复选区，但 Chromium 随后的 type 切换布局把选区重置为 0..0。其余 14 个场景已验证，截图副本脱敏通过。

重新按实际时序设计：补偿移动到下一帧，仅在同一补偿仍有效、输入仍聚焦且值未变时恢复选区，绝不调用 focus。后续 blur/keydown/pointerdown/change 立即取消补偿，连续切换复用尚未恢复的原选区。

这不是放宽选区或焦点断言；下一轮独立 QA 继续验证三字段、快速 Tab、键盘切换、后续输入和完整改密恢复。未改变 CAS、会话撤销或截图脱敏实现。

本地类型检查、147 files / 1412 Vitest、改动文件 lint、check_docs 与 diff --check 全通过。独立浏览器复验待完成。
