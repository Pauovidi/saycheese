"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { DEFAULT_DROP_PREORDER_CTA_TEXT, normalizeDropPreorderCtaText } from "@/src/data/drops"

type HeroDropFloatingProps = {
  drop: {
    slug: string
    launchAt: string
    floatingMessage: string
    preorderCtaText?: string
    preorderRemaining: number
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
  ctaText?: string
  href?: string
  preview?: boolean
  preorderRemaining?: number
}

export function HeroDropFloatingCard({
  message,
  countdown,
  ctaText = DEFAULT_DROP_PREORDER_CTA_TEXT,
  href = "/drops",
  preview = false,
  preorderRemaining,
}: HeroDropFloatingCardProps) {
  const visibleCta = normalizeDropPreorderCtaText(ctaText)
  const card = (
    <aside className="bg-[rgba(96,17,22,0.7)] p-6 text-[#f4eed4] shadow-2xl backdrop-blur-md transition-colors sm:p-7 md:p-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8">
        <div className="min-w-0 space-y-4 text-left">
          <p className="whitespace-pre-line text-base font-semibold leading-relaxed text-[#fffdf8] md:text-lg">
            {message}
          </p>
          <div className="space-y-2">
            <span aria-hidden="true" className="block text-2xl font-bold uppercase tracking-[0.12em] text-[#fffdf8] sm:text-3xl md:text-4xl">
              {countdown}
            </span>
            <span className="sr-only">Cuenta atrás hasta el lanzamiento.</span>
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[#f4eed4]/90 md:text-sm">
              Preventa bajo pedido
            </span>
            {typeof preorderRemaining === "number" ? (
              <span className="block text-sm font-bold uppercase tracking-[0.12em] text-white md:text-base">
                {preorderRemaining > 0 ? `Solo quedan ${preorderRemaining} unidades en preventa` : "Preventa agotada"}
              </span>
            ) : null}
          </div>
        </div>

        {preview ? (
          <button
            type="button"
            disabled
            className="inline-flex min-h-14 w-full items-center justify-center bg-white px-7 py-4 text-sm font-bold uppercase tracking-[0.22em] text-[#601116] opacity-60 md:w-auto md:min-w-48"
          >
            {visibleCta}
          </button>
        ) : (
          <span className="inline-flex min-h-14 w-full items-center justify-center bg-white px-7 py-4 text-sm font-bold uppercase tracking-[0.22em] text-[#601116] md:w-auto md:min-w-48">
            {visibleCta}
          </span>
        )}
      </div>
    </aside>
  )

  if (preview) return card

  return (
    <Link href={href} aria-label={`${visibleCta}: abrir el drop`} className="block transition-opacity hover:opacity-95">
      {card}
    </Link>
  )
}

export function HeroDropFloating({ drop }: HeroDropFloatingProps) {
  const router = useRouter()
  const [remainingMs, setRemainingMs] = useState(() => new Date(drop.launchAt).getTime() - Date.now())
  const countdown = useMemo(() => formatCountdown(remainingMs), [remainingMs])

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

  return (
    <div className="w-full max-w-4xl">
      <HeroDropFloatingCard
        message={drop.floatingMessage}
        countdown={countdown}
        ctaText={drop.preorderCtaText}
        href={`/drops/${drop.slug}`}
        preorderRemaining={drop.preorderRemaining}
      />
    </div>
  )
}
