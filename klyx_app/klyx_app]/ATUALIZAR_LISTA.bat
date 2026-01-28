@echo off
echo ==========================================
echo      KLYX IPTV - ATUALIZADOR DE CANAIS
echo ==========================================
echo.
echo Lendo listas da pasta: klyx-app/playlists
echo Convertendo para o App...
echo.

cd "klyx_web_export\www\_dev_tools"
call node convert_playlists.mjs

echo.
echo ==========================================
echo      CONCLUIDO! AGORA FACA O DEPLOY
echo ==========================================
echo.
pause
