"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/browser"

export function AdminLogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/admin/login")
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  )
}
