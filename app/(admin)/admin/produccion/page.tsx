export const dynamic = "force-dynamic"
export const revalidate = 0

import { Toaster } from "@/components/ui/sonner"
import { createClient } from "@/lib/supabase/server"
import { AdminOrderSearch } from "@/src/components/admin/order-search"
import { ProductionPanel } from "@/src/components/admin/production-panel"

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
  const { data } = await supabase
    .from("orders")
    .select("id, created_at, delivery_date, customer_name, customer_email, phone, status, order_items(type, flavor, qty)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(30)

  const orders = (data ?? []) as AdminOrder[]

  return (
    <>
      <h1 className="mb-6 text-xl font-bold text-foreground">Producción</h1>
      <ProductionPanel />

      <AdminOrderSearch />

      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
          Últimos pedidos
        </h2>

        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay pedidos.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <article key={order.id} className="rounded border border-border p-3">
                <p className="text-sm font-semibold">
                  Entrega: <span className="font-normal">{order.delivery_date}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.customer_name || "Sin nombre"} · {order.customer_email || "Sin email"} · {order.phone || "Sin teléfono"}
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {(order.order_items ?? []).map((item, idx) => (
                    <li key={`${order.id}-${idx}`}>
                      {item.type === "cake" ? "Tarta" : "Cajita"} · {item.flavor} · {item.qty}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
      <Toaster position="bottom-center" />
    </>
  )
}
