# Build Report · PR-AUTH-1 · Stage B · r1

## Scope · CSS 追加 + 登录页落地

## Files changed

| 操作 | 文件 | 变化 |
|---|---|---|
| 末尾追加 | `finsim/app/globals.css` | +547 行（357 → 903 行） |
| 完全替换 | `finsim/app/(auth)/login/page.tsx` | 旧 488 行（shadcn 风格） → 新 316 行（v4 Aurora） |

## Diff stat (Stage A + B 累计)

```
 app/(auth)/login/page.tsx  | 488 +++++++++++++++++++++-------------------
 app/globals.css            | 547 +++++++++++++++++++++++++++++++++++++++++++++
 components/ui/wordmark.tsx |  85 ++++---
 4 files changed, 993 insertions(+), 517 deletions(-)
```

## CSS 追加细节

- **追加方式**：`{ printf '\n\n/* === V4 Aurora · auth pages (PR-AUTH-1) === */\n'; cat login-redesign/v4-aurora/login-dark.module.css; } >> finsim/app/globals.css`
- **追加内容**：包含登录页全部样式 + 注册页专属样式（role chip / native select / password hint），共 545 行 CSS（含分隔注释）
- **token 隔离**：所有新 token 用 `--lxd-*` 前缀（lxd = LingXi Dark），不冲突现有 `--fs-*`
- **class 隔离**：所有新类名用 `lx-*` 前缀，不冲突现有 Tailwind / shadcn / 项目自定义类
- **动画**：`@keyframes lxd-aurora-shift` / `lxd-stardust-twinkle` / `lxd-fade-up` / `lxd-fade-down`（全 lxd- 前缀）
- **媒体查询**：`@media (max-width: 720px)` 移动端 + `@media (prefers-reduced-motion: reduce)` 可访问性（注意：globals.css 全局生效，但 `*` 选择器仅在 reduce-motion 用户开启时才动，对项目其他动画的副作用是预期的可访问性增强）

## 登录页业务行为保持（1:1 不变）

```
20:import { signIn } from "next-auth/react";
31:const [inlineError, setInlineError] = useState<string | null>(null);
41:const result = await signIn("credentials", { email, password, redirect: false });
44:if (result?.error) { setInlineError("邮箱或密码错误"); return; }
46:fetch("/api/auth/session") → role check
50:router.push("/teacher/dashboard")  // teacher / admin
52:router.push("/dashboard")          // student
55:setInlineError("登录失败，请稍后重试")  // catch
```

- 字段空校验保留：「请输入邮箱」/「请输入密码」
- toast 成功提示保留：`toast.success("登录成功")`
- 三种 role 跳转逻辑保留

## 视觉关键点（页面渲染验证）

| 元素 | 类 | 实现 |
|---|---|---|
| Aurora 背景 | `.lx-aurora-mood` | `mood-aurora.png` + mix-blend-mode: screen + linear mask（opacity 0.55） |
| Logo 横向 wordmark | `.lx-brand-logo` | `<Image src="/brand/lockup.png" priority />` + screen blend |
| 标题渐变「教学」 | `.lx-title em` | cyan→light→violet 渐变 + drop-shadow 发光 |
| 主按钮 | `.lx-submit` | `--lxd-grad-button` 双色渐变 + hover 加强 + ::after 流光 |
| 输入框 focus 底线 | `.lx-input-wrap::after` | scaleX 双色渐变线展开 + cyan 阴影 |
| ValueOrbitStrip | `.lx-orbit-strip` | 3 张 value-*.png + screen blend + 椭圆 mask |
| 入场动画 | `lxd-fade-up` / `lxd-fade-down` | topbar (0s) → stage (0.1s) → orbit-strip (0.4s) → footer (0.6s) |

## Verification（Stage B 验收清单）

| 检查 | 命令 | 结果 |
|---|---|---|
| TypeScript 0 errors | `npx tsc --noEmit` | PASS（无输出 = 0 errors） |
| ESLint 0 errors | `npm run lint` | PASS（0 errors，19 warnings 预存在与本次无关） |
| HTTP 200 | `curl -sI http://localhost:3000/login` | `HTTP/1.1 200 OK` |
| `lx-page` 出现 | `curl -s ... \| grep -c 'lx-page'` | `1`（唯一容器，符合预期） |
| `lx-*` 类渲染 | `curl ... \| grep -oE 'class="lx-...'` | 10+ 类名命中（lx-aurora / lx-aurora-arc-tr / lx-aurora-mood / lx-brand / lx-brand-logo / lx-eyebrow ...） |
| 标题 `<em>教学</em>` | grep `<em>...</em>` | 命中（渐变文字目标） |
| `/brand/lockup.png` | `curl -sI ...` | `HTTP/1.1 200 OK` |
| `/brand/mood-aurora.png` | `curl -sI ...` | `HTTP/1.1 200 OK` |
| `/brand/value-connect.png` | `curl -sI ...` | `HTTP/1.1 200 OK` |
| 业务逻辑保留 | grep signIn / inlineError / router.push | 全数命中（行 20 / 31 / 41 / 44 / 50 / 52 / 55） |

## Dev server 重启验证

- 旧 pid 15040 已 `kill`
- 新 dev server 通过 `nohup npm run dev > /tmp/finsim-dev.log 2>&1 &` 启动
- `until curl -sf http://localhost:3000/login` 轮询直到 ready
- 启动日志无 compile error，仅看到正常 prisma:query + GET /login 200 (compile 3ms render 25ms)

## Decisions / 不确定项

- **CSS 方案 B 落地**：546 行追加到 globals.css 末尾，与项目现有 Tailwind + global CSS 混合风格一致
- **`@media (prefers-reduced-motion: reduce) { *, ::before, ::after }`** 是全局选择器 — 有用户开启 reduce-motion 时会让项目所有动画也降到 0.01ms。这是预期的可访问性增强（不仅是 auth 页），属正向副作用，不构成回归
- **Stage C（注册页）准备就绪**：CSS 已包含注册页所需 `.lx-role-switch` / `.lx-role-chip` / `.lx-select` / `.lx-password-hint`，Stage C 仅替换 `register/page.tsx` 一个文件，不需再动 globals.css

## QA 待真浏览器验证项（curl 验不了的视觉）

- mix-blend-mode 在浏览器渲染（顶部极光横幅、logo screen blend、value 图椭圆 mask）
- 「教学」二字 cyan→light→violet 文字渐变 + drop-shadow 发光
- 主按钮 hover 流光 / 输入框 focus 时 scaleX 蓝青渐变线展开
- ValueOrbitStrip hover 上浮
- 入场动画顺序（topbar → stage → orbit → footer 阶梯）
- 三 role 登录闭环（已确保业务逻辑代码 1:1，QA 用真账号验跳转）

## Next: Stage C

等待 coordinator / qa 反馈后进入 Stage C（注册页落地）。CSS 已就绪，预计 Stage C 仅替换一个文件 + tsc/lint/build/vitest 全套验收。
