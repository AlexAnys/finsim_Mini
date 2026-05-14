# Unit 5b Plan — Study Buddy 删除 + Submission 撤销批改

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 5
> Bugs: B-DELETE-01 (SB / Submission 部分) + B-SB-03 老师 SB 管理页 delete entry

## 关键发现

### Schema 现状
- `StudyBuddyPost`：无 `hiddenAt` / `deletedAt` 字段 — **真要软删需加 schema**
- `Submission`：status enum `submitted | grading | graded | failed` — 无 `ungraded`。撤销批改可复用 `submitted` 状态语义（resetSubmissionForRetry 已用此模式）
- 子表 `SimulationSubmission` / `QuizSubmission` / `SubjectiveSubmission` 含 `evaluation` 和 `conceptTags`，**作答原数据**（transcript / answers / content / attachments）与 evaluation 是分开字段

### 既有代码
- `lib/services/study-buddy.service.ts`：`createPost` / `continueConversation` / `listStudyBuddyPosts` / `generateSummary` 已存在；**无 deletePost**
- `app/api/study-buddy/posts/route.ts`：POST + GET；**无 DELETE**
- `lib/services/submission.service.ts:297` `resetSubmissionForRetry` 已存在但**会清掉 evaluation/conceptTags**，与 spec "保留作答数据" 不完全一致 — 需要新 `ungradeSubmission` 保留 evaluation
- `app/api/submissions/[id]/grade/route.ts`：POST 手工批改；**无 DELETE/撤销**
- `app/api/submissions/[id]/retry-grade/route.ts`：已有"重新批改"路径
- `components/instance-detail/grading-drawer.tsx`：批改抽屉，目前 footer 是 跳过/保存/保存并下一份；**无撤销批改按钮**

## Schema 决策（coordinator 要审）

### Study Buddy 删除：**用方案 D（加 hiddenAt 字段）**

**理由**：
1. SB post 含历史对话价值（学情诊断、Unit 6 老师管理页都依赖）— 硬删数据流失
2. spec 用户决策 #4 明确"AI 回帖不需审核" + "学生提问 + AI 回帖聚合到老师 SB 管理页" → 老师有管理（隐藏不当内容）需求
3. 只加 1 个 `hiddenAt DateTime?` 字段，Phase 1 "不动 schema" 约束的本意是避免大改 → 这是最小添加（类比 Unit 2 的 `closedAt` 我们放弃了，但那是因为 audit log 能替代；这里没有替代方案）
4. 添加可选字段是**纯加性**，不破坏现有数据，migrate 风险低（NULL 默认）

**Schema migration**:
```prisma
model StudyBuddyPost {
  ...
  hiddenAt DateTime?
  hiddenBy String?    // 隐藏者（学生删自己 / 老师隐藏）
  ...
  @@index([hiddenAt])
}
```

**风险**：需走完整 Prisma 三步（migrate dev + generate + 重启 dev server）。但 dev server 不能重启（coordinator 说"不要重启除非改了 schema"），所以需要 **明确告知 coordinator dev server 需要重启**。

**备选 — 方案 A**（硬删，妥协）：如果 coordinator 拒绝 schema 改动，本 unit 改为硬删 SB post（DELETE + cascade）。学情分析依赖的旧 post 永久消失。spec L106 字面说"DELETE 端点 + 删除按钮"未明确软删硬删，硬删也合 acceptance 字面。

我推荐方案 D。请 coordinator 拍板。

### Submission 撤销批改：**不动 schema**

复用现有 `submitted` 状态（status enum）。新加 `ungradeSubmission` 服务方法：
- status: `graded` → `submitted`
- 清 score / maxScore / gradedAt / releasedAt
- **保留** evaluation + conceptTags（与 `resetSubmissionForRetry` 不同 — 不清评估）
- audit log `submission.ungrade`

无需 schema 改动。

## 改动文件清单（基于决策 D）

| 文件 | 改/新 | 说明 |
|---|---|---|
| `prisma/schema.prisma` | 改 | `StudyBuddyPost` + `hiddenAt DateTime?` + `hiddenBy String?` + index |
| `prisma/migrations/*` | 新 | migrate dev 生成 |
| `lib/services/study-buddy.service.ts` | 改 | 加 `hidePost(postId, user)` + `listStudyBuddyPosts` 默认过滤 `hiddenAt: null`（除非显式查 includeHidden） |
| `app/api/study-buddy/posts/[id]/route.ts` | 新 | DELETE handler 调用 hidePost |
| `lib/services/submission.service.ts` | 改 | 加 `ungradeSubmission(id, actorId)` + audit |
| `app/api/submissions/[id]/ungrade/route.ts` | 新 | POST handler |
| `lib/api-utils.ts` | 改 | 加 `SUBMISSION_NOT_GRADED_YET` 错误码（撤销未批改的）|
| `components/study-buddy/study-buddy-list-item.tsx` 或 conversation header | 改 | 加删除按钮（学生删自己 / 老师所有 post 显示） |
| `components/instance-detail/grading-drawer.tsx` | 改 | 批改抽屉 footer 加"撤销批改"按钮（仅 status=graded 时显示）|
| `tests/e2e/unit5b-verify.spec.ts` | 新 | 8 case |

## 关键改动思路

### 1. `hidePost` service

```typescript
export async function hidePost(postId: string, user: UserLike) {
  const post = await prisma.studyBuddyPost.findUnique({
    where: { id: postId },
    select: { id: true, studentId: true, taskId: true, hiddenAt: true, task: { select: { creatorId: true } } },
  });
  if (!post) throw new Error("STUDY_BUDDY_POST_NOT_FOUND");
  if (post.hiddenAt) return post; // idempotent
  // 权限：学生删自己 / 老师管理（task.creatorId === user.id 或 collab）
  if (user.role === "student") {
    if (post.studentId !== user.id) throw new Error("FORBIDDEN");
  } else if (user.role === "teacher") {
    if (post.task.creatorId !== user.id) {
      // 协作者通过 course 检查（Unit 5c 上扬后协作也可）
      // 本 unit 仅 task.creator 允许
      throw new Error("FORBIDDEN");
    }
  } // admin: pass
  
  await prisma.studyBuddyPost.update({
    where: { id: postId },
    data: { hiddenAt: new Date(), hiddenBy: user.id },
  });
  await logAuditForced({
    action: "study_buddy_post.hide",
    actorId: user.id,
    targetId: postId,
    targetType: "StudyBuddyPost",
    metadata: { studentId: post.studentId, byOwner: user.id !== post.studentId },
  });
}
```

`listStudyBuddyPosts` 加 `hiddenAt: null` 默认过滤，学生 / 老师都看不到隐藏的。Unit 6 老师管理页可以加 `includeHidden=true` 选项看。

### 2. `ungradeSubmission` service

```typescript
export async function ungradeSubmission(submissionId: string, actorId: string) {
  const existing = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, taskId: true, taskInstanceId: true },
  });
  if (!existing) throw new Error("SUBMISSION_NOT_FOUND");
  if (existing.status !== "graded") throw new Error("SUBMISSION_NOT_GRADED_YET");
  
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "submitted", score: null, maxScore: null, gradedAt: null, releasedAt: null },
  });
  // evaluation/conceptTags 保留 — 老师可参考之前的 AI 评估结果
  await logAuditForced({
    action: "submission.ungrade",
    actorId,
    targetId: submissionId,
    targetType: "Submission",
    metadata: { previousStatus: "graded" },
  });
}
```

### 3. UI placements

- **SB list item**：右侧加 trash icon 按钮（owner-self 或 teacher 显示）→ confirm dialog → DELETE → 列表 fade out
- **Grading drawer**：footer 加"撤销批改"按钮（仅当 detail.status === "graded" 时显示）→ confirm dialog "撤销后此次评分作废，可重新批改" → POST `/api/submissions/[id]/ungrade` → 抽屉自动 refresh / 关闭

### 4. UX 一致性

- 沿用 Unit 5a 的 AlertDialog 二级确认模式
- 错误处理：拒删/拒撤销时显示具体中文消息（沿用 toast）

## 风险点

1. **🔴 Schema migrate 需要 dev server 重启** — 必须告知 coordinator，需要协调时间
2. **🟡 hidden post 在 listStudyBuddyPosts 默认隐藏**：可能破坏老师当前能看到的 post 列表（如果有人不小心 hide 了关键 post）。Mitigation：仅 own + creator + admin 能 hide；audit log 可回溯。
3. **🟡 ungrade 不删 evaluation**：spec 写"保留作答数据"，我把 evaluation 也归为"作答相关参考资料"保留。如果 coordinator 要求清空 evaluation，改 1 行加 `evaluation: Prisma.DbNull`。
4. **🟢 旧 SB post 没有 hiddenAt 字段**：migrate 加可选字段，默认 NULL，旧数据兼容。
5. **🟢 SB hide 是 idempotent**：重复 hide 同一 post 返回 200 + 不再写 audit。

## 自测计划

### 自动化
1. tsc + vitest + eslint
2. e2e 8 case

### e2e 计划
- **A**: 学生 alex hide 自己的 post → 200，list 不含
- **B**: 学生 alex hide 别人的 post → 403 FORBIDDEN  
- **C**: 老师 hide 本课程任意 post → 200，audit metadata.byOwner=true
- **D**: list 默认不返回 hidden post
- **E**: SB UI 列表显示删除按钮（owner 视角）
- **F**: 老师 ungrade graded submission → 200，status 回 submitted + score null + evaluation 保留
- **G**: ungrade non-graded submission → 400 SUBMISSION_NOT_GRADED_YET
- **H**: 批改抽屉 graded 状态下显示"撤销批改"按钮

### 手动验证
- molly hide 一个 SB post，audit log 实测
- molly 撤销 alex 的 graded submission，alex 在 /grades 页看到 score 消失

## 不做的范围

- ❌ 协作教师权限上扬（Unit 5c）— 本 unit 仅 task.creator 老师可 hide
- ❌ Unit 6 老师 SB 管理页 → 独立 unit
- ❌ Submission 硬删（与 grading.service 紧耦合，需要 retry-grade 路径协同 → Phase 4）
- ❌ "重新批改"按钮 / 流程（已有 retry-grade 路径）

## 待 coordinator 确认

1. **方案 D（加 hiddenAt 字段）vs 方案 A（硬删）vs 其他**？我倾向 D，但需要明确 dev server 重启窗口
2. **ungrade 是否保留 evaluation**？我倾向保留（spec 字面 "保留作答数据" 可解释含 evaluation；老师参考价值高）
3. **dev server 重启**：如果方案 D 通过，需要在我执行 `npx prisma migrate dev` 后 + `npx prisma generate` 后**显式重启 dev server** 才能让 Prisma client 拿到新 schema。请告知重启窗口

预计 diff ~ 400 行（service +120 / routes +60 / api-utils +6 / SB UI +50 / grading drawer +50 / e2e +120）。
