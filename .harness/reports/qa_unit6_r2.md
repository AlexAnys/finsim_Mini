# QA Report — Unit 6 r2

> QA: qa · 2026-05-14 · 验 r2 commit `04d7a8b`（建立在 r1 commit `9929810`）on `claude-demo-fixes`
> r2 任务：修 r1 Finding A — `courseColorForId(null)` crash 导致 /study-buddy 学生页 500
> Test spec: `tests/e2e/qa-unit6-r2-spotcheck.spec.ts` (4 case，独立于 builder D1)

## r2 Acceptance 对照

| QA Finding A 期望 | 验法 | 实测 | Verdict |
|---|---|---|---|
| 源头 null-guard `courseColorForId(null)` | 代码 grep `lib/design/tokens.ts:85` | signature `id: string \| null \| undefined` + `if (!id) return "tagA"` ✓ | PASS |
| 创建 free-form post → 进 /study-buddy 列表 200 + 不崩 | alex POST 全 null context + GET `/study-buddy` + 抓 DOM/console errors | HTTP 200; body 含新 post title; **null deref errors = 0** ✓ | PASS |
| `?openNew=true` 重测 (r1 I 失败案例) | alex GET `/study-buddy?openNew=true` | dialog 可见 + segmented "通用提问/任务相关" + 通用提问 aria-pressed=true 默认 | PASS |
| 任务相关 POST 仍正常 (r1 J regression spot-check) | alex POST 含 taskId+courseId | 201 + 200 (隔离运行) | PASS |
| 老师 /teacher/study-buddy 仍正常 (r1 E spot-check) | molly GET 页面 + API | 页面非 500 + 含 "未答疑/已回复" + API 200 | PASS |

## DOM 实证 (Finding A 修复证据)

alex 创建 free-form post (taskId=null + courseId=null) 后 GET `/study-buddy`，page body 中文文本：

```
学习伙伴
新问题 遇到卡点时向 AI 发起对话，按课程和任务归档。

最近对话（2）
未关联课程
QA-r6r2-A-1778760258663
2
直接 刚刚

个人理财规划
测试2
直接 2026-04-30
```

✅ Free-form post **正常列出**，"未关联课程" 标签清晰显示，UI 没崩。

```
未引用具体素材，以下基于通用知识。
个人理财是指个人或家庭根据自身的财务状况和目标...
```
✅ AI 不拒答 fallback 文案完整保留。

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 84 files / **991 tests pass** (986 baseline + 5 new courseColorForId) ✓ |
| `npx eslint <3 builder files + QA spec>` | 0 problem |
| `git show --stat 04d7a8b` | 3 files +111/-2 与 build 报告一致 |
| cross-module grep `courseColorForId` | 14 callers，5 处有 null-risk（4 个 study-buddy + 1 个 grades + 2 个 schedule）— 源头修一处全覆盖 |
| DB cleanup | 2 QA-r6 / QA-r6r2 posts DELETE'd，baseline 一致 |

## Builder 决策评价

**Option 1 (源头函数 null-guard) 选择合理**：
- 签名 `id: string | null | undefined` 诚实表达 nullability — 未来 caller 看签名就懂
- 14 个 caller 自动受益，5 处 latent risk 一次修完
- 默认 "tagA" 与既有 hash 命中分布一致，视觉无感

**Builder 主动 grep 14 callers** 找出 5 处历史隐患（grades/today-schedule）— **超过 r1 Finding A 的范围**，是 production-grade defensive 修法。

## Reflection 已加 HANDOFF

> **每个新建实体后必须验"再次进入列表页"**（创建-列表往返）

这是 r1 漏测的根因。Unit 6 e2e 验了 POST 201 + AI reply，但没验 "post 创建后学生进 list" — 列表渲染层 null seed 没防护正是这里漏的。补这条原则到 HANDOFF 让未来 unit 避坑，非常 right。

## 是否引入新 bug

无。3 files (+111/-2)，scope 严格限于 fix + test。984+5=989 → 实际 991 是因为 builder 加了 5 个 unit test。e2e 增 67 行覆盖创建-列表往返。

## Issues found

无 blocker。

## Overall: **PASS**

**判断标准对照** (r1 即收三条件 — r2 同样适用)：
1. ✅ QA 4 case (Finding A 修复直测 + r1 I 复测 + 2 个 r1 spot-check) vs builder D1 — 独立证据链
2. ✅ HTTP / DOM text / console errors / dialog visibility 全 deterministic
3. ✅ DB cleanup 完整（2 QA posts DELETE 后 baseline 一致）

**Finding A 完全修复**：null seed → "tagA" fallback，14 caller 一处修，5 处历史隐患顺带消除。建议 r2 PASS 收工，Unit 6 整体可 close。

下一步 Unit 7（课表去重 + 一周洞察 meta footer）。
