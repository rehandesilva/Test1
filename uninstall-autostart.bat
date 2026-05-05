@echo off
title Siriman Motor Works - Remove Auto-Start
echo.
set "VBS_FILE=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SirimanSyncServer.vbs"

if exist "%VBS_FILE%" (
    del "%VBS_FILE%"
    echo  ✅ Auto-start removed successfully.
) else (
    echo  ℹ️  Auto-start was not installed.
)
echo.
pause
