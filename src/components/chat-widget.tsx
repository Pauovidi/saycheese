"use client"

import { MessageCircle, RotateCcw, Send, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

type ChatMessage = { role: "user" | "assistant"; text: string }

const QUICK_ACTIONS = [
  "¿Cuál es el horario?",
  "¿Qué sabores y tamaños hay?",
  "¿Qué alérgenos tiene pistacho?",
  "Quiero hacer un pedido",
  "Quiero hablar con una persona",
]

function getInitialMessages(): ChatMessage[] {
  return [{ role: "assistant", text: "¡Hola! Te ayudo con pedidos, sabores, alérgenos y horarios." }]
}

function createWebExternalId() {
  if (typeof window === "undefined") return "server"
  return crypto.randomUUID()
}

export function ChatWidget() {
  const pendingRequestRef = useRef<AbortController | null>(null)
  const externalIdRef = useRef<string>(createWebExternalId())
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages())

  function isNearBottom() {
    const container = messagesContainerRef.current
    if (!container) return true

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceFromBottom <= 72
  }

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" })
  }

  useEffect(() => {
    return () => {
      pendingRequestRef.current?.abort()
      pendingRequestRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (!shouldAutoScrollRef.current && !loading) return

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom(messages.length <= 1 && !loading ? "auto" : "smooth")
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isOpen, loading, messages])

  function resetChat() {
    pendingRequestRef.current?.abort()
    pendingRequestRef.current = null
    externalIdRef.current = createWebExternalId()
    shouldAutoScrollRef.current = true
    setLoading(false)
    setInput("")
    setMessages(getInitialMessages())
  }

  async function sendMessage(text: string) {
    if (loading || !text.trim()) return

    shouldAutoScrollRef.current = true
    setMessages((prev) => [...prev, { role: "user", text }])
    setInput("")
    setLoading(true)
    const controller = new AbortController()
    pendingRequestRef.current = controller

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ external_id: externalIdRef.current, message: text }),
      })

      const data = (await response.json()) as { ok?: boolean; reply?: string; error?: string; external_id?: string }

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "No pude responder ahora.")
      }

      if (typeof data.external_id === "string" && data.external_id) {
        externalIdRef.current = data.external_id
      }

      setMessages((prev) => [...prev, { role: "assistant", text: data.reply ?? "No pude responder ahora." }])
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      const errorText = error instanceof Error ? error.message : "Error de red. Inténtalo de nuevo."
      setMessages((prev) => [...prev, { role: "assistant", text: errorText }])
    } finally {
      if (pendingRequestRef.current === controller) {
        pendingRequestRef.current = null
        setLoading(false)
      }
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-3 flex h-[520px] w-[340px] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Asistente SayCheese</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetChat}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-neutral-100"
              >
                <RotateCcw size={12} />
                Reiniciar chat
              </button>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar chat">
                <X size={16} />
              </button>
            </div>
          </div>

          <div
            ref={messagesContainerRef}
            className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-3"
            onScroll={() => {
              shouldAutoScrollRef.current = isNearBottom()
            }}
          >
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
            <div ref={bottomRef} aria-hidden="true" />
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
        onClick={() => {
          shouldAutoScrollRef.current = true
          setIsOpen((prev) => !prev)
        }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg"
        aria-label="Abrir chat"
      >
        <MessageCircle size={24} />
      </button>
    </div>
  )
}
