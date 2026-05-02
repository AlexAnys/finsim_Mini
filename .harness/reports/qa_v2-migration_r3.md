# QA Report — v2-migration r3

## Spec
R3 课程与任务创建（接续 R1+R2 PASS 后的第三轮 baseline 验证）。4 个 acceptance 点：
1. 课程详情 5 tabs（课程结构/任务实例/数据分析/公告管理/上下文素材）
2. 课程结构里新增任务草稿（PDF/AI 草稿生成能跑）
3. 草稿挂到对应章节、小节、课前/课中/课后
4. 发布后任务实例 tab 只显示当前课程任务（不串其他课程）

Skip 项（按 spec）：vitest（baseline 707）/ service caller grep（无 builder 改动）/ /cso（无 auth 改动）。

## 环境

- Dev server: localhost:3030（HTTP 200, 0.11s）
- Postgres: 5 courses available (`e6fc049c-...` 等)
- Browse daemon: PID 8850 (新启)
- 账号：teacher1@finsim.edu.cn → /teacher/dashboard 302

## R3 Acceptance（4 项）

| # | 验收点 | Verdict | Evidence |
|---|---|---|---|
| 1 | 课程详情 5 tabs | PASS（with note） | DOM `[role=tab]` 实际 5 个：**课程结构 / 任务实例 / 教学上下文 / 数据分析 / 公告管理**。spec 写 "上下文素材" 实际叫 "教学上下文"（同概念）；spec 列出顺序与实际有差异（教学上下文实际在 2-3 之间不是末尾）；视觉与功能均可用。screenshots `qa-v2-migration-r3-{01-course-structure,02-task-instances-tab,04-data-tab,05-announcement-tab,06-teaching-context-tab}.png` |
| 2 | 新增任务草稿 + AI/PDF 草稿生成 | PASS | (a) 文本草稿：`POST /api/lms/task-instances/with-task → 201 (1240ms)`，wizard 4 步走通（任务类型 测验 → 基本信息 名称/时长 → 任务配置 1 题 ABCD/B 正确 → 预览并创建）。(b) AI 草稿（PDF context）：选 `个人理财-题库.pdf` "可用" 状态 + 提示词围绕 4 道基础题 → `POST /api/ai/task-draft/from-context → 200 (28607ms, 3175B)` → wizard 自动跳到 step 3 + 4 题预填（个人理财核心目的/收支管理判断/储蓄投资基础 等命中提示词主题）。screenshots `-07/-08/-09/-10/-12-ai-draft-step3.png` |
| 3 | 挂到章节/小节/课前-课中-课后 | PASS | 创建实例 API 返回字段：`chapterId: baf9c3d6...`（第 1 章 理财基础概念）/ `sectionId: 65053639...`（1.2 财务目标设定）/ `slot: "pre"`（课前）。课程结构 tree 渲染：1.2 财务目标设定的 "在课前添加任务" 按钮下方出现新链接 `QA-R3 文本草稿测试 测验 已发布`。挂载位置 1:1 对齐触发按钮上下文。 |
| 4 | 任务实例 tab 只显示当前课程任务 | PASS | (a) UI 计数：tab 切到任务实例后 `document.querySelectorAll("a[href*=/teacher/instances/]").length = 10`（创建前 9 + 新 1）。(b) API: `/api/lms/task-instances?courseId=e6fc049c...` 返回 10 instances，**所有 `instance.courseId` 全部 == `e6fc049c-756f-4442-86da-35a6cdbadd6e`**（`[...new Set(courseIds)] = ["e6fc049c..."]` 唯一值）。(c) 跨课对比：4 个其他 courseId 各自查询返回 1/3/3/6 instances，每组的 `[...new Set(courseIds)]` 各唯一，**0 cross-pollution**。screenshot `-11-instances-after-publish.png` |

## 8 维 check 表

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS（with note） | 4/4 acceptance 点全过；R3.1 tab 命名 / 顺序 vs spec 字面有差异，功能匹配 |
| 2. tsc --noEmit | PASS | 0 errors（baseline 干净，stdout 空）|
| 3. vitest run | SKIP | baseline 已 707，按 R3 spec 跳过 |
| 4. Browser (`/qa-only` 等价 gstack browse daemon) | PASS | 12 张证据截图保存到 `/tmp/qa-v2-migration-r3-*.png`；console 仅 HMR/Fast Refresh 良性日志 0 错；wizard 4 步与 AI 草稿 28.6s flow 全程跑通 |
| 5. Cross-module regression | SKIP | 无 builder 改动 |
| 6. Security (`/cso`) | SKIP | 无 auth/payment/upload 边界改动 |
| 7. Finsim-specific | PASS | UI 全中文（wizard 4 步 / tabs / 课前课中课后 全中文）；任务创建走 `/api/lms/task-instances/with-task` 三层架构干净；AI 草稿走 `/api/ai/task-draft/from-context` 异步管道；API 响应 `{success, data}` 格式齐 |
| 8. Code patterns | PASS | 无新代码 review，但 v2 main 各路由 SSR 200，Wizard 子组件复用一致 |

## Issues found

### 无 BLOCKER。以下是观察 / minor notes

1. **Tab 命名 / 顺序 vs spec 字面有差异**（R3.1 marginal）：
   - 实际：`课程结构 / 任务实例 / 教学上下文 / 数据分析 / 公告管理`
   - Spec：`课程结构 / 任务实例 / 数据分析 / 公告管理 / 上下文素材`
   - "教学上下文" ≈ "上下文素材"（同模块），但顺序也不同。建议：要么改 spec 文案要么改 UI 文案以一致。**功能完整 → 不阻塞**。

2. **数据分析 tab 部分 task 的 "均分" 显示异常大数值**（marginal，spec 第五轮才严格审 analytics）：
   - `[QA-V2-...] 客户风险沟通模拟 均分 25106472`
   - `[QA-V2-...] 家庭预算分析报告 均分 18871572`
   - `[QA-V2-...] 风险收益基础测验 均分 118530`
   - 看起来像 timestamp 或者整数累加未除以人数。R5 Analytics V2 acceptance 明确包含 "无异常大数值、无完成率 > 100%"。本轮 R3 范围内仅记录，不作 FAIL 依据。
   - screenshot `-04-data-tab.png`

3. **AI 草稿 28.6s 单次同步阻塞**（minor）：
   - `POST /api/ai/task-draft/from-context` 一次性同步 28.6s 后 200 返回，没有 async polling 或进度提示。前端显示 wizard step 2 一直空跑。R1 一周洞察 120s 也是同步。可接受，但 UX 不如 ai-assistant 那种 enqueue + polling 模式。
   - 不阻塞当前 acceptance。

4. **PDF "可用" 与 "需 OCR DOCUMENT_OCR_REQUIRED" 共存**（minor 数据完整性）：
   - 同一份 `个人理财-题库.pdf` 同时出现两个 checkbox：一个 "可用"，一个 "需 OCR DOCUMENT_OCR_REQUIRED" disabled。看上去像一份 PDF 被处理了两次（一次成功 + 一次需 OCR）。建议清理重复 ingestion 记录。
   - 不阻塞 acceptance。

5. **Wizard 4 步全程无报错** ✓（minor reassurance）：
   - 取消按钮关闭 dialog 不污染数据；删除按钮也工作（cleanup `DELETE /api/lms/task-instances/{id} → 200 OK`）。

## Overall: PASS

R3（课程与任务创建）= 4/4 acceptance 点全 PASS（R3.1 with minor wording note）。

Cleanup：QA-R3 测试任务 + 实例已通过 API DELETE 清除（任务实例数从 10 回到 9）。
