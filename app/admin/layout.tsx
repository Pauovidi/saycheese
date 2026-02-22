import type { Metadata } from "next"
import Link from "next/link"

import { AdminLogoutButton } from "@/src/components/admin/admin-logout-button"

export const metadata: Metadata = {
  title: "Admin | SayCheese",
  description: "Panel de administración de SayCheese",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <h1 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground">
            SayCheese Admin
          </h1>
          <nav className="flex items-center gap-4">
            <Link
              href="/admin/produccion"
              className="text-xs font-bold uppercase tracking-wider text-primary"
            >
              Producción
            </Link>
            <AdminLogoutButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  )
}
