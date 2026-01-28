@echo off
cd /d "%~dp0..\01_Master_App"
if exist "INICIAR_SERVIDOR.bat" (
    start "" "INICIAR_SERVIDOR.bat"
) else (
    echo Arquivo INICIAR_SERVIDOR.bat nao encontrado na pasta 01_Master_App.
    pause
)
exit