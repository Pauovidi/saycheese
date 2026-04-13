import { CartDrawer } from "@/src/components/cart-drawer"
import { ContactLauncher } from "@/src/components/contact-launcher"
import { SiteFooter } from "@/src/components/site-footer"
import { SiteHeader } from "@/src/components/site-header"
import { CartProvider } from "@/src/context/cart-context"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <CartDrawer />
      <ContactLauncher />
    </CartProvider>
  )
}
