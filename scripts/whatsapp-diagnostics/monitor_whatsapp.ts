import {
  MONITOR_OUTPUT_FILE,
  appendJsonArrayFile,
  formatDuration,
  getEnv,
  getNumberEnv,
  getOptionalEnv,
  parseArgs,
  printKeyValue,
  printSection,
  sendTwilioWhatsappMessage,
  sleep,
} from "./shared"

type MonitorEntry = {
  timestamp: string
  success: boolean
  error_code: string | null
  error_message: string | null
  status: string | null
  sid: string | null
  response_time_ms: number
}

async function runProbe(from: string, to: string, body: string) {
  const startedAt = Date.now()

  try {
    const result = await sendTwilioWhatsappMessage({ from, to, body })
    const responseTimeMs = Date.now() - startedAt
    const entry: MonitorEntry = {
      timestamp: new Date().toISOString(),
      success: result.ok,
      error_code:
        result.data?.error_code === null || result.data?.error_code === undefined ? null : String(result.data.error_code),
      error_message: result.data?.error_message ?? (!result.ok ? result.rawText : null),
      status: result.data?.status ?? null,
      sid: result.data?.sid ?? null,
      response_time_ms: responseTimeMs,
    }

    const total = await appendJsonArrayFile(MONITOR_OUTPUT_FILE, entry)

    printSection("Monitor WhatsApp")
    printKeyValue("Timestamp", entry.timestamp)
    printKeyValue("Resultado", entry.success ? "success" : "fail")
    printKeyValue("Status", entry.status)
    printKeyValue("Error code", entry.error_code)
    printKeyValue("Tiempo", formatDuration(responseTimeMs))
    printKeyValue("Muestras guardadas", total)
    printKeyValue("JSON", MONITOR_OUTPUT_FILE)
  } catch (error) {
    const responseTimeMs = Date.now() - startedAt
    const entry: MonitorEntry = {
      timestamp: new Date().toISOString(),
      success: false,
      error_code: null,
      error_message: error instanceof Error ? error.message : String(error),
      status: null,
      sid: null,
      response_time_ms: responseTimeMs,
    }

    const total = await appendJsonArrayFile(MONITOR_OUTPUT_FILE, entry)

    printSection("Monitor WhatsApp")
    printKeyValue("Timestamp", entry.timestamp)
    printKeyValue("Resultado", "fail")
    printKeyValue("Error code", entry.error_code)
    printKeyValue("Tiempo", formatDuration(responseTimeMs))
    printKeyValue("Muestras guardadas", total)
    printKeyValue("JSON", MONITOR_OUTPUT_FILE)
    console.error(entry.error_message)
  }
}

async function main() {
  const args = parseArgs()
  const from = getOptionalEnv(["TWILIO_MONITOR_FROM", "TWILIO_WHATSAPP_FROM"]) ?? getEnv("TWILIO_MONITOR_FROM")
  const to = getOptionalEnv(["TWILIO_MONITOR_TO", "TWILIO_WHATSAPP_TO"]) ?? getEnv("TWILIO_MONITOR_TO")
  const body = getOptionalEnv(["WHATSAPP_MONITOR_MESSAGE"], "hola")!
  const intervalMs = getNumberEnv("WHATSAPP_MONITOR_INTERVAL_MS", 120_000)
  const once = args.flags.has("once")

  printSection("Configuración Monitor")
  printKeyValue("From", from)
  printKeyValue("To", to)
  printKeyValue("Mensaje", body)
  printKeyValue("Intervalo", `${intervalMs} ms`)
  printKeyValue("Modo", once ? "once" : "loop")

  do {
    await runProbe(from, to, body)

    if (once) {
      break
    }

    await sleep(intervalMs)
  } while (true)
}

main().catch((error: unknown) => {
  console.error("Fallo en monitor_whatsapp.ts:", error)
  process.exitCode = 1
})
