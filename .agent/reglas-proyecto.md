# Reglas Estrictas del Proyecto

Este documento contiene reglas críticas que el agente (Antigravity) DEBE seguir en todo momento para este proyecto.

## 1. Gestión de Versiones

- **REGLA**: Siempre que se realice un cambio en el código fuente (src, scripts, etc.), se DEBE incrementar la versión en `package.json`.
- **Procedimiento**: El incremento debe ser de parche (patch) a menos que se indique lo contrario.
- **Sincronización**: Después del incremento, se debe realizar el commit y el push para asegurar que el despliegue refleje los cambios.

## 2. Auditoría y Calidad

- Se prefiere el uso de `unknown` sobre `any` en bloques catch.
- Los imports no utilizados deben eliminarse proactivamente.
