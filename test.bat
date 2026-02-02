@echo off
echo ========================================
echo   AvaliaZap - Teste de Configuracao
echo ========================================
echo.

echo Verificando Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao esta instalado ou nao esta no PATH
    echo Por favor, instale o Node.js de https://nodejs.org
    pause
    exit /b 1
)

echo.
echo Verificando NPM...
call npm --version
if %errorlevel% neq 0 (
    echo ERRO: NPM nao esta disponivel
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Testando conexao com Supabase
echo ========================================
echo.

node test-supabase.js

echo.
echo ========================================
echo.
echo Pressione qualquer tecla para sair...
pause > nul
