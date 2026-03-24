@echo off
echo ================================================
echo  Opening Mental Health Tracker in Browser
echo ================================================
echo.

echo Opening http://localhost:3000 in your default browser...
echo.

start http://localhost:3000

echo.
echo ================================================
echo  Browser should open now!
echo ================================================
echo.
echo If the servers aren't running, please run start-app.bat first.
echo.
timeout /t 3 /nobreak >nul
