import { CartDrawer } from "@/src/components/cart-drawer"
import { SiteFooter } from "@/src/components/site-footer"
import { SiteHeader } from "@/src/components/site-header"
import { ChatWidget } from "@/src/components/chat-widget"
import { CartProvider } from "@/src/context/cart-context"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <CartDrawer />
      <ChatWidget />
    </CartProvider>
  )
}
