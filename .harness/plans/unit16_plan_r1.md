# Unit 16 Plan — P2 一次性扫尾

## 做 4 个（按 coordinator 推荐）

### ① 一周洞察 modal 移动端响应式
- `components/teacher-dashboard/weekly-insight-modal.tsx:134` `sm:max-w-3xl` 已 sm+ 受限；mobile 默认 DialogContent 是 calc(100% - 2rem) ≈ 全宽 — 现已 OK
- **改动**：加 `max-h-[90vh]` (vs `85vh`) + `w-[calc(100vw-1rem)]` 移动端更近全屏 + `sm:max-w-3xl`（桌面不变）

### ② "+任务/+块" 按钮字号 10.5 → 12px
- `components/teacher-course-edit/inline-section-row.tsx:428,438` 两处 `text-[10.5px]` → `text-[12px]`（中老年教师辨识度）
- block-edit-panel 里的 "新建块" 文案 (line 367) 也 → 12px

### ③ KS owner-confirm 改 AlertDialog 替代 window.confirm
- `components/course/context-sources-panel.tsx:187` `window.confirm` → 用既有 AlertDialog state pattern（与 Unit 13 协作教师移除一致）
- 新增 `confirmOwnerSourceTarget` state；点删除时 catch `KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM` → setState 打开 AlertDialog；确认后调 handleDelete force=true

### ④ /teacher/analytics → /analytics-v2 redirect 验证
- `app/teacher/analytics/page.tsx` 已 `redirect("/teacher/analytics-v2")` — 不动，**仅 e2e 验证 redirect 生效**

## 省 2 个

- ❌ dashboard 顶层 SB 卡（Unit 6 + 11 已承接 — 老师可在 /teacher/study-buddy 看到，dashboard 不再增卡）
- ❌ "次班"术语（边角 wording，演示视频不展示）

## e2e

`tests/e2e/unit16-verify.spec.ts` 新（4 case 对应 4 改动）：
- A modal 在 375px 视口 visible 不溢出（screenshot 验证）
- B inline-section-row 按钮 text-[12px]（CSS `font-size` 检查）
- C 协作老师删 KS owner 素材 → AlertDialog 显示（不是 native window.confirm）
- D /teacher/analytics → redirect 到 /analytics-v2

## 风险

- 🟢 schema 0 改动；纯样式 + UI 整合
- 🟢 各改动独立，互不影响

预计 ~40 prod + ~100 e2e / r1 即收概率高。
