# Independent QA r3: FAIL - selection reset after type change

Frozen candidate `d2f3b5fb17cb56f7f6e16de462e73b366788be0a`, same isolated environment/database, source unchanged through this QA. First full run: 11/15 PASS; targeted follow-up resolved 3 failures without application changes. Combined: **14/15 scenarios PASS; visibility selection preservation FAIL**.

## Confirmed remaining defect

After waiting for the navigation dropdown to fully unmount, focus current-password and set selection 2..5, then mouse-click Show. A value-free instrumented browser timeline proves:

1. pointerdown/mousedown/click: focus remains current-password, selection 2..5.
2. component layout effect calls setSelectionRange(2,5).
3. later native selectionchange: input type=text, focus still current-password, selection **0..0**.

The final range remains incorrect beyond the 5-second retry window. Thus useLayoutEffect alone runs before Chromium's late selection reset on type transition. Suggested correction must restore the selection after that reset, only while input remains focused, and must never call focus to steal focus from a later Tab/other input. Source fix required; no PASS issued.

`password_d2f3b5f_selection-timeline.json` records only event names, element ids and selection indices, no password text. Earlier navigation setup also exposed Radix's close-autofocus taking focus before the eye click; waiting for menu DOM removal removed that confound. This final failing timeline isolates the type-switch behavior itself.

## Other results and retest boundaries

- 3 full student page flows now PASS. All controlled new values authenticate, old values are rejected, old cookies/tabs revoked, same UI restores initial values.
- All validation/case/space/double-click/same-value scenarios PASS. Concurrent CAS now PASS 3 rounds (one success, one conflict, successful value wins; restore via page). Cold login one-submit/no-CSRF and course/task/grade navigation + 403/401 PASS.
- New feedback privacy tests **PASS 2/2**: three hidden / three revealed password fields each absent from actual serialized screenshot SVG and structured context; JPEG generated, live DOM value/type unchanged; POST intercepted, no DB write.
- Two first-run logins exceeded a helper's 5-second URL assertion while still submitting. Retested using the repository's normal 30-second navigation budget with request timing: 11 successful instrumented logins completed in **274-410ms**, credentials/session HTTP 200. The original delay is not conclusively explained; no wrong-password response or 30-second hang was reproduced.
- One menu action was obstructed by an existing login-success toast. Mouse moved aside / toast wait helped other cases; focused keyboard Enter also opens the actual menu. No forced click or DOM mutation used. Toast overlay is a preexisting usability limitation, not a new auth regression.

The first-run and targeted JSON summaries are adjacent. Raw DOM error snapshots were removed because even synthetic password field values can appear there; screenshots/SVG values were never persisted. The fixture scripts remain external to this frozen worktree. No production account or data changes were performed by QA.
