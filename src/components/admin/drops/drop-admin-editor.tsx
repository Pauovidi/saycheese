"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { saveDrop } from "@/actions/drops"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { CatalogImageUpload } from "@/src/components/admin/catalog-image-upload"
import {
  DEFAULT_DROP_LAUNCH_LOCAL,
  DROP_LAUNCH_TIME_ZONE,
  getDropStatusLabel,
  utcIsoToDateTimeLocalInZone,
} from "@/src/data/drops"
import type { EditableDropRecord } from "@/src/data/drops-store"
import { slugifyFlavorName } from "@/src/data/products"

type DropFormState = {
  id?: string
  name: string
  slug: string
  description: string
  price: string
  imageUrls: string
  colors: string
  sizes: string
  stockTotal: string
  launchAtLocal: string
  launchTimezone: string
  isActive: boolean
  floatingEnabled: boolean
  floatingMessage: string
  isClosed: boolean
}

function emptyDropForm(): DropFormState {
  return {
    name: "",
    slug: "",
    description: "",
    price: "25",
    imageUrls: "",
    colors: "Blanco\nNegro",
    sizes: "S\nM\nL\nXL",
    stockTotal: "30",
    launchAtLocal: DEFAULT_DROP_LAUNCH_LOCAL,
    launchTimezone: DROP_LAUNCH_TIME_ZONE,
    isActive: false,
    floatingEnabled: false,
    floatingMessage: "",
    isClosed: false,
  }
}

function dropToForm(drop: EditableDropRecord): DropFormState {
  return {
    id: drop.id,
    name: drop.name,
    slug: drop.slug,
    description: drop.description,
    price: String(drop.price),
    imageUrls: drop.imageUrls.join("\n"),
    colors: drop.colors.join("\n"),
    sizes: drop.sizes.join("\n"),
    stockTotal: String(drop.stockTotal),
    launchAtLocal: utcIsoToDateTimeLocalInZone(drop.launchAt, drop.launchTimezone),
    launchTimezone: drop.launchTimezone,
    isActive: drop.isActive,
    floatingEnabled: drop.floatingEnabled,
    floatingMessage: drop.floatingMessage,
    isClosed: drop.isClosed,
  }
}

function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DROP_LAUNCH_TIME_ZONE,
  }).format(new Date(value))
}

export function DropAdminEditor({ initialDrops }: { initialDrops: EditableDropRecord[] }) {
  const [drops, setDrops] = useState(initialDrops)
  const [selectedId, setSelectedId] = useState(initialDrops[0]?.id ?? "new")
  const [form, setForm] = useState<DropFormState>(() => (initialDrops[0] ? dropToForm(initialDrops[0]) : emptyDropForm()))
  const [isPending, startTransition] = useTransition()
  const selectedDrop = drops.find((drop) => drop.id === selectedId)
  const uploadSlug = form.slug.trim() || slugifyFlavorName(form.name) || "draft"

  function updateField<K extends keyof DropFormState>(field: K, value: DropFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "name" && !current.id ? { slug: slugifyFlavorName(String(value)) } : {}),
    }))
  }

  function selectDrop(drop: EditableDropRecord) {
    setSelectedId(drop.id)
    setForm(dropToForm(drop))
  }

  function startNewDrop() {
    setSelectedId("new")
    setForm(emptyDropForm())
  }

  function handleUploadedImage(publicUrl: string) {
    const current = form.imageUrls
      .split(/\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
    const next = [publicUrl, ...current.filter((entry) => entry !== publicUrl)]
    updateField("imageUrls", next.join("\n"))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      const response = await saveDrop({
        ...form,
        price: Number(form.price),
        stockTotal: Number(form.stockTotal),
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      setDrops(response.drops)
      setSelectedId(response.selectedId)
      setForm(dropToForm(response.drop))
      toast.success("Drop guardado")
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <div>
              <CardTitle>Drops</CardTitle>
              <CardDescription className="mt-2">
                Solo puede haber un drop público activo para el hero en esta versión.
              </CardDescription>
            </div>
            <Button onClick={startNewDrop}>Crear drop</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {drops.map((drop) => (
              <button
                key={drop.id}
                type="button"
                onClick={() => selectDrop(drop)}
                className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                  drop.id === selectedId ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{drop.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">/drops/{drop.slug}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                    {getDropStatusLabel(drop.status)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Total: {drop.stock.stockTotal}</span>
                  <span>Disponible: {drop.stock.availableStock}</span>
                  <span>Reservado: {drop.stock.reservedUnits}</span>
                  <span>Pedido: {drop.stock.orderedUnits}</span>
                </div>
              </button>
            ))}
            {!drops.length ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                No hay drops todavía.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{form.id ? `Editando ${form.name}` : "Nuevo drop"}</CardTitle>
            <CardDescription>
              Valores seguros por defecto: inactivo, flotante oculto y lanzamiento en Atlantic/Canary.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="drop-name">Nombre</Label>
              <Input id="drop-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-slug">Slug</Label>
              <Input id="drop-slug" value={form.slug} onChange={(event) => updateField("slug", event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-price">Precio</Label>
              <Input id="drop-price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => updateField("price", event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-stock">Stock total</Label>
              <Input id="drop-stock" type="number" min="0" step="1" value={form.stockTotal} onChange={(event) => updateField("stockTotal", event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-launch">Lanzamiento</Label>
              <Input id="drop-launch" type="datetime-local" value={form.launchAtLocal} onChange={(event) => updateField("launchAtLocal", event.target.value)} required />
              <p className="text-xs text-muted-foreground">Zona: {form.launchTimezone}</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="drop-description">Descripción</Label>
              <Textarea id="drop-description" rows={4} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-sizes">Tallas</Label>
              <Textarea id="drop-sizes" rows={5} value={form.sizes} onChange={(event) => updateField("sizes", event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-colors">Colores</Label>
              <Textarea id="drop-colors" rows={5} value={form.colors} onChange={(event) => updateField("colors", event.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <CatalogImageUpload
                label="Subir imagen principal"
                value={form.imageUrls.split(/\n/).find(Boolean) ?? ""}
                slug={uploadSlug}
                variant="drop"
                onChange={handleUploadedImage}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="drop-images">Imágenes</Label>
              <Textarea id="drop-images" rows={4} value={form.imageUrls} onChange={(event) => updateField("imageUrls", event.target.value)} />
              <p className="text-xs text-muted-foreground">Una URL por línea. La primera será la imagen principal.</p>
            </div>

            <div className="grid gap-4 rounded-md border border-border p-4 md:col-span-2 md:grid-cols-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Drop activo</span>
                <Switch checked={form.isActive} onCheckedChange={(checked) => updateField("isActive", checked)} />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Flotante activo</span>
                <Switch checked={form.floatingEnabled} onCheckedChange={(checked) => updateField("floatingEnabled", checked)} />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Cerrado</span>
                <Switch checked={form.isClosed} onCheckedChange={(checked) => updateField("isClosed", checked)} />
              </label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="drop-floating-message">Mensaje exacto del flotante</Label>
              <Textarea
                id="drop-floating-message"
                rows={4}
                maxLength={600}
                value={form.floatingMessage}
                onChange={(event) => updateField("floatingMessage", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {selectedDrop ? (
          <Card>
            <CardHeader>
              <CardTitle>Stock</CardTitle>
              <CardDescription>El stock disponible se calcula con reservas activas y pedidos no anulados.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
              <div>Total: {selectedDrop.stock.stockTotal}</div>
              <div>Reservado: {selectedDrop.stock.reservedUnits}</div>
              <div>Pedido: {selectedDrop.stock.orderedUnits}</div>
              <div>Disponible: {selectedDrop.stock.availableStock}</div>
              <div className="sm:col-span-4">Lanzamiento: {formatAdminDate(selectedDrop.launchAt)} ({selectedDrop.launchTimezone})</div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar drop"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setForm(form.id && selectedDrop ? dropToForm(selectedDrop) : emptyDropForm())} disabled={isPending}>
            Descartar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
