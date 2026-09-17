# Build r1 — student password visibility

Base: `7455f6cd6d5ee26da1ded76e6271ad8fd609c003`; branch: `codex-password-visibility`.

新增 PasswordInput，为当前、新、确认密码提供独立且默认隐藏的显示开关。按钮明确 type=button 与中文可访问名称；鼠标切换保留输入焦点和选区，键盘按钮可独立操作。补充三个 label/id/name，保留既有 autocomplete 与改密提交、校验及会话撤销逻辑。

## 本地检查

- `python3 .github/scripts/change_policy.py --base origin/main --working-tree`: full path。
- `npx prisma generate`: 完成，仅生成此工作树 client；未改 schema/数据库。
- `npx tsc --noEmit && npx vitest run`: PASS，146 files / 1409 tests。
- `npx eslint 'app/(student)/settings/page.tsx' components/ui/password-input.tsx`: PASS。
- `python3 .github/scripts/check_docs.py --base origin/main --working-tree`、`git diff --check`: PASS。

待独立 QA：多个合成学生的网页改密/恢复闭环、旧会话与边界输入；新开关的焦点/选区、键盘、独立性与窄屏。此报告不是 QA 结论。真实生产测试账号仍等待用户亲自提交恢复；不与合成验收混同。本轮未部署生产。
