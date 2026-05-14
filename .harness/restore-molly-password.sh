#!/usr/bin/env bash
# Restore molly@qq.com password to original hash
# v2 fix: use SQL file (heredoc) instead of psql -c flag to avoid bash $2b/$12 interpolation
set -e
HASH=$(cat "$(dirname "$0")/molly-original-hash.txt")
SQL_FILE=$(mktemp)
cat > "$SQL_FILE" <<SQLEOF
UPDATE "User" SET "passwordHash" = '${HASH}' WHERE email = 'molly@qq.com' RETURNING email, length("passwordHash");
SQLEOF
docker exec -i acc4fef29d82_finsim-postgres psql -U finsim -d finsim < "$SQL_FILE"
rm "$SQL_FILE"
echo "Molly password restored to original (expected length 60)"
