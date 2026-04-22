import { buildPhoneSearchVariants, phoneDigitsOnly, phoneMatchesSearch } from "@/lib/phone"

type AdminSearchOrder = {
  id: string
  created_at?: string | null
}

export function normalizeOrderSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizeOrderSearchPhone(value: string) {
  return phoneDigitsOnly(value)
}

export function buildOrderSearchPhoneVariants(value: string) {
  return buildPhoneSearchVariants(value)
}

export function orderPhoneMatchesSearch(phone: string | null | undefined, query: string) {
  return phoneMatchesSearch(phone, query)
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
