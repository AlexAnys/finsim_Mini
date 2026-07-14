# HANDOFF — 全面审查（audit-2026-07）

> 会话结束前由 coordinator 更新. SessionStart hook 自动显示. 上一 session（course-archive）已归档至 `archive/handoff/2026-05-course-archive.md`.

## 状态 (2026-07-14): ✅ 审查完成，AUDIT.md 已出，等用户裁定修复优先级

- **交付**: `.harness/reports/audit-2026-07/{AUDIT,arch,scale,db,product,insights}.md` — 72 原始发现去重 → P0×10 / P1×18簇 / P2×26 + Quick-wins×12 + 路线图 R0–R12（每包可直接转 unit spec）
- **关键决策**（全记录在 spec-audit.md 决策记录段）: 本地重建审查环境（dev :3001；DB reset 经用户 + Prisma 闸双确认；.env=生产 MIMO 4 变量）；ZZAUDIT fixture 保留未 purge（留 insights 活数据对账）；F-PROD-06 quiz 发布 400 由 P1 升 P0
- **待用户三件事**: ① tp- 订阅 key（生产 402 事故确认 + 本地 AI e2e 补测）② 是否授权修生产/staging `.env`（SSH 可达，`/opt/finsim/.env` + `/opt/finsim-staging/.env`）③ 从路线图挑第一批修复 unit（建议 R0 生产止血 → R1 数据安全 → R2 核心闭环）
- **下一步**: 用户挑定后开修复 unit；补验清单 = AI e2e（模拟对话/主观题评分/学伴）+ sim/subj 发布路径 + 客观题自动判分尾巴 + 洞察指标活数据对账

## 环境注意
- dev server :3001 后台运行中（coordinator 起的 `npm run dev -- -p 3001`）；**:3000 是 Multica 别碰**（L-004）
- 本地 5432 finsim 库已 reset 重建为一次性审查库（28 migrations + seed 9 账号 + ZZAUDIT 数据）——不再是 5 月那个"严禁动"的共享库
- 生产 SSH: `ssh -i ~/.ssh/finsim_gha root@finsim.anlanai.cn`（deployment.md）
