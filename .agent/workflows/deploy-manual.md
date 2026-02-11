---
// turbo-all
description: Despliegue Manual a Producción (Vercel)
---
# Despliegue Manual a Producción

Este workflow permite forzar un despliegue a producción en Vercel cuando la sincronización automática con GitHub falla o tarda demasiado.

## Cuándo usar esto

- Cuando `git push` dice "Everything up-to-date" pero Vercel no actualiza.
- Cuando necesitas un deploy urgente y GitHub Actions está lento o caído.
- Para verificar problemas de conexión con Vercel.

## Ejecución Automática

// turbo
Ejecutar el siguiente script para iniciar el despliegue manual:

```powershell
.\scripts\deploy-manual.ps1
```

## Qué hace este script

1. Ejecuta `npx vercel deploy --prod`.
2. Si no estás logueado, te pedirá autenticación en el navegador.
3. Construye y sube la aplicación directamente a Vercel, omitiendo GitHub.
