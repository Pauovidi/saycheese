"use client"

import { useState, useCallback } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Copy, Loader2 } from "lucide-react"

import { getProduction, type ProductionResponse } from "@/actions/production"
import { getFlavorEmoji, getProductionTypeLabel } from "@/lib/admin/production-presentation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { toast } from "sonner"

function formatISODate(d: Date): string {
  return format(d, "yyyy-MM-dd")
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
    } catch {
      toast.error("No se pudo calcular la producción")
    } finally {
      setLoading(false)
    }
  }, [rangeMode, singleDate, dateFrom, dateTo, includeTartas, includeCajitas, includeDone])

  const handleCopy = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(result.copyText).then(() => {
      toast.success("Copiado al portapapeles")
    })
  }, [result])

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

      {result?.rangeLabel && (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Rango:</span> {result.rangeLabel}
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && result && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tartas grandes ({result.totals.cakes})</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-foreground">{result.totals.cakes}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cajitas / pequeñas ({result.totals.boxes})</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-foreground">{result.totals.boxes}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalle</CardTitle>
            </CardHeader>
            <CardContent>
              {result.groups.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No hay resultados en el rango
                </p>
              ) : (
                <div className="space-y-6">
                  {result.groups.map((group) => (
                    <div key={group.key} className="space-y-3 border-b border-border/60 pb-5 last:border-b-0 last:pb-0">
                      <p className="text-sm font-semibold text-foreground">{group.label}:</p>
                      <div className="space-y-2">
                        {group.entries.map((entry, index) => {
                          const emoji = getFlavorEmoji(entry.flavor)
                          const flavorLabel = emoji ? `${entry.flavor} ${emoji}` : entry.flavor

                          return (
                            <div
                              key={`${group.key}-${entry.orderId}-${entry.type}-${entry.flavor}-${index}`}
                              className="flex items-start justify-between gap-4 rounded-md bg-muted/30 px-3 py-2 text-sm"
                            >
                              <p className="text-foreground">
                                {getProductionTypeLabel(entry.type)} · {flavorLabel}
                              </p>
                              <p className="font-semibold tabular-nums text-foreground">{entry.qty}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
