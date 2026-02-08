# Reglas Estrictas del Proyecto

Este documento contiene reglas críticas que el agente (Antigravity) DEBE seguir en todo momento para este proyecto.

## 1. Gestión de Versiones y Sincronización

- **REGLA**: Todo cambio en el código DEBE acompañarse de un incremento de versión y subida a github.
- **Formato**: `X.X.XX` (Ej: `1.1.44`).
- **Workflow Obligatorio**: Se debe seguir estrictamente [github-sync.md](file:///c:/Users/chiqui/Hermandad/web/.agent/workflows/github-sync.md).
- **Procedimiento**:
    1. Actualizar `package.json` y `sidebar.tsx` con la nueva versión.
    2. Ejecutar el script: `.\scripts\sync-github.ps1 -Message "Version X.X.XX: Resumen"`
- **Proactividad**: El agente tiene permiso (`turbo-all`) para ejecutar este script automáticamente después de realizar cambios.

## 2. Auditoría y Calidad

- Se prefiere el uso de `unknown` sobre `any` en bloques catch.
- Los imports no utilizados deben eliminarse proactivamente.
- Las notificaciones de error deben usar `showError` de `error-handler.ts`.

## 3. Idioma y Comunicación

- **REGLA**: Todo el contenido de los artefactos (especialmente `walkthrough.md` e `implementation_plan.md`) DEBE estar en **Español**.
- **REGLA**: La comunicación con el usuario DEBE ser siempre en **Español**.
- **Contexto**: El usuario prefiere gestionar el proyecto y entender los cambios técnicos en su idioma nativo.
