"use client"

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { archiveDropFromAdmin, saveDrop, unarchiveDropFromAdmin } from "@/actions/drops"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DropImageGalleryEditor } from "@/src/components/admin/drops/drop-image-gallery-editor"
import { HeroDropFloatingCard } from "@/src/components/drops/hero-drop-floating"
import {
  DEFAULT_DROP_LAUNCH_LOCAL,
  DEFAULT_DROP_PREORDER_CTA_TEXT,
  DROP_LAUNCH_TIME_ZONE,
  getDropStatusLabel,
  getDropPublicStatus,
  localDateTimeToUtcIso,
  normalizeDropPreorderCtaText,
  utcIsoToDateTimeLocalInZone,
} from "@/src/data/drops"
import type { DropModuleAvailability } from "@/src/data/drop-storage-status"
import type { EditableDropRecord } from "@/src/data/drops-store"
import { slugifyFlavorName } from "@/src/data/products"

type DropAdminEditorProps = {
  initialDrops: EditableDropRecord[]
  moduleAvailability?: DropModuleAvailability
  moduleMessage?: string
  preorderCtaTextMigrated?: boolean
  capabilityMessage?: string
}

type DropFormState = {
  id?: string
  name: string
  slug: string
  description: string
  price: string
  imageUrls: string[]
  colors: string
  sizeStockEnabled: boolean
  sizeStock: Array<{ size: string; stockTotal: string; position: number }>
  stockTotal: string
  launchAtLocal: string
  launchTimezone: string
  isActive: boolean
  floatingEnabled: boolean
  floatingMessage: string
  preorderCtaText: string
  isClosed: boolean
}

function emptyDropForm(): DropFormState {
  return {
    name: "",
    slug: "",
    description: "",
    price: "25",
    imageUrls: [],
    colors: "Blanco\nNegro",
    sizeStockEnabled: false,
    sizeStock: [
      { size: "S", stockTotal: "0", position: 0 },
      { size: "M", stockTotal: "0", position: 1 },
      { size: "L", stockTotal: "0", position: 2 },
      { size: "XL", stockTotal: "0", position: 3 },
    ],
    stockTotal: "30",
    launchAtLocal: DEFAULT_DROP_LAUNCH_LOCAL,
    launchTimezone: DROP_LAUNCH_TIME_ZONE,
    isActive: false,
    floatingEnabled: false,
    floatingMessage: "",
    preorderCtaText: DEFAULT_DROP_PREORDER_CTA_TEXT,
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
    imageUrls: drop.imageUrls,
    colors: drop.colors.join("\n"),
    sizeStockEnabled: drop.sizeStockEnabled,
    sizeStock: (drop.stock.sizeStock.length ? drop.stock.sizeStock : drop.sizes.map((size, index) => ({
      size,
      stockTotal: "0",
      position: index,
    }))).map((entry, index) => ({
      size: entry.size,
      stockTotal: String(entry.stockTotal),
      position: entry.position ?? index,
    })),
    stockTotal: String(drop.stockTotal),
    launchAtLocal: utcIsoToDateTimeLocalInZone(drop.launchAt, drop.launchTimezone),
    launchTimezone: drop.launchTimezone,
    isActive: drop.isActive,
    floatingEnabled: drop.floatingEnabled,
    floatingMessage: drop.floatingMessage,
    preorderCtaText: drop.preorderCtaText,
    isClosed: drop.isClosed,
  }
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
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

export function DropAdminEditor({
  initialDrops,
  moduleAvailability = "READY",
  moduleMessage,
  preorderCtaTextMigrated = true,
  capabilityMessage,
}: DropAdminEditorProps) {
  const [drops, setDrops] = useState(initialDrops)
  const [selectedId, setSelectedId] = useState(initialDrops[0]?.id ?? "new")
  const [form, setForm] = useState<DropFormState>(() => (initialDrops[0] ? dropToForm(initialDrops[0]) : emptyDropForm()))
  const [now, setNow] = useState(() => new Date())
  const [isPending, startTransition] = useTransition()
  const moduleReady = moduleAvailability === "READY"
  const selectedDrop = drops.find((drop) => drop.id === selectedId)
  const visibleDrops = drops.filter((drop) => !drop.archivedAt)
  const archivedDrops = drops.filter((drop) => Boolean(drop.archivedAt))
  const uploadSlug = form.slug.trim() || slugifyFlavorName(form.name) || "draft"
  const previewLaunchAt = useMemo(() => {
    try {
      return localDateTimeToUtcIso(form.launchAtLocal, form.launchTimezone || DROP_LAUNCH_TIME_ZONE)
    } catch {
      return new Date().toISOString()
    }
  }, [form.launchAtLocal, form.launchTimezone])
  const sizeStockTotal = form.sizeStock.reduce((sum, entry) => sum + Math.max(0, Number(entry.stockTotal) || 0), 0)
  const previewAvailableStock = form.sizeStockEnabled ? sizeStockTotal : Math.max(0, Number(form.stockTotal) || 0)
  const sizeStockHasSellable = sizeStockTotal > 0 && form.sizeStock.some((entry) => entry.size.trim() && Math.max(0, Number(entry.stockTotal) || 0) > 0)
  const selectedOrderedSizes = new Set(selectedDrop?.stock.sizeStock.filter((entry) => entry.orderedUnits > 0).map((entry) => entry.size) ?? [])
  const previewStatus = getDropPublicStatus(
    {
      isActive: form.isActive,
      isClosed: form.isClosed,
      launchAt: previewLaunchAt,
      availableStock: previewAvailableStock,
    },
    now
  )
  const previewCountdown = formatCountdown(new Date(previewLaunchAt).getTime() - now.getTime())
  const activePrelaunchHidden = form.isActive && previewStatus === "PRELAUNCH" && !form.floatingEnabled
  const statusSummary = form.isClosed
    ? "Drop cerrado manualmente."
    : selectedDrop?.archivedAt
      ? "Drop archivado."
      : !form.isActive
      ? "Drop inactivo."
      : previewStatus === "PRELAUNCH" && form.floatingEnabled
        ? "Preventa activa con flotante visible."
        : previewStatus === "PRELAUNCH"
          ? "Preventa activa con flotante oculto."
          : previewStatus === "LIVE"
            ? "Drop en venta."
            : previewStatus === "SOLD_OUT"
              ? "Drop agotado."
              : "Drop inactivo."

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  function updateField<K extends keyof DropFormState>(field: K, value: DropFormState[K]) {
    if (!moduleReady) return
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "sizeStockEnabled" && value === true && current.sizeStock.length === 0
        ? {
            sizeStock: [
              { size: "S", stockTotal: "0", position: 0 },
              { size: "M", stockTotal: "0", position: 1 },
              { size: "L", stockTotal: "0", position: 2 },
              { size: "XL", stockTotal: "0", position: 3 },
            ],
          }
        : {}),
      ...(field === "name" && !current.id ? { slug: slugifyFlavorName(String(value)) } : {}),
    }))
  }

  function updateSizeStock(index: number, field: "size" | "stockTotal", value: string) {
    if (!moduleReady) return
    setForm((current) => ({
      ...current,
      sizeStock: current.sizeStock.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      ),
    }))
  }

  function addSizeStockRow() {
    if (!moduleReady) return
    setForm((current) => ({
      ...current,
      sizeStock: [...current.sizeStock, { size: "", stockTotal: "0", position: current.sizeStock.length }],
    }))
  }

  function removeSizeStockRow(index: number) {
    if (!moduleReady) return
    const entry = form.sizeStock[index]
    if (entry && selectedOrderedSizes.has(entry.size)) {
      toast.error("No se puede eliminar una talla con pedidos existentes. Pon su stock a 0 si ya no quieres venderla.")
      return
    }
    setForm((current) => ({
      ...current,
      sizeStock: current.sizeStock.filter((_, entryIndex) => entryIndex !== index).map((item, position) => ({ ...item, position })),
    }))
  }

  function selectDrop(drop: EditableDropRecord) {
    if (!moduleReady) return
    setSelectedId(drop.id)
    setForm(dropToForm(drop))
  }

  function startNewDrop() {
    if (!moduleReady) return
    setSelectedId("new")
    setForm(emptyDropForm())
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!moduleReady) return

    startTransition(async () => {
      const response = await saveDrop({
        ...form,
        price: Number(form.price),
        stockTotal: Number(form.stockTotal),
        sizeStockEnabled: form.sizeStockEnabled,
        sizes: form.sizeStock.map((entry) => entry.size),
        sizeStock: form.sizeStock.map((entry, index) => ({
          size: entry.size,
          stockTotal: form.sizeStockEnabled ? Number(entry.stockTotal) : 0,
          position: index,
        })),
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

  function handleArchive() {
    if (!selectedDrop) return
    const reason = window.prompt("Archivar ocultará el drop del front y bloqueará preventas/ventas, pero conservará reservas, pedidos e historial.\n\nMotivo opcional:") ?? undefined

    startTransition(async () => {
      const response = await archiveDropFromAdmin({ dropId: selectedDrop.id, reason })
      if (!response.ok) {
        toast.error(response.error)
        return
      }
      setDrops(response.drops)
      setSelectedId(response.selectedId)
      setForm(dropToForm(response.drop))
      toast.success("Drop archivado")
    })
  }

  function handleUnarchive() {
    if (!selectedDrop) return

    startTransition(async () => {
      const response = await unarchiveDropFromAdmin({ dropId: selectedDrop.id })
      if (!response.ok) {
        toast.error(response.error)
        return
      }
      setDrops(response.drops)
      setSelectedId(response.selectedId)
      setForm(dropToForm(response.drop))
      toast.success("Drop desarchivado")
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-6">
        {!moduleReady ? (
          <Card className="border-amber-300 bg-amber-50 text-amber-950">
            <CardHeader>
              <CardTitle>Módulo no inicializado</CardTitle>
              <CardDescription className="text-amber-900">
                {moduleMessage ?? "La migración de Drops todavía no está aplicada en este entorno."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {moduleReady && !preorderCtaTextMigrated ? (
          <Card className="border-amber-300 bg-amber-50 text-amber-950">
            <CardHeader>
              <CardTitle>Actualización pendiente</CardTitle>
              <CardDescription className="text-amber-900">
                {capabilityMessage ?? "El CTA configurable todavía no está migrado. Puedes previsualizar con fallback, pero no guardar un CTA personalizado."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="space-y-3">
            <div>
              <CardTitle>Drops</CardTitle>
              <CardDescription className="mt-2">
                Solo puede haber un drop público activo para el hero en esta versión.
              </CardDescription>
            </div>
            <Button onClick={startNewDrop} disabled={!moduleReady}>
              Crear drop
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { title: "Activos / borradores / cerrados", items: visibleDrops },
              { title: "Archivados", items: archivedDrops },
            ].map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{section.title}</p>
                {section.items.map((drop) => (
                  <button
                    key={drop.id}
                    type="button"
                    onClick={() => selectDrop(drop)}
                    disabled={!moduleReady}
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
                        {drop.archivedAt ? "Archivado" : getDropStatusLabel(drop.status)}
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
                {!section.items.length ? (
                  <p className="rounded-md border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                    Sin elementos.
                  </p>
                ) : null}
              </div>
            ))}
            {!drops.length ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                {moduleReady ? "No hay drops todavía." : moduleMessage ?? "La migración de Drops todavía no está aplicada en este entorno."}
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
              <Input id="drop-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} required disabled={!moduleReady} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-slug">Slug</Label>
              <Input id="drop-slug" value={form.slug} onChange={(event) => updateField("slug", event.target.value)} required disabled={!moduleReady} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-price">Precio</Label>
              <Input id="drop-price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => updateField("price", event.target.value)} required disabled={!moduleReady} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-stock">Stock total</Label>
              <Input
                id="drop-stock"
                type="number"
                min="0"
                step="1"
                value={form.sizeStockEnabled ? String(sizeStockTotal) : form.stockTotal}
                onChange={(event) => updateField("stockTotal", event.target.value)}
                required
                disabled={!moduleReady || form.sizeStockEnabled}
              />
              <p className="text-xs text-muted-foreground">
                {form.sizeStockEnabled
                  ? "El stock total se calcula automáticamente sumando las tallas activas."
                  : "Editable cuando el drop se vende sin tallas."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-launch">Lanzamiento</Label>
              <Input id="drop-launch" type="datetime-local" value={form.launchAtLocal} onChange={(event) => updateField("launchAtLocal", event.target.value)} required disabled={!moduleReady} />
              <p className="text-xs text-muted-foreground">Zona: {form.launchTimezone}</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="drop-description">Descripción</Label>
              <Textarea id="drop-description" rows={4} value={form.description} onChange={(event) => updateField("description", event.target.value)} disabled={!moduleReady} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-colors">Colores</Label>
              <Textarea id="drop-colors" rows={5} value={form.colors} onChange={(event) => updateField("colors", event.target.value)} disabled={!moduleReady} />
            </div>

            <div className="space-y-3 md:col-span-2">
              <label className="flex items-start justify-between gap-4 rounded-md border border-border p-4">
                <span>
                  <span className="block text-sm font-semibold text-foreground">Usar tallas y stock por talla</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    Las tallas siempre se usan durante la preventa. Al activarlo, también controlan el stock disponible por talla en la venta normal.
                  </span>
                </span>
                <Switch
                  checked={form.sizeStockEnabled}
                  onCheckedChange={(checked) => updateField("sizeStockEnabled", checked)}
                  disabled={!moduleReady}
                  aria-label="Usar tallas y stock por talla"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Tallas de preventa y stock de venta</p>
                  <p className="text-xs text-muted-foreground">
                    {form.sizeStockEnabled
                      ? `Stock calculado desde tallas activas: ${sizeStockTotal}.`
                      : "Las tallas se pueden pedir en preventa; sus cantidades no afectan al stock de la venta normal."}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={addSizeStockRow} disabled={!moduleReady}>
                  Añadir talla
                </Button>
              </div>
              {form.sizeStockEnabled && !sizeStockHasSellable ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  Si activas el modo por talla, configura al menos una talla con stock antes de publicar o vender.
                </p>
              ) : null}
              <div className="overflow-x-auto border border-border">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-secondary text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Talla</th>
                      <th className="px-3 py-2">Stock total</th>
                      <th className="px-3 py-2">Pedido</th>
                      <th className="px-3 py-2">Disponible por talla</th>
                      <th className="px-3 py-2">Vendible ahora</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.sizeStock.map((entry, index) => {
                      const saved = selectedDrop?.stock.sizeStock.find((item) => item.size === entry.size)
                      return (
                        <tr key={`${entry.position}-${index}`} className="border-t border-border">
                          <td className="px-3 py-2">
                            <Input value={entry.size} onChange={(event) => updateSizeStock(index, "size", event.target.value)} disabled={!moduleReady} />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="1" value={entry.stockTotal} onChange={(event) => updateSizeStock(index, "stockTotal", event.target.value)} disabled={!moduleReady || !form.sizeStockEnabled} />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{saved?.orderedUnits ?? 0}</td>
                          <td className="px-3 py-2 text-muted-foreground">{saved?.availableRaw ?? Math.max(0, Number(entry.stockTotal) || 0)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{saved?.sellableNow ?? Math.min(Math.max(0, Number(entry.stockTotal) || 0), previewAvailableStock)}</td>
                          <td className="px-3 py-2">
                            <Button type="button" variant="outline" onClick={() => removeSizeStockRow(index)} disabled={!moduleReady || selectedOrderedSizes.has(entry.size)}>
                              Quitar
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <DropImageGalleryEditor
                images={form.imageUrls}
                uploadSlug={uploadSlug}
                onChange={(images) => updateField("imageUrls", images)}
                disabled={isPending || !moduleReady}
              />
            </div>

            <div className="space-y-3 md:col-span-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Estado del drop</p>
                <p className="text-xs text-muted-foreground">{statusSummary}</p>
              </div>
              {activePrelaunchHidden ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  El drop está activo, pero el flotante de preventa está oculto.
                </p>
              ) : null}
              {form.isClosed ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  El drop está cerrado: no admite reservas ni pedidos.
                </p>
              ) : null}
              {selectedDrop?.archivedAt ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  Este drop está archivado: no aparece en la web ni admite reservas o pedidos.
                </p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex min-h-28 flex-col justify-between gap-4 rounded-md border border-border p-4">
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Publicar drop</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Permite que el drop entre en preventa o venta según la fecha configurada.
                    </span>
                  </span>
                  <Switch checked={form.isActive} onCheckedChange={(checked) => updateField("isActive", checked)} disabled={!moduleReady || Boolean(selectedDrop?.archivedAt)} aria-label="Publicar drop" />
                </label>
                <label className="flex min-h-28 flex-col justify-between gap-4 rounded-md border border-border p-4">
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Mostrar flotante de preventa</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Muestra el aviso en el hero solo antes del lanzamiento.
                    </span>
                  </span>
                  <Switch checked={form.floatingEnabled} onCheckedChange={(checked) => updateField("floatingEnabled", checked)} disabled={!moduleReady || Boolean(selectedDrop?.archivedAt)} aria-label="Mostrar flotante de preventa" />
                </label>
                <label className="flex min-h-28 flex-col justify-between gap-4 rounded-md border border-border p-4">
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Cerrar drop manualmente</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Bloquea preventas y ventas aunque el drop siga publicado.
                    </span>
                  </span>
                  <Switch checked={form.isClosed} onCheckedChange={(checked) => updateField("isClosed", checked)} disabled={!moduleReady || Boolean(selectedDrop?.archivedAt)} aria-label="Cerrar drop manualmente" />
                </label>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="drop-floating-message">Mensaje exacto del flotante</Label>
              <Textarea
                id="drop-floating-message"
                rows={4}
                maxLength={600}
                value={form.floatingMessage}
                onChange={(event) => updateField("floatingMessage", event.target.value)}
                disabled={!moduleReady}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="drop-preorder-cta">Texto del botón de preventa</Label>
              <Input
                id="drop-preorder-cta"
                maxLength={60}
                value={form.preorderCtaText}
                onChange={(event) => updateField("preorderCtaText", event.target.value)}
                disabled={!moduleReady}
              />
              <p className="text-xs text-muted-foreground">
                Se mostrará en el CTA del flotante antes del lanzamiento.
              </p>
            </div>
          </CardContent>
        </Card>

        {selectedDrop ? (
          <Card>
            <CardHeader>
              <CardTitle>Stock</CardTitle>
            <CardDescription>Las preventas son bajo pedido y no descuentan stock. Solo descuentan los pedidos de la venta normal.</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Vista previa privada</CardTitle>
            <CardDescription>Vista previa privada — no publica cambios</CardDescription>
          </CardHeader>
          <CardContent>
            <HeroDropFloatingCard
              message={form.floatingMessage || "NUEVO DROP MUY PRONTO"}
              countdown={previewCountdown}
              ctaText={normalizeDropPreorderCtaText(form.preorderCtaText)}
              preview
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isPending || !moduleReady}>
            {isPending ? "Guardando..." : "Guardar drop"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setForm(form.id && selectedDrop ? dropToForm(selectedDrop) : emptyDropForm())} disabled={isPending || !moduleReady}>
            Descartar cambios
          </Button>
          {selectedDrop && !selectedDrop.archivedAt ? (
            <Button type="button" variant="outline" onClick={handleArchive} disabled={isPending || !moduleReady}>
              Archivar drop
            </Button>
          ) : null}
          {selectedDrop?.archivedAt ? (
            <Button type="button" variant="outline" onClick={handleUnarchive} disabled={isPending || !moduleReady}>
              Desarchivar
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
