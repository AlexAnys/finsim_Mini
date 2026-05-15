# Unit 12 Plan — 主观题 allowedAttachmentTypes 实接 + capture 拍照

## 调研

- `subjective-runner.tsx:99` 硬编码 `ALLOWED_EXTENSIONS`，3 处使用：`validateFile:232`、说明文案 `:550`、`accept` 属性 `:577`
- `app/(student)/tasks/[id]/page.tsx:200` 只读 `allowedAttachmentTypes.length > 0` 决定 allowAttachment 布尔，**不传数组**
- `SubjectiveTaskConfig` 接口需加 `allowedTypes?: string[]`
- file input 无 `capture` 属性

## 改动

| 文件 | 改动 |
|---|---|
| `components/subjective/subjective-runner.tsx` | `SubjectiveTaskConfig` 加 `allowedTypes?: string[]`；常量 `ALLOWED_EXTENSIONS` 改 fallback 默认值；新增 `effectiveAllowedTypes` 从 props 派生；3 处使用全部替换；input 加 `capture="environment"`（仅 accept 含 image 时） |
| `app/(student)/tasks/[id]/page.tsx` | 透传 `allowedTypes: task.subjectiveConfig.allowedAttachmentTypes` |
| `tests/unit12-allowed-types.test.ts` 新 | 单测 validateFile：老师 `["pdf"]` → 上传 .docx 拒；`["pdf","docx"]` → 都通过 |
| `tests/e2e/unit12-verify.spec.ts` 新 | 检查 input accept + capture 属性按配置变化 |

## 决策

- **空数组 fallback**：`allowedTypes` undefined 或空 → 用既有 default `["pdf","doc","docx","jpg","jpeg","png","xlsx"]`（兼容老 task）
- **capture 触发条件**：accept 含任意 `.jpg/.jpeg/.png` 时加 `capture="environment"`；否则不加
- **大小写**：toLowerCase 比对（已有）

## 风险

- 🟢 schema 0 改动；纯 frontend 数据流
- 🟢 fallback 不破坏老任务
- 🟡 capture 属性桌面浏览器忽略，仅移动端生效 — e2e DOM 检查即可

预计 ~80-120 行 + 测试。r1 即收概率高。
