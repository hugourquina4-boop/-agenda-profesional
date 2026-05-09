# setup_v37.ps1 — Aplica v37 en Supabase y resetea clave del superadmin
#
# USO:
#   .\setup_v37.ps1 -AccessToken "sbp_xxxxx"
#
# El Access Token se obtiene en: https://supabase.com/dashboard/account/tokens
# (Personal Access Token, no el anon key)

param(
  [Parameter(Mandatory=$true)]
  [string]$AccessToken
)

$ProjectRef = "unpxoamfyushsbyyziyn"
$SqlFile    = Join-Path $PSScriptRoot "sql\v37_salon_superadmin.sql"

if (-not (Test-Path $SqlFile)) {
  Write-Error "No se encuentra $SqlFile"
  exit 1
}

Write-Host "Leyendo SQL de v37..." -ForegroundColor Cyan
$sql = Get-Content $SqlFile -Raw

Write-Host "Aplicando v37 en Supabase ($ProjectRef)..." -ForegroundColor Cyan

$headers = @{
  "apikey"        = $AccessToken
  "Authorization" = "Bearer $AccessToken"
  "Content-Type"  = "application/json"
}

$body = @{ query = $sql } | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod `
  -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
  -Method POST `
  -Headers $headers `
  -Body $body `
  -ErrorAction Stop

Write-Host "v37 aplicado exitosamente." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora resetea tu clave ingresando a:" -ForegroundColor Yellow
Write-Host "  https://project-gnyy8.vercel.app/superadmin.html" -ForegroundColor White
Write-Host ""
Write-Host "Clave de acceso al panel: HFURQUINA12" -ForegroundColor Yellow
Write-Host "En 'Mi acceso maestro' escribe tu nueva contraseña para hugourquina@gmail.com" -ForegroundColor White
