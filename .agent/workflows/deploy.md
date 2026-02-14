---
description: Cómo subir cambios a producción con etiqueta de versión y despliegue en Vercel
---

# Flujo de Despliegue con Etiquetado

Este workflow asegura que cada subida a producción tenga su correspondiente etiqueta (tag) en GitHub para mantener un historial claro de versiones.

## Pasos para el Despliegue

1. **Actualizar Versión**: Incrementar el número de versión en `package.json`.
2. **Git Commit**: Realizar el commit con un mensaje descriptivo.
3. **Crear Tag**: Generar una etiqueta con el número de versión (ej. `v1.2.17`).
// turbo
4. **Push a GitHub**: Subir los cambios y las etiquetas.

   ```powershell
   git push origin main --tags
   ```

5. **Verificar Vercel**: Enlazar y forzar el despliegue si es necesario.
// turbo

   ```powershell
   npx vercel --prod --yes
   ```
