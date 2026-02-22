"use client"

import { useState, useCallback } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Copy, Loader2 } from "lucide-react"

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

import {
  calculateProduction,
  getFlavorEmoji,
  type ProductionResult,
} from "@/src/data/production-mock"

function formatDMY(d: Date): string {
  return format(d, "dd/MM/yyyy")
}

export function ProductionPanel() {
  const [rangeMode, setRangeMode] = useState<"single" | "range">("range")
  const [singleDate, setSingleDate] = useState<Date | undefined>(new Date())
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date(2026, 1, 18))
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date(2026, 1, 22))
  const [includeTartas, setIncludeTartas] = useState(true)
  const [includeCajitas, setIncludeCajitas] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProductionResult | null>(null)
  const [rangeLabel, setRangeLabel] = useState("")

  const handleCalculate = useCallback(() => {
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
    // Simulate async delay
    setTimeout(() => {
      const data = calculateProduction(from, to, {
        tartas: includeTartas,
        cajitas: includeCajitas,
      })
      setResult(data)
      setRangeLabel(
        rangeMode === "single"
          ? formatDMY(from)
          : `${formatDMY(from)} → ${formatDMY(to)}`
      )
      setLoading(false)
    }, 400)
  }, [rangeMode, singleDate, dateFrom, dateTo, includeTartas, includeCajitas])

  const handleCopy = useCallback(() => {
    if (!result) return
    const lines: string[] = []
    lines.push(`Rango: ${rangeLabel}`)
    lines.push("")
    if (result.tartas.length > 0) {
      lines.push(`TARTAS (${result.totalTartas})`)
      for (const l of result.tartas) {
        lines.push(`  ${l.flavor} ${getFlavorEmoji(l.flavor)} — ${l.units}`)
      }
      lines.push("")
    }
    if (result.cajitas.length > 0) {
      lines.push(`CAJITAS (${result.totalCajitas})`)
      for (const l of result.cajitas) {
        lines.push(`  ${l.flavor} ${getFlavorEmoji(l.flavor)} — ${l.units}`)
      }
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      toast.success("Copiado al portapapeles")
    })
  }, [result, rangeLabel])

  return (
    <div className="flex flex-col gap-6">
      {/* Rango */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">
            Rango
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RadioGroup
            value={rangeMode}
            onValueChange={(v) => setRangeMode(v as "single" | "range")}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="single" id="mode-single" />
              <Label htmlFor="mode-single" className="text-sm">{"Un d\u00eda"}</Label>
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

      {/* Tipos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">
            Tipos a incluir
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-6">
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
        </CardContent>
      </Card>

      {/* Actions */}
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
          {"Copiar producción"}
        </Button>
      </div>

      {/* Range label */}
      {rangeLabel && (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Rango:</span> {rangeLabel}
        </p>
      )}

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && result && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Tartas */}
          {includeTartas && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Tartas ({result.totalTartas})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.tartas.length === 0 ? (
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
                      {result.tartas.map((line) => (
                        <TableRow key={line.flavor}>
                          <TableCell className="font-medium">
                            {line.flavor} {getFlavorEmoji(line.flavor)}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            {line.units}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cajitas */}
          {includeCajitas && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Cajitas ({result.totalCajitas})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.cajitas.length === 0 ? (
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
                      {result.cajitas.map((line) => (
                        <TableRow key={line.flavor}>
                          <TableCell className="font-medium">
                            {line.flavor} {getFlavorEmoji(line.flavor)}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            {line.units}
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

/* ── DatePicker helper ─────────────────────────────────────────────── */

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
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
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
