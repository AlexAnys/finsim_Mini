# QA Report — pr-4d2 r1

## Spec
Phase 4 · PR-4D2 · 课程编辑器前端 block editor：把 Phase 3 PR-3C 的"只读属性面板"升级为真可交互 block editor，教师在 `/teacher/courses/[id]` 里直接 CRUD 6 种 ContentBlockType（markdown / resource / simulation_config / quiz / subjective / custom）+ section 改名删除 + 块上下移动 reorder。全部复用 PR-4D1 的 8 个端点。

## 验证表

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 7 新组件（6 editors + 1 panel）+ 1 util（`computeReorderSwap`）+ 1 测试（8 tests）+ 1 页面 patch；6 种 blockType dispatcher 通过 switch-case（markdown/resource/link-or-resource/task-ref × 3 variant/custom）；上下箭头 reorder（键盘友好，无拖拽依赖）；section 改名/删除通过面板顶部内联按钮；page.tsx 6 新 useCallback handlers 统一走 fetch → toast → `fetchCourse()` 刷新模式 |
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | **288 tests** 全绿（280 + 8 block-reorder）；`computeReorderSwap` 8 tests 覆盖 target 不存在 / 边界 no-op / 相邻对 up&down / 跨 slot 过滤 / sparse orders / 单元素 slot |
| 4. Browser 真 E2E | **PASS** | 6 种 blockType 真 CRUD 全通：创建 6 block 成功 order 0-5；每个 editor payload shape PATCH 成功（markdown.content / resource.url+title+description / task-ref.taskId+note × 3 / custom.任意JSON）；DB 核对 data 字段存正确 JSON（中文+换行+特殊字符保留）；reorder swap 持久化（swap 后 resource order=0 / markdown order=1）；section DELETE cascade 验证通过（temp section+2 blocks 全清零，零孤儿）；section rename + restore 闭环 |
| 5. Cross-module regression | PASS | 12 路由真 cookie 全 200（教师 8 + 学生 4，含 `/teacher/courses/[id]`）；PR-SEC1 的 API 层 readable guard 仍 403（teacher2 GET teacher1 course `/api/lms/courses/[id]` → FORBIDDEN）；旧 `BlockPropertyPanel` 不删（死代码），不影响当前流程；`ContentBlock.data: Record<string,unknown> \| null` 类型收紧不破坏 Phase 3 PR-3C 的只读渲染（page.tsx 只读路径走 `b.data?.xxx` 防御访问） |
| 6. Security (/cso) | PASS | **0 XSS** 风险（无 dangerouslySetInnerHTML / innerHTML / eval / new Function）；Markdown editor 是 textarea 编辑无 preview 渲染；custom editor 用 `JSON.parse + try/catch + typeof==='object' && !Array.isArray && !null` 三重校验，err 中文提示；所有用户内容走 JSX text node（React 自动转义）；后端 payload 接受任意 JsonValue 是 by design（与 PR-4D1 spec 对齐），前端严格拦 / 后端宽松是合理 trade-off；window.confirm 删除 section 时明文警示 "下属所有内容块将一并删除（不可恢复）" |
| 7. Finsim-specific | PASS | UI 全中文（块编辑 / 小节 / 内容块 / 新建块 / 课前 / 课中 / 课后 / 重命名 / 删除小节 / 确认删除 / 已创建内容块 / 已保存 / 已删除 / 已重命名 / 保存失败 / 创建失败 / 删除失败 / 调序失败 / 网络错误，请稍后重试 / JSON 解析失败 / payload 必须是 JSON 对象 等 20+ 中文）；API 响应 shape 未变（继承 PR-4D1）；handlers 遵循三层：fetch → success check → toast + fetchCourse |
| 8. Code patterns | PASS | **0 硬编码色**（grep 7 新文件全无命中）；12 token 类 + 2 alpha 变体（bg-brand-soft/40, border-brand/40）；useMemo / useCallback 正确用依赖；**`computeReorderSwap` 纯函数** 8 tests 独立 pin 住 sparse orders 等 edge case；Dispatcher 有 `default: CustomEditor` fallback；markdown/custom editor 有 `useEffect` reset on block.id change（防 stale state）；无 drive-by refactor |

## Evidence

### 真 E2E smoke — 6 种 blockType CRUD 全流程

**创建 6 种 blockType**（全 201 + order 自增 0-5）：
```
markdown            id=74bd4825-... order=0
resource            id=1028a577-... order=1
simulation_config   id=ac8edb9c-... order=2
quiz                id=63e07c22-... order=3
subjective          id=d9daed92-... order=4
custom              id=dce68c29-... order=5
```

**每 blockType PATCH payload 成功**（全 success:true）：
```
[markdown]     {"content":"# QA E2E markdown test\n\n正文内容"}
[resource]     {"url":"...","title":"课程讲义","description":"..."}
[simulation]   {"note":"关联家庭财务模拟对话任务"}
[quiz]         {"note":"课中小测"}
[subjective]   {"note":"拓展思考题"}
[custom]       {"embed":"<iframe src=\"...\">", "type":"iframe"}
```

**DB 核对每 blockType 的 data JSON（中文/换行/引号全保留）**：
```
[markdown]     data={"content": "# QA E2E markdown test\n\n正文内容"}
[resource]     data={"url":"...","title":"课程讲义","description":"第 1 章 PDF"}
[simulation]   data={"note":"关联家庭财务模拟对话任务"}
[quiz]         data={"note":"课中小测"}
[subjective]   data={"note":"拓展思考题"}
[custom]       data={"type":"iframe","embed":"<iframe src=\\"...\\">"} 
```

### Reorder 真持久化

**调序前 DB**：
```
markdown:0  resource:1  simulation:2  quiz:3  subjective:4  custom:5
```

**前端 computeReorderSwap 模拟（resource up → 0）→ POST /content-blocks/reorder `[{resource:0},{markdown:1}]`**：

**调序后 DB**：
```
resource:0  markdown:1  simulation:2  ...
```
→ 2-element swap 完美持久化，未影响其他 block。

### Section DELETE cascade

```
Setup: 创建 temp section c3fd838e-... + 2 blocks（markdown pre / resource in）
Before: Section=1  Block by sectionId=2  Orphan(by id)=2
DELETE /api/lms/sections/c3fd838e-... → 200
After:  Section=0  Block by sectionId=0  Orphan(by id)=0
```
→ `prisma.section.delete` + schema `ON DELETE CASCADE (ContentBlock_sectionId_fkey)` 组合完整级联。零孤儿。

### Section rename 闭环
```
orig: '什么是个人理财'
→ PATCH title='QA 临时改名'
DB: '什么是个人理财' → 'QA 临时改名'
→ PATCH title='什么是个人理财'（restore）
DB final: '什么是个人理财' ✅
```

### 硬编码色 + XSS 扫描
```
$ grep -rnE "#[0-9a-fA-F]{3,6}|rgb\(|rgba\(" components/teacher-course-edit/block-editors/ components/teacher-course-edit/block-edit-panel.tsx
→ 0 命中

$ grep -rnE "dangerouslySetInnerHTML|innerHTML|eval\(|Function\(|new Function" components/teacher-course-edit/block-editors/ components/teacher-course-edit/block-edit-panel.tsx lib/utils/block-reorder.ts
→ 0 命中
```

### Token 覆盖（12 类）
```
bg-brand-soft/40 / bg-paper-alt / bg-surface
border-brand/40 / border-line / border-line-2
text-brand / text-danger / text-ink / text-ink-2 / text-ink-4 / text-ink-5
```
alpha 变体原生 Tailwind 4 支持（`/40` / `/25` 无需 safelist）。

### 回归守护 — 12 路由真 cookie
| route | status |
|---|---|
| /teacher/dashboard | 200 |
| /teacher/courses | 200 |
| /teacher/courses/[id] | 200 |
| /teacher/tasks | 200 |
| /teacher/tasks/new | 200 |
| /teacher/instances | 200 |
| /teacher/groups | 200 |
| /teacher/schedule | 200 |
| /dashboard (student) | 200 |
| /courses (student) | 200 |
| /grades (student) | 200 |
| /schedule (student) | 200 |

### PR-SEC1 API 守护不破
```
teacher2 GET /api/lms/courses/[teacher1_course]
→ {"success":false,"error":{"code":"FORBIDDEN","message":"权限不足"}}
```
readable guard（qa-pr-sec1 r1 的 resource）依然工作。

### 测试数据清理
- 6 个 blockType QA block 全 DELETE 200
- 3 个 custom payload 变体 block 全 DELETE 200
- temp section `c3fd838e-...` 通过 cascade delete 清零
- Section rename restore 至原值
- 最终 `/ContentBlock WHERE sectionId=T1_SECTION` count = 0
- **零数据污染**

## Issues found

### #1（note · Schema 历史遗留 · 非本 PR 引入 · QA 发现）
Chapter 和 Section 表**没有 `updatedAt` 字段**，但 ContentBlock 有（L254 `updatedAt DateTime @updatedAt`）。
- 影响：教师 rename chapter/section 时 Prisma 不会写 updatedAt；将来做审计 "这个 section 上次什么时候改" 无数据
- 非本 PR 引入（schema 继承自 Phase 1-3）
- 非阻塞 PASS（本 PR 不改 schema）
- 建议：独立 P2 级 PR 在 Chapter/Section model 加 `updatedAt DateTime @updatedAt`（需要 Prisma 三步 + `npx prisma migrate dev`，风险低）

### #2（note · builder 自报 · 决策合理）
| 项 | 原因 | QA 评审 |
|---|---|---|
| Chapter 改名/删除 UI 延后 | 影响 TOC，超出"右面板升级" scope | 合理，后端 `/api/lms/chapters/[id]` PATCH/DELETE 已就绪，follow-up PR 补 |
| 创建块留空 payload | 避免 "create-then-fill" dialog state 复杂 | 合理，UX 可接受（建议 future 加 autoSelect new block） |
| 拖拽 reorder → 上下箭头 | 可访问性 + 无大依赖 + 纯函数可测 | 合理，`computeReorderSwap` 8 tests 独立锁定行为 |
| 虚拟化不做 | demo 数据远小于阈值 | 合理，留 observation |
| 旧 `block-property-panel.tsx` 不删 | 本 PR 不做清理降风险 | 合理，可后续 PR 单独清理 |

### #3（QA 发现 · 非阻塞） Dispatcher 有 `case "link"` 但 schema enum 无 `link`
`components/teacher-course-edit/block-editors/index.tsx:26-27` case 永不触发（ContentBlockType enum 只有 markdown/resource/simulation_config/quiz/subjective/custom）。

Builder 已写注释 "link is not in current enum, but mockup mentions it separately" — 为未来扩展保留。`types.ts:26` 的 `BlockTypeDataShape.link` 也在。非漏洞，只是"未来 hook"。如果 schema 长期不加 link，建议清理这 3 处 dead code（L26 dispatcher + types.ts:26 + 相关变体），约 10 行。

### #4（QA 发现 · 非阻塞） 后端 payload 接受任意 JsonValue
后端 PR-4D1 spec 明确 "不做 shape validation，前端负责"，所以 `payload: [1,2,3]` / `payload: null` / `payload: "string"` 全被 201 接受。前端 CustomEditor 有严格校验拦 array/null/primitive。

- 非 bug，是 by design
- 但如果有攻击者绕过前端直接调 API，DB 会有非 object payload，学生端如果假设 data 总是 object 渲染会炸
- 建议：学生端渲染 block 时防御式访问（`if typeof data === 'object' && !Array.isArray(data)`）；或 PR-4D1 未来 hardening 可以加 `z.union([z.record(z.any()), z.null()])` 限制为 object/null

## Overall: **PASS**

**依据**：
1. tsc / 288 tests / build 三绿；schema 零改动
2. **6 种 blockType 真 E2E CRUD 全通**：创建 6 block → PATCH payload 6 次 → DB 核对正确 JSON → reorder 持久化 swap → cleanup delete。每个 editor 的 payload shape 都经过真数据链（网络 → API → Prisma → DB）
3. **Section DELETE cascade 独立验证**：temp section+2 blocks 全清零，零孤儿；schema `ON DELETE CASCADE` + service `prisma.section.delete` 链路完整
4. **Section rename 闭环**：PATCH 真改 DB → 恢复原值 → final DB 一致
5. 0 XSS 风险（markdown textarea 无 preview / custom JSON.parse + typeof 三重校验 / 所有内容走 JSX text node）
6. 0 硬编码色 + 12 token 类 + alpha 变体；UI 全中文 20+ 处；handlers 模式统一
7. 12 路由真 cookie 回归全 200；PR-SEC1/PR-4D1 API 守护未破；`computeReorderSwap` 8 unit tests 独立 pin 纯函数行为
8. **测试数据零污染**：6 QA block + 3 custom variant + 1 temp section 全清理；chapter/section title restore

## Phase 4 完成状态

**6 连 PASS**：PR-4A / 4B / 4C / AUTH-fix / 4D1 / 4D2（哈马斯 dynamic exit 的"2 连 PASS 即可 ship"远超满足）。

Phase 4 · 任务向导 + 课程编辑器升级 **端到端交付完毕**：
- 4 步任务向导（Type / Basic / Config / Review）+ AI 出题 Dialog
- 8 个后端 mutation 端点 + 36 新 guards/service tests
- 前端 block editor 6 种类型 + 上下移动 reorder + section 改名删除
- `.env.example` AI 模型分层策略
- NextAuth v5 secret 兼容 fix
- Schema 零改动（complete Phase 4 所需字段已在 Phase 1-3 打好）
- 288 tests 全绿（从 Phase 4 起点 219 增长到 288，+69 tests）

**给下一轮（Phase 5 或 Phase 4 follow-up）的建议（汇总）**：
1. [P2] Chapter/Section 加 `updatedAt DateTime @updatedAt`（schema 改 + Prisma 三步）
2. [P3] Chapter 改名/删除 UI（复用现有 API，~60 行）
3. [P3] Dispatcher 的 `case "link"` + `BlockTypeDataShape.link` 清理 dead code 或正式加入 enum
4. [P3] 旧 `block-property-panel.tsx` 删除
5. [P2] 学生端 block 渲染时防御式类型 check（或 PR-4D1 hardening payload zod union）
6. [P3] `moveContentBlock` 端点（跨 slot/section 拖拽，PR-4D2 非 scope 但未来可能需要）
7. [P2] AI Dialog 的 `courseName: taskName` 语义替代修复（qa-4b note #1 遗留）
8. [P2] 测试 seed 补 CourseTeacher collab 关系，支持真 E2E 协作路径

此批 issue 非本 PR 阻塞，建议归档到 HANDOFF 或独立 fix/refactor PR。
