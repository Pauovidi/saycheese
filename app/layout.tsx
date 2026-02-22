import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { CartProvider } from "@/src/context/cart-context"
import { SiteHeader } from "@/src/components/site-header"
import { SiteFooter } from "@/src/components/site-footer"
import { CartDrawer } from "@/src/components/cart-drawer"
import { WhatsAppButton } from "@/src/components/whatsapp-button"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "SayCheese | Pastelería de Autor",
  description:
    "Galería de tartas de queso artesanas. Cada pieza, una obra maestra.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#A16336",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        <CartProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
          <CartDrawer />
          <WhatsAppButton />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
