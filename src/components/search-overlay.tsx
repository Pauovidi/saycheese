"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { products } from "@/src/data/products"

interface SearchOverlayProps {
  open: boolean
  onClose: () => void
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
      setQuery("")
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  const results = query.length > 1
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.shortDescription.toLowerCase().includes(query.toLowerCase())
      )
    : []

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-6">
        <input
          ref={inputRef}
          type="text"
          placeholder="Busca en nuestra tienda..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border-b border-foreground bg-transparent pb-2 text-lg font-light uppercase tracking-wider text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button onClick={onClose} aria-label="Cerrar busqueda" className="text-foreground">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4">
        {results.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {results.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/producto/${p.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-4 border-b border-border py-4 transition-colors hover:bg-secondary"
                >
                  <span className="text-sm font-medium uppercase tracking-wider text-foreground">
                    {p.name}
                  </span>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {p.priceText}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : query.length > 1 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No se encontraron resultados.
          </p>
        ) : null}
      </div>
    </div>
  )
}
