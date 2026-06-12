@echo off
chcp 65001 > nul
echo =======================================================
echo 🚀 INICIANDO PUBLICAÇÃO DO OBRA 10
echo =======================================================
echo.

:: 1. Verificar se estamos na branch main
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if not "%CURRENT_BRANCH%"=="main" (
    echo ❌ Erro: Você deve estar na branch "main" para iniciar a publicação.
    echo Atualmente você está na branch "%CURRENT_BRANCH%".
    echo Por favor, volte para a branch main antes de rodar este script.
    goto end
)

:: 2. Verificar se há alterações não commitadas
git diff --quiet
if errorlevel 1 (
    echo ⚠️ Atenção: Você tem alterações não salvas (sem commit) no Git.
    echo Por favor, faça o commit de todas as suas alterações antes de publicar.
    goto end
)

git diff --cached --quiet
if errorlevel 1 (
    echo ⚠️ Atenção: Você tem alterações na área de stage não salvas.
    echo Por favor, faça o commit de todas as suas alterações antes de publicar.
    goto end
)

echo 📦 1. Compilando o projeto localmente para garantir que não há erros...
call npm run build
if errorlevel 1 (
    echo.
    echo ❌ Erro de compilação! O build local falhou.
    echo A publicação foi cancelada para evitar enviar erros aos usuários.
    goto end
)

echo.
echo ✅ Build concluído com sucesso! Sem erros.
echo 🔀 2. Enviando alterações e fazendo deploy...
echo.

:: Enviar alterações da main para o GitHub
echo Enviando branch "main" para o GitHub...
git push origin main
if errorlevel 1 (
    echo ❌ Falha ao atualizar a branch main no GitHub. Verifique sua conexão com a internet.
    goto end
)

:: Trocar para a branch production
echo Trocando para a branch "production"...
git checkout production
if errorlevel 1 (
    echo ❌ Falha ao trocar para a branch production.
    goto end
)

:: Puxar alterações mais recentes da production (caso haja)
git pull origin production

:: Mesclar a main na production
echo Mesclando alterações da "main" na "production"...
git merge main --no-edit
if errorlevel 1 (
    echo ❌ Ocorreu um conflito ao mesclar. Resolva os conflitos antes de publicar.
    goto rollback
)

:: Enviar para o Railway (via push na branch production)
echo Enviando para a branch "production" no GitHub (iniciando o deploy)...
git push origin production
if errorlevel 1 (
    echo ❌ Falha ao enviar a branch production para o GitHub. O deploy no Railway não foi iniciado.
    goto rollback
)

echo.
echo =======================================================
echo 🎉 ALTERAÇÕES ENVIADAS COM SUCESSO PARA PRODUÇÃO!
echo O Railway iniciou o deploy automático da nova versão.
echo =======================================================
echo.

:rollback
echo Retornando para a branch de desenvolvimento ("main")...
git checkout main
echo.
goto end

:end
pause
