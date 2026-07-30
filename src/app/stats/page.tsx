"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types"
import { Trophy, Target } from "lucide-react"

interface PlayerStats {
  id: string
  name: string
  nickname: string | null
  goals: number
  assists: number
  matches: number
}

export default function StatsPage() {
  const [topScorers, setTopScorers] = useState<PlayerStats[]>([])
  const [topAssists, setTopAssists] = useState<PlayerStats[]>([])
  const [topAttendance, setTopAttendance] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, nickname")
        .eq("is_active", true)

      if (!profiles) { setLoading(false); return }

      const stats: PlayerStats[] = await Promise.all(
        profiles.map(async (p) => {
          const { count: goals } = await supabase
            .from("goals")
            .select("*", { count: "exact", head: true })
            .eq("scorer_id", p.id)

          const { count: assists } = await supabase
            .from("goals")
            .select("*", { count: "exact", head: true })
            .eq("assist_id", p.id)

          const { count: matches } = await supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("profile_id", p.id)
            .eq("status", "confirmed")

          return {
            id: p.id,
            name: p.name,
            nickname: p.nickname,
            goals: goals || 0,
            assists: assists || 0,
            matches: matches || 0,
          }
        })
      )

      setTopScorers([...stats].sort((a, b) => b.goals - a.goals).filter(s => s.goals > 0))
      setTopAssists([...stats].sort((a, b) => b.assists - a.assists).filter(s => s.assists > 0))
      setTopAttendance([...stats].sort((a, b) => b.matches - a.matches).filter(s => s.matches > 0))

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
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Estadísticas</h1>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Top Goleadores */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Target size={20} className="text-primary" />
              <h2 className="font-semibold text-gray-900">Goleadores</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {topScorers.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{p.nickname || p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{p.goals}</span>
                </div>
              ))}
              {topScorers.length === 0 && (
                <p className="p-4 text-sm text-gray-400 text-center">Sin goles cargados</p>
              )}
            </div>
          </div>

          {/* Top Asistencias */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Trophy size={20} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">Asistencias</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {topAssists.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{p.nickname || p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{p.assists}</span>
                </div>
              ))}
              {topAssists.length === 0 && (
                <p className="p-4 text-sm text-gray-400 text-center">Sin asistencias cargadas</p>
              )}
            </div>
          </div>

          {/* Top Presencias */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <span className="text-xl">📅</span>
              <h2 className="font-semibold text-gray-900">Presencias</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {topAttendance.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{p.nickname || p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-purple-600">{p.matches}</span>
                </div>
              ))}
              {topAttendance.length === 0 && (
                <p className="p-4 text-sm text-gray-400 text-center">Sin partidos jugados</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
