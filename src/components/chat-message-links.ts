type MessagePart =
  | { type: "text"; value: string }
  | { type: "link"; value: string }

const URL_PATTERN = /(https?:\/\/[^\s]+)/g

export function splitMessageLinks(text: string): MessagePart[] {
  const matches = text.matchAll(URL_PATTERN)
  const parts: MessagePart[] = []
  let cursor = 0

  for (const match of matches) {
    const value = match[0]
    const index = match.index ?? 0

    if (index > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, index) })
    }

    parts.push({ type: "link", value })
    cursor = index + value.length
  }

  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) })
  }

  return parts.length ? parts : [{ type: "text", value: text }]
}
