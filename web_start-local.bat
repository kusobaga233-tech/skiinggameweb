@echo off
setlocal

cd /d "%~dp0web"
if errorlevel 1 (
  echo Failed to enter web directory.
  pause
  exit /b 1
)

echo Checking port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  echo Stopping old server on port 5173, PID %%a...
  taskkill /F /PID %%a >nul 2>nul
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Skiiing Web at http://localhost:5173/
echo If the browser still shows an old sky-only page, press Ctrl+F5 once.
call npm run dev

pause
