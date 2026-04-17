"use client"

import { useState, useCallback } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Copy, Loader2 } from "lucide-react"

import { getProduction, type ProductionResponse } from "@/actions/production"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

const flavorEmojis: Record<string, string> = {
  "Clásica": "🍰",
  Hippo: "🦛",
  Pistacho: "🟢",
  "Mango-Maracuyá": "🥭",
  Lotus: "🧁",
  Gofio: "🌾",
  Nutella: "🍫",
  Tiramisú: "☕",
  "Polvito Uruguayo": "✨",
}

function getFlavorEmoji(flavor: string): string {
  return flavorEmojis[flavor] ?? ""
}

function formatDMY(d: Date): string {
  return format(d, "dd/MM/yyyy")
}

function formatISODate(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

function getProductionTypeLabel(type: "cake" | "box"): string {
  return type === "cake" ? "Tarta grande" : "Cajita / pequeña"
}

function getProductionPhone(phone: string | null): string {
  return phone?.trim() || "Sin teléfono"
}

function buildProductionCopyText(result: ProductionResponse, rangeLabel: string): string {
  const lines: string[] = []

  lines.push(`Rango: ${rangeLabel}`)
  lines.push("")
  lines.push(`TARTAS GRANDES (${result.totals.cakes})`)
  lines.push(`CAJITAS / PEQUEÑAS (${result.totals.boxes})`)

  if (result.details.length > 0) {
    lines.push("")
    lines.push("DETALLE")

    for (const line of result.details) {
      const emoji = getFlavorEmoji(line.flavor)
      const flavorLabel = emoji ? `${line.flavor} ${emoji}` : line.flavor

      lines.push(
        `${getProductionTypeLabel(line.type)} · ${flavorLabel} — ${line.qty} — ${getProductionPhone(line.phone)}`
      )
    }
  }

  return lines.join("\n")
}

export function ProductionPanel() {
  const [rangeMode, setRangeMode] = useState<"single" | "range">("range")
  const [singleDate, setSingleDate] = useState<Date | undefined>(new Date())
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date())
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date())
  const [includeTartas, setIncludeTartas] = useState(true)
  const [includeCajitas, setIncludeCajitas] = useState(true)
  const [includeDone, setIncludeDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProductionResponse | null>(null)
  const [rangeLabel, setRangeLabel] = useState("")

  const handleCalculate = useCallback(async () => {
    const from = rangeMode === "single" ? singleDate : dateFrom
    const to = rangeMode === "single" ? singleDate : dateTo

    if (!from || !to) {
      toast.error("Selecciona las fechas")
      return
    }
    if (!includeTartas && !includeCajitas) {
      toast.error("Selecciona al menos un tipo")
      return
    }

    setLoading(true)

    try {
      const types: Array<"cake" | "box"> = []
      if (includeTartas) types.push("cake")
      if (includeCajitas) types.push("box")

      const data = await getProduction({
        mode: rangeMode,
        day: rangeMode === "single" ? formatISODate(from) : undefined,
        from: rangeMode === "range" ? formatISODate(from) : undefined,
        to: rangeMode === "range" ? formatISODate(to) : undefined,
        types,
        includeDone,
      })

      setResult(data)
      setRangeLabel(
        rangeMode === "single"
          ? formatDMY(from)
          : `${formatDMY(from)} → ${formatDMY(to)}`
      )
    } catch {
      toast.error("No se pudo calcular la producción")
    } finally {
      setLoading(false)
    }
  }, [rangeMode, singleDate, dateFrom, dateTo, includeTartas, includeCajitas, includeDone])

  const handleCopy = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(buildProductionCopyText(result, rangeLabel)).then(() => {
      toast.success("Copiado al portapapeles")
    })
  }, [result, rangeLabel])

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Rango</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RadioGroup
            value={rangeMode}
            onValueChange={(v) => setRangeMode(v as "single" | "range")}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="single" id="mode-single" />
              <Label htmlFor="mode-single" className="text-sm">Un día</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="range" id="mode-range" />
              <Label htmlFor="mode-range" className="text-sm">Rango de fechas</Label>
            </div>
          </RadioGroup>

          {rangeMode === "single" ? (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Fecha</Label>
              <DatePicker date={singleDate} onSelect={setSingleDate} />
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <DatePicker date={dateFrom} onSelect={setDateFrom} />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <DatePicker date={dateTo} onSelect={setDateTo} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Tipos a incluir</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="type-tartas"
              checked={includeTartas}
              onCheckedChange={(v) => setIncludeTartas(v === true)}
            />
            <Label htmlFor="type-tartas" className="text-sm">Tartas</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="type-cajitas"
              checked={includeCajitas}
              onCheckedChange={(v) => setIncludeCajitas(v === true)}
            />
            <Label htmlFor="type-cajitas" className="text-sm">Cajitas</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-done"
              checked={includeDone}
              onCheckedChange={(v) => setIncludeDone(Boolean(v))}
            />
            <Label htmlFor="include-done" className="text-sm">Incluir hechos</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleCalculate} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Calcular
        </Button>
        <Button
          variant="outline"
          onClick={handleCopy}
          disabled={!result}
          className="border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copiar producción
        </Button>
      </div>

      {rangeLabel && (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Rango:</span> {rangeLabel}
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && result && (
        <div className="grid gap-4 md:grid-cols-2">
          {includeTartas && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tartas ({result.totals.cakes})</CardTitle>
              </CardHeader>
              <CardContent>
                {result.cakes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No hay resultados en el rango
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sabor</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.cakes.map((line) => (
                        <TableRow key={line.flavor}>
                          <TableCell className="font-medium">
                            {line.flavor} {getFlavorEmoji(line.flavor)}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            {line.qty}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {includeCajitas && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cajitas ({result.totals.boxes})</CardTitle>
              </CardHeader>
              <CardContent>
                {result.boxes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No hay resultados en el rango
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sabor</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.boxes.map((line) => (
                        <TableRow key={line.flavor}>
                          <TableCell className="font-medium">
                            {line.flavor} {getFlavorEmoji(line.flavor)}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            {line.qty}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function DatePicker({
  date,
  onSelect,
}: {
  date: Date | undefined
  onSelect: (d: Date | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {date ? format(date, "dd/MM/yyyy") : "Seleccionar fecha"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onSelect(d)
            setOpen(false)
          }}
          locale={es}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
