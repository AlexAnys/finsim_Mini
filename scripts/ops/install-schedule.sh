#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$1" && pwd)"
ENVIRONMENT="$2"
[[ "$ROOT" == /opt/finsim || "$ROOT" == /opt/finsim-staging ]] || { echo 'unexpected scheduler root' >&2; exit 2; }
[[ "$ENVIRONMENT" == production || "$ENVIRONMENT" == staging ]] || exit 2
TASK="finsim-$ENVIRONMENT"
TEMP="$(mktemp)"
trap 'rm -f "$TEMP"' EXIT
cat > "$TEMP" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/2 * * * * root python3 $ROOT/current/scripts/ops/cron.py $ROOT $ENVIRONMENT frequent >> $ROOT/cron.log 2>&1
15 3 * * * root bash $ROOT/current/scripts/ops/backup.sh $ROOT $ENVIRONMENT >> $ROOT/backup.log 2>&1
EOF
# Weekly AI generation is production-only; staging runs only explicit operator tests.
if [[ "$ENVIRONMENT" == production ]]; then
  printf '30 3 * * 1 root python3 %s/current/scripts/ops/cron.py %s production weekly >> %s/cron.log 2>&1\n' "$ROOT" "$ROOT" "$ROOT" >> "$TEMP"
fi
install -m 0644 "$TEMP" "/etc/cron.d/$TASK"
touch "$ROOT/cron.log" "$ROOT/backup.log"
chmod 600 "$ROOT/cron.log" "$ROOT/backup.log"
# Retention applies only to operational logs, never backup data.
cat > "/etc/logrotate.d/$TASK" <<EOF
$ROOT/cron.log $ROOT/backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
  create 0600 root root
}
EOF
