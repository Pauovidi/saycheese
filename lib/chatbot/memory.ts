import "server-only"

import { getAdminClient } from "@/lib/supabase/admin"

type Channel = "web" | "whatsapp"

type MessageRole = "user" | "assistant" | "system"

export async function getOrCreateUser(input: { channel: Channel; externalId: string; phone?: string }) {
  const supabase = getAdminClient()

  const { data: existing, error: lookupError } = await supabase
    .from("chat_users")
    .select("id")
    .eq("channel", input.channel)
    .eq("external_id", input.externalId)
    .maybeSingle()

  if (lookupError) throw new Error(lookupError.message)

  if (existing?.id) {
    if (input.phone) {
      await supabase
        .from("chat_users")
        .update({ phone: input.phone })
        .eq("id", existing.id)
    }
    return { userId: existing.id }
  }

  const { data, error } = await supabase
    .from("chat_users")
    .insert({
      channel: input.channel,
      external_id: input.externalId,
      phone: input.phone,
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear chat_user")

  return { userId: data.id }
}

export async function loadContext(userId: string) {
  const supabase = getAdminClient()

  const [{ data: state, error: stateError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("chat_user_state").select("summary").eq("user_id", userId).maybeSingle(),
    supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  if (stateError) throw new Error(stateError.message)
  if (messagesError) throw new Error(messagesError.message)

  return {
    summary: state?.summary ?? null,
    messagesLastN: [...(messages ?? [])].reverse().map((m) => ({ role: m.role as MessageRole, content: m.content })),
  }
}

export async function saveMessage(userId: string, role: MessageRole, content: string) {
  const supabase = getAdminClient()
  const { error } = await supabase.from("chat_messages").insert({ user_id: userId, role, content })
  if (error) throw new Error(error.message)
}

export async function updateSummary(userId: string, summary: string) {
  const supabase = getAdminClient()
  const { error } = await supabase.from("chat_user_state").upsert({ user_id: userId, summary }, { onConflict: "user_id" })
  if (error) throw new Error(error.message)
}

export async function getPauseState(userId: string) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from("chat_user_state")
    .select("bot_paused_until")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return { botPausedUntil: data?.bot_paused_until ? new Date(data.bot_paused_until) : null }
}

export async function setPauseState(userId: string, untilIso: string) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from("chat_user_state")
    .upsert({ user_id: userId, bot_paused_until: untilIso }, { onConflict: "user_id" })

  if (error) throw new Error(error.message)
}

export async function setLastOpenAIResponseId(userId: string, responseId: string) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from("chat_user_state")
    .upsert({ user_id: userId, last_openai_response_id: responseId }, { onConflict: "user_id" })

  if (error) throw new Error(error.message)
}

export async function pruneMessages(userId: string, keepLast = 20) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  const stale = (data ?? []).slice(keepLast).map((row) => row.id)

  if (!stale.length) return

  const { error: deleteError } = await supabase.from("chat_messages").delete().in("id", stale)
  if (deleteError) throw new Error(deleteError.message)
}
