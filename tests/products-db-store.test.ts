import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

import {
  createCakeFlavorRecordInDb,
  getCatalogFlavorRecordsFromPersistence,
  hardDeleteArchivedCakeFlavorRecordInDb,
  restoreCakeFlavorRecordInDb,
  saveCatalogFlavorRecords,
  softDeleteCakeFlavorRecordInDb,
  updateCakeFlavorRecordInDb,
  type CakeFlavorPersistence,
  type CakeFlavorRevisionInsert,
  type CakeFlavorRow,
} from "../src/data/products-db-store"

function row(overrides: Partial<CakeFlavorRow>): CakeFlavorRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    slug: overrides.slug ?? "lotus",
    name: overrides.name ?? "Lotus",
    description: overrides.description ?? "Caramelizado.",
    allergens: overrides.allergens ?? "Leche, gluten",
    price_large: overrides.price_large ?? 36,
    price_box: overrides.price_box ?? 13,
    image_large_path: overrides.image_large_path ?? null,
    image_large_url: overrides.image_large_url ?? "/images/products/tarta-lotus.webp",
    image_box_path: overrides.image_box_path ?? null,
    image_box_url: overrides.image_box_url ?? "/images/products/cajita-lotus.webp",
    display_order: overrides.display_order ?? 0,
    is_active: overrides.is_active ?? true,
    deleted_at: overrides.deleted_at ?? null,
    created_at: overrides.created_at ?? "2026-04-22T15:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-22T15:00:00.000Z",
  }
}

class MemoryCakeFlavorPersistence implements CakeFlavorPersistence {
  revisions: CakeFlavorRevisionInsert[] = []
  displayOrderWrites: Array<{ id: string; displayOrder: number }> = []

  constructor(
    public rows: CakeFlavorRow[],
    private readonly orderItems: Array<{ flavor: string }> = []
  ) {}

  async listActiveRows() {
    return this.rows
      .filter((candidate) => candidate.is_active && !candidate.deleted_at)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name, "es"))
  }

  async listArchivedRows() {
    return this.rows
      .filter((candidate) => !candidate.is_active && Boolean(candidate.deleted_at))
      .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? "") || a.name.localeCompare(b.name, "es"))
  }

  async findAnyRowBySlug(slug: string) {
    return this.rows.find((candidate) => candidate.slug === slug) ?? null
  }

  async findActiveRowBySlug(slug: string) {
    return this.rows.find((candidate) => candidate.slug === slug && candidate.is_active && !candidate.deleted_at) ?? null
  }

  async getMaxActiveDisplayOrder() {
    const active = await this.listActiveRows()
    return Math.max(-1, ...active.map((candidate) => candidate.display_order ?? 0))
  }

  async hasHistoricalOrdersForFlavor(flavor: CakeFlavorRow) {
    const references = new Set([flavor.slug, flavor.name])
    return this.orderItems.some((item) => references.has(item.flavor))
  }

  async insertRow(input: Parameters<CakeFlavorPersistence["insertRow"]>[0]) {
    const inserted = row({
      id: `id-${input.slug}`,
      slug: input.slug,
      name: input.name,
      description: input.description,
      allergens: input.allergens,
      price_large: input.price_large,
      price_box: input.price_box,
      image_large_url: input.image_large_url,
      image_box_url: input.image_box_url,
      display_order: input.display_order,
      is_active: input.is_active,
      deleted_at: input.deleted_at,
      created_at: "2026-04-26T10:00:00.000Z",
      updated_at: "2026-04-26T10:00:00.000Z",
    })
    this.rows.push(inserted)
    return inserted
  }

  async updateRow(id: string, updates: Parameters<CakeFlavorPersistence["updateRow"]>[1]) {
    const index = this.rows.findIndex((candidate) => candidate.id === id)
    assert.notEqual(index, -1)
    this.rows[index] = {
      ...this.rows[index],
      ...updates,
      updated_at: "2026-04-26T11:00:00.000Z",
    }
    return this.rows[index]
  }

  async insertRevision(input: CakeFlavorRevisionInsert) {
    this.revisions.push(input)
  }

  async setDisplayOrder(id: string, displayOrder: number) {
    this.displayOrderWrites.push({ id, displayOrder })
    const target = this.rows.find((candidate) => candidate.id === id)
    if (target) target.display_order = displayOrder
  }

  async deleteRow(id: string) {
    this.rows = this.rows.filter((candidate) => candidate.id !== id)
  }
}

test("lee el catálogo activo desde filas Postgres y conserva el contrato editable", async () => {
  const persistence = new MemoryCakeFlavorPersistence([
    row({ slug: "archivo", name: "Archivo", is_active: false, deleted_at: "2026-04-26T09:00:00.000Z" }),
    row({ slug: "pistacho", name: "Pistacho", display_order: 1, price_large: "39", price_box: "14" }),
    row({ slug: "lotus", name: "Lotus", display_order: 0 }),
  ])

  const records = await getCatalogFlavorRecordsFromPersistence(persistence)

  assert.deepEqual(
    records.map((record) => record.slug),
    ["lotus", "pistacho"]
  )
  assert.equal(records[1].tartaPrice, 39)
  assert.equal(records[1].cajitaPrice, 14)
  assert.equal(records[1].position, 1)
})

test("crear sabor inserta en cake_flavors y crea revisión", async () => {
  const persistence = new MemoryCakeFlavorPersistence([row({ slug: "lotus", display_order: 0 })])

  const records = await createCakeFlavorRecordInDb(
    {
      slug: "queso-azul-miel",
      name: "Queso azul con miel",
      description: "Intenso.",
      allergens: "Leche",
      tartaImage: "https://cdn.example.com/tarta.webp",
      cajitaImage: "https://cdn.example.com/cajita.webp",
      tartaPrice: 39,
      cajitaPrice: 14,
    },
    "admin@example.com",
    persistence
  )

  assert.ok(records.some((record) => record.slug === "queso-azul-miel"))
  assert.equal(persistence.revisions.length, 1)
  assert.equal(persistence.revisions[0].action, "create")
  assert.equal(persistence.revisions[0].actor, "admin@example.com")
})

test("editar sabor actualiza cake_flavors y crea revisión", async () => {
  const persistence = new MemoryCakeFlavorPersistence([row({ slug: "lotus" })])

  const records = await updateCakeFlavorRecordInDb(
    "lotus",
    {
      name: "Lotus extra",
      description: "Más crema.",
      allergens: "Leche, gluten",
      tartaImage: "/tarta.webp",
      cajitaImage: "/cajita.webp",
      tartaPrice: 37,
      cajitaPrice: 13.5,
    },
    "admin@example.com",
    persistence
  )

  assert.equal(records.find((record) => record.slug === "lotus")?.name, "Lotus extra")
  assert.equal(records.find((record) => record.slug === "lotus")?.tartaPrice, 37)
  assert.equal(persistence.revisions[0].action, "update")
})

test("borrar sabor hace soft-delete, no delete físico, y crea revisión", async () => {
  const persistence = new MemoryCakeFlavorPersistence([
    row({ id: "id-lotus", slug: "lotus", display_order: 0 }),
    row({ id: "id-pistacho", slug: "pistacho", name: "Pistacho", display_order: 1 }),
  ])

  const records = await softDeleteCakeFlavorRecordInDb("lotus", "admin@example.com", persistence)

  assert.deepEqual(
    records.map((record) => record.slug),
    ["pistacho"]
  )
  assert.equal(persistence.rows.find((candidate) => candidate.slug === "lotus")?.is_active, false)
  assert.ok(persistence.rows.find((candidate) => candidate.slug === "lotus")?.deleted_at)
  assert.equal(persistence.rows.length, 2)
  assert.equal(persistence.revisions[0].action, "delete")
})

test("restaurar sabor archivado reactiva la fila y crea revisión", async () => {
  const persistence = new MemoryCakeFlavorPersistence([
    row({ id: "id-lotus", slug: "lotus", display_order: 0 }),
    row({
      id: "id-archivo",
      slug: "archivo",
      name: "Archivo",
      display_order: 1,
      is_active: false,
      deleted_at: "2026-04-26T09:00:00.000Z",
    }),
  ])

  const records = await restoreCakeFlavorRecordInDb("archivo", "admin@example.com", persistence)

  const restored = persistence.rows.find((candidate) => candidate.slug === "archivo")
  assert.equal(restored?.is_active, true)
  assert.equal(restored?.deleted_at, null)
  assert.ok(records.some((record) => record.slug === "archivo"))
  assert.equal(persistence.revisions[0].action, "restore")
  assert.equal(persistence.revisions[0].actor, "admin@example.com")
})

test("no se puede eliminar definitivamente un sabor activo", async () => {
  const persistence = new MemoryCakeFlavorPersistence([row({ slug: "lotus", is_active: true, deleted_at: null })])

  await assert.rejects(
    () => hardDeleteArchivedCakeFlavorRecordInDb("lotus", "admin@example.com", persistence),
    /No se puede eliminar definitivamente un sabor activo/
  )
})

test("no se puede eliminar definitivamente un sabor archivado con pedidos históricos", async () => {
  const persistence = new MemoryCakeFlavorPersistence(
    [row({ id: "id-archivo", slug: "archivo", name: "Archivo", is_active: false, deleted_at: "2026-04-26T09:00:00.000Z" })],
    [{ flavor: "archivo" }]
  )

  await assert.rejects(
    () => hardDeleteArchivedCakeFlavorRecordInDb("archivo", "admin@example.com", persistence),
    /No se puede eliminar definitivamente porque este sabor aparece en pedidos históricos/
  )
  assert.equal(persistence.rows.length, 1)
})

test("se puede eliminar definitivamente un sabor archivado sin pedidos y mantiene revisiones consistentes", async () => {
  const archived = row({
    id: "id-archivo",
    slug: "archivo",
    name: "Archivo",
    is_active: false,
    deleted_at: "2026-04-26T09:00:00.000Z",
  })
  const active = row({ id: "id-lotus", slug: "lotus", name: "Lotus", is_active: true, deleted_at: null, display_order: 0 })
  const persistence = new MemoryCakeFlavorPersistence([active, archived], [])

  const result = await hardDeleteArchivedCakeFlavorRecordInDb("archivo", "admin@example.com", persistence)

  assert.deepEqual(
    result.flavors.map((record) => record.slug),
    ["lotus"]
  )
  assert.equal(result.archivedFlavors.length, 0)
  assert.equal(persistence.rows.some((candidate) => candidate.slug === "archivo"), false)
})

test("los sabores archivados no aparecen en la lectura activa normal", async () => {
  const persistence = new MemoryCakeFlavorPersistence([
    row({ slug: "lotus" }),
    row({ slug: "archivado", name: "Archivado", is_active: false, deleted_at: "2026-04-26T09:00:00.000Z" }),
  ])

  const records = await getCatalogFlavorRecordsFromPersistence(persistence)

  assert.deepEqual(
    records.map((record) => record.slug),
    ["lotus"]
  )
})

test("crear con un slug archivado orienta a restaurar el sabor", async () => {
  const persistence = new MemoryCakeFlavorPersistence([
    row({
      slug: "auditoria-temporal-codex",
      name: "Auditoría Temporal Codex",
      is_active: false,
      deleted_at: "2026-04-26T09:00:00.000Z",
    }),
  ])

  await assert.rejects(
    () =>
      createCakeFlavorRecordInDb(
        {
          slug: "auditoria-temporal-codex",
          name: "Auditoría Temporal Codex",
          description: "",
          allergens: "",
          tartaImage: "",
          cajitaImage: "",
          tartaPrice: 35,
          cajitaPrice: 12,
        },
        "admin@example.com",
        persistence
      ),
    /Restáuralo desde Sabores archivados/
  )
})

test("ante error de DB no se persiste seed ni JSON legacy", async () => {
  const failingPersistence: CakeFlavorPersistence = {
    async listActiveRows() {
      throw new Error("db down")
    },
    async listArchivedRows() {
      throw new Error("no esperado")
    },
    async findAnyRowBySlug() {
      throw new Error("no esperado")
    },
    async findActiveRowBySlug() {
      throw new Error("no esperado")
    },
    async getMaxActiveDisplayOrder() {
      throw new Error("no esperado")
    },
    async hasHistoricalOrdersForFlavor() {
      throw new Error("no esperado")
    },
    async insertRow() {
      throw new Error("no esperado")
    },
    async updateRow() {
      throw new Error("no esperado")
    },
    async insertRevision() {
      throw new Error("no esperado")
    },
    async setDisplayOrder() {
      throw new Error("no esperado")
    },
    async deleteRow() {
      throw new Error("no esperado")
    },
  }

  await assert.rejects(() => getCatalogFlavorRecordsFromPersistence(failingPersistence), /db down/)
  await assert.rejects(() => saveCatalogFlavorRecords(), /JSON legacy está desactivada/)
})

test("el CRUD admin ya no importa la escritura JSON legacy", async () => {
  const source = await readFile(resolve("actions/cake-catalog.ts"), "utf8")

  assert.doesNotMatch(source, /saveCatalogFlavorRecords/)
  assert.match(source, /createCakeFlavorRecordInDb/)
  assert.match(source, /softDeleteCakeFlavorRecordInDb/)
  assert.match(source, /restoreCakeFlavorRecordInDb/)
  assert.match(source, /hardDeleteArchivedCakeFlavorRecordInDb/)
})

test("la UI presenta el soft-delete como archivo y no como borrado irreversible", async () => {
  const source = await readFile(resolve("src/components/admin/cake-catalog-editor.tsx"), "utf8")

  assert.match(source, /Archivar sabor/)
  assert.match(source, /Sabores archivados/)
  assert.match(source, /Restaurar sabor/)
  assert.match(source, /Eliminar definitivamente/)
  assert.match(source, /archivedFlavors\.map[\s\S]*Eliminar definitivamente/)
  assert.match(source, /Descartar cambios/)
  assert.doesNotMatch(source, /Borrar sabor/)
  assert.doesNotMatch(source, /no se puede deshacer/)
})
