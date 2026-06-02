#!/bin/bash
#
# Mindspace — PostgreSQL docker init script.
#
# Mounted into /docker-entrypoint-initdb.d/ in the db service of
# docker-compose.yml. The postgres image's entrypoint executes any
# .sh / .sql files in that directory in alphabetical order ON FIRST
# RUN ONLY (i.e. when the data volume is empty). Subsequent boots
# skip init.
#
# Sequence:
#   1. apply the base schema.sql
#   2. apply every numbered migration in backend/database/migrations/
#      in alphabetical order (001 -> 002 -> ...)
#
# Result: a fresh `docker compose up --build` produces a database
# containing every table the app expects, with zero manual psql work.
#
# To reset (wipe + re-init): `docker compose down -v && docker compose up`

set -euo pipefail

PSQL="psql -v ON_ERROR_STOP=1 --username ${POSTGRES_USER} --dbname ${POSTGRES_DB}"

echo "[mindspace-init] applying base schema.sql ..."
$PSQL -f /db-init/schema.sql
echo "[mindspace-init]   ✓ schema.sql applied"

echo "[mindspace-init] applying migrations in order ..."
shopt -s nullglob
for f in /db-init/migrations/*.sql; do
  name=$(basename "$f")
  echo "[mindspace-init]   running $name ..."
  $PSQL -f "$f"
done
echo "[mindspace-init] all migrations applied."

# Quick sanity report — how many tables now exist.
table_count=$($PSQL -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'")
echo "[mindspace-init] database ready — $table_count tables in public schema."
