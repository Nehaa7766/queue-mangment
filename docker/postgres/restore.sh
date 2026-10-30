#!/usr/bin/env sh
# Restore a dump made by backup.sh into a named database.
#
# Usage: sh docker/postgres/restore.sh <dump-file> <database> [--force]
#
# Without --force it refuses to touch a database that already exists, so a
# drill can never overwrite live data by accident. With --force it drops the
# database (disconnecting its users) and recreates it from the dump.
set -eu

USAGE="Usage: restore.sh <dump-file> <database> [--force]"
FILE="${1:?$USAGE}"
DB="${2:?$USAGE}"
FORCE="${3:-}"

if [ ! -s "$FILE" ]; then
  echo "No dump at $FILE." >&2
  exit 1
fi

case "$DB" in
  "" | *[!a-z0-9_]*)
    echo "Database names may only use a-z, 0-9 and _." >&2
    exit 1
    ;;
esac

sql() {
  docker compose exec -T db psql -U queuecare -d postgres -v ON_ERROR_STOP=1 -tAc "$1"
}

if [ "$(sql "SELECT 1 FROM pg_database WHERE datname = '$DB'")" = "1" ]; then
  if [ "$FORCE" != "--force" ]; then
    echo "Database $DB already exists. Re-run with --force to replace it." >&2
    exit 1
  fi
  sql "DROP DATABASE \"$DB\" WITH (FORCE)"
fi

sql "CREATE DATABASE \"$DB\""
docker compose exec -T db pg_restore -U queuecare -d "$DB" --no-owner --exit-on-error < "$FILE"

echo "Restored $FILE into $DB."
