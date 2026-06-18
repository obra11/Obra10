@echo off
chcp 65001 > nul
echo =======================================================
echo 🔄 SINCRONIZANDO BANCO DE DADOS (WEB -> COMPUTADOR)...
echo =======================================================
echo.
npm run db:sync
pause
