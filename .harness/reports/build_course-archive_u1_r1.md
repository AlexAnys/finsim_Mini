# Build Report — U1 schema 地基 + 章节删除 FK 修复 + P2003 兜底 (r1)

worktree: `finsim-course-archive` / branch `claude-course-archive`

## 目标（spec §6 U1）
1. `Course.deletedAt DateTime?` + 索引（软删除唯一真源）
2. `ContentBlock.chapterId` RESTRICT → Cascade（修复含内容章节删不掉的真 bug）
3. `api-utils` 加 P2003 中文兜底
4. Prisma 三步（migrate → generate → 重启 dev server 验证页面加载）

## 改了什么（文件）
- `prisma/schema.prisma`
  - `Course` 模型：新增 `deletedAt DateTime?`（line 248）+ `@@index([deletedAt])`（line 266）
  - `ContentBlock.chapter` 关系：加 `onDelete: Cascade`（line 330）
- `prisma/migrations/20260525015540_add_course_deleted_at_and_contentblock_chapter_cascade/migration.sql`（新）
  - `ADD COLUMN "deletedAt"`（nullable）/ `CREATE INDEX Course_deletedAt_idx` / drop+re-add `ContentBlock_chapterId_fkey` 为 `ON DELETE CASCADE`
  - **纯 additive + 约束行为变更，无 DROP TABLE/COLUMN、无数据销毁** → 对共享 dev DB 安全（spec R6）
- `lib/api-utils.ts`：`handleServiceError` 顶部加 `Prisma.PrismaClientKnownRequestError && code==="P2003"` → `FK_CONSTRAINT_FAILED` / 409 / 中文文案（+15 行；import 加 `Prisma`）
- `tests/api-utils-p2003.test.ts`（新）：P2003 映射的 RED→GREEN 单测
- `scripts/verify-chapter-cascade.mjs`（新）：FK cascade 的真 DB 集成证明（throwaway rows + 自清理；mocked 单测无法验 FK 行为，故用此）

## TDD 过程
- **P2003 映射**：先写失败测试（断言 P2003 → 409/`FK_CONSTRAINT_FAILED`/中文）→ 确认 RED（实测落 default → 500）→ 加映射 → GREEN。
- **章节 FK Cascade**：mocked-prisma 单测无法触发真实 FK 约束，改用真 DB 集成脚本作"删含小节+内容块的章节成功 + section/contentBlock 级联删除"的证明（RED 等价 = 改 FK 前会 P2003；GREEN = 脚本 PASS）。脚本只建带 `__cascade_probe_` 前缀的 throwaway course 并在 finally 清理，**不碰现有数据**（已验证 leftover=0）。

## 验证结果
- `npx prisma validate`：schema valid
- `npx prisma migrate diff`（DB↔schema 预览）：确认只有 ADD COLUMN/CREATE INDEX/FK 重建，additive-only
- `npx prisma migrate dev`：迁移已创建并应用；`npx prisma generate`：client 已重新生成（worktree 复用 ../finsim/node_modules，符合 worktree 共享 deps）
- `scripts/verify-chapter-cascade.mjs`：**PASS** — 删含小节+内容块的章节成功，section/contentBlock 已级联删除
- 真 DB 运行时校验：regenerated client 接受 `deletedAt` filter/select + 结构 include（count(非归档)=9，无 PrismaClientValidationError）→ 运行时 500 陷阱已规避
- **dev server 重启验证（三步第 4 步）**：dev server 在 worktree 内启动（见下方坑），`/login` 200、`/teacher/courses` 307、`/dashboard` 307、`/api/lms/courses` 401 —— 均非 500
- `npx tsc --noEmit`：通过
- `npx vitest run`：**114 文件 / 1168 测试全绿**（含新 p2003 测试）

## 需要 QA 注意 / 怎么验
- **dev server 用 webpack 而非 turbopack**：worktree 的 `node_modules` 是指向主 checkout 的符号链接；Next 16.2.4 默认 Turbopack 拒绝"指向 filesystem root 之外的 symlink"（`EntrypointsOperation` 报错）。改用 `PORT=3003 npx next dev --webpack` 正常启动。这是 worktree 环境限制，非代码问题；**QA 真浏览器验证请用 `--webpack` 起服务**（端口 3001/3002 已被其他 agent 占用，我用 3003）。
- 当前我已在 3003 跑着一个 webpack dev server，QA 可直接复用或自起。
- 本 unit 仅地基；archive/restore/purge service + 读取点过滤 + UI 在 U2/U3/U4。U1 的可见行为变化 = **课程编辑里删一个含小节+内容块的章节现在成功**（spec 验收 §6 / D6）。这是 QA 本轮可真浏览器验的点。

## 不确定 / 延后
- 无延后项。`deletedAt` 字段加入后，所有读取点尚未过滤（U3 范围）——本 unit 不涉及，归档列表/过滤行为本轮不应被验。
- migration 时间戳 `20260525015540` 早于其他并行 worktree 的迁移也无妨（additive）；最终合并由 team-lead 协调。

## Prisma 三步 / dev server 重启
- 已完成：migrate dev → generate → dev server（webpack, 3003）重启并验证页面加载。**无需用户额外重启**（worktree 内自启自验）。
