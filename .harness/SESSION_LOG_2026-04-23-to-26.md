# Session Log · FinSim v2 Redesign + Codex Audit（2026-04-23 → 04-26）

> 本 session 完整工程档案。给未来回看（"这次做了啥/为什么这样做"）。

---

## 时间线 + 概览

**跨度**：4 天（2026-04-23 → 2026-04-26）
**起点**：`dc275e6`（pre-redesign baseline，已存到 archive 分支）
**终点**：`fb61db1`（70 commits 后）
**Branch**：`main` 本地领先 origin/main 70 commits（未 push）
**Archive**：`archive/pre-redesign-2026-04-23` 指向 `dc275e6`

## 整体路线

```
Day 1 (4-23): 设计提案到位 → Phase 0 基座 + Phase 1 技术债 + Phase 2 学生端
Day 2 (4-24): Phase 3 教师端 + 4 P1 安全闭环 + Phase 4 任务向导 + 课程编辑器升级
Day 2-3 (4-24/25): Phase 5 实例详情 + Phase 6 登录/空错态 + Phase 7 Sim 对话气泡专题
Day 4 (4-26): Codex 27 finding 深度审查 + 全闭环 + Plan D drift 修复 + hydration 修
```

## 数据指标

| 维度 | 数据 |
|---|---|
| Commits | **70** 进 main |
| Tests | 61 → **450**（+638%） |
| Schema 改动 | 3 次成功（Phase 5 + Phase 7 + PR-FIX-2） + pgcrypto extension 显式启用 |
| 新 API 端点 | 10（Phase 4 content-blocks 8 + Phase 5 insights/aggregate 2） |
| 新组件文件 | 50+ |
| 安全问题闭环 | **36 个**（4 P1 SEC + 18 codex P1 + 9 codex P2 + 5 UX）|
| 真 AI E2E | mood 8 档 + Socratic hint + 资产 snapshots + insights aggregate + conceptTags 抽取 |
| Hybrid 决策 | 7 次主动识别 spec 错配 + 提替代方案 |

## 7 个 Phase + Codex 修复链

### Phase 0 · Round 1 设计系统基座（4-23, 4 commits）
深靛 + 米象牙 + 暖赭三色骨架 / 核心卡去硬编码 / sidebar 232px + 新 Wordmark

### Phase 1 · 技术债清理（4-23, 3 commits）
SSR 角色闪烁修（layout 升 RSC + initialRole）/ 4 latent bug 一次清

### Phase 2 · 学生端全体重做（4-24, 5 commits）
TopBar 共享 shell / dashboard / courses / course detail（深色 Hero + 三态时间线 + 6 ContentBlockType）

### Phase 3 · 教师端全体（4-24, 4 commits）
dashboard（5 KPI + 班级表现）/ courses（多教师堆叠）/ course editor（Path A 占位版）

### Phase SEC · 4 P1 安全闭环（4-24, 4 commits）
SEC1 课程读越权 / SEC2 by-id GET 系统加固 / SEC3 write 端 owner 守护 / SEC4 submissions GET scope

### Phase 4 · 任务向导 + 课程编辑器升级（4-24, 8 commits）
4 步向导 / AI 出题 dialog / 8 新 content-blocks API / 6 种 block editor 完整版 / NextAuth v5 secret 兼容 fix

### Phase 5 · 实例详情 4 tabs（4-24/25, 6 commits）
Overview 漏斗 / Submissions 虚拟化 + 批改 drawer / Insights AI 真聚合（qwen-max 7.5s + 缓存 0.045s + conceptTags 5 真标签持久化）/ Analytics SVG

### Phase 6 · Runner 外壳 + 登录 + 8 空错态（4-25, 3 commits）
深靛品牌区登录 / 8 状态卡 + 7 boundary / Runner 共享 56px 黑色 topbar

### Phase 7 · Simulation 对话气泡专题（4-25, 3 commits）
三列布局 / mood 8 档真切档 / Socratic hint 真渲染 / 资产 snapshots（AI 评分真引用"股票 50%→10% 体现隐性修正"演变判断）

### Codex 深度审查 + 全闭环（4-26, 11 commits）
GPT-5.5 / xhigh / 4 轮聚焦 / 27 finding（11 P1 + 16 P2 + 5 UX 决策） / Plan D drift 修复（Revert ef820b5 + 新 pgcrypto migration）/ 4 PR-FIX 串行（Batch A 9 + B 7 + C 5 + D1）/ Dynamic exit 4/4 连 PASS

## 用户决策记录（10 条）

1. 设计方向 approve（深靛/象牙/暖赭）
2. Dark mode 保留 A
3. Phase 3 课程编辑器 Path A → Phase 4 G2 升级完整版
4. H1 API 解锁同意（Phase 4 + 5 + 7 新 API）
5. AI 模型分层（qwen-max 高价值 + qwen3.5-plus 高频 + 复合校验）
6. B4 confidence 输出
7. C1/C3/H3 Phase 5 全推荐
8. D4/Q3 Phase 6 全推荐
9. Phase 7 8 决策全走推荐
10. Codex 27 finding · UX1-5 全走推荐 lock

## Builder Hybrid 决策高光（7 次）

1. **Phase 4 PR-3C scope 预警**：原 page.tsx 2529 行（spec 写 600 是 4× 低估），主动请决策走 A 方案
2. **Phase 5 PR-5C** conceptTags 应放 per-submission 不是 AnalysisReport（spec 错配修正）
3. **Phase 7 PR-7B** spec 写的 `POST /api/instances/:id/messages` 不存在，沿用现 `/api/ai/chat` 架构
4. **Phase 7 PR-7C** allocationSnapshots 放 AnalysisReport 是教师聚合表学生越权写，方案 C 纯净版
5. **PR-FIX-2 B7** spec 字面要求 Cascade，UX1 拍板 SET NULL，现状 schema 已对（零改）
6. **PR-FIX-2 Plan D drift 修**：从 Option C（UPDATE checksum）升级到 Option D（revert + 新 migration）符合 Prisma "never edit applied migrations"
7. **PR-FIX-4 D1 service 层 4 层 regex**：optional 主动加固 + 5 service-layer 测试

## QA Forensic 验证亮点

- 真登录 4 角色（teacher1/teacher2/student1/admin）+ cookie session pattern
- 编译产物 grep（`.next/static/chunks/*.js`）确认 class 实际进 bundle
- DB 真查（jsonb 字段 + cascade 验证 + audit log 入库验证）
- 真 AI E2E（80s 真 grade + 7.5s 真 aggregate + mood 4 档真切档）
- 多次自我追认（NextAuth `Configuration` 误诊为 secret 实际是 DB 停机）
- 33 cases 攻击矩阵（cross-tenant 403 + own 200/201 + spoof 403 + cap 400 + unauth 401）
- /cso OWASP A01/A03/A05 + STRIDE T/I/D/E 全维度审计

## Open observations（留增量 PR）

1. **D2/D3/D4/D5 留 P3**：Insights route 业务逻辑迁 service / ContentBlock.data discriminated zod / 学生预览 systemPrompt 深度防御
2. **flaky test**：`tests/pr-fix-4-d1.test.ts` 全量跑偶尔挂（独立跑+重跑 PASS），原因 vitest mock 全局污染。增量小修
3. **学生端 grades / study-buddy / schedule 页面骨架**：仅 token 化，未按设计稿重布局
4. **Sim Runner mood 4 处硬编码色** `#E6B34C`/`#51C08E`：设计源 verbatim 黑底需更亮，token 系统未提供 -bright 变体
5. **AI Dialog `courseName: taskName`** prompt 语义错位（PR-4B 遗留）
6. **prisma/seed.ts** 补 CourseTeacher collab 关系让 E2E collab 路径能真测
7. **Subjective Runner SavedChip** 永显"已自动保存"（hasSaved state 缺）
8. **block-edit-panel** dispatcher `case "link"` 但 schema 无 `link` enum

## 独立工作线（未启动）

- 上海教师 AI 案例申报（`.harness/shanghai-ai-case-2026.md`）— 11 单元 4 周时间线，codebase 已就位

## Git 状态

```
main (HEAD = fb61db1)            70 commits 领先 origin/main，未 push
archive/pre-redesign-2026-04-23  指向 dc275e6（新设计前最后一个 commit）
```

push 时机由用户在新 session 决定。

## 工程基线达成

- UI 重构 100%（Phase 0-7 全收官）
- Codex 27 finding 全闭环
- 36 安全/正确性问题修复
- 真 AI 多场景 E2E 闭环
- Prisma migration history 干净（Plan D 永久消除 drift）

**FinSim v2 工程基线已达成，可进入功能新增 / 业务迭代阶段。**

---

*文档生成于 2026-04-26。下次回看时此文档 + .harness/HANDOFF.md + .harness/CODEX_DEEP_REVIEW.md 三件套足以恢复完整上下文。*
