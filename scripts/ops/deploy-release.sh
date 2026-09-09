#!/usr/bin/env bash
# Used by both GitHub deploy jobs. Runs on the server, never from the local builder.
set -euo pipefail
umask 077
ROOT="$(cd "$1" && pwd)"
ENVIRONMENT="$2"
ARCHIVE="$3"
SHA="$4"
PR_NUMBER="${5:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'full commit SHA required' >&2; exit 2; }
if [[ "$ENVIRONMENT" == production ]]; then
  PROJECT=finsim; APP=app; DB=postgres; COMPOSE=docker-compose.yml; URL=http://127.0.0.1:3000
elif [[ "$ENVIRONMENT" == staging ]]; then
  PROJECT=finsim-staging; APP=staging-app; DB=staging-postgres; COMPOSE=docker-compose.staging.yml; URL=http://127.0.0.1:3001
else exit 2; fi
[[ -f "$ROOT/.env" ]] || { echo 'runtime .env must be bootstrapped first' >&2; exit 1; }
command -v flock >/dev/null
[[ -d /etc/cron.d ]] || { echo 'host cron must be installed before deployment' >&2; exit 1; }
exec 9>"$ROOT/.deploy.lock"
flock -w 3600 9
RELEASE="$(python3 "$SCRIPT_DIR/prepare-release.py" "$ROOT" "$ARCHIVE" "$SHA")"
CANDIDATE="$ROOT/.candidate-$SHA.env"
python3 "$SCRIPT_DIR/sync-env.py" "$ROOT/.env" "$CANDIDATE" "$ROOT" "$SHA" "$ENVIRONMENT" --policy "$RELEASE/lib/ai/text-model-policy.json"
# User-authorized text/grading migration may proceed only after real Flash + Pro generation.
if ! python3 "$SCRIPT_DIR/probe-deepseek.py" "$CANDIDATE" --output "$ROOT/.deepseek-probe-$SHA.json"; then
  rm -f "$CANDIDATE"
  echo 'DeepSeek real completion preflight failed; active config and database unchanged.' >&2
  exit 1
fi
STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
HISTORY="$ROOT/deployment-history/$STAMP"
mkdir -p "$HISTORY"
chmod 700 "$ROOT/deployment-history" "$HISTORY"
mv "$ROOT/.deepseek-probe-$SHA.json" "$HISTORY/deepseek-probe.json"
cp -p "$ROOT/.env" "$HISTORY/runtime.env"
if [[ -f "$ROOT/$COMPOSE" ]]; then cp -L "$ROOT/$COMPOSE" "$HISTORY/compose.yml"; fi
OLD_CURRENT="$(readlink "$ROOT/current" 2>/dev/null || true)"
PROMOTED=false
SUCCESS=false
compose() { docker compose --project-directory "$ROOT" --env-file "$CANDIDATE" -f "$RELEASE/$COMPOSE" -p "$PROJECT" "$@"; }
rollback() {
  result=$?
  if [[ "$SUCCESS" != true ]]; then
    echo 'Deployment failed; preserving database/uploads and restoring prior app configuration.' >&2
    if [[ -f "$HISTORY/settings-migration-receipt.json" ]]; then
      # CAS restore only this migration's unchanged settings; never undo schema/student data.
      compose run --rm -T --no-deps --user root -v "$HISTORY:/private-migration" --entrypoint node "$APP" scripts/ops/migrate-text-ai-settings.mjs --restore-receipt /private-migration/settings-migration-receipt.json > "$HISTORY/settings-restore-result.json" || echo 'Settings CAS restore needs operator inspection.' >&2
    fi
    if [[ "$PROMOTED" == true ]]; then
      cp -p "$HISTORY/runtime.env" "$ROOT/.env"
      if [[ -n "$OLD_CURRENT" ]]; then
        ln -s "$OLD_CURRENT" "$HISTORY/current-restore"; mv -Tf "$HISTORY/current-restore" "$ROOT/current"
      elif [[ -L "$ROOT/current" && "$(readlink "$ROOT/current")" == "$RELEASE" ]]; then
        rm "$ROOT/current"
      fi
      if [[ -f "$HISTORY/compose.yml" ]]; then cp "$HISTORY/compose.yml" "$ROOT/.compose-rollback"; mv -Tf "$ROOT/.compose-rollback" "$ROOT/$COMPOSE"; fi
    fi
    if [[ -f "$ROOT/$COMPOSE" ]]; then
      docker compose --project-directory "$ROOT" --env-file "$ROOT/.env" -f "$ROOT/$COMPOSE" -p "$PROJECT" up -d "$APP" || true
    fi
    echo 'Database migrations are never automatically reversed. Use the saved backup for an explicit recovery decision.' >&2
  fi
  rm -f "$CANDIDATE"
  exit "$result"
}
trap rollback EXIT
compose config --quiet
# Shared staging needs memory released during builds; production keeps serving.
if [[ "$ENVIRONMENT" == staging && -f "$ROOT/$COMPOSE" ]]; then
  docker compose --project-directory "$ROOT" --env-file "$ROOT/.env" -f "$ROOT/$COMPOSE" -p "$PROJECT" stop "$APP"
fi
FINSIM_BUILD_CONTEXT="$RELEASE" compose build "$APP"
compose up -d "$DB"
DB_READY=false
for attempt in {1..30}; do
  if compose exec -T "$DB" pg_isready -U finsim -d finsim >/dev/null 2>&1; then DB_READY=true; break; fi
  sleep 2
done
[[ "$DB_READY" == true ]] || { echo 'database did not become ready before backup' >&2; exit 1; }
cp "$HISTORY/deepseek-probe.json" "$HISTORY/deepseek-probe-prebuild.json"
python3 "$SCRIPT_DIR/probe-deepseek.py" "$CANDIDATE" --output "$HISTORY/deepseek-probe.json" --reuse-if-fresh 300
# A verified full backup is required before the new code can apply migrations.
FINSIM_BACKUP_SOURCE="$RELEASE" bash "$SCRIPT_DIR/backup.sh" "$ROOT" "$ENVIRONMENT" "$CANDIDATE" > "$HISTORY/backup-path"
compose run --rm --no-deps --entrypoint node_modules/.bin/prisma "$APP" migrate deploy
python3 "$SCRIPT_DIR/probe-deepseek.py" "$CANDIDATE" --output "$HISTORY/deepseek-probe.json" --reuse-if-fresh 300
compose run --rm -T --no-deps --user root -v "$HISTORY:/private-migration" --entrypoint node "$APP" scripts/ops/migrate-text-ai-settings.mjs --apply --backup-dir /private-migration --receipt-path /private-migration/settings-migration-receipt.json --probe-result /private-migration/deepseek-probe.json > "$HISTORY/settings-migration-result.json"
# Preserve root entry points used by the existing external health guard.
# Arm rollback before the first mutation, including partial promotion failures.
PROMOTED=true
cp -p "$CANDIDATE" "$ROOT/.env.next"; mv -f "$ROOT/.env.next" "$ROOT/.env"
ln -s "$RELEASE" "$ROOT/.current-next"; mv -Tf "$ROOT/.current-next" "$ROOT/current"
ln -s "current/$COMPOSE" "$ROOT/.compose-next"; mv -Tf "$ROOT/.compose-next" "$ROOT/$COMPOSE"
compose up -d "$APP"
compose exec -T -u root "$APP" sh -lc 'mkdir -p /data/uploads && chown -R 1001:1001 /data/uploads && chmod -R u+rwX /data/uploads'
python3 "$SCRIPT_DIR/verify-ready.py" "$URL" "$SHA"
bash "$SCRIPT_DIR/install-schedule.sh" "$ROOT" "$ENVIRONMENT"
printf '%s\n' "$SHA" > "$ROOT/last-deployed-sha"
if [[ -n "$PR_NUMBER" ]]; then printf '%s\n' "$PR_NUMBER" > "$ROOT/last-deployed-pr"; fi
date -u +%Y-%m-%dT%H:%M:%SZ > "$ROOT/last-deployed-at"
SUCCESS=true
printf 'Deployed %s at %s; database and uploads retained.\n' "$SHA" "$ENVIRONMENT"
