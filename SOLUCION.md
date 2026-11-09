# Solución MVP

## Arquitectura

Next.js App Router concentra interfaz y API. El orquestador determinista procesa comandos de caso y las herramientas TypeScript ejecutan lectura, validación, payload, evidencia y creación SAP mock. Las reglas no dependen de un LLM.

## Controles

Se implementan RC1–RC10: proveedor, aprobación, tope, centro/subárea, cotización, IVA derivado, pago derivado, retroactividad, fecha de aprobación y aritmética. Los bloqueos nunca son confirmables. RC5, RC6, RC8 y RC9 requieren acción explícita.

## SAP mock y trazabilidad

La numeración inicia en `4500000001`. La idempotencia usa `solicitud_id`; las órdenes viven en `out/sap/ordenes.jsonl` y los intentos en `out/control.csv`. Cada caso crea evidencia con SHA-256 y trazabilidad JSON.

## Supuestos

El precio unitario se conserva desde la solicitud y el IVA se trata como clasificación fiscal. La unidad se infiere como H para horas, MES para servicios mensuales y UN por defecto. La descripción se limita a 40 caracteres y se conserva el original en trazabilidad. Las OCs retroactivas son permitidas tras confirmación y se marcan.

## Límites y evolución

El mock basado en archivos está diseñado para un MVP monoinstancia con volumen persistente. SAP real debe implementarse detrás de un adaptador, con autenticación y persistencia transaccional. Un LLM futuro solo interpretaría intención y explicaría resultados; no decidiría controles financieros.
