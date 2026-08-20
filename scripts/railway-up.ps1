# Deploy local → Railway (contorna webhook GitHub travado)
# Uso:
#   1) railway login
#   2) powershell -File scripts/railway-up.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Verificando login Railway..."
railway whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host "Rode: railway login"
  exit 1
}

Write-Host "Linkando projeto Obra10..."
railway link --project "ded39ed6-e471-4ee4-b28c-aefa0fcd0d68" --service "16745ab3-eb4e-457c-a96a-64b671256fa1" --environment "55f50a98-4511-46b3-b519-c7f86e76a21b"

Write-Host "Enviando obra10-backend (com client 2.9.11)..."
Set-Location "obra10-backend"
railway up --detach
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Deploy disparado. Aguarde 2-5 min e confira https://obra10.app.br/health"
