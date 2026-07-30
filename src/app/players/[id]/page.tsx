"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import type { Profile } from "@/types"
import { ArrowLeft } from "lucide-react"

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [player, setPlayer] = useState<Profile | null>(null)
  const [stats, setStats] = useState({ goals: 0, assists: 0, matches: 0, confirmed: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single()

      if (profile) setPlayer(profile)

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

      setLoading(false)
    }

    load()
  }, [id])

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
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {(player.nickname || player.name).charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{player.name}</h1>
              {player.nickname && <p className="text-gray-400">"{player.nickname}"</p>}
              {player.position && <p className="text-sm text-gray-500">Posición: {player.position}</p>}
              {player.phone && <p className="text-sm text-gray-500">📱 {player.phone}</p>}
            </div>
          </div>
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
      </main>
    </div>
  )
}
