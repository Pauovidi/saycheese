export const dynamic = "force-dynamic"
export const revalidate = 0

import { Toaster } from "@/components/ui/sonner"
import { createClient } from "@/lib/supabase/server"
import { ManualOrderDialog } from "@/src/components/admin/manual-order-dialog"
import { LatestOrders } from "@/src/components/admin/latest-orders"
import { AdminOrderSearch } from "@/src/components/admin/order-search"
import { ProductionPanel } from "@/src/components/admin/production-panel"
import { getFlavors } from "@/src/data/products"

type OrderItem = {
  type: "cake" | "box"
  flavor: string
  qty: number
}

type AdminOrder = {
  id: string
  created_at: string
  delivery_date: string
  customer_name: string | null
  customer_email: string | null
  phone: string | null
  status: string
  order_items: OrderItem[] | null
}

export default async function ProduccionPage() {
  const supabase = await createClient()
  const flavors = getFlavors()
  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, delivery_date, customer_name, customer_email, phone, status, order_items(type, flavor, qty)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(30)

  const orders = ((error ? [] : data) ?? []) as AdminOrder[]

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-foreground">Producción</h1>
        <ManualOrderDialog
          flavors={flavors.map((flavor) => ({
            category: flavor.category,
            label: flavor.label,
          }))}
        />
      </div>
      <ProductionPanel />

      <AdminOrderSearch />
      <LatestOrders initialOrders={orders} />

      <Toaster position="bottom-center" />
    </>
  )
}
