@echo off
echo.
echo ================================================
echo  How to Run Batch Files Properly
echo ================================================
echo.
echo The batch files are closing too quickly!
echo.
echo SOLUTION: Open Command Prompt first, then run the batch file
echo.
echo Follow these steps:
echo.
echo 1. Press Windows Key + R
echo 2. Type: cmd
echo 3. Press Enter
echo 4. In the black window that opens, type:
echo    cd "C:\Users\lylli\Documents\Mental Health tracker App"
echo 5. Press Enter
echo 6. Then type one of these commands:
echo.
echo    TEST-INSTALL.bat           (test your environment)
echo    install-dependencies.bat   (install packages)
echo    setup-database.bat         (setup database)
echo    start-app.bat              (start the app)
echo.
echo This way, the window will stay open and show you everything!
echo.
echo ================================================
echo.
echo Alternative: I'll open a Command Prompt for you now...
echo.
pause

REM Open Command Prompt in the correct directory
start cmd /k "cd /d "%~dp0" && echo Ready! Now you can run: TEST-INSTALL.bat && echo."
