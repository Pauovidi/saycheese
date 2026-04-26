# Persistencia del catalogo de tartas

## Fuente de verdad

La fuente de verdad del catalogo editable de tartas y sabores es Supabase Postgres:

- `public.cake_flavors`: estado actual del catalogo.
- `public.cake_flavor_revisions`: historico/auditoria de importaciones, altas, ediciones y borrados.

El JSON legacy `saycheese-admin/catalog/tartas.json` ya no se lee ni escribe durante el CRUD normal. Queda solo para importacion inicial, backup manual o comparacion temporal.

## Tablas

`cake_flavors` guarda un registro por sabor:

- `slug`, `name`, `description`, `allergens`
- `price_large`, `price_box`
- `image_large_path`, `image_large_url`, `image_box_path`, `image_box_url`
- `display_order`, `is_active`, `deleted_at`
- `created_at`, `updated_at`

`cake_flavor_revisions` guarda auditoria:

- `flavor_id`, `action`, `slug`, `snapshot`, `actor`, `created_at`

El borrado desde admin es soft-delete: marca `is_active = false` y `deleted_at`, sin borrar fisicamente la fila.

## Aplicar migracion SQL

Ejecuta en Supabase SQL Editor:

```bash
supabase/migrations/202604260001_add_cake_catalog_tables.sql
```

La migracion crea tablas, indices, RLS sin policies publicas y trigger `set_cake_flavors_updated_at`.

## Importar desde JSON legacy

Con variables disponibles:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
pnpm catalog:import:legacy
```

El script descarga `saycheese-admin/catalog/tartas.json`, valida el documento legacy e inserta/actualiza `cake_flavors` por `slug`. No borra sabores que no aparezcan en el JSON. Crea una revision `import_legacy_json` solo si ese sabor no la tenia ya, por eso puede ejecutarse mas de una vez.

Si faltan variables o el JSON no es valido, falla antes de tocar datos.

## Verificacion

Despues de aplicar SQL e importar:

1. Abre `/productos` y confirma que aparecen los sabores.
2. Abre `/producto/tarta-<slug>` y `/producto/cajita-<slug>`.
3. Entra en `/admin/edicion`, crea un sabor de prueba y revisa que aparece en `cake_flavors`.
4. Edita el sabor y comprueba una fila nueva en `cake_flavor_revisions`.
5. Borra el sabor y comprueba `is_active = false` y `deleted_at is not null`.

Consultas utiles:

```sql
select slug, name, display_order, is_active, deleted_at
from public.cake_flavors
order by display_order, name;

select action, slug, actor, created_at, snapshot
from public.cake_flavor_revisions
order by created_at desc;
```

## Si faltan tartas

No ejecutes seeds automaticos ni sobrescribas con `products.ts`. Revisa:

1. Si estan soft-deleted:

```sql
select * from public.cake_flavors where deleted_at is not null;
```

2. Si estan en el JSON legacy:

```bash
pnpm catalog:import:legacy
```

3. Si existieron en auditoria:

```sql
select *
from public.cake_flavor_revisions
where slug = '<slug>'
order by created_at desc;
```

## Pendiente de produccion

- Aplicar la migracion SQL en el proyecto Supabase correcto.
- Ejecutar el import una vez contra produccion.
- Desplegar la app.
- Hacer smoke test de front, admin y chatbot.
- Mantener una copia manual del JSON legacy antes de retirarlo definitivamente.
