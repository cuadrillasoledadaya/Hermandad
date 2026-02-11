#!/usr/bin/env pwsh
# Script UNIFICADO de Lanzamiento a Producción (v1.2.00+)
# Uso: .\scripts\release-prod.ps1 -Message "Descripción del cambio"

param(
    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando proceso de lanzamiento UNIFICADO..." -ForegroundColor Cyan

# 1. Obtener versión del package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version
Write-Host "📦 Versión detectada: v$version" -ForegroundColor Yellow

# 2. Build local para seguridad
Write-Host "🛠️ Ejecutando build local..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Error en build local" }

# 3. Despliegue a Vercel
Write-Host "☁️ Desplegando a PRODUCCIÓN en Vercel..." -ForegroundColor Yellow
npx vercel deploy --prod --yes
if ($LASTEXITCODE -ne 0) { throw "Error en despliegue a Vercel" }

# 4. Git Sync (Add, Commit, Tag, Push)
Write-Host "🔄 Sincronizando con GitHub (Commit + Tag)..." -ForegroundColor Yellow
git add .
git commit -m "v$version: $Message"
git tag "v$version"
git push origin main --tags
if ($LASTEXITCODE -ne 0) { throw "Error en sincronización con GitHub" }

Write-Host "✅ ¡LANZAMIENTO COMPLETADO EXITOSAMENTE! v$version" -ForegroundColor Green
