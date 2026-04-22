"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createOrder } from "@/actions/orders"
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
import { buildManualOrderPayload, type ManualOrderFormValues } from "@/lib/admin/manual-order"

type FlavorOption = {
  category: string
  label: string
}

const INITIAL_FORM: ManualOrderFormValues = {
  customerName: "",
  phone: "",
  deliveryDate: "",
  format: "tarta",
  flavor: "",
  quantity: 1,
}

export function ManualOrderDialog({ flavors }: { flavors: FlavorOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ManualOrderFormValues>({
    ...INITIAL_FORM,
    flavor: flavors[0]?.category ?? "",
  })
  const [isPending, startTransition] = useTransition()

  function updateField<K extends keyof ManualOrderFormValues>(field: K, value: ManualOrderFormValues[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setForm({
      ...INITIAL_FORM,
      flavor: flavors[0]?.category ?? "",
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      try {
        await createOrder(buildManualOrderPayload(form))
        toast.success("Pedido manual creado")
        setOpen(false)
        resetForm()
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
        setOpen(nextOpen)
        if (!nextOpen) {
          resetForm()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>Crear pedido manual</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo pedido manual</DialogTitle>
          <DialogDescription>
            Se crea como pedido pendiente y aparecerá en el listado normal del admin.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="manual-order-name">Nombre</Label>
            <Input
              id="manual-order-name"
              value={form.customerName}
              onChange={(event) => updateField("customerName", event.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manual-order-phone">Teléfono</Label>
            <Input
              id="manual-order-phone"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manual-order-date">Fecha de recogida</Label>
            <Input
              id="manual-order-date"
              type="date"
              value={form.deliveryDate}
              onChange={(event) => updateField("deliveryDate", event.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Tamaño</Label>
              <Select value={form.format} onValueChange={(value) => updateField("format", value as ManualOrderFormValues["format"])}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona tamaño" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tarta">Tarta grande</SelectItem>
                  <SelectItem value="cajita">Cajita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Sabor</Label>
              <Select value={form.flavor} onValueChange={(value) => updateField("flavor", value)}>
                <SelectTrigger className="w-full">
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
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manual-order-qty">Cantidad</Label>
            <Input
              id="manual-order-qty"
              type="number"
              min={1}
              step={1}
              value={String(form.quantity)}
              onChange={(event) => updateField("quantity", Math.max(1, Number(event.target.value) || 1))}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando..." : "Guardar pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
