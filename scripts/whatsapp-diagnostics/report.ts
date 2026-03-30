import path from "node:path"

import {
  MONITOR_OUTPUT_FILE,
  REPORT_OUTPUT_FILE,
  formatDuration,
  getNumberEnv,
  parseArgs,
  printKeyValue,
  printSection,
  readJsonFile,
  writeJsonFile,
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

type FailureWindow = {
  start: string
  end: string
  failures: number
  duration_ms: number
  error_codes: Record<string, number>
}

function buildFailureWindows(entries: MonitorEntry[], maxGapMs: number) {
  const windows: FailureWindow[] = []
  let currentWindow: FailureWindow | null = null
  let previousFailureAt: number | null = null

  for (const entry of entries) {
    if (entry.success) {
      currentWindow = null
      previousFailureAt = null
      continue
    }

    const currentTimestamp = new Date(entry.timestamp).getTime()
    const shouldStartNewWindow =
      currentWindow === null || previousFailureAt === null || currentTimestamp - previousFailureAt > maxGapMs

    if (shouldStartNewWindow) {
      currentWindow = {
        start: entry.timestamp,
        end: entry.timestamp,
        failures: 0,
        duration_ms: 0,
        error_codes: {},
      }

      windows.push(currentWindow)
    }

    const activeWindow = currentWindow

    activeWindow.failures += 1
    activeWindow.end = entry.timestamp
    activeWindow.duration_ms = new Date(activeWindow.end).getTime() - new Date(activeWindow.start).getTime()

    const errorCode = entry.error_code ?? "unknown"
    activeWindow.error_codes[errorCode] = (activeWindow.error_codes[errorCode] ?? 0) + 1
    previousFailureAt = currentTimestamp
  }

  return windows
}

async function main() {
  const args = parseArgs()
  const inputFile = args.values.get("file") ? path.resolve(args.values.get("file")!) : MONITOR_OUTPUT_FILE
  const intervalMs = getNumberEnv("WHATSAPP_MONITOR_INTERVAL_MS", 120_000)
  const entries = (await readJsonFile<MonitorEntry[]>(inputFile, [])).sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp)
  )

  if (!entries.length) {
    throw new Error(`No hay datos para analizar en ${inputFile}`)
  }

  const successes = entries.filter((entry) => entry.success).length
  const failures = entries.length - successes
  const errorsByType = entries.reduce<Record<string, number>>((accumulator, entry) => {
    if (entry.success) {
      return accumulator
    }

    const errorType = entry.error_code ?? "unknown"
    accumulator[errorType] = (accumulator[errorType] ?? 0) + 1
    return accumulator
  }, {})

  const failureWindows = buildFailureWindows(entries, Math.ceil(intervalMs * 1.5))
  const avgResponseTimeMs =
    entries.reduce((total, entry) => total + entry.response_time_ms, 0) / Math.max(entries.length, 1)

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: inputFile,
    totalChecks: entries.length,
    successCount: successes,
    failureCount: failures,
    successRate: Number(((successes / entries.length) * 100).toFixed(2)),
    averageResponseTimeMs: Number(avgResponseTimeMs.toFixed(2)),
    errorsByType,
    failureWindows,
  }

  await writeJsonFile(REPORT_OUTPUT_FILE, report)

  printSection("Reporte Monitor WhatsApp")
  printKeyValue("Muestras", report.totalChecks)
  printKeyValue("Éxitos", report.successCount)
  printKeyValue("Fallos", report.failureCount)
  printKeyValue("Tasa de éxito", `${report.successRate}%`)
  printKeyValue("Tiempo medio", formatDuration(report.averageResponseTimeMs))
  printKeyValue("Ventanas de fallo", report.failureWindows.length)
  printKeyValue("JSON", REPORT_OUTPUT_FILE)

  if (Object.keys(errorsByType).length) {
    console.log(`Errores por tipo: ${JSON.stringify(errorsByType)}`)
  }

  for (const window of failureWindows) {
    console.log(
      `- ${window.start} -> ${window.end} | fallos=${window.failures} | duración=${formatDuration(window.duration_ms)} | errores=${JSON.stringify(window.error_codes)}`
    )
  }
}

main().catch((error: unknown) => {
  console.error("Fallo en report.ts:", error)
  process.exitCode = 1
})
