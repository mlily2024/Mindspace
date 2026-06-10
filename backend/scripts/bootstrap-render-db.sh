#!/bin/sh
#
# Bootstrap a fresh PostgreSQL database for the Render demo deployment.
#
# Uses psql (installed in the backend Dockerfile via `apk add postgresql-client`)
# because it handles multi-statement SQL with dollar-quoted function bodies
# correctly — Node's pg client.query() chokes on those when concatenated.
#
# Applies database/schema.sql and every database/migrations/*.sql file in
# numeric/alphabetical order. Schema and migrations are idempotent
# (CREATE TABLE IF NOT EXISTS) so re-running is safe.
#
# Designed to run as the AUTO_MIGRATE=true branch of the Dockerfile CMD,
# but invocable manually if needed (e.g. local debugging against a remote
# Postgres):
#   DATABASE_URL=postgres://... sh backend/scripts/bootstrap-render-db.sh
#
# Exit codes:
#   0  schema + all migrations applied (or already present)
#   1  failure (psql error tail logged to stderr)

set -e

if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set. Refusing to run." >&2
    exit 1
fi

# Force SSL for Render-hosted Postgres. Safe no-op when the URL already has
# sslmode= set, since command-line PGSSLMODE has lower precedence than the URL.
export PGSSLMODE="${PGSSLMODE:-require}"

# psql flags: -v ON_ERROR_STOP=1 so we abort on the first SQL error rather
# than logging then continuing. --quiet keeps the noise low; warnings still
# print but successful CREATEs don't spam every NOTICE.
PSQL_OPTS="-v ON_ERROR_STOP=1 --quiet --set ON_ERROR_STOP=on --no-psqlrc"

echo "Bootstrapping Render demo database..."

# Optional one-shot full wipe: DROP SCHEMA public CASCADE then recreate.
# Use this to recover from a partial-state DB left by an earlier failed
# bootstrap. DESTRUCTIVE — wipes all data in the public schema. Set the
# BOOTSTRAP_DROP_ALL env var to "true" for ONE deploy to trigger the wipe,
# then remove the env var so subsequent deploys don't keep wiping.
if [ "$BOOTSTRAP_DROP_ALL" = "true" ]; then
    echo "  ⚠ BOOTSTRAP_DROP_ALL=true — wiping public schema before re-bootstrap"
    psql $PSQL_OPTS "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;" >/dev/null
    echo "  [ok]   public schema wiped + recreated"
fi

# Schema first (creates base tables + the update_updated_at_column trigger
# function with $$ ... $$ body that pg's Node client can't handle).
if [ -f /app/database/schema.sql ]; then
    echo "  Applying schema.sql..."
    psql $PSQL_OPTS "$DATABASE_URL" -f /app/database/schema.sql >/dev/null
    echo "  [ok]   schema.sql"
else
    echo "  [warn] /app/database/schema.sql not found; expecting migrations to be self-contained" >&2
fi

# Numbered migrations in order
MIGRATION_COUNT=0
for migration in /app/database/migrations/*.sql; do
    if [ -f "$migration" ]; then
        name="$(basename "$migration")"
        echo "  Applying $name..."
        psql $PSQL_OPTS "$DATABASE_URL" -f "$migration" >/dev/null
        echo "  [ok]   migrations/$name"
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
    fi
done

echo "Bootstrap complete: schema + $MIGRATION_COUNT migrations applied."
