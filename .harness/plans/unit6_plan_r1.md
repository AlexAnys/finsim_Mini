# Unit 6 Plan — Study Buddy 自由问 + excerpt 持久化 + 老师管理页

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 6（用户决策 #2 + #4）
> Bugs: B-STU-SB-3 (P0) + B-STU-SB-1 (excerpt) + B-SB-01 + B-SB-03

## 关键发现

### 现状 grep

**A. 自由问相关**
- ❌ `app/api/study-buddy/posts/route.ts:7-15` zod schema 强制 `taskId: z.string().uuid()` 必填
- ❌ `lib/services/study-buddy.service.ts:24-67` `createPost` 强制 taskId + 查 taskInstance
- ❌ `components/study-buddy/study-buddy-new-post-dialog.tsx:128-137` `canSubmit` 强制 `selectedTaskStillVisible`
- ❌ generateReply 无素材时仍跑（但 materialContext 为空可能导致 AI 拒答 / 失败）

**B. excerpt 持久化**
- ✅ `getKnowledgeSourcesForStudyBuddy` 已返回 excerpt（300 字截断）
- ❌ `generateReply` L105-110 `referencedSources` 只取 `id/fileName/scopeLevel/scopeLabel`，**未持久化 excerpt**
- ❌ UI `study-buddy-message.tsx` 渲染 contextSources 时无 excerpt 显示

**C. 老师管理页**
- ❌ `/teacher/study-buddy` 不存在（B-SB-02 探针 404）
- ✅ 删除 / 隐藏（Unit 5b）DELETE 端点已建
- ✅ `study-buddy.service.ts:listStudyBuddyPosts` 支持按 taskId 查（但缺**全局聚合**）
- ✅ teacher sidebar 已有 "AI 助手" nav（指向 `/teacher/ai-assistant`），但**没有 SB 管理 nav**

### 老师管理页设计

新建 `app/teacher/study-buddy/page.tsx`：
- 拉所有 molly own/collab 课程的 SB post（跨课程）
- 三个 tab：**全部** / **未答疑**（status=pending）/ **AI 已回复**（status=answered）
- 每行：学生名 + 课程/章节 + 标题 + 时间 + 状态 chip + 删除按钮
- 顶部 stats：总提问数 / 待回复 / 已回复 / 涉及学生数
- 排序：最新创建（与 listStudyBuddyPosts 一致）
- 列表点击 → 展开右侧抽屉显示完整对话 + contextSources（含 excerpt）

API：新加 `GET /api/teacher/study-buddy/posts` 跨课程聚合，复用 service `listStudyBuddyPosts` 但参数加 `teacherScope: true`。

## Schema 决策（plan 关键）

### 不动 schema

- `StudyBuddyPost.messages` 已是 Json，contextSources 嵌在 message.contextSources 中。**仅扩字段 shape**（每条 source 加 excerpt），DB shape 不变
- excerpt 截 300 字（与 `getKnowledgeSourcesForStudyBuddy` 截断逻辑一致），防 messages JSON 膨胀
- 不引入 generalScope 字段：通过 taskId 是否为 null 区分（taskId nullable 后即可，DB nullable 已支持 — 但当前 schema `taskId String` 必填... 等等需要 schema 改）

### 等等 — schema 必须改：StudyBuddyPost.taskId 改 nullable

`prisma/schema.prisma` L653 `taskId String` 是 **非空**。改成 `String?` 才能存自由问。

**Prisma 三步走**：
- migrate dev `make_study_buddy_post_task_id_nullable`
- generate
- 重启 dev server

只是把列改为 nullable（NOT NULL → NULL），现有数据兼容（已有的 post 都有 taskId）。

风险：service 内部很多地方 `post.taskId` 直接用，需 grep 处理 null 分支。

### Spec backfill 决策

**不 backfill 老 post 的 excerpt**（spec 用户决策 #2 同意原始策略）。老 post 的 contextSources 仍只有 fileName/scopeLabel。UI 渲染时 if (excerpt) 才显示。

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `prisma/schema.prisma` | 改 | StudyBuddyPost.taskId 改 String? |
| `prisma/migrations/*` | 新 | migrate dev 生成 |
| `app/api/study-buddy/posts/route.ts` | 改 | zod schema taskId 改 optional; createPost params 透传 |
| `lib/services/study-buddy.service.ts` | 改 | createPost taskId 可空; generateReply 适配 null task; referencedSources 加 excerpt; listStudyBuddyPosts 加 teacherScope 模式 |
| `components/study-buddy/study-buddy-new-post-dialog.tsx` | 改 | 顶部加 segmented "通用提问 / 任务相关"; 通用模式不显示任务选择; canSubmit 放宽 |
| `app/(student)/study-buddy/page.tsx` | 改 | 接 segmented state; useSearchParams 读 `?openNew=true` 自动打开 dialog 进通用模式 |
| `components/study-buddy/study-buddy-message.tsx` | 改 | contextSources 渲染加 excerpt（hover popover 或 inline 折叠）|
| `app/teacher/study-buddy/page.tsx` | 新 | 老师跨课程管理页 |
| `app/api/teacher/study-buddy/posts/route.ts` | 新 | GET 跨课程聚合 |
| `components/sidebar.tsx` | 改 | teacher nav 加"学习问答" item |
| `tests/e2e/unit6-verify.spec.ts` | 新 | 8 case |

## 关键改动思路

### 1. createPost taskId 改 optional

```typescript
// schema
taskId: z.string().uuid().optional(),  // 改

// service
if (data.taskId) {
  // 旧逻辑：assert task readable, instance check
} else {
  // 新逻辑：自由问 — 必须传 courseId（也是 optional）；如有 courseId 检查学生在该课程班级
  // 简化：不挂任务 = 不限范围；service 只检查 user.role === "student"
}
```

### 2. generateReply 不能拒答

```typescript
const taskName = task?.taskName ?? "通用提问";
const fallbackContext = materialContext
  ? `教师补充课程素材:\n${materialContext}`
  : "（未引用具体课程素材；基于通用金融常识与课程概要回答）";

// prompt 强调：
// "若无可参考素材，使用通用金融基础知识回答，并明确标注'未引用具体素材'。绝不拒绝回答。"
```

### 3. referencedSources 持久化 excerpt

```typescript
const referencedSources = materialSources.map((source) => ({
  id: source.id,
  fileName: source.fileName,
  scopeLevel: source.scopeLevel,
  scopeLabel: source.scopeLabel,
  // Unit 6 新增 — 持久化
  excerpt: source.excerpt.slice(0, 300),
}));
```

### 4. UI Segmented "通用提问 / 任务相关"

```tsx
<div className="grid grid-cols-2 gap-2">
  <button onClick={() => setIsGeneral(true)}>通用提问</button>
  <button onClick={() => setIsGeneral(false)}>任务相关</button>
</div>

{!isGeneral && (
  <CourseAndTaskSelects />
)}

const canSubmit = isGeneral
  ? title && question && !isSubmitting
  : selectedTaskStillVisible && title && question && !isSubmitting;
```

### 5. 老师管理页

新 page 拉数据：fetch `/api/teacher/study-buddy/posts?scope=all|pending|answered`

API 内部：
```typescript
const courses = await prisma.course.findMany({
  where: teacherCourseFilter(userId),  // 已有 owner+collab filter
  select: { id: true },
});
const courseIds = courses.map(c => c.id);
// 通过 taskId → task.courseId 链接，或后端 join
const posts = await prisma.studyBuddyPost.findMany({
  where: {
    hiddenAt: null,
    isPreview: false,
    OR: [
      { taskInstance: { courseId: { in: courseIds } } },
      { task: { taskInstances: { some: { courseId: { in: courseIds } } } } },
      // 自由问：post.taskId 为 null，按学生班级或学生选的课程关联?
      // 简化：自由问 post 不显示给老师（除非有 courseId 字段，目前没有）
      // TODO 后续 unit 加 courseId 到 SB post，自由问对老师可见。本 unit 仅做 task-bound posts。
    ],
  },
  ...
});
```

**自由问 post 对老师可见性问题**：当前 schema 不存 courseId，无法老师跨课程统计自由问。简化：自由问对老师**不可见**（仅在学生侧能看到自己的）。后续 unit 可加 `SBPost.courseId` 字段。

## 风险点

1. **🔴 Schema 改 taskId → nullable**：需要 grep 所有 `post.taskId` 用法，确保 null 分支兼容。预计 5-10 处需处理。
2. **🟡 generateReply 改 prompt**：hot path，需要 e2e 验证既有 task 模式不退化 + 通用模式可回答。
3. **🟢 excerpt 持久化**：仅扩 contextSources 字段 shape，旧数据兼容（无 excerpt 字段时 UI 退化）。
4. **🟡 老师管理页"自由问不可见"**：spec 说"学生提问 + AI 回帖聚合到老师管理页"包含自由问。本 unit 简化为"任务相关 post 可见，自由问保留在学生侧"。如果 coordinator 要求自由问也可见，需要加 `SBPost.courseId` 字段。

## 自测计划

### 自动化
1. Prisma 三步（migrate + generate + restart）
2. tsc + vitest + eslint
3. e2e 8 case

### e2e 计划
- **A**: 学生 alex 创建自由问（无 taskId）→ 201 + 等待 AI 回复 → status=answered
- **B**: 学生 alex 创建 task-bound post（旧流程）→ 仍正常
- **C**: 学生 alex 提问无素材的通用问题 → AI 回复包含"未引用具体素材"或"通用知识"
- **D**: SB message contextSources 包含 excerpt（API 返回 + UI 渲染）
- **E**: dialog 切换 "通用提问 / 任务相关"，通用 mode 不显示任务 select
- **F**: 老师 molly 进 /teacher/study-buddy → 200 + 看到 task-bound posts
- **G**: 老师从管理页删除一个 post → list 不返回
- **H**: dashboard ai-buddy-callout 点击 → 跳到 /study-buddy?openNew=true 自动打开 dialog 进通用模式

## diff 预算

预计 600-800 行（plan 大模块加新页 + service 改 + UI 改 + e2e）。

## 待 coordinator 确认

1. **自由问对老师可见性**：本 unit 简化"老师不看自由问"，还是加 `SBPost.courseId` 字段让老师能看？我倾向**简化**（自由问 = 学生隐私领域更好），后续 unit 加 courseId 时同步开放。
2. **老师管理页 sidebar 命名**："学习问答" / "学生提问" / "Study Buddy 管理"？我倾向**"学生提问"**简洁明了。
3. **`/study-buddy?openNew=true` 进通用模式**：dashboard callout 默认进通用 vs 进 dialog 不预选模式？我倾向**进通用模式**（用户决策 #2 强调"自由问"是 dashboard callout 的意图）。
