import { createHmac, timingSafeEqual } from "node:crypto"

type ValidateYCloudSignatureInput = {
  payload: string
  signatureHeader: string
  secret: string
  toleranceSeconds?: number
  now?: number
}

type ParsedYCloudSignature = {
  timestamp: string
  signature: string
}

const DEFAULT_TOLERANCE_SECONDS = 300

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function parseYCloudSignatureHeader(signatureHeader: string): ParsedYCloudSignature | null {
  if (!signatureHeader.trim()) {
    return null
  }

  const values = signatureHeader
    .split(",")
    .map((part) => part.trim())
    .reduce<Record<string, string>>((accumulator, part) => {
      const separatorIndex = part.indexOf("=")
      if (separatorIndex <= 0) {
        return accumulator
      }

      const key = part.slice(0, separatorIndex).trim()
      const value = part.slice(separatorIndex + 1).trim()

      if (key && value) {
        accumulator[key] = value
      }

      return accumulator
    }, {})

  if (!values.t || !values.s) {
    return null
  }

  return {
    timestamp: values.t,
    signature: values.s,
  }
}

export function validateYCloudSignature(input: ValidateYCloudSignatureInput) {
  const { payload, secret, signatureHeader } = input
  const toleranceSeconds = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  const now = input.now ?? Date.now()
  const parsed = parseYCloudSignatureHeader(signatureHeader)

  if (!parsed) {
    return false
  }

  const timestampSeconds = Number.parseInt(parsed.timestamp, 10)

  if (!Number.isFinite(timestampSeconds)) {
    return false
  }

  if (toleranceSeconds > 0) {
    const driftSeconds = Math.abs(Math.floor(now / 1000) - timestampSeconds)
    if (driftSeconds > toleranceSeconds) {
      return false
    }
  }

  const signedPayload = `${parsed.timestamp}.${payload}`
  const expectedSignature = createHmac("sha256", secret).update(signedPayload).digest("hex")

  return safeCompare(expectedSignature, parsed.signature)
}
