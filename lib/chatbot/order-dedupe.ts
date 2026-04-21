export type ChatOrderItem = {
  type: "cake" | "box"
  flavor: string
  qty: number
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.startsWith("34") && digits.length > 9) {
    return digits.slice(2)
  }

  return digits
}

function areSameItem(left: ChatOrderItem, right: ChatOrderItem) {
  return left.type === right.type && normalizeText(left.flavor) === normalizeText(right.flavor)
}

export function buildOrderItemsSignature(items: ChatOrderItem[]) {
  return [...items]
    .map((item) => ({
      ...item,
      flavor: normalizeText(item.flavor),
    }))
    .sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type)
      if (typeCompare !== 0) return typeCompare

      const flavorCompare = a.flavor.localeCompare(b.flavor)
      if (flavorCompare !== 0) return flavorCompare

      return a.qty - b.qty
    })
    .map((item) => `${item.type}:${item.flavor}:${item.qty}`)
    .join("|")
}

export function buildChatOrderFingerprint(input: {
  phone: string
  deliveryDate: string
  items: ChatOrderItem[]
}) {
  return [
    normalizePhone(input.phone),
    input.deliveryDate,
    buildOrderItemsSignature(input.items),
  ].join("::")
}

export function appendOrderItem(items: ChatOrderItem[], nextItem: ChatOrderItem) {
  const existingIndex = items.findIndex((item) => areSameItem(item, nextItem))
  if (existingIndex === -1) {
    return [...items, nextItem]
  }

  return items.map((item, index) =>
    index === existingIndex
      ? {
          ...item,
          qty: item.qty + nextItem.qty,
        }
      : item
  )
}

export function areEquivalentOrderItems(left: ChatOrderItem[], right: ChatOrderItem[]) {
  return buildOrderItemsSignature(left) === buildOrderItemsSignature(right)
}

export function isRecentDuplicateFingerprint(input: {
  fingerprint: string
  previousFingerprint?: string
  previousCreatedAt?: string
  now?: Date
  windowMs?: number
}) {
  if (!input.previousFingerprint || input.previousFingerprint !== input.fingerprint) {
    return false
  }

  if (!input.previousCreatedAt) {
    return false
  }

  const previousTime = new Date(input.previousCreatedAt).getTime()
  if (!Number.isFinite(previousTime)) {
    return false
  }

  const now = input.now ?? new Date()
  const windowMs = input.windowMs ?? 10 * 60 * 1000
  return now.getTime() - previousTime <= windowMs
}
