"use client"

import Link from "next/link"

const allLinks = [
  { href: "/legal/aviso-legal", label: "Aviso legal" },
  { href: "/legal/privacidad", label: "Pol\u00edtica de privacidad" },
  { href: "/legal/cookies", label: "Pol\u00edtica de cookies" },
  { href: "/legal/terminos", label: "T\u00e9rminos y condiciones" },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      {/* Links row */}
      <div className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-y-4">
          <nav
            className="flex flex-wrap items-center gap-x-6 gap-y-3"
            aria-label="Enlaces del pie de p\u00e1gina"
          >
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="https://www.instagram.com/saycheesebynestorperez/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de SayCheese"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-primary">
        <div className="mx-auto max-w-[1600px] px-6 py-5 lg:px-10">
          <p className="text-center text-xs tracking-wider text-primary-foreground">
            &copy; {new Date().getFullYear()} SayCheese by N&eacute;stor P&eacute;rez. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
