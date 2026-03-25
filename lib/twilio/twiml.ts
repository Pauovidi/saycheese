import { NextResponse } from "next/server"

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function createTwilioMessagingResponse(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
}

export function createTwilioXmlResponse(body: string, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "text/xml; charset=utf-8")

  return new NextResponse(body, {
    ...init,
    headers,
  })
}
