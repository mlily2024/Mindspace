#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================================"
echo " Mental Health Tracker - Database Setup"
echo "================================================"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "ERROR: psql command not found in PATH"
    echo ""
    echo "PostgreSQL might not be installed. Install it with:"
    echo "  Ubuntu/Debian: sudo apt install postgresql postgresql-client"
    echo "  macOS:         brew install postgresql"
    echo "  Fedora/RHEL:   sudo dnf install postgresql-server postgresql"
    echo ""
    exit 1
fi

echo "PostgreSQL found!"
echo ""

# Get database credentials
echo "Please enter your PostgreSQL credentials:"
echo ""

read -p "PostgreSQL username (default: postgres): " DB_USER
DB_USER="${DB_USER:-postgres}"

read -p "Database name (default: mental_health_tracker): " DB_NAME
DB_NAME="${DB_NAME:-mental_health_tracker}"

echo ""
echo "================================================"
echo " Step 1: Creating Database"
echo "================================================"
echo ""

echo "Creating database: $DB_NAME"
echo ""

# Create database (don't exit on error — database may already exist)
if psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" postgres 2>/dev/null; then
    echo "Database created successfully."
else
    echo "Note: If database already exists, this is normal."
    echo "Continuing with schema setup..."
fi

echo ""
echo "================================================"
echo " Step 2: Loading Database Schema"
echo "================================================"
echo ""

if ! psql -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/backend/database/schema.sql"; then
    echo ""
    echo "ERROR: Failed to load database schema!"
    echo "Please check your PostgreSQL credentials and try again."
    exit 1
fi

echo ""
echo "================================================"
echo " Step 3: Running Database Migrations"
echo "================================================"
echo ""

MIGRATION_DIR="$SCRIPT_DIR/backend/database/migrations"

if [ -d "$MIGRATION_DIR" ]; then
    echo "Looking for migrations in: $MIGRATION_DIR"
    echo ""

    # Run migration files in sorted order
    for f in "$MIGRATION_DIR"/*.sql; do
        # Skip if no files match the glob
        [ -e "$f" ] || continue

        echo "Running migration: $(basename "$f")"
        if psql -U "$DB_USER" -d "$DB_NAME" -f "$f" 2>/dev/null; then
            echo "SUCCESS: $(basename "$f") applied"
        else
            echo "WARNING: $(basename "$f") had errors (may already be applied)"
        fi
        echo ""
    done

    echo "All migrations processed!"
else
    echo "No migrations folder found, skipping..."
fi

echo ""
echo "================================================"
echo " Database Setup Complete!"
echo "================================================"
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""
echo "Next steps:"
echo "  1. Update backend/.env with your database credentials:"
echo "     DB_NAME=$DB_NAME"
echo "     DB_USER=$DB_USER"
echo "     DB_PASSWORD=your_password"
echo ""
echo "  2. Generate secure keys for backend/.env:"
echo "     JWT_SECRET=(32+ random characters)"
echo "     ENCRYPTION_KEY=(32+ random characters)"
echo ""
echo "  3. Start the application (run ./start-app.sh)"
echo ""
