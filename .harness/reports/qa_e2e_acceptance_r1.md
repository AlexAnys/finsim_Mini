# QA Report · E2E Acceptance (真浏览器 Playwright) — Worktree 收官

> qa@instance-workbench · 2026-05-15
> Playwright 1.60.0 · chromium · headless
> Dev server: `PORT=3001 npm run dev` (worktree 加载 `claude-instance-workbench-fixes` 分支代码)
> Auth: molly@qq.com / 123456 真账号

## ⚠️ Probe 阶段误判修正

**Probe B 消息曾写"两边仓库都没 e2e 基础设施"——这是错的**。

实测：
- 主仓库 `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim/` 含 `playwright.review.config.ts` / `playwright.qa-fix-3.config.ts` + 完整 `tests/e2e/` 目录（~30+ specs）
- `@playwright/test` 1.60.0 已装；chromium browser ready
- Worktree 通过 Node.js parent dir resolution 共享主仓库 `node_modules`（Playwright + Next + 全栈依赖透明可用）
- 我 Probe 阶段 `find` 没找到是 worktree 内 find 仅扫 worktree 自己；切到主仓库 find 即有

经此教训：后续 worktree QA 默认从主仓库 `node_modules` 拉依赖，不需要 npm install。

## 操作流程

1. `lsof -i :3001` 空 + `lsof -i :3000` 主 session 跑着（确认无端口冲突）
2. `ln -sf 主仓库/.env worktree/.env`（共享 NEXTAUTH_SECRET / DATABASE_URL）
3. `PORT=3001 nohup npm run dev > /tmp/iw-dev.log 2>&1 &` 起 worktree dev server background
4. 等 `/login` 200（约 5s 起来 + 30s 首次 compile）
5. 写 `playwright.iw.config.ts`（baseURL :3001, headless, 240s timeout）+ `tests/e2e/iw-acceptance.spec.ts`（3 test 覆盖 A2 + A1 + C1-B）
6. `npx playwright test --config=./playwright.iw.config.ts` 执行
7. 清理：`kill $(cat /tmp/iw-dev.pid)` + 验证 :3000 主 session 仍在

## E2E Test 结果

```
Running 3 tests using 1 worker
[pickInstanceId] using 1eed59f9-3a70-4b30-9755-30a485e52b07 (为李志华撰写资产配置建议书, subjective, published)
[A2] original title: 为李志华撰写资产配置建议书
[A2] restored title: 为李志华撰写资产配置建议书
  ✓  1 [chromium] › A2: instance title inline edit + persist (18.7s)

[pickInstanceId] using 1eed59f9-3a70-4b30-9755-30a485e52b07 (为李志华撰写资产配置建议书, subjective, published)
[A1] form rendered: subjective
  ✓  2 [chromium] › A1: instance config Sheet open/render by taskType (4.9s)

[C1-B] examCheck initial text = "" (expected empty)
[C1-B] lessonPolish text after re-select = "E2E test sample lesson content for lessonPolish"
[C1-B] after reload text = "E2E test sample lesson content for lessonPolish"
  ✓  3 [chromium] › C1-B: AI assistant state persists across page navigation (24.2s)

  3 passed (50.2s)
```

## 场景验证矩阵

### 1. A2 实例标题 inline 编辑 — **PASS**

| 验证项 | Verdict | 证据 |
|---|---|---|
| pen icon (button[aria-label="编辑标题"]) 可见 | ✅ | `a2-01-overview.png` |
| 点击 pen → input autofocus + maxlength=200 | ✅ | `a2-02-editing.png`；spec L74 `expect(input).toBeFocused()` |
| 输入新标题 `${原标题}_e2e_iw` + Enter 保存 | ✅ | `a2-03-saved.png`；h1 toHaveText 新标题 |
| 刷新页面 → 标题持久 | ✅ | spec L91-94 reload + 验 h1 文本 |
| `/teacher/instances` 列表显示新标题（**5 处展示位之一**） | ✅ | `a2-04-list.png`；spec L99 `getByText(newTitle).count() > 0` |
| 还原原标题（数据清理） | ✅ | spec L109-117；日志 "restored title: 为李志华撰写资产配置建议书" |

测试 instance：`1eed59f9-3a70-4b30-9755-30a485e52b07`（"为李志华撰写资产配置建议书"，subjective，published）

**结论**：A2 真浏览器 E2E 完全验证 PASS——pen icon 可见、编辑/保存路径通、API 持久化、列表同步、还原数据无污染。

### 2. A1 实例配置编辑 Sheet — **PASS**

| 验证项 | Verdict | 证据 |
|---|---|---|
| `button[data-action="edit-snapshot"]` 可见 | ✅ | `a1-01-sheet-open.png` |
| 点击后 Sheet 打开 + 标题 "编辑实例配置" 可见 | ✅ | spec L139-143 |
| 按 taskType 渲染**严格 1 个** form（`data-form` 标记） | ✅ | spec L148-156 验仅 1 form visible；本测 instance 是 subjective → `data-form="subjective"` 渲染 |
| 点击取消 → Sheet 关闭 | ✅ | `a1-02-sheet-closed.png`；spec L165 `toBeHidden` |

**结论**：A1 Sheet 真打开/关闭路径通；按 taskType 正确分发 form（subjective 一型已实测）；UI 不污染数据（测取消而非保存）。

**未覆盖**（推 Final QA staging 补）：
- 选 simulation/quiz 类型 instance 验另两 form 分支（需 DB 中确实存在该类型 published instance；本次 picker 拿到的是 subjective）
- 实际改字段 → 保存 → DB 真改（避免污染 molly 真实数据）
- 已 graded instance 的 AlertDialog 三按钮路径

### 3. C1-B AI 助手切页保状态 — **PASS**

| 验证项 | Verdict | 证据 |
|---|---|---|
| 填 lessonPolish text | ✅ | `c1-02-text-filled.png` |
| 切 dashboard → 切回 ai-assistant → text 恢复 | ✅ | `c1-03-restored.png`；spec L194 `restoredText === lessonPolishText` |
| 切 examCheck → text 空（per-tool 隔离） | ✅ | 日志 `examCheck initial text = ""`；spec L205 |
| 切回 lessonPolish → text 仍是原 lessonPolish 内容 | ✅ | 日志 `lessonPolish text after re-select = "E2E test sample..."`；spec L222 |
| 整页 reload → text 持久 | ✅ | 日志 `after reload text = "..."`；`c1-05-after-reload.png` |

**核心 acceptance 全通**：localStorage 持久化 hook 真在浏览器跑通；per-tool key 隔离正确；hydration 无 mismatch（dev log 0 hydration warning）。

**未覆盖**（推 Final QA staging 补）：
- 真跑 AI 分析的 job 进度条接管轮询（需 LLM API key，耗 token，跳过）
- 跨 tab storage event 同步（单 tab Playwright 难模拟）
- 老 cache 兼容（手动注入 localStorage 老格式后 hydrate "read" mode）
- read/edit toggle button（只在有 result 时显示，本测无 result）
- examCheck `<details>` 折叠/展开（只在有 sections 时显示）

## Dev server 日志

```bash
$ tail -50 /tmp/iw-dev.log | grep -iE "error|warn"
# 仅有 "Detected additional lockfiles" 启动期警告（无关）
# 0 runtime error / 0 hydration mismatch / 0 500 / 0 503
```

**结论**：worktree dev :3001 整轮 E2E 50s 期间无运行时错误。

## DB 影响 / 数据清理

- **A2 测试**：临时改 instance title → **测后还原** → 0 污染（spec L109-117 还原 + 日志确认）
- **A1 测试**：仅 open Sheet + 点取消，**0 mutation**
- **C1-B 测试**：仅前端 localStorage 写入（per-browser，server 无关），**0 DB mutation**

molly 账号数据 100% 还原原状。

## 端口管理

- :3000 主 session dev server 全程跑着不动（lsof PID 65025 持续）
- :3001 worktree dev server 启用→跑 E2E→`kill $(cat /tmp/iw-dev.pid)` 关闭
- 0 端口冲突 / 0 互相干扰

## 屏幕截图清单

`.harness/screenshots/iw-acceptance/`（11 张）：
```
a1-01-sheet-open.png         A1 Sheet 打开
a1-02-sheet-closed.png       A1 Sheet 关闭
a2-01-overview.png           A2 overview 初始
a2-02-editing.png            A2 编辑中
a2-03-saved.png              A2 保存后 h1
a2-04-list.png               A2 /teacher/instances 列表（同步验证）
c1-01-initial.png            C1-B 初始 AI 助手页
c1-02-text-filled.png        C1-B lessonPolish text 填好
c1-03-restored.png           C1-B 切回后 text 恢复
c1-04-examcheck.png          C1-B examCheck 切换
c1-05-after-reload.png       C1-B 整页 reload 后 text 持久
```

## Overall: **3/3 E2E test PASS** — **Worktree 完整收官**

## 累计 verdict

| Layer | Coverage | Result |
|---|---|---|
| 静态 QA（tsc / vitest / eslint / grep） | A2 + C1-B r1a/r1b/r1c + A1 r1a/r1b 全单元测试 + 源结构覆盖 | **8/8 PASS, 0 regression** |
| **E2E 真浏览器（Playwright :3001）** | A2 + A1 + C1-B 关键交互路径 | **3/3 PASS** |
| 集成总验 | vitest 1049/1049 + tsc 0 new + 0 schema 改动 | **PASS** |

**总：worktree 3 unit / 6 commits / 9 PASS QA gate / 0 fail / 0 regression / 真浏览器 E2E 全过。**

## 风险登记（Final QA staging 阶段补）

| # | 风险 | 缓解 |
|---|---|---|
| 1 | A1 simulation / quiz form 未实测（picker 拿到 subjective） | staging 选具体 type instance 实测 3 form |
| 2 | A1 graded AlertDialog 三按钮未实测 | staging 选 graded instance 触发 |
| 3 | A1 完整闭环（教师改 snapshot → 学生看新配置） | 需 **Unit 17 (PR #12) 进 main** 后实测 |
| 4 | C1-B 真跑 AI 分析（job 进度条 + 接管轮询） | staging 用真 API key 跑一次（耗 token） |
| 5 | C1-B 跨 tab storage event 同步 | staging 手动开 2 tab 验 |
| 6 | C1-B 老 cache 兼容 | staging 注入 localStorage 老格式后 hydrate |
| 7 | C1-B read/edit toggle + examCheck details 折叠 | staging 完整跑 1 个 AI 工具拿到 result 后验 |

## PR 准备建议

worktree 6 commit + 本次新增 3 文件（playwright config + e2e spec + 截图目录）合 1 PR：
- 分支：`claude-instance-workbench-fixes`
- PR 标题：`feat: instance workbench — A2 标题编辑 + C1-B AI 助手持久化 + A1 实例配置编辑`
- E2E 文件 (`playwright.iw.config.ts` / `tests/e2e/iw-acceptance.spec.ts`) 是 QA artifact，可保留进 PR（与主仓库 `playwright.review.config.ts` 同模式）
- 截图目录 `.harness/screenshots/iw-acceptance/` 可加 .gitignore 或单独 commit 作 PR artifact

worktree idle 待 coordinator 决策下一步。
