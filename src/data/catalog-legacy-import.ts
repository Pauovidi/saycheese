import { sortFlavorRecords, type EditableFlavorRecord } from "@/src/data/products"
import { buildFlavorRevisionSnapshot } from "@/src/data/products-db-store"

export const LEGACY_CATALOG_IMPORT_ACTION = "import_legacy_json"

export type ImportedFlavorReference = {
  id: string
  slug: string
}

export type LegacyCatalogImportPersistence = {
  upsertImportedFlavor(record: EditableFlavorRecord): Promise<ImportedFlavorReference>
  hasImportRevision(slug: string): Promise<boolean>
  createImportRevision(input: {
    flavorId: string
    slug: string
    snapshot: Record<string, unknown>
    actor: string | null
  }): Promise<void>
}

export async function importLegacyCatalogRecords({
  records,
  persistence,
  actor = "legacy-json-import",
}: {
  records: EditableFlavorRecord[]
  persistence: LegacyCatalogImportPersistence
  actor?: string | null
}) {
  const imported: ImportedFlavorReference[] = []

  for (const record of sortFlavorRecords(records)) {
    const upserted = await persistence.upsertImportedFlavor(record)
    const hasRevision = await persistence.hasImportRevision(record.slug)

    if (!hasRevision) {
      await persistence.createImportRevision({
        flavorId: upserted.id,
        slug: record.slug,
        snapshot: buildFlavorRevisionSnapshot(record),
        actor,
      })
    }

    imported.push(upserted)
  }

  return {
    importedCount: imported.length,
    slugs: imported.map((record) => record.slug),
  }
}
