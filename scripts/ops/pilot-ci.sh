#!/usr/bin/env bash
# CI-only owned resources; refuses existing ports and never touches shared databases.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
command -v setsid >/dev/null
python3 - <<'PY'
import socket
for port in [55439,3107,3189]:
    connection=socket.socket();connection.settimeout(0.3)
    try:
        if connection.connect_ex(('127.0.0.1',port))==0:raise SystemExit('pilot port already in use; refusing to disturb an existing service: '+str(port))
    finally:connection.close()
PY
mkdir -p .harness/state/pilot-ci
DB_ID=''; APP_PID=''; MOCK_PID=''
cleanup() {
  result=$?
  [[ -z "$APP_PID" ]] || kill -TERM -- "-$APP_PID" 2>/dev/null || true
  [[ -z "$MOCK_PID" ]] || kill -TERM -- "-$MOCK_PID" 2>/dev/null || true
  [[ -z "$DB_ID" ]] || docker rm -f "$DB_ID" >/dev/null 2>&1 || true
  exit "$result"
}
trap cleanup EXIT
DB_PASSWORD="$(openssl rand -hex 20)"
export DATABASE_URL="postgresql://finsim:$DB_PASSWORD@127.0.0.1:55439/finsim_pilot"
export PILOT_DATABASE_URL="$DATABASE_URL"
export AUTH_SECRET="$(openssl rand -hex 32)" NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_TRUST_HOST=true ADMIN_KEY=pilot-ci
export APP_GIT_SHA="$(git rev-parse HEAD)" APP_ENV=test PLAYWRIGHT_EXPECTED_SHA="$(git rev-parse HEAD)"
export PILOT_BASE_URL=http://127.0.0.1:3107 FILE_STORAGE_PATH="$ROOT/.harness/state/pilot-ci/uploads"
export CRON_TOKEN="$(openssl rand -hex 20)" DEEPSEEK_API_KEY=pilot-fixture DEEPSEEK_BASE_URL=http://127.0.0.1:3189/v1
export AI_RATE_LIMIT_ENABLED=false
# Exercise the real DeepSeek app path using its policy, with transport only on loopback.
while IFS='=' read -r key value; do export "$key=$value"; done < <(python3 scripts/ops/text_policy.py lib/ai/text-model-policy.json)
DB_ID="$(docker create --name "finsim-pilot-ci-${GITHUB_RUN_ID:-local}-$$" -p 127.0.0.1:55439:5432 -e POSTGRES_DB=finsim_pilot -e POSTGRES_USER=finsim -e POSTGRES_PASSWORD="$DB_PASSWORD" postgres:16-alpine)"
docker start "$DB_ID" >/dev/null
for attempt in {1..30}; do
  if docker exec "$DB_ID" pg_isready -U finsim -d finsim_pilot >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$DB_ID" pg_isready -U finsim -d finsim_pilot >/dev/null
npx prisma generate
npx prisma migrate deploy
npm run db:seed
setsid node tests/e2e/pilot/mock-ai-server.mjs > .harness/state/pilot-ci/mock.log 2>&1 & MOCK_PID=$!
setsid node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 -p 3107 > .harness/state/pilot-ci/app.log 2>&1 & APP_PID=$!
python3 scripts/ops/verify-ready.py "$PILOT_BASE_URL" "$APP_GIT_SHA"
npx playwright test --config=playwright.pilot.config.ts
