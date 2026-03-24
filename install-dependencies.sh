#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================================"
echo " Mental Health Tracker - Installing Dependencies"
echo "================================================"
echo ""

# Check if Node.js is installed
echo "Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "========================================"
    echo "ERROR: Node.js is not installed!"
    echo "========================================"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "  Ubuntu/Debian: sudo apt install nodejs npm"
    echo "  macOS:         brew install node"
    echo ""
    exit 1
fi

echo "Node.js found!"
node --version
echo ""

# Check if npm is installed
echo "Checking for npm..."
if ! command -v npm &> /dev/null; then
    echo ""
    echo "ERROR: npm is not installed!"
    echo "This should come with Node.js."
    echo "Please reinstall Node.js from: https://nodejs.org/"
    echo ""
    exit 1
fi

echo "npm found!"
npm --version
echo ""

echo "================================================"
echo "[1/2] Installing Backend Dependencies"
echo "================================================"
echo ""

# Check if backend folder exists
if [ ! -d "$SCRIPT_DIR/backend" ]; then
    echo "ERROR: Backend folder not found at: $SCRIPT_DIR/backend"
    echo ""
    echo "Please make sure you are running this from the correct folder."
    exit 1
fi

echo "Backend folder found!"
echo "Installing backend packages (this may take 2-3 minutes)..."
echo ""

cd "$SCRIPT_DIR/backend"
npm install

echo ""
echo "========================================"
echo "Backend dependencies installed!"
echo "========================================"
echo ""

echo "================================================"
echo "[2/2] Installing Frontend Dependencies"
echo "================================================"
echo ""

# Check if frontend folder exists
if [ ! -d "$SCRIPT_DIR/frontend" ]; then
    echo "ERROR: Frontend folder not found at: $SCRIPT_DIR/frontend"
    exit 1
fi

echo "Frontend folder found!"
echo "Installing frontend packages (this may take 2-3 minutes)..."
echo ""

cd "$SCRIPT_DIR/frontend"
npm install

echo ""
echo "========================================"
echo "Frontend dependencies installed!"
echo "========================================"
echo ""

cd "$SCRIPT_DIR"

echo "================================================"
echo " Installation Complete!"
echo "================================================"
echo ""
echo "All dependencies have been installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Set up the database (run ./setup-database.sh)"
echo "  2. Configure backend/.env file"
echo "  3. Start the application (run ./start-app.sh)"
echo ""
