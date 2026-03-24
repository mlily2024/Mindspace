@echo off
echo ================================================
echo  Mental Health Tracker - Environment Setup
echo ================================================
echo.

REM Check if .env already exists
if exist "backend\.env" (
    echo WARNING: backend\.env already exists!
    set /p OVERWRITE="Do you want to overwrite it? (y/n): "
    if /i not "%OVERWRITE%"=="y" (
        echo Keeping existing .env file.
        pause
        exit /b 0
    )
)

echo Creating backend\.env file...
echo.

REM Generate random strings for secrets (basic version)
echo Please enter your configuration:
echo.

set /p DB_PASSWORD="Database password: "
echo.

echo Generating secure random keys...
echo.

REM Copy example file
copy "backend\.env.example" "backend\.env" >nul

REM Update the .env file with user input
powershell -Command "(gc backend\.env) -replace 'your_password_here', '%DB_PASSWORD%' | Out-File -encoding ASCII backend\.env"

echo.
echo ================================================
echo IMPORTANT: Manual Configuration Required
echo ================================================
echo.
echo Please edit backend\.env and set these values:
echo.
echo 1. JWT_SECRET - Generate a random 32+ character string
echo    Example: openssl rand -base64 32
echo    Or use: https://randomkeygen.com/
echo.
echo 2. ENCRYPTION_KEY - Generate a random 32+ character string
echo    Example: openssl rand -base64 32
echo    Or use: https://randomkeygen.com/
echo.
echo The file is located at: backend\.env
echo.

set /p OPEN_FILE="Would you like to open the .env file now? (y/n): "
if /i "%OPEN_FILE%"=="y" (
    notepad "backend\.env"
)

echo.
echo After configuring the .env file, you can start the application!
echo.
pause
