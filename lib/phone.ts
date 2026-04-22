export function phoneDigitsOnly(value?: string | null) {
  return value?.replace(/\D/g, "") ?? ""
}

export function normalizePhone(value?: string | null) {
  const digits = phoneDigitsOnly(value)
  if (!digits) return ""

  if (digits.startsWith("0034") && digits.length > 11) {
    return digits.slice(4)
  }

  if (digits.startsWith("34") && digits.length > 9) {
    return digits.slice(2)
  }

  return digits
}

export function normalizePhoneOrNull(value?: string | null) {
  const normalized = normalizePhone(value)
  return normalized || null
}

export function buildPhoneSearchVariants(value?: string | null) {
  const digits = phoneDigitsOnly(value)
  const normalized = normalizePhone(value)
  const variants = new Set<string>()

  if (normalized) {
    variants.add(normalized)
  }

  if (digits) {
    variants.add(digits)
  }

  if (normalized.length === 9) {
    variants.add(`34${normalized}`)
  }

  return [...variants].filter((entry) => entry.length >= 6)
}

export function phoneMatchesSearch(phone: string | null | undefined, query: string) {
  const haystacks = [phoneDigitsOnly(phone), normalizePhone(phone)].filter(Boolean)
  if (!haystacks.length) return false

  return buildPhoneSearchVariants(query).some((variant) => haystacks.some((candidate) => candidate.includes(variant)))
}
