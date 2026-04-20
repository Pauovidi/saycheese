"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const items = [
  { href: "/admin/produccion", label: "Producción" },
  { href: "/admin/edicion", label: "Edición" },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="mx-auto mt-4 flex max-w-5xl flex-wrap gap-2 px-4" aria-label="Secciones del panel">
      {items.map((item) => {
        const active = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
