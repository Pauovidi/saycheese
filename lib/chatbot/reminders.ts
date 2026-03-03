import "server-only"

export function addDaysToToday(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function computeReminderAt(input: {
  createdAt: Date
  deliveryDate: string
  usedDefaultDeliveryDate: boolean
}) {
  if (input.usedDefaultDeliveryDate) {
    return new Date(input.createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString()
  }

  const [year, month, day] = input.deliveryDate.split("-").map(Number)
  const reminderBase = new Date(
    Date.UTC(
      year,
      (month ?? 1) - 1,
      day ?? 1,
      input.createdAt.getUTCHours(),
      input.createdAt.getUTCMinutes(),
      input.createdAt.getUTCSeconds()
    )
  )

  return new Date(reminderBase.getTime() - 24 * 60 * 60 * 1000).toISOString()
}
