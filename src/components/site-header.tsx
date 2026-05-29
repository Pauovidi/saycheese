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

const uberEatsTopBarText =
  "Con Uber Eats recibe tu tarta en casa (solo 3 Km a la redonda)"

function UberEatsTopBar() {
  const tickerItems = Array.from({ length: 8 }, (_, index) => (
    <span key={index} className="uber-eats-ticker__item">
      <Image
        src="/images/uber-eats-icon-logo.png"
        alt=""
        width={28}
        height={29}
        className="h-6 w-6 rounded-[6px] object-contain"
        aria-hidden="true"
      />
      <span>{uberEatsTopBarText}</span>
    </span>
  ))

  return (
    <div
      className="uber-eats-ticker border-b border-primary/20 bg-primary py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground"
      aria-label={uberEatsTopBarText}
    >
      <div className="uber-eats-ticker__track" aria-hidden="true">
        {tickerItems}
      </div>
      <p className="sr-only">{uberEatsTopBarText}</p>
    </div>
  )
}

export function SiteHeader() {
  const { totalItems, openCart } = useCart()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <UberEatsTopBar />
        <div className="mx-auto flex min-h-20 max-w-[1600px] items-center justify-between gap-4 px-6 py-3 lg:px-10">
          {/* Logo */}
          <Link href="/" className="min-w-0 flex-shrink-0">
            <Image
              src="/images/logo.png"
              alt="SayCheese by Néstor Pérez"
              width={4680}
              height={2400}
              className="h-auto w-[150px] object-contain sm:w-[190px] lg:w-[220px]"
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
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
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
