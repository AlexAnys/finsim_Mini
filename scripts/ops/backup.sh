#!/usr/bin/env bash
# Full DB + uploads snapshot. Never prints secrets or restores production.
set -euo pipefail
umask 077
ROOT="$(cd "$1" && pwd)"
ENVIRONMENT="${2:-production}"
ENV_FILE="${3:-$ROOT/.env}"
if [[ "$ENVIRONMENT" == production ]]; then
  PROJECT=finsim; APP=app; PG=finsim-postgres; COMPOSE=docker-compose.yml
elif [[ "$ENVIRONMENT" == staging ]]; then
  PROJECT=finsim-staging; APP=staging-app; PG=finsim-staging-postgres; COMPOSE=docker-compose.staging.yml
else exit 2; fi
SOURCE="${FINSIM_BACKUP_SOURCE:-$ROOT/current}"
[[ -f "$SOURCE/$COMPOSE" ]] || SOURCE="$ROOT"
mkdir -p "$ROOT/backups"
chmod 700 "$ROOT/backups"
exec 8>"$ROOT/.backup.lock"
flock -n 8 || { echo 'backup already running' >&2; exit 1; }
STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
TEMP="$ROOT/backups/.pending-$STAMP"
mkdir "$TEMP"
trap 'rm -rf "$TEMP"' EXIT
docker exec "$PG" pg_dump -U finsim -d finsim -Fc --no-owner --no-acl > "$TEMP/database.dump"
test -s "$TEMP/database.dump"
docker exec -i "$PG" pg_restore --list < "$TEMP/database.dump" > "$TEMP/database.list"
docker compose --project-directory "$ROOT" --env-file "$ENV_FILE" -f "$SOURCE/$COMPOSE" -p "$PROJECT" \
  run --rm --no-deps --entrypoint sh "$APP" -c 'tar -C /data/uploads -czf - .' > "$TEMP/uploads.tar.gz"
gzip -t "$TEMP/uploads.tar.gz"
(cd "$TEMP" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
cp "$ENV_FILE" "$TEMP/runtime.env"
printf '%s\n' "$ENVIRONMENT" > "$TEMP/environment"
mv "$TEMP" "$ROOT/backups/$STAMP"
printf '%s\n' "$ROOT/backups/$STAMP"
# No automatic deletion: retention/off-host copies are explicit operator policy.
