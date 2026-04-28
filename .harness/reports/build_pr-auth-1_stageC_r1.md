# Build Report · PR-AUTH-1 · Stage C · r1

## Scope · 注册页落地 + next/image 警告修复

## Files changed

| 操作 | 文件 | 变化 |
|---|---|---|
| 完全替换 | `finsim/app/(auth)/register/page.tsx` | 旧 454 行（shadcn split layout） → 新 390 行（v4 Aurora） |
| 顺手修 | `finsim/app/(auth)/login/page.tsx` | +3 行（lockup + 3 张 value 图加 style auto/auto, value 图加 loading="lazy"） |
| 顺手修 | `finsim/app/(auth)/register/page.tsx` | +1 行（lockup 加 style auto/auto） |

## 替换前 imports 校验（HANDOFF R3 风险点）

新 `page-register-dark.tsx` 实际 imports（行 22-27）：
```ts
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
```

**没有任何对 shadcn `Select` 的 import**（HANDOFF 已说改用原生 `<select>`），所有 import 在项目中都已可用，无遗漏。

班级下拉用法（行 213-230）：
```html
<select className="lx-select" id="classId" value={classId} onChange={...} disabled={...}>
  <option value="">{classesLoading ? "加载中..." : "请选择班级"}</option>
  {classes.map(...)}
</select>
```
配合 globals.css `.lx-select` 自定义箭头 SVG + 深色 option 背景（已在 Stage B 追加）。

## 业务行为 1:1 保留

| 行为 | 行号 | 状态 |
|---|---|---|
| useEffect role=student 自动 GET /api/classes | 52-63 | 保留 |
| validate() 6 条校验：name / email regex / pwd ≥6 / 一致 / classId / adminKey | 65-75 | 保留（"密码至少 6 个字符" 旧版是"密码至少6个字符"，新版加了一个空格——文案微调，不算业务行为变化） |
| handleSubmit: POST /api/auth/register → 自动 signIn → role redirect → router.refresh() | 77-125 | 保留 |
| switchRole: 切换 role 时清空 classId/adminKey/inlineError | 127-132 | 保留（旧版是 inline，新版抽函数复用，逻辑等价） |
| toast 文案："注册成功，正在自动登录..." / "自动登录失败，请手动登录" / "获取班级列表失败" | 60/102/109 | 保留 |
| inlineError 文案：教师 / 学生 / 必填 / 密码长度 / 密码一致 / 邮箱格式 | 66-73 | 保留 |

## next/image warning 修复（QA 在 Stage B 看到的）

**根因**：CSS `.lx-brand-logo { height: 56px; width: auto }` 和 `.lx-orbit-img { width: 100% !important; height: 100% !important }` 都同时改写了 next/image 的尺寸，但只给了一个维度（或两者都用 !important 改），触发 `<Image>` 的 "either width or height has been modified, but not the other" warning。

**Fix**：next.js 官方推荐做法 — 在 JSX 上加 `style={{ width: "auto", height: "auto" }}`，告诉 Next 已知并接受 CSS 控制 aspect。

3 处修复：
1. `login/page.tsx` line 130-138：lockup `<Image>` 加 `style={{ width: "auto", height: "auto" }}`
2. `login/page.tsx` line 273-281：value `<Image>` 加 `style={{ width: "auto", height: "auto" }}` + `loading="lazy"`（同时落实 spec R4）
3. `register/page.tsx` line 316-324：lockup `<Image>` 加 `style={{ width: "auto", height: "auto" }}`

注：lockup 仍保留 `priority`（首屏 LCP），value 图改为 `loading="lazy"`，符合 spec R4。

## 视觉关键点（renders 验证）

| 元素 | 实现 | curl 命中 |
|---|---|---|
| 标题渐变「会合」 | `<em>会合</em>` + `.lx-title em` 渐变 + 发光 | `<em>会合</em>` |
| 主按钮 | `<span>{创建账号}</span>` + `.lx-submit` 双色渐变 | "创建账号" |
| 班级 native select | `<select class="lx-select" id="classId">` | 命中 |
| Role switch group | `role="group" aria-label="选择注册角色"` | 命中 |
| 密码提示 | `<div class="lx-password-hint">建议包含字母与数字组合</div>` | 命中 |
| Aurora background | `.lx-aurora` + `.lx-aurora-mood` (opacity 0.45 在 register CSS 不在；都是 0.55) | curl 看到 lx-aurora-mood class |

**注**：spec 说 register opacity 0.45 比 login 0.55 略低，但实际 CSS 文件里 `.lx-aurora-mood { opacity: 0.55 }` 是唯一规则，没区分 login/register。两页用同一份 CSS 是 HANDOFF 与 spec 都说好的设计（CSS 共用），所以两页 mood 透明度都是 0.55 — 这是设计源代码的真相，HANDOFF/spec 的 0.45 vs 0.55 描述与实际 CSS 不符，以**源代码为准**。如果 QA 觉得这是个真问题再调。

**注**：spec 提到"看见"二字渐变，实际源 `page-register-dark.tsx` line 341 是 `<em>会合</em>`。源 > spec 描述。

## Verification（Stage C 验收清单）

| 检查 | 命令 | 结果 |
|---|---|---|
| TypeScript 0 errors | `npx tsc --noEmit` | PASS（无输出） |
| ESLint 0 errors | `npm run lint` | PASS（0 errors，19 warnings 全部 pre-existing） |
| HTTP 200 | `curl -sI http://localhost:3000/register` | `HTTP/1.1 200 OK` |
| `lx-page` 出现 | `grep -c 'lx-page'` | `1` |
| Role chip 类 | `grep 'lx-role-'` | `lx-role-switch` / `lx-role-chip-label` / `lx-role-chip-sub` 全命中 |
| 登录页未回归 | `curl /login` 还含 `<em>教学</em>` | 命中（Stage B 仍然好的） |
| **`npm run build`** | 24 page routes（去掉 /api/） | **PASS · 24 routes**（与基线一致 - `/login` `/register` 都是 ○ static） |
| **`npx vitest run`** | 全绿 | **PASS · 707 tests / 55 files** |
| Dev server 启动日志 | grep error | 无 compile error |

## 完整累计 diff stat（Stage A+B+C）

```
 app/(auth)/login/page.tsx    | 491 ++++++++++++++++++++-------
 app/(auth)/register/page.tsx | 523 +++++++++++++++++++--------
 app/globals.css              | 547 +++++++++++++++++++++++++++++++
 components/ui/wordmark.tsx   |  85 ++++---
 4 files changed, +1228 / -810
```

（不含 spec.md 与 progress.tsv 的 harness 文件）

## Decisions / 不确定项

- **Spec 描述 vs 源码差异**（前面已注）：
  - register opacity：spec 说 0.45 / 实际 CSS 0.55（共享）→ 以源为准
  - 「看见」 vs 「会合」：spec 是 hint，源是 `<em>会合</em>` → 以源为准
  - 这两点都是 HANDOFF 文案早期与最终源代码的不一致，spec 应该改 hint 与源对齐（这是 spec 维护问题，不是 builder 应该独立改的范围）
- **`@media (prefers-reduced-motion: reduce) { *, ::before, ::after }`** 在 Stage B 已分析过，这是预期的全局 a11y 增强
- **CSS opacity 不区分 login/register**：源 CSS 里只有一条 `.lx-aurora-mood { opacity: 0.55 }`。如果设计上要 register 0.45，需要追加 `body[data-page="register"] .lx-aurora-mood {...}` 之类的覆盖；但源代码意图就是共用 — 不擅自改设计意图

## Next: 等 QA 全部 PASS

按 coordinator 指示：**Stage C 完成后先不 commit**，等 QA 全部 PASS 后再一次性提交三阶段所有改动。

---

## Addendum · Polish 2 · 移动 logo 高度对齐 spec（46 → 36）

QA Stage B 反馈两条 polish 项，本报告已包含 Polish 1（next/image warning 修复 — 见上方"next/image warning 修复"小节）。Polish 2 在收到 coordinator 指示后追加：

**改动**：`finsim/app/globals.css:783`
```diff
 @media (max-width: 720px) {
   ...
-  .lx-brand-logo { height: 44px; }
+  .lx-brand-logo { height: 36px; }
   ...
 }
```

**理由**：spec L97（acceptance criteria）要求移动端 logo 36px，源 CSS 写的是 44px。Polish 2 让 CSS 与 spec 数值对齐。桌面默认值 56px 不动。

**验证**：
- `npx tsc --noEmit` 0 errors（CSS 改动不影响类型）
- `npm run lint` 0 errors（同上）
- `curl -sI /login` / `curl -sI /register` 仍返回 200
- 真浏览器 < 720px viewport 下 wordmark 视觉高度变低，QA 用 `/qa-only` 验证

## 累计 diff stat（含 Polish 1+2）

```
 app/(auth)/login/page.tsx    | 491 ++++++++++++-----
 app/(auth)/register/page.tsx | 523 +++++++++++--------
 app/globals.css              | 547 +++++++++++++++++++++  (含 1 字节 Polish 2 微调)
 components/ui/wordmark.tsx   |  85 ++++---
 4 files changed
```
