import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json()
  // Mock: just log and return success
  console.log("Contact form:", body)
  return NextResponse.json({ success: true, message: "Mensaje recibido." })
}
