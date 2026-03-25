"use client"

import { MessageCircle, Send, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { buildWhatsAppLink, DEFAULT_BOT_WHATSAPP_LINK, DEFAULT_BOT_WHATSAPP_MESSAGE } from "@/lib/whatsapp"

type Handoff = {
  type: "whatsapp"
  label: "WhatsApp"
  href: string
}

type ChatMessage = {
  role: "user" | "assistant"
  text: string
  handoff?: Handoff
}

const QUICK_ACTIONS = [
  "¿Cuál es el horario?",
  "¿Qué sabores y tamaños hay?",
  "¿Qué alérgenos tiene pistacho?",
  "Quiero hacer un pedido",
  "Quiero hablar con una persona",
]

const EXTERNAL_ID_KEY = "saycheese_chat_external_id"
const INITIAL_CHAT_MESSAGE =
  "¡Hola! Puedes reservar tu tarta para una fecha concreta y, además, normalmente también hay tartas en tienda para compra directa hasta agotar existencias. Si quieres, te ayudo con sabores, tamaños, precios o con una reserva."

function getOrCreateExternalId() {
  if (typeof window === "undefined") return "server"

  const existing = localStorage.getItem(EXTERNAL_ID_KEY)
  if (existing) return existing

  const created = crypto.randomUUID()
  localStorage.setItem(EXTERNAL_ID_KEY, created)
  return created
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")
  const [externalId, setExternalId] = useState(getOrCreateExternalId)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: INITIAL_CHAT_MESSAGE }])

  const botWhatsappLink = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_BOT_WHATSAPP_LINK ?? process.env.BOT_WHATSAPP_LINK ?? DEFAULT_BOT_WHATSAPP_LINK
    return buildWhatsAppLink(base, DEFAULT_BOT_WHATSAPP_MESSAGE)
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(media.matches)

    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  async function sendMessage(text: string) {
    if (!text.trim()) return

    setMessages((prev) => [...prev, { role: "user", text }])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_id: externalId, message: text }),
      })

      const data = await response.json()

      if (typeof data.external_id === "string" && data.external_id && data.external_id !== externalId) {
        localStorage.setItem(EXTERNAL_ID_KEY, data.external_id)
        setExternalId(data.external_id)
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply ?? "No pude responder ahora.",
          handoff: data.handoff,
        },
      ])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Error de red. Inténtalo de nuevo." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-3 flex h-[520px] w-[340px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Asistente SayCheese</p>
            <button onClick={() => setIsOpen(false)} aria-label="Cerrar chat">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                  message.role === "user" ? "ml-auto bg-black text-white" : "bg-white"
                }`}
              >
                <p>{message.text}</p>
                {message.handoff?.href && (
                  <a
                    href={message.handoff.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-green-700 bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"
                    aria-label="Abrir WhatsApp con soporte humano"
                  >
                    <span aria-hidden="true">💬</span>
                    {message.handoff.label}
                  </a>
                )}
              </div>
            ))}
            {loading && <p className="text-xs text-neutral-500">Escribiendo...</p>}
          </div>

          <div className="border-t p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  className="rounded-full border px-2 py-1 text-xs hover:bg-neutral-100"
                  onClick={() => sendMessage(action)}
                >
                  {action}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void sendMessage(input)
              }}
            >
              <input
                className="h-10 flex-1 rounded-lg border px-3 text-sm outline-none"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe aquí..."
              />
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white" disabled={loading}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {isMobile ? (
        <div className="flex flex-col items-end gap-2">
          {!isOpen && (
            <button
              onClick={() => setIsOpen(true)}
              className="text-xs text-black underline-offset-2 hover:underline"
              aria-label="Abrir chat web"
            >
              Prefiero chat web
            </button>
          )}
          <a
            href={botWhatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-green-600 px-5 text-sm font-semibold text-white shadow-lg"
            aria-label="Pedir por WhatsApp"
          >
            <span aria-hidden="true">💬</span>
            Pedir por WhatsApp
          </a>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg"
          aria-label="Abrir chat"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  )
}
