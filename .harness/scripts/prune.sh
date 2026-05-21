#!/usr/bin/env bash
# Mechanical archiver for .harness/ — run after progress.tsv append or unit close.
# Idempotent. Reads .harness/, writes .harness/archive/. Bash 3.2 compatible (macOS).
#
# What it does:
#   1. progress.tsv > 30 rows → archive head, keep tail 30
#   2. reports/ for any unit with PASS verdict + non-dash commit → move to archive/units/{unit}/
#   3. lint last 10 rows of progress.tsv short_desc length (warn only, no hard cap)
#
# What it does NOT do (judgment required, see archive/README.md):
#   - HANDOFF.md archiving (semantic — coordinator decides which sessions to fold)
#   - lessons.md archiving (semantic — coordinator decides which entries are superseded)

set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
HARNESS="$ROOT/.harness"
ARCHIVE="$HARNESS/archive"
PROGRESS="$HARNESS/progress.tsv"
ARCH_PROGRESS="$ARCHIVE/progress.tsv"
MANIFEST="$ARCHIVE/manifest.tsv"

[ -f "$PROGRESS" ] || { echo "[prune] no progress.tsv, skip"; exit 0; }
mkdir -p "$ARCHIVE/units" "$ARCHIVE/handoff"

# ─── 1. progress.tsv rolling (keep tail 30) ─────────────────────────────
total=$(wc -l < "$PROGRESS" | tr -d ' ')
KEEP=30
if [ "$total" -gt "$KEEP" ]; then
  to_archive=$((total - KEEP))
  echo "[prune] progress.tsv $total rows → archive $to_archive, keep $KEEP"
  head -n "$to_archive" "$PROGRESS" >> "$ARCH_PROGRESS"
  tail -n "$KEEP" "$PROGRESS" > "$PROGRESS.tmp"
  mv "$PROGRESS.tmp" "$PROGRESS"
fi

# ─── 2. reports/ unit archiving ────────────────────────────────────────
# Look at all known progress rows (current + archived). Find units with at least
# one PASS verdict AND a non-dash commit column. Move their reports.
mkdir -p "$ARCHIVE/units"
TMP_PROG=$(mktemp)
cat "$PROGRESS" > "$TMP_PROG"
[ -f "$ARCH_PROGRESS" ] && cat "$ARCH_PROGRESS" >> "$TMP_PROG"

# unit names with PASS + non-dash commit
units_done=$(awk -F'\t' '$4=="PASS" && $7!="-" && $7!="" && $7!=null { print $2 }' "$TMP_PROG" | sort -u)

moved_any=0
for unit in $units_done; do
  # Find matching report files in reports/
  matches=""
  for f in "$HARNESS/reports/build_${unit}_"*.md "$HARNESS/reports/qa_${unit}_"*.md; do
    [ -f "$f" ] || continue
    matches="$matches $f"
  done
  [ -z "$matches" ] && continue

  mkdir -p "$ARCHIVE/units/$unit"
  commit=$(awk -F'\t' -v u="$unit" '$2==u && $7!="-" && $7!="" { print $7; exit }' "$TMP_PROG")
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  for f in $matches; do
    base=$(basename "$f")
    mv "$f" "$ARCHIVE/units/$unit/$base"
    printf '%s\t%s\treports/%s\t%s\t%s\t%s\n' \
      "$ts" "$unit" "$base" "$commit" "$base" "auto-prune" >> "$MANIFEST"
    echo "[prune] moved $unit/$base (commit $commit)"
    moved_any=1
  done
done

rm -f "$TMP_PROG"
[ "$moved_any" = "0" ] && echo "[prune] no reports to archive"

# ─── 3. lint progress.tsv short_desc length (last 10 rows) ─────────────
# No hard cap. Just flag obvious outliers (>500 chars) and report avg.
echo "[lint] progress.tsv last 10 rows short_desc:"
tail -n 10 "$PROGRESS" 2>/dev/null | awk -F'\t' '
{
  n = length($6)
  total += n
  count++
  if (n > 500) printf "  WARN: row %d has %d chars (consider trimming, see STYLE.md)\n", NR, n
}
END {
  if (count > 0) {
    printf "  avg: %d chars over %d rows (sanity check only, no hard limit)\n", total/count, count
  }
}'

echo "[prune] done"
