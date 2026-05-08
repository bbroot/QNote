@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: ========================================
::  MarkFlowy Windows Launcher
::  Auto-detects Node.js, auto-installs if missing
:: ========================================

set "PORT=3000"
set "MIN_NODE_MAJOR=18"
set "MARKFLOWY_VERSION=0.2.0"
set "DIST_DIR=%~dp0dist"

:: ---------- Check dist folder ----------
if not exist "%DIST_DIR%\index.html" (
    echo [ERROR] dist\index.html not found
    echo.
    echo Please run first:
    echo   npm install
    echo   npm run build
    echo Then run this script
    pause
    exit /b 1
)

echo.
echo +--------------------------+
echo ^|   MarkFlowy Starting...  ^|
echo +--------------------------+
echo.

:: ---------- Check Node.js ----------
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%v in ('node -v') do set "NODE_VERSION=%%v"
    echo [OK] Node.js found: !NODE_VERSION!
) else (
    echo [WARN] Node.js not found
    echo.
    echo Trying PowerShell launcher...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
    exit /b
)

:: ---------- Check npx ----------
where npx >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npx not found in PATH
    echo Please ensure Node.js is properly installed
    pause
    exit /b 1
)

:: ---------- Start server ----------
echo.
echo [INFO] Starting MarkFlowy...
echo    URL: http://localhost:%PORT%
echo    Press Ctrl+C to stop
echo.

start http://localhost:%PORT%

:: Use npx to run serve, install if needed
npx --yes serve "%DIST_DIR%" -p %PORT%
