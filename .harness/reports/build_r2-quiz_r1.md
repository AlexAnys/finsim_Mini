# Build Report — R2 quiz 发布链修复 · r1

**Unit**: `r2-quiz`
**Round**: `r1`
**Builder**: Codex
**Date**: 2026-07-15
**Branch**: `codex-quiz-publish-fix`

## 结论

F-PROD-06 与 F-PROD-15 是同一个前端数据整形缺陷：向导固定保留 4 个选项输入槽，但把未填写的可选槽位既计入 `missingFields`，又原样放入发布 payload。服务端校验没有问题，也没有被放松。F-PROD-07 与 F-PROD-08 是教师详情页未兼容历史/seed 的 `{label,content}` option shape，导致文字和 React key 同时为 `undefined`。

## 根因证据与两条 payload 对比

### DB SELECT 证据

只读查询 `TaskBuildDraft.id LIKE '0340e2c4%'` 得到：

- id：`0340e2c4-4185-4a03-acf6-aea96d67714a`
- title：`ZZAUDIT 客观题小测`
- status：`draft`
- missingFields：`["答案与选项"]`
- `draftPayload.form.questions` 有 2 题，单选正确答案 `A`，多选正确答案 `A/B`
- 唯一异常是第 1 题仍带默认空槽 `{ id: "D", text: "" }`

另一个只读查询确认 seed quiz `f673dba7-ea17-4aae-afd3-02a8d63baa18` 的 DB options 为 `{label,content}`，例如 `{label:"A",content:"设定财务目标"}`；这与教师页只读 `{id,text}` 的假设不一致，而学生页已有双 shape 映射。

### 保存草稿（201）

`persistDraft()` 发送的业务字段包含：

```text
POST /api/lms/task-build-drafts
{
  taskType: "quiz",
  missingFields: collectMissingFields(form),
  draftPayload: { form: currentForm, ... }
}
```

草稿 route 对 `draftPayload` 使用 `z.unknown()`，因此含空 D 的 form 会被原样保存并返回 201。旧 `collectMissingFields()` 使用 `question.options.some(option => !option.text.trim())`，把一个未使用的空槽误判为整组“答案与选项”缺失。

### 创建并发布（400）

`handleSubmit()` 把同一 form 展开为：

```text
POST /api/lms/task-instances/with-task
{
  task: {
    taskType: "quiz",
    quizQuestions: [{
      ...,
      options: [A, B, C, { id: "D", text: "" }]
    }]
  },
  instance: {...}
}
```

用原 `createPublishedTaskWithInstanceSchema.safeParse()` 本地复现，准确 issue path 为：

```text
task.quizQuestions[0].options[3].text
Too small: expected string to have >=1 characters
```

`ZodError.flatten()` 把嵌套 issue 汇总到顶层 `fieldErrors.task`，所以审计记录的 `task:["Too small..."]` 不代表整个 `task` 字段为空。根因是空 option text 被序列化，不能通过把服务端 `.min(1)` optional 化解决。

## 改动与理由

### `lib/utils/quiz-question-payload.ts`（新增）

- `isQuizQuestionComplete()`：单/多选要求至少 2 个非空选项，且正确答案必须指向有效选项；真正缺项仍被阻止。
- `buildQuizQuestionPayload()`：只过滤未填写的可选槽位；判断题固定序列化“正确/错误”；简答题保留参考答案路径。
- `normalizeStoredQuizOptions()`：在页面数据入口把 `{id,text}` 与 `{label,content}` 统一成 `{id,text}`，无 label/id 时按索引生成 A/B/C/D。

理由：保存草稿、missingFields、发布 payload 使用同一完整性语义，避免再次漂移；服务端 schema 保持严格。

### `components/teacher-course-edit/task-wizard-modal.tsx`

- `collectMissingFields()` 改用同一个 `isQuizQuestionComplete()`。
- 发布前对真正不完整的题目显示“第 N 题缺少有效选项或正确答案”，并回到配置步。
- quiz payload 改用 `buildQuizQuestionPayload()`，不再发送空占位选项。
- 若 with-task 仍返回 `fieldErrors.task`，toast 改为“任务内容不完整，请检查题目、选项和正确答案”，不再裸显示“请求参数错误”。

### `app/teacher/tasks/[id]/page.tsx`

- `fetchTask()` 收到 quiz 后立即归一化 options，展示与编辑共用 canonical shape。
- option key 使用 `${id}-${index}`，即便异常数据 label 重复也不会出现本次 undefined key。

理由：修复读取边界，而不是在每一处 JSX 分别猜字段；同时覆盖 F-PROD-07 与 F-PROD-08。

### `tests/quiz-publish-payload.test.ts`（新增，7 tests）

- ZZAUDIT 同型单选：A/B/C 有内容、D 空、A 正确，不误报缺失。
- 单选 + 多选 payload 过滤空槽后通过原 with-task 服务端 schema。
- 少于 2 个有效选项、无正确答案仍失败。
- 判断题固定 option 序列化。
- 历史 `{label,content}` → `{id,text}`。
- 守护向导和教师详情页确实消费共享 seam，并守护中文 toast。

TDD 记录：首次定向运行因新模块尚不存在而失败；实现后 `7/7` 通过。

## 验证结果

| 检查 | 结果 |
|---|---|
| DB | 仅执行 Prisma `findMany` SELECT；未写入 |
| 原错误复现 | 原 schema 准确定位 `task.quizQuestions[0].options[3].text` |
| `npx vitest run tests/quiz-publish-payload.test.ts` | 7/7 passed |
| `npx tsc --noEmit` | 0 errors |
| `npx tsc --noEmit && npx vitest run` | tsc 通过；1271/1272，唯一失败为既有 `ai-provider.test.ts` 受本地 `QWEN_MODEL=qwen3.5-plus` 污染，期望硬编码 `qwen3-max` |
| `QWEN_MODEL= npx tsc --noEmit && QWEN_MODEL= npx vitest run` | **125 files / 1272 tests 全绿**；仅清空单次命令环境变量，未改 `.env` |
| dev server | `:3001/login` HTTP 200；教师任务未登录请求 307 到 login；未 kill/重启 |
| `git diff --check` | clean |

全量测试中的 stderr 均来自已有的预期失败分支测试（DB down、AI fallback 等），最终退出码为 0。

## 自测记录

1. 用真实 ZZAUDIT 草稿 JSON 复现旧 payload 400，并确认错误不是空 `task` 对象。
2. 用相同题目经新 builder 生成发布 payload，D 空槽被移除，单选 + 多选一起通过未修改的服务端 schema。
3. 用真实 seed `{label,content}` 数据验证归一化后得到可渲染 `{id,text}`，正确答案 id 保持不变。
4. 没有执行真实发布、提交或保存，因为本 unit 明确限制 DB 只允许 SELECT。
5. `browse` skill 尚未在本机完成一次性构建，按其规则未擅自安装；真实页面文字与 console 验证交给既定 Opus QA。

## 范围与 diff 说明

未修改 route/service 校验、schema/migration、simulation/subjective 业务逻辑、`.env` 或 dev server。功能代码保持小范围；总 diff 超过 150 行主要来自共享纯函数、7 条回归测试和本报告，而非业务重构。

## 遗留风险 / Opus QA 提示

1. 必须真浏览器验证新建单选 + 多选发布、重开 ZZAUDIT 草稿发布、学生提交自动判分；Builder 因 DB 只读纪律没有执行这些写路径。
2. 必须打开 seed quiz `f673dba7-ea17-4aae-afd3-02a8d63baa18`，确认教师详情显示 A-D 文字且 console 无 `unique key`。
3. 本地全量测试默认继承 `.env` 的 `QWEN_MODEL=qwen3.5-plus`，会触发一条与本 unit 无关的硬编码断言；CI 若无该变量应直接全绿。未在本 unit 修改 AI 测试或配置。

## 状态

Ready for Opus QA。
