@echo off
title Saber y Ganar - Estudio Personal
cd /d "%~dp0"

echo =======================================================
echo          SABER Y GANAR - ESTUDIO PERSONAL
echo =======================================================
echo.
echo Iniciando servidor de juego...
echo.

start "" http://localhost:3005
node server.js

pause
