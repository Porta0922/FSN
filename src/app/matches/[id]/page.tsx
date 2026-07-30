"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, cn } from "@/lib/utils"
import type { Match, AttendanceWithProfile, GoalWithProfiles, PaymentWithProfile, Photo, Expense } from "@/types"
import { ArrowLeft, DollarSign, Image, Target, Users } from "lucide-react"

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<Match | null>(null)
  const [attendance, setAttendance] = useState<AttendanceWithProfile[]>([])
  const [goals, setGoals] = useState<GoalWithProfiles[]>([])
  const [payments, setPayments] = useState<PaymentWithProfile[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [newGoalScorer, setNewGoalScorer] = useState("")
  const [newGoalAssist, setNewGoalAssist] = useState("")
  const [mvp, setMvp] = useState<{ id: string; name: string; votes: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: roleData } = await supabase
        .from("profile_roles")
        .select("roles(name)")
        .eq("profile_id", user.id)

      if (roleData) {
        setIsAdmin(roleData.some((pr: any) => pr.roles?.name === "admin" || pr.roles?.name === "super_admin"))
      }

      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .eq("id", id)
        .single()

      if (matchData) setMatch(matchData)

      const { data: attData } = await supabase
        .from("attendance")
        .select("*, profiles(*)")
        .eq("match_id", id)

      if (attData) setAttendance(attData)

      const { data: goalsData } = await supabase
        .from("goals")
        .select("*, scorer:profiles!scorer_id(*), assist:profiles!assist_id(*)")
        .eq("match_id", id)

      if (goalsData) setGoals(goalsData)

      const { data: payData } = await supabase
        .from("payments")
        .select("*, profiles(*)")
        .eq("match_id", id)

      if (payData) setPayments(payData)

      const { data: photoData } = await supabase
        .from("photos")
        .select("*")
        .eq("match_id", id)

      if (photoData) setPhotos(photoData)

      const { data: expData } = await supabase
        .from("expenses")
        .select("*")
        .eq("match_id", id)

      if (expData) setExpenses(expData)

      // Get MVP (most voted)
      const { data: votes } = await supabase
        .from("mvp_votes")
        .select("voted_id, profiles!voted_id(name)")
        .eq("match_id", id)

      if (votes && votes.length > 0) {
        const voteCount: Record<string, { name: string; count: number }> = {}
        votes.forEach((v: any) => {
          const pid = v.voted_id
          if (!voteCount[pid]) voteCount[pid] = { name: v.profiles?.name || "?", count: 0 }
          voteCount[pid].count++
        })
        const top = Object.entries(voteCount)
          .map(([id, info]) => ({ id, name: info.name, votes: info.count }))
          .sort((a, b) => b.votes - a.votes)[0]
        if (top) setMvp(top)
      }

      setLoading(false)
    }

    load()
  }, [id])

  async function handleStatusChange(newStatus: string) {
    const supabase = createClient()
    await supabase.from("matches").update({ status: newStatus }).eq("id", id)
    setMatch((prev) => prev ? { ...prev, status: newStatus as any } : null)
  }

  async function handleAddGoal() {
    if (!newGoalScorer) return
    const supabase = createClient()
    await supabase.from("goals").insert({
      match_id: id,
      scorer_id: newGoalScorer,
      assist_id: newGoalAssist || null,
    })
    setNewGoalScorer("")
    setNewGoalAssist("")
    // Reload goals
    const { data } = await supabase
      .from("goals")
      .select("*, scorer:profiles!scorer_id(*), assist:profiles!assist_id(*)")
      .eq("match_id", id)
    if (data) setGoals(data)
  }

  async function handleDeleteGoal(goalId: string) {
    const supabase = createClient()
    await supabase.from("goals").delete().eq("id", goalId)
    setGoals((prev) => prev.filter((g) => g.id !== goalId))
  }

  const confirmedPlayers = attendance.filter((a) => a.status === "confirmed")
  const shareAmount = match ? Math.floor(match.cost / (confirmedPlayers.length || 1)) : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Partido no encontrado</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push("/matches")}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{formatDate(match.date)}</h1>
              <p className="text-gray-500">{match.time}hs | {formatCurrency(match.cost)}</p>
              {match.location && <p className="text-gray-500 text-sm">📍 {match.location}</p>}
            </div>
            <span className={cn("px-3 py-1 rounded-full text-sm font-medium", getStatusColor(match.status))}>
              {getStatusLabel(match.status)}
            </span>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              {match.status === "scheduled" && (
                <button
                  onClick={() => handleStatusChange("played")}
                  className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Marcar como jugado
                </button>
              )}
              {match.status === "scheduled" && (
                <button
                  onClick={() => handleStatusChange("cancelled")}
                  className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Cancelar partido
                </button>
              )}
              {match.status === "played" && (
                <button
                  onClick={() => handleStatusChange("scheduled")}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Reabrir
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Attendance */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Users size={20} className="text-primary" />
              <h2 className="font-semibold text-gray-900">Asistencias</h2>
              <span className="text-sm text-gray-400">({attendance.length})</span>
            </div>

            <div className="space-y-2">
              {attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {a.profiles.nickname || a.profiles.name}
                    </span>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusColor(a.status))}>
                    {getStatusLabel(a.status)}
                  </span>
                </div>
              ))}

              {attendance.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Nadie se anotó todavía
                </p>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Confirmados: <strong>{confirmedPlayers.length}</strong>
              </p>
              <p className="text-sm text-gray-500">
                Cuota por persona: <strong>{formatCurrency(shareAmount)}</strong>
              </p>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Target size={20} className="text-primary" />
              <h2 className="font-semibold text-gray-900">Goles</h2>
              <span className="text-sm text-gray-400">({goals.length})</span>
            </div>

            <div className="space-y-2 mb-4">
              {goals.map((g) => (
                <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div>
                    <span className="text-sm font-medium text-gray-700">⚽ {g.scorer.name}</span>
                    {g.assist && (
                      <span className="text-xs text-gray-400 ml-1">(asist. {g.assist.name})</span>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {goals.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin goles cargados</p>
              )}
            </div>

            {(isAdmin || match.status === "played") && (
              <div className="space-y-2">
                <select
                  value={newGoalScorer}
                  onChange={(e) => setNewGoalScorer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">¿Quién metió el gol?</option>
                  {confirmedPlayers.map((a) => (
                    <option key={a.profile_id} value={a.profile_id}>
                      {a.profiles.nickname || a.profiles.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newGoalAssist}
                  onChange={(e) => setNewGoalAssist(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">¿Asistencia? (opcional)</option>
                  {confirmedPlayers.map((a) => (
                    <option key={a.profile_id} value={a.profile_id}>
                      {a.profiles.nickname || a.profiles.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddGoal}
                  disabled={!newGoalScorer}
                  className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50"
                >
                  + Agregar gol
                </button>
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={20} className="text-primary" />
              <h2 className="font-semibold text-gray-900">Pagos</h2>
            </div>

            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">
                    {p.profiles.nickname || p.profiles.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{formatCurrency(p.amount)}</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusColor(p.status))}>
                      {getStatusLabel(p.status)}
                    </span>
                  </div>
                </div>
              ))}

              {payments.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Sin pagos registrados
                </p>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Recaudado: <strong>{formatCurrency(payments.filter(p => p.status === "approved").reduce((s, p) => s + p.amount, 0))}</strong>
                {" | "}
                Pendiente: <strong>{formatCurrency(payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0))}</strong>
              </p>
            </div>
          </div>

          {/* MVP */}
          {match.status === "played" && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🏆</span>
                <h2 className="font-semibold text-gray-900">MVP</h2>
              </div>

              {mvp ? (
                <div className="text-center p-4 bg-yellow-50 rounded-xl">
                  <p className="text-3xl mb-1">🏆</p>
                  <p className="text-lg font-bold text-gray-900">{mvp.name}</p>
                  <p className="text-sm text-gray-500">{mvp.votes} voto{mvp.votes !== 1 ? "s" : ""}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Sin votos todavía
                </p>
              )}
            </div>
          )}

          {/* Expenses */}
          {expenses.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-3">Gastos extras</h2>
              <div className="space-y-2">
                {expenses.map((e) => (
                  <div key={e.id} className="flex justify-between p-2 rounded-lg bg-gray-50">
                    <span className="text-sm text-gray-700">{e.description}</span>
                    <span className="text-sm font-medium">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
