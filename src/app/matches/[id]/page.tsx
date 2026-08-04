"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, cn } from "@/lib/utils"
import { FINE_PERCENTAGE } from "@/lib/constants"
import type { Match, AttendanceWithProfile, GoalWithProfiles, PaymentWithProfile, Expense, FineWithProfile } from "@/types"
import { ArrowLeft, DollarSign, QrCode, Target, Users, Trophy } from "lucide-react"
import { toast } from "sonner"
import { getCheckinToken, generateCheckinToken } from "@/lib/checkin-actions"

interface EncuentroEditor {
  id: string | null
  index: number
  homeGoals: number
  awayGoals: number
  homeTeam: string[]
  awayTeam: string[]
  goals: Record<string, number>
  saved: boolean
}

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
  const [encuentros, setEncuentros] = useState<EncuentroEditor[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [qr, setQr] = useState<{ url: string; validFrom: string; validUntil: string; img: string } | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  function applyQr(res: { token: string; validFrom: string; validUntil: string }) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const url = `${siteUrl}/checkin?t=${res.token}`
    setQr({
      url,
      validFrom: res.validFrom,
      validUntil: res.validUntil,
      img: `/api/qr?data=${encodeURIComponent(url)}&size=300`,
    })
  }

  async function handleGenerateQr() {
    setQrLoading(true)
    try {
      const res = await generateCheckinToken(id)
      if (res) applyQr(res)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el QR")
    } finally {
      setQrLoading(false)
    }
  }

  async function handleCopyQr() {
    if (!qr) return
    try {
      await navigator.clipboard.writeText(qr.url)
      toast.success("URL copiada")
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  function formatWindow(iso: string) {
    return new Date(iso).toLocaleString("es-PY", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

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
        if (isAdminUser || matchData.created_by === user.id) {
          const res = await getCheckinToken(id).catch(() => null)
          if (res) applyQr(res)
        }
      }

      const { data: attData } = await supabase
        .from("attendance")
        .select("*, profiles(*)")
        .eq("match_id", id)

      if (attData) setAttendance(attData)

      const { data: encData } = await supabase
        .from("match_encuentros")
        .select("*, players:match_encuentro_players(*, profile:profiles(name, nickname))")
        .eq("match_id", id)
        .order("index", { ascending: true })

      if (encData && encData.length > 0) {
        setEncuentros(
          (encData as unknown as { index: number; id: string; team_home_goals: number; team_away_goals: number; players: { profile_id: string; team: "home" | "away"; goals: number }[] }[]).map((e) => ({
            id: e.id,
            index: e.index,
            homeGoals: e.team_home_goals,
            awayGoals: e.team_away_goals,
            homeTeam: e.players.filter((p) => p.team === "home").map((p) => p.profile_id),
            awayTeam: e.players.filter((p) => p.team === "away").map((p) => p.profile_id),
            goals: e.players.reduce((acc, p) => ({ ...acc, [p.profile_id]: p.goals }), {}),
            saved: true,
          }))
        )
      }

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

  async function recomputeScore() {
    const supabase = createClient()
    const { data: encs } = await supabase
      .from("match_encuentros")
      .select("team_home_goals, team_away_goals")
      .eq("match_id", id)

    if (!encs) return
    const home = encs.filter((e) => e.team_home_goals > e.team_away_goals).length
    const away = encs.filter((e) => e.team_away_goals > e.team_home_goals).length

    const { error } = await supabase.from("matches").update({ home_score: home, away_score: away }).eq("id", id)
    if (error) return
    setMatch((prev) => prev ? { ...prev, home_score: home, away_score: away } : null)
    setScore({ home: home ? String(home) : "", away: away ? String(away) : "" })
  }

  function handleAddEncuentro() {
    const nextIndex = encuentros.length > 0 ? Math.max(...encuentros.map((e) => e.index)) + 1 : 1
    const pool = confirmedPlayers.map((a) => a.profile_id)
    setEncuentros((prev) => [
      ...prev,
      {
        id: null,
        index: nextIndex,
        homeGoals: 0,
        awayGoals: 0,
        homeTeam: pool.slice(0, 7),
        awayTeam: pool.slice(7, 14),
        goals: {},
        saved: false,
      },
    ])
  }

  function toggleEncuentroPlayer(ed: EncuentroEditor, pid: string) {
    setEncuentros((prev) =>
      prev.map((e) => {
        if (e.index !== ed.index) return e
        if (e.homeTeam.includes(pid)) {
          if (e.awayTeam.length >= 7) return e
          return { ...e, homeTeam: e.homeTeam.filter((p) => p !== pid), awayTeam: [...e.awayTeam, pid] }
        }
        if (e.awayTeam.includes(pid)) {
          return { ...e, awayTeam: e.awayTeam.filter((p) => p !== pid) }
        }
        if (e.homeTeam.length < 7) return { ...e, homeTeam: [...e.homeTeam, pid] }
        if (e.awayTeam.length < 7) return { ...e, awayTeam: [...e.awayTeam, pid] }
        return e
      })
    )
  }

  function setEncuentroGoals(ed: EncuentroEditor, pid: string, value: string) {
    const goals = Math.max(0, parseInt(value) || 0)
    setEncuentros((prev) =>
      prev.map((e) => (e.index === ed.index ? { ...e, goals: { ...e.goals, [pid]: goals } } : e))
    )
  }

  async function handleSaveEncuentro(ed: EncuentroEditor) {
    const supabase = createClient()
    let encuentroId = ed.id

    if (!encuentroId) {
      const { data, error } = await supabase
        .from("match_encuentros")
        .insert({ match_id: id, index: ed.index, team_home_goals: ed.homeGoals, team_away_goals: ed.awayGoals })
        .select("id")
        .single()
      if (error || !data) {
        toast.error("Error al crear el encuentro")
        return
      }
      encuentroId = data.id
    } else {
      const { error } = await supabase
        .from("match_encuentros")
        .update({ team_home_goals: ed.homeGoals, team_away_goals: ed.awayGoals })
        .eq("id", encuentroId)
      if (error) {
        toast.error("Error al guardar el encuentro")
        return
      }
    }

    const playerRows = [
      ...ed.homeTeam.map((pid) => ({ encuentro_id: encuentroId, profile_id: pid, team: "home" as const, goals: ed.goals[pid] || 0 })),
      ...ed.awayTeam.map((pid) => ({ encuentro_id: encuentroId, profile_id: pid, team: "away" as const, goals: ed.goals[pid] || 0 })),
    ]

    await supabase.from("match_encuentro_players").delete().eq("encuentro_id", encuentroId)

    if (playerRows.length > 0) {
      const { error } = await supabase.from("match_encuentro_players").insert(playerRows)
      if (error) {
        toast.error("Error al guardar los equipos")
        return
      }
    }

    setEncuentros((prev) => prev.map((e) => (e.index === ed.index ? { ...e, id: encuentroId, saved: true } : e)))
    await recomputeScore()
    toast.success("Encuentro guardado")
  }

  async function handleDeleteEncuentro(ed: EncuentroEditor) {
    if (!ed.id) {
      setEncuentros((prev) => prev.filter((e) => e.index !== ed.index))
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from("match_encuentros").delete().eq("id", ed.id)
    if (error) {
      toast.error("Error al borrar el encuentro")
      return
    }
    setEncuentros((prev) => prev.filter((e) => e.index !== ed.index))
    await recomputeScore()
    toast.success("Encuentro eliminado")
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
  const canManageQr = isAdmin || (match != null && currentUserId != null && match.created_by === currentUserId)

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
                  {encuentros.length > 0 && (
                    <span className="text-sm font-normal text-gray-400"> por encuentros ganados</span>
                  )}
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
              {match.status === "cancelled" && (
                <button
                  onClick={() => handleStatusChange("scheduled")}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Rehabilitar partido
                </button>
              )}
            </div>
          )}

          {isAdmin && match.status === "played" && encuentros.length === 0 && (
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

        {canManageQr && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode size={20} className="text-primary" />
                <h2 className="font-semibold text-gray-900">QR de check-in</h2>
              </div>
              <button
                onClick={handleGenerateQr}
                disabled={qrLoading}
                className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50"
              >
                {qr ? "Rotar QR" : "Generar QR"}
              </button>
            </div>

            {qrLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : qr ? (
              <div className="flex flex-col items-center gap-3">
                <img src={qr.img} alt="QR de check-in" className="w-48 h-48" />
                <p className="text-xs text-gray-400 break-all text-center max-w-xs">{qr.url}</p>
                <p className="text-xs text-gray-400">
                  Válido desde {formatWindow(qr.validFrom)} hasta {formatWindow(qr.validUntil)}
                </p>
                <button
                  onClick={handleCopyQr}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  Copiar URL (para programar un tag NFC)
                </button>
                <p className="text-xs text-gray-400">
                  Escaneá el QR en la cancha con el teléfono para confirmar asistencia. La rotación invalida el QR anterior.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                Generá un QR para que los jugadores confirmen asistencia en la cancha.
              </p>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-primary" />
              <h2 className="font-semibold text-gray-900">Encuentros</h2>
              <span className="text-sm text-gray-400">(7v7 · 10 min)</span>
            </div>
            {isAdmin && (
              <button
                onClick={handleAddEncuentro}
                className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-light"
              >
                + Agregar encuentro
              </button>
            )}
          </div>

          {encuentros.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Todavía no se cargaron encuentros
              {isAdmin ? ". Agregá los mini partidos que se jugaron." : "."}
            </p>
          )}

          <div className="space-y-4">
            {encuentros.map((ed) => {
              const winner = ed.homeGoals > ed.awayGoals ? "home" : ed.awayGoals > ed.homeGoals ? "away" : "draw"
              return (
                <div key={ed.index} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">Encuentro #{ed.index}</p>
                      <span className="text-xs text-gray-400">10 min</span>
                      {winner === "home" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Ganamos</span>
                      )}
                      {winner === "away" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Perdimos</span>
                      )}
                      {winner === "draw" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Empate</span>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteEncuentro(ed)}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-medium text-gray-600">Nuestros</span>
                    {isAdmin ? (
                      <input
                        type="number"
                        min={0}
                        value={ed.homeGoals}
                        onChange={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0)
                          setEncuentros((prev) => prev.map((x) => (x.index === ed.index ? { ...x, homeGoals: v } : x)))
                        }}
                        className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center"
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-900 w-10 text-center">{ed.homeGoals}</span>
                    )}
                    <span className="text-gray-400">-</span>
                    {isAdmin ? (
                      <input
                        type="number"
                        min={0}
                        value={ed.awayGoals}
                        onChange={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0)
                          setEncuentros((prev) => prev.map((x) => (x.index === ed.index ? { ...x, awayGoals: v } : x)))
                        }}
                        className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center"
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-900 w-10 text-center">{ed.awayGoals}</span>
                    )}
                    <span className="text-sm font-medium text-gray-600">Rival</span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-blue-600 uppercase mb-2">
                        Equipo A (nosotros) · {ed.homeTeam.length}/7
                      </p>
                      <div className="space-y-1.5">
                        {ed.homeTeam.map((pid) => {
                          const a = attendance.find((x) => x.profile_id === pid)
                          return (
                            <div key={pid} className="flex items-center justify-between bg-blue-50 rounded-lg px-2 py-1">
                              <span className="text-sm text-gray-700">
                                {a?.profiles.nickname || a?.profiles.name || "?"}
                              </span>
                              {isAdmin ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">⚽</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={ed.goals[pid] ?? 0}
                                    onChange={(e) => setEncuentroGoals(ed, pid, e.target.value)}
                                    className="w-12 px-1 py-0.5 border border-gray-200 rounded text-sm text-center"
                                  />
                                </div>
                              ) : (
                                <span className="text-sm font-semibold text-gray-700">⚽ {ed.goals[pid] ?? 0}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-red-600 uppercase mb-2">
                        Equipo B (rival) · {ed.awayTeam.length}/7
                      </p>
                      <div className="space-y-1.5">
                        {ed.awayTeam.map((pid) => {
                          const a = attendance.find((x) => x.profile_id === pid)
                          return (
                            <div key={pid} className="flex items-center justify-between bg-red-50 rounded-lg px-2 py-1">
                              <span className="text-sm text-gray-700">
                                {a?.profiles.nickname || a?.profiles.name || "?"}
                              </span>
                              {isAdmin ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">⚽</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={ed.goals[pid] ?? 0}
                                    onChange={(e) => setEncuentroGoals(ed, pid, e.target.value)}
                                    className="w-12 px-1 py-0.5 border border-gray-200 rounded text-sm text-center"
                                  />
                                </div>
                              ) : (
                                <span className="text-sm font-semibold text-gray-700">⚽ {ed.goals[pid] ?? 0}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-2">
                        Tocá un jugador para cambiar de equipo (Equipo A → Equipo B → afuera). Máximo 7 por equipo.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {confirmedPlayers.map((a) => {
                          const pid = a.profile_id
                          const inHome = ed.homeTeam.includes(pid)
                          const inAway = ed.awayTeam.includes(pid)
                          const teamFull = inHome || inAway ? false : ed.homeTeam.length >= 7 && ed.awayTeam.length >= 7
                          return (
                            <button
                              key={pid}
                              type="button"
                              onClick={() => toggleEncuentroPlayer(ed, pid)}
                              disabled={teamFull}
                              className={cn(
                                "px-2 py-1 rounded-lg text-xs font-medium border transition-colors",
                                inHome && "bg-blue-100 text-blue-700 border-blue-200",
                                inAway && "bg-red-100 text-red-700 border-red-200",
                                !inHome && !inAway && "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100",
                                teamFull && "opacity-40 cursor-not-allowed"
                              )}
                            >
                              {a.profiles.nickname || a.profiles.name}
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() => handleSaveEncuentro(ed)}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-sm font-medium",
                            ed.saved ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-primary text-white hover:bg-primary-light"
                          )}
                        >
                          {ed.saved ? "Actualizar encuentro" : "Guardar encuentro"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
