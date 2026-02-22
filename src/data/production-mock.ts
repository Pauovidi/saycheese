export interface OrderItem {
  date: string // YYYY-MM-DD
  flavor: string
  format: "tarta" | "cajita"
  quantity: number
}

export interface ProductionLine {
  flavor: string
  units: number
}

export interface ProductionResult {
  tartas: ProductionLine[]
  cajitas: ProductionLine[]
  totalTartas: number
  totalCajitas: number
}

const flavorEmojis: Record<string, string> = {
  "Cl\u00e1sica": "\uD83C\uDF70",
  "Hippo": "\uD83E\uDD9B",
  "Pistacho": "\uD83D\uDFE2",
  "Mango-Maracuy\u00e1": "\uD83E\uDD6D",
  "Lotus": "\uD83E\uDDC1",
  "Gofio": "\uD83C\uDF3E",
  "Nutella": "\uD83C\uDF6B",
  "Tiramis\u00fa": "\u2615",
  "Polvito Uruguayo": "\u2728",
}

export function getFlavorEmoji(flavor: string): string {
  return flavorEmojis[flavor] ?? ""
}

// Mock orders spread across several days
const mockOrders: OrderItem[] = [
  // 2026-02-18
  { date: "2026-02-18", flavor: "Cl\u00e1sica", format: "tarta", quantity: 3 },
  { date: "2026-02-18", flavor: "Hippo", format: "tarta", quantity: 2 },
  { date: "2026-02-18", flavor: "Pistacho", format: "cajita", quantity: 5 },
  { date: "2026-02-18", flavor: "Mango-Maracuy\u00e1", format: "cajita", quantity: 4 },
  { date: "2026-02-18", flavor: "Lotus", format: "tarta", quantity: 1 },
  { date: "2026-02-18", flavor: "Cl\u00e1sica", format: "cajita", quantity: 6 },
  // 2026-02-19
  { date: "2026-02-19", flavor: "Cl\u00e1sica", format: "tarta", quantity: 2 },
  { date: "2026-02-19", flavor: "Pistacho", format: "tarta", quantity: 4 },
  { date: "2026-02-19", flavor: "Gofio", format: "cajita", quantity: 3 },
  { date: "2026-02-19", flavor: "Hippo", format: "cajita", quantity: 7 },
  { date: "2026-02-19", flavor: "Nutella", format: "cajita", quantity: 2 },
  // 2026-02-20
  { date: "2026-02-20", flavor: "Mango-Maracuy\u00e1", format: "tarta", quantity: 5 },
  { date: "2026-02-20", flavor: "Tiramis\u00fa", format: "cajita", quantity: 3 },
  { date: "2026-02-20", flavor: "Lotus", format: "cajita", quantity: 4 },
  { date: "2026-02-20", flavor: "Polvito Uruguayo", format: "tarta", quantity: 1 },
  { date: "2026-02-20", flavor: "Cl\u00e1sica", format: "cajita", quantity: 8 },
  // 2026-02-21
  { date: "2026-02-21", flavor: "Pistacho", format: "tarta", quantity: 3 },
  { date: "2026-02-21", flavor: "Hippo", format: "tarta", quantity: 2 },
  { date: "2026-02-21", flavor: "Gofio", format: "tarta", quantity: 1 },
  { date: "2026-02-21", flavor: "Cl\u00e1sica", format: "cajita", quantity: 5 },
  { date: "2026-02-21", flavor: "Nutella", format: "tarta", quantity: 2 },
  // 2026-02-22
  { date: "2026-02-22", flavor: "Cl\u00e1sica", format: "tarta", quantity: 4 },
  { date: "2026-02-22", flavor: "Lotus", format: "tarta", quantity: 3 },
  { date: "2026-02-22", flavor: "Pistacho", format: "cajita", quantity: 6 },
  { date: "2026-02-22", flavor: "Mango-Maracuy\u00e1", format: "cajita", quantity: 2 },
  { date: "2026-02-22", flavor: "Tiramis\u00fa", format: "tarta", quantity: 1 },
]

function aggregate(items: OrderItem[]): ProductionLine[] {
  const map = new Map<string, number>()
  for (const item of items) {
    map.set(item.flavor, (map.get(item.flavor) ?? 0) + item.quantity)
  }
  return Array.from(map.entries())
    .map(([flavor, units]) => ({ flavor, units }))
    .sort((a, b) => b.units - a.units)
}

export function calculateProduction(
  from: Date,
  to: Date,
  types: { tartas: boolean; cajitas: boolean }
): ProductionResult {
  const fromStr = formatDateISO(from)
  const toStr = formatDateISO(to)

  const filtered = mockOrders.filter(
    (o) => o.date >= fromStr && o.date <= toStr
  )

  const tartaItems = types.tartas ? filtered.filter((o) => o.format === "tarta") : []
  const cajitaItems = types.cajitas ? filtered.filter((o) => o.format === "cajita") : []

  const tartas = aggregate(tartaItems)
  const cajitas = aggregate(cajitaItems)

  return {
    tartas,
    cajitas,
    totalTartas: tartas.reduce((sum, l) => sum + l.units, 0),
    totalCajitas: cajitas.reduce((sum, l) => sum + l.units, 0),
  }
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
