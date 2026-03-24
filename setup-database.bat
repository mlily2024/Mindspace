@echo off
echo ================================================
echo  Mental Health Tracker - Database Setup
echo ================================================
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: psql command not found in PATH
    echo.
    echo PostgreSQL might not be installed, or it's not in your PATH.
    echo.
    echo If PostgreSQL is installed, you can add it to PATH:
    echo   Common location: C:\Program Files\PostgreSQL\14\bin
    echo.
    echo Or run this script from the PostgreSQL bin directory.
    echo.
    set /p PSQL_PATH="Enter full path to psql.exe (or press Enter to exit): "
    if "%PSQL_PATH%"=="" (
        echo Exiting...
        pause
        exit /b 1
    )
) else (
    set PSQL_PATH=psql
)

echo.
echo PostgreSQL found!
echo.

REM Get database credentials
echo Please enter your PostgreSQL credentials:
echo.
set /p DB_USER="PostgreSQL username (default: postgres): "
if "%DB_USER%"=="" set DB_USER=postgres

set /p DB_NAME="Database name (default: mental_health_tracker): "
if "%DB_NAME%"=="" set DB_NAME=mental_health_tracker

echo.
echo ================================================
echo Step 1: Creating Database
echo ================================================
echo.

echo Creating database: %DB_NAME%
echo.

REM Create database
"%PSQL_PATH%" -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;" postgres

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Note: If database already exists, this is normal.
    echo Continuing with schema setup...
)

echo.
echo ================================================
echo Step 2: Loading Database Schema
echo ================================================
echo.

REM Load schema
"%PSQL_PATH%" -U %DB_USER% -d %DB_NAME% -f "%~dp0backend\database\schema.sql"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to load database schema!
    echo Please check your PostgreSQL credentials and try again.
    pause
    exit /b 1
)

echo.
echo ================================================
echo Step 3: Running Database Migrations
echo ================================================
echo.

REM Run all migration files in order
set MIGRATION_DIR=%~dp0backend\database\migrations
if exist "%MIGRATION_DIR%" (
    echo Looking for migrations in: %MIGRATION_DIR%
    echo.

    for %%f in ("%MIGRATION_DIR%\*.sql") do (
        echo Running migration: %%~nxf
        "%PSQL_PATH%" -U %DB_USER% -d %DB_NAME% -f "%%f"
        if %ERRORLEVEL% NEQ 0 (
            echo WARNING: Migration %%~nxf had errors (may already be applied^)
        ) else (
            echo SUCCESS: %%~nxf applied
        )
        echo.
    )

    echo All migrations processed!
) else (
    echo No migrations folder found, skipping...
)

echo.
echo ================================================
echo  Database Setup Complete!
echo ================================================
echo.
echo Database: %DB_NAME%
echo User: %DB_USER%
echo.
echo Next steps:
echo   1. Update backend\.env with your database credentials:
echo      DB_NAME=%DB_NAME%
echo      DB_USER=%DB_USER%
echo      DB_PASSWORD=your_password
echo.
echo   2. Generate secure keys for backend\.env:
echo      JWT_SECRET=(32+ random characters)
echo      ENCRYPTION_KEY=(32+ random characters)
echo.
echo   3. Start the application (run start-app.bat)
echo.
pause
