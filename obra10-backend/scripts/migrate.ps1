<#
.SYNOPSIS
    Pipeline de migrations versionadas do OBRA 10.

.DESCRIPTION
    Automatiza o pipeline de migration incremental:
    1. Gera SQL via prisma migrate diff
    2. Mostra o SQL para revisao antes de aplicar
    3. Aplica ao banco via psql
    4. Regenera o Prisma Client
    5. Registra no historico com migrate resolve --applied

.PARAMETER Name
    Nome descritivo da migration (ex: "add_fvs_tables", "billing_expiry")

.EXAMPLE
    .\scripts\migrate.ps1 -Name "add_fvs_tables"
    .\scripts\migrate.ps1 -Name "remove_campo_teste"

.NOTES
    NUNCA usar 'prisma db push' -- usar sempre este script.
    'prisma migrate dev' nao funciona neste ambiente (bug Prisma 7 + Windows + PG shadow DB).
#>

param(
    [Parameter(Mandatory, HelpMessage="Nome da migration (ex: add_fvs_tables)")]
    [string]$Name
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Resolve project root (scripts/ is one level below root)
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$envFile     = Join-Path $projectRoot ".env"
$schemaFile  = Join-Path $projectRoot "prisma\schema.prisma"
$migrationsDir = Join-Path $projectRoot "prisma\migrations"

Set-Location $projectRoot

if (-not (Test-Path $envFile))    { Write-Error ".env nao encontrado em: $envFile" }
if (-not (Test-Path $schemaFile)) { Write-Error "schema.prisma nao encontrado em: $schemaFile" }

# Load .env into current process environment
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $k = $Matches[1].Trim()
        $v = $Matches[2].Trim().Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
    }
}

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) { Write-Error "DATABASE_URL nao encontrado no .env" }

# Parse postgres connection string to extract host/user/pass/db for psql
# Format: postgresql://user:pass@host:port/dbname?params
$rawUrl = $databaseUrl -replace '^postgresql://', '' -replace '^postgres://', ''
$atIdx  = $rawUrl.IndexOf('@')
$userPart = $rawUrl.Substring(0, $atIdx)
$hostPart = $rawUrl.Substring($atIdx + 1)

$colonInUser = $userPart.IndexOf(':')
$pgUser = $userPart.Substring(0, $colonInUser)
$pgPass = $userPart.Substring($colonInUser + 1)

# Remove query params
$hostPart = ($hostPart -split '\?')[0]
$slashIdx = $hostPart.IndexOf('/')
$hostPort = $hostPart.Substring(0, $slashIdx)
$pgDb     = $hostPart.Substring($slashIdx + 1)

$colonInHost = $hostPort.IndexOf(':')
if ($colonInHost -ge 0) {
    $pgHost = $hostPort.Substring(0, $colonInHost)
    $pgPort = $hostPort.Substring($colonInHost + 1)
} else {
    $pgHost = $hostPort
    $pgPort = "5432"
}

# Create migration directory
$ts     = Get-Date -Format 'yyyyMMddHHmmss'
$migId  = "${ts}_${Name}"
$migDir = Join-Path $migrationsDir $migId
New-Item -ItemType Directory -Force $migDir | Out-Null
$sqlFile = Join-Path $migDir "migration.sql"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " OBRA 10 - Migration Pipeline" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Migration: $migId" -ForegroundColor Yellow
Write-Host " DB: $pgUser@${pgHost}:${pgPort}/$pgDb" -ForegroundColor Gray
Write-Host ""

# Generate incremental SQL diff
Write-Host "Gerando SQL de diferenca..." -ForegroundColor Cyan

# Temporarily allow non-terminating errors — Prisma writes info to stderr which triggers Stop mode
$ErrorActionPreference = "Continue"

$diffArgs = @(
    "prisma", "migrate", "diff",
    "--from-migrations", "prisma/migrations",
    "--to-schema", "prisma/schema.prisma",
    "--script",
    "--output", $sqlFile
)

# Run diff — may fail if shadow DB unavailable (known Prisma 7/Windows/PG issue)
npx @diffArgs 2>&1 | Out-Null
$diffOk = ($LASTEXITCODE -eq 0) -and (Test-Path $sqlFile) -and ((Get-Item $sqlFile).Length -gt 0)

if (-not $diffOk) {
    Write-Host "Diff incremental falhou (shadow DB indisponivel). Usando diff completo (from-empty)..." -ForegroundColor Yellow
    Write-Host "Voce precisara EDITAR o SQL para manter apenas as novas mudancas." -ForegroundColor Yellow

    $diffArgs2 = @(
        "prisma", "migrate", "diff",
        "--from-empty",
        "--to-schema", "prisma/schema.prisma",
        "--script",
        "--output", $sqlFile
    )
    npx @diffArgs2 2>&1 | Out-Null

    if (-not (Test-Path $sqlFile) -or (Get-Item $sqlFile).Length -eq 0) {
        $ErrorActionPreference = "Stop"
        Write-Error "Falha ao gerar SQL de migration. Verifique o schema.prisma."
    }

    Write-Host ""
    Write-Host "ATENCAO: SQL gerado inclui o schema COMPLETO." -ForegroundColor Red
    Write-Host "Edite '$sqlFile' para manter apenas os novos ALTER TABLE / CREATE TABLE." -ForegroundColor Red
}

# Restore strict error handling for critical operations
$ErrorActionPreference = "Stop"

# Display SQL for review
Write-Host ""
Write-Host "SQL gerado em: $sqlFile" -ForegroundColor Green
Write-Host ""
Write-Host "------ CONTEUDO DO SQL (primeiras 30 linhas) ------" -ForegroundColor Gray
$lines = Get-Content $sqlFile
$lines | Select-Object -First 30
if ($lines.Count -gt 30) {
    Write-Host "... ($($lines.Count - 30) linhas restantes - veja o arquivo completo)" -ForegroundColor Gray
}
Write-Host "--------------------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "REVISE o SQL acima." -ForegroundColor Yellow
Write-Host "Para editar: notepad `"$sqlFile`"" -ForegroundColor Gray
Write-Host ""

Read-Host "Pressione ENTER para APLICAR ao banco '$pgDb' ou CTRL+C para cancelar"

# Apply SQL via psql
Write-Host ""
Write-Host "Aplicando migration ao banco..." -ForegroundColor Cyan
$env:PGPASSWORD = $pgPass
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmd) { $psqlPath = $psqlCmd.Source }
    else { Write-Error "psql nao encontrado. Instale PostgreSQL 18 e adicione ao PATH." }
}
& $psqlPath -h $pgHost -p $pgPort -U $pgUser -d $pgDb -f $sqlFile
if ($LASTEXITCODE -ne 0) { Write-Error "psql falhou com exit code $LASTEXITCODE" }

# Regenerate Prisma Client
Write-Host ""
Write-Host "Regenerando Prisma Client..." -ForegroundColor Cyan
npx prisma generate

# Register in Prisma migration history
Write-Host ""
Write-Host "Registrando migration no historico..." -ForegroundColor Cyan
npx prisma migrate resolve --applied $migId

# Done
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " CONCLUIDO: Migration '$migId' aplicada!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Reiniciar servidor: npm run start:dev"
Write-Host "  2. Testar endpoint em: Obra10_Postman.http"
Write-Host "  3. Commitar: git add prisma/ && git commit -m 'migration: $Name'"
Write-Host ""
