# Analytics V2 Final Hardening QA

Date: 2026-05-01
Branch: `codex/analytics-diagnosis-v2`
Worktree: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-codex-analytics-v2`
Server: `http://localhost:3030`

## Scope

Final pass after phases 1-8:

- Qwen OCR/document ingestion
- AsyncJob runner and task build drafts
- async submission grading status
- scoped course/task context management
- async AI workbench and AI settings
- Analytics V2 data quality flags and recompute
- student dashboard and teacher class/group management UX

## Final Fixes During Hardening

- Restored the student simulation submitted-view guard copy:
  - `已提交，AI 分析中`
  - `你将在教师公布后看到详细评估`
- Added pending-copy overrides to the shared `SubmissionProcessingCard`.
- Renamed AI settings labels to match the teacher-facing capability split:
  - `模拟对话回复`
  - `模拟对话批改`
  - `Quiz 生成`
- Renamed the first teacher groups column to `班级概览` for clearer three-area navigation.

## Automated Checks

Passed:

```txt
npm run typecheck
npm run lint
npx vitest run
npm run build
```

Vitest result:

```txt
66 test files passed
781 tests passed
```

Targeted regression before full run:

```txt
npx vitest run tests/pr-sim-1c-student-ui.test.ts
npx vitest run tests/ai-tool-settings.test.ts
```

Known build warning:

- `npm run build` passes, but Turbopack still emits 4 NFT tracing warnings involving `document-ingestion.service.ts` and `next.config.ts`.
- This is not a build failure. It appears tied to document parsing/OCR dependencies being traced through app routes. Leave as a future packaging optimization unless it causes standalone deploy size/runtime issues.

## Real App QA

Browser automation via Playwright against `localhost:3030`.

Teacher account:

```txt
teacher1@finsim.edu.cn / password123
```

Student account:

```txt
alex@qq.com / 11
```

Verified teacher flows:

- `/teacher/ai-assistant`
  - `教师日常材料处理`
  - `教案完善`
  - `思政挖掘`
  - `搜题与解析`
  - `试卷检查`
- `/teacher/ai-settings`
  - `平台 AI 能力配置`
  - `模拟对话回复`
  - `模拟对话批改`
  - `Quiz 生成`
  - `AI 工作助手`
- `/teacher/groups`
  - `班级与分组管理`
  - `班级概览`
  - `分组情况`
  - `人员信息`
  - `批量加入`
- `/teacher/analytics-v2?courseId=e6fc049c-756f-4442-86da-35a6cdbadd6e`
  - `数据洞察 V2`
  - `当前范围`
  - `数据质量提示`
  - recompute button is present

Verified student flows:

- `/dashboard`
  - `学习任务`
  - `未来课程`
  - `公告`
  - `学习伙伴`
  - overdue penalty label `扣 20%` visible when overdue tasks are present
- `/study-buddy`
  - new question dialog opens
  - filters/fields visible: `课程`, `章节`, `关联任务`

Result:

```json
{
  "ok": true,
  "checked": [
    "teacher ai-assistant",
    "teacher ai-settings",
    "teacher groups",
    "teacher analytics-v2",
    "student dashboard",
    "student study-buddy modal filters"
  ]
}
```

## Notes

- This final pass did not mutate group membership or create new production-like task data.
- The earlier phase QA documents contain the heavier workflow checks for document ingestion, async drafts, async grading, context management, AI workbench, Analytics V2 data quality, and dashboard/group UX.
- The current branch is ready for user testing at `http://localhost:3030`.
