import {
  TWILIO_LOGS_OUTPUT_FILE,
  buildConversationKey,
  countBy,
  fetchLatestTwilioWhatsappMessages,
  getNumberEnv,
  printKeyValue,
  printSection,
  writeJsonFile,
} from "./shared"

type ExtractedMessage = {
  sid: string | null
  date: string | null
  direction: string | null
  status: string | null
  error_code: string | null
  from: string | null
  to: string | null
  conversation: string
}

async function main() {
  const limit = getNumberEnv("TWILIO_MESSAGES_LIMIT", 50)
  const messages = await fetchLatestTwilioWhatsappMessages(limit)

  const extracted: ExtractedMessage[] = messages.map((message) => ({
    sid: message.sid ?? null,
    date: message.date_sent ?? message.date_created ?? null,
    direction: message.direction ?? null,
    status: message.status ?? null,
    error_code: message.error_code === null || message.error_code === undefined ? null : String(message.error_code),
    from: message.from ?? null,
    to: message.to ?? null,
    conversation: buildConversationKey(message.from ?? "unknown", message.to ?? "unknown"),
  }))

  const grouped = Object.values(
    extracted.reduce<Record<string, { conversation: string; messages: ExtractedMessage[] }>>((accumulator, message) => {
      const current = accumulator[message.conversation] ?? {
        conversation: message.conversation,
        messages: [],
      }

      current.messages.push(message)
      accumulator[message.conversation] = current
      return accumulator
    }, {})
  ).map((conversation) => ({
    conversation: conversation.conversation,
    total: conversation.messages.length,
    directions: countBy(
      conversation.messages
        .map((message) => message.direction)
        .filter((value): value is string => Boolean(value))
    ),
    statuses: countBy(
      conversation.messages
        .map((message) => message.status)
        .filter((value): value is string => Boolean(value))
    ),
    errors: countBy(
      conversation.messages
        .map((message) => message.error_code)
        .filter((value): value is string => Boolean(value))
    ),
    latestMessageAt: [...conversation.messages]
      .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""))[0]?.date ?? null,
    messages: conversation.messages,
  }))

  const result = {
    fetchedAt: new Date().toISOString(),
    totalMessages: extracted.length,
    conversations: grouped,
  }

  await writeJsonFile(TWILIO_LOGS_OUTPUT_FILE, result)

  printSection("Twilio Logs")
  printKeyValue("Mensajes analizados", extracted.length)
  printKeyValue("Conversaciones", grouped.length)
  printKeyValue("JSON", TWILIO_LOGS_OUTPUT_FILE)

  for (const conversation of grouped.slice(0, 10)) {
    console.log(
      `- ${conversation.conversation} | total=${conversation.total} | latest=${conversation.latestMessageAt ?? "n/a"} | statuses=${JSON.stringify(conversation.statuses)} | errors=${JSON.stringify(conversation.errors)}`
    )
  }
}

main().catch((error: unknown) => {
  console.error("Fallo en test_twilio_logs.ts:", error)
  process.exitCode = 1
})
