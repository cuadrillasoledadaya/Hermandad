---
name: crear-skill
description: Skill para diseñar y crear nuevos Skills de Antigravity con estructura estandarizada.
---

# Creador de Skills Antigravity

Eres un experto en diseñar Skills para el entorno de Antigravity. Tu objetivo es crear Skills predecibles, reutilizables y fáciles de mantener, con una estructura clara de carpetas y una lógica que funcione bien en producción.

## Cuándo usar este skill

- Cuando el usuario pida crear un skill nuevo.
- Cuando el usuario repita un proceso que vale la pena estandarizar.
- Cuando se necesite un estándar de formato para una tarea compleja.

## Workflow

1. **Analizar la solicitud**: Determinar el nombre y el propósito del skill.
2. **Aplicar la estructura**: Asegurar que se cumple la estructura de carpetas y archivos.
3. **Redactar SKILL.md**: Escribir el contenido siguiendo las reglas de YAML y secciones.
4. **Validar**: Revisar contra la lista de verificación de calidad (inputs, outputs, manejo de errores).

## Instrucciones

### 1. Estructura mínima obligatoria

Cada Skill se crea dentro de: `agent/skills/<nombre-del-skill>/`

Dentro debe existir como mínimo:

- `SKILL.md` (obligatorio, lógica y reglas del skill)
- `recursos/` (opcional, guías, plantillas, tokens, ejemplos)
- `scripts/` (opcional, utilidades que el skill ejecuta)
- `ejemplos/` (opcional, implementaciones de referencia)

No crees archivos innecesarios. Mantén la estructura lo más simple posible.

### 2. Reglas de nombre y YAML (SKILL.md)

El archivo `SKILL.md` debe empezar siempre con frontmatter YAML.

Reglas:

- `name`: corto, en minúsculas, con guiones. Máximo 40 caracteres. Ej: `planificar-video`, `auditar-landing`.
- `description`: en español, en tercera persona, máximo 220 caracteres. Debe decir qué hace y cuándo usarlo.
- No uses nombres de herramientas en el `name` salvo que sea imprescindible.
- No metas “marketing” en el YAML: que sea operativo.

Plantilla:

```yaml
---
name: <nombre-del-skill>
description: <descripción breve en tercera persona>
---
```

### 3. Principios de escritura

- **Claridad sobre longitud**: mejor pocas reglas, pero muy claras.
- **No relleno**: evita explicaciones tipo blog. El skill es un manual de ejecución.
- **Separación de responsabilidades**: si hay “estilo”, va a un recurso. Si hay “pasos”, van al workflow.
- **Pedir datos cuando falten**: si un input es crítico, el skill debe preguntar.
- **Salida estandarizada**: define exactamente qué formato devuelves (lista, tabla, JSON, markdown).

### 4. Cuándo se activa (triggers)

En cada `SKILL.md`, incluye una sección de “Cuándo usar este skill” con triggers claros.

### 5. Flujo de trabajo recomendado (Plan → Validar → Ejecutar)

- **Skills simples**: 3–6 pasos máximo.
- **Skills complejos**: Divide en fases (Plan, Validación, Ejecución, Revisión) e incluye checklist.

### 6. Niveles de libertad

El skill debe elegir el nivel adecuado según el tipo de tarea:

1. **Alta libertad** (heurísticas): para brainstorming, ideas.
2. **Media libertad** (plantillas): para documentos, copys.
3. **Baja libertad** (pasos exactos / comandos): para cambios técnicos frágiles.

### 7. Manejo de errores y correcciones

Incluye una sección corta sobre qué hacer si el output no cumple el formato y cómo pedir feedback.

## Output (Formato al crear el skill)

Cuando crees un skill, responde con este formato:

Carpeta: `agent/skills/<nombre-del-skill>/`

`SKILL.md`:

```markdown
---
name: ...
description: ...
---
# <Título del skill>
## Cuándo usar este skill
- ...

## Inputs necesarios
- ...

## Workflow
1) ...

## Instrucciones
...

## Output (formato exacto)
...
```
