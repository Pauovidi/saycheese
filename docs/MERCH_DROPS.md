# Drops de merchandising

## Propósito

El módulo de Drops permite publicar merchandising con dos fases: preventa sin pago antes del lanzamiento y venta normal desde el lanzamiento. La primera implementación está pensada para camisetas, pero el modelo no depende de un nombre concreto de producto.

## Fases públicas

La fase se calcula en servidor con `getDropPublicStatus`:

- `INACTIVE`: el drop no está activo públicamente.
- `PRELAUNCH`: el drop está activo, no cerrado, tiene stock y `now < launchAt`.
- `LIVE`: el drop está activo, no cerrado, tiene stock y `now >= launchAt`.
- `SOLD_OUT`: no queda stock disponible.
- `CLOSED`: el drop está cerrado manualmente.

El límite exacto es `now < launchAt` para preventa y `now >= launchAt` para venta normal. La cuenta atrás del hero es visual; la reserva y la compra se validan de nuevo en servidor.

## Zona horaria

El formulario admin propone `01/07/2026 00:00` en `Atlantic/Canary`. En base de datos se almacena como UTC (`2026-06-30T23:00:00.000Z`) y se conserva `launch_timezone = 'Atlantic/Canary'` para mantener la semántica.

## Stock

El stock es global por drop, no por talla/color.

```
stockDisponible = stockTotalConfigurado - reservasActivas - pedidosMerchNoCancelados
```

Las reservas activas consumen 1 unidad. Al cancelarlas, dejan de contar una sola vez. Los pedidos consumen stock cuando se crean como pedido normal; si el pedido está `cancelled`, deja de contar.

Las operaciones críticas viven en RPC SQL con bloqueo de fila `FOR UPDATE`:

- `create_drop_reservation`: preventa idempotente y atómica.
- `cancel_drop_reservation`: cancelación idempotente.
- `create_order_with_items`: creación de pedido y líneas `drop` en la misma transacción.

## Migración

La migración versionada es:

`supabase/migrations/202606220001_add_merch_drops.sql`

Crea `drops`, `drop_reservations`, `drop_revisions`, columnas de merchandising en `order_items` y funciones RPC. No activa drops, no crea seeds productivos y no aplica cambios directamente a servicios remotos.

La migración aditiva de refinamiento es:

`supabase/migrations/202606250001_refine_merch_drop_admin.sql`

Añade `drops.preorder_cta_text` con default `Preventa`, constraint de texto no vacío y máximo 60 caracteres, y deja versionado el endurecimiento de permisos de las RPC para que solo `service_role` pueda ejecutarlas. No inserta drops, no modifica datos existentes y no debe ejecutarse automáticamente contra producción desde una terminal local.

## Despliegue de código antes de migración

El código puede desplegarse antes de que la migración exista en el entorno remoto. Si Supabase devuelve un error de schema cache por tablas, columnas o RPC de Drops ausentes, la web pública degrada de forma segura:

- home y navegación se comportan como si no hubiera drop activo;
- `/drops` y `/drops/[slug]` no exponen errores internos;
- el backoffice muestra que el módulo todavía no está inicializado y desactiva las acciones de escritura;
- las operaciones de preventa o pedido de tipo `drop` devuelven un 503 controlado.

Esta protección no ejecuta migraciones remotas, no cambia variables de entorno, no crea datos y no sustituye la migración versionada. Cuando se aplique `202606220001_add_merch_drops.sql`, el módulo vuelve a estado `READY` usando las mismas rutas y fuentes de datos.

Para `preorder_cta_text`, el código también puede desplegarse antes de aplicar la migración aditiva. Si PostgREST informa que falta esa columna, las lecturas públicas reintentan con columnas legacy y usan el CTA fallback `Preventa`. El backoffice muestra una actualización pendiente: permite leer y previsualizar, pero no finge que un CTA personalizado se ha guardado si la columna aún no existe.

## Backoffice

En `Admin > Drops` se puede crear o editar:

- nombre y slug;
- descripción;
- precio;
- imágenes;
- colores y tallas;
- stock total;
- fecha de lanzamiento;
- `Publicar drop`: permite que el drop entre en preventa o venta según la fecha configurada;
- `Mostrar flotante de preventa`: muestra el aviso en el hero solo antes del lanzamiento;
- `Cerrar drop manualmente`: bloquea preventas y ventas aunque el drop siga publicado;
- mensaje exacto del flotante;
- texto del botón de preventa;
- imágenes principales y secundarias.

La preview privada de `Admin > Drops` reutiliza la misma capa visual del flotante público, usa los valores actuales del formulario y no publica cambios. El CTA de la preview está desactivado: no crea reservas, no consume stock y no llama a `reserveDropPrelaunch`.

Las imágenes se guardan en `image_urls` como array ordenado:

- posición `0`: imagen principal, usada en listados y portada de ficha;
- posiciones posteriores: imágenes secundarias.

El backoffice permite reemplazar o quitar la principal en borradores, añadir secundarias, eliminar secundarias, convertir una secundaria en principal y reordenar secundarias. Publicar un drop requiere imagen principal; guardar un borrador inactivo no.

En `Admin > Camisetas` hay dos pestañas:

- `Preventas`: lista reservas y permite cancelarlas.
- `Pedidos`: lista líneas de pedido de tipo `drop` con talla, color, cantidad y precio.

Desactivar el flotante no desactiva el drop, no elimina reservas y no cambia stock ni fecha.

## Flujo público

Antes de `launchAt`, si el drop está activo, en `PRELAUNCH`, con flotante activo y stock disponible, el hero muestra:

- el mensaje exacto del administrador;
- cuenta atrás;
- stock disponible;
- CTA `preorder_cta_text`, con fallback `Preventa`.

La preventa no pide talla, color ni cantidad, no abre checkout y no crea un pedido normal.

Desde `launchAt`, el flotante desaparece, aparece `Drops` en el menú, `/drops` lista el producto y `/drops/[slug]` permite elegir talla, color y cantidad antes de añadir al carrito. El checkout existente crea el pedido y el servidor revalida stock.

## Pruebas locales

Usa el package manager del lockfile:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Para probar manualmente con datos no productivos:

1. Ejecuta las migraciones en una base local o de desarrollo.
2. Entra en `Admin > Drops`.
3. Crea un drop inactivo con stock 30, lanzamiento `01/07/2026 00:00`, zona `Atlantic/Canary`.
4. Activa el drop y el flotante con el texto `NUEVO DROP MUY PRONTO`.
5. Comprueba home, preventa, `Admin > Camisetas`, ocultar flotante, cambio de fecha y compra desde `/drops`.

No ejecutes estas pruebas contra datos productivos ni apliques migraciones manualmente sobre producción desde una terminal local.
