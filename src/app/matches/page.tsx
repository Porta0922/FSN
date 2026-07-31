"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, cn } from "@/lib/utils"
import type { Match } from "@/types"
import { Plus } from "lucide-react"
import { toast } from "sonner"

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [userAttendance, setUserAttendance] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: isAdminUser } = await supabase.rpc("is_admin", { user_id: user.id })
      setIsAdmin(!!isAdminUser)

      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .order("date", { ascending: false })

      if (matchesData) setMatches(matchesData)

      const { data: attData } = await supabase
        .from("attendance")
        .select("match_id, status")
        .eq("profile_id", user.id)

      if (attData) {
        const map: Record<string, string> = {}
        attData.forEach((a) => { map[a.match_id] = a.status })
        setUserAttendance(map)
      }

      setLoading(false)
    }

    load()
  }, [])

  const filtered = matches.filter((m) => {
    if (filter === "upcoming") return m.status === "scheduled"
    if (filter === "past") return m.status === "played" || m.status === "cancelled"
    return true
  })

  async function handleAttendance(matchId: string, status: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existing = userAttendance[matchId]

    let error = null

    if (existing) {
      const res = await supabase
        .from("attendance")
        .update({ status })
        .eq("match_id", matchId)
        .eq("profile_id", user.id)
      error = res.error
    } else {
      const res = await supabase
        .from("attendance")
        .insert({ match_id: matchId, profile_id: user.id, status })
      error = res.error
    }

    if (error) {
      toast.error("No se pudo actualizar la asistencia")
      return
    }

    setUserAttendance((prev) => ({ ...prev, [matchId]: status }))
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Partidos</h1>
          {isAdmin && (
            <Link
              href="/matches/new"
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-light transition-colors"
            >
              <Plus size={20} />
              Nuevo
            </Link>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          {["all", "upcoming", "past"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                filter === f
                  ? "bg-primary text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {f === "all" ? "Todos" : f === "upcoming" ? "Próximos" : "Pasados"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((match) => (
            <div
              key={match.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <Link href={`/matches/${match.id}`} className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">⚽</span>
                    <span className="font-semibold text-gray-900">
                      {formatDate(match.date)}
                    </span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusColor(match.status))}>
                      {getStatusLabel(match.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {match.time}hs | {formatCurrency(match.cost)}
                  </p>
                </Link>

                <div className="flex items-center gap-1">
                  {(["confirmed", "pending", "declined"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleAttendance(match.id, s)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                        userAttendance[match.id] === s
                          ? s === "confirmed"
                            ? "bg-green-100 text-green-700"
                            : s === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      )}
                    >
                      {s === "confirmed" ? "✔️" : s === "pending" ? "❓" : "✖️"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">⚽</p>
              <p>No hay partidos {filter !== "all" ? (filter === "upcoming" ? "próximos" : "pasados") : ""}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
