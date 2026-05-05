@echo off
echo Creating desktop shortcut...

set "TARGET=%~dp0start-server.bat"
set "SHORTCUT=%USERPROFILE%\Desktop\Siriman Motor Works.lnk"
set "ICON=%SystemRoot%\System32\shell32.dll"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = '%ICON%,13'; $s.Description = 'Siriman Motor Works Billing System'; $s.Save()"

echo.
echo  Desktop shortcut created: "Siriman Motor Works"
echo  Double-click it to start the server and open the app.
echo.
pause
