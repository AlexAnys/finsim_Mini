# Pilot UI / API / database tests

These are real Chromium → local Next app → isolated PostgreSQL tests. Only the external AI transport is a loopback fixture; they do not measure teaching accuracy or prove that a real provider/key works.

The suite requires app `http://127.0.0.1:3107`, database `127.0.0.1:55439/finsim_pilot` through `PILOT_DATABASE_URL`, and the mock server on `127.0.0.1:3189`. It rejects other app ports/databases and checks the application's non-secret database identity hash before creating data. Each test creates its own uniquely named course/task fixtures; cleanup checks ownership before removing them. Audit records and synthetic uploads may remain in a manually managed local test database/directory; CI removes its entire owned database container and ephemeral workspace.

After starting the local app with DEEPSEEK_BASE_URL=http://127.0.0.1:3189/v1 and a synthetic key:

```bash
node tests/e2e/pilot/mock-ai-server.mjs
# In another shell, set PILOT_DATABASE_URL to the isolated database URL.
npx playwright test --config=playwright.pilot.config.ts
```

For formal acceptance, freeze the commit and start the app with APP_GIT_SHA equal to that commit. Set PLAYWRIGHT_EXPECTED_SHA to the same SHA. The suite checks readiness and runtime routing before/after testing. Development runs remain explicitly WIP.

GitHub quality runs `scripts/ops/pilot-ci.sh` only for the full route. The script refuses occupied ports, creates an isolated container, seeds synthetic accounts, starts owned process groups for Next and the mock, then tears down only those resources. Pure docs do not install browsers, start an app or create a database. Staging retains its own real deployment and existing smoke checks.
