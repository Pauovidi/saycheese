export const WELCOME_MESSAGE =
  "¡Hola! 👋 Puedes reservar tu tarta para una fecha concreta y, además, normalmente también hay tartas en tienda para compra directa hasta agotar existencias. Si quieres, te ayudo con sabores, tamaños, precios o con una reserva."

export const FLAVORS_AND_SIZES_MESSAGE =
  `¡Hola! 🍰 Siempre trabajamos con 2 tamaños: grande, con un precio de 35 € y cajita, con un precio de 12 €.

Sabores:
- Clásica
- Lotus
- Pistacho
- Gofio
- Mango-Maracuyá
- Hippo
- Dulce de Leche
- Nutella
- Tiramisú

Solo recogida en tienda. No hacemos envíos. Plazo mínimo 3 días.`

export function hasGreetingIntent(text: string) {
  return /^(hola|hola!|holaa|buenas|buenos dias|buenas tardes|buenas noches|hey|hello)\b/i.test(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  )
}
