# QA Report — Unit-FB1 Round 1

> QA: qa · 2026-05-15 · Branch `claude-demo-fixes` @ 045cf22
> Build report: `.harness/reports/build_unit_fb1_r1.md`
> Plan: `.harness/plans/unit_fb1_plan_r1.md` (方案 B + returnTo 闭环 coordinator pre-approved)
> Bug: staging 反馈 — instance 详情页无编辑任务配置入口

## Spec: instance 详情页 overview tab 顶部嵌折叠卡（read-only 概览 + 跳 Unit 4 编辑 + returnTo 闭环）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 5 acceptance items 全实现 + 安全补丁 (returnTo open-redirect 防护) |
| 2. tsc --noEmit | PASS | clean output |
| 3. vitest run | PASS | 96 files / 1094 tests passed (baseline 不变) |
| 4. Browser (independent QA Playwright) | PASS | 9/9 QA case + 5/5 builder case = 14/14 PASS (含 4 个 NextAuth race isolated 单跑 PASS 已知模式) |
| 5. Cross-module regression | PASS | /teacher/tasks/[id] 直访 no-returnTo path 走 fallback edit values reset (A5 实测)；/teacher/instances/[id] overview 其他 section (交付漏斗 / 截止倒计时 / 任务说明) 0 console error (A9 实测) |
| 6. Security (open-redirect 防护) | PASS | `returnTo.startsWith('/teacher/')` guard 实测堵住 3 种攻击向量：absolute URL `https://evil.example.com` (A6) / 同源非 /teacher/ `/admin/users` (A7) / protocol-relative `//evil.com` (A8) — 全部停在 `/teacher/tasks/{id}` 不跳 |
| 7. Finsim-specific | PASS | UI 全中文 (任务配置 / read-only 概览 / 编辑任务配置 / 任务名 / 类型 / 测验配置 / 模式=adaptive / 题数=10 / 时长=—分钟 / 评分维度 / 资产配置段)；taskType badge label 走 TYPE_LABEL 映射 (模拟对话/测验/主观题)；Card / Badge / Link 用既有 shadcn primitives |
| 8. Code patterns | PASS | 方案 B 链接式 — 无 inline 编辑器重复，所有编辑动作走 Unit 4 已有路径（高危 dialog + audit 全复用）；新组件 TaskConfigSummary 单一职责 (read-only summary + link)；returnTo 双入口校验 (handleSave 行 409-413 + handleCancel 行 673-677) |

## 独立证据链（QA 自建 9 case spec）

### 正向流（spec 5 case + 截图）

- **QA-FB1-A1**: instance 详情页折叠卡 visible，aria-expanded=`false`（默认收起），含 "read-only 概览" badge，**默认不渲染编辑链接**（折叠状态）
- **QA-FB1-A2**: 展开后 aria-expanded=`true`，fetch `/api/tasks/{id}` 完成后显示 任务名/类型/测验配置(模式=adaptive 题数=10)/评分维度，含 "深度测试" 字面；Link href = `/teacher/tasks/{id}?edit=true&returnTo=%2Fteacher%2Finstances%2F{instanceId}`
- **QA-FB1-A3**: 点编辑 → real browser navigation 到 `/teacher/tasks/{id}`，URL searchParams 含 `edit=true` + `returnTo=/teacher/instances/{id}` (URL 解码)
- **QA-FB1-A4**: 取消按钮 → real browser redirect 到 `/teacher/instances/{id}` (闭环成功)
- **QA-FB1-A5**: 无 returnTo 直访 → 取消按钮停在 `/teacher/tasks/{id}` (fallback edit values reset 路径)

### 安全验证（核心新增）

- **QA-FB1-A6 (absolute URL)**: `returnTo=https://evil.example.com/phishing` → 取消后 page.pathname = `/teacher/tasks/{id}` (不跳外站)
- **QA-FB1-A7 (同源非 /teacher/)**: `returnTo=/admin/users` → 取消后 page.pathname = `/teacher/tasks/{id}` (不跳 /admin)
- **QA-FB1-A8 (protocol-relative)**: `returnTo=//evil.com/phish` → 取消后 page.pathname = `/teacher/tasks/{id}` (不被解释为 protocol-relative)

`returnTo.startsWith('/teacher/')` 三种攻击向量全部堵住。

### Regression

- **QA-FB1-A9**: /teacher/instances/{id} overview 其他 section (交付漏斗 / 学生提交概况 / 截止倒计时 / 任务说明 / 5 个 tab) 真浏览器 0 console error

### 视觉证据

`A2-expanded.png` 显示完整状态：
- 折叠卡置于 overview tab 顶部，位于"交付漏斗"之上
- 任务名=深度测试 / 类型=测验 (badge) / 测验配置=模式=adaptive · 题数=10 · 时长=—分钟 / 评分维度=0 项
- "编辑任务配置 →" 按钮在卡尾右下角
- 整体 layout 与既有 instance 页一致（侧边栏 / 顶部 breadcrumb 不变）

### Console 日志（关键证据）

```
QA-A2 href: /teacher/tasks/e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53?edit=true&returnTo=%2Fteacher%2Finstances%2Fa7d9b380-49fd-4ce2-9d95-000935ac0c5a
QA-A6 (open-redirect blocked): pathname= /teacher/tasks/e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53
QA-A7 (non-/teacher/ blocked): pathname= /teacher/tasks/e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53
QA-A8 (protocol-relative blocked): pathname= /teacher/tasks/e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53
```

### 测试套件 numerical evidence

```
tsc --noEmit: clean
vitest: 96 files / 1094 tests passed (baseline 不变)
lint: 0 errors / 29 warnings (无 Unit-FB1 相关 — 1 unused-var 在 QA temp spec, spec 已删)
e2e (builder spec): 5/5 PASS (A2 serial NextAuth race, isolated 单跑 PASS)
e2e (QA independent spec): 9/9 PASS (real browser + real auth + 安全 3 个攻击向量)
```

## Issues found

无 blocking issue。两个 QA 自纠正过程值得记录：

### Note 1 — QA 自纠正：URL.toContain vs pathname 校验
初版 QA-A6/A7/A8 安全测试用 `page.url().toContain("evil")` 类型断言失败 — URL 仍包含 `returnTo=https%3A%2F%2Fevil.example.com` 在查询参数中（无 redirect 但 URL 字面含恶意字符串）。修正为 `new URL(page.url()).pathname` 比对，更精确锁住"未发生 redirect"语义。

### Note 2 — NextAuth race in serial run
builder serial 5/5 first run 有 1 个 NextAuth race（A2），isolated 单跑 PASS。QA serial 9/9 first run 有 3 个 race（A2/A6/A7），isolated 单跑全过。**已知模式，与 HANDOFF.md 记录一致**。

### Note 3 — `/api/tasks/{id}` API 路径选择
build 报告 reflection 提到 builder 初版用 `/api/lms/tasks/{id}` 不存在，改为 `/api/tasks/{id}`。QA-A2 通过 `body.toContain("深度测试")` 实证 fetch 成功（task 数据已展示），证明 API 路径正确。

## Overall: PASS

5 spec acceptance + 4 安全/regression 自定义 acceptance = 9/9 真浏览器 PASS。open-redirect 三种攻击向量全堵。Unit 4 高危 dialog + audit 路径 100% 复用，无重复。
