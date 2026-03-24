#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.app-pids"

echo "================================================"
echo " Mental Health Tracker - Starting Application"
echo "================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "Node.js found: $(node --version)"
echo ""

# Check if PostgreSQL is running
echo "[0/3] Checking PostgreSQL Database..."
echo ""

if command -v pg_isready &> /dev/null; then
    if pg_isready &> /dev/null; then
        echo "PostgreSQL is running."
    else
        echo "================================================"
        echo " WARNING: PostgreSQL is not running!"
        echo "================================================"
        echo ""
        echo "Please start PostgreSQL:"
        echo "  Ubuntu/Debian: sudo systemctl start postgresql"
        echo "  macOS (Homebrew): brew services start postgresql"
        echo "  macOS (Postgres.app): Open Postgres.app"
        echo ""
        exit 1
    fi
else
    echo "WARNING: pg_isready not found, cannot verify PostgreSQL status."
    echo "Make sure PostgreSQL is running before continuing."
fi

echo ""

# Check dependencies
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
    echo "WARNING: Backend dependencies not installed!"
    echo "Please run ./install-dependencies.sh first"
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo "WARNING: Frontend dependencies not installed!"
    echo "Please run ./install-dependencies.sh first"
    exit 1
fi

# Check if .env exists
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
    echo "WARNING: Backend .env file not found!"
    echo "Please copy backend/.env.example to backend/.env and configure it"
    exit 1
fi

# Clean up any previous PID file
if [ -f "$PID_FILE" ]; then
    echo "Stopping any previously running servers..."
    while read -r pid; do
        kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
    sleep 2
fi

# Start Backend Server
echo "[1/3] Starting Backend Server..."
echo ""

cd "$SCRIPT_DIR/backend"
npm run dev &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"

echo "Backend started (PID: $BACKEND_PID)"
echo "Waiting for backend to initialize..."
sleep 4

# Start Frontend Server
echo ""
echo "[2/3] Starting Frontend Server..."
echo ""

cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >> "$PID_FILE"

echo "Frontend started (PID: $FRONTEND_PID)"

cd "$SCRIPT_DIR"

echo ""
echo "================================================"
echo " Application is starting!"
echo "================================================"
echo ""
echo "Database: PostgreSQL (running)"
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo "Admin:    http://localhost:5173/admin"
echo ""
echo "PIDs saved to $PID_FILE"
echo ""

echo "Waiting for servers to be ready..."
sleep 5

# Open browser (try common Linux/macOS commands)
echo "[3/3] Opening browser..."
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173 2>/dev/null &
elif command -v open &> /dev/null; then
    open http://localhost:5173 2>/dev/null &
else
    echo "Could not open browser automatically."
    echo "Please navigate to http://localhost:5173"
fi

echo ""
echo "================================================"
echo " Application is running!"
echo "================================================"
echo ""
echo "TEST ACCOUNT:"
echo "  Email:    test@test.com"
echo "  Password: test1234"
echo ""
echo "  (Run: node backend/create-test-user.js to create it)"
echo ""
echo "ADMIN PANEL: http://localhost:5173/admin"
echo "  Password: Set ADMIN_PASSWORD in backend/.env (min 12 characters)"
echo ""
echo "To stop the application, run ./stop-app.sh"
echo ""
echo "Press Ctrl+C or run ./stop-app.sh to stop all servers."
echo ""

# Wait for background processes so Ctrl+C can clean them up
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f '$PID_FILE'; echo 'Stopped.'; exit 0" INT TERM

wait
