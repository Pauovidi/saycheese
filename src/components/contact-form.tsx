"use client"

import { useState } from "react"

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          message: formData.get("message"),
        }),
      })
    } catch {
      // mock
    }
    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-sm font-medium uppercase tracking-wider text-foreground">
          Mensaje enviado correctamente. Gracias por contactarnos.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="name"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-foreground"
        >
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full border border-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          placeholder="Tu nombre"
        />
      </div>
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full border border-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          placeholder="tu@email.com"
        />
      </div>
      <div>
        <label
          htmlFor="message"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-foreground"
        >
          Mensaje
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full resize-none border border-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          placeholder="Escribe tu mensaje..."
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-primary px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {loading ? "Enviando..." : "Enviar mensaje"}
      </button>
    </form>
  )
}
