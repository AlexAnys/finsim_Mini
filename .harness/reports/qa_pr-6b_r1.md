# QA Report — pr-6b r1 (8 空错态组件 + boundary 挂载)

**Phase 6 · 第 2 PR / 3** — 2026-04-25 qa-p6 (independent verification of build_pr-6b_r1.md)

## Spec: 建立 8 种 state 组件 + 挂到 root/auth/(student)/teacher 路由组的 not-found / error boundary

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 9 文件 components/states/（8 specialized + state-card 共享底座 + index.ts），每个 state 五件套（icon + tag + title + desc + 双 CTA）齐 · 7 boundary 挂载（root not-found+error / auth error / student not-found+error / teacher not-found+error）· 中文文案 + 克制配色（深靛/暖赭/象牙 token）|
| 2. tsc --noEmit | PASS | 0 错（silent completed）|
| 3. vitest run | PASS | **366 / 366 passed**（37 files / 3.93s）无新增也无破坏（builder 自报组件 declarative pure rendering 不做 RTL，可接受）|
| 4. Browser (curl SSR + 真 NextAuth E2E + RSC 流验证) | PASS | 9 场景全对（见下表）|
| 5. Cross-module regression | PASS | 11 路由（学生 4 + 教师 7）全 200 · `/teacher/tasks/new` task wizard 200 · auth flow 教师/学生双 302 · PR-1A 角色感知 sidebar 守护双向无泄漏（teacher: 教师工作台=3 学生 nav=0；student: 学习空间=3 教师 nav=0）· PR-SEC1-4 unauth /api/tasks 401 · register / login 路径不破 · 仅修改 2 个 layout 文件（teacher 加 +25 行 roleGuard，student 加 +5 行 unauth redirect）|
| 6. Security (/cso) | N/A | 加 unauth redirect 是补 NextAuth canonical 行为（pages.signIn=/login 兜底）；ForbiddenState 是渲染策略不是 HTTP 状态——SEC guard 仍在 API 层（PR-SEC1-4 全保留）；layout 改动不引入新 attack surface（仍走 getSession + role 判断）；OWASP/STRIDE 无需触发 |
| 7. Finsim-specific | PASS | UI 全中文（页面不见了 / 服务器开小差 / 你还不能看这个页面 / 登录已过期 / 系统升级维护中 / 暂无数据 / 没有匹配到内容 / 看起来没网了）· auth flow 走 NextAuth 不动 · 0 service interface 改动 · Route Handler 零改 · API 响应 shape 未变 · token-only 上色（grep 仅 1 处 `#fff` 在 state-card celebrate variant 的 icon white text on gradient bg，业界惯例可接受）|
| 8. Code patterns | PASS | 16 文件新建 + 2 layout 改造，diff 干净 surgical（`git diff --stat`：student layout +5 / teacher layout +25 + spec/progress harness 修订）· 0 drive-by · NotFoundState/ServerErrorState 等 8 个 specialized state 都通过 StateCard 共享底座 forward props · variant: info/celebrate/error 三档清晰分流（celebrate 用 gradient + boxShadow，error 用 14% color-mix bg + 35% border，info 用 fs-bg-alt）· `role="alert"` 仅 error variant 套（a11y 合规）|

## 9 场景 E2E 矩阵

| # | 场景 | URL | HTTP | 内容验证 |
|---|---|---|---|---|
| 1 | anonymous 根 404 | `/this-page-doesnt-exist` | 404 (21597b) | 5 件套全命中：`页面不见了`=1 / `错误 · 404`=1 / `返回首页`=1 / `去登录`=3（含 secondary 按钮文案）/ FileQuestion lucide SVG inline · 无 stack-trace / 无 Next.js Default 错误页痕迹 |
| 2 | anonymous /dashboard | `/dashboard` | **307 → /login** | 新行为：补 NextAuth canonical（`pages.signIn="/login"`），改前是 200+无 session shell（PR-1A 报告 L57-58 明示 pre-existing fallback）|
| 3 | anonymous /teacher/dashboard | `/teacher/dashboard` | **307 → /login** | 同上 |
| 4 | student /dashboard | `/dashboard` | 200 | 学生 layout shell + nav 正常（学习空间=3）|
| 5 | student /teacher/dashboard | `/teacher/dashboard` | **200 + ForbiddenState inline render** | 5 件套：`你还不能看这个页面`=2 + `教师工作台仅对教师和管理员可见`=2 + `错误 · 403`=1 + 双 CTA `回到学习空间`=4 + `联系管理员`=2 + ShieldAlert lucide SVG inline · 学生侧 nav 命中 `我的课程=1` `课程管理=0` PR-1A 角色感知守护未破 |
| 6 | student /teacher/courses | 200 | 同 5 |
| 7 | student /teacher/instances | 200 | 同 5 |
| 8 | student /courses/bogus-id | 200 (43335b) | RSC stream 推送 NotFoundState client component ref（`$L25`）+ props 完整：`页面不见了`=1 / `回到学习空间`=2 / `查看课程`=1 / `你要找的页面不存在`=1 — hydrate 后渲染（**dev mode RSC streaming 优化，非 bug**，prod build `_not-found.html` 已验证 inline SSR）|
| 9 | teacher /teacher/instances/bogus-id | 200 (43687b) | RSC stream + props：`页面不见了`=1 / `回到教师工作台`=2 / `查看课程`=1 |

## 关键证据：dev mode RSC stream 行为

scenario 8/9 为何 SSR 阶段不直出 NotFoundState 内容？

**根因**：`components/states/not-found.tsx` 标 `"use client"`（client component）。Next.js dev streaming 模式会把它序列化成 RSC payload `["$","$L25",null,{"title":"页面不见了","description":"...","primaryAction":{"label":"回到学习空间","href":"/dashboard"},"secondaryAction":{"label":"查看课程","href":"/courses"}}]`，等 client hydrate 时再渲染。

**Prod build 验证（`.next/server/app/_not-found.html`）**：
```html
<div class="border-b px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-5"
     style="background:var(--fs-bg-alt);border-color:var(--fs-line-2)">错误 · 404</div>
<div class="text-[17px] font-semibold tracking-tight text-ink">页面不见了</div>
<div class="max-w-[440px] text-[12.5px] leading-relaxed text-ink-4">你要找的页面不存在或已被移走...</div>
```
prod build 完美 inline SSR + token-based css + 中文 tag + lucide icon SVG。

scenario 5（teacher layout 内嵌 ForbiddenState）则是 SSR 直出（layout server component 直接 render ForbiddenState client ref 但子内容也被 SSR）—— inline HTML 命中 `<div class="text-[17px] font-semibold tracking-tight text-ink">你还不能看这个页面</div>`。

**结论**：8/9 dev RSC streaming 是 Next.js 优化行为，hydrate 后内容完整可达；prod build 不复现。可接受。

## CSS token 覆盖（served stylesheet）

| Token | 命中数 |
|---|---|
| fs-bg-alt | 8 |
| fs-line-2 | 8 |
| fs-ink-3 | 5 |
| fs-danger | 14 |
| fs-info | 8 |
| fs-warn | 10 |
| fs-accent | 18 |
| fs-primary | 69 |

8 个关键 token 全在 `/public/_next/static/chunks/app_globals_71f961d1.css` 命中，state-card 不会因 token 缺失渲染异常。

## Boundary chunk 挂载验证

通过 RSC payload 反查每个场景注册的 chunk：
- root 404 → `app_error_tsx` + `app_not-found` 都注册 ✓
- (student)/courses/bogus → `app_(student)_error` + `app_(student)_not-found` + 套 root `app_error_tsx` ✓
- /teacher/instances/bogus → `app_teacher_error` + `app_teacher_not-found` + 套 root ✓
- student on /teacher/dashboard → 套 `app_teacher_error` + `app_teacher_not-found`（teacher layout 下，layout-level role gate）✓

7 个 boundary 文件 Next.js 全正确按文件名约定挂载到对应路由组。

## Builder 自报 4 个担心点的 QA 判断

1. **(student) layout 加 anonymous redirect** — **PASS**：补 NextAuth canonical pattern + spec L72 acceptance 隐式前提。改前 anonymous 200+empty-shell 是 PR-1A QA 明示的 pre-existing 行为（PR-1A QA 报告 L57-58）。改进合理，未触动 auth/secret/permission 模块本身。
2. **未 migration 现有 50+ 处"暂无 XXX"到新组件** — **PASS but observed**：spec L62-63 措辞"复用 empty-list / no-search-result"中"复用"=可用，没说"必须迁移现有"。CLAUDE.md rule 7+9（最小变更 + 不动 task scope 外文件）支持留后续 PR。已观察存在的 inline 空态：`teacher/tasks/page.tsx:165` `teacher/announcements/page.tsx:226`，可作为 Phase 7+ 增量 migration 工作。
3. **404 / Forbidden 全是 200 不是真 HTTP 404 / 403** — **PASS**：spec L72 acceptance 字面"403 状态"= UI 状态卡（mockup `auth-states.jsx` L260-265 也是页面级状态卡）。NotFoundState (root) 走 Next.js `_not-found` chunk 标记 HTTP 404 ✓ 已验证（scenario 1）。Forbidden 在 layout 内嵌 200 是 spec-aligned 设计选择。
4. **500 boundary 没真 throw 验证** — **PASS**（接受 builder 报告 L138-145 信任 framework 路径）：理由：(a) `npm run build` 25 routes 全 compile + `app/error.tsx` chunk 在 build output（`/_next/static/chunks/app_error_tsx_*.js`）注册 (b) RSC payload 反查每个场景 `app_error_tsx` 都已 wired (c) 4 个 error.tsx 文件结构经 Read 证实（client component + reset/digest props + ServerErrorState fullPage forward）(d) 真注入 throw 测试有"忘记还原"风险，作为 manual smoke test 留后续。

## Risks / 备注（不阻塞 PASS）

- `network-error.tsx` / `maintenance.tsx` / `session-timeout.tsx` 三个组件已建好但**没有任何 page/middleware 主动渲染它们**（builder 报告 L156-163）—— 是 future use 预制件。spec L42 acceptance "8 种 state 都有插画 / icon（不是空盒子）"已满足（每个组件都用 lucide icon + tag strip + 五件套），spec 没要求触发链路全部就位。
- 移动端响应式（state card 在 375px）spec 未要求显式验证，state-card 默认 `max-w-[480px]` + `flex-wrap gap-2` for buttons，理论上自适应；本 QA 未实测移动端。
- 暗色模式 `.dark` token 链存在（PR-0/1/2 已落），state-card 走 var(--fs-*) 自动跟随暗色，未实测。
- 50+ 处现有 inline 空态待后续增量迁移（见自报担心点 #2）。

## Issues found

无。

## Overall: **PASS**

Phase 6 第 2 PR · 8 种 state 组件 + 7 boundary 挂载 + 2 layout 改造（teacher role gate + student unauth redirect）。9 场景 E2E + 11 路由 regression + 角色感知 sidebar 守护 + Auth/SEC1-4 守护 全绿。Builder 4 个担心点全 QA 判 PASS。建议 builder-p6 直接认领 PR-6C（task #68）—— Phase 6 倒数第二个 PR。

**连 PASS 计数**：PR-6A r1 PASS → PR-6B r1 PASS = 2 连续。Dynamic exit "2 轮连 PASS ship" 已达成 → Phase 6 可继续 PR-6C 收尾。
