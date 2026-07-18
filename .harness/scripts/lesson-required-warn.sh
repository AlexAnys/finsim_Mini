#!/usr/bin/env bash
# PostToolUse hook — warn-only (never blocks).
# Trigger: progress.tsv last row is r2+ PASS but lessons.md has no entry dated today.
# Throttled: only warns once per 5 min (via /tmp file).

PROG="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}/.harness/progress.tsv"
LESS="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}/.harness/lessons.md"

[ -f "$PROG" ] || exit 0

LAST=$(tail -1 "$PROG" 2>/dev/null)
echo "$LAST" | awk -F'\t' '$3 ~ /^r[2-9]/ && $4=="PASS"' | grep -q . || exit 0

TODAY=$(date -u +%Y-%m-%d)
grep -q "$TODAY" "$LESS" 2>/dev/null && exit 0

THROTTLE="/tmp/finsim-harness-lesson-warn-${USER:-x}"
NOW=$(date +%s)
if [ -f "$THROTTLE" ]; then
  LW=$(cat "$THROTTLE" 2>/dev/null)
  if [ -n "$LW" ] && [ "$((NOW - LW))" -lt 300 ]; then exit 0; fi
fi
echo "$NOW" > "$THROTTLE"

printf '[WARN] r2+ PASS in progress.tsv last row but no lessons.md entry dated %s.\n' "$TODAY" >&2
printf '       Append a lesson (Symptom/Root cause/Detection/Prevention/Commit) — see .harness/lessons.md schema + .harness/STYLE.md.\n' >&2
exit 0
