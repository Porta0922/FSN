"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, cn } from "@/lib/utils"
import { FINE_PERCENTAGE } from "@/lib/constants"
import type { Match, AttendanceWithProfile, GoalWithProfiles, PaymentWithProfile, Expense, FineWithProfile } from "@/types"
import { ArrowLeft, DollarSign, Target, Users } from "lucide-react"
import { toast } from "sonner"

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<Match | null>(null)
  const [attendance, setAttendance] = useState<AttendanceWithProfile[]>([])
  const [goals, setGoals] = useState<GoalWithProfiles[]>([])
  const [payments, setPayments] = useState<PaymentWithProfile[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [fines, setFines] = useState<FineWithProfile[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [newGoalScorer, setNewGoalScorer] = useState("")
  const [newGoalAssist, setNewGoalAssist] = useState("")
  const [mvp, setMvp] = useState<{ id: string; name: string; votes: number; points: number }[]>([])
  const [score, setScore] = useState({ home: "", away: "" })
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: isAdminUser } = await supabase.rpc("is_admin", { user_id: user.id })
      setIsAdmin(!!isAdminUser)

      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .eq("id", id)
        .single()

      if (matchData) {
        setMatch(matchData)
        setScore({
          home: matchData.home_score != null ? String(matchData.home_score) : "",
          away: matchData.away_score != null ? String(matchData.away_score) : "",
        })
      }

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

      const { data: expData } = await supabase
        .from("expenses")
        .select("*")
        .eq("match_id", id)

      if (expData) setExpenses(expData)

      const { data: fineData } = await supabase
        .from("fines")
        .select("*, profiles(*)")
        .eq("match_id", id)

      if (fineData) setFines(fineData)

      const { data: votes } = await supabase
        .from("mvp_votes")
        .select("voted_id, profiles!voted_id(name)")
        .eq("match_id", id)

      const typedVotes = votes as unknown as { voted_id: string; profiles: { name: string } | null }[] | null

      if (typedVotes && typedVotes.length > 0) {
        const voteCount: Record<string, { name: string; count: number }> = {}
        typedVotes.forEach((v) => {
          const pid = v.voted_id
          if (!voteCount[pid]) voteCount[pid] = { name: v.profiles?.name || "?", count: 0 }
          voteCount[pid].count++
        })
        const { data: cfg } = await supabase
          .from("team_config")
          .select("mvp_points_first, mvp_points_second")
          .limit(1)
          .single()
        const firstPts = cfg?.mvp_points_first ?? 3
        const secondPts = cfg?.mvp_points_second ?? 1

        const top = Object.entries(voteCount)
          .map(([pid, info]) => ({ id: pid, name: info.name, votes: info.count }))
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 2)
        setMvp(top.map((t, i) => ({ ...t, points: i === 0 ? firstPts : secondPts })))
      }

      setLoading(false)
    }

    load()
  }, [id, reloadKey])

  async function handleStatusChange(newStatus: string) {
    const supabase = createClient()
    const { error } = await supabase.from("matches").update({ status: newStatus }).eq("id", id)
    if (error) {
      toast.error("Error al cambiar el estado")
      return
    }
    setMatch((prev) => prev ? { ...prev, status: newStatus as Match["status"] } : null)
    setReloadKey((k) => k + 1)
  }

  async function handleSaveScore() {
    const home = score.home === "" ? null : Math.max(0, parseInt(score.home))
    const away = score.away === "" ? null : Math.max(0, parseInt(score.away))
    const supabase = createClient()
    const { error } = await supabase.from("matches").update({ home_score: home, away_score: away }).eq("id", id)
    if (error) {
      toast.error("Error al guardar el resultado")
      return
    }
    setMatch((prev) => prev ? { ...prev, home_score: home, away_score: away } : null)
    toast.success("Resultado guardado")
  }

  async function handleAddGoal() {
    if (!newGoalScorer) return
    const supabase = createClient()
    const { error } = await supabase.from("goals").insert({
      match_id: id,
      scorer_id: newGoalScorer,
      assist_id: newGoalAssist || null,
    })
    if (error) {
      toast.error("Error al cargar el gol")
      return
    }
    setNewGoalScorer("")
    setNewGoalAssist("")
    const { data } = await supabase
      .from("goals")
      .select("*, scorer:profiles!scorer_id(*), assist:profiles!assist_id(*)")
      .eq("match_id", id)
    if (data) setGoals(data)
    toast.success("Gol cargado")
  }

  async function handleDeleteGoal(goalId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("goals").delete().eq("id", goalId)
    if (error) {
      toast.error("Error al borrar el gol")
      return
    }
    setGoals((prev) => prev.filter((g) => g.id !== goalId))
    toast.success("Gol eliminado")
  }

  async function handleMarkNoShow(att: AttendanceWithProfile) {
    const supabase = createClient()
    const { data: existing } = await supabase
      .from("fines")
      .select("id")
      .eq("match_id", id)
      .eq("profile_id", att.profile_id)
      .limit(1)

    if (existing && existing.length > 0) {
      toast.error("Ya tiene una multa registrada")
      return
    }

    const { error: attErr } = await supabase
      .from("attendance")
      .update({ status: "no_show" })
      .eq("id", att.id)

    if (attErr) {
      toast.error("Error al marcar no-show")
      return
    }

    const amount = Math.floor((match?.cost || 0) / (confirmedPlayers.length || 1)) * FINE_PERCENTAGE
    await supabase.from("fines").insert({
      match_id: id,
      profile_id: att.profile_id,
      amount,
      reason: "No show sin aviso",
      paid: false,
    })

    setReloadKey((k) => k + 1)
    toast.success(`${att.profiles.nickname || att.profiles.name} marcado como no-show`)
  }

  async function handleToggleFinePaid(fine: FineWithProfile) {
    const supabase = createClient()
    const { error } = await supabase.from("fines").update({ paid: !fine.paid }).eq("id", fine.id)
    if (error) {
      toast.error("Error al actualizar la multa")
      return
    }
    setReloadKey((k) => k + 1)
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
              {match.status === "played" && match.home_score != null && match.away_score != null && (
                <p className="text-lg font-bold text-gray-900 mt-1">
                  Resultado: {match.home_score} - {match.away_score}
                </p>
              )}
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

          {isAdmin && match.status === "played" && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">Resultado:</span>
              <input
                type="number"
                min={0}
                value={score.home}
                onChange={(e) => setScore({ ...score, home: e.target.value })}
                placeholder="Nuestros"
                className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                min={0}
                value={score.away}
                onChange={(e) => setScore({ ...score, away: e.target.value })}
                placeholder="Rival"
                className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={handleSaveScore}
                className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-light"
              >
                Guardar
              </button>
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
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusColor(a.status))}>
                      {getStatusLabel(a.status)}
                    </span>
                    {isAdmin && match.status === "played" && a.status === "confirmed" && (
                      <button
                        onClick={() => handleMarkNoShow(a)}
                        className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                        title="Marcar como no-show (crea multa)"
                      >
                        No-show
                      </button>
                    )}
                  </div>
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

              {mvp.length > 0 ? (
                <div className="space-y-2">
                  {mvp.map((m, i) => (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? "bg-yellow-50" : "bg-gray-50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{i === 0 ? "🥇" : "🥈"}</span>
                        <p className="font-bold text-gray-900">{m.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-700">
                          {m.votes} voto{m.votes !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-gray-400">+{m.points} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Sin votos todavía
                </p>
              )}
            </div>
          )}

          {/* Fines */}
          {isAdmin && fines.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-3">Multas</h2>
              <div className="space-y-2">
                {fines.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        {f.profiles.nickname || f.profiles.name}
                      </span>
                      <p className="text-xs text-gray-400">{f.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-red-600">{formatCurrency(f.amount)}</span>
                      <button
                        onClick={() => handleToggleFinePaid(f)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                          f.paid
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        )}
                      >
                        {f.paid ? "Pagada" : "Pendiente"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
