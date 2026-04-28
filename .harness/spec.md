# PR-AUTH-2 · sidebar wordmark 真 PNG 替换

> **用户原话**：用这个替换里面的 logo，目前 main 上的这个♾️环根本不对（附图 = `app-icon.png` 圆角方块 + 极光金属丝带 ∞）
>
> **背景**：PR-AUTH-1 的 wordmark.tsx 是按 `login-redesign/v4-aurora/wordmark-v2.tsx` 实现的"浅色 paper 背景适配 SVG 版本"——设计师的预案，不是真 brand mark。用户看了实际效果后判定不行。
>
> **老 spec（PR-AUTH-1）**已落地，main HEAD = `2a6abc7`

---

## Scope（单文件改动）

- `finsim/components/ui/wordmark.tsx` — SVG `<svg>` 块替换为 `<Image src="/brand/app-icon.png" />`

**不动**：
- `components/sidebar.tsx`（2 处调用 size=28 / size=24，零改动自动获益）
- 其他 lock 文件、CSS、PNG（PNG 已在 main，复用即可）

## 实施

1. 替换 wordmark.tsx 内的 `<svg width={symbolWidth} ...>` SVG 部分（约第 42-63 行）
2. 改成：
   ```tsx
   <Image
     src="/brand/app-icon.png"
     width={size}
     height={size}
     alt="灵析 AI"
     priority
     className="shrink-0"
     style={{ borderRadius: size * 0.22 }}  // PNG 自带圆角，但 wrapper border-radius 兜底防止子像素裂边
   />
   ```
3. 保留 `mono` / `showText` / `size` / `className` 所有 props 签名（API 不变）
4. **mono prop 处理**：app-icon.png 已有完整极光背景，mono 模式视觉意义不大。当前 sidebar 都是 `mono=false` 调用，**保留 prop 但不实现 mono 视觉差**（兼容签名足够，不引入新需求）
5. 文字部分保持不变（「灵析 <span class={aiColorClass}>AI</span>」）

## Acceptance Criteria

- [ ] `npx tsc --noEmit` 0 errors
- [ ] `npm run lint` 0 errors
- [ ] `npm run build` 24 routes
- [ ] 真浏览器加载 `/teacher/dashboard`：sidebar 桌面 size=28 显示真 app-icon.png（深色圆角方块 + 极光 + 金属丝带 ∞）+ 「灵析 AI」 文字
- [ ] resize 375×812：mobile topbar size=24 同样升级
- [ ] HTML 验证：`grep -c '/brand/app-icon.png' <(curl ...)` ≥ 1
- [ ] 视觉对得上用户给的参考图（金属丝带 ∞ + 圆角方块 + 极光）
- [ ] 回归：dashboard / 教师工作台 / 学生页面其他视觉零变化

## Risks

### R1 · 28×28 缩放糊度
**事实**：app-icon.png 原图 256×256 PWA 风格，缩到 28×28 是 9× 缩小。next/image 默认 webp + 自动 sharpen 能吃下，但极小尺寸金属丝带细节可能糊。
**Mitigation**：QA 真浏览器双视口（28px / 24px）截图看清晰度，如果糊度不可接受再考虑用 `symbol.png` 或独立产出 small-size 优化版。

### R2 · 浅色 sidebar 上的深色方块视觉违和
**事实**：app-icon.png 是深色背景 + 极光，放在浅色 sidebar 会形成一个"夜空小方块"。
**用户已通过附图认可**：他给的参考图就是这个效果（深色 chip + 浅色文字「灵析 AI」 在旁）。**接受**。

### R3 · `mono` prop 失效
**事实**：旧 SVG 版本 mono=true 时全白描边；新 PNG 版本 mono 视觉无差。
**Mitigation**：保留 prop 签名（向后兼容），grep 全代码确认 sidebar 之外无 mono=true 调用。**当前预期为 0 个**；如有，独立 follow-up。

## 提交信息

```
fix(brand): sidebar wordmark use real app-icon.png (PR-AUTH-2)

Replace simplified ∞ SVG (Stage A's wordmark-v2.tsx light-bg fallback)
with actual app-icon.png brand asset to match designer-delivered look.

User feedback on PR-AUTH-1: "目前 main 上的这个♾️环根本不对" — referenced
the app-icon.png lockup as desired sidebar mark.

API unchanged: size / className / mono / showText all preserved. The 2
sidebar callsites (sidebar.tsx:106 size=28, :226 size=24) auto-upgrade
with zero changes.

mono prop kept for signature compat but visual no-op (PNG includes full
aurora bg). No current mono=true callers in codebase.

Refs: .harness/spec.md PR-AUTH-2
```
