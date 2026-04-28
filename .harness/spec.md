# PR-AUTH-1 · 登录/注册页 V4 Aurora 深色版落地

> **用户原话**：`/Users/alexmac/Documents/Mini 项目开发/finsim v2/login-redesign/v4-aurora` 这是我对登陆和注册页面以及里面的一些 logo 替换做的一个新版设计，你来看下，形成一个更新 plan，我们在 main 上执行
>
> **设计源 HANDOFF**：`login-redesign/v4-aurora/HANDOFF-V4-DARK.md`
> **预览**：`preview-dark.html`（登录）+ `preview-register-dark.html`（注册）
>
> **老 spec（Phase 8 收官）**已归档到 `.harness/spec-phase8-archive.md`

---

## Scope（4 个文件 + 9 个 PNG + globals.css 追加）

| 文件 | 操作 |
|---|---|
| `finsim/public/brand/{lockup,symbol,app-icon,mood-aurora,value-connect,value-explore,value-grow,wordmark-with-tagline,palette-reference}.png` | **新增** 9 张（从 v4-aurora/assets/ 复制并按命名规则改名） |
| `finsim/components/ui/wordmark.tsx` | **完全替换** 为 `wordmark-v2.tsx`（API 100% 兼容，sidebar 2 处调用零改动） |
| `finsim/app/globals.css` | **末尾追加** `login-dark.module.css` 全部内容（方案 B，保持项目 Tailwind + global CSS 一致风格） |
| `finsim/app/(auth)/login/page.tsx` | **完全替换** 为 `page-dark.tsx` |
| `finsim/app/(auth)/register/page.tsx` | **完全替换** 为 `page-register-dark.tsx` |

**不动**：
- 任何 `--fs-*` token（新样式全 `lx-` / `lxd-` 前缀，零冲突）
- `components/sidebar.tsx`（wordmark API 兼容，自动获 ∞ 双环新样式）
- `next.config.ts`（PNG 不需特殊配置，next/image 默认转 webp）
- 任何 schema / service / API / Route Handler

## 业务行为保持（必须 1:1 不变）

**登录页**：
- `signIn("credentials", { email, password, redirect: false })` 调用方式不变
- 登录成功 fetch `/api/auth/session` → role=teacher/admin → `/teacher/dashboard`，否则 `/dashboard`
- toast 提示 / 错误显示（"邮箱或密码错误" / "登录失败，请稍后重试"）
- 字段空校验（"请输入邮箱" / "请输入密码"）

**注册页**：
- 字段：name / email / password / confirmPassword / classId(学生) / adminKey(教师)
- role 切换为 student 时 `useEffect` 自动 GET `/api/classes` 加载班级列表
- role 切换时清空 classId 和 adminKey
- 完整校验：姓名非空 / 邮箱格式正则 / 密码 ≥6 / 密码一致 / 班级或密钥必填
- 流程：POST `/api/auth/register` → toast 成功 → 自动 `signIn` → 按 role 跳转 `/teacher/dashboard` 或 `/dashboard` → `router.refresh()`
- 失败：注册失败显示后端 message / 自动登录失败 toast.error 跳 `/login`

## 实施单元（建议 builder 分 3 阶段，单一 PR 提交）

### Stage A · 资产 + Wordmark 替换（基础设施）
1. `mkdir -p finsim/public/brand`
2. cp 9 张 PNG（按 HANDOFF 表的 UUID → 目标名映射）
3. **R1 风险缓解**：复制完成后跑 `pngquant --quality=70-90 --ext .png --force finsim/public/brand/*.png` 压缩（视觉无损，14 MB → 2-4 MB）
4. 替换 `finsim/components/ui/wordmark.tsx` 为 `login-redesign/v4-aurora/wordmark-v2.tsx`
5. 验收：`npx tsc --noEmit` 0、`npm run lint` 0、dev server 启动后 `/teacher/dashboard` sidebar 显示 ∞ 双环新 wordmark

### Stage B · CSS + 登录页落地
1. 把 `login-redesign/v4-aurora/login-dark.module.css` 全部内容追加到 `finsim/app/globals.css` 末尾（前面加分隔注释 `/* === V4 Aurora · auth pages === */`）
2. 替换 `finsim/app/(auth)/login/page.tsx` 为 `login-redesign/v4-aurora/page-dark.tsx`
3. 验收：浏览器 `/login` 渲染对得上 `preview-dark.html`，登录闭环 student1 + teacher1 + admin 三 role 跳转正确

### Stage C · 注册页落地
1. 替换 `finsim/app/(auth)/register/page.tsx` 为 `login-redesign/v4-aurora/page-register-dark.tsx`
2. 验收：浏览器 `/register` 渲染对得上 `preview-register-dark.html`，role 切换正确，学生注册需选班级 / 教师注册需密钥，提交后自动登录跳 dashboard

## Acceptance Criteria（每条 QA 必须验）

**类型 / Lint / Build**：
- [ ] `npx tsc --noEmit` 0 errors
- [ ] `npm run lint` 0 errors
- [ ] `npm run build` 24 routes（无 route 数量变化，与 PR-COURSE-1+2 后基线一致）
- [ ] `npx vitest run` 全绿（应该 707，不增不减）

**视觉对应（真浏览器 /qa-only 验）**：
- [ ] `/login` 顶部背景能看到 `mood-aurora.png` 极光横幅渐隐（opacity 0.55）
- [ ] `/login` Logo 是真实 wordmark（∞ + 灵析 AI + LingXi）来自 `/brand/lockup.png`
- [ ] `/login` 标题 "教学" 二字 cyan→light→violet 渐变 + 极轻发光
- [ ] `/login` 主按钮明亮渐变（#6A7CFF → #4FD1FF）+ hover 时 cyan 60% 加强 + 流光
- [ ] `/login` 输入框 focus 底线变蓝 + 双色渐变线展开 + 青色发光
- [ ] `/login` ValueOrbitStrip 显示真实的 connect / explore / grow 图片
- [ ] `/login` 入场动画顺序 topbar → stage → orbit-strip → footer
- [ ] `/register` 顶部 mood opacity 0.45（比 login 的 0.55 略低）
- [ ] `/register` 没有 ValueOrbitStrip（注册页不显示）
- [ ] `/register` 标题 "看见" 二字渐变高亮
- [ ] `/register` Role chip 玻璃 glass card 风格，active 态 cyan 边框 + 内发光
- [ ] `/register` role=student 时班级 select 显示，role=teacher 时教师密钥显示

**业务回归**：
- [ ] student1@finsim.edu.cn / password123 登录 → 跳 `/dashboard`
- [ ] teacher1@finsim.edu.cn / password123 登录 → 跳 `/teacher/dashboard`
- [ ] admin@finsim.edu.cn / password123 登录 → 跳 `/teacher/dashboard`
- [ ] 输入空邮箱触发 inlineError "请输入邮箱"
- [ ] 输入错密码触发 inlineError "邮箱或密码错误"
- [ ] `/register` student role 切换自动 fetch `/api/classes`（network tab 可见）
- [ ] `/register` student 注册闭环（POST `/api/auth/register` → 自动登录 → 跳 dashboard → `router.refresh()`）
- [ ] `/register` teacher 切换 → classId 清空 / 教师密钥字段出现

**回归（必须不动）**：
- [ ] sidebar 在 dashboard / 教师工作台 / 学生页面 wordmark 升级为 ∞ 双环但布局不变（size=28 桌面、size=24 移动）
- [ ] dashboard / 教师工作台 / 学生 grades / study-buddy / schedule 视觉零变化（CSS lx- 前缀隔离生效）
- [ ] mobile breakpoint < 720px 时 orbit strip 改纵向，logo 36px，标题 30px
- [ ] `prefers-reduced-motion` 时极光、星尘、入场动画全部禁用

## Risks（重点关注）

### R1 · Git 仓库膨胀 13 MB（PNG 资产）
**事实**：9 张源 PNG 总和 14.2 MB，每张 1.4-1.7 MB（hero 级 PNG 一般压到 200-400 KB）。next/image 转 webp 是**运行时优化**（在 `.next/cache`），git 仓库还是占 14 MB。
**Spec 决策**：Stage A 强制 builder 跑 `pngquant --quality=70-90`（视觉无损，预估 14 MB → 2-4 MB）。如用户决定不压缩，删除该 step 即可。

### R2 · CSS 方案 A vs B
**HANDOFF 给两个方案**：
- A · CSS Module（`page.module.css` + `import styles from`）→ 引入新模式，与现有 Tailwind 风格不一致
- B · 追加 `globals.css` 末尾 → 与现有项目模式 100% 一致

**Spec 默认采用方案 B**（globals.css 当前 356 行，追加约 +600 行后约 950 行可控）。如用户偏好方案 A 请提前说。

### R3 · 注册页 Select 组件实现差异
**事实**：旧版 register 用 `@/components/ui/select`（shadcn Radix）；HANDOFF 说新版用原生 `<select>`。需要 builder 验证 `page-register-dark.tsx` 实际实现并保持深色样式正确。
**Mitigation**：builder Stage C 真浏览器验证班级下拉能正常打开 + 选中 + 提交。

### R4 · `next/image` 与 priority 配置
**HANDOFF 要求**：lockup.png 用 `priority`，value-*.png 用懒加载。builder 必须照做，否则首屏 LCP 退化。
**Mitigation**：QA 用 `preview_network` 验证 lockup 在 critical 路径，value-* 在 lazy 路径。

### R5 · 现有 4 个 untracked 文件
之前讨论的 `.claude/launch.json` / `.harness/codex-tasks/*.log` / `public/uploads/` 不在本 PR scope，不处理（可独立 micro-unit 解决）。

## 不在 scope 内（明确排除）

- ❌ Logo SVG 矢量化（HANDOFF 已标 P3 后续）
- ❌ Value 图 Lottie 化（HANDOFF 已标 P3）
- ❌ 浅色版 dual-mode 切换（仅深色版，旧浅色 preview.html 留作 future ref）
- ❌ 字体自托管（暂用 system fallback）
- ❌ Deploy 修复（独立工作线）
- ❌ `.gitignore` 清理 untracked 噪音

## 提交信息

```
feat(auth): redesign login & register with Midnight Aurora dark theme

- Add 9 brand assets to /public/brand/ (compressed via pngquant)
- Replace components/ui/wordmark.tsx with horizontal ∞ lockup (API compat)
- Replace login + register pages with V4 Aurora dark version
- Append login-dark CSS to globals.css with lx-/lxd- prefix isolation
- Use next/image with priority for lockup, lazy for value images
- Preserve all auth business logic (signIn / role redirect / class load /
  register flow / validation / inline errors / toast)

All new tokens prefixed --lxd-* and classes .lx-* to ensure zero conflict
with existing --fs-* design system. Sidebar wordmark auto-upgrades via
API compat. Dashboard / teacher console / student pages untouched.

Refs: login-redesign/v4-aurora/HANDOFF-V4-DARK.md
```
