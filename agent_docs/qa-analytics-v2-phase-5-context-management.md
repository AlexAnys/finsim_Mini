# Analytics V2 Phase 5 QA - Context Management

Date: 2026-05-01

## Scope

Phase 5 adds explicit teaching-context management around courses, task instances, and Study Buddy.

Changed areas:

- Study Buddy context retrieval now applies a deterministic priority:

```txt
taskInstance > task > section > chapter > course
```

- Study Buddy AI messages can carry `contextSources`; the student UI renders referenced source chips under AI replies.
- Teacher instance detail now has a `上下文` tab for uploading task-instance-specific material.
- Added detail/delete API for course knowledge sources so teachers can inspect extracted text and remove a bad context file.

## Automated Checks

Passed:

```bash
npm run typecheck
npx vitest run tests/course-knowledge-source.service.test.ts tests/course-entry-and-ai-draft-ui.test.ts
npm run lint
```

## Real App QA

Environment:

- URL: `http://localhost:3030`
- Teacher: `teacher1@finsim.edu.cn / password123`
- Student: `alex@qq.com / 11`

### Teacher Task Context

1. Logged in as teacher.
2. Opened `/teacher/instances/a5d8f119-e3cd-426f-8ea9-e57f77608ffe`.
3. Confirmed the instance tabs now include `上下文`.
4. Opened `上下文` and confirmed:
   - task-specific upload area renders;
   - empty state is clear;
   - right panel is reserved for extracted text and summary.
5. Uploaded `agent_docs/qa-analytics-v2-phase-4-async-grading.md` as a text/markdown context file.
6. Confirmed it became `文本可用` with explicit AI summary fallback:

```txt
AI_PROVIDER_NOT_CONFIGURED: mimo
```

7. Clicked `查看文本` and confirmed extracted text is readable.
8. Deleted the QA context file to avoid leaving irrelevant material on the real task.

### Study Buddy

1. Logged in as `alex@qq.com`.
2. Opened `/study-buddy`.
3. Opened `新问题`.
4. Confirmed the new post dialog includes:
   - course filter;
   - chapter filter;
   - task selector filtered by those two fields.
5. Confirmed existing conversations still render.

Because local MiMo is not configured, a new AI reply with live context citations could not be generated in this environment. The UI and data path are wired: AI message records now support `contextSources`, and the bubble renders `引用上下文` chips when present.

## Notes

- Course detail already had `教学上下文` management before this phase. This phase adds the missing task-instance entry point and Study Buddy citation display.
- Task template pages are not changed yet because a single task template can be published into multiple course scopes; task-instance context is the safer teacher-facing place for now.
