# Probe M2 — 课程与材料工作台 r1

**范围**：新建课程、班级/协作教师、课前/课中/课后目录、AI 解析教案、教学上下文 → Study Buddy。

**测试方法**：Playwright（`tests/e2e/probe-m2*.spec.ts`，6 个 file，~21 个 case）+ DB 直查。所有截图在 `.harness/screenshots/probe-m2/`。

---

## P0（必修，影响演示故事可信度）

### P0-1 演示核心场景"教学上下文 → Study Buddy 引用素材"端到端不可用
- **症状**：演示视频承诺"老师上传教案 → 学生问 AI 时回答会引用这些资料"。实测中，**唯一被分配给班级的种子课程（id `940bbe23...`、`ec619c34...`、`a201`）所有 `CourseKnowledgeSource` 数为 0**；而 11 份 syllabus 素材都堆在课程 `00000000-...-a202` 上，该课程 1 chapter 0 section 0 student。
- **实测证据**：
  - 学生 `student1` 创建 Study Buddy post 后 AI 顺利回答（test #18 `aiReply` 完整段），但 `messages[].contextSources = []` —— **没有引用任何素材**。
  - DB 直查 `CourseKnowledgeSource` 全表：3 个课程合计 15 条 source，**全部在没有学生的课程**（`a202`=11, `e6fc049c`=3, `8f7f653c`=1）。
  - 学生的 22 个 task-instance 全部属于 `940bbe23`，该课程 0 sources。
- **根因猜测**：种子数据脱节 + 没有针对"有素材+有学生+有任务"的端到端 fixture。代码逻辑（`getKnowledgeSourcesForStudyBuddy` + Study Buddy reply prompt 拼接 `materialContext`）实际是 OK 的。
- **方向**：seed 把 11 个 syllabus 上挂到 `940bbe23` 或同步开一门"带素材的完整 demo 课"+ 给 student1 班级；写 smoke test 验证 `contextSources.length > 0`。

### P0-2 0 ContentBlock，目录页空壳
- **症状**：所有 5 门课、共 11 个 chapter、24 个 section，**`ContentBlock` 表为 0**。section × 3 slot 网格全部显示"暂无内容"；老师第一次进入看到的全部是空模板。
- **实测证据**：截图 `10-course-with-sections.png` —— 课前/课中/课后单元格 100% empty。DB `SELECT count(*) FROM "ContentBlock"` → 0。
- **根因猜测**：seed 只播了 chapter+section 结构，没有播 ContentBlock；可能因为之前重做 schema 时 seed 没跟上。
- **方向**：seed 至少在 1 门 demo 课里塞 5-10 个 block（教学目标 + 任务引用 + 富文本说明）让用户首次进入有"教学样例"可参照。

---

## P1（明显短板，影响首次体验）

### P1-1 学生用 Study Buddy 必须先选任务，"自由提问课程材料"路径不存在
- **症状**：演示原话"学生向 AI 提问回答始终基于教师准备的资源"。实测 `/study-buddy` 新建 post 对话框**强制要求选关联任务**（截图 `16-new-post-dialog.png`），schema `taskId: z.string().uuid()` 必填。
- **证据**：`app/api/study-buddy/posts/route.ts:8` + UI dialog 的关联任务 Select。
- **根因猜测**：架构选择 —— 把 Study Buddy 强绑定到 task scope。但演示话术给人"基于整门课素材自由问"的预期。
- **方向**：要么改演示话术明示"基于任务上下文"，要么开一条"课程级自由问答"路径（taskId 可选）；后者需要前端 + 后端 + scope 解析共改，工作量中等。

### P1-2 协作教师 / 多班级 dialog 极简，缺权限说明
- **症状**：协作教师 dialog 只一个邮箱输入 + 添加按钮（`12-teacher-collab-dialog.png`），**没有写协作老师能做什么/不能做什么**。同理"添加班级"（`13-add-class-dialog.png`）只一个 select，未说明多班作业是否同步、改章节是否影响所有班。
- **根因猜测**：UI 实现以最小可用为目标，未配教学说明。
- **方向**：dialog 内加 1-2 行说明（"协作教师可编辑结构与素材，无法删除主课程"等）；或给协作教师按钮加 tooltip。

### P1-3 协作教师 dialog 没有显示现有协作者
- **症状**：API `/api/lms/courses/{id}/teachers` 返回 `[]`（无现有协作者时），但 UI dialog 也**不展示"当前协作者列表"+ 移除按钮**，只能加新人，不能管理已有人。
- **证据**：截图 `12-teacher-collab-dialog.png` 全屏只有输入框。代码侧 `handleRemoveTeacher` 已实现 DELETE 调用（`page.tsx:426`），但 UI 没暴露入口。
- **方向**：dialog 加现有协作者列表 + 移除按钮（半天工作量）。

### P1-4 上传文件类型限制不一致
- **症状**：教学上下文 tab 文件 input `accept=...,.xlsx,.xls,.csv,image/png,image/jpeg,image/webp` 接受 13 种；上传大纲 dialog `accept=.pdf,.docx,.txt,.md,.zip,.png,.jpg,.jpeg,.xlsx,.xls,.csv` —— 两处不一致（缺 `.doc`、`.webp`）。
- **根因猜测**：两个 dialog 由不同时段加的，未同步。
- **方向**：抽个常量复用；或保留差异但写注释说明 syllabus vs 通用素材的接受类型不同。

---

## P2（细节优化）

### P2-1 "+ 任务"和"+ 块"按钮太小（text-[10.5px]），靠 aria-label 才能找到
- **症状**：section row 每个 slot 右上角的 + 任务 / + 块 按钮字号 10.5px，对中老年教师辨识度低。
- **证据**：`components/teacher-course-edit/inline-section-row.tsx:436`。
- **方向**：升到 12-13px，或鼠标 hover 时放大；不动 layout 即可。

### P2-2 创建课程默认描述提示语 wording 偏 IT，"次班"等术语未解释
- **症状**：dialog 描述 "填写课程基本信息，选择关联的主班级（可在创建后扩展协讲教师与次班）。" —— "主班/次班" 在教育场景下少见，老师不一定立刻理解。
- **方向**：换成 "选择本课程的主要班级。创建后可继续添加协讲教师与其他班级。"

### P2-3 课程列表"待批改"指标含义模糊
- **症状**：`/teacher/courses` 列表顶部"待批改 {n} 份"，但不是"这门课的"待批改 —— 是全部课的累计。卡片内每门课的"待批改"也是各算各的。
- **方向**：顶部 summary 改写为"全部课程待批改"或拆"本课"/"全部"；不阻塞使用。

### P2-4 不带 sourceType filter 时 `?courseId=...` 默认列出所有 source，前端默认 syllabus 视图分流后无入口看通用素材
- **症状**：默认列表只显 syllabus；课程素材"通用资料"如教案 docx / 题库 xlsx，老师在 hero 上传后想验"是否上传了"找不到通用列表入口（只能看到 syllabus tab）。
- **证据**：`fetchCourseOutlineSources()` 硬编码 `sourceType=syllabus`（`page.tsx:461`）；"教学上下文" tab 是另一条数据流。
- **方向**：让"教学上下文" tab 显示全部 source 类型 + 分类筛选；现在已经能上传但回看不便。

---

## 已知 PR #11 复测（轻扫一眼）

- M1 outline 解析：`课程编辑` dialog 仍能展开 outline editor，无 console error，未回退。
- M2 章节名 inline 重命名：UI 仍 inline；未深测焦点（P0-2 0 block 让人无 motive 深点）。
- M3a 安全合并 tooltip：上传大纲 dialog 中无对应说明（但本轮 spec 不要求）。
- M3b ready 重新解析按钮：在"上传大纲" dialog 内的素材列表条目上未截图到（建议下一轮单独 probe）。

---

## 报告路径与产物
- 截图 11 张：`.harness/screenshots/probe-m2/01-courses-list.png` 至 `17-wizard-opened.png`
- 关键证据：
  - `10-course-with-sections.png` — 课前/课中/课后 网格证据
  - `11-context-tab-expanded.png` — 教学上下文 tab 全貌（含 scope 选择器）
  - `16-new-post-dialog.png` — Study Buddy 必选任务
  - `17-wizard-opened.png` — 任务向导第 1 步 modal
- Trace log：`.harness/screenshots/probe-m2/trace.log`
- 测试代码：`tests/e2e/probe-m2*.spec.ts`（6 个文件，run via `playwright.review.config.ts`）
