@echo off
REM One-click project setup for Windows: installs dependencies and builds everything.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

echo === Installing dependencies (first run downloads Electron, ~100 MB) ===
call npm install || goto :fail

echo.
echo === Building the browser extension ===
call npm run build:ext || goto :fail

echo.
echo === Building the desktop widget pages ===
call npm run build:desktop || goto :fail

echo.
echo ============================================================
echo  Done! Next steps:
echo    npm run dev            web playground at http://localhost:5178
echo    npm run desktop        run the desktop widget
echo    npm run dist:desktop   build the Windows installer into release\
echo    Extension: chrome://extensions ^> Developer mode ^> Load unpacked ^> dist-extension
echo ============================================================
pause
exit /b 0

:fail
echo.
echo Setup failed - see the messages above.
pause
exit /b 1
