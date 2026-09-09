# Archive

新任务使用 `.harness/WORKFLOW.md` 和带锁结构化 ledger。`scripts/prune.sh` 默认仅预览，`--apply` 把当前已完成任务的已绑定 QA 报告复制到 `archive/tasks/<task_id>/`。只读校验 fingerprint，拒绝同名不同内容，不删除原报告，不重写 legacy TSV。新任务后续 FAIL/重开不能被此前 PASS 提前归档。

现存 `progress.tsv`、`units/`、`handoff/`、`manifest.tsv`、`lessons-archive.md` 为历史资料，保留原样。不能仅凭其中的 PASS 推断当前代码已验收。不要自动删除历史或改写损坏行来制造“干净”状态；需要查证时同时读原报告和 git 记录。
