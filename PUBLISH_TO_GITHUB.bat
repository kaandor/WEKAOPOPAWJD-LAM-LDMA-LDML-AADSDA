@echo off
echo ====================================================
echo   KLYX - PUBLISH TO GITHUB PAGES
echo ====================================================
echo.

:: 1. Verificar se o Git existe
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Git nao encontrado! Por favor, instale o Git: https://git-scm.com/
    pause
    exit /b
)

:: 2. Inicializar repositório se não existir
if not exist ".git" (
    echo [1/4] Inicializando repositorio Git...
    git init -b main
)

:: 3. Configurar Remote
echo [2/4] Configurando destino (GitHub)...
git remote remove origin >nul 2>nul
:: Usando o usuario 'kaandor' e o repositorio detectado no config
git remote add origin https://github.com/kaandor/WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA.git

:: 4. Adicionar arquivos e Commit
echo [3/4] Preparando arquivos (Estrutura simplificada)...
git add .
git commit -m "Deploy: Versao simplificada na raiz"

:: 5. Push
echo [4/4] Enviando para o GitHub...
echo (Se pedir login, uma janela do navegador abrira)
git push -u origin main --force

echo.
echo ====================================================
echo   SUCESSO! Agora siga estes passos finais:
echo   1. Vá em: https://github.com/kaandor/WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA/settings/pages
echo   2. Em 'Build and deployment' > 'Source', mude para 'GitHub Actions'
echo   3. O site estara no ar em 1-2 minutos!
echo ====================================================
pause
