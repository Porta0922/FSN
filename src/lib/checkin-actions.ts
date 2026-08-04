"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkinWindow } from "@/lib/utils"

export type CheckinTokenResult = {
  token: string
  validFrom: string
  validUntil: string
} | null

export type CheckinResult =
  | { ok: true; already: boolean }
  | { ok: false; error: string }

interface Actor {
  id: string
  isAdmin: boolean
}

async function getActor(): Promise<Actor | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: isAdmin } = await admin.rpc("is_admin", { user_id: user.id })
  return { id: user.id, isAdmin: !!isAdmin }
}

async function canManage(actor: Actor, matchId: string): Promise<boolean> {
  if (actor.isAdmin) return true
  const admin = createAdminClient()
  const { data: match } = await admin
    .from("matches")
    .select("created_by")
    .eq("id", matchId)
    .single()
  return match?.created_by === actor.id
}

export async function getCheckinToken(matchId: string): Promise<CheckinTokenResult> {
  const actor = await getActor()
  if (!actor) throw new Error("No autenticado")
  if (!(await canManage(actor, matchId))) throw new Error("Sin permisos")

  const admin = createAdminClient()
  const { data } = await admin
    .from("match_checkin_tokens")
    .select("token, valid_from, valid_until")
    .eq("match_id", matchId)
    .single()

  if (!data) return null
  return { token: data.token, validFrom: data.valid_from, validUntil: data.valid_until }
}

export async function generateCheckinToken(matchId: string): Promise<CheckinTokenResult> {
  const actor = await getActor()
  if (!actor) throw new Error("No autenticado")
  if (!(await canManage(actor, matchId))) throw new Error("Sin permisos")

  const admin = createAdminClient()
  const { data: match } = await admin
    .from("matches")
    .select("id, date, time, duration_minutes, status")
    .eq("id", matchId)
    .single()

  if (!match) throw new Error("Partido no encontrado")
  if (match.status !== "scheduled") throw new Error("El partido no está programado")

  const { validFrom, validUntil } = checkinWindow(match.date, match.time, match.duration_minutes)
  const token = crypto.randomUUID()

  const { data, error } = await admin
    .from("match_checkin_tokens")
    .upsert(
      { match_id: matchId, token, valid_from: validFrom, valid_until: validUntil, created_by: actor.id },
      { onConflict: "match_id" }
    )
    .select("token, valid_from, valid_until")
    .single()

  if (error || !data) throw new Error("No se pudo generar el QR")
  return { token: data.token, validFrom: data.valid_from, validUntil: data.valid_until }
}

export async function confirmCheckin(token: string): Promise<CheckinResult> {
  const actor = await getActor()
  if (!actor) return { ok: false, error: "Necesitás iniciar sesión" }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from("match_checkin_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle()

  if (!row) return { ok: false, error: "El código QR no es válido" }

  const { data: match } = await admin
    .from("matches")
    .select("id, date, time, duration_minutes, status")
    .eq("id", row.match_id)
    .single()

  if (!match) return { ok: false, error: "El partido no existe" }
  if (match.status !== "scheduled") return { ok: false, error: "El partido ya no está programado" }

  const now = new Date()
  if (row.valid_from && now < new Date(row.valid_from)) {
    return { ok: false, error: "El QR aún no es válido. Se habilita un rato antes del partido." }
  }
  if (row.valid_until && now > new Date(row.valid_until)) {
    return { ok: false, error: "El QR expiró" }
  }

  const { data: existing } = await admin
    .from("attendance")
    .select("status")
    .eq("match_id", match.id)
    .eq("profile_id", actor.id)
    .maybeSingle()

  const { error } = await admin.from("attendance").upsert(
    { match_id: match.id, profile_id: actor.id, status: "confirmed" },
    { onConflict: "match_id,profile_id" }
  )

  if (error) return { ok: false, error: "No se pudo registrar la asistencia" }
  return { ok: true, already: existing?.status === "confirmed" }
}
