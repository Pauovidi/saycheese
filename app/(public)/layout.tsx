import { CartDrawer } from "@/src/components/cart-drawer"
import { ContactLauncher } from "@/src/components/contact-launcher"
import { SiteFooter } from "@/src/components/site-footer"
import { SiteHeader } from "@/src/components/site-header"
import { CartProvider } from "@/src/context/cart-context"
import { hasPublicDropsNav } from "@/src/data/drops-store"

export const dynamic = "force-dynamic"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const showDropsLink = await hasPublicDropsNav()

  return (
    <CartProvider>
      <SiteHeader showDropsLink={showDropsLink} />
      <main>{children}</main>
      <SiteFooter />
      <CartDrawer />
      <ContactLauncher />
    </CartProvider>
  )
}
