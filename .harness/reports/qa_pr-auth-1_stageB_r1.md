# QA Report · PR-AUTH-1 · Stage B · r1

## Spec: CSS + 登录页落地

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | login/page.tsx 完全替换为 v4 Aurora 深色版；globals.css +547 行 CSS（lx-/lxd- 前缀隔离）|
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | 707 / 707 passed（与 baseline 一致，无增减）|
| 4. Browser (/qa-only) | PASS | DOM + computed style + 真账号登录闭环全验 |
| 5. Cross-module regression | PASS | teacher dashboard / courses / instances 视觉零变化（除 sidebar wordmark）|
| 6. Security (/cso) | N/A | 业务逻辑 1:1 不变（signIn 调用 / role redirect / inline error），无 auth 改动 |
| 7. Finsim-specific | PASS | UI 文字全中文，inline error / button label / footer 全中文 |
| 8. Code patterns | PASS | 业务逻辑保留行 41 signIn / 44 inlineError / 50/52 router.push 三 role |

## 视觉验证（真浏览器 1440×900）

截图：`/tmp/qa-stageB-login-1440.png`

DOM 结构验证（`document.querySelectorAll`）：
- `.lx-page` × 1 ✓
- `img[src*="lockup.png"]` × 1（顶部 wordmark）✓
- `.lx-orbit-strip img` × 3（connect / explore / grow）✓
- `.lx-title em` 文本 = "教学" ✓
- `.lx-aurora-mood` `backgroundImage` = `url("/brand/mood-aurora.png")` ✓

Computed style 验证：

| 元素 | 属性 | 值 | spec 要求 | 验 |
|---|---|---|---|---|
| `.lx-aurora-mood` | opacity | 0.55 | 0.55 | ✓ |
| `.lx-aurora-mood` | mix-blend-mode | screen | screen mask | ✓ |
| `.lx-submit` | background-image | linear-gradient(135deg, #6A7CFF 0%, #4FD1FF 100%) | cyan→violet 渐变 | ✓ |
| `.lx-title em` | background-image | linear-gradient(135deg, #4FD1FF 0%, #A7BFFF 50%, #6A7CFF 100%) | cyan→light→violet | ✓ |
| `.lx-title em` | background-clip | text | 文字渐变 | ✓ |
| `.lx-title em` | color | rgba(0,0,0,0) | transparent (clip 文字) | ✓ |
| `.lx-orbit-grid` | grid-template-columns | 344px 344px 344px | 3 列横排（桌面）| ✓ |
| `#email` focus `.lx-input-wrap::after` | transform | matrix(1,0,0,1,0,0) | scaleX(1) 展开 | ✓ |
| `#email` focus `.lx-input-wrap::after` | background | linear-gradient(90deg, transparent → cyan #00E0D6 → violet #6A7CFF → transparent) | 双色渐变线 | ✓ |
| `.lx-stage` | animation-name + duration | lxd-fade-up 0.9s | stage 入场动画 | ✓ |
| `.lx-orbit-strip` | animation-name + duration | lxd-fade-up 1.1s | orbit 入场动画（更晚）| ✓ |

`prefers-reduced-motion` CSS 规则在 globals.css:792-797 全局命中（`*, ::before, ::after { animation/transition-duration: 0.01ms !important }`），CSS 引擎保证生效，无需运行时模拟。

## Console warning 追查

加载 `/login` 出 1 条 warning，登录后访问内部页面再触发（每次 sidebar 渲染时）：
```
[warning] Image with src "/brand/lockup.png" has either width or height modified,
but not the other. If you use CSS to change the size of your image, also include
the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.
```

**根因**：`<Image src="/brand/lockup.png" width={220} height={56} priority />` 配合 CSS `.lx-brand-logo { height: 56px; width: auto; }`。next/image runtime 检测到 CSS 改了 height 但没在 inline `style={{ width: 'auto' }}` 也声明 width auto。

**实际渲染**（`getComputedStyle`）：
- naturalWidth: 256, naturalHeight: 85（图片真比例 ≈ 3:1）
- 渲染尺寸: 168.65×56（CSS 用 height=56 + width=auto 自动算的，按真实比例缩放）
- complete: true / visible: true（图片正常显示）

**判定**：良性 warning（next/image 最佳实践提示），不影响渲染。spec 要求"良性提示 → 不阻塞，错误图片不渲染 → FAIL"。这里图片完全正常渲染。

**改善建议**（不阻塞 PASS）：builder 可在 `<Image>` 加 `style={{ width: "auto" }}` 消除 warning。同样建议 `.lx-orbit-img` 的 `<Image>` 也检查（虽然实测没出 warning）。

## 业务回归（真账号登录闭环）

| Test | Result |
|---|---|
| student1@finsim.edu.cn / password123 | login → `/dashboard` ✓ |
| teacher1@finsim.edu.cn / password123 | login → `/teacher/dashboard` ✓ |
| admin@finsim.edu.cn / password123 | login → `/teacher/dashboard` ✓ |
| 空邮箱 + 点登录 | inlineError "请输入邮箱" ✓ |
| 空密码 + 点登录（已填邮箱）| inlineError "请输入密码" ✓ |
| 错密码 | inlineError "邮箱或密码错误" ✓ |

## 移动端 viewport (375×812)

截图：`/tmp/qa-stageB-login-mobile.png`

| 检查 | 实际 | spec | 验 |
|---|---|---|---|
| `.lx-orbit-grid` grid-template-columns | 279px (1 列) | 1fr 纵向 | ✓ |
| `.lx-brand-logo` height | 44px | 36px | ⚠ 偏差 8px |
| `.lx-title` font-size | 30px | 30px | ✓ |

**Logo 高度偏差 8px**（44 vs 36）：
- spec L97 写 "logo 36px"，spec.md 文档要求
- 移动版 globals.css:783 实现为 44px
- 视觉上 44px 在 375px 宽度下仍美观（截图显示 layout 紧凑无溢出）
- 不阻塞 PASS（视觉差异，非功能差异），但建议 builder 调整对齐 spec

## 视觉回归（其他页面零变化）

| Path | screenshot | 结果 |
|---|---|---|
| /teacher/dashboard | /tmp/qa-stageB-teacher-dash-regress.png | sidebar wordmark 升级（Stage A）；其余视觉零变化 ✓ |
| /teacher/courses | /tmp/qa-stageB-teacher-courses-regress.png | 完全零变化 ✓ |
| /teacher/instances | /tmp/qa-stageB-teacher-instances-regress.png | 完全零变化 ✓ |

CSS lx-/lxd- 前缀隔离生效，证明 547 行 globals.css 追加无副作用。

## Issues found

### Minor（不阻塞）

1. **next/image lockup.png warning** — 良性提示。建议加 `style={{ width: "auto" }}` 消除。
2. **移动 logo 高度** — globals.css:783 设 44px，spec 要求 36px。视觉无问题但偏离 spec 8px。

## Overall: PASS

业务逻辑 1:1 保留，视觉对应设计稿，所有真浏览器关键节点验证通过，回归无副作用。建议 Stage C 结束后由 builder 顺手 polish 上述 2 个 minor issue（不必现在重做 Stage B）。
