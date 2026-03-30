type LogLevel = "info" | "warn" | "error"

type StructuredLogPayload = Record<string, unknown>

function serializeUnknown(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return error
}

export function createStructuredLog(scope: string, event: string, payload: StructuredLogPayload = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    scope,
    event,
    ...payload,
  })
}

export function writeStructuredLog(level: LogLevel, scope: string, event: string, payload: StructuredLogPayload = {}) {
  const line = createStructuredLog(scope, event, payload)

  if (level === "error") {
    console.error(line)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.info(line)
}

export function serializeErrorForLog(error: unknown) {
  return serializeUnknown(error)
}
