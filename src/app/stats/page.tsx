"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { Trophy, Target, Download } from "lucide-react"
import { toast } from "sonner"

interface PlayerStats {
  profile_id: string
  name: string
  nickname: string | null
  goals: number
  assists: number
  matches: number
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export default function StatsPage() {
  const now = new Date()
  const [monthValue, setMonthValue] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  )
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)

  const [year, month] = monthValue.split("-").map((n) => parseInt(n))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase.rpc("player_stats_for_month", {
        target_year: year,
        target_month: month,
      })

      if (error) {
        toast.error("Error al cargar las estadísticas")
        setStats([])
        setLoading(false)
        return
      }

      setStats((data || []) as PlayerStats[])
      setLoading(false)
    }

    load()
  }, [year, month])

  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).filter((s) => s.goals > 0)
  const topAssists = [...stats].sort((a, b) => b.assists - a.assists).filter((s) => s.assists > 0)
  const topAttendance = [...stats].sort((a, b) => b.matches - a.matches).filter((s) => s.matches > 0)

  function handleExport() {
    const rows = [
      ["Jugador", "Goles", "Asistencias", "Partidos"],
      ...stats.map((s) => [s.nickname || s.name, s.goals, s.assists, s.matches]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `estadisticas-${year}-${String(month).padStart(2, "0")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exportado")
  }

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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Estadísticas de {MONTH_NAMES[month - 1]}
          </h1>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value || monthValue)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={handleExport}
              disabled={stats.length === 0}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50"
            >
              <Download size={16} />
              Exportar
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Top Goleadores */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Target size={20} className="text-primary" />
              <h2 className="font-semibold text-gray-900">Goleadores</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {topScorers.map((p, i) => (
                <div key={p.profile_id} className="flex items-center justify-between p-3">
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
                <div key={p.profile_id} className="flex items-center justify-between p-3">
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
                <div key={p.profile_id} className="flex items-center justify-between p-3">
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
