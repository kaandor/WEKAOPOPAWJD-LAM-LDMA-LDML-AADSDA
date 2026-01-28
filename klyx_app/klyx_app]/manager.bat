@echo off
title KLYX App Manager
color 0A

:menu
cls
echo ========================================================
echo                 KLYX APP MANAGER
echo ========================================================
echo.
echo  [1] Rodar Site Localmente (Preview)
echo  [2] Enviar atualizacoes para o GitHub (Deploy)
echo  [3] Build Android (Capacitor)
echo  [4] Abrir pasta do projeto
echo  [5] Atualizar Firebase (Dados)
echo  [6] Sair

echo ========================================================
set /p choice="Escolha uma opcao: "

if "%choice%"=="1" goto preview
if "%choice%"=="2" goto deploy
if "%choice%"=="3" goto android
if "%choice%"=="4" goto open
if "%choice%"=="5" goto firebase
if "%choice%"=="6" exit

goto menu

:preview
cls
echo Iniciando servidor local...
echo Pressione CTRL+C para parar o servidor.
cd klyx_web_export
if exist "node_modules\.bin\http-server" (
    npm start
) else (
    echo Tentando iniciar com npx...
    npx http-server . -o
)
cd ..
pause
goto menu

:deploy
cls
echo Preparando para enviar ao GitHub...
cd klyx_web_export
if not exist .git (
    echo Inicializando repositorio Git...
    git init
    git branch -M main
    git remote add origin https://github.com/kaandor/klyx-web-app.git
) else (
    echo Repositorio Git encontrado. Verificando remote...
    git remote set-url origin https://github.com/kaandor/klyx-web-app.git
)

git add .
set /p commit_msg="Digite a mensagem do commit (Enter para padrao): "
if "%commit_msg%"=="" set commit_msg=Update Klyx App
git commit -m "%commit_msg%"
echo Enviando...
git push -u origin main
echo Concluido!
cd ..
pause
goto menu

:firebase
cls
echo Enviando dados para o Firebase...
cd klyx_web_export\_dev_tools
call node upload_firebase.js
cd ..\..
pause
goto menu

:android
cls
echo Atualizando projeto Android...
cd meuapp
call npm install
call npx cap sync
echo Abrindo Android Studio...
call npx cap open android
cd ..
pause
goto menu

:open
start .
goto menu
