@echo off
title Mental Health Tracker - Installing Dependencies

echo ================================================
echo  Mental Health Tracker - Installing Dependencies
echo ================================================
echo.

REM Store the script directory
set "SCRIPT_DIR=%~dp0"
echo Script directory: %SCRIPT_DIR%
echo.

REM Check if Node.js is installed
echo Checking for Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo ERROR: Node.js is not installed!
    echo ========================================
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS (Long Term Support) version
    echo.
    echo After installing Node.js:
    echo   1. Restart your computer
    echo   2. Run this script again
    echo.
    pause
    exit /b 1
)

echo Node.js found!
node --version
echo.

REM Check if npm is installed
echo Checking for npm...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: npm is not installed!
    echo This should come with Node.js
    echo Please reinstall Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo npm found!
npm --version
echo.

echo ================================================
echo [1/2] Installing Backend Dependencies
echo ================================================
echo.

REM Check if backend folder exists
if not exist "%SCRIPT_DIR%backend" (
    echo ERROR: Backend folder not found at: %SCRIPT_DIR%backend
    echo.
    echo Please make sure you are running this from the correct folder.
    echo Expected location: Mental Health tracker App\install-dependencies.bat
    echo.
    pause
    exit /b 1
)

echo Backend folder found!
echo Changing to backend directory...
cd /d "%SCRIPT_DIR%backend"

echo Current directory: %CD%
echo.

echo Installing backend packages (this may take 2-3 minutes)...
echo Please wait...
echo.

call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo ERROR: Backend installation failed!
    echo ========================================
    echo.
    echo Common solutions:
    echo   1. Check your internet connection
    echo   2. Delete backend\node_modules folder and try again
    echo   3. Run Command Prompt as Administrator
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Backend dependencies installed! ✓
echo ========================================
echo.

echo ================================================
echo [2/2] Installing Frontend Dependencies
echo ================================================
echo.

REM Check if frontend folder exists
if not exist "%SCRIPT_DIR%frontend" (
    echo ERROR: Frontend folder not found at: %SCRIPT_DIR%frontend
    echo.
    pause
    exit /b 1
)

echo Frontend folder found!
echo Changing to frontend directory...
cd /d "%SCRIPT_DIR%frontend"

echo Current directory: %CD%
echo.

echo Installing frontend packages (this may take 2-3 minutes)...
echo Please wait...
echo.

call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo ERROR: Frontend installation failed!
    echo ========================================
    echo.
    echo Common solutions:
    echo   1. Check your internet connection
    echo   2. Delete frontend\node_modules folder and try again
    echo   3. Run Command Prompt as Administrator
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Frontend dependencies installed! ✓
echo ========================================
echo.

cd /d "%SCRIPT_DIR%"

echo ================================================
echo  Installation Complete! ✓
echo ================================================
echo.
echo All dependencies have been installed successfully!
echo.
echo Next steps:
echo   1. Set up the database (run setup-database.bat)
echo   2. Configure backend\.env file (run setup-env.bat)
echo   3. Start the application (run start-app.bat)
echo.
echo Press any key to close this window...
pause >nul
