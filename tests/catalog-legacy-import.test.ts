import assert from "node:assert/strict"
import test from "node:test"

import {
  LEGACY_CATALOG_IMPORT_ACTION,
  importLegacyCatalogRecords,
  type LegacyCatalogImportPersistence,
} from "../src/data/catalog-legacy-import"
import type { EditableFlavorRecord } from "../src/data/products"

function flavor(slug: string, position: number): EditableFlavorRecord {
  return {
    slug,
    name: slug === "lotus" ? "Lotus" : "Pistacho",
    description: "",
    allergens: "Leche",
    tartaImage: `/images/products/tarta-${slug}.webp`,
    cajitaImage: `/images/products/cajita-${slug}.webp`,
    tartaPrice: 35,
    cajitaPrice: 12,
    position,
  }
}

test("el import legacy es idempotente y no borra sabores que no aparecen en el JSON", async () => {
  const existing = new Map([
    ["lotus", { id: "id-lotus", slug: "lotus" }],
    ["cliente", { id: "id-cliente", slug: "cliente" }],
  ])
  const revisions = new Set([`lotus:${LEGACY_CATALOG_IMPORT_ACTION}`])
  const createdRevisions: string[] = []

  const persistence: LegacyCatalogImportPersistence = {
    async upsertImportedFlavor(record) {
      const current = existing.get(record.slug) ?? { id: `id-${record.slug}`, slug: record.slug }
      existing.set(record.slug, current)
      return current
    },
    async hasImportRevision(slug) {
      return revisions.has(`${slug}:${LEGACY_CATALOG_IMPORT_ACTION}`)
    },
    async createImportRevision({ slug }) {
      revisions.add(`${slug}:${LEGACY_CATALOG_IMPORT_ACTION}`)
      createdRevisions.push(slug)
    },
  }

  const first = await importLegacyCatalogRecords({
    records: [flavor("pistacho", 1), flavor("lotus", 0)],
    persistence,
  })
  const second = await importLegacyCatalogRecords({
    records: [flavor("pistacho", 1), flavor("lotus", 0)],
    persistence,
  })

  assert.deepEqual(first.slugs, ["lotus", "pistacho"])
  assert.deepEqual(second.slugs, ["lotus", "pistacho"])
  assert.ok(existing.has("cliente"))
  assert.ok(existing.has("lotus"))
  assert.ok(existing.has("pistacho"))
  assert.deepEqual(createdRevisions, ["pistacho"])
})
