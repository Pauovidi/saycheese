import { createHmac } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

export const OUTPUT_DIR = path.resolve(process.cwd(), "diagnostics-output", "whatsapp")
export const BACKEND_TEST_OUTPUT_FILE = path.join(OUTPUT_DIR, "test-backend.latest.json")
export const TWILIO_LOGS_OUTPUT_FILE = path.join(OUTPUT_DIR, "twilio-logs.latest.json")
export const MONITOR_OUTPUT_FILE = path.join(OUTPUT_DIR, "monitor-results.json")
export const REPORT_OUTPUT_FILE = path.join(OUTPUT_DIR, "monitor-report.latest.json")

export type TwilioMessageResource = {
  sid?: string
  account_sid?: string
  body?: string
  from?: string
  to?: string
  direction?: string
  status?: string
  error_code?: number | string | null
  error_message?: string | null
  date_created?: string | null
  date_sent?: string | null
}

type TwilioMessagesPage = {
  messages?: TwilioMessageResource[]
  next_page_uri?: string | null
}

type ParsedArgs = {
  flags: Set<string>
  values: Map<string, string>
}

type TwilioApiJsonResult<T> = {
  ok: boolean
  status: number
  url: string
  data: T | null
  rawText: string
}

export function parseArgs(argv = process.argv.slice(2)): ParsedArgs {
  const flags = new Set<string>()
  const values = new Map<string, string>()

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue
    }

    const trimmed = arg.slice(2)
    const [key, ...rest] = trimmed.split("=")

    if (!key) {
      continue
    }

    if (!rest.length) {
      flags.add(key)
      continue
    }

    values.set(key, rest.join("="))
  }

  return { flags, values }
}

export function getEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim()

  if (value) {
    return value
  }

  if (fallback !== undefined) {
    return fallback
  }

  throw new Error(`Falta variable de entorno requerida: ${name}`)
}

export function getOptionalEnv(names: string[], fallback?: string) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }

  return fallback
}

export function getNumberEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim()
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function ensureOutputDir() {
  await mkdir(OUTPUT_DIR, { recursive: true })
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await ensureOutputDir()
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8")
    return JSON.parse(content) as T
  } catch {
    return fallback
  }
}

export async function appendJsonArrayFile<T>(filePath: string, entry: T) {
  const entries = await readJsonFile<T[]>(filePath, [])
  entries.push(entry)
  await writeJsonFile(filePath, entries)
  return entries.length
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function printSection(title: string) {
  console.log(`\n=== ${title} ===`)
}

export function printKeyValue(label: string, value: string | number | boolean | null | undefined) {
  console.log(`${label}: ${value ?? "n/a"}`)
}

export function formatDuration(ms: number) {
  return `${ms.toFixed(ms >= 100 ? 0 : 2)} ms`
}

export function normalizeWhatsAppAddress(value: string) {
  return value.replace(/^whatsapp:/i, "").trim()
}

export function buildConversationKey(from: string, to: string) {
  return [normalizeWhatsAppAddress(from), normalizeWhatsAppAddress(to)].sort().join(" <-> ")
}

export function looksLikeValidTwiml(value: string) {
  const trimmed = value.trim()

  return (
    trimmed.startsWith("<?xml") &&
    trimmed.includes("<Response>") &&
    trimmed.includes("</Response>") &&
    trimmed.includes("<Message>") &&
    trimmed.includes("</Message>")
  )
}

export function createTwilioSignature(requestUrl: string, params: URLSearchParams, authToken: string) {
  const payload = Array.from(params.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .reduce((serialized, [key, value]) => serialized + key + value, requestUrl)

  return createHmac("sha1", authToken).update(payload).digest("base64")
}

function getTwilioCredentials() {
  return {
    accountSid: getEnv("TWILIO_ACCOUNT_SID"),
    authToken: getEnv("TWILIO_AUTH_TOKEN"),
  }
}

function buildTwilioApiUrl(pathname: string) {
  const { accountSid } = getTwilioCredentials()

  if (pathname.startsWith("https://")) {
    return pathname
  }

  if (pathname.startsWith("/2010-04-01/")) {
    return `https://api.twilio.com${pathname}`
  }

  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${pathname}`
}

async function twilioApiRequestJson<T>(pathname: string, init: RequestInit = {}): Promise<TwilioApiJsonResult<T>> {
  const { accountSid, authToken } = getTwilioCredentials()
  const url = buildTwilioApiUrl(pathname)
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`)
  headers.set("Accept", "application/json")

  const response = await fetch(url, {
    ...init,
    headers,
  })

  const rawText = await response.text()
  const data = rawText ? (JSON.parse(rawText) as T) : null

  return {
    ok: response.ok,
    status: response.status,
    url,
    data,
    rawText,
  }
}

export async function sendTwilioWhatsappMessage(input: { from: string; to: string; body: string }) {
  const params = new URLSearchParams({
    From: input.from,
    To: input.to,
    Body: input.body,
  })

  return twilioApiRequestJson<TwilioMessageResource>("/Messages.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })
}

export async function fetchLatestTwilioWhatsappMessages(limit: number) {
  const messages: TwilioMessageResource[] = []
  let nextPagePath: string | null = `/Messages.json?PageSize=${Math.min(Math.max(limit, 1), 1000)}`

  while (nextPagePath && messages.length < limit) {
    const page = await twilioApiRequestJson<TwilioMessagesPage>(nextPagePath)

    if (!page.ok) {
      throw new Error(`Twilio API devolvió ${page.status} en ${page.url}: ${page.rawText}`)
    }

    const currentPageMessages = (page.data?.messages ?? []).filter((message) => {
      const from = message.from ?? ""
      const to = message.to ?? ""
      return from.startsWith("whatsapp:") || to.startsWith("whatsapp:")
    })

    messages.push(...currentPageMessages)
    nextPagePath = page.data?.next_page_uri ?? null
  }

  return messages.slice(0, limit)
}

export function countBy<T extends string | number>(items: T[]) {
  const counts = new Map<T, number>()

  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }

  return Object.fromEntries(counts.entries())
}
