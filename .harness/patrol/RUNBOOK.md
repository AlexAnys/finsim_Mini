# staging 自动巡检 RUNBOOK（可复用）

> Feature 2 / spec.md。巡检 = 流水线最后一道关：部署 staging 后由 coordinator 派一个 qa 类 agent 按本 runbook 跑，用户只在 FAIL 或产品判断时介入。
>
> **本文件 = 操作骨架（offline 可建）。真 dogfood（自动登录→真浏览器跑完→PASS/FAIL+截图条）必须 staging 活着才能验** —— 见文末「当前状态」。

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

常用子命令（`$B <cmd>`）：`goto`/`reload`/`url` · `snapshot -i`（拿可交互元素 @e 引用）/`-a -o path`（标注截图）/`-D`（与上次 diff）/`-C`（找非 ARIA 可点元素）· `click @e3` / `fill @e4 "值"` · `console --errors` · `network` · `js "<expr>"`（直接打 API）· `viewport 375x812`（移动）· `wait --networkidle`。

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
$B goto https://staging.finsim.anlanai.cn/login
$B console --errors        # 落地页有无报错
$B url                     # 确认没被重定向到错误页
```
- 若改动带新 route：`$B js "await (await fetch('/api/<new-route>')).status"` 看是不是 200/预期码（未登录态通常 401，登录后再验）。
- 若新 UI 文案：登录后到对应页 `snapshot -i` grep 关键文案是否存在。
- **sanity 不过（跑的是旧版本 / 改动没上）→ 立刻停，报告写 `BLOCKED: 改动未 live`，SendMessage coordinator**，不继续白跑。

> ⚠️ finsim **没有 `/api/health` 路由**（已确认）。sanity 用真实路由：`/login` 返 200、`/api/auth/session` 返 200（未登录返 `{}` 也算活）。**别 curl 不存在的健康路径当判据。**

### Step 3 — 登录（按 checklist 需要的角色）
finsim 登录表单（`components/auth/login-form.tsx`）：邮箱 input(`type=email`, placeholder `your@school.edu.cn`) + 密码 input(`type=password`) + 提交按钮(文案「登录」)。**无 name/id 属性 → 用 `snapshot -i` 拿 @e 引用再 fill/click**（gstack 惯例，qa_sim_staging_r1 即如此）。

```bash
$B goto https://staging.finsim.anlanai.cn/login
$B snapshot -i                          # 找到 email/password input 与「登录」按钮的 @e 引用
$B fill @e<email>  "teacher1@finsim.edu.cn"
$B fill @e<pwd>    "[REDACTED]"          # 实际填 password123，报告写 REDACTED
$B click @e<submit>                      # 「登录」
$B wait --networkidle
$B url                                   # 期望 /teacher/dashboard（teacher/admin）或 /dashboard（student）
$B console --errors                      # 登录后无报错
```
登录成功判据（与前端一致）：toast「登录成功」→ 自动 fetch `/api/auth/session` → 按 role 跳 `/teacher/dashboard` 或 `/dashboard`。失败 → 内联 `邮箱或密码错误`（role=alert）。
**登录失败（账号没 seed / 密码不对）→ 报告写 `BLOCKED: staging 未 seed 测试账号`（spec F2 R1），SendMessage coordinator。**

> 切角色：同一持久 Chromium 先登出或新开 context。简单做法——验完一个角色，`$B goto .../login` 重登下一个（session 会被新登录覆盖）；跨角色泄漏类验收（如「学生看不到教师页」）务必真切角色验，别复用 session。

### Step 4 — 逐条跑验收点（每步截图）
对 checklist 每一条：
```bash
$B goto https://staging.finsim.anlanai.cn/<page>
$B snapshot -i -a -o .harness/screenshots/<patrol-slug>/NN-<step>.png   # 标注截图
$B console --errors                                                      # 该页无 JS 报错
# 交互类（点按钮/填表/走流程）：
$B snapshot -i                      # 拿目标元素 @e
$B click @e<x>                      # 或 fill
$B snapshot -D                      # diff 确认动作生效（前后变化）
$B screenshot .harness/screenshots/<patrol-slug>/NN-<step>-after.png
# API 类验收点：
$B js "const r = await fetch('/api/<route>'); return {status:r.status, body: await r.json()}"
```
逐条记 **PASS / FAIL + 证据（截图编号 / API 返回 / 元素文案）**，发现即记，不攒到最后（gstack 规则 #4）。

**finsim 高频陷阱要专门查**（CLAUDE.md Prisma Gotchas）：
- 页面 `console --errors` 有无 **Prisma runtime 报错 / 500**（schema 改了没重启 dev server 的典型症状，tsc 测不出，只有真加载页面才暴露）。
- 嵌套 relation 缺 include → 页面 500 或字段 undefined。
- `"use client"` 页面：curl 200 不算过，必须真浏览器看 console/pageerror（client 崩了 SSR 仍 200）。

### Step 5 — 顺带核安全（只读真浏览器层）
若改动涉权限/数据可见性（spec 常有「非管理员 403」「未公布不泄漏」类验收点）：
- 跨户/越权：用低权角色打高权 route，期望 403。`$B js "(await fetch('/api/<protected>')).status"`。
- 未登录：清 session/新 context 打 protected route，期望 401。
- 数据泄漏：低权角色页面 grep 不该出现的他人数据（如未公布分数）。
- 安全敏感改动建议另跑 gstack `/cso`（静态 OWASP/STRIDE），巡检只做真浏览器层抽验。

### Step 6 — 清理（铁律：不污染演示富课）
- **绝不碰演示富课**：成绩富 = 课程 `e6fc049c`，SB 富 = `940bbe23`（spec F2 R4 + MEMORY）。巡检造数走**安全账号 / 一次性 fixture**。
- 造了数据（提交、任务、反馈条等）→ **跑完删干净**，报告写「test 数据 cleanup 0 残留」。删除走对应 API（学生删自己提交受 owner 守护，教师/admin 删）或记下 id 让 coordinator 清。
- 共享 staging 串行：开跑前确认没和别的 PR 测试 / 用户手测撞车（spec F2 R2）；coordinator 派单即排队信号。

### Step 7 — 产出（见 §3）
PASS/FAIL 汇总 + 截图条 + `reports/` 报告 + `progress.tsv` 一行。

---

## 3. 产出格式

### 3.1 报告
写到 `.harness/reports/qa_<unit>_<round>.md`（unit/round 同 harness 既有约定；巡检类 unit 可命名如 `patrol-<feature>`）。**模板见 `.harness/patrol/report-template.md`**，核心 = 一张验收矩阵（# / 验收点 / Verdict / Evidence）+ 截图条 + 总判。

### 3.2 截图条
`.harness/screenshots/<patrol-slug>/` 下按步编号 `01-..`、`02-..`，报告每条验收点引用对应截图编号。**截完用 Read 工具贴出来给用户看**（gstack 规则 #11，否则用户看不见）。

### 3.3 progress.tsv 一行
追加到 `.harness/progress.tsv`（TSV，列：`timestamp\tunit\tround\tverdict\tcost_usd\tdescription\tgit_commit`）。verdict ∈ `PASS|FAIL|BLOCKED`。**格式细节见 `.harness/patrol/progress-row.md`。**

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
2. 按 §2 七步：sanity（反馈钮/收件箱是否 live）→ 三角色登录 → 逐条验（钮可见/提交落库带上下文/管理员收件箱+非管理员403/全屏 sim 不遮挡/截图降级/学生限频/中文 UI）→ 安全（非管理员 403）→ 清理（删造的反馈条，不碰富课）。
3. 按 §3 产出 `qa_feedback_r1.md` + 截图条 + progress 一行 + 一句话结论。

> #9 在 staging 恢复 **且** 反馈功能上 staging 后才能跑；当前保持 blocked。

---

## 当前状态（2026-05-25）
- **staging 不可达**：`/`、`/login`、`/api/auth/session`、`/favicon.ico` 全稳定返 **HTTP/2 502**（连续重试一致）。DNS 正常（→ 8.153.77.17），Caddy 反代活（`server: Caddy`），但**上游应用容器挂了**。设施侧问题，coordinator 跟进恢复（可能需服务器侧动作）。
- **本 runbook = 离线交付的操作骨架**，已含真实登录选择器、真实路由、finsim 高频陷阱、清理纪律。
- **真 dogfood（AC1 自动登录→真浏览器跑完、AC2 PASS/FAIL+截图条）= staging 恢复后才能验**。staging 恢复后：先用本 runbook 跑一次冒烟（三角色登录 + 落地页无报错）自验巡检能力本身，再跑 #9 首验反馈功能。
