@echo off
echo ================================================
echo  Mental Health Tracker - Stopping Application
echo ================================================
echo.

echo Stopping Node.js processes...
echo.

REM Kill all node processes (this will stop both backend and frontend)
taskkill /F /IM node.exe >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: All servers stopped!
) else (
    echo No running servers found.
)

echo.
echo ================================================
echo  Application stopped
echo ================================================
echo.
pause
