# Import de contenido scrapeado (personalizadoshosteleria)

## 1) Preparación

1. Haz checkout del branch del PR.
2. Instala dependencias:

```bash
pnpm install
```

## 2) Ejecutar import (dry-run y apply)

> El export se mantiene fuera de Git. Ejemplo de ruta: `./export`.

1. Dry-run (no escribe dataset):

```bash
pnpm import:ph -- --export "./export"
```

2. Revisar resumen:

```bash
pnpm import:ph:report
```

3. Apply (escribe cambios + backups `.bak`):

```bash
pnpm import:ph:apply -- --export "./export"
```

El script genera siempre `out/import-scraped-report.json` con métricas y ejemplos de coincidencias/no coincidencias.

## 3) Copiar medios

Copia manualmente:

- `export/public/media/...` → `public/media/...`

## 4) Validación local

```bash
pnpm build
# o
pnpm dev
```

## 5) Guardar cambios en tu branch

```bash
git add .
git commit -m "chore: import personalizados export"
git push
```

## Qué ficheros modifica el import

Con `--apply true`, el script puede actualizar:

- Dataset de productos auto-detectado (en este orden):
  - `lib/data/products.json`
  - `lib/data/products.ts`
  - `src/data/products.ts`
  - `src/data/products.json`
- `lib/data/generated-blog.json`

Además:

- Crea backups `.bak` de cada fichero sobrescrito.
- Actualiza/crea `out/import-scraped-report.json`.
