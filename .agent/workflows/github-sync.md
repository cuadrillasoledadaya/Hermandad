---
// turbo-all
description: Sincronización con GitHub y Versionado Automático (X.X.XX)
---
# Sincronización con GitHub

Este workflow ejecuta un script automático que sincroniza con GitHub sin confirmación del usuario.

## Sistema de Versiones

- Formato: `X.X.XX` (Ej: `1.0.00`, `1.0.01`, ..., `1.0.99` -> `1.1.00`)
- La versión debe actualizarse en `package.json` y `sidebar.tsx` ANTES de ejecutar este workflow.

## Ejecución Automática

// turbo
Ejecutar el siguiente comando para sincronizar automáticamente:

```powershell
.\scripts\sync-github.ps1 -Message "Version X.X.XX: Descripción del cambio"
```

El script hace automáticamente:

1. `git add .`
2. `git commit -m "..."`
3. `git tag vX.X.XX`
4. `git push origin main --tags`

**IMPORTANTE**: Ya NO es necesario aprobar comandos. El script se ejecuta completamente en automático.
