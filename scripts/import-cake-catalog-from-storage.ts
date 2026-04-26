import { pathToFileURL } from "node:url"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { parseCatalogDocument } from "../src/data/catalog-document"
import {
  LEGACY_CATALOG_IMPORT_ACTION,
  importLegacyCatalogRecords,
  type LegacyCatalogImportPersistence,
} from "../src/data/catalog-legacy-import"
import type { EditableFlavorRecord } from "../src/data/products"

const LEGACY_CATALOG_BUCKET = "saycheese-admin"
const LEGACY_CATALOG_OBJECT = "catalog/tartas.json"

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type CatalogImportDatabase = {
  public: {
    Tables: {
      cake_flavors: {
        Row: {
          id: string
          slug: string
        }
        Insert: {
          slug: string
          name: string
          description: string
          allergens: string
          price_large: number
          price_box: number
          image_large_url: string
          image_box_url: string
          display_order: number
          is_active: boolean
          deleted_at: string | null
        }
        Update: Partial<CatalogImportDatabase["public"]["Tables"]["cake_flavors"]["Insert"]>
        Relationships: []
      }
      cake_flavor_revisions: {
        Row: {
          id: string
        }
        Insert: {
          flavor_id: string
          action: string
          slug: string
          snapshot: Json
          actor: string | null
        }
        Update: Partial<CatalogImportDatabase["public"]["Tables"]["cake_flavor_revisions"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type CatalogImportSupabase = SupabaseClient<CatalogImportDatabase>

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}; no se ha tocado Supabase`)
  }

  return value
}

function createSupabaseImportPersistence(
  supabase: CatalogImportSupabase
): LegacyCatalogImportPersistence {
  return {
    async upsertImportedFlavor(record: EditableFlavorRecord) {
      const { data, error } = await supabase
        .from("cake_flavors")
        .upsert(
          {
            slug: record.slug,
            name: record.name,
            description: record.description,
            allergens: record.allergens,
            price_large: record.tartaPrice,
            price_box: record.cajitaPrice,
            image_large_url: record.tartaImage,
            image_box_url: record.cajitaImage,
            display_order: record.position,
            is_active: true,
            deleted_at: null,
          },
          { onConflict: "slug" }
        )
        .select("id, slug")
        .single()

      if (error) throw new Error(error.message)
      return data as { id: string; slug: string }
    },

    async hasImportRevision(slug: string) {
      const { data, error } = await supabase
        .from("cake_flavor_revisions")
        .select("id")
        .eq("slug", slug)
        .eq("action", LEGACY_CATALOG_IMPORT_ACTION)
        .limit(1)
        .maybeSingle()

      if (error) throw new Error(error.message)
      return Boolean(data)
    },

    async createImportRevision({ flavorId, slug, snapshot, actor }) {
      const { error } = await supabase.from("cake_flavor_revisions").insert({
        flavor_id: flavorId,
        action: LEGACY_CATALOG_IMPORT_ACTION,
        slug,
        snapshot: snapshot as Json,
        actor,
      })

      if (error) throw new Error(error.message)
    },
  }
}

async function readLegacyCatalogDocument(supabase: CatalogImportSupabase) {
  const { data, error } = await supabase.storage.from(LEGACY_CATALOG_BUCKET).download(LEGACY_CATALOG_OBJECT)

  if (error) {
    throw new Error(`No se pudo descargar ${LEGACY_CATALOG_BUCKET}/${LEGACY_CATALOG_OBJECT}: ${error.message}`)
  }

  const document = parseCatalogDocument(await data.text())

  if (!document) {
    throw new Error("El JSON legacy existe pero no tiene un documento de catálogo válido; no se ha importado nada")
  }

  return document
}

export async function runLegacyCatalogImport() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const supabase = createClient<CatalogImportDatabase>(supabaseUrl, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const document = await readLegacyCatalogDocument(supabase)
  const result = await importLegacyCatalogRecords({
    records: document.flavors,
    persistence: createSupabaseImportPersistence(supabase),
  })

  console.log(`Importación completada: ${result.importedCount} sabores procesados.`)
  console.log(`Slugs: ${result.slugs.join(", ")}`)
}

const currentScriptUrl = pathToFileURL(process.argv[1] ?? "").href

if (import.meta.url === currentScriptUrl) {
  runLegacyCatalogImport().catch((error) => {
    console.error(error instanceof Error ? error.message : "No se pudo completar la importación")
    process.exitCode = 1
  })
}
