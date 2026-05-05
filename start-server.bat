@echo off
title Siriman Motor Works - Sync Server

:: Check if server is already running — if so, just open the app
powershell -Command "try { Invoke-WebRequest -Uri http://localhost:3001/api/status -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
    echo Server already running.
    start "" "%~dp0index.html"
    exit
)

:: Start the sync server
cd /d "%~dp0sync-server"
start /B node server.js > server.log 2>&1

:: Wait until server is ready (max 20 seconds)
set /a tries=0
:WAIT_LOOP
timeout /t 1 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri http://localhost:3001/api/status -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto SERVER_READY
set /a tries+=1
if %tries% lss 20 goto WAIT_LOOP

:SERVER_READY
:: Open the app in the default browser
start "" "%~dp0index.html"

:: Keep server alive — restart if it crashes
:KEEP_ALIVE
timeout /t 5 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri http://localhost:3001/api/status -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto KEEP_ALIVE

:: Server crashed — restart it
cd /d "%~dp0sync-server"
start /B node server.js > server.log 2>&1
goto KEEP_ALIVE
