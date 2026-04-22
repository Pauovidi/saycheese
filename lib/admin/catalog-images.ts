import "server-only"

import { getAdminClient } from "@/lib/supabase/admin"
import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_UPLOAD_LIMIT_BYTES,
  assertValidCatalogImage,
  buildCatalogImagePath,
  type CatalogImageVariant,
} from "@/lib/admin/catalog-image-utils"

export const CATALOG_IMAGES_BUCKET = "saycheese-product-images"

export async function ensureCatalogImagesBucket() {
  const supabase = getAdminClient()
  const { data: bucket, error } = await supabase.storage.getBucket(CATALOG_IMAGES_BUCKET)

  if (bucket) {
    return supabase
  }

  if (error && !/not found/i.test(error.message)) {
    throw new Error(error.message)
  }

  const { error: createError } = await supabase.storage.createBucket(CATALOG_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: IMAGE_UPLOAD_LIMIT_BYTES,
    allowedMimeTypes: [...ALLOWED_IMAGE_MIME_TYPES],
  })

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(createError.message)
  }

  return supabase
}

export async function uploadCatalogImage({
  slug,
  variant,
  file,
}: {
  slug: string
  variant: CatalogImageVariant
  file: File
}) {
  assertValidCatalogImage(file)

  const supabase = await ensureCatalogImagesBucket()
  const path = buildCatalogImagePath({
    slug,
    variant,
    fileName: file.name,
    mimeType: file.type,
  })

  const { error } = await supabase.storage.from(CATALOG_IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(path)

  return {
    path,
    publicUrl: data.publicUrl,
  }
}
