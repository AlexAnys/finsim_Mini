#!/usr/bin/env bash
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
printf 'FinSim: coordinator → builder → independent QA. Current task binding:\n'
python3 "$ROOT/.harness/scripts/task_state.py" --root "$ROOT" show
printf 'Use spec_path above. No current task means do not resume old spec.md.\n'
