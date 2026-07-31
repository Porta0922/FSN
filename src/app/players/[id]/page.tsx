"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDateShort, getStatusColor, getStatusLabel } from "@/lib/utils"
import type { Profile, Attendance, Match } from "@/types"
import { POSITIONS } from "@/lib/constants"
import { ArrowLeft, Camera, Check } from "lucide-react"
import { toast } from "sonner"

interface AttendanceWithMatch extends Attendance {
  match: Match | null
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [player, setPlayer] = useState<Profile | null>(null)
  const [isMine, setIsMine] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: "", nickname: "", phone: "", position: "" })
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [stats, setStats] = useState({ goals: 0, assists: 0, matches: 0, confirmed: 0 })
  const [history, setHistory] = useState<AttendanceWithMatch[]>([])
  const [debtCount, setDebtCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.id === id) setIsMine(true)

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single()

      if (profile) {
        setPlayer(profile)
        setForm({
          name: profile.name || "",
          nickname: profile.nickname || "",
          phone: profile.phone || "",
          position: profile.position || "",
        })
      }

      const { count: goals } = await supabase
        .from("goals")
        .select("*", { count: "exact", head: true })
        .eq("scorer_id", id)

      const { count: assists } = await supabase
        .from("goals")
        .select("*", { count: "exact", head: true })
        .eq("assist_id", id)

      const { count: matches } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", id)

      const { count: confirmed } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", id)
        .eq("status", "confirmed")

      setStats({ goals: goals || 0, assists: assists || 0, matches: matches || 0, confirmed: confirmed || 0 })

      const { data: attHistory } = await supabase
        .from("attendance")
        .select("*, match:matches(*)")
        .eq("profile_id", id)

      if (attHistory) {
        const sorted = (attHistory as unknown as AttendanceWithMatch[])
          .filter((a) => a.match)
          .sort((a, b) => (b.match?.date || "").localeCompare(a.match?.date || ""))
        setHistory(sorted)

        const { data: approved } = await supabase
          .from("payments")
          .select("match_id")
          .eq("profile_id", id)
          .eq("status", "approved")

        const paidMatchIds = new Set((approved || []).map((p) => p.match_id))
        const debts = sorted.filter((a) => a.status === "confirmed" && a.match?.status === "played" && !paidMatchIds.has(a.match_id))
        setDebtCount(debts.length)
      }

      setLoading(false)
    }

    load()
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!player) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name,
        nickname: form.nickname || null,
        phone: form.phone || null,
        position: form.position || null,
      })
      .eq("id", id)

    if (error) {
      toast.error("Error al guardar el perfil")
      setSaving(false)
      return
    }

    setPlayer((prev) => prev ? { ...prev, name: form.name, nickname: form.nickname || null, phone: form.phone || null, position: form.position || null } : null)
    setEditing(false)
    setSaving(false)
    toast.success("Perfil actualizado")
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !player) return

    setUploadingAvatar(true)
    const supabase = createClient()
    const path = `${player.id}-${Date.now()}-${file.name}`
    const { data: uploadData, error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: false })

    if (error || !uploadData) {
      toast.error("Error al subir la foto de perfil")
      setUploadingAvatar(false)
      e.target.value = ""
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(uploadData.path)

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", id)

    if (updateError) {
      toast.error("Error al actualizar la foto")
      setUploadingAvatar(false)
      e.target.value = ""
      return
    }

    setPlayer((prev) => prev ? { ...prev, avatar_url: publicUrl } : null)
    setUploadingAvatar(false)
    e.target.value = ""
    toast.success("Foto de perfil actualizada")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Jugador no encontrado</p>
      </div>
    )
  }

  const playedHistory = history.filter((h) => h.match?.status === "played")
  const totalResponses = playedHistory.filter((h) => h.status !== "pending").length
  const confirmedCount = playedHistory.filter((h) => h.status === "confirmed").length
  const attendancePct = totalResponses > 0 ? Math.round((confirmedCount / totalResponses) * 100) : 0

  let streak = 0
  for (const h of playedHistory) {
    if (h.status === "confirmed") streak++
    else break
  }

  const recentHistory = history.slice(0, 10)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push("/players")}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                {player.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt="Foto de perfil"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white font-bold text-2xl">
                    {(player.nickname || player.name).charAt(0).toUpperCase()}
                  </div>
                )}
                {isMine && (
                  <label className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1.5 cursor-pointer shadow">
                    {uploadingAvatar ? (
                      <span className="block w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Camera size={14} />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{player.name}</h1>
                {player.nickname && <p className="text-gray-400">“{player.nickname}”</p>}
                {player.position && <p className="text-sm text-gray-500">Posición: {player.position}</p>}
                {player.phone && <p className="text-sm text-gray-500">📱 {player.phone}</p>}
              </div>
            </div>
            {isMine && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light"
              >
                Editar perfil
              </button>
            )}
          </div>

          {isMine && editing && (
            <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Apodo</label>
                <input
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Posición</label>
                <select
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Sin posición</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50"
                >
                  <Check size={16} />
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl font-bold text-primary">{stats.goals}</p>
            <p className="text-sm text-gray-500">Goles</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.assists}</p>
            <p className="text-sm text-gray-500">Asistencias</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl font-bold text-purple-600">{stats.confirmed}</p>
            <p className="text-sm text-gray-500">Partidos jugados</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl font-bold text-green-600">
              {stats.matches > 0 ? Math.round((stats.confirmed / stats.matches) * 100) : 0}%
            </p>
            <p className="text-sm text-gray-500">Asistencia</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl font-bold text-emerald-600">{attendancePct}%</p>
            <p className="text-sm text-gray-500">Cumplimiento</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl font-bold text-amber-600">{streak}</p>
            <p className="text-sm text-gray-500">Racha actual</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className={`text-3xl font-bold ${debtCount > 0 ? "text-red-600" : "text-green-600"}`}>{debtCount}</p>
            <p className="text-sm text-gray-500">Partidos en deuda</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mt-6">
          <h2 className="font-semibold text-gray-900 mb-4">Historial de asistencia</h2>
          {recentHistory.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay partidos registrados para este jugador.</p>
          ) : (
            <div className="space-y-2">
              {recentHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {entry.match ? formatDateShort(entry.match.date) : "-"}
                      <span className="text-gray-400 font-normal"> · {entry.match?.time}hs</span>
                    </p>
                    {entry.match?.home_score != null && entry.match?.away_score != null && (
                      <p className="text-xs text-gray-400">
                        Resultado: {entry.match.home_score} - {entry.match.away_score}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.match?.status === "played" && !["confirmed", "pending"].includes(entry.status) && (
                      <span className="text-xs text-red-500">No asistió</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${getStatusColor(entry.status)}`}>
                      {getStatusLabel(entry.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
