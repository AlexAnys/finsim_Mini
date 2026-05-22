# Slice 5 — B4 删假占位「复制为新任务」按钮

## 范围

`components/instance-detail/snapshot-edit-sheet.tsx` 内 AlertDialog 的占位按钮。

## 问题（review-pr13 F-7）

AlertDialog 含三按钮，中间「复制为新任务」`disabled` + `title="即将上线，敬请期待"`。教师在被 graded 拦截时看到"未实现"按钮 = UI 假承诺。**删了这个 fake button，保留 description 引导文字。**

## 修复策略

- 删 AlertDialog 内 `<Button disabled title="即将上线，敬请期待" data-action="copy-as-new">复制为新任务</Button>` 块
- AlertDialogFooter 改两按钮（取消 / 我知道，仍然保存）
- **保留** 3 处描述文字（line 197 dialog description / line 395 simulation form / line 486 quiz form）作为建议路径提示

## RED test（新文件 `tests/snapshot-edit-sheet-buttons.test.ts`）

- readFile snapshot-edit-sheet.tsx
- 断言：不含 `disabled` 紧邻 `title="即将上线，敬请期待"` 的模式
- 断言：不含 `data-action="copy-as-new"`
- 仍含 `复制为新任务` 字符串（保留 description 文字）

当前 FAIL（占位按钮还在）。

## 同步更新

`tests/instance-snapshot-edit-sheet.test.ts:95-107` 现有 2 个断言锁定 fake button 必须存在（"三按钮"和"disabled + tooltip"）。**直接锁定 bug，必须同步更新**到新的两按钮事实。anti-regression discipline 同 Slice 4。

## 不动

- `app/teacher/tasks/[id]/page.tsx` 的真按钮（task 编辑页，不同 feature）
- `tests/e2e/qa-unit4-task-editing.spec.ts` / `tests/e2e/unit4-verify.spec.ts`（测的是 task 页那个真按钮）
- 3 处 description 文字保留
- service / schema 都不动

## Acceptance

- 新测试 PASS（按钮删除已确认）
- `tests/instance-snapshot-edit-sheet.test.ts` 调整后仍 PASS
- 全 suite + tsc + lint 0 error
