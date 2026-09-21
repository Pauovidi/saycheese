export type AdminOrderHistoryItem = {
  delivery_date?: string | null
  status?: string | null
  created_at?: string | null
}

export function getCurrentShopDateISO(now = new Date(), timeZone = process.env.SHOP_TZ ?? "Europe/Madrid") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function isActiveOrderForDay(order: AdminOrderHistoryItem, todayISO: string) {
  return order.status === "pending" && order.delivery_date === todayISO
}

export function sortAdminOrdersForDay<T extends AdminOrderHistoryItem>(orders: T[], todayISO: string) {
  return [...orders].sort((a, b) => {
    const activeDifference = Number(isActiveOrderForDay(b, todayISO)) - Number(isActiveOrderForDay(a, todayISO))
    if (activeDifference !== 0) return activeDifference

    const dateDifference = (b.delivery_date ?? "").localeCompare(a.delivery_date ?? "")
    if (dateDifference !== 0) return dateDifference

    return (b.created_at ?? "").localeCompare(a.created_at ?? "")
  })
}
