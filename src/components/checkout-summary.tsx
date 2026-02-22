"use client"

import Link from "next/link"
import { useCart } from "@/src/context/cart-context"

export function CheckoutSummary() {
  const { items, subtotal, clearCart } = useCart()

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <p className="text-sm text-muted-foreground">{"Tu carrito est\u00e1 vac\u00edo."}</p>
        <Link
          href="/productos"
          className="border border-foreground px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          Ver productos
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-border pb-6">
        {items.map((item) => (
          <div
            key={item.product.id}
            className="flex items-center justify-between border-t border-border py-4 first:border-0"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                {item.product.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.product.format === "tarta" ? "Tarta" : "Cajita"} &middot; Cantidad: {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium text-foreground">
              {(item.product.priceValue * item.quantity).toFixed(2)}&#8364;
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-wider text-foreground">
          Total
        </span>
        <span className="text-lg font-bold text-foreground">
          {subtotal.toFixed(2)}&#8364;
        </span>
      </div>

      <button
        onClick={() => {
          clearCart()
          alert("Pedido realizado correctamente. \u00a1Gracias por tu compra!")
        }}
        className="w-full bg-primary py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-80"
      >
        Confirmar pedido
      </button>

        <p className="text-center text-xs text-muted-foreground">
          {"Esta es una p\u00e1gina de demostraci\u00f3n. No se realizar\u00e1 ning\u00fan cargo real."}
        </p>
    </div>
  )
}
