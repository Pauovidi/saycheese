export function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const { searchParams } = new URL(request.url)
  const fromQuery = searchParams.get("secret")
  const fromHeader = request.headers.get("x-cron-secret")
  const fromAuthorization = request.headers.get("authorization")

  return fromAuthorization === `Bearer ${secret}` || fromHeader === secret || fromQuery === secret
}
