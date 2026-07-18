#!/usr/bin/env bash
# SessionStart hook — prints harness state into the new session context.
# Replaces the old inline `cat HANDOFF.md` which dumped 26KB / 440 lines.
# New: HANDOFF shows only most-recent session (awk before 2nd "## "), lessons shows active headers.

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"

printf '## Finsim Harness Active\n'
printf 'Roles: coordinator(plan) -> builder(impl) -> qa(verify, /qa-only for UI)\n'
printf 'Auto-QA: Stop hook (diff-guarded); Lessons: r2+ PASS triggers warn\n'
printf -- '---\n'

printf 'Recent commits:\n'
git -C "$ROOT" log --oneline -5 2>/dev/null || true
printf -- '---\n'

if [ -f "$ROOT/.harness/progress.tsv" ]; then
  printf 'Last QA rounds (progress.tsv tail):\n'
  tail -5 "$ROOT/.harness/progress.tsv" 2>/dev/null
  printf -- '---\n'
fi

printf 'Current spec (.harness/spec.md tail):\n'
tail -20 "$ROOT/.harness/spec.md" 2>/dev/null || printf '(no spec)\n'

if [ -f "$ROOT/.harness/HANDOFF.md" ]; then
  printf -- '---\n'
  printf 'HANDOFF (most recent session only; older sessions in .harness/archive/handoff/):\n'
  awk '/^## / { count++; if (count > 1) exit } { print }' "$ROOT/.harness/HANDOFF.md" 2>/dev/null
fi

if [ -f "$ROOT/.harness/lessons.md" ]; then
  printf -- '---\n'
  printf 'Active lessons summary (lessons.md, full content via Read .harness/lessons.md):\n'
  awk '/^## L-/ { hdr=$0 } /Status.*active/ { print hdr }' "$ROOT/.harness/lessons.md" 2>/dev/null || true
fi
