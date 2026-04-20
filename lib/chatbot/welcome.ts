export const WELCOME_MESSAGE =
  `¡Hola! Siempre trabajamos con 2 tamaños: grande, con un precio de 35 € y cajita, con un precio de 12 €.

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
