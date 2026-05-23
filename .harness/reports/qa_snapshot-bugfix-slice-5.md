# QA Report — snapshot-bugfix slice-5 (commit 57aebaa)

## Spec
review-pr13 F-7 — `components/instance-detail/snapshot-edit-sheet.tsx` 内 AlertDialog 含 disabled + `title="即将上线，敬请期待"` Button = UI 向用户假承诺未实现功能。

Slice 5 范围：
- snapshot-edit-sheet.tsx 删 AlertDialog 内 8 行 disabled `<Button>复制为新任务</Button>` 块
- AlertDialogFooter 三按钮 → 两按钮（取消 + 我知道，仍然保存）
- 保留 3 处描述文字 `复制为新任务` 作建议路径提示
- 新测试 `tests/snapshot-edit-sheet-buttons.test.ts`（4 negative-assertion）+ 同步 `tests/instance-snapshot-edit-sheet.test.ts`（3 个 it → 2 个 it）
- 不动 task 编辑页 `app/teacher/tasks/[id]/page.tsx` 的真按钮（不同 feature）

## Acceptance check

| # | Check | Verdict | Evidence |
|---|---|---|---|
| A1 | RED 真 FAIL（builder 报告 3/4 FAIL + 1 baseline PASS） | **PASS** | `git checkout 57aebaa~1 -- components/instance-detail/snapshot-edit-sheet.tsx` 保留新测试 → `npx vitest run tests/snapshot-edit-sheet-buttons.test.ts` → **3 FAIL / 1 PASS**：<br>- FAIL: 不含 `data-action="copy-as-new"`（断言失败，旧实现含）<br>- FAIL: 不含「即将上线」/「敬请期待」<br>- FAIL: 不含 `<Button disabled title="即将上线"` 模式<br>- PASS: 保留「复制为新任务」描述文字（baseline 已有，slice 5 仅删按钮不删描述）<br>**1 PASS 是 RED 测试质量保证** — 证明该断言不靠 slice 5 通过 → 删按钮不会误伤描述文字。 |
| A2 | GREEN 真 PASS | **PASS** | `npx vitest run tests/snapshot-edit-sheet-buttons.test.ts tests/instance-snapshot-edit-sheet.test.ts` → **22/22 PASS** (4 buttons + 18 edit-sheet) in 9ms |
| A3 | 全 suite 0 regression | **PASS** | `npx vitest run` → **109 files / 1130 tests PASS, 0 fail** — 与 builder Slice 5 baseline 完全一致 (Slice 4 108/1127 → +1 file +4 tests -1 deleted it = +1 file +3 tests) |
| A4 | tsc --noEmit | **PASS** | 0 errors |
| A5 | lint touched files | **PASS** | `npx eslint components/instance-detail/snapshot-edit-sheet.tsx tests/snapshot-edit-sheet-buttons.test.ts tests/instance-snapshot-edit-sheet.test.ts` → 0 errors / 0 warnings |
| A6 | npm run lint 全套 0 errors | **PASS** | 0 errors / 34 warnings — 全部 pre-existing（与 Slice 1 QA 验证时同样数字，无新增）|
| A7 | sheet.tsx 已删 8 行 Button 块 | **PASS** | `git show 57aebaa -- components/instance-detail/snapshot-edit-sheet.tsx`：删 L200-207 8 行 disabled Button 块；AlertDialogFooter 现 2 按钮 (AlertDialogCancel + AlertDialogAction) |
| A8 | 禁词清零 — `data-action="copy-as-new"` / `即将上线` / `敬请期待` | **PASS** | `grep -n "data-action=\"copy-as-new\"\|即将上线\|敬请期待" components/instance-detail/snapshot-edit-sheet.tsx` → **0 出现** |
| A9 | 保留 3 处 description 文字 | **PASS** | `grep -n "复制为新任务" components/instance-detail/snapshot-edit-sheet.tsx`：<br>- L197 `AlertDialogDescription` "如需保留旧成绩的同时让新一轮学生从头开始，建议改用「复制为新任务」"<br>- L387 simulation form "资产分组共 N 段...如需调整请使用「复制为新任务」"<br>- L478 quiz form "题库共 N 题...如需调整题目内容请使用「复制为新任务」"<br>3 处全保留，与 builder 报告吻合（builder 写 L197/393/484 是删除前位置，实际删后 L197/387/478 — 删除 8 行后行号位移正常）|
| A10 | task 编辑页真按钮不动 | **PASS** | `git show 57aebaa --name-only`：**不含 `app/teacher/tasks/[id]/page.tsx`**。grep `复制为新任务` 在该文件 → L517 toast `已复制为新任务` / L1632 description / L1647 实际 Button — 真功能完整保留。`app/teacher/tasks/` 与 `components/instance-detail/` 是不同 feature 范围，builder 不动是对的。 |
| A11 | E2E specs 无 stale 引用 | **PASS** | `grep -rn "data-action=\"copy-as-new\"\|即将上线，敬请期待" tests/` → 仅 1 处出现于 slice 5 新建的 `tests/snapshot-edit-sheet-buttons.test.ts:23`（作 negative assertion）。其他 e2e specs `tests/e2e/qa-unit4-task-editing.spec.ts` + `tests/e2e/unit4-verify.spec.ts` 引用的 "复制为新任务" 都是 **task 编辑页的真按钮**（dialog button locator），与本 slice 删的假按钮无关。`tests/e2e/iw-acceptance.spec.ts` 无任何 copy-as-new / 即将上线 / snapshot-edit-sheet 引用 — 0 stale refs。|
| A12 | 旧测试块改为正确行为锁定（不是简单删测试） | **PASS** | `tests/instance-snapshot-edit-sheet.test.ts:87`: `describe("...三按钮")` → `describe("...两按钮")`；2 个 it 替换为 1 个 "两按钮文案" it（断言 AlertDialogCancel + 我知道，仍然保存 + 描述含复制为新任务），删 "disabled + tooltip" 锁定坏行为的 stale it。**3 个旧 it → 2 个新 it（净 -1）但锁定正确行为，不是简单删测试**。这是 anti-regression rule 的正确做法。|
| A13 | Scope 严格 — 5 文件 | **PASS** | `git show 57aebaa --name-only`：snapshot-edit-sheet.tsx / instance-snapshot-edit-sheet.test.ts / snapshot-edit-sheet-buttons.test.ts (新) / 2 harness 文档。无任何 service / route / schema / auth 改动。|
| A14 | finsim-specific（中文 UI / 不影响 API） | **PASS** | 仅 client component 改动；UI 文案全中文（描述保留中文）；无 API / Route Handler / Service 改动；无后端契约变化。|
| A15 | Commit message 清晰 | **PASS** | `fix(ui): 删除假占位「复制为新任务」按钮 (slice 5)` + body 含根因（review-pr13 F-7 假承诺）、改动列表（删 8 行 + 测试更新）、保留范围说明（3 处描述 + task 编辑页真按钮不动）、baseline 数字。|

## RED 验证手法

1. `cp tests/snapshot-edit-sheet-buttons.test.ts /tmp/slice5-test-backup.ts`
2. `git checkout 57aebaa~1 -- components/instance-detail/snapshot-edit-sheet.tsx`（回 prev 假按钮还在）
3. 还原新测试到 working tree
4. `npx vitest run tests/snapshot-edit-sheet-buttons.test.ts` → **3 FAIL / 1 PASS**
5. `git checkout 57aebaa -- components/instance-detail/snapshot-edit-sheet.tsx` 恢复 → 4/4 PASS

**1 个 baseline PASS 的意义**：测试 "保留「复制为新任务」描述文字" 在旧实现下也 PASS（描述本来就在），证明 GREEN 不是因为巧合通过描述断言 — 删按钮的行为是真正被 3 个 negative assertion 捕捉的。这是 RED 测试质量保证。

## 关键 grep 结果

```
$ grep -n "data-action=\"copy-as-new\"\|即将上线\|敬请期待" components/instance-detail/snapshot-edit-sheet.tsx
(0 出现 ✓)

$ grep -n "复制为新任务" components/instance-detail/snapshot-edit-sheet.tsx
197:  如需保留旧成绩的同时让新一轮学生从头开始，建议改用「复制为新任务」。
387:  资产分组共 {state.allocationCount} 段（本 Sheet 暂不支持编辑，如需调整请使用「复制为新任务」）
478:  题库共 {state.questionCount} 题（本 Sheet 暂不支持单题编辑，如需调整题目内容请使用「复制为新任务」）
(3 处 ✓)

$ grep -rn "data-action=\"copy-as-new\"" tests/
tests/snapshot-edit-sheet-buttons.test.ts:23: expect(src).not.toContain('data-action="copy-as-new"')
(仅 slice 5 新测试的 negative assertion ✓)

$ git show 57aebaa --name-only | grep -E "^app/"
(无 — 未触 app/teacher 真按钮 ✓)
```

## Diff stat

```
components/instance-detail/snapshot-edit-sheet.tsx |  8 ----
tests/instance-snapshot-edit-sheet.test.ts         | 14 ++--
tests/snapshot-edit-sheet-buttons.test.ts          | 40 +++++++++++
5 files / 168 + / 17 -
```

源码净改：sheet.tsx **-8 行**（删假按钮），edit-sheet.test.ts +5/-14 = -9 行（锁定正确行为），buttons.test.ts +40 行（新测试）。远低于 150 行上限。✓

## Overall: **PASS**

Slice 5 通过全部 15 项 acceptance。RED 真 FAIL (3/4)、GREEN 22/22 PASS、全 suite 1130/1130 PASS、0 tsc 错误、0 lint 错误、严格遵守 scope（仅 client 组件 + 2 测试）、禁词清零 + 描述 3 处保留 + task 真按钮不动 + e2e 无 stale 引用、commit message 完整。

**整套 hot-fix PR 5 slice 全部 PASS**（Slice 1 / 2 / 3 跳过 / 4 / 5）。详见整 PR 汇总报告 `.harness/reports/qa_snapshot-bugfixes_summary.md`。
