@echo off
echo ==========================================
echo      KLYX IPTV - ATUALIZADOR DE CANAIS
echo ==========================================
echo.
echo Lendo listas da pasta: 01_Master_App/playlists
echo Convertendo para o App...
echo.

cd "..\02_Deploy_Web\_dev_tools"
call node convert_playlists.mjs

echo.
echo ==========================================
echo      CONCLUIDO! AGORA FACA O DEPLOY
echo ==========================================
echo.
pause
