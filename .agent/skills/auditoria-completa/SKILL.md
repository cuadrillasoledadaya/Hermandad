---
name: auditoria-completa
description: Realiza una auditoría exhaustiva de seguridad, arquitectura, calidad de código y rendimiento de la aplicación.
---

# Auditoría Completa de Aplicación

Este skill guía al agente para realizar un escaneo profundo del proyecto, identificando vulnerabilidades, deuda técnica, problemas de rendimiento y fallos arquitectónicos.

## Cuándo usar este skill

- Cuando el usuario pida "auditar el código", "revisar seguridad" o "preparar para producción".
- Antes de una entrega final o versión mayor.
- Cuando se hereda un proyecto desconocido.

## Workflow

1. **Escaneo de Estructura**: Entender la organización del proyecto.
2. **Análisis de Seguridad Crítica**: Secretos, exposición de datos, RLS.
3. **Calidad de Código y Tipado**: Lints, tipos, deuda técnica.
4. **Rendimiento y Dependencias**: Paquetes pesados, optimización de assets.
5. **Generación de Informe**: Crear un reporte accionable.

## Instrucciones Detalladas

### 1. Escaneo de Estructura

- Lista los archivos principales para entender el stack (`package.json`, `tsconfig.json`, `next.config.js`).
- Identifica la estructura de carpetas (`src/`, `app/`, `components/`, `lib/`).

### 2. Análisis de Seguridad (CRÍTICO) 🛡️

- **Secretos Hardcodeados**: Busca patrones como `API_KEY`, `SECRET`, `TOKEN`, `password` en el código.
  - *Tool*: `grep_search`
- **Variables de Entorno**: Revisa `.env` y `.env.local` (que no deberían estar en git). Revisa `gitignore`.
- **Supabase RLS**: Si hay carpeta `supabase`, revisa las migraciones SQL.
  - **Regla**: TODA tabla debe tener `ENABLE ROW LEVEL SECURITY`.
  - **Regla**: Las políticas no deben ser `TO public USING (true)` salvo excepciones muy justificadas.
- **Validación de Inputs**: ¿Se usan Zod/Yup en los formularios y Server Actions?

### 3. Calidad de Código 🧹

- **Errores de Tipado**: Ejecuta `npx tsc --noEmit` para ver el estado real de TypeScript.
- **Linting**: Ejecuta `npm run lint`.
- **Comentarios TODO/FIXME**: Busca marcadores de deuda técnica pendientes.
- **Código Muerto**: Archivos o exportaciones no utilizadas (heurístico).

### 4. Rendimiento 🚀

- **Imágenes**: ¿Se usa `next/image`? ¿Hay imágenes pesadas en `public/`?
- **Dependencias**: Revisa `package.json` en busca de librerías duplicadas o innecesariamente pesadas (ej: `moment` vs `date-fns`).
- **Renderizado**: Revisa uso de `use client` vs Server Components. El defecto debe ser Server.

### 5. Generación del Informe

Crea un archivo `AUDITORIA_FECHA.md` con:

- **Resumen Ejecutivo**: Estado general (Semáforo: Rojo/Amarillo/Verde).
- **Vulnerabilidades Críticas**: Cosas a arreglar YA.
- **Mejoras Recomendadas**: Optimización y limpieza.
- **Plan de Acción**: Lista de tareas sugeridas (checklist).

## Output (Formato)

Devuelve un resumen al usuario indicando que la auditoría ha comenzado o finalizado, y la ruta del informe generado.
