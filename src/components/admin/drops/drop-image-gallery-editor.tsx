"use client"

import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { CatalogImageUpload } from "@/src/components/admin/catalog-image-upload"
import {
  MAX_DROP_IMAGES,
  addDropSecondaryImage,
  makeDropImagePrimary,
  moveDropSecondaryImage,
  normalizeDropImageList,
  removeDropImage,
  replaceDropPrimaryImage,
} from "@/src/data/drop-images"

type DropImageGalleryEditorProps = {
  images: string[]
  uploadSlug: string
  disabled?: boolean
  onChange: (images: string[]) => void
}

export function DropImageGalleryEditor({
  images,
  uploadSlug,
  disabled = false,
  onChange,
}: DropImageGalleryEditorProps) {
  const normalizedImages = normalizeDropImageList(images)
  const primaryImage = normalizedImages[0] ?? ""
  const secondaryImages = normalizedImages.slice(1)
  const hasRoom = normalizedImages.length < MAX_DROP_IMAGES

  function setImages(nextImages: string[]) {
    onChange(normalizeDropImageList(nextImages))
  }

  function replacePrimary(publicUrl: string) {
    setImages(replaceDropPrimaryImage(normalizedImages, publicUrl))
  }

  function addSecondary(publicUrl: string) {
    if (!publicUrl) return
    if (!hasRoom && !normalizedImages.includes(publicUrl)) {
      toast.error(`Puedes subir como máximo ${MAX_DROP_IMAGES} imágenes por drop`)
      return
    }
    setImages(addDropSecondaryImage(normalizedImages, publicUrl))
  }

  function removeImage(index: number) {
    setImages(removeDropImage(normalizedImages, index))
  }

  function makePrimary(index: number) {
    setImages(makeDropImagePrimary(normalizedImages, index))
  }

  function moveSecondary(index: number, direction: -1 | 1) {
    setImages(moveDropSecondaryImage(normalizedImages, index, direction))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <CatalogImageUpload
          label="Imagen principal"
          value={primaryImage}
          slug={uploadSlug}
          variant="drop"
          onChange={replacePrimary}
          disabled={disabled}
          showValueText={false}
        />
        <p className="text-xs text-muted-foreground">
          Se usa en listados y portada de la ficha. Puedes quitarla en borradores, pero es obligatoria para publicar.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">Imágenes secundarias</p>
          <p className="text-xs text-muted-foreground">
            Añade hasta {MAX_DROP_IMAGES - 1} imágenes más, reordénalas o conviértelas en principal.
          </p>
        </div>

        {hasRoom ? (
          <CatalogImageUpload
            label="Añadir imagen secundaria"
            value=""
            slug={uploadSlug}
            variant="drop"
            onChange={addSecondary}
            disabled={disabled}
            showValueText={false}
          />
        ) : (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Has alcanzado el máximo de {MAX_DROP_IMAGES} imágenes.
          </p>
        )}

        {secondaryImages.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {secondaryImages.map((image, index) => {
              const absoluteIndex = index + 1
              return (
                <article key={image} className="overflow-hidden rounded-md border border-border bg-card">
                  <div
                    role="img"
                    aria-label={`Imagen secundaria ${index + 1}`}
                    className="aspect-[4/3] bg-muted bg-cover bg-center"
                    style={{ backgroundImage: `url("${image}")` }}
                  />
                  <div className="grid grid-cols-4 gap-1 p-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => makePrimary(absoluteIndex)} disabled={disabled} aria-label={`Convertir imagen secundaria ${index + 1} en principal`}>
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveSecondary(index, -1)} disabled={disabled || index === 0} aria-label={`Subir imagen secundaria ${index + 1}`}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveSecondary(index, 1)} disabled={disabled || index === secondaryImages.length - 1} aria-label={`Bajar imagen secundaria ${index + 1}`}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeImage(absoluteIndex)} disabled={disabled} aria-label={`Eliminar imagen secundaria ${index + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No hay imágenes secundarias.
          </p>
        )}
      </div>
    </div>
  )
}
