@echo off
:: ==============================================
:: Estudio Personal - Server Launcher
:: Checks if server is already running, starts if not,
:: then opens the app in the default browser.
:: ==============================================

title Estudio Personal - Server

:: Check if server is already running on port 3005
netstat -ano | findstr ":3005 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Server already running on port 3005
    goto :open_browser
)

echo [INFO] Starting server...
cd /d "%~dp0"
start /min cmd /c "title EstudioPersonal-Server && node server.js"

:: Wait for server to start (up to 10 seconds)
set /a attempts=0
:wait_loop
if %attempts% geq 20 (
    echo [WARNING] Server took too long to start
    goto :open_browser
)
timeout /t 1 /nobreak >nul 2>&1
netstat -ano | findstr ":3005 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Server started successfully!
    goto :open_browser
)
set /a attempts+=1
goto :wait_loop

:open_browser
echo [INFO] Opening Estudio Personal...
start "" "http://localhost:3005"
exit
