# Agente de órdenes de compra SAP

MVP determinista para preparar y crear órdenes de compra simuladas a partir de los casos entregados en `reto-03/`.

## Ejecutar

```bash
npm install
npm run dev
```

Abra la aplicación local y procese `sol-001` a `sol-006`. El modo predeterminado no requiere credenciales de IA.

## Comandos

```bash
npm run demo
npm run typecheck
npm run lint
npm test
npm run build
```

## Comportamiento

- `sol-001`: crea OC automáticamente y prueba idempotencia.
- `sol-002` y `sol-003`: se bloquean.
- `sol-004`, `sol-005` y `sol-006`: exigen confirmación humana.
- Los resultados se generan en `out/` y no se versionan.

## Configuración

Copie `.env.example` a `.env.local` para cambiar las rutas de fixtures o salida. Para el despliegue MVP use un servicio Node con volumen persistente montado sobre `out/`.
