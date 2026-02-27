"use client"

import { MessageCircle, Send, X } from "lucide-react"
import { useMemo, useState } from "react"

type Message = { role: "user" | "assistant"; text: string }

const QUICK_ACTIONS = [
  "¿Cuál es el horario de tienda?",
  "¿Qué sabores y tamaños tenéis?",
  "Quiero saber ingredientes y alérgenos de pistacho",
  "Quiero hacer un pedido",
  "Quiero anular mi pedido",
]

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "¡Hola! Soy el asistente de SayCheese. Te ayudo con pedidos, sabores, horario y anulaciones.",
    },
  ])

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "server"
    const key = "saycheese_chat_session"
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(key, created)
    return created
  }, [])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    setMessages((prev) => [...prev, { role: "user", text: trimmed }])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: trimmed,
        }),
      })

      const data = await response.json()

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data?.reply || "No pude responder ahora mismo.",
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Hubo un error de conexión. Inténtalo de nuevo.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 flex h-[520px] w-[340px] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Asistente SayCheese</p>
            <button aria-label="Cerrar chat" onClick={() => setOpen(false)}>
              <X size={18} />
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
                {message.text}
              </div>
            ))}
            {loading && <div className="text-xs text-neutral-500">Escribiendo...</div>}
          </div>

          <div className="border-t p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  className="rounded-full border px-2 py-1 text-xs hover:bg-neutral-100"
                  onClick={() => sendMessage(action)}
                  disabled={loading}
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
                placeholder="Escribe tu mensaje..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white" disabled={loading}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-xl transition hover:scale-105"
        aria-label="Abrir chat"
      >
        <MessageCircle size={24} />
      </button>
    </div>
  )
}
