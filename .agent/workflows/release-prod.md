---
// turbo-all
description: Lanzamiento UNIFICADO a Producción (Vercel + GitHub + Tag)
---
# Lanzamiento Unificado a Producción

Este es el workflow **OBLIGATORIO** para cualquier subida a producción. Asegura que la versión en Vercel y el tag en GitHub siempre coincidan.

## El "Patrón de Oro" (La Biblia de las Subidas)

1. **Actualizar Versión**: Incrementar versión en `package.json`.
2. **Ejecutar Lanzamiento**: Inicia el proceso unificado.

// turbo

```powershell
.\scripts\release-prod.ps1 -Message "Descripción detallada del cambio"
```

## Qué hace este patrón

1. **Verifica**: Lee la versión actual.
2. **Build**: Asegura que el código compila sin errores.
3. **Deploy**: Sube a Vercel (`--prod`).
4. **Git Sync**: Crea commit con versión, crea el tag `vX.X.XX` y hace push de todo.

## Reglas Inquebrantables

- **NUNCA** usar `vercel deploy` solo sin hacer `git push`.
- **NUNCA** hacer `git push` sin el correspondiente `tag`.
- **SIEMPRE** usar este workflow para asegurar la integridad de la versión.
