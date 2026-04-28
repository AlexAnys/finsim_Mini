# Build Report · PR-AUTH-1 · Stage C · r2

## Scope · 修复 r1 Polish 1 副作用（QA Stage C 唯一 FAIL 项）

## QA r1 失败原因（已确认）

`<Image style={{ width: "auto", height: "auto" }}>` 让 inline style 优先级压过 `.lx-brand-logo` CSS class（`height: 56px` 桌面 / `height: 36px` 移动），导致 lockup 渲染回 256×85 natural 尺寸（spec 要求 168×56 / 移动 36 高）。Polish 2（globals.css:783 → 36px）虽然 CSS 改了，但被 inline style 压死，没真正生效。

## Fix（QA 推荐方案 A · 最小改动）

只改 lockup 2 处 lockup `<Image>`，把 `style={{ width: "auto", height: "auto" }}` 改成 `style={{ width: "auto" }}`，删掉 height 让 CSS 重新接管：

| File | Line | 改动 |
|---|---|---|
| `app/(auth)/login/page.tsx` | 136 | `style={{ width: "auto", height: "auto" }}` → `style={{ width: "auto" }}` |
| `app/(auth)/register/page.tsx` | 322 | 同上 |

**不改第 3 处** — `app/(auth)/login/page.tsx:280` 的 value 图（`.lx-orbit-img`）保留 `auto, auto`：CSS 用了 `width: 100% !important; height: 100% !important`，inline style 不能覆盖 `!important`，所以 r1 实测 344×258 渲染正确，按 QA 指示不动。

## next/image warning 不会复发的原因

next/image 的 warning 触发条件是「width 或 height 被 CSS 改了，但另一个没改」。`.lx-brand-logo` CSS 同时设 `height: 56px` + `width: auto`（含 mobile 36px / auto），inline `style={{ width: "auto" }}` 显式声明 width 为 auto 与 CSS 一致，next/image runtime 看到 inline 已声明 width 就满足校验，不再 warn。

QA r1 真浏览器验过 console 0 warning，本次改动 inline 仍含 `width: "auto"`，对 warning 校验来说效果等价 — 应仍是 0 warning。

## 验证（builder 侧）

| 检查 | 命令 | 结果 |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors（exit=0）|
| ESLint | `npm run lint` | 0 errors / 19 pre-existing warnings |
| /login HTTP | `curl -sI` | `HTTP/1.1 200 OK` |
| /register HTTP | `curl -sI` | `HTTP/1.1 200 OK` |
| login lockup `<Image>` | `grep -A 1 lx-brand-logo` | `style={{ width: "auto" }}` ✅ |
| register lockup `<Image>` | `grep -A 1 lx-brand-logo` | `style={{ width: "auto" }}` ✅ |
| login value `<Image>` 未动 | `grep -A 1 lx-orbit-img` | `style={{ width: "auto", height: "auto" }}` ✅ 保留 |

## Diff stat（r2 vs r1）

```
 app/(auth)/login/page.tsx    | 1 line modified（line 136）
 app/(auth)/register/page.tsx | 1 line modified（line 322）
 2 files changed, +0 / -0（仅修改 1 行 inline style，每行）
```

实际为单字符串删除：删除 `, height: "auto"` 共 16 字符 × 2 处。

## Predicted post-fix renders

| Page | Viewport | CSS rule | Expected logo height | natural ratio | width |
|---|---|---|---|---|---|
| /login | desktop ≥ 720 | `.lx-brand-logo { height: 56px }` | **56px** | 1024:340 ≈ 3.0 | ~168px |
| /login | mobile < 720 | `.lx-brand-logo { height: 36px }` | **36px** | same | ~108px |
| /register | desktop | same | **56px** | same | ~168px |
| /register | mobile | same | **36px** | same | ~108px |

## QA r2 待验

- desktop 1440 + mobile 375 双视口测 `getComputedStyle(.lx-brand-logo).height` 应为 56px / 36px
- console 重 reload `/login` + `/register` 应 0 next/image warning
- 真注册闭环再跑一次（保险）
- 三 role 登录闭环回归（保险）

## Status

r2 等 QA verdict。如 PASS：unit pr-auth-1 完成，听 coordinator 信号统一 commit + push（A+B+C r1+r2 一次性）。
