import { CartDrawer } from "@/src/components/cart-drawer"
import { SiteFooter } from "@/src/components/site-footer"
import { SiteHeader } from "@/src/components/site-header"
import { WhatsAppButton } from "@/src/components/whatsapp-button"
import { CartProvider } from "@/src/context/cart-context"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <CartDrawer />
      <WhatsAppButton />
    </CartProvider>
  )
}
