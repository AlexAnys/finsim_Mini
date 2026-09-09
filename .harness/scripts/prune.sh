#!/usr/bin/env bash
set -euo pipefail
# Preview by default; --apply copies the bound report of the completed task.
# Never rewrites legacy history, removes originals or overwrites archive files.
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
exec python3 "$ROOT/.harness/scripts/task_state.py" --root "$ROOT" archive "$@"
