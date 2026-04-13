"use client"

import { useEffect, useState } from "react"

import { useIsMobile } from "@/hooks/use-mobile"

import { ChatWidget } from "@/src/components/chat-widget"
import { WhatsAppButton } from "@/src/components/whatsapp-button"

export function ContactLauncher() {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return isMobile ? <WhatsAppButton /> : <ChatWidget />
}
