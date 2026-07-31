"use client"

import { useEffect, useRef, useState } from "react"
import Navbar from "@/components/Navbar"
import { createClient } from "@/lib/supabase/client"
import { formatDateShort } from "@/lib/utils"
import type { Match, Profile } from "@/types"
import { toast } from "sonner"

interface MatchWithMVP extends Match {
  present: Profile[]
  myVotes: string[]
  mvp: { id: string; name: string; votes: number; points: number }[]
}

export default function MVPPage() {
  const [playedMatches, setPlayedMatches] = useState<MatchWithMVP[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [pointsConfig, setPointsConfig] = useState({ first: 3, second: 1 })
  const pointsConfigRef = useRef({ first: 3, second: 1 })
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: cfg } = await supabase.from("team_config").select("mvp_points_first, mvp_points_second").limit(1).single()
      if (cfg) {
        pointsConfigRef.current = { first: cfg.mvp_points_first, second: cfg.mvp_points_second }
        setPointsConfig(pointsConfigRef.current)
      }

      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "played")
        .order("date", { ascending: false })

      if (!matches) { setLoading(false); return }

      const matchesWithData: MatchWithMVP[] = await Promise.all(
        matches.map(async (m) => {
          const { data: attData } = await supabase
            .from("attendance")
            .select("profiles(*)")
            .eq("match_id", m.id)
            .eq("status", "confirmed")

          const present = ((attData || []) as unknown as { profiles: Profile }[]).map((a) => a.profiles)

          const { data: myVoteData } = await supabase
            .from("mvp_votes")
            .select("voted_id")
            .eq("match_id", m.id)
            .eq("voter_id", user.id)

          const myVotes = (myVoteData || []).map((v) => v.voted_id)

          const { data: votes } = await supabase
            .from("mvp_votes")
            .select("voted_id")
            .eq("match_id", m.id)

          const count: Record<string, number> = {}
          ;(votes || []).forEach((v) => {
            count[v.voted_id] = (count[v.voted_id] || 0) + 1
          })

          const ranked = Object.entries(count)
            .map(([pid, vcount]) => ({ id: pid, votes: vcount }))
            .sort((a, b) => b.votes - a.votes)
            .slice(0, 2)

          const mvp = ranked.map((r, i) => {
            const p = present.find((pl) => pl.id === r.id)
            return {
              id: r.id,
              name: p?.nickname || p?.name || "Jugador",
              votes: r.votes,
              points: i === 0 ? pointsConfigRef.current.first : pointsConfigRef.current.second,
            }
          })

          return { ...m, present, myVotes, mvp }
        })
      )

      setPlayedMatches(matchesWithData)
      setLoading(false)
    }

    load()
  }, [])

  function toggleSelection(matchId: string, playerId: string) {
    setSelected((prev) => {
      const current = prev[matchId] || []
      if (current.includes(playerId)) {
        return { ...prev, [matchId]: current.filter((p) => p !== playerId) }
      }
      if (current.length >= 2) {
        toast.error("Solo podés elegir 2 jugadores")
        return prev
      }
      return { ...prev, [matchId]: [...current, playerId] }
    })
  }

  async function handleVote(matchId: string) {
    const choices = selected[matchId] || []
    if (choices.length === 0 || !userId) return

    setSubmitting(matchId)
    const supabase = createClient()

    for (const votedId of choices) {
      const { error } = await supabase.from("mvp_votes").insert({
        match_id: matchId,
        voter_id: userId,
        voted_id: votedId,
      })

      if (error) {
        if (error.message.includes("2 veces") || error.message.includes("votaste")) {
          toast.error("Ya votaste 2 veces en este partido")
        } else {
          toast.error("No se pudo registrar el voto")
        }
        setSubmitting(null)
        return
      }
    }

    toast.success("Votos registrados")
    setSelected((prev) => ({ ...prev, [matchId]: [] }))
    setPlayedMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, myVotes: [...m.myVotes, ...choices] } : m
      )
    )
    setSubmitting(null)
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">🏆 MVP</h1>
        <p className="text-sm text-gray-500 mb-6">
          Los jugadores presentes votan por 2 MVPs. 1º suma {pointsConfig.first} pts y 2º suma {pointsConfig.second} pts.
        </p>

        <div className="space-y-4">
          {playedMatches.map((match) => {
            const isPresent = match.present.some((p) => p.id === userId)
            const votesLeft = 2 - match.myVotes.length
            const canVote = isPresent && votesLeft > 0
            const selection = selected[match.id] || []

            return (
              <div key={match.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-gray-900">{formatDateShort(match.date)}</p>
                  {match.mvp.length > 0 && (
                    <div className="flex gap-2">
                      {match.mvp.map((mvp, i) => (
                        <span
                          key={mvp.id}
                          className={`text-sm font-medium px-2 py-1 rounded-lg ${i === 0 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}
                        >
                          {i === 0 ? "🥇" : "🥈"} {mvp.name} ({mvp.votes} votos, {mvp.points} pts)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {canVote && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">
                      Elegí hasta 2 MVPs del partido ({votesLeft} voto{votesLeft !== 1 ? "s" : ""} disponible{votesLeft !== 1 ? "s" : ""}):
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {match.present.filter((p) => p.id !== userId).map((p) => {
                        const isSelected = selection.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleSelection(match.id, p.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                              isSelected
                                ? "bg-primary text-white border-primary"
                                : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            {p.nickname || p.name}
                          </button>
                        )
                      })}
                      {match.present.filter((p) => p.id !== userId).length === 0 && (
                        <p className="text-sm text-gray-400">No hay otros jugadores presentes</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleVote(match.id)}
                      disabled={submitting === match.id || selection.length === 0}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50"
                    >
                      {submitting === match.id ? "Votando..." : "Enviar votos"}
                    </button>
                  </div>
                )}

                {isPresent && !canVote && match.myVotes.length >= 2 && (
                  <p className="text-sm text-gray-400">
                    Ya votaste tus 2 MVPs de este partido. Los resultados se actualizan solos.
                  </p>
                )}

                {!isPresent && (
                  <p className="text-sm text-gray-400">
                    Solo los jugadores presentes pueden votar en este partido.
                  </p>
                )}
              </div>
            )
          })}

          {playedMatches.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🏆</p>
              <p>No hay partidos jugados todavía</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
