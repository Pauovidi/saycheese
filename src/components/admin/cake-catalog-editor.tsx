"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { createCakeFlavor, deleteCakeFlavor, updateCakeFlavor } from "@/actions/cake-catalog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CatalogImageUpload } from "@/src/components/admin/catalog-image-upload"
import { slugifyFlavorName, type EditableFlavorRecord } from "@/src/data/products"

const NEW_FLAVOR_KEY = "__new__"

type FlavorFormState = {
  name: string
  description: string
  allergens: string
  tartaImage: string
  cajitaImage: string
  tartaPrice: string
  cajitaPrice: string
}

function flavorToForm(flavor: EditableFlavorRecord): FlavorFormState {
  return {
    name: flavor.name,
    description: flavor.description,
    allergens: flavor.allergens,
    tartaImage: flavor.tartaImage,
    cajitaImage: flavor.cajitaImage,
    tartaPrice: String(flavor.tartaPrice),
    cajitaPrice: String(flavor.cajitaPrice),
  }
}

function emptyForm(): FlavorFormState {
  return {
    name: "",
    description: "",
    allergens: "",
    tartaImage: "",
    cajitaImage: "",
    tartaPrice: "35",
    cajitaPrice: "12",
  }
}

function formatPricePreview(rawValue: string) {
  const numeric = Number(rawValue)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Sin precio"
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric).replace(/\u00A0/g, " ")
}

function FlavorPreviewCard({
  title,
  image,
  price,
  name,
  description,
}: {
  title: string
  image: string
  price: string
  name: string
  description: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="aspect-square bg-muted">
        {image ? (
          <div
            aria-label={`${name} ${title}`}
            role="img"
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url("${image}")` }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Sin imagen
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
            {title}
          </span>
          <span className="text-sm font-semibold text-primary">{price}</span>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-foreground">{name}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}

export function CakeCatalogEditor({ initialFlavors }: { initialFlavors: EditableFlavorRecord[] }) {
  const [flavors, setFlavors] = useState(initialFlavors)
  const [selectedSlug, setSelectedSlug] = useState(initialFlavors[0]?.slug ?? NEW_FLAVOR_KEY)
  const [form, setForm] = useState<FlavorFormState>(() =>
    initialFlavors[0] ? flavorToForm(initialFlavors[0]) : emptyForm()
  )
  const [isPending, startTransition] = useTransition()

  const selectedFlavor = flavors.find((flavor) => flavor.slug === selectedSlug)
  const isCreating = selectedSlug === NEW_FLAVOR_KEY
  const previewName = form.name.trim() || "Nuevo sabor"
  const previewDescription = form.description.trim() || "La descripción aparecerá aquí en la ficha del producto."
  const previewSlug = isCreating ? slugifyFlavorName(form.name) : selectedFlavor?.slug ?? ""
  const uploadSlug = previewSlug || selectedFlavor?.slug || "draft"

  function selectFlavor(slug: string) {
    const flavor = flavors.find((entry) => entry.slug === slug)
    if (!flavor) return

    setSelectedSlug(slug)
    setForm(flavorToForm(flavor))
  }

  function startCreatingFlavor() {
    setSelectedSlug(NEW_FLAVOR_KEY)
    setForm(emptyForm())
  }

  function resetForm() {
    if (!selectedFlavor) {
      setForm(emptyForm())
      return
    }

    setForm(flavorToForm(selectedFlavor))
  }

  function updateField<K extends keyof FlavorFormState>(field: K, value: FlavorFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      const payload = {
        name: form.name,
        description: form.description,
        allergens: form.allergens,
        tartaImage: form.tartaImage,
        cajitaImage: form.cajitaImage,
        tartaPrice: form.tartaPrice,
        cajitaPrice: form.cajitaPrice,
      }

      const response = isCreating
        ? await createCakeFlavor(payload)
        : await updateCakeFlavor({
            slug: selectedSlug,
            ...payload,
          })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      setFlavors(response.flavors)

      if (isCreating) {
        const createdSlug = slugifyFlavorName(form.name)
        const createdFlavor = response.flavors.find((flavor) => flavor.slug === createdSlug)
        setSelectedSlug(createdFlavor?.slug ?? response.flavors[0]?.slug ?? NEW_FLAVOR_KEY)
        setForm(createdFlavor ? flavorToForm(createdFlavor) : emptyForm())
        toast.success("Sabor creado")
        return
      }

      const updatedFlavor = response.flavors.find((flavor) => flavor.slug === selectedSlug)
      setForm(updatedFlavor ? flavorToForm(updatedFlavor) : form)
      toast.success("Cambios guardados")
    })
  }

  function handleDelete() {
    if (!selectedFlavor) return

    startTransition(async () => {
      const response = await deleteCakeFlavor({ slug: selectedFlavor.slug })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      setFlavors(response.flavors)
      const nextSelected = response.flavors[0]
      setSelectedSlug(nextSelected?.slug ?? NEW_FLAVOR_KEY)
      setForm(nextSelected ? flavorToForm(nextSelected) : emptyForm())
      toast.success("Sabor borrado")
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader className="space-y-3">
          <div>
            <CardTitle>Sabores actuales</CardTitle>
            <CardDescription className="mt-2">
              Esta lista alimenta la home, la tienda y las fichas de producto públicas.
            </CardDescription>
          </div>
          <Button onClick={startCreatingFlavor}>Crear sabor</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {flavors.map((flavor) => {
            const active = flavor.slug === selectedSlug

            return (
              <button
                key={flavor.slug}
                type="button"
                onClick={() => selectFlavor(flavor.slug)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{flavor.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      /producto/tarta-{flavor.slug}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground">
                    {flavor.position + 1}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Grande: {formatPricePreview(String(flavor.tartaPrice))}</span>
                  <span>Cajita: {formatPricePreview(String(flavor.cajitaPrice))}</span>
                </div>
              </button>
            )
          })}

          {flavors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No hay sabores todavía. Crea el primero desde aquí.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{isCreating ? "Nuevo sabor" : `Editando ${selectedFlavor?.name ?? ""}`}</CardTitle>
            <CardDescription>
              Guarda solo los campos que cambian en el catálogo. Peso, raciones, formato y conservación siguen fijos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Nombre / sabor</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="Ej. Queso azul con miel"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {isCreating
                      ? `La URL se generará como /producto/tarta-${previewSlug || "nuevo-sabor"}`
                      : `La URL pública se mantiene como /producto/tarta-${selectedFlavor?.slug}`}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tarta-price">Precio grande</Label>
                  <Input
                    id="tarta-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.tartaPrice}
                    onChange={(event) => updateField("tartaPrice", event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cajita-price">Precio cajita</Label>
                  <Input
                    id="cajita-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.cajitaPrice}
                    onChange={(event) => updateField("cajitaPrice", event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <CatalogImageUpload
                    label="Imagen grande"
                    value={form.tartaImage}
                    slug={uploadSlug}
                    variant="tarta"
                    onChange={(nextValue) => updateField("tartaImage", nextValue)}
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <CatalogImageUpload
                    label="Imagen cajita"
                    value={form.cajitaImage}
                    slug={uploadSlug}
                    variant="cajita"
                    onChange={(nextValue) => updateField("cajitaImage", nextValue)}
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                    rows={4}
                    placeholder="Describe el sabor tal como debe verse en la ficha pública."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="allergens">Alérgenos</Label>
                  <Textarea
                    id="allergens"
                    value={form.allergens}
                    onChange={(event) => updateField("allergens", event.target.value)}
                    rows={3}
                    placeholder="Ej. Leche, huevo, gluten, frutos de cáscara"
                  />
                  <p className="text-xs text-muted-foreground">
                    Escríbelos separados por comas. Esta información se muestra en la ficha pública.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Guardando..." : isCreating ? "Crear sabor" : "Guardar cambios"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
                  Restaurar
                </Button>
                {!isCreating && selectedFlavor ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" disabled={isPending}>
                        Borrar sabor
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Borrar {selectedFlavor.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminarán la tarta grande y la cajita de este sabor del catálogo público. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sí, borrar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vista previa en front</CardTitle>
            <CardDescription>
              Lo que ves aquí es el efecto directo sobre la home, `/productos` y las fichas públicas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FlavorPreviewCard
              title="Grande"
              image={form.tartaImage.trim()}
              price={formatPricePreview(form.tartaPrice)}
              name={previewName}
              description={previewDescription}
            />
            <FlavorPreviewCard
              title="Cajita"
              image={form.cajitaImage.trim()}
              price={formatPricePreview(form.cajitaPrice)}
              name={previewName}
              description={previewDescription}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
