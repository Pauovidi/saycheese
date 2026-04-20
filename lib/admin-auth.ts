import "server-only"

import { createClient } from "@/lib/supabase/server"

export async function requireAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("No autenticado")
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
  const currentEmail = user.email?.toLowerCase()

  if (!adminEmail || currentEmail !== adminEmail) {
    throw new Error("No autorizado")
  }

  return { supabase, user }
}
