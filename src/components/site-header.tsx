"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ShoppingBag, Menu, X } from "lucide-react"
import { useCart } from "@/src/context/cart-context"

const navLinks = [
  { href: "/productos", label: "PRODUCTOS" },
  { href: "/faqs", label: "FAQ" },
]

export function SiteHeader() {
  const { totalItems, openCart } = useCart()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6 lg:px-10">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/images/logo.png"
              alt="SayCheese by N&eacute;stor P&eacute;rez"
              width={210}
              height={75}
              className="h-[60px] w-auto"
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegacion principal">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={openCart}
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-primary transition-colors hover:text-primary/70"
            >
              Mi pedido ({totalItems})
              <ShoppingBag className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-foreground md:hidden"
              aria-label={mobileOpen ? "Cerrar men&uacute;" : "Abrir men&uacute;"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav
            className="border-t border-border bg-background px-4 py-6 md:hidden"
            aria-label="Navegacion movil"
          >
            <ul className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm font-medium uppercase tracking-[0.15em] text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
    </>
  )
}
