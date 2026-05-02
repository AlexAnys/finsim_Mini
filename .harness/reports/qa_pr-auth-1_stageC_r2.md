# QA Report · PR-AUTH-1 · Stage C · r2

## Spec: r1 FAIL 修复（lockup logo CSS height 失效）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. r1 regression 已修复（logo 尺寸）| **PASS** | 桌面 169×56 / 移动 108×36 全 4 组合命中 spec |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. r1 已 PASS 项未回归 | PASS | 注册闭环 / DOM / role 切换 / 校验 / sidebar 全保持 |
| 4. next/image warning | **不阻塞** | warning 重新出现（builder 预期错），但属良性，符合 spec 「良性提示 → 不阻塞」 |
| 5. Cross-module regression | PASS | sidebar wordmark `M 14 22 ...` ∞ 双环未变 / teacher1 登录 200 |

## Logo 尺寸 4 组合验证

| Page | viewport | spec 期望 | r1 实际（FAIL）| r2 实际 | 验 |
|---|---|---|---|---|---|
| /login | 1440×900 | 56px | 256×85 | **169×56**（cssH=56px / cssW=168.66px）| ✓ |
| /login | 375×812 | 36px | 256×85 | **108×36**（cssH=36px / cssW=108.42px）| ✓ |
| /register | 1440×900 | 56px | 256×85 | **169×56** | ✓ |
| /register | 375×812 | 36px | 256×85 | **108×36** | ✓ |

natural lockup.png 比例 256:85 ≈ 3.01:1，r2 渲染：
- 56 高 → 56 × 3.01 = 168.5（实测 168.66 ✓）
- 36 高 → 36 × 3.01 = 108.4（实测 108.42 ✓）

**r1 引入的 regression 完全修复**。CSS `.lx-brand-logo { height: 56px; width: auto; }` 与移动 `@media { height: 36px; }` 重新生效。

Value 图（CSS 用 `!important`）渲染仍 344×258，未受影响 ✓。

## 截图

- `/tmp/qa-stageC-r2-login-1440.png`（桌面 logo 169×56 + ValueOrbitStrip 3 列）
- `/tmp/qa-stageC-r2-login-mobile.png`（移动 logo 108×36 + orbit 1 列纵向）
- `/tmp/qa-stageC-r2-register-1440.png`（桌面注册页 + 0 orbit）
- `/tmp/qa-stageC-r2-register-mobile.png`（移动注册页 + 0 orbit + form 字段紧凑）

视觉与 Stage B 截图（`/tmp/qa-stageB-login-1440.png`）一致 — Stage B 桌面 logo 168×56，r2 桌面 169×56，差 1px 像素四舍五入。

## next/image warning（决策：良性，不阻塞 PASS）

**事实**：r2 reload `/login` 和 `/register` 后 console 仍出 1 条：
```
[warning] Image with src "/brand/lockup.png" has either width or height
modified, but not the other. If you use CSS to change the size of your
image, also include the styles 'width: "auto"' or 'height: "auto"' to
maintain the aspect ratio.
```

**根因**（builder 预期与 next/image 实际行为不一致）：next/image runtime 检测的不仅仅是 attr vs CSS 单边差异，而是更严格 — CSS 同时改了 width（变 auto）和 height（变 56px）两边，inline style 必须**两个都标 auto**才能完全消除 warning。但**两个都标 auto** 又会让 CSS height 失效（r1 的 regression 来源）。

这是 next/image 框架本身的过严校验，与 Tailwind/global CSS 风格不友好。

**决策依据**：
- spec 没要求 console 0 warning（只要求功能/视觉对齐）
- team-lead Stage B 验收时已说"良性提示 → 不阻塞"
- 实际渲染完全正确，complete=true / visible=true / 比例正确
- 选择 logo 视觉正确（spec L97 强约束）vs 完全消除 warning（无强约束），优先 logo 视觉

**潜在更彻底的修复路径**（若用户要求 console 0 warning）：
1. 改用 `<Image fill />` + parent 设 relative + 固定尺寸（重构成本中等）
2. CSS `.lx-brand-logo { height: 56px !important; width: auto !important; }` 配合 inline `auto, auto`（保留 r1 修法但 CSS 用 !important）— 改动最小
3. 直接用原生 `<img>` 替代 `<Image>`（牺牲 next/image 的优化）

均超出 r2 spec 范围，不在本轮处理。

## r1 已 PASS 项守护检查（未回归）

- DOM 全验：lx-page × 1 / lockup × 1 / **0 orbit-strip**（注册页）/ role-switch + 2 chips / `<select.lx-select>` 班级 2 项 / lx-password-hint / `<em>会合</em>` ✓
- Role 切换：student↔teacher classId/adminKey 双向清空 ✓
- 7 条校验全保持 ✓
- 真注册闭环：`qa-r2-{TS}@finsim.edu.cn` 学生 + 金融2024A班 → POST /api/auth/register → 自动登录 → /dashboard → "晚上好，r2 验证用户" ✓
- sidebar wordmark `path d="M 14 22 ..."` ∞ 双环未变 ✓
- teacher1 登录回归：/login → /teacher/dashboard 200 + sidebar "灵析 AI" 命中 ✓
- value 图回归：344×258 / 3 张 / loading="lazy" 仍正确 ✓

## Issues found

无（r2 修复有效，剩下 next/image warning 是良性框架提示，不阻塞）

## Overall: **PASS**

**Stage C r2 验收通过**。logo 尺寸 r1 regression 完全修复，spec 全部 acceptance criteria 满足（functional + visual + business + cross-module 全绿）。next/image warning 重新出现但属良性框架提示，按 spec 与 team-lead 既定原则不阻塞。

**dynamic exit 状态**：Stage C r1 FAIL → r2 PASS，符合 2 连 PASS 收工的方向。Stage A r1 PASS / Stage B r1 PASS / Stage C r1 FAIL → r2 PASS — 整 PR-AUTH-1 三阶段已全部通过 QA 验收。

建议 team-lead 协调 builder 做最终 commit + push。
