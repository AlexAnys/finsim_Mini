# QA Report · PR-AUTH-1 · Stage A · r1

## Spec: 资产 + Wordmark 替换（基础设施）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 9 张 PNG 全部就位 + wordmark.tsx 完全替换为 ∞ 双环新版 |
| 2. tsc --noEmit | PASS | 0 errors（无输出） |
| 3. npm run lint | PASS | 0 errors / 19 warnings 全部预存在与本次改动无关 |
| 4. Browser (/qa-only) | PASS | 真浏览器加载 teacher / student 多页面 sidebar wordmark 已升级 |
| 5. Cross-module regression | PASS | grep 仅命中 sidebar.tsx:21/106/226 三处零改动调用点 + 5 个学生/教师页面视觉零变化 |
| 6. Security (/cso) | N/A | 仅资产 + 1 个 UI 组件，无认证/权限/支付改动 |
| 7. Finsim-specific | PASS | UI 文字「灵析 AI」中文 / 无 schema / 无 API / 无 Route Handler 改动 |
| 8. Code patterns | PASS | API 100% 兼容 / 无 drive-by refactor |

## 验证细节

### 资产清单（9 张 PNG · 4.6 MB < 5 MB 目标）

```
564K app-icon.png            484K palette-reference.png
608K lockup.png              604K symbol.png
540K mood-aurora.png         464K value-connect.png
352K value-grow.png          520K value-explore.png
572K wordmark-with-tagline.png
total 4.6M
```

均符合 spec R1 缓解（`pngquant --quality=70-90` 视觉无损）。

### Wordmark 双环 ∞ 验证

`components/ui/wordmark.tsx:52` 含目标 path：
```
d="M 14 22 C 14 10, 30 10, 40 22 C 50 34, 66 34, 66 22 C 66 10, 50 10, 40 22 C 30 34, 14 34, 14 22 Z"
```

API 兼容性确认（grep 仅 sidebar.tsx 调用）：
- `components/sidebar.tsx:21` import
- `components/sidebar.tsx:106` `<Wordmark size={28} />` 桌面侧栏
- `components/sidebar.tsx:226` `<Wordmark size={24} />` 移动 topbar

### 真浏览器视觉验证

| 路径 | viewport | 截图 | 观察 |
|---|---|---|---|
| /teacher/dashboard | 1440×900 | /tmp/qa-stageA-teacher-dashboard.png | 桌面侧栏顶部显示 ∞ 双环 + 「灵析 AI」(size=28)，紫/浅靛蓝双星点清晰；旧靛蓝方块勾已消失 |
| /teacher/dashboard | 375×812 | /tmp/qa-stageA-teacher-mobile.png | 移动 topbar 显示 ∞ 双环 + 「灵析 AI」(size=24)，缩放正确 |
| /dashboard (学生) | 1440×900 | /tmp/qa-stageA-student-dashboard.png | sidebar wordmark 升级；"下午好，张三" hero、卡片栅格、待办列表、公告等所有学生 dashboard 内容布局零变化 |
| /grades | 1440×900 | /tmp/qa-stageA-student-grades.png | sidebar wordmark 升级；"成绩档案"、深靛蓝学期均分卡、模拟/测验/主观题三 tab 卡、提交记录 + 详情面板布局零变化 |
| /study-buddy | 1440×900 | /tmp/qa-stageA-student-study-buddy.png | sidebar wordmark 升级；split-pane (340px 左侧 + 右侧对话)、tag/chip 配色、消息气泡布局零变化 |
| /schedule | 1440×900 | /tmp/qa-stageA-student-schedule.png | sidebar wordmark 升级；本学期 chip + H1 + 副标三段式 hero + 本周/月视图 tabs + 课程卡片布局零变化 |

`prefers-reduced-motion`/横向缩放/动画相关 spec 项不在 Stage A scope（动效在 Stage B 引入）。

## Issues found

无（Stage A 范围内）。

## 备注（不影响 Stage A 通过）

`git status` 显示 `app/(auth)/login/page.tsx` 和 `app/globals.css` 已被改 — 看起来 builder 已并行进入 Stage B（`build_pr-auth-1_stageB_r1.md` 也存在）。**这些改动不在 Stage A 验收范围**，将在 Stage B 验收时单独审。

注意：`/login` 页面浏览器 console 输出 1 条 next/image warning（`/brand/lockup.png` 修改 width/height 但未设另一个/auto）— 来源为 Stage B 改动，将在 Stage B 验收时跟踪是否需 builder 修复。

## Overall: PASS
