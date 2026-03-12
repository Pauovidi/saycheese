"use client"

import { useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { X, Minus, Plus, Trash2 } from "lucide-react"
import { getCustomerFacingFormatLabel } from "@/src/data/business"
import { useCart } from "@/src/context/cart-context"

export function CartDrawer() {
  const { isOpen, closeCart, items, updateQuantity, removeItem, subtotal } = useCart()

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 transition-opacity"
          onClick={closeCart}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Carrito de la compra"
        aria-modal={isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
            Tu pedido
          </h2>
          <button onClick={closeCart} aria-label="Cerrar carrito" className="text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {"Tu pedido est\u00e1 vac\u00edo."}
            </p>
          ) : (
            <ul className="flex flex-col gap-6">
              {items.map((item) => (
                <li key={item.product.id} className="flex gap-4">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden bg-secondary">
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-foreground">
                          {item.product.name}
                        </p>
                        <span className="mt-0.5 inline-block bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-foreground">
                          {getCustomerFacingFormatLabel(item.product.format)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        aria-label={`Eliminar ${item.product.name}`}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          aria-label="Reducir cantidad"
                          className="flex h-7 w-7 items-center justify-center border border-border text-foreground transition-colors hover:bg-secondary"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-[1.5rem] text-center text-xs text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          aria-label="Aumentar cantidad"
                          className="flex h-7 w-7 items-center justify-center border border-border text-foreground transition-colors hover:bg-secondary"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {(item.product.priceValue * item.quantity).toFixed(2)}&#8364;
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground">
                Total parcial
              </span>
              <span className="text-sm font-bold text-foreground">
                {subtotal.toFixed(2)}&#8364;
              </span>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="flex w-full items-center justify-center bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-80"
            >
              Finalizar pedido
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
