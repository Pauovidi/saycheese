import { createHmac, timingSafeEqual } from "node:crypto"

type ValidateTwilioSignatureInput = {
  authToken: string
  formData: FormData
  requestUrl: string
  signature: string
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function validateTwilioSignature(input: ValidateTwilioSignatureInput) {
  const { authToken, formData, requestUrl, signature } = input

  const payload = Array.from(formData.entries())
    .filter(([, value]) => typeof value === "string")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .reduce((serialized, [key, value]) => serialized + key + value, requestUrl)

  const expectedSignature = createHmac("sha1", authToken).update(payload).digest("base64")

  return safeCompare(expectedSignature, signature)
}
