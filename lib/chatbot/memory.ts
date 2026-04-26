import "server-only"

import { buildPhoneSearchVariants, normalizePhone } from "@/lib/phone"
import { getAdminClient } from "@/lib/supabase/admin"

type Channel = "web" | "whatsapp"

type MessageRole = "user" | "assistant" | "system"

function normalizeChatUserPhone(phone?: string) {
  return normalizePhone(phone)
}

function buildChatUserPhoneVariants(phone?: string) {
  return buildPhoneSearchVariants(phone)
}

async function findUserByPhone(channel: Channel, phone?: string) {
  const variants = buildChatUserPhoneVariants(phone)
  if (!variants.length) return null

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from("chat_users")
    .select("id, external_id, phone")
    .eq("channel", channel)
    .in("phone", variants)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)

  return data?.[0] ?? null
}

async function mergeChatUsers(fromUserId: string, intoUserId: string, externalId: string, phone?: string) {
  if (fromUserId === intoUserId) {
    return
  }

  const supabase = getAdminClient()
  const [{ data: fromState, error: fromStateError }, { data: intoState, error: intoStateError }] = await Promise.all([
    supabase.from("chat_user_state").select("summary, bot_paused_until, last_openai_response_id").eq("user_id", fromUserId).maybeSingle(),
    supabase.from("chat_user_state").select("summary, bot_paused_until, last_openai_response_id").eq("user_id", intoUserId).maybeSingle(),
  ])

  if (fromStateError) throw new Error(fromStateError.message)
  if (intoStateError) throw new Error(intoStateError.message)

  const { error: messagesError } = await supabase.from("chat_messages").update({ user_id: intoUserId }).eq("user_id", fromUserId)
  if (messagesError) throw new Error(messagesError.message)

  if (fromState) {
    const mergedState = {
      user_id: intoUserId,
      summary: intoState?.summary ?? fromState.summary ?? null,
      bot_paused_until: intoState?.bot_paused_until ?? fromState.bot_paused_until ?? null,
      last_openai_response_id: intoState?.last_openai_response_id ?? fromState.last_openai_response_id ?? null,
    }

    const { error: upsertStateError } = await supabase.from("chat_user_state").upsert(mergedState, { onConflict: "user_id" })
    if (upsertStateError) throw new Error(upsertStateError.message)
  }

  const { error: deleteStateError } = await supabase.from("chat_user_state").delete().eq("user_id", fromUserId)
  if (deleteStateError) throw new Error(deleteStateError.message)

  const { error: deleteUserError } = await supabase.from("chat_users").delete().eq("id", fromUserId)
  if (deleteUserError) throw new Error(deleteUserError.message)

  const updates: { external_id?: string; phone?: string } = { external_id: externalId }
  const normalizedPhone = normalizeChatUserPhone(phone)
  if (normalizedPhone) {
    updates.phone = normalizedPhone
  }

  const { error: updateUserError } = await supabase.from("chat_users").update(updates).eq("id", intoUserId)
  if (updateUserError) throw new Error(updateUserError.message)
}

export async function getOrCreateUser(input: { channel: Channel; externalId: string; phone?: string }) {
  const supabase = getAdminClient()
  const normalizedPhone = normalizeChatUserPhone(input.phone)

  const [{ data: existing, error: lookupError }, phoneUser] = await Promise.all([
    supabase
      .from("chat_users")
      .select("id")
      .eq("channel", input.channel)
      .eq("external_id", input.externalId)
      .maybeSingle(),
    findUserByPhone(input.channel, normalizedPhone),
  ])

  if (lookupError) throw new Error(lookupError.message)

  if (existing?.id && phoneUser?.id && existing.id !== phoneUser.id) {
    await mergeChatUsers(existing.id, phoneUser.id, input.externalId, normalizedPhone)
    return { userId: phoneUser.id }
  }

  const targetUserId = phoneUser?.id ?? existing?.id
  if (targetUserId) {
    const updates: { phone?: string; external_id?: string } = {}
    if (normalizedPhone) {
      updates.phone = normalizedPhone
    }
    if (phoneUser && phoneUser.id === targetUserId && phoneUser.external_id !== input.externalId) {
      updates.external_id = input.externalId
    }

    if (Object.keys(updates).length) {
      await supabase
        .from("chat_users")
        .update(updates)
        .eq("id", targetUserId)
    }

    return { userId: targetUserId }
  }

  const { data, error } = await supabase
    .from("chat_users")
    .insert({
      channel: input.channel,
      external_id: input.externalId,
      phone: normalizedPhone || null,
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

export async function clearConversationState(userId: string) {
  const supabase = getAdminClient()

  const [{ error: messagesError }, { error: stateError }] = await Promise.all([
    supabase.from("chat_messages").delete().eq("user_id", userId),
    supabase
      .from("chat_user_state")
      .upsert(
        {
          user_id: userId,
          summary: null,
          bot_paused_until: null,
          last_openai_response_id: null,
        },
        { onConflict: "user_id" }
      ),
  ])

  if (messagesError) throw new Error(messagesError.message)
  if (stateError) throw new Error(stateError.message)
}
