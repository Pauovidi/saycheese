export const WELCOME_MESSAGE =
  "¡Hola! Puedes reservar tu tarta para una fecha concreta y, además, normalmente también hay tartas en tienda para compra directa hasta agotar existencias. Si quieres, te ayudo con sabores, tamaños, precios o con una reserva."

export function hasGreetingIntent(text: string) {
  return /^(hola|hola!|holaa|buenas|buenos dias|buenas tardes|buenas noches|hey|hello)\b/i.test(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  )
}
