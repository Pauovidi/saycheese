import { performance } from "node:perf_hooks"

import {
  BACKEND_TEST_OUTPUT_FILE,
  createTwilioSignature,
  formatDuration,
  getOptionalEnv,
  looksLikeValidTwiml,
  printKeyValue,
  printSection,
  writeJsonFile,
} from "./shared"

async function main() {
  const baseUrl = getOptionalEnv(["WHATSAPP_DIAGNOSTICS_BASE_URL", "NEXT_PUBLIC_SITE_URL"], "http://localhost:3000")!
  const endpointPath = getOptionalEnv(["WHATSAPP_TEST_ENDPOINT"], "/api/twilio/whatsapp")!
  const body = getOptionalEnv(["WHATSAPP_TEST_BODY"], "hola")!
  const from = getOptionalEnv(["WHATSAPP_TEST_FROM"], "whatsapp:+34600000000")!
  const to = getOptionalEnv(["WHATSAPP_TEST_TO"], "whatsapp:+34900000000")!
  const authToken = getOptionalEnv(["TWILIO_TEST_SIGNATURE_AUTH_TOKEN", "TWILIO_AUTH_TOKEN"])
  const requestUrl = new URL(endpointPath, baseUrl).toString()

  const form = new URLSearchParams({
    Body: body,
    From: from,
    To: to,
    MessageSid: `SM_DIAG_${Date.now()}`,
  })

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  })

  if (authToken) {
    headers.set("X-Twilio-Signature", createTwilioSignature(requestUrl, form, authToken))
  }

  printSection("Prueba Backend WhatsApp")
  printKeyValue("URL", requestUrl)
  printKeyValue("From", from)
  printKeyValue("Body", body)

  const startedAt = performance.now()
  const response = await fetch(requestUrl, {
    method: "POST",
    headers,
    body: form.toString(),
  })
  const responseTimeMs = performance.now() - startedAt
  const responseBody = await response.text()
  const contentType = response.headers.get("content-type") ?? ""
  const twimlValid = looksLikeValidTwiml(responseBody)
  const passed = response.status === 200 && contentType.includes("text/xml") && twimlValid

  const result = {
    checkedAt: new Date().toISOString(),
    request: {
      url: requestUrl,
      body,
      from,
      to,
      signatureIncluded: Boolean(authToken),
    },
    response: {
      status: response.status,
      contentType,
      responseTimeMs: Number(responseTimeMs.toFixed(2)),
      twimlValid,
      bodyPreview: responseBody.length > 240 ? `${responseBody.slice(0, 237)}...` : responseBody,
    },
    passed,
  }

  await writeJsonFile(BACKEND_TEST_OUTPUT_FILE, result)

  printSection("Resultado")
  printKeyValue("Status", response.status)
  printKeyValue("Content-Type", contentType)
  printKeyValue("TwiML válido", twimlValid)
  printKeyValue("Tiempo", formatDuration(responseTimeMs))
  printKeyValue("JSON", BACKEND_TEST_OUTPUT_FILE)

  if (!passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error("Fallo en test_backend.ts:", error)
  process.exitCode = 1
})
