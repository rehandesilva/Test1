@echo off
title Siriman Motor Works - Install Auto-Start
echo.
echo  ==========================================
echo   Installing Auto-Start on Windows Login
echo  ==========================================
echo.

:: Use the actual location of this bat file (not Desktop)
set "SERVER_BAT=%~dp0start-server.bat"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_DIR%\SirimanSyncServer.vbs"

:: Write VBS with the correct full path
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run """cmd.exe /c ""%SERVER_BAT%""""", 0, False
) > "%VBS_FILE%"

echo  ✅ Auto-start installed successfully!
echo.
echo  Server path: %SERVER_BAT%
echo  Startup file: %VBS_FILE%
echo.
echo  The sync server will now start automatically
echo  every time Windows starts.
echo.
echo  To remove: run uninstall-autostart.bat
echo.
pause
