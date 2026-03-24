@echo off
echo ================================================
echo  Mental Health Tracker - Developer Panel
echo ================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "backend\node_modules" (
    echo WARNING: Backend dependencies not installed!
    echo Please run install-dependencies.bat first
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo WARNING: Frontend dependencies not installed!
    echo Please run install-dependencies.bat first
    pause
    exit /b 1
)

REM Check if .env exists
if not exist "backend\.env" (
    echo WARNING: Backend .env file not found!
    echo Please copy backend\.env.example to backend\.env and configure it
    pause
    exit /b 1
)

echo [1/2] Starting Backend Server...
start "Mental Health Tracker - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Starting Frontend Server...
start "Mental Health Tracker - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Waiting for servers to be ready...
timeout /t 5 /nobreak >nul

echo Opening Developer Panel...
start "" http://localhost:3000/admin

echo.
echo ================================================
echo  Developer Panel is starting!
echo ================================================
echo.
echo Admin URL:  http://localhost:3000/admin
echo Password:   Set ADMIN_PASSWORD in backend/.env (min 12 characters)
echo.
echo Backend:    http://localhost:5000
echo Frontend:   http://localhost:3000
echo.
echo To stop: close both server windows or run stop-app.bat
echo.
pause
