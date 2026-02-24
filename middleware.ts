import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

function getPublicSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error("Faltan variables públicas de Supabase")
  }

  return { supabaseUrl, anonKey }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return NextResponse.next()
  }

  const response = NextResponse.next({ request })
  const { supabaseUrl, anonKey } = getPublicSupabaseEnv()

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url))
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
  const currentEmail = session.user.email?.toLowerCase()

  if (!adminEmail || currentEmail !== adminEmail) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL("/admin/login?error=not_authorized", request.url))
  }

  return response
}

export const config = {
  matcher: ["/admin/:path*"],
}
