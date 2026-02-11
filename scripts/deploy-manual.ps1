# Script para despliegue manual a producción en Vercel
# Uso: .\scripts\deploy-manual.ps1

Write-Host "🚀 Iniciando despliegue manual a PRODUCCIÓN en Vercel..." -ForegroundColor Cyan

# Verificar si el usuario está logueado en Vercel
Write-Host "🔍 Verificando estado de Vercel CLI..."
try {
    # Ejecutar deploy directamente. Si no está logueado, pedirá login.
    # --prod: Despliega a producción
    # --yes: Salta confirmaciones (asegúrate de que el proyecto esté linkeado)
    
    Write-Host "📦 Ejecutando 'npx vercel deploy --prod'..." -ForegroundColor Yellow
    npx vercel deploy --prod
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Despliegue completado exitosamente." -ForegroundColor Green
    }
    else {
        Write-Host "❌ Error en el despliegue. Código de salida: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}
catch {
    Write-Host "❌ Error crítico: $_" -ForegroundColor Red
    exit 1
}
