@echo off
title Siriman Motor Works - Setup
echo.
echo  Registering garagesync:// protocol handler...
echo  (This allows the app to launch the sync server from the browser)
echo.

set "BAT_PATH=%~dp0start-server.bat"

:: Write registry entries with the correct path
reg add "HKEY_CLASSES_ROOT\garagesync" /ve /d "Siriman Motor Works Sync Server" /f >nul
reg add "HKEY_CLASSES_ROOT\garagesync" /v "URL Protocol" /d "" /f >nul
reg add "HKEY_CLASSES_ROOT\garagesync\shell\open\command" /ve /d "cmd.exe /c start \"\" \"%BAT_PATH%\"" /f >nul

echo  Done! Protocol registered successfully.
echo.
echo  You only need to run this setup once.
echo.
pause
