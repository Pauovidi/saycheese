import {
  FORMAT_SIZE_COPY,
  PICKUP_ONLY_COPY,
  STORE_ADDRESS,
  STORE_HOURS_TEXT,
} from "@/src/data/business"

export interface FAQ {
  question: string
  answer: string
}

export const faqs: FAQ[] = [
  {
    question: "\u00bfC\u00f3mo puedo hacer un pedido?",
    answer:
      "Puedes hacer tu pedido desde la web o a través del chatbot. No recogemos pedidos por WhatsApp directo fuera del bot.",
  },
  {
    question: "\u00bfCu\u00e1les son los tama\u00f1os disponibles?",
    answer:
      `${FORMAT_SIZE_COPY} Cajita: 400 g, ideal para 1-2 personas, 12 €. Grande: 1,7 kg, 10-12 raciones, 35 €.`,
  },
  {
    question: "\u00bfHac\u00e9is env\u00edos?",
    answer:
      PICKUP_ONLY_COPY,
  },
  {
    question: "\u00bfCu\u00e1l es el horario?",
    answer: STORE_HOURS_TEXT,
  },
  {
    question: "\u00bfC\u00f3mo debo conservar el pedido al recogerlo?",
    answer:
      "Guarda tu pedido en nevera (2-4 °C) y consúmelo en un máximo de 5 días. Sácalo 15-20 minutos antes para disfrutar mejor la textura. No congelar.",
  },
  {
    question: "\u00bfContienen al\u00e9rgenos?",
    answer:
      "Cada sabor muestra sus alérgenos confirmados en la ficha de producto. Si necesitas revisar un caso concreto antes de pedir, escríbenos y te confirmamos el dato.",
  },
  {
    question: "\u00bfLos productos son aptos para cel\u00edacos o veganos?",
    answer:
      "Actualmente nuestros productos no son aptos para celíacos ni veganos, ya que contienen gluten, lácteos y huevo. Estamos trabajando en nuevas opciones.",
  },
  {
    question: "\u00bfPuedo hacer un pedido personalizado?",
    answer:
      "Sí, aceptamos pedidos personalizados para eventos, celebraciones y regalos corporativos. Cuéntanos los detalles desde la web o el chatbot y te confirmaremos disponibilidad y plazos.",
  },
  {
    question: "\u00bfQu\u00e9 m\u00e9todos de pago acept\u00e1is?",
    answer:
      "Aceptamos Bizum y transferencia bancaria. Te confirmaremos los datos de pago una vez recibamos tu pedido.",
  },
  {
    question: "\u00bfPuedo devolver un pedido?",
    answer:
      "Al tratarse de productos alimentarios perecederos, no aceptamos devoluciones una vez entregado el pedido. Si al recogerlo ves cualquier incidencia, dínoslo cuanto antes y lo revisamos contigo.",
  },
  {
    question: "\u00bfTen\u00e9is tienda f\u00edsica?",
    answer:
      `Sí. Tenemos tienda física y obrador en ${STORE_ADDRESS}. Además de pedidos por web o chatbot, suele haber stock diario limitado de tamaños mini y medianas hasta agotar existencias.`,
  },
]
