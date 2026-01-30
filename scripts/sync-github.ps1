#!/usr/bin/env pwsh
# Script de sincronización automática con GitHub
# Este script se ejecuta sin confirmación del usuario

param(
    [Parameter(Mandatory=$true)]
    [string]$Message
)

Write-Host "🔄 Sincronizando con GitHub..." -ForegroundColor Cyan

# 1. Añadir todos los cambios
git add .

# 2. Crear commit
git commit -m $Message

# 3. Obtener versión del package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version

# 4. Crear tag
git tag "v$version"

# 5. Push con tags
git push origin main --tags

Write-Host "✅ Sincronización completada: v$version" -ForegroundColor Green
