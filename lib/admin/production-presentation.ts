import { normalizePhone } from "@/lib/phone"

export type ProductionPresentationType = "cake" | "box"

export type ProductionCatalogFlavor = {
  category: string
  label: string
}

export type ProductionDetailInput = {
  orderId: string
  type: ProductionPresentationType
  flavor: string
  qty: number
  phone: string | null
  customerName?: string | null
  deliveryDate: string
  createdAt: string
}

export type ProductionGroupedEntry = {
  orderId: string
  type: ProductionPresentationType
  flavor: string
  qty: number
}

export type ProductionGroupedBlock = {
  key: string
  label: string
  entries: ProductionGroupedEntry[]
}

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

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function getFlavorMap(flavors: ProductionCatalogFlavor[]) {
  const map = new Map<string, string>()

  for (const flavor of flavors) {
    const label = flavor.label.trim()
    if (!label) continue

    map.set(normalizeText(flavor.category), label)
    map.set(normalizeText(flavor.label), label)
  }

  return map
}

function getGroupLabel(phone?: string | null, customerName?: string | null) {
  const normalizedPhone = normalizePhone(phone)
  if (normalizedPhone) return normalizedPhone

  const rawPhone = phone?.trim()
  if (rawPhone) return rawPhone

  const name = customerName?.trim()
  if (name) return name

  return "Sin teléfono"
}

function getGroupKey(line: ProductionDetailInput) {
  const normalizedPhone = normalizePhone(line.phone)
  if (normalizedPhone) return `phone:${normalizedPhone}`

  const customerName = normalizeText(line.customerName)
  if (customerName) return `customer:${customerName}`

  return `order:${line.orderId}`
}

export function getProductionTypeLabel(type: ProductionPresentationType) {
  return type === "cake" ? "Tarta grande" : "Cajita / pequeña"
}

export function getFlavorEmoji(flavor: string) {
  return flavorEmojis[flavor] ?? ""
}

export function resolveCanonicalFlavorLabel(rawFlavor: string, catalogFlavors: ProductionCatalogFlavor[]) {
  const normalizedFlavor = normalizeText(rawFlavor)
  if (!normalizedFlavor) return rawFlavor.trim()

  return getFlavorMap(catalogFlavors).get(normalizedFlavor) ?? rawFlavor.trim()
}

export function buildGroupedProductionDetails(details: ProductionDetailInput[], catalogFlavors: ProductionCatalogFlavor[]) {
  const flavorMap = getFlavorMap(catalogFlavors)
  const groups = new Map<string, ProductionGroupedBlock>()

  for (const line of details) {
    const flavor = flavorMap.get(normalizeText(line.flavor)) ?? line.flavor.trim()
    const groupKey = getGroupKey(line)
    const existing = groups.get(groupKey)

    if (!existing) {
      groups.set(groupKey, {
        key: groupKey,
        label: getGroupLabel(line.phone, line.customerName),
        entries: [
          {
            orderId: line.orderId,
            type: line.type,
            flavor,
            qty: line.qty,
          },
        ],
      })
      continue
    }

    const mergedEntry = existing.entries.find((entry) => entry.type === line.type && entry.flavor === flavor)

    if (mergedEntry) {
      mergedEntry.qty += line.qty
      continue
    }

    existing.entries.push({
      orderId: line.orderId,
      type: line.type,
      flavor,
      qty: line.qty,
    })
  }

  return [...groups.values()].map((group) => ({
    ...group,
    entries: [...group.entries].sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "cake" ? -1 : 1
      }

      return left.flavor.localeCompare(right.flavor, "es")
    }),
  }))
}

export function buildProductionCopyText(input: {
  rangeLabel: string
  totals: { cakes: number; boxes: number }
  groups: ProductionGroupedBlock[]
}) {
  const lines = [
    `Rango: ${input.rangeLabel}`,
    "",
    `TARTAS GRANDES (${input.totals.cakes})`,
    `CAJITAS / PEQUEÑAS (${input.totals.boxes})`,
  ]

  if (!input.groups.length) {
    return lines.join("\n")
  }

  lines.push("", "DETALLE")

  input.groups.forEach((group, groupIndex) => {
    lines.push(`${group.label}:`)

    for (const entry of group.entries) {
      const emoji = getFlavorEmoji(entry.flavor)
      const flavorLabel = emoji ? `${entry.flavor} ${emoji}` : entry.flavor
      lines.push(`${getProductionTypeLabel(entry.type)} · ${flavorLabel} — ${entry.qty}`)
    }

    if (groupIndex < input.groups.length - 1) {
      lines.push("")
    }
  })

  return lines.join("\n")
}
