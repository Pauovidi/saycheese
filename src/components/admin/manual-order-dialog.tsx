"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createOrder } from "@/actions/orders"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  buildManualOrderPayload,
  hasManualOrderValidationErrors,
  validateManualOrderForm,
  type ManualOrderFormValues,
  type ManualOrderItemFormValues,
} from "@/lib/admin/manual-order"
import {
  createInitialManualOrderItem,
  createInitialManualOrderForm,
  manualOrderDialogContentClass,
  manualOrderDialogFooterClass,
  manualOrderDialogHeaderClass,
  manualOrderDialogScrollBodyClass,
  shouldConfirmManualOrderCancel,
  shouldPreventManualOrderOverlayDismiss,
} from "@/lib/admin/manual-order-dialog-state"

type FlavorOption = {
  category: string
  label: string
}

type ManualOrderField = Exclude<keyof ManualOrderFormValues, "items">

function getFormatLabel(format: ManualOrderItemFormValues["format"]) {
  return format === "cajita" ? "Cajita" : "Tarta grande"
}

export function ManualOrderDialog({ flavors }: { flavors: FlavorOption[] }) {
  const router = useRouter()
  const defaultFlavor = flavors[0]?.category ?? ""
  const [open, setOpen] = useState(false)
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false)
  const [form, setForm] = useState<ManualOrderFormValues>(() => createInitialManualOrderForm(defaultFlavor))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function clearErrors(...keys: string[]) {
    setErrors((prev) => {
      if (!keys.some((key) => prev[key])) return prev

      const next = { ...prev }
      keys.forEach((key) => {
        delete next[key]
      })
      return next
    })
  }

  function updateField<K extends ManualOrderField>(field: K, value: ManualOrderFormValues[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    clearErrors(field)
  }

  function updateItemField<K extends keyof ManualOrderItemFormValues>(
    index: number,
    field: K,
    value: ManualOrderItemFormValues[K]
  ) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }))
    clearErrors(`items.${index}.${field}`, "items")
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, createInitialManualOrderItem(defaultFlavor)],
    }))
    clearErrors("items")
  }

  function removeItem(index: number) {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev

      return {
        ...prev,
        items: prev.items.filter((_, itemIndex) => itemIndex !== index),
      }
    })
    setErrors({})
  }

  function resetForm() {
    setForm(createInitialManualOrderForm(defaultFlavor))
    setErrors({})
  }

  function closeAndReset() {
    setOpen(false)
    setDiscardConfirmationOpen(false)
    resetForm()
  }

  function requestClose() {
    if (shouldConfirmManualOrderCancel(form, defaultFlavor)) {
      setDiscardConfirmationOpen(true)
      return
    }

    closeAndReset()
  }

  function getFlavorLabel(category: string) {
    return flavors.find((flavor) => flavor.category === category)?.label ?? category
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateManualOrderForm(form)
    setErrors(validationErrors)

    if (hasManualOrderValidationErrors(validationErrors)) {
      toast.error("Completa sabor y tamaño de cada tarta")
      return
    }

    startTransition(async () => {
      try {
        await createOrder(buildManualOrderPayload(form))
        toast.success("Pedido manual creado")
        closeAndReset()
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el pedido")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true)
          return
        }
        requestClose()
      }}
    >
      <DialogTrigger asChild>
        <Button>Crear pedido manual</Button>
      </DialogTrigger>
      <DialogContent
        className={manualOrderDialogContentClass}
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (shouldConfirmManualOrderCancel(form, defaultFlavor)) {
            event.preventDefault()
            setDiscardConfirmationOpen(true)
          }
        }}
        onInteractOutside={(event) => {
          if (discardConfirmationOpen) return

          if (shouldPreventManualOrderOverlayDismiss()) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader className={manualOrderDialogHeaderClass}>
          <DialogTitle>Nuevo pedido manual</DialogTitle>
          <DialogDescription>
            Se crea como pedido pendiente y aparecerá en el listado normal del admin.
          </DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className={manualOrderDialogScrollBodyClass} data-testid="manual-order-scroll-body">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="manual-order-name">Nombre</Label>
                <Input
                  id="manual-order-name"
                  value={form.customerName}
                  onChange={(event) => updateField("customerName", event.target.value)}
                  aria-invalid={Boolean(errors.customerName)}
                  required
                />
                {errors.customerName ? <p className="text-sm text-red-600">{errors.customerName}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="manual-order-phone">Teléfono</Label>
                <Input
                  id="manual-order-phone"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  aria-invalid={Boolean(errors.phone)}
                  required
                />
                {errors.phone ? <p className="text-sm text-red-600">{errors.phone}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="manual-order-date">Fecha de recogida</Label>
                <Input
                  id="manual-order-date"
                  type="date"
                  value={form.deliveryDate}
                  onChange={(event) => updateField("deliveryDate", event.target.value)}
                  aria-invalid={Boolean(errors.deliveryDate)}
                  required
                />
                {errors.deliveryDate ? <p className="text-sm text-red-600">{errors.deliveryDate}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="manual-order-notes">Notas</Label>
                <Textarea
                  id="manual-order-notes"
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label>Tartas</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Añadir otra tarta
                  </Button>
                </div>
                {errors.items ? <p className="text-sm text-red-600">{errors.items}</p> : null}

                {form.items.map((item, index) => {
                  const formatError = errors[`items.${index}.format`]
                  const flavorError = errors[`items.${index}.flavor`]
                  const quantityError = errors[`items.${index}.quantity`]

                  return (
                    <div key={index} className="rounded-md border border-border p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Tarta {index + 1}</p>
                        {form.items.length > 1 ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                            Quitar tarta
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]">
                        <div className="grid gap-2">
                          <Label htmlFor={`manual-order-format-${index}`}>Tamaño</Label>
                          <Select
                            value={item.format || undefined}
                            onValueChange={(value) =>
                              updateItemField(index, "format", value as ManualOrderItemFormValues["format"])
                            }
                          >
                            <SelectTrigger
                              id={`manual-order-format-${index}`}
                              className="w-full"
                              aria-invalid={Boolean(formatError)}
                            >
                              <SelectValue placeholder="Selecciona tamaño" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tarta">Tarta grande</SelectItem>
                              <SelectItem value="cajita">Cajita</SelectItem>
                            </SelectContent>
                          </Select>
                          {formatError ? <p className="text-sm text-red-600">{formatError}</p> : null}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`manual-order-flavor-${index}`}>Sabor</Label>
                          <Select
                            value={item.flavor || undefined}
                            onValueChange={(value) => updateItemField(index, "flavor", value)}
                          >
                            <SelectTrigger
                              id={`manual-order-flavor-${index}`}
                              className="w-full"
                              aria-invalid={Boolean(flavorError)}
                            >
                              <SelectValue placeholder="Selecciona sabor" />
                            </SelectTrigger>
                            <SelectContent>
                              {flavors.map((flavor) => (
                                <SelectItem key={flavor.category} value={flavor.category}>
                                  {flavor.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {flavorError ? <p className="text-sm text-red-600">{flavorError}</p> : null}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`manual-order-qty-${index}`}>Cantidad</Label>
                          <Input
                            id={`manual-order-qty-${index}`}
                            type="number"
                            min={1}
                            step={1}
                            value={String(item.quantity)}
                            onChange={(event) =>
                              updateItemField(
                                index,
                                "quantity",
                                Math.max(1, Number.parseInt(event.target.value, 10) || 1)
                              )
                            }
                            aria-invalid={Boolean(quantityError)}
                            required
                          />
                          {quantityError ? <p className="text-sm text-red-600">{quantityError}</p> : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-md bg-muted/50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumen</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {form.items.map((item, index) => (
                    <li key={`summary-${index}`}>
                      {getFormatLabel(item.format)} de {item.flavor ? getFlavorLabel(item.flavor) : "sin sabor"}
                      {item.quantity > 1 ? ` x${item.quantity}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className={manualOrderDialogFooterClass} data-testid="manual-order-footer">
            <Button type="button" variant="outline" onClick={requestClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando..." : "Guardar pedido"}
            </Button>
          </DialogFooter>
        </form>

        <AlertDialog open={discardConfirmationOpen} onOpenChange={setDiscardConfirmationOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Descartar pedido manual?</AlertDialogTitle>
              <AlertDialogDescription>
                Hay datos introducidos en el formulario. Si sales ahora, se perderán.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir editando</AlertDialogCancel>
              <AlertDialogAction onClick={closeAndReset}>Descartar pedido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
