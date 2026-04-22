import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminUser } from "@/lib/admin-auth"
import { uploadCatalogImage } from "@/lib/admin/catalog-images"

const uploadPayloadSchema = z.object({
  slug: z.string().min(1),
  variant: z.enum(["tarta", "cajita"]),
})

export async function POST(request: Request) {
  try {
    await requireAdminUser()

    const formData = await request.formData()
    const file = formData.get("file")
    const payload = uploadPayloadSchema.parse({
      slug: formData.get("slug"),
      variant: formData.get("variant"),
    })

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Falta la imagen" }, { status: 400 })
    }

    const uploaded = await uploadCatalogImage({
      slug: payload.slug,
      variant: payload.variant,
      file,
    })

    return NextResponse.json({
      ok: true,
      path: uploaded.path,
      publicUrl: uploaded.publicUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo subir la imagen"
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
