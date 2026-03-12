"use client"

import { MessageCircle, Send, X } from "lucide-react"
import { useState } from "react"

type ChatMessage = { role: "user" | "assistant"; text: string }

const QUICK_ACTIONS = [
  "¿Cuál es el horario?",
  "¿Qué sabores y tamaños hay?",
  "¿Qué alérgenos tiene pistacho?",
  "Quiero hacer un pedido",
  "Quiero hablar con una persona",
]

const EXTERNAL_ID_KEY = "saycheese_chat_external_id"

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
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")
  const [externalId, setExternalId] = useState(getOrCreateExternalId)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "¡Hola! Te ayudo con pedidos, sabores, alérgenos y horarios." },
  ])

  async function sendMessage(text: string) {
    if (loading || !text.trim()) return

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

      setMessages((prev) => [...prev, { role: "assistant", text: data.reply ?? "No pude responder ahora." }])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Error de red. Inténtalo de nuevo." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-3 flex h-[520px] w-[340px] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
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
                } whitespace-pre-line`}
              >
                {message.text}
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
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe aquí..."
                disabled={loading}
              />
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white" disabled={loading}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg"
        aria-label="Abrir chat"
      >
        <MessageCircle size={24} />
      </button>
    </div>
  )
}
