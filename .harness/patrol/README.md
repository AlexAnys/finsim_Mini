# .harness/patrol — staging 自动巡检骨架

> spec.md Feature 2。巡检 = 部署 staging 后由 coordinator 派 qa 类 agent 真浏览器跑验收、截图、报 PASS/FAIL，用户只在失败或产品判断时介入。

## 文件
| 文件 | 作用 |
|---|---|
| `RUNBOOK.md` | **入口**。可复用巡检操作手册：七步流程（读验收点→sanity→登录→逐条验+截图→核安全→清理→产出），含真实登录选择器、真实路由、finsim 高频陷阱、清理纪律。 |
| `result-format.md` | 结果汇总格式：`reports/qa_<unit>_<round>.md` 报告骨架 + 截图条 + 给用户的一句话。 |
| `progress-row.md` | `progress.tsv` 一行的列定义与示例。 |

## 怎么用
coordinator 在某改动部署 staging 后，派一个 qa agent：读 `RUNBOOK.md` + 该改动的 spec Acceptance → 按七步跑 → 按 `result-format.md`/`progress-row.md` 产出。首个真实用例 = #9（验反馈功能 PR-A）。

## 当前状态（2026-05-25）
- 骨架 = **离线交付**（不依赖 staging 此刻活着）。
- **真 dogfood（自动登录→真浏览器跑完→PASS/FAIL+截图条）= staging 恢复后才能验**；当前 staging 稳定 502（Caddy 活、上游 app 挂，设施侧），#9 保持 blocked。
- staging 恢复后：先跑一次冒烟自验巡检能力本身（三角色登录 + 落地页无报错，unit=`patrol-capability`），再跑 #9。
