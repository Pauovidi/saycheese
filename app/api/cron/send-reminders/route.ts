import { NextResponse } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/cron-auth"
import { getAdminClient } from "@/lib/supabase/admin"

const GRAPH_API_BASE = "https://graph.facebook.com/v23.0"
export const dynamic = "force-dynamic"

async function sendReminderTemplate(phone: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const templateName = process.env.WHATSAPP_TEMPLATE_REMINDER_NAME
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG ?? "es_ES"

  if (!token || !phoneNumberId || !templateName) {
    throw new Error("Faltan variables de WhatsApp template")
  }

  const response = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLang },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const supabase = getAdminClient()

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, phone")
    .eq("status", "pending")
    .eq("reminder_status", "pending")
    .lte("reminder_at", new Date().toISOString())

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const order of orders ?? []) {
    try {
      await sendReminderTemplate(order.phone)
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          reminder_sent_at: new Date().toISOString(),
          reminder_status: "sent",
          reminder_error: null,
        })
        .eq("id", order.id)

      if (updateError) throw new Error(updateError.message)
      sent += 1
    } catch (sendError) {
      failed += 1
      const errorText = sendError instanceof Error ? sendError.message : "error"
      await supabase
        .from("orders")
        .update({ reminder_status: "failed", reminder_error: errorText })
        .eq("id", order.id)
    }
  }

  return NextResponse.json({ ok: true, sent, failed, total: (orders ?? []).length })
}
