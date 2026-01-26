---
description: Sincronización con GitHub y Versionado Automático (X.X.XX)
---
Este workflow debe ejecutarse tras cada cambio significativo para asegurar que Vercel despliegue la última versión con el tag correcto.

### Sistema de Versiones

- Formato: `X.X.XX` (Ej: `1.0.00`, `1.0.01`, ..., `1.0.99` -> `1.1.00`)
- La versión debe actualizarse en `package.json`.

### Pasos para la subida

1. **Actualizar Versión**:
   - Lee la versión actual de `package.json`.
   - Incrementa SOLO los dos últimos dígitos (XX).
   - **SOLO** si los dos últimos dígitos llegan a `99`, el siguiente cambio incrementará el dígito central (X) y los últimos volverán a `00`.
   - Ejemplo: `1.0.12` -> `1.0.13`.
   - Ejemplo: `1.0.99` -> `1.1.00`.
   - Actualiza `package.json`.

2. **Commit de Cambios**:
   - `git add .`
   - `git commit -m "Version X.X.XX: [Descripción breve]"`

3. **Etiquetado (Tagging)**:
   - `git tag vX.X.XX`

4. **Sincronización**:
   - `git push origin main --tags`

// turbo
5. Ejecutar subida:

- Proporcionar un mensaje descriptivo para el commit.
