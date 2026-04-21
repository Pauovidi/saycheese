type AdminSearchOrder = {
  id: string
  created_at?: string | null
}

export function normalizeOrderSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizeOrderSearchPhone(value: string) {
  return value.replace(/\D/g, "")
}

export function buildOrderSearchPhoneVariants(value: string) {
  const digits = normalizeOrderSearchPhone(value)
  if (!digits) return []

  const variants = new Set<string>([digits])

  if (digits.startsWith("34") && digits.length > 9) {
    variants.add(digits.slice(2))
  }

  if (digits.length === 9) {
    variants.add(`34${digits}`)
  }

  return [...variants].filter((entry) => entry.length >= 6)
}

export function orderPhoneMatchesSearch(phone: string | null | undefined, query: string) {
  const normalizedPhone = normalizeOrderSearchPhone(phone ?? "")
  if (!normalizedPhone) return false

  return buildOrderSearchPhoneVariants(query).some((variant) => normalizedPhone.includes(variant))
}

export function escapeOrderSearchLikeValue(value: string) {
  return value.replace(/[%_]/g, "").trim()
}

export function isOrderSearchQueryValid(value: string) {
  const textQuery = escapeOrderSearchLikeValue(normalizeOrderSearchText(value))
  const phoneQuery = normalizeOrderSearchPhone(value)
  const digitsOnly = textQuery.length > 0 && /^\d+$/.test(textQuery)

  if (digitsOnly) {
    return phoneQuery.length >= 6
  }

  return phoneQuery.length >= 6 || textQuery.length >= 2
}

export function hasOrderSearchLetters(value: string) {
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value)
}

export function dedupeAdminSearchOrders<T extends AdminSearchOrder>(results: T[]) {
  return Array.from(new Map(results.map((order) => [order.id, order])).values()).sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  )
}
