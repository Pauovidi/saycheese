import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json()
  // Mock: just log and return success
  console.log("Newsletter subscription:", body)
  return NextResponse.json({ success: true, message: "Suscripción realizada." })
}
