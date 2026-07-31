"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils"
import { CalendarDays, Users, Trophy, ArrowRight, CircleDot } from "lucide-react"
import type { Match, Profile } from "@/types"

interface MvpStanding {
  profile_id: string
  name: string
  nickname: string | null
  points: number
  mvp_wins: number
  second_places: number
}

export default function DashboardPage() {
  const [user, setUser] = useState<Profile | null>(null)
  const [nextMatch, setNextMatch] = useState<Match | null>(null)
  const [myAttendance, setMyAttendance] = useState<string | null>(null)
  const [stats, setStats] = useState({ totalMatches: 0, totalGoals: 0, attendance: 0 })
  const [mvpStandings, setMvpStandings] = useState<MvpStanding[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single()

      setUser(profile)

      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .gte("date", todayStr)
        .eq("status", "scheduled")
        .order("date", { ascending: true })
        .limit(1)

      if (matches && matches.length > 0) {
        setNextMatch(matches[0])
        const { data: att } = await supabase
          .from("attendance")
          .select("status")
          .eq("match_id", matches[0].id)
          .eq("profile_id", authUser.id)
          .single()

        if (att) setMyAttendance(att.status)
      }

      const { count: matchCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("status", "played")

      const { count: goalCount } = await supabase
        .from("goals")
        .select("*", { count: "exact", head: true })

      const { count: myMatches } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", authUser.id)

      const { count: myConfirmed } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", authUser.id)
        .eq("status", "confirmed")

      setStats({
        totalMatches: matchCount || 0,
        totalGoals: goalCount || 0,
        attendance: myConfirmed && myConfirmed > 0 ? Math.round((myConfirmed / (myMatches || 1)) * 100) : 0,
      })

      const { data: standings } = await supabase.rpc("mvp_standings_for_year", {
        target_year: today.getFullYear(),
      })
      setMvpStandings((standings || []) as MvpStanding[])

      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido, {user?.nickname || user?.name || "Jugador"}
          </h1>
          <p className="text-gray-500 text-sm">Fútbol Sin Nivel ⚽</p>
        </div>

        {nextMatch && (
          <Link
            href={`/matches/${nextMatch.id}`}
            className="block bg-gradient-to-r from-primary to-primary-dark rounded-xl p-5 text-white mb-6 hover:opacity-95 transition-opacity"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm font-medium">PRÓXIMO PARTIDO</span>
              <ArrowRight size={20} className="text-white/70" />
            </div>
            <p className="text-xl font-bold">{formatDate(nextMatch.date)}</p>
            <p className="text-white/80">{nextMatch.time}hs | {formatCurrency(nextMatch.cost)}</p>
            {myAttendance && (
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(myAttendance)}`}>
                {getStatusLabel(myAttendance)}
              </span>
            )}
          </Link>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <CalendarDays size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMatches}</p>
                <p className="text-xs text-gray-500">Partidos jugados</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CircleDot size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalGoals}</p>
                <p className="text-xs text-gray-500">Goles totales</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.attendance}%</p>
                <p className="text-xs text-gray-500">Asistencia</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Trophy size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {mvpStandings[0]?.nickname || mvpStandings[0]?.name || "-"}
                </p>
                <p className="text-xs text-gray-500">
                  Líder MVP {mvpStandings[0] ? `(${mvpStandings[0].points} pts)` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Acciones rápidas</h2>
            <div className="space-y-2">
              <Link href="/matches" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">📋 Anotarme al próximo partido</p>
                <p className="text-sm text-gray-500">Confirmá o decliná tu asistencia</p>
              </Link>
              <Link href="/payments" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">💰 Pagar cuota</p>
                <p className="text-sm text-gray-500">Subí tu comprobante de pago</p>
              </Link>
              <Link href="/stats" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">📊 Estadísticas del mes</p>
                <p className="text-sm text-gray-500">Goles, asistencias y más</p>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">🏆 Tabla general MVP</h2>
            <div className="space-y-2">
              {mvpStandings.slice(0, 10).map((s, i) => (
                <div key={s.profile_id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{s.nickname || s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      🏆 {s.mvp_wins} {s.mvp_wins === 1 ? "vez" : "veces"}
                    </span>
                    <span className="text-sm font-bold text-yellow-600">{s.points} pts</span>
                  </div>
                </div>
              ))}
              {mvpStandings.length === 0 && (
                <p className="text-sm text-gray-400">Aún no hay votos cargados.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
