# staging 自动巡检 RUNBOOK（可复用）

> Feature 2 / spec.md。巡检 = 流水线最后一道关：部署 staging 后由 coordinator 派一个 qa 类 agent 按本 runbook 跑，用户只在 FAIL 或产品判断时介入。
>
> **本文件已 dogfood 验证**（2026-05-25 对 staging #23 代码跑通 patrol-capability r1 PASS）。下面的命令、选择器、时序与踩坑都是实测后的版本。

---

## 0. 这份 runbook 解决什么

用户痛点：手动 staging QA = 自己开浏览器、逐个登录三种角色、按 spec 一条条点、判断过没过。本 runbook 把这套固定下来，让 agent 复用 **gstack `/qa-only` 真浏览器**（持久 Chromium）指向 staging 跑，产出「过 / 没过 + 截图条」，用户一眼拍板。

**判得了**：能不能用（登录成功、页面无 500/console error、期望元素在）+ 符不符合 spec 写好的、可机器执行的验收点。
**判不了**（诚实写明，不过度承诺）：「是不是你真正要的」——产品判断仍需用户一眼（spec F2 R3）。所以巡检报告里产品取向的点要标 `需用户判断`，不替用户拍板。

---

## 1. 前置：环境与工具

### 1.1 巡检对象
- **staging URL**：`https://staging.finsim.anlanai.cn`
- **不需要本地 dev server**（打远程 staging）→ 与 builder-feedback 不撞端口、不撞 schema，可真并行。

### 1.2 测试账号（staging seed 库）
| 角色 | 邮箱 | 密码 | 登录后落点 |
|---|---|---|---|
| 管理员 admin | `admin@finsim.edu.cn` | `password123` | `/teacher/dashboard`（role=admin 走教师区） |
| 老师 teacher | `teacher1@finsim.edu.cn`（王教授） | `password123` | `/teacher/dashboard` |
| 学生 student | `student1@finsim.edu.cn`（张三，A 班） | `password123` | `/dashboard` |

> ⚠️ 密码绝不写进报告，repro 步骤写 `[REDACTED]`（gstack 规则 #3）。

### 1.3 真浏览器工具（gstack browse）
巡检 = 复用 gstack `/qa-only` 的 browse 二进制（持久 Chromium，跨命令保持 cookie/session）。每次巡检 SETUP 先定位：

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/browse/dist/browse" ] && B="$_ROOT/.claude/skills/gstack/browse/dist/browse"
[ -z "$B" ] && B="$HOME/.claude/skills/gstack/browse/dist/browse"
[ -x "$B" ] && echo "READY: $B" || echo "NEEDS_SETUP（cd <skill_dir> && ./setup，见 /qa-only SKILL）"
```

常用子命令（`$B <cmd>`）：`goto`/`reload`/`url`/`restart`/`stop` · `snapshot -i`（拿可交互元素 @e 引用）/`-a -o path`（标注截图，⚠️见下踩坑）/`-D`（与上次 diff）/`-C`（找非 ARIA 可点元素）· `click @e3` / `fill @e4 "值"` · `console --errors`/`--clear` · `cookies` · `network` · `js "<expr>"`（直接打 API，⚠️见下踩坑）· `viewport 375x812`（移动）· `wait --networkidle`。

> **⚠️ dogfood 踩坑 1 — browse 截图沙箱**：screenshot 的**绝对路径**只允许写在 `/private/tmp` 或主仓目录 `/Users/.../finsim`，给 worktree 的绝对路径会被拒（`Path must be within: …`）。**对策**：要么用主仓 `.harness/screenshots/` 绝对路径，要么 `cd` 到 worktree 后用**相对路径**（相对路径会解析进允许的树内，实测可写）。报告/git 提交时把截图归到 worktree 的 `.harness/screenshots/<slug>/`。
>
> **⚠️ dogfood 踩坑 2 — `js` 表达式不能写 `return`**：`$B js "..."` 是表达式求值（不是函数体），写 `return x` 报 `Illegal return statement`。直接让最后一句是表达式即可：`$B js "const r=await fetch('/api/x'); JSON.stringify({status:r.status})"`（末尾 `JSON.stringify(...)` 就是返回值）。
>
> **⚠️ dogfood 踩坑 3 — `snapshot -a -o` 会动页面**：带标注截图 (`-a -o`) 在本版本会把页面切到 `about:blank`，**作废之前的 @e 引用**。对策：先 `snapshot -i` 拿引用并立刻 fill/click；要标注图就**单独**截，或交互完再 `snapshot -i -a -o`。简单稳妥：交互用普通 `screenshot path`，不混 `-a -o`。

---

## 2. 巡检流程（七步骨架）

> 一次巡检 = 针对**一个已部署改动 + 它的 spec 验收点**。先把验收点列成 checklist，再逐条真浏览器验。

### Step 1 — 读验收点，列 checklist
- 读当前 `.harness/spec.md`（或 coordinator 指定的 spec-*.md）的 **Acceptance** 段。
- 把每条验收点拆成「可机器执行的一步」：登录哪个角色 → 去哪个页面 → 点什么 / 填什么 → 期望看到什么元素/文案 / 期望 API 返回什么。
- 标注哪些是 `需用户判断`（产品取向，巡检只截图不裁决）。
- 巡检质量 ∝ 验收点写得多具体（spec F2 R5）。验收点含糊 → 报告里写明「该点无法机器验，需用户目测」。

### Step 2 — sanity gate：改动是否真 live
**先确认这次要验的改动真在 staging 上**（共享栈跨 PR 串行，可能跑的是旧版本）。
```bash
$B restart                                   # 干净 context（清掉上一轮残留 cookie/console）
$B cookies                                   # 应为 []
$B goto https://staging.finsim.anlanai.cn/login
$B console --clear                           # 清掉自己探针造成的 404/400 噪音，再开始正式记
$B console --errors                          # 落地页有无真报错
$B url                                        # 确认没被重定向到错误页
```
- 若改动带新 route：`$B js "const r=await fetch('/api/<new-route>'); String(r.status)"` 看是不是 200/预期码（未登录态通常 401，登录后再验）。
- 若新 UI 文案：登录后到对应页 `snapshot -i` 或 `text` grep 关键文案是否存在。
- **sanity 不过（跑的是旧版本 / 改动没上）→ 立刻停，报告写 `BLOCKED: 改动未 live`，SendMessage coordinator**，不继续白跑。

> ⚠️ finsim **没有 `/api/health` 路由**（已确认 404）。sanity 用真实路由：`/login` 返 200、`/`（未登录）返 307 重定向到 login（正常非错误）、`/api/auth/session` 返 200（未登录返 `{}` 也算活）。**别 curl 不存在的健康路径当判据。** 注意 console 里若看到 `/api/health` 404 / 自己探针的 400/401，多半是**陈旧 buffer**——`console --clear` 后重看才准。

### Step 3 — 登录（按 checklist 需要的角色）
finsim 登录表单（`components/auth/login-form.tsx`）：邮箱 input + 密码 input + 提交按钮（文案「登录」），**无 name/id 属性 → 用 `snapshot -i` 拿 @e 引用再 fill/click**（实测当前是 `@e3=邮箱 @e4=密码 @e5=登录`，但**别 hardcode**，每次 snapshot 确认）。

```bash
$B goto https://staging.finsim.anlanai.cn/login
$B wait --networkidle
$B snapshot -i                          # 确认 @e：邮箱 textbox / 密码 textbox / 「登录」button
$B fill @e3  "teacher1@finsim.edu.cn"
$B fill @e4  "[REDACTED]"               # 实际填 password123，报告写 REDACTED
$B click @e5                            # 「登录」
# ⚠️ networkidle 不够——前端是 signIn→fetch session→router.push 异步链，需额外 settle 再判：
$B js "await new Promise(r=>setTimeout(r,2500)); const s=await fetch('/api/auth/session'); const j=await s.json(); JSON.stringify({url:location.href, name:j?.user?.name, role:j?.user?.role})"
$B console --errors                     # 登录后无报错
```
**登录成功判据 = `/api/auth/session` 返回的 `user.role` + 落点 url**（teacher/admin→`/teacher/dashboard`，student→`/dashboard`）。
> ⚠️ **dogfood 实测**：点完登录后立刻 `$B url` 常仍显示 `/login`——是 router.push 还没跑完的**时序假象**，不是登录失败。**以 session endpoint 为准**（settle 2.5s 后再查）。失败才会有内联 `邮箱或密码错误`（role=alert）。
> **登录失败（账号没 seed / 密码不对）→ 报告写 `BLOCKED: staging 未 seed 测试账号`（spec F2 R1），SendMessage coordinator。**

> ⚠️ **切角色必须硬重置 session（dogfood 踩坑 4）**：仅 `goto .../login` 重登**不会**切角色——旧 NextAuth cookie 仍在，新 signIn 不覆盖已有有效 session（实测 student1 登录后 session 仍是上一个 teacher 王教授）。正确做法，切角色前先：
> ```bash
> $B js "await fetch('/api/auth/signout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); 'out'"
> $B restart        # 清 cookie；restart 后 $B cookies 应为 []
> ```
> 再登下一个角色。跨角色泄漏类验收（如「学生看不到教师页」）务必这样真切角色，别复用 session。

### Step 4 — 逐条跑验收点（每步截图）
对 checklist 每一条：
```bash
$B console --clear                                              # 每页开始前清，console 才干净
$B goto https://staging.finsim.anlanai.cn/<page>
$B wait --networkidle
$B screenshot .harness/screenshots/<patrol-slug>/NN-<step>.png  # 相对路径(cd 在 worktree)；勿混 -a -o(见踩坑3)
$B console --errors                                             # 该页无 JS 报错
# 交互类（点按钮/填表/走流程）：
$B snapshot -i                      # 拿目标元素 @e（立刻用，别先截标注图）
$B click @e<x>                      # 或 fill
$B snapshot -D                      # diff 确认动作生效（前后变化）
$B screenshot .harness/screenshots/<patrol-slug>/NN-<step>-after.png
# API 类验收点（注意 js 不能 return，见踩坑2）：
$B js "const r=await fetch('/api/<route>'); const b=await r.json(); JSON.stringify({status:r.status, body:b})"
```
逐条记 **PASS / FAIL + 证据（截图编号 / API 返回 / 元素文案）**，发现即记，不攒到最后（gstack 规则 #4）。

**finsim 高频陷阱要专门查**（CLAUDE.md Prisma Gotchas）：
- 页面 `console --errors` 有无 **Prisma runtime 报错 / 500**（schema 改了没重启 dev server 的典型症状，tsc 测不出，只有真加载页面才暴露）。
- 嵌套 relation 缺 include → 页面 500 或字段 undefined。
- `"use client"` 页面：curl 200 不算过，必须真浏览器看 console/pageerror（client 崩了 SSR 仍 200）。
- 页面级 403：finsim 越权页**返 HTTP 200 但渲染 ForbiddenState**（文案「你还不能看这个页面」），别只看 HTTP 码，要看渲染内容（`$B text` grep「无权/403/你还不能看」）。

### Step 5 — 顺带核安全（只读真浏览器层）
若改动涉权限/数据可见性（spec 常有「非管理员 403」「未公布不泄漏」类验收点）：
- 跨户/越权 API：用低权角色打高权 route，期望 403。`$B js "const r=await fetch('/api/<protected>'); String(r.status)"`。
- 越权页面：低权角色 goto 高权页，期望渲染 ForbiddenState（HTTP 仍 200，看渲染文案）。
- 未登录：`signout`+`restart` 清 session，打 protected API，期望 401。
- 数据泄漏：低权角色页面 `text` grep 不该出现的他人数据（如未公布分数）。
- ⚠️ 注意区分「真越权」与「合法范围」：如 `/api/lms/courses` 学生返 200 是**合法**（学生取自己选的课，走 getCoursesByClass），不是泄漏。判越权要打**确属教师/管理员专属**的端点。
- 安全敏感改动建议另跑 gstack `/cso`（静态 OWASP/STRIDE），巡检只做真浏览器层抽验。

### Step 6 — 清理（铁律：不污染演示富课）
- **绝不碰演示富课**：成绩富 = 课程 `e6fc049c`，SB 富 = `940bbe23`（spec F2 R4 + MEMORY）。巡检造数走**安全账号 / 一次性 fixture**。
- 造了数据（提交、任务、反馈条等）→ **跑完删干净**，报告写「test 数据 cleanup 0 残留」。删除走对应 API（学生删自己提交受 owner 守护，教师/admin 删）或记下 id 让 coordinator 清。
- **纯只读巡检**（只 goto/登录/截图/GET）→ 无数据可清，收尾只需 `signout`+`restart`+`stop` 登出。
- 共享 staging 串行：开跑前确认没和别的 PR 测试 / 用户手测撞车（spec F2 R2）；coordinator 派单即排队信号。

### Step 7 — 产出（见 §3）
PASS/FAIL 汇总 + 截图条 + `reports/` 报告 + `progress.tsv` 一行。

---

## 3. 产出格式

### 3.1 报告
写到 `.harness/reports/qa_<unit>_<round>.md`（unit/round 同 harness 既有约定；巡检类 unit 可命名如 `patrol-<feature>`）。**骨架见 `.harness/patrol/result-format.md`**，核心 = 一张验收矩阵（# / 验收点 / Verdict / Evidence）+ 截图条 + 总判。

### 3.2 截图条
`.harness/screenshots/<patrol-slug>/` 下按步编号 `01-..`、`02-..`，报告每条验收点引用对应截图编号。**截完用 Read 工具贴出来给用户看**（gstack 规则 #11，否则用户看不见）。注意截图沙箱路径限制（见 §1.3 踩坑 1）。

### 3.3 progress.tsv 一行
追加到 `.harness/progress.tsv`（TSV，7 列）。**列细节与示例见 `.harness/patrol/progress-row.md`**。verdict ∈ `PASS|FAIL|BLOCKED`。
> ⚠️ 实测该文件近期行的第 5 列已**漂移为产出角色**（如 `qa`/`builder-patrol`）而非表头写的 `cost_usd`——**追加时匹配最近若干行的实际写法**（填角色名），别盲信表头。用真 Tab 分隔，只在末尾加行。

### 3.4 给 coordinator/用户的一句话
`PASS：N/N 验收点真浏览器过，截图条见 …` 或 `FAIL：第 X 步 <现象>，截图 NN` 或 `BLOCKED：<staging 未 live/未 seed>`。失败必指明**哪一步、什么现象**（报错 / 缺元素），spec F2 AC3。

---

## 4. 收敛规则（与 harness 一致）
- **Dynamic exit**：两连 PASS 收工；同一 FAIL 三连 → 回 spec 重规划，不硬磨。
- 巡检无 Edit 权（qa 类角色）：发现 bug **只报不修**，写清 repro，回传 builder 修。
- 越 scope（要改代码/schema）→ 先 hard-block SendMessage coordinator，不 workaround。

---

## 5. 一键跑首验（#9）怎么用本 runbook
coordinator 在反馈功能（PR-A）部署 staging 后，派一个 qa agent：
1. 读本 runbook + 反馈功能 spec 的 Acceptance（F1 那 7 条）。
2. 按 §2 七步：sanity（反馈钮/收件箱是否 live）→ 三角色登录（切角色记得硬重置 session）→ 逐条验（钮可见/提交落库带上下文/管理员收件箱+非管理员403/全屏 sim 不遮挡/截图降级/学生限频/中文 UI）→ 安全（非管理员 403）→ 清理（删造的反馈条，不碰富课）。
3. 按 §3 产出 `qa_feedback_r1.md` + 截图条 + progress 一行 + 一句话结论。

> #9 在 staging 恢复 **且** 反馈功能上 staging 后才能跑；当前保持 blocked。

---

## 当前状态（2026-05-25）
- **staging 已恢复**：team-lead 重启了 staging app 容器（之前 Exited 143，未碰生产），`/`→307、`/login`→200、`/api/auth/session`→200、`/api/health`→404（不存在，别当探针）。
- **本 runbook 已 dogfood 验证**：对 staging #23 代码跑通 patrol-capability r1 **PASS**（teacher1/student1 登录 + 三页导航 + 跨角色 403 guard，全 200 console 0err，截图 01-06）。上面的命令/选择器/时序/4 个踩坑均为实测后版本。
- **#9（真正首验反馈功能）仍 blocked**：等 Feature 1（反馈钮+收件箱）部署到 staging 再跑。
