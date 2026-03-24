@echo off
echo ================================================
echo  Mental Health Tracker - Starting Application
echo ================================================
echo.

REM Kill any existing Node processes to free up ports
echo Stopping any existing servers...
taskkill /F /IM node.exe >nul 2>nul
timeout /t 2 /nobreak >nul
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM ================================================
REM  Step 0: Start PostgreSQL Database
REM ================================================
echo [0/3] Checking PostgreSQL Database...
echo.

REM Try to find and start PostgreSQL service
REM Common service names: postgresql-x64-14, postgresql-x64-15, postgresql-x64-16, postgresql-x64-17, postgresql-x64-18
set PG_STARTED=0

REM Check PostgreSQL 18 first (newest)
sc query postgresql-x64-18 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    sc query postgresql-x64-18 | find "RUNNING" >nul
    if %ERRORLEVEL% EQU 0 (
        echo PostgreSQL 18 is already running.
        set PG_STARTED=1
    ) else (
        echo Starting PostgreSQL 18...
        net start postgresql-x64-18 >nul 2>nul
        if %ERRORLEVEL% EQU 0 (
            echo PostgreSQL 18 started successfully.
            set PG_STARTED=1
        )
    )
)

if %PG_STARTED% EQU 0 (
    sc query postgresql-x64-17 >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        sc query postgresql-x64-17 | find "RUNNING" >nul
        if %ERRORLEVEL% EQU 0 (
            echo PostgreSQL 17 is already running.
            set PG_STARTED=1
        ) else (
            echo Starting PostgreSQL 17...
            net start postgresql-x64-17 >nul 2>nul
            if %ERRORLEVEL% EQU 0 (
                echo PostgreSQL 17 started successfully.
                set PG_STARTED=1
            )
        )
    )
)

REM Check if PostgreSQL 16 is already running
if %PG_STARTED% EQU 0 (
    sc query postgresql-x64-16 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    sc query postgresql-x64-16 | find "RUNNING" >nul
    if %ERRORLEVEL% EQU 0 (
        echo PostgreSQL 16 is already running.
        set PG_STARTED=1
    ) else (
        echo Starting PostgreSQL 16...
        net start postgresql-x64-16 >nul 2>nul
        if %ERRORLEVEL% EQU 0 (
            echo PostgreSQL 16 started successfully.
            set PG_STARTED=1
        )
    )
)

if %PG_STARTED% EQU 0 (
    sc query postgresql-x64-15 >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        sc query postgresql-x64-15 | find "RUNNING" >nul
        if %ERRORLEVEL% EQU 0 (
            echo PostgreSQL 15 is already running.
            set PG_STARTED=1
        ) else (
            echo Starting PostgreSQL 15...
            net start postgresql-x64-15 >nul 2>nul
            if %ERRORLEVEL% EQU 0 (
                echo PostgreSQL 15 started successfully.
                set PG_STARTED=1
            )
        )
    )
)

if %PG_STARTED% EQU 0 (
    sc query postgresql-x64-14 >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        sc query postgresql-x64-14 | find "RUNNING" >nul
        if %ERRORLEVEL% EQU 0 (
            echo PostgreSQL 14 is already running.
            set PG_STARTED=1
        ) else (
            echo Starting PostgreSQL 14...
            net start postgresql-x64-14 >nul 2>nul
            if %ERRORLEVEL% EQU 0 (
                echo PostgreSQL 14 started successfully.
                set PG_STARTED=1
            )
        )
    )
)

if %PG_STARTED% EQU 0 (
    sc query postgresql >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        sc query postgresql | find "RUNNING" >nul
        if %ERRORLEVEL% EQU 0 (
            echo PostgreSQL is already running.
            set PG_STARTED=1
        ) else (
            echo Starting PostgreSQL...
            net start postgresql >nul 2>nul
            if %ERRORLEVEL% EQU 0 (
                echo PostgreSQL started successfully.
                set PG_STARTED=1
            )
        )
    )
)

if %PG_STARTED% EQU 0 (
    echo.
    echo ================================================
    echo  WARNING: Could not start PostgreSQL!
    echo ================================================
    echo.
    echo Please start PostgreSQL manually:
    echo   1. Open Windows Services (Win + R, type: services.msc)
    echo   2. Find "postgresql" service
    echo   3. Right-click and select "Start"
    echo.
    echo Or run this script as Administrator to auto-start PostgreSQL.
    echo.
    pause
    exit /b 1
)

echo.

REM ================================================
REM  Check Dependencies
REM ================================================
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

REM ================================================
REM  Start Backend Server
REM ================================================
echo [1/3] Starting Backend Server...
echo.
start "Mental Health Tracker - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Waiting for backend to initialize...
timeout /t 4 /nobreak >nul

REM ================================================
REM  Start Frontend Server
REM ================================================
echo.
echo [2/3] Starting Frontend Server...
echo.
start "Mental Health Tracker - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ================================================
echo  Application is starting!
echo ================================================
echo.
echo Database: PostgreSQL (running)
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo Admin:    http://localhost:5173/admin
echo.
echo Three components are now running:
echo   1. PostgreSQL Database
echo   2. Backend Server (API)
echo   3. Frontend Server (Website)
echo.

echo Waiting for servers to be ready...
timeout /t 5 /nobreak >nul

echo [3/3] Opening browser...
start "" http://localhost:5173

echo.
echo ================================================
echo  Application is running!
echo ================================================
echo.
echo TEST ACCOUNT:
echo   Email:    test@test.com
echo   Password: test1234
echo.
echo   (Run: node backend/create-test-user.js to create it)
echo.
echo ADMIN PANEL: http://localhost:5173/admin
echo   Password: Set ADMIN_PASSWORD in backend/.env (min 12 characters)
echo.
echo To stop the application, close the server windows or run stop-app.bat
echo.
pause
