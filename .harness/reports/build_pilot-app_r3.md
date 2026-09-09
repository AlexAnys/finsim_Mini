# 试点应用可靠性 · builder r3：冷启动登录初始化竞态

2026-09-09。只修正式 E2E 暴露的登录故障；不关闭 CSRF、不加 sleep、不自动重试登录，不扩业务。

## 原路径核验

独立读取首例失败 trace 的网络时序（未复制凭据或 cookie 值）：同一 student 页面在约 1695ms 并发发出两次不带 Cookie 的 `/api/auth/session`，一条约 13ms 返回，另一条约 573ms 返回。登录的 `/csrf` 与迟到的初始响应交错，credentials POST 确实发出，HTTP 200 内返回 MissingCSRF。

Auth.js `init` 会在请求没有有效 CSRF cookie 时各自创建一个；`signIn` 再 GET `/csrf` 并将其 body token 随 callback POST 发送。并发匿名初始化可导致 body token 和最终 cookie 不匹配。只等待 `useSession.status !== loading` 不充分：最快的一条初始化已经可以先把 loading 清掉，另一条仍在途。

## 修改范围

- `lib/auth/client-session-bootstrap.ts`：只共用一次在途初始化 Promise，不缓存用户结果。`/session` 必须成功并得到有效 session/明确匿名结果；15 秒 AbortController 截止，失败不自动重试。
- `components/providers.tsx`：先完成上述响应（建立浏览器 cookie），再挂载带明确 initialSession 的 SessionProvider 和页面。StrictMode 重放也共用同一初始请求；随后 Provider 即使额外查询也已有 cookie。失败显示错误，不开放登录表单；等待状态有明确文字。
- `components/auth/login-form.tsx`：loading 状态不可填/提交，submit ref 同步防重复。MissingCSRF/服务错误与密码错误分开；仅确认真实 session.user 后提示登录成功并导航。
- `tests/login-session-bootstrap.test.ts`：4 条回归验证并发挂载只有一次请求、响应完成前不能就绪、503/配置错误不伪装为匿名就绪、超时中止且无自动重试。

## 验证

定向 Vitest **4/4**（21:35:11）；4 个变更文件 ESLint **0 error / 0 warning**。本轮没有跑整套。infra 独立浏览器回归将挂住首个 `/session`，验证初始化未完成时登录控件不可用，释放后一次登录成功；再由 coordinator 冻结新 SHA 重验正式六例。builder 未把 helper 测试通过写成真实冷启动浏览器验收。

首屏会等待一次真实 session 响应；15 秒失败后保留错误态，用户可显式刷新。没有把无期限等待、定时睡眠或忽略 CSRF 当作修复。
