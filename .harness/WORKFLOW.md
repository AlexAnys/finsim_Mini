# Task → implementation → independent QA

每次工作先读 AGENTS.md 的变更分类。纯说明文档不强制建立 harness 记录，不运行应用测试。

应用任务由 coordinator 根据已授权目标写一个独立 spec，再初始化本 worktree 的任务入口：

```bash
python3 .harness/scripts/task_state.py init --id pilot-reliability --spec .harness/spec-pilot-reliability.md --base origin/main --url http://localhost:3107 --sha <实际被测commit的完整SHA>
python3 .harness/scripts/task_state.py show
```

`current-task.json` 和 `records.jsonl` 是本 worktree 的本地状态，已忽略 Git。状态不存在时，不从旧 `spec.md` 推断当前任务。历史 `progress.tsv`、报告和交接保留供查证，不再追加自由格式行。初始化会拒绝覆盖未完成任务；讨论/等用户时用 `status awaiting_user`，恢复用 `status active`，不改变用户授权范围。

Builder 在独立 feature 分支实现，提供改动/检查/不确定项。Coordinator 统一冻结候选提交和服务环境后交给独立 QA。不同任务可并行，但同一候选的 QA 期间不修改源文件；发现问题退回 builder。

QA 只读取应用源代码，报告输出到 `.harness/reports/`，截图到 `.harness/screenshots/`。开始和结束分别执行：

```bash
python3 .harness/scripts/task_state.py qa-start
# 真实运行相关检查、浏览器验收，写有证据位置的 QA 报告。
python3 .harness/scripts/task_state.py qa-finish --verdict PASS --report .harness/reports/qa_pilot_r1.md --check '具体命令及结果'
```

开始/结束都会确认 FinSim `/api/version` 与 expected_sha；完整源代码内容（含 staged/unstaged/untracked）、spec、branch、worktree 绑定到结果。测试中发生源码变更、代码版本不同或报告改写，旧 PASS 无效。仅新增报告/截图不会使应用 QA 失效。证据记录并不是执行测试的替代；generator/coordinator 不得代写独立 QA 的结论。

QA 不只对照本轮新增功能：既有核心路径、权限/成绩边界、受影响设备上的主操作不得回退。新出现的破版/无法操作为 FAIL；既存且不在任务内的问题单列，不扩大范围。r1 PASS 即退出；同一个 FAIL 在 r2/r3 重复时回到原因或 spec；已有相关 lesson 可引用，不为记录强造新 lesson。

Coordinator 运行 `complete` 后才声明完成。Stop 是轻量的证据有效性检查，不调用模型、不替代独立 QA；无活动任务/讨论/进行中的实现不阻断回复。ready/complete 时证据过期阻断一次；再次 Stop 只显示任务尚未完成，防止无限循环。

`prune.sh` 默认预览；`prune.sh --apply` 只复制当前已完成任务的已绑定报告到 `archive/tasks/<id>/`，不覆盖冲突文件、不删除原件、不改历史 TSV。写入由同一 worktree 文件锁串行化。没有自动删除备份或历史记录。

跨工具接手：Codex 使用同一脚本和任务格式，Claude Code 的 Hook 不是 Codex 的隐式保障。Claude 工具白名单含 Skill；gstack 不可用时报告工具缺失，使用 Playwright 等实际可用方法完成等效验收，不能把跳过记 PASS。

## FAIL后的r2候选

QA先用qa-finish记录FAIL，任务回到active。Builder修复并提交、coordinator以新SHA重启对应服务后，显式更新同一任务的候选（不改spec/授权范围）：

```bash
python3 .harness/scripts/task_state.py retarget --sha <新的完整HEAD-SHA> --url http://localhost:3107
python3 .harness/scripts/task_state.py qa-start
```

retarget只接受active/awaiting_user、当前完整HEAD和明确HTTP(S)URL；源文件仍dirty时拒绝。会清除当前qa/qa_start并追加旧新target历史，旧报告/ledger记录不删除。ready/complete不能直接重绑PASS；需要新工作时先明确置active，重新验收。不要手改JSON、伪造complete或把旧PASS挂到新版本。
