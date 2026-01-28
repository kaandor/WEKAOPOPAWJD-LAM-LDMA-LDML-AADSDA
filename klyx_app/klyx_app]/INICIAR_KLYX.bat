@echo off
cd /d "%~dp0klyx-app"
if exist "INICIAR_SERVIDOR.bat" (
    start "" "INICIAR_SERVIDOR.bat"
) else (
    echo Arquivo INICIAR_SERVIDOR.bat nao encontrado na pasta klyx-app.
    pause
)
exit
