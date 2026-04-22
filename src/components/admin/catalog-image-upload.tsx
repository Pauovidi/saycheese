"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type CatalogImageUploadProps = {
  label: string
  value: string
  slug: string
  variant: "tarta" | "cajita"
  onChange: (nextValue: string) => void
  disabled?: boolean
}

const MAX_SIZE_LABEL = "Máximo 5 MB. Formatos: JPG, PNG, WEBP o AVIF."

export function CatalogImageUpload({
  label,
  value,
  slug,
  variant,
  onChange,
  disabled = false,
}: CatalogImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const previewUrl = useMemo(() => localPreview ?? (value.trim() || null), [localPreview, value])

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview)
      }
    }
  }, [localPreview])

  function openPicker() {
    if (disabled || isUploading) return
    inputRef.current?.click()
  }

  function clearImage() {
    if (disabled || isUploading) return
    if (localPreview) {
      URL.revokeObjectURL(localPreview)
      setLocalPreview(null)
    }
    onChange("")
  }

  async function uploadFile(file: File) {
    const draftPreview = URL.createObjectURL(file)
    if (localPreview) {
      URL.revokeObjectURL(localPreview)
    }
    setLocalPreview(draftPreview)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("slug", slug)
      formData.set("variant", variant)

      const response = await fetch("/api/admin/catalog-images", {
        method: "POST",
        body: formData,
      })

      const payload = (await response.json()) as {
        ok: boolean
        error?: string
        publicUrl?: string
      }

      if (!response.ok || !payload.ok || !payload.publicUrl) {
        throw new Error(payload.error ?? "No se pudo subir la imagen")
      }

      URL.revokeObjectURL(draftPreview)
      setLocalPreview(null)
      onChange(payload.publicUrl)
      toast.success(`${label} subida`)
    } catch (error) {
      URL.revokeObjectURL(draftPreview)
      setLocalPreview(null)
      toast.error(error instanceof Error ? error.message : "No se pudo subir la imagen")
    } finally {
      setIsUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    void uploadFile(file)
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files)
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (disabled || isUploading) return
    handleFiles(event.dataTransfer.files)
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (disabled || isUploading) return
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{MAX_SIZE_LABEL}</p>
        </div>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearImage} disabled={disabled || isUploading}>
            <Trash2 className="mr-2 h-4 w-4" />
            Quitar
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />

      <button
        type="button"
        onClick={openPicker}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled || isUploading}
        className={`group flex w-full flex-col overflow-hidden rounded-xl border border-dashed transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
        } ${disabled || isUploading ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        <div className="aspect-[4/3] bg-muted">
          {previewUrl ? (
            <div
              role="img"
              aria-label={label}
              className="relative h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${previewUrl}")` }}
            >
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-medium text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              {isUploading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <ImagePlus className="h-7 w-7 text-primary" />}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Arrastra la imagen aquí o haz clic para seleccionarla
                </p>
                <p className="text-xs text-muted-foreground">
                  La URL final se rellenará sola al terminar la subida.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-foreground">
              {value ? "Imagen preparada" : "Sin imagen"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {value || "Selecciona o arrastra un archivo"}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
            <UploadCloud className="h-4 w-4" />
            {value ? "Reemplazar" : "Subir"}
          </span>
        </div>
      </button>
    </div>
  )
}
