# Build Report · PR-AUTH-1 · Stage A · r1

## Scope · 资产 + Wordmark（基础设施）

## Files changed

| 操作 | 文件 |
|---|---|
| 新增 | `finsim/public/brand/lockup.png` (620 KB) |
| 新增 | `finsim/public/brand/symbol.png` (617 KB) |
| 新增 | `finsim/public/brand/app-icon.png` (577 KB) |
| 新增 | `finsim/public/brand/mood-aurora.png` (552 KB) |
| 新增 | `finsim/public/brand/value-connect.png` (425 KB) |
| 新增 | `finsim/public/brand/value-explore.png` (531 KB) |
| 新增 | `finsim/public/brand/value-grow.png` (348 KB) |
| 新增 | `finsim/public/brand/wordmark-with-tagline.png` (583 KB) |
| 新增 | `finsim/public/brand/palette-reference.png` (492 KB) |
| 完全替换 | `finsim/components/ui/wordmark.tsx` (85 行 ← 70 行) |

## Diff stat

```
 components/ui/wordmark.tsx |  85 +++++-----
 1 file changed, +85 / -70
```

## Asset compression

- 9 张 PNG 复制到 `finsim/public/brand/` 后跑 `pngquant --quality=70-90 --ext .png --force`
- 压缩前总大小：14 MB（hero 级 PNG，1.4-1.7 MB / 张）
- 压缩后总大小：**4.6 MB**（每张 348-620 KB，视觉无损）
- pngquant 通过 `brew install pngquant` 安装（系统未预装）

## Wordmark 组件升级

旧实现（70 行）：
- 靛蓝方块 + 白色"勾"SVG + 文字「灵析 析」
- ViewBox 20×20
- `bg-brand` 圆角矩形容器

新实现（85 行，照搬 `login-redesign/v4-aurora/wordmark-v2.tsx`）：
- 横向 ∞ 双环一笔画 + 主/次双星点 + 文字「灵析 AI」
- ViewBox 80×44 (比例 ≈ 1.82:1)
- 符号宽度 = `size × 1.82`（横向布局）
- 主星点紫色（`var(--fs-sim)`）/ 次星点浅靛蓝（`var(--fs-primary-lift)`）
- mono=true 时白色描边 + 白色星点（深色 nav 用）
- showText=true 时 "AI" 用 brand 色高亮

API 完全向后兼容：
- props（`size` / `className` / `mono` / `showText`）签名不变
- sidebar.tsx:106 (`<Wordmark size={28} />`) 桌面侧栏 — 零改动自动升级
- sidebar.tsx:226 (`<Wordmark size={24} />`) 移动 topbar — 零改动自动升级

## Verification

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors（19 warnings 全部预存在，与本次改动无关） |
| `du -sh finsim/public/brand/` | **4.6 M < 5 MB 目标** |
| `ls finsim/public/brand/ | wc -l` | 9 张 PNG |
| `curl -s http://localhost:3000/teacher/dashboard | grep -c "灵析"` | 返回 1（HTML 包含品牌字符；该路由未登录会重定向至登录页/landing，metadata title 「灵析 — AI 把课堂的隐性问题，变成可视的行动」即包含字符） |

## Dev server 状态

- 已有 dev server 运行（pid 15040，端口 3000）
- 修改 `components/ui/wordmark.tsx` 后 Next.js HMR 会自动 reload，无需重启
- **本阶段无 Prisma schema 改动**，不触发三步迁移流程
- Stage B 将追加大量 CSS 到 globals.css；如出现 HMR 异常会建议重启

## Sidebar 视觉影响范围（自动升级，零改动）

执行 `grep -rn "Wordmark"` 确认调用点：
- `components/sidebar.tsx:21`（import）
- `components/sidebar.tsx:106`（桌面侧栏 `size=28`）
- `components/sidebar.tsx:226`（移动 topbar `size=24`）

**所有内部页面**（dashboard / 教师工作台 / 学生页面 / sidebar / 移动 topbar）会自动获得新 ∞ 双环 wordmark；text-ink / text-brand 沿用现有浅色 token，与项目米色 paper 主题一致。

## Decisions / 不确定项

- **方案 B（追加 globals.css）**已按 spec 拍板，Stage B 执行
- **R5 untracked 文件**（`.claude/launch.json` / `.harness/codex-tasks/*.log` / `public/uploads/`）不在本 PR scope（spec 明确排除），暂不处理。如最后有时间会按 task brief 加 .gitignore（独立提交，不影响主 PR）
- **dev server 未重启**：本阶段仅 PNG 静态资产 + 一个组件文件，HMR 足以覆盖；Stage B 追加 CSS 到 globals.css 后视情况决定是否需要重启

## Next: Stage B

等待 coordinator / qa 反馈后进入 Stage B（CSS 追加 + 登录页替换）。
