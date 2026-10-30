#!/usr/bin/env sh
# Back up one QueueCare database to a timestamped, compressed dump.
#
# Usage: sh docker/postgres/backup.sh [database] [output-dir]
#   database    default queuecare_dev
#   output-dir  default ./backups (keep it out of git)
#
# Run from the repository root while `docker compose` has the db service up.
# Restore with docker/postgres/restore.sh (docs/RUNBOOK.md, "Restore drill").
set -eu

DB="${1:-queuecare_dev}"
OUT_DIR="${2:-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/$DB-$STAMP.dump"

case "$DB" in
  "" | *[!a-z0-9_]*)
    echo "Database names may only use a-z, 0-9 and _." >&2
    exit 1
    ;;
esac

mkdir -p "$OUT_DIR"

# -T: no TTY, so the binary dump passes through untouched.
# -Fc: custom format, compressed, restorable with pg_restore.
if ! docker compose exec -T db pg_dump -U queuecare -d "$DB" -Fc --no-owner > "$FILE"; then
  rm -f "$FILE"
  echo "Backup of $DB failed." >&2
  exit 1
fi

if [ ! -s "$FILE" ]; then
  rm -f "$FILE"
  echo "Backup of $DB produced an empty file." >&2
  exit 1
fi

echo "$FILE"
