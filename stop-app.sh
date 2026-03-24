#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.app-pids"

echo "================================================"
echo " Mental Health Tracker - Stopping Application"
echo "================================================"
echo ""

echo "Stopping servers..."
echo ""

STOPPED=0

if [ -f "$PID_FILE" ]; then
    while read -r pid; do
        if kill "$pid" 2>/dev/null; then
            echo "Stopped process $pid"
            STOPPED=1
        fi
    done < "$PID_FILE"

    rm -f "$PID_FILE"
fi

if [ "$STOPPED" -eq 1 ]; then
    echo ""
    echo "SUCCESS: All servers stopped!"
else
    echo "No running servers found (PID file missing or processes already stopped)."
fi

echo ""
echo "================================================"
echo " Application stopped"
echo "================================================"
echo ""
