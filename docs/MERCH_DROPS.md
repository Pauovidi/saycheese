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

El stock mantiene dos niveles: stock general del drop y stock por talla.

```
globalAvailable = stockTotal - reservedUnits - orderedUnits
sizeAvailableRaw[size] = sizeStockTotal[size] - orderedUnitsBySize[size]
sizeSellableNow[size] = min(sizeAvailableRaw[size], globalAvailable)
```

En PRELAUNCH/preventa no se elige talla ni color. Las reservas activas consumen 1 unidad genérica del stock general. Al cancelarlas, dejan de contar una sola vez.

En LIVE/venta el cliente elige talla, color y cantidad. Cada pedido consume stock global y disponibilidad de la talla seleccionada. El servidor valida que la cantidad no supere ni `globalAvailable` ni `sizeAvailableRaw` de esa talla. En UI y chatbot se muestra `sizeSellableNow`.

El backoffice compara la suma del stock por talla con el stock general. Para publicar un drop activo, ambas cifras deben coincidir. Un borrador puede guardarse incompleto para terminarlo después, pero se muestra advertencia. Si una talla ya tiene pedidos, la UI no permite eliminarla para no confundir el histórico; se recomienda poner stock 0 si ya no debe venderse.

Las operaciones críticas viven en RPC SQL con bloqueo de fila `FOR UPDATE`:

- `create_drop_reservation`: preventa idempotente y atómica.
- `cancel_drop_reservation`: cancelación idempotente.
- `create_order_with_items`: creación de pedido y líneas `drop` en la misma transacción.

## Archivado

Archivar es la alternativa segura al borrado físico. Un drop archivado conserva reservas, pedidos y revisiones, pero queda fuera del front público, del flotante del hero, del menú/listado público y de cualquier operación de preventa o venta.

Cerrar y archivar no significan lo mismo:

- Cerrar bloquea preventas y ventas de un drop que puede seguir existiendo como registro operativo.
- Archivar lo retira del circuito público y lo mueve a la sección `Archivados` del backoffice.

Desde `/admin/drops` se puede usar `Archivar drop`. La confirmación avisa que archivar ocultará el drop del front y bloqueará preventas/ventas, conservando reservas, pedidos e historial. Al archivar se marca `archived_at`, se guarda `archived_by` y un motivo opcional, se apaga `is_active`, se apaga `floating_enabled` y queda cerrado para operaciones.

`Desarchivar` lo recupera como borrador seguro: no lo publica automáticamente ni reactiva el flotante. No hay botón de borrado definitivo en esta iteración.

## Migración

La migración versionada es:

`supabase/migrations/202606220001_add_merch_drops.sql`

Crea `drops`, `drop_reservations`, `drop_revisions`, columnas de merchandising en `order_items` y funciones RPC. No activa drops, no crea seeds productivos y no aplica cambios directamente a servicios remotos.

La migración aditiva de refinamiento es:

`supabase/migrations/202606250001_refine_merch_drop_admin.sql`

Añade `drops.preorder_cta_text` con default `Preventa`, constraint de texto no vacío y máximo 60 caracteres, y deja versionado el endurecimiento de permisos de las RPC para que solo `service_role` pueda ejecutarlas. No inserta drops, no modifica datos existentes y no debe ejecutarse automáticamente contra producción desde una terminal local.

La migración aditiva de archivado y stock por talla es:

`supabase/migrations/202606260001_archive_drops_size_stock_chatbot.sql`

Añade `archived_at`, `archived_by`, `archive_reason`, crea `drop_size_stock`, actualiza filtros públicos mediante `archived_at is null`, actualiza `get_drop_stock_summary`, `create_drop_reservation` y `create_order_with_items`, y mantiene permisos de RPC cerrados a `anon`/`authenticated`. No ejecuta SQL remoto, no crea drops productivos y no activa ni archiva datos existentes.

## Despliegue de código antes de migración

El código puede desplegarse antes de que la migración exista en el entorno remoto. Si Supabase devuelve un error de schema cache por tablas, columnas o RPC de Drops ausentes, la web pública degrada de forma segura:

- home y navegación se comportan como si no hubiera drop activo;
- `/drops` y `/drops/[slug]` no exponen errores internos;
- el backoffice muestra que el módulo todavía no está inicializado y desactiva las acciones de escritura;
- las operaciones de preventa o pedido de tipo `drop` devuelven un 503 controlado.

Esta protección no ejecuta migraciones remotas, no cambia variables de entorno, no crea datos y no sustituye la migración versionada. Cuando se aplique `202606220001_add_merch_drops.sql`, el módulo vuelve a estado `READY` usando las mismas rutas y fuentes de datos.

Para `preorder_cta_text`, el código también puede desplegarse antes de aplicar la migración aditiva. Si PostgREST informa que falta esa columna, las lecturas públicas reintentan con columnas legacy y usan el CTA fallback `Preventa`. El backoffice muestra una actualización pendiente: permite leer y previsualizar, pero no finge que un CTA personalizado se ha guardado si la columna aún no existe.

Para archivado y stock por talla, las lecturas públicas tienen fallback legacy cuando faltan columnas nuevas. Las mutaciones que dependen del modelo nuevo fallan cerrado con 503 controlado hasta aplicar la migración. No ejecutes SQL remoto ni `supabase db push` sin autorización explícita.

## Backoffice

En `Admin > Drops` se puede crear o editar:

- nombre y slug;
- descripción;
- precio;
- imágenes;
- colores;
- stock por talla;
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

Si una preventa se cancela desde backoffice, el navegador puede conservar una idempotency key antigua. La RPC diferencia reserva activa y cancelada: si la key apunta a una cancelada devuelve `reservation_cancelled_idempotency_key`. El cliente rota la clave y reintenta una sola vez. Así se mantiene protección contra doble click y se permite reservar de nuevo después de una cancelación, sin falso éxito ni stock negativo.

## Chatbot

El chatbot conoce drops de forma determinista antes de caer al LLM. Responde a preguntas sobre drops, camisetas, merchandising, preventa, lanzamiento, colores, tallas y stock por talla usando la misma fuente de verdad segura del front.

Ejemplos:

- PRELAUNCH: informa nombre, precio, fecha de lanzamiento en `Atlantic/Canary`, stock global, tallas previstas, colores y aclara que la preventa reserva una unidad genérica sin talla/color.
- LIVE: informa nombre, precio, stock global y tallas con disponibilidad vendible, por ejemplo `S (5), M (10), L (10), XL (5)`.
- Talla concreta: responde si queda o está agotada usando `sizeSellableNow`.
- Archivado o sin drops públicos: responde que ahora mismo no hay drops publicados.
- Error de módulo: responde seguro sin SQL, tablas ni detalles internos.

Limitación intencionada: WhatsApp no crea pedidos de camisetas en esta iteración. Si alguien escribe `quiero una camiseta`, el bot redirige a la sección Drops de la web para elegir talla, color y cantidad.

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
