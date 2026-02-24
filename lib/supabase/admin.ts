import { createClient } from "@supabase/supabase-js"

let cachedAdminUid: string | null = null

export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Faltan variables SUPABASE para server")
  }

  return createClient(supabaseUrl, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function getAdminUid() {
  if (cachedAdminUid) {
    return cachedAdminUid
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()

  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL no configurado")
  }

  const supabase = getAdminClient()
  let page = 1

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })

    if (error) {
      throw new Error(error.message)
    }

    const found = data.users.find((user: { id: string; email?: string | null }) => user.email?.toLowerCase() === adminEmail)

    if (found) {
      cachedAdminUid = found.id
      return found.id
    }

    if (!data.users.length) {
      break
    }

    page += 1
  }

  throw new Error("No se encontró usuario admin por ADMIN_EMAIL")
}
