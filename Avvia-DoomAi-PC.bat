@echo off
title D.O.O.M. // Neural AI Desktop
echo ============================================
echo   Avvio D.O.O.M. Neural AI su Windows PC...
echo ============================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRORE] Node.js non trovato. Installalo da https://nodejs.org/
    pause
    exit /b 1
)

start "" /B node server.js
timeout /t 2 /nobreak >nul

:: Apre in modalita App standalone su Edge o Chrome se disponibili
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    start msedge --app=http://localhost:3000
    goto :done
)

start http://localhost:3000

:done
echo Server attivo su http://localhost:3000
echo Chiudi questa finestra per arrestare il server.
pause >nul
