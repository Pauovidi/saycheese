import { DROP_LAUNCH_TIME_ZONE, getDropStatusLabel } from "@/src/data/drops"
import { listChatbotDrops, type EditableDropRecord } from "@/src/data/drops-store"

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

const DROP_INTENT_PATTERNS = [
  /\bdrops?\b/,
  /\bcamisetas?\b/,
  /\bmerch(?:andising)?\b/,
  /\bpreventa\b/,
  /\blanzamiento\b/,
  /\btallas?\b.*\b(camisa|camiseta|drop|merch)\b/,
  /\b(colores?)\b.*\b(camisa|camiseta|drop|merch)\b/,
  /\bqueda\s+(?:talla\s+)?[a-z0-9]{1,4}\b/,
  /\bhay\s+(?:talla\s+)?[a-z0-9]{1,4}\b/,
  /\bteneis\s+(?:talla\s+)?[a-z0-9]{1,4}\b/,
]

function hasDropIntent(message: string) {
  const normalized = normalize(message)
  return DROP_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))
}

function asksForColors(message: string) {
  return /\bcolores?\b/.test(normalize(message))
}

function asksForLaunch(message: string) {
  return /\b(cuando|fecha|sale|lanzamiento)\b/.test(normalize(message))
}

function isTryingToOrderShirt(message: string) {
  return /\b(quiero|pedir|comprar|encargar)\b/.test(normalize(message)) && /\b(camisa|camiseta|drop|merch)\b/.test(normalize(message))
}

function extractRequestedSize(message: string, sizes: string[]) {
  const normalized = normalize(message).replace(/[^\p{L}\d\s]+/gu, " ")
  const known = sizes
    .map((size) => ({ size, normalized: normalize(size) }))
    .sort((a, b) => b.normalized.length - a.normalized.length)

  return known.find((entry) => {
    const escaped = entry.normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`\\b(?:talla\\s+)?${escaped}\\b`).test(normalized)
  })?.size
}

function formatLaunchDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DROP_LAUNCH_TIME_ZONE,
  }).format(new Date(value))
}

function formatSizeStock(drop: EditableDropRecord) {
  return drop.stock.sizeStock.map((entry) => `${entry.size} (${entry.sellableNow})`).join(", ")
}

function formatConfiguredSizes(drop: EditableDropRecord) {
  return drop.sizes.join(", ")
}

function asksForSizes(message: string) {
  return /\btallas?\b/.test(normalize(message))
}

function buildNoDropsReply() {
  return "Ahora mismo no tenemos drops publicados. Si quieres, te avisamos cuando salga el próximo."
}

function buildDropOrderRedirect(drop: EditableDropRecord) {
  if (drop.status === "PRELAUNCH") {
    return drop.sizeStockEnabled
      ? `Ahora puedes hacer la preventa de ${drop.name} desde la web; las tallas se eligen desde el lanzamiento.`
      : `Ahora puedes hacer la preventa de ${drop.name} desde la web; reservas una unidad genérica sin talla.`
  }

  if (drop.status === "LIVE") {
    return drop.sizeStockEnabled
      ? `Para camisetas, hazlo desde la sección Drops de la web para elegir talla, color y cantidad: /drops/${drop.slug}`
      : `Para camisetas, hazlo desde la sección Drops de la web; este drop se pide sin talla: /drops/${drop.slug}`
  }

  return "Ahora mismo el drop está agotado."
}

function buildDropReply(drop: EditableDropRecord, message: string) {
  const requestedSize = extractRequestedSize(message, drop.sizes)

  if (isTryingToOrderShirt(message)) {
    return buildDropOrderRedirect(drop)
  }

  if (asksForLaunch(message)) {
    return `El lanzamiento es el ${formatLaunchDate(drop.launchAt)}.`
  }

  if (asksForColors(message)) {
    return drop.colors.length ? `Colores disponibles: ${drop.colors.join(", ")}.` : "Ahora mismo no tengo colores configurados para este drop."
  }

  if (!drop.sizeStockEnabled && asksForSizes(message)) {
    return `Este drop se vende sin selección de talla ahora mismo. Puedes pedirlo sin talla desde la sección Drops: /drops/${drop.slug}`
  }

  if (requestedSize) {
    if (!drop.sizeStockEnabled) {
      return `Este drop no tiene tallas activas/configuradas ahora mismo; se pide sin talla desde la sección Drops.`
    }

    const stock = drop.stock.sizeStock.find((entry) => entry.size === requestedSize)
    if (drop.status === "PRELAUNCH") {
      return `La talla ${requestedSize} está prevista para ${drop.name}. En preventa reservas una unidad genérica; talla y color se eligen cuando esté en venta.`
    }

    if (!stock || stock.sellableNow <= 0) {
      return `La talla ${requestedSize} está agotada ahora mismo.`
    }

    return `La talla ${requestedSize} está disponible. Quedan ${stock.sellableNow} unidades vendibles de ${requestedSize}.`
  }

  if (drop.status === "PRELAUNCH") {
    const sizeCopy = drop.sizeStockEnabled
      ? ` Tallas previstas: ${formatConfiguredSizes(drop)}. En preventa reservas una unidad genérica; las tallas se eligen desde el lanzamiento.`
      : " Se reserva una unidad genérica sin talla."
    return `Sí, tenemos drop: ${drop.name}. Está en preventa hasta el ${formatLaunchDate(drop.launchAt)}. Quedan ${drop.stock.availableStock} unidades. Precio: ${drop.priceText}.${sizeCopy} Colores: ${drop.colors.join(", ")}.`
  }

  if (drop.status === "LIVE") {
    const sizeCopy = drop.sizeStockEnabled
      ? ` Tallas: ${formatSizeStock(drop)}.`
      : " Este drop se vende sin selección de talla."
    return `Sí, tenemos en venta ${drop.name}. Precio: ${drop.priceText}. Quedan ${drop.stock.availableStock} unidades en total.${sizeCopy} Colores: ${drop.colors.join(", ")}. Puedes pedirla en la sección Drops: /drops/${drop.slug}`
  }

  if (drop.status === "SOLD_OUT") {
    return "Ahora mismo el drop está agotado."
  }

  return `Ahora mismo no hay drops disponibles para comprar. Estado: ${getDropStatusLabel(drop.status)}.`
}

export async function buildDropsReplyIfIntent(message: string) {
  if (!hasDropIntent(message)) return null

  const drops = await listChatbotDrops()
  if (drops === null) {
    return "Ahora mismo no puedo confirmar los drops desde el sistema. Te atiende una persona del equipo para revisarlo."
  }

  const publicDrops = drops.filter((drop) => !drop.archivedAt && drop.isActive && !drop.isClosed)
  if (!publicDrops.length) return buildNoDropsReply()

  const preferred = publicDrops.find((drop) => drop.status === "PRELAUNCH" || drop.status === "LIVE")
    ?? publicDrops.find((drop) => drop.status === "SOLD_OUT")
    ?? publicDrops[0]

  return buildDropReply(preferred, message)
}
