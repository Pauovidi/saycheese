"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { reserveDropPrelaunch } from "@/actions/drops"
import { DEFAULT_DROP_PREORDER_CTA_TEXT, normalizeDropPreorderCtaText } from "@/src/data/drops"

type HeroDropFloatingProps = {
  drop: {
    id: string
    slug: string
    name: string
    launchAt: string
    floatingMessage: string
    preorderCtaText?: string
    availableStock: number
    status: "PRELAUNCH" | "SOLD_OUT"
  }
}

function createBrowserIdempotencyKey(dropId: string) {
  const storageKey = `tentados-drop-preorder-${dropId}`

  try {
    const current = window.localStorage.getItem(storageKey)
    if (current) return current
    const next = crypto.randomUUID()
    window.localStorage.setItem(storageKey, next)
    return next
  } catch {
    return `${dropId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
}

export type HeroDropFloatingCardProps = {
  message: string
  countdown: string
  availableStock: number
  ctaText?: string
  soldOut?: boolean
  isPending?: boolean
  reservationDone?: boolean
  preview?: boolean
  onCtaClick?: () => void
}

export function HeroDropFloatingCard({
  message,
  countdown,
  availableStock,
  ctaText = DEFAULT_DROP_PREORDER_CTA_TEXT,
  soldOut = false,
  isPending = false,
  reservationDone = false,
  preview = false,
  onCtaClick,
}: HeroDropFloatingCardProps) {
  const visibleCta = normalizeDropPreorderCtaText(ctaText)

  return (
    <aside className="border border-[#f4eed4]/70 bg-[#601116]/92 p-4 text-[#f4eed4] shadow-2xl backdrop-blur md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-[#fffdf8]">
            {message}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.16em]">
            <span aria-hidden="true">{countdown}</span>
            <span className="sr-only">Cuenta atrás hasta el lanzamiento.</span>
            <span>{soldOut ? "Agotado" : `Quedan ${availableStock} unidades`}</span>
          </div>
        </div>

        {reservationDone ? (
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#f4eed4] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#f4eed4]"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Reservado
          </Link>
        ) : (
          <button
            type="button"
            onClick={preview ? undefined : onCtaClick}
            disabled={preview || soldOut || isPending}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#f4eed4] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#601116] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {soldOut ? "Agotado" : visibleCta}
          </button>
        )}
      </div>
    </aside>
  )
}

export function HeroDropFloating({ drop }: HeroDropFloatingProps) {
  const router = useRouter()
  const [remainingMs, setRemainingMs] = useState(() => new Date(drop.launchAt).getTime() - Date.now())
  const [availableStock, setAvailableStock] = useState(drop.availableStock)
  const [reservationDone, setReservationDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const soldOut = drop.status === "SOLD_OUT" || availableStock <= 0
  const countdown = useMemo(() => formatCountdown(remainingMs), [remainingMs])
  const ctaText = normalizeDropPreorderCtaText(drop.preorderCtaText)

  useEffect(() => {
    const launchTime = new Date(drop.launchAt).getTime()
    let refreshed = false

    const interval = window.setInterval(() => {
      const nextRemaining = launchTime - Date.now()
      setRemainingMs(nextRemaining)

      if (nextRemaining <= 0 && !refreshed) {
        refreshed = true
        router.refresh()
      }
    }, 1000)

    return () => window.clearInterval(interval)
  }, [drop.launchAt, router])

  function handleReserve() {
    startTransition(async () => {
      const idempotencyKey = createBrowserIdempotencyKey(drop.id)
      const response = await reserveDropPrelaunch({
        dropId: drop.id,
        idempotencyKey,
      })

      if (!response.ok) {
        toast.error(response.error)
        router.refresh()
        return
      }

      setAvailableStock(response.reservation.availableStock)
      setReservationDone(true)
      toast.success(response.reservation.reusedExisting ? "Tu preventa ya estaba registrada" : "Preventa registrada")
      router.refresh()
    })
  }

  return (
    <div className="absolute inset-x-4 bottom-6 z-20 mx-auto max-w-2xl md:bottom-8">
      <HeroDropFloatingCard
        message={drop.floatingMessage}
        countdown={countdown}
        availableStock={availableStock}
        ctaText={ctaText}
        soldOut={soldOut}
        isPending={isPending}
        reservationDone={reservationDone}
        onCtaClick={handleReserve}
      />
    </div>
  )
}
