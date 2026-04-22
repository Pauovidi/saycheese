import { randomUUID } from "crypto"

import { slugifyFlavorName } from "@/src/data/products"

export const IMAGE_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const

const MIME_TO_EXTENSION: Record<(typeof ALLOWED_IMAGE_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

export type CatalogImageVariant = "tarta" | "cajita"

function normalizeExtension(fileName: string, mimeType: string) {
  const rawExtension = fileName.split(".").pop()?.toLowerCase()
  if (rawExtension && /^[a-z0-9]+$/.test(rawExtension)) {
    return rawExtension === "jpeg" ? "jpg" : rawExtension
  }

  return MIME_TO_EXTENSION[mimeType as keyof typeof MIME_TO_EXTENSION] ?? "jpg"
}

export function assertValidCatalogImage(file: File) {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    throw new Error("Solo se admiten imágenes JPG, PNG, WEBP o AVIF")
  }

  if (file.size > IMAGE_UPLOAD_LIMIT_BYTES) {
    throw new Error("La imagen supera el máximo de 5 MB")
  }
}

export function buildCatalogImagePath({
  slug,
  variant,
  fileName,
  mimeType,
}: {
  slug: string
  variant: CatalogImageVariant
  fileName: string
  mimeType: string
}) {
  const safeSlug = slugifyFlavorName(slug) || "draft"
  const extension = normalizeExtension(fileName, mimeType)

  return `flavors/${safeSlug}/${variant}-${Date.now()}-${randomUUID()}.${extension}`
}
