# FinSim v2 · 待决策方向清单

> **用户作为最终决策者**。本文档汇总所有需要用户方向判断的问题，项目功能需求以现有 codebase 为准，设计稿只是呈现参考。
> 每个问题给**我的推荐默认**，用户标 ✓ 接受或覆盖即可。

---

## A · AI 模型选择（每个 feature 用哪个 provider）

现有 env 支持：`qwen` / `deepseek` / `gemini` / `openai`，每个 feature 可独立 override。

| Feature | 当前默认 | 我的推荐 | 理由 |
|---|---|---|---|
| A1 · Simulation 客户对话 | `AI_SIMULATION_PROVIDER` → `AI_PROVIDER` | **qwen-plus** 或 **deepseek-chat** | 中文对话自然度 + 成本低；gemini 对中文场景偏翻译腔 |
| A2 · Quiz 自动批改（短答） | `AI_EVALUATION_PROVIDER` | **deepseek-chat** | 批改精确度优于对话，价格友好 |
| A3 · Subjective 批改 rubric | `AI_EVALUATION_PROVIDER` | **qwen-max** 或 **deepseek-chat** | 长文理解 + rubric 对齐能力 |
| A4 · AI 批量出题 | `AI_TASK_DRAFT_PROVIDER` | **qwen-plus** | 金融题目生成，中文语料丰富 |
| A5 · 学习伙伴 Socratic 引导 | `AI_STUDY_BUDDY_PROVIDER` | **qwen-plus** | 对话式、温度略高鼓励追问 |
| A6 · Insights 共性问题聚合 | 无（新 feature） | **deepseek-chat** + longer context | 需要读 N 份提交再聚合，context 要够大 |
| A7 · Simulation mood 推断 | 无（新 feature） | **与 A1 同一 provider**（省 inference 次数） | 每轮对话顺带输出 mood，单次调用 |

**你需要定的**：
- [ ] A1-A5 是否接受我的推荐？（或者告诉我优先用哪家）
- [ ] A6 / A7 是否现在就上（影响 Phase 5 insights 和 Phase 7 sim runner），还是先做占位？

---

## B · 系统提示词构建

每个 AI feature 需要一套 prompt 模板。目前 codebase 里有基础提示词但**质量待提升**。

### B1 · Simulation 客户人设生成
- **输入**：teacher 在任务向导 Step 2 填的 `scenario` + `openingLine` + 客户 profile 字段（年龄/职业/收入等）
- **输出**：AI 扮演客户的系统提示词
- **决策点**：
  - 人设的"顽固度"如何？客户总是听劝 vs 有自己立场 → 推荐 **中等顽固**（学生需要说服/引导才改变观点）
  - 是否允许客户主动暴露隐性需求？推荐 **有条件**（学生问到对的问题才暴露）

### B2 · Simulation mood 评估
- **输入**：最近 3-5 轮对话
- **输出**：客户当前情绪 0-1 分（0=平静，1=烦躁）+ delta + 5 档 label
- **决策点**：
  - 情绪是单维（arousal）还是二维（arousal + valence）？设计师留白了
  - **我的推荐：单维 0-1**（简单可解释，UI 也是一条条），5 档映射：`[0, 0.2, 0.45, 0.7, 1]`
  - 触发情绪变化的因素：学生问话敏感度 / 避重就轻 / 语气专业度 — 这些要写进 prompt

### B3 · 学习伙伴 Socratic 引导
- 已有 endpoint `/api/ai/study-buddy/reply`，已有 `mode: socratic|direct` 字段
- **决策点**：Runner 内嵌的 hint（不是用户主动问，而是 AI 自动弹出）触发条件：
  - "AI 刚暴露隐性需求但学生没抓住" → hint
  - "学生偏离评分标准任一维度超过 X 轮" → hint
  - 或更简单："每隔 5 轮若得分低于 60 就 hint"
  - **我的推荐：组合策略**（AI 每轮自评 + 明显偏离才 hint，而不是每轮都 hint）

### B4 · AI 批改 rubric 映射
- Simulation: 4 维度（需求识别/专业度/共情沟通/方案完整性）
- 每维度 0-25 分，AI 输出需给出：score + 具体引证学生哪句话 + 改进建议
- **决策点**：
  - 给 AI 输出置信度 0-1？推荐 **是**（低置信度人工复核）
  - 多维度间允许相互冲突的 feedback 吗？推荐 **不允许**（prompt 要求最终输出是 consistent narrative）

### B5 · Quiz 自动批改
- 单选/多选/判断：规则比对（不用 AI）
- **简答**：AI 评分 + 关键词匹配组合
- **决策点**：简答的"及格线"如何定？推荐 **语义相似度 > 0.7 + 包含关键词 > 50%**

### B6 · Subjective 批改
- 老师主批，AI 给"建议评分" + 建议评语
- **决策点**：AI 建议是否显示给老师还是隐藏？推荐 **默认显示但老师可关**（防止锚定效应）

---

## C · 数据分析框架

### C1 · 薄弱概念聚合（教师 dashboard / insights tab）

**现状**：`AnalysisReport` 是单 instance 级，没跨 instance 聚合。

**设计稿要求**：教师 dashboard 有 "薄弱概念 top 3"，insights tab 有"共性问题"。

**三条路径选择**：

- **路径 1（降级，零改）**：显示 "待分析实例 top 3" —— 按错误率排序的 instance，点进单 instance insights
- **路径 2（加字段，中等）**：`AnalysisReport` 加 `conceptTags: string[]`，AI 批改时顺带抽取 3 个关键概念，跨 report 聚合统计
- **路径 3（完整，重）**：新 `Concept` 表 + 任务配置里可挂 Concept，批改时记录 `missed_concepts`

**我的推荐：路径 2**（加一个字段，效果 90% 接近设计稿，工作量可控）

### C2 · 班级表现 8 周趋势图（教师 dashboard）

**我的推荐**：前端聚合 `submissions` 按周分组，不加 API。已在 Phase 3 实施。

### C3 · Insights AI 共性问题聚合（新）

**设计稿要求**：实例详情 `insights` tab 显示"学生普遍在 X 维度表现弱"、"3 份高分共性：Y"

**决策点**：
- 聚合时机：所有提交批完后一次性跑 / 每 10 份提交增量跑 / 教师手动触发
- **我的推荐：教师手动触发**（避免随便烧 AI token，且老师点进来时才真看）

### C4 · Analytics tab（实例详情）

**设计稿要求**：KPI（得分分布直方图 / 耗时散点 / 答题顺序热图）

**决策点**：
- 这些图是**前端 SVG 自画**（快）还是引入 chart 库（recharts 等）？
- **我的推荐：前端 SVG 自画**（已在 Phase 3 实施，性能更好，视觉更克制）

---

## D · 具体呈现的内容（文案 / 图标 / 占位）

### D1 · Simulation mood 5 档文案

设计稿用的：`平静 / 放松 / 略焦虑 / 焦虑 / 烦躁`

**决策点**：金融客户场景可能还有"犹豫 / 怀疑 / 信任 / 兴奋 / 失望"等。坚持 5 档还是扩到 8 档？
- **我的推荐：扩到 8 档**（`平静 / 放松 / 兴奋 / 犹豫 / 怀疑 / 略焦虑 / 焦虑 / 失望`），AI 输出时能更精准

### D2 · 学习伙伴 hint 范文

**决策点**：hint 文案是"追问的问题"还是"直接给提示"？
- **我的推荐：以问题形式**（符合 Socratic 精神）— 如 "客户提到 '家里人念叨'，暗示了什么？试试追问"，而不是 "这里要追问家庭态度"

### D3 · AI 本周建议（教师 dashboard AI 卡）

当前降级为"打开 AI 助手查看"占位入口。

**决策点**：如果升级为真内容，要显示什么？
- **我的推荐（若升级）**：每周一早上自动跑一次，生成 3 句建议（如"投资 22-1 班 CAPM 错误率高，建议课堂补讲"），点进 ai-assistant 看详情。需要新 API `/api/ai/weekly-insight`

### D4 · 空态文案

设计稿 `auth-states.jsx` 有 8 种空错态：
- 404 / 500 / 403 / 登录超时 / 维护中 / 无数据 / 搜索无结果 / 网络错误

**决策点**：是否都按设计稿做？还是简化成 4 种（404/500/403/通用错误）?
- **我的推荐：8 种全做**（一次到位，中文文案我会按"克制 + 有温度 + 有主 CTA" 写）

---

## E · 批改方法

### E1 · Simulation 批改流程

设计稿：AI 先批（4 维度 + 置信度）→ 教师复核（可改分、可加评语）

**决策点**：
- AI 批改和教师复核的数据存在哪？推荐 **Submission.evaluation JSON 存 AI 原始 + 教师 override**
- 教师改了分后，AI 原始分是否保留审计？推荐 **保留**

### E2 · Quiz 批改流程

- 选择题/判断：即时出分
- 简答：AI 批 + 教师可改

**决策点**：学生提交后立刻给分还是等教师确认？
- **我的推荐：立刻给分**（AI 批改完就出 feedback），教师可批量调整

### E3 · Subjective 批改流程

- 老师主批
- AI 给"建议评分 + 建议评语" 供参考

**决策点**：已在 B6 回答（默认显示，老师可关）

### E4 · 异常标记规则

设计稿教师 dashboard 有"AI 置信度 94% · 3 份标记异常"

**决策点**：什么算异常？
- 置信度 < 0.6
- 或分数偏离班级均分 > 2σ
- 或学生用时 < 20%（可能抄袭）或 > 300%（可能离开）
- **我的推荐：三条 OR，任一命中就标异常**

---

## F · 设计师悬而未决（4 项，HANDOFF.md §5.3）

1. **F1 · AI 情绪模型维度** — 已在 B2 回答，推荐单维 0-1 + 8 档
2. **F2 · 资产配置持久化粒度** — 设计稿有"记录当前配比"按钮
   - **我的推荐：组合** — 实时 debounce 2s 自动保存 draft，"记录"按钮打 snapshot（AI 批改时看 snapshot 轨迹）
3. **F3 · Quiz 自动保存频率** — **推荐 debounce 1s**（设计师写 "3 秒前"是显示时间，不是保存频率）
4. **F4 · 权限矩阵** — 当前 student/teacher/admin
   - **我的推荐**：现在不扩（助教/课程管理员），Phase 8+ 后讨论

---

## G · 项目功能需求 vs 设计稿冲突（需要用户澄清）

### G1 · 设计稿 `student-schedule.jsx` vs 现状
现状：Phase -1 已做 `/schedule` 3-Tab（本周/周课表/日历），设计稿是周视图 + 周选择器 + 图例。  
**问题**：要保留现状的 3-Tab 吗？还是按设计稿改成单一周视图？
- **我的推荐：保留 3-Tab**（你之前明确说过要日历，不回退）

### G2 · 设计稿 `teacher-course-editor.jsx` vs Phase 3 PR-3C 的占位版
现状：PR-3C 走了 A 方案（右面板"深度编辑即将推出"）。新设计稿给出了完整可交互 block editor（含 6 种 ContentBlockType 的编辑面板）。  
**问题**：要升级 Phase 3C 到完整版吗？代价：需要新增 5-6 个 API 端点（解锁"不改 API"硬约束）  
- **我的推荐：作为 Phase 4 的一部分升级**（任务向导本来就可能新开端点，一次性做完整）

### G3 · AI 助手页 `/teacher/ai-assistant`
设计稿没特别出稿，但教师 dashboard 里 AI 卡指向该页。  
**问题**：这个页需要做吗？做什么？
- **我的推荐：Phase 8 做**（聚合所有散落 AI 动作的历史记录 + 统一对话入口），现在只做跳转占位

### G4 · 上海教师 AI 案例申报
独立工作线（`.harness/shanghai-ai-case-2026.md`）。  
**问题**：UI 重构剩下 4 个 Phase，你要在 UI 全做完后再启动，还是某个 Phase 之后插入？
- **我的推荐：Phase 5（insights/analytics）之后插入**，因为那时产品已足够完整可拿去申报

---

## H · 新 API / Schema 改动预判（"不改 API" 硬约束解锁请求）

### H1 · ContentBlock CRUD 端点（5 种）
**触发 Phase**：Phase 4（若选择升级 Phase 3C 为完整编辑器）
**新增**：
- `POST/PATCH/DELETE /api/lms/content-blocks/[id]/resource`
- `POST/PATCH/DELETE /api/lms/content-blocks/[id]/simulation-config`
- `POST/PATCH/DELETE /api/lms/content-blocks/[id]/quiz`
- `POST/PATCH/DELETE /api/lms/content-blocks/[id]/subjective`
- `POST/PATCH/DELETE /api/lms/content-blocks/[id]/link`
- `PATCH /api/lms/chapters/[id]` / `DELETE` 
- `PATCH /api/lms/sections/[id]` / `DELETE`
- `POST /api/lms/sections/[id]/reorder`
**解锁需要你 approve**

### H2 · Simulation mood / hint 字段
**触发 Phase**：Phase 7（Simulation Runner 重做）
**改动**：
- `/api/instances/:id/messages` POST 返回值加 `mood: {score,delta,label}` + `hint?: string` 字段（AI 响应格式扩展）
- 可能加 `AnalysisReport.moodTimeline: [{turn, score}]` 字段
**解锁需要你 approve**

### H3 · Insights aggregate 端点（新）
**触发 Phase**：Phase 5（`/teacher/instances/[id]/insights`）
**新增**：
- `GET /api/lms/task-instances/[id]/insights/aggregate` — AI 聚合所有提交的共性问题
- `AnalysisReport.conceptTags: string[]` + `commonIssues: string[]` 字段
**解锁需要你 approve**

### H4 · 周计划 AI 建议（可选，D3 延伸）
**触发 Phase**：Phase 5 或 Phase 8
**新增**：`/api/ai/weekly-insight` cron job + 存 `TeacherWeeklyInsight` 表
**这个非必需**，可跳过

---

## 决策方式

你**不必一次回答全部**。最少需要决策：
- **立即（Phase 4 启动前必须）**：A4（AI 出题 provider）/ B4（批改 rubric 结构）/ G2（课程编辑器是否升级）/ H1（API 解锁？）
- **Phase 5 启动前**：A6 / B6 / C1 / C3 / C4 / H3
- **Phase 7 启动前**：A1 / A7 / B1 / B2 / B3 / D1 / D2 / H2
- **可以最后再定**：D3 / D4 / E4 / G1 / G3 / G4 / H4

如果你只告诉我"全走你的推荐"，我会按默认推进 Phase 4 并在每次 Phase 边界再确认。
