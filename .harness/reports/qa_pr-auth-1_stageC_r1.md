# QA Report · PR-AUTH-1 · Stage C · r1

## Spec: 注册页落地 + Polish 1 (next/image warning) + Polish 2 (mobile logo 36px)

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance（注册页主体）| PASS | role chip / native select / classes load / 校验 / 注册闭环全对齐 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. npm run lint | PASS | 0 errors / 19 warnings 全部 pre-existing |
| 4. npm run build | PASS | 24 page routes（与基线一致）|
| 5. vitest run | PASS | 707 / 707 passed |
| 6. Browser register DOM + 真注册闭环 | PASS | 全部命中 |
| 7. Console (Polish 1 验证) | PASS | login + register reload 后 0 next/image warning（之前每次都报 1 条）|
| 8. **Mobile logo 36px (Polish 2)** | **FAIL** | 移动 viewport 实际渲染 256×85，CSS 36px 被 Polish 1 inline style 覆盖 |
| 9. **Desktop logo 56px (回归)** | **FAIL** | 桌面 viewport 实际渲染 256×85，CSS 56px 同样被覆盖 |
| 10. Cross-module regression（sidebar）| PASS | sidebar wordmark `path d="M 14 22 ..."` ∞ 双环未变 |

## 视觉验证（真浏览器 1440×900）

截图：`/tmp/qa-stageC-register-1440.png`（首次拍摄，仍能看到主结构对齐）/ `/tmp/qa-stageC-register-1440-RECHECK.png` / `/tmp/qa-stageC-login-1440-RECHECK.png`

**注册页 DOM 结构**：
- `.lx-page` × 1 ✓
- `<img src="/brand/lockup.png">` × 1 ✓
- **`.lx-orbit-strip` × 0**（注册页不显示 orbit）✓
- `.lx-role-switch[role="group"]` × 1 + `.lx-role-chip` × 2 ✓
- 默认 active = "学生注册"（label 文本验证）✓
- `<select class="lx-select">` × 1，options = ["请选择班级", "金融2024A班 (FIN-2024-A)", "金融2024B班 (FIN-2024-B)"] ✓
- `.lx-password-hint` 文本 = "建议包含字母与数字组合" ✓
- 标题 `<em>会合</em>`（接受源代码为准，符合 team-lead 指示）✓

## Role 切换状态机

| 操作 | 期望 | 实际 |
|---|---|---|
| 初始 (默认 student) | classSelect 显示，adminKey 隐藏 | ✓ |
| 切到 teacher | classSelect 隐藏，adminKey 出现，classId 清空 | ✓（hasClassSelect=0, hasAdminKey=1）|
| 在 teacher 填 adminKey="test-key" | input 接受 | ✓ |
| 切回 student | adminKey 隐藏，classSelect 出现，**classId 清空（""）** | ✓ |

## 校验失败提示（7 条全测）

| 场景 | 期望 | 实际 |
|---|---|---|
| 空姓名 | 请输入姓名 | ✓ |
| 空邮箱 | 请输入邮箱 | ✓ |
| 邮箱格式错（`a@b` 绕过 HTML5 native）| 邮箱格式不正确 | ✓ |
| 密码 5 位 | 密码至少 6 个字符 | ✓ |
| 两次密码不同 | 两次输入的密码不一致 | ✓ |
| student 没选班级 | 学生必须选择班级 | ✓ |
| teacher 没填密钥 | 教师注册需要输入注册密钥 | ✓ |

注：HTML5 `type="email"` native validation 是第一道防线（`invalid-email` 字符串无 @ 直接被浏览器拦截 form submit），React custom regex 是第二道（`a@b` 通过 native 但被 regex 拦下）。**双层校验是更安全设计**，符合预期。

## 真注册闭环（关键）

email = `qa-test-1777370993@finsim.edu.cn`（timestamp）：

1. 切到 student（默认）
2. GET `/api/classes` → 200 (249B, 83ms)，classes 列表 2 班 ✓
3. 选金融2024A班（deedd844-...）
4. 填姓名 "QA 测试" / 邮箱 / 密码 / 确认密码
5. 提交 → POST `/api/auth/register` → toast "注册成功，正在自动登录..." → 跳 `/dashboard` ✓
6. 跳转后 sidebar 显示新用户 "QA 测试" / role "学生"（截图 /tmp/qa-stageC-after-register.png）
7. Hero 显示 "晚上好，QA 测试" ✓ (router.refresh() 也生效，dashboard 数据加载完整)

## Console warning 验证（Polish 1 fix）

Stage B 时 console 有：`[warning] Image with src "/brand/lockup.png" has either width or height modified...`

Stage C reload 后 `/login` console：
```
[info] Download the React DevTools...
[log] [HMR] connected
```

`/register` console 同样：
```
[info] Download the React DevTools...
[log] [HMR] connected
```

**Polish 1 fix 生效，next/image warning 完全消除** ✓

## ⚠ Issues found（**FAIL** — Polish 1 引入回归）

### #1 lockup logo 失去 CSS 尺寸控制（桌面 + 移动都受影响）

**根因**：Polish 1 在 lockup `<Image>` 加了 `style={{ width: "auto", height: "auto" }}`。inline style 优先级高于 CSS class，导致：
- `.lx-brand-logo { height: 56px; width: auto; }` （桌面）— height 失效
- `@media (max-width: 720px) { .lx-brand-logo { height: 36px; } }` （移动 Polish 2）— 同样失效

**实测渲染（getComputedStyle）**：

| Page | viewport | spec 期望 | 实际渲染 | inline style |
|---|---|---|---|---|
| /login | 1440×900 | 56px high | **256×85** (natural) | `height: auto, width: auto` |
| /login | 375×812 | 36px high | **256×85** (natural) | `height: auto, width: auto` |
| /register | 1440×900 | 56px high | **256×85** | 同上 |
| /register | 375×812 | 36px high | **256×85** | 同上 |

**视觉影响**：
- 桌面 1440 视觉差异较小（layout 还能容纳，但比 Stage B 168×56 大约 1.5×，截图对比 `/tmp/qa-stageB-login-1440.png` vs `/tmp/qa-stageC-login-1440-RECHECK.png` 明显）
- 移动 375 比较明显，logo 撑到接近视口宽度 256px / 375px = 68% 占比，且 85px 高比 mobile spec 期望 36px 大 2.4×
- 没有溢出（256 < 375 - 24px×2 padding 还有些空间），但偏离设计稿

**对 Polish 2 的影响**：globals.css:783 `height: 36px` 改动**没真正生效**，因为被 inline style 覆盖。

### 修复建议

**方案 A（推荐，最小改动）**：lockup `<Image>` 只设 `style={{ width: "auto" }}`，**移除 `height: "auto"`**，让 CSS height 重新生效。next/image 看到 inline width auto 就满足 warning 条件。

```diff
- style={{ width: "auto", height: "auto" }}
+ style={{ width: "auto" }}
```

3 处需改：
1. `app/(auth)/login/page.tsx:130-138` lockup
2. `app/(auth)/register/page.tsx:316-324` lockup
3. `app/(auth)/login/page.tsx:273-281` value（**这处可以保留** — CSS `.lx-orbit-img` 用了 `!important`，不会被 inline 覆盖；实测 value 图渲染正确 344×258）

**方案 B（保险）**：保留 inline auto，但 CSS 加 `!important`：
```diff
.lx-brand-logo {
-  height: 56px;
+  height: 56px !important;
}
```
但 `!important` 蔓延不优雅。

**实测验证 value 图未受影响**（CSS 已用 `!important`）：3 张 `.lx-orbit-img` 渲染 344×258（容器尺寸），inline `height: auto` 被 CSS `height: 100% !important` 压住。

## 移动 viewport 其他验证

| 检查 | 期望 | 实际 |
|---|---|---|
| `.lx-orbit-grid` (login only) | 1 列纵向 | ✓ |
| `.lx-title` font-size | 30px | ✓ |
| Form 字段全部可见 | 5 字段 + role chip + button | ✓ |

## 视觉回归（其他页面）

sidebar wordmark `path d="M 14 22 C 14 10, 30 10, 40 22 ..."` 仍是 ∞ 双环 ✓（dashboard / 任意学生页面 sidebar 不受影响）

## Overall: **FAIL**

**主体功能 100% 对齐 spec**（注册闭环 / 校验 / role 切换 / DOM / next/image warning 消除全部对），但 **Polish 1 引入 logo 尺寸回归**：
- 桌面 56px → 实际 85px
- 移动 36px → 实际 85px（Polish 2 完全失效）

**给 builder 的建议**：方案 A 最小改动（3 处 inline style 中 lockup 2 处删 `height: "auto"` 保留 `width: "auto"` 即可，value 图保留不动）。改完后重新让 QA 验证 logo 桌面 56 / 移动 36 + console 无 warning + value 图仍 344×258。

预计修复成本 < 5 分钟（3 行 diff），重验时间 < 5 分钟。
