@echo off
title Test Installation Script

echo ================================================
echo  Testing Environment
echo ================================================
echo.

echo Current directory: %CD%
echo Script directory: %~dp0
echo.

echo Checking Node.js...
where node
echo.
node --version 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Node.js: FOUND ✓
) else (
    echo Node.js: NOT FOUND ✗
)
echo.

echo Checking npm...
where npm
echo.
npm --version 2>nul
if %ERRORLEVEL% EQU 0 (
    echo npm: FOUND ✓
) else (
    echo npm: NOT FOUND ✗
)
echo.

echo Checking backend folder...
if exist "%~dp0backend" (
    echo backend folder: FOUND ✓
    echo Contents:
    dir /b "%~dp0backend"
) else (
    echo backend folder: NOT FOUND ✗
)
echo.

echo Checking frontend folder...
if exist "%~dp0frontend" (
    echo frontend folder: FOUND ✓
    echo Contents:
    dir /b "%~dp0frontend"
) else (
    echo frontend folder: NOT FOUND ✗
)
echo.

echo Checking package.json files...
if exist "%~dp0backend\package.json" (
    echo backend\package.json: FOUND ✓
) else (
    echo backend\package.json: NOT FOUND ✗
)

if exist "%~dp0frontend\package.json" (
    echo frontend\package.json: FOUND ✓
) else (
    echo frontend\package.json: NOT FOUND ✗
)
echo.

echo ================================================
echo  Test Complete
echo ================================================
echo.
echo If all items show ✓, you can proceed with installation.
echo If any items show ✗, please fix them first.
echo.
pause
